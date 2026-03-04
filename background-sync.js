/* ========================================
   Background Sync Manager
   ======================================== */

const BackgroundSync = {
    isSyncing: false,
    lastSyncTime: null,
    _unsubscribeOwned: null,
    _unsubscribeCollabs: null,
    _snapshotDebounceTimer: null,

    /**
     * Initialize background sync
     */
    init() {
        console.log('[BackgroundSync] Initialized');

        window.addEventListener('online', () => {
            console.log('[BackgroundSync] Network online');
            this.syncOnReconnect();
        });

        window.addEventListener('offline', () => {
            console.log('[BackgroundSync] Network offline');
        });
    },

    /**
     * Sync on app launch (non-blocking).
     * Steps:
     *  0. Apply pending invites
     *  1. Fetch all accessible trips from Firestore
     *  2. Merge with local, cloud wins when cloud version > local version
     *  3. Hydrate new shared trips (fetch days/activities/expenses)
     *  4. Upload local-only / locally-newer trips to cloud
     *  5. Refresh UI
     *  6. Start real-time listeners
     */
    async syncOnLaunch() {
        console.log('[BackgroundSync] Starting launch sync...');

        if (!this.canSync()) {
            console.log('[BackgroundSync] Cannot sync - not authenticated or offline');
            return;
        }

        if (this.isSyncing) {
            console.log('[BackgroundSync] Already syncing, skipping');
            return;
        }

        this.isSyncing = true;
        if (window.AccountUI) AccountUI.updateSyncStatus('syncing');

        try {
            // 0. Apply pending invites FIRST so subsequent fetch includes newly accepted trips
            const currentUser = typeof AuthService !== 'undefined' && AuthService.currentUser;
            if (currentUser && typeof SyncServiceEnhanced !== 'undefined') {
                await SyncServiceEnhanced._applyPendingInvites(currentUser.uid, currentUser.email);
            }

            // 1. Fetch all trips from cloud (owned + collaborated)
            const cloudResult = await SyncServiceEnhanced.fetchUserTrips();
            const cloudTrips = cloudResult.trips || [];
            console.log(`[BackgroundSync] Fetched ${cloudTrips.length} trips from cloud`);

            // 2. Get local trips
            const localTrips = Storage.getTrips();
            console.log(`[BackgroundSync] Found ${localTrips.length} local trips`);

            // 3. Version-based merge: cloud wins when cloud.version > local.version
            const cloudMap = new Map(cloudTrips.map(t => [t.id, t]));
            const localMap = new Map(localTrips.map(t => [t.id, t]));

            const finalTrips = [];
            const tripsNeedingUpload = [];
            const newSharedTripIds = []; // Cloud-only trips that need full hydration

            // Process trips that exist in the cloud
            for (const [id, cloudTrip] of cloudMap) {
                const localTrip = localMap.get(id);

                if (!localTrip) {
                    // New trip from cloud (shared trip or synced from another device)
                    // Mark as cloud-synced so future merge knows this trip has been in Firestore
                    cloudTrip._cloudSynced = true;
                    newSharedTripIds.push(id);
                    finalTrips.push(cloudTrip); // placeholder; will be replaced after hydration
                } else {
                    const cloudVersion = cloudTrip.version || 0;
                    const localVersion = localTrip.version || 0;

                    // ALWAYS fetch full cloud trip to merge sub-entities from both devices.
                    // Even when localVersion > cloudVersion, the cloud may have sub-entities
                    // (activities, meals, travel, etc.) added by another device.
                    try {
                        const full = await SyncServiceEnhanced.fetchTripWithRelations(id);
                        if (full.success && full.trip) {
                            const cloudFull = full.trip;
                            cloudFull._cloudSynced = true;

                            if (localVersion > cloudVersion) {
                                // Local trip metadata is newer — use local metadata
                                // but use CLOUD sub-entities as authoritative for deletions.
                                //
                                // Why cloud-authoritative for sub-entities?
                                // Storage.saveTrip() immediately calls syncTripWithRelations(),
                                // so any local item should already be in Firestore. If an item
                                // is in local but NOT in cloud, it was DELETED by another device.
                                // Union merge would re-add deleted items = bug.
                                //
                                // BUT we must not drop entire days that haven't synced yet.
                                const mergedTrip = { ...localTrip };
                                mergedTrip._cloudSynced = true;

                                // Build a cloud day lookup
                                const cloudDayMap = new Map();
                                (cloudFull.days || []).forEach(d => cloudDayMap.set(d.id, d));

                                // Merge: for each local day, use cloud sub-entities if cloud has that day
                                const mergedDays = [];
                                (localTrip.days || []).forEach(localDay => {
                                    const cloudDay = cloudDayMap.get(localDay.id);
                                    if (cloudDay) {
                                        // Day exists in both: use cloud sub-entities (authoritative)
                                        // but keep local day metadata (dates, dayNumber, etc.)
                                        const merged = { ...localDay };
                                        merged.activities = cloudDay.activities || [];
                                        merged.meals = cloudDay.meals || [];
                                        merged.travel = cloudDay.travel || [];
                                        merged.accommodation = cloudDay.accommodation;
                                        merged.expenses = cloudDay.expenses || [];
                                        merged.food = cloudDay.food || localDay.food;
                                        mergedDays.push(merged);
                                    } else {
                                        // Day only in local (not yet synced) — keep it
                                        mergedDays.push(localDay);
                                    }
                                });

                                // Add any cloud-only days not in local
                                (cloudFull.days || []).forEach(cloudDay => {
                                    if (!mergedDays.find(d => d.id === cloudDay.id)) {
                                        mergedDays.push(cloudDay);
                                    }
                                });

                                mergedDays.sort((a, b) => a.dayNumber - b.dayNumber);
                                mergedTrip.days = mergedDays;

                                finalTrips.push(mergedTrip);
                                tripsNeedingUpload.push(mergedTrip); // Upload merged data
                            } else {
                                // Cloud is newer or same — use cloud trip entirely
                                // (sub-entities already fetched via fetchTripWithRelations)
                                finalTrips.push(cloudFull);
                            }
                        } else {
                            cloudTrip._cloudSynced = true;
                            cloudTrip.days = localTrip.days || [];
                            finalTrips.push(cloudTrip);
                        }
                    } catch (err) {
                        console.warn(`[BackgroundSync] Failed to hydrate trip ${id}:`, err.message);
                        localTrip._cloudSynced = true;
                        finalTrips.push(localTrip);
                    }
                }
            }

            // ── Professional cloud-first sync pattern ──
            // Determine if a local-only trip was previously in Firestore (deleted elsewhere)
            // or is genuinely a new offline trip that needs uploading.
            //
            // Three signals indicate "was in cloud":
            //   1. _cloudSynced === true            (v88+ explicit flag)
            //   2. version > 0                      (version incremented by syncTrip)
            //   3. ownerId exists                   (set during Firestore write)
            //
            // A trip is "new offline" ONLY if _cloudSynced === false AND version is 0/absent AND no ownerId
            let deletedOnOtherDevice = 0;
            for (const [id, localTrip] of localMap) {
                if (!cloudMap.has(id)) {
                    const wasInCloud = localTrip._cloudSynced === true
                        || (localTrip.version && localTrip.version > 0)
                        || !!localTrip.ownerId;

                    if (wasInCloud) {
                        // Previously synced but gone from cloud → deleted on another device
                        console.log(`[BackgroundSync] Trip ${id} deleted on another device → removing locally (flags: _cs=${localTrip._cloudSynced}, v=${localTrip.version}, oid=${!!localTrip.ownerId})`);
                        deletedOnOtherDevice++;
                        // Don't add to finalTrips → removed from localStorage
                    } else {
                        // Genuinely new offline trip → upload
                        finalTrips.push(localTrip);
                        tripsNeedingUpload.push(localTrip);
                    }
                }
            }
            if (deletedOnOtherDevice > 0) {
                console.log(`[BackgroundSync] Cleaned up ${deletedOnOtherDevice} cloud-deleted trip(s)`);
            }

            // 4. Hydrate new cloud-only trips with full relations (days/activities/expenses)
            if (newSharedTripIds.length > 0) {
                console.log(`[BackgroundSync] Hydrating ${newSharedTripIds.length} new cloud trip(s)...`);
                for (const tripId of newSharedTripIds) {
                    const full = await SyncServiceEnhanced.fetchTripWithRelations(tripId);
                    if (full.success && full.trip) {
                        full.trip._cloudSynced = true;
                        const idx = finalTrips.findIndex(t => t.id === tripId);
                        if (idx !== -1) finalTrips[idx] = full.trip;
                    }
                }
                if (window.UIComponents) {
                    UIComponents.showToast(`☁️ ${newSharedTripIds.length} shared trip(s) synced`, 'success', 3000);
                }
            }

            // 5. Save merged trips to localStorage
            Storage.saveTrips(finalTrips);
            console.log(`[BackgroundSync] Saved ${finalTrips.length} merged trips locally`);

            // 6. Upload local-only / locally-newer trips to cloud
            let uploadCount = 0;
            for (const trip of tripsNeedingUpload) {
                try {
                    await SyncServiceEnhanced.syncTripWithRelations(trip);
                    uploadCount++;
                } catch (err) {
                    console.warn(`[BackgroundSync] Upload failed for ${trip.id}:`, err.message);
                }
            }
            if (uploadCount > 0) console.log(`[BackgroundSync] Uploaded ${uploadCount} trips to cloud`);

            // 7. Refresh UI
            if (window.App && App.currentScreen === 'tripList') {
                App.showTripList();
            }

            if (newSharedTripIds.length > 0 || tripsNeedingUpload.length > 0) {
                // Already showed shared-trip toast above if applicable
            } else if (cloudTrips.length > 0) {
                if (window.UIComponents) UIComponents.showToast('☁️ Synced with cloud', 'success', 2000);
            }

            this.lastSyncTime = new Date();
            if (window.AccountUI) AccountUI.updateSyncStatus('synced');
            console.log('[BackgroundSync] Launch sync completed successfully');

            // 8. Start real-time listeners (idempotent)
            this.startRealtimeListeners();

        } catch (error) {
            console.error('[BackgroundSync] Launch sync failed:', error);
            if (window.AccountUI) AccountUI.updateSyncStatus('error');
            if (window.UIComponents) UIComponents.showToast('Sync failed, will retry', 'warning', 2000);
        } finally {
            this.isSyncing = false;
        }
    },

    /**
     * Start Firestore real-time listeners for all accessible trips.
     * Calls this once after initial sync. Idempotent — stops old listeners first.
     */
    startRealtimeListeners() {
        if (!this.canSync()) return;

        // Stop existing listeners first
        this.stopRealtimeListeners();

        const db = SyncServiceEnhanced.db;
        const userId = SyncServiceEnhanced.getUserId();

        if (!db || !userId) return;

        console.log('[BackgroundSync] Starting real-time trip listeners...');

        const handleSnapshot = async (snapshot) => {
            if (snapshot.empty) return;

            // Debounce rapid changes (e.g. batch writes)
            clearTimeout(this._snapshotDebounceTimer);
            this._snapshotDebounceTimer = setTimeout(async () => {
                for (const change of snapshot.docChanges()) {
                    const tripId = change.doc.id;

                    if (change.type === 'removed') {
                        // Trip was deleted or we lost access — remove from local
                        const trips = Storage.getTrips().filter(t => t.id !== tripId);
                        Storage.saveTrips(trips);
                        console.log(`[BackgroundSync] Real-time: removed trip ${tripId}`);
                        if (window.App && App.currentScreen === 'tripList') App.showTripList();
                        continue;
                    }

                    // Added or modified — fetch full trip with relations
                    try {
                        const full = await SyncServiceEnhanced.fetchTripWithRelations(tripId);
                        if (full.success && full.trip) {
                            const trips = Storage.getTrips();
                            const idx = trips.findIndex(t => t.id === tripId);
                            if (idx !== -1) {
                                trips[idx] = full.trip;
                            } else {
                                trips.push(full.trip);
                            }
                            Storage.saveTrips(trips);
                            console.log(`[BackgroundSync] Real-time: updated trip ${tripId}`);

                            // Refresh UI if on the relevant screen
                            if (window.App) {
                                if (App.currentScreen === 'tripList') {
                                    App.showTripList();
                                } else if (App.currentScreen === 'tripDetail' &&
                                    App.currentTrip && App.currentTrip.id === tripId) {
                                    // Refresh current trip detail view
                                    App.currentTrip = full.trip;
                                    App.showTripDetail(full.trip);
                                }
                            }
                        }
                    } catch (err) {
                        console.warn(`[BackgroundSync] Real-time fetch failed for ${tripId}:`, err.message);
                    }
                }
            }, 150); // 150ms debounce
        };

        // Listener 1: Trips owned by this user
        try {
            this._unsubscribeOwned = db.collection('trips')
                .where('ownerId', '==', userId)
                .onSnapshot(handleSnapshot, err => {
                    console.warn('[BackgroundSync] Owner listener error:', err.message);
                });
        } catch (e) {
            console.warn('[BackgroundSync] Could not start owner listener:', e.message);
        }

        // Listener 2: Trips where this user is a collaborator
        try {
            this._unsubscribeCollabs = db.collection('trips')
                .where('collaborators', 'array-contains', userId)
                .onSnapshot(handleSnapshot, err => {
                    console.warn('[BackgroundSync] Collaborator listener error:', err.message);
                });
        } catch (e) {
            console.warn('[BackgroundSync] Could not start collaborator listener:', e.message);
        }

        console.log('[BackgroundSync] Real-time listeners active');
    },

    /**
     * Stop all Firestore real-time listeners (call on sign-out)
     */
    stopRealtimeListeners() {
        if (this._unsubscribeOwned) {
            this._unsubscribeOwned();
            this._unsubscribeOwned = null;
        }
        if (this._unsubscribeCollabs) {
            this._unsubscribeCollabs();
            this._unsubscribeCollabs = null;
        }
        clearTimeout(this._snapshotDebounceTimer);
        console.log('[BackgroundSync] Real-time listeners stopped');
    },

    /**
     * Sync on reconnect
     */
    async syncOnReconnect() {
        console.log('[BackgroundSync] Syncing on reconnect...');
        if (window.SyncQueue && SyncQueue.hasItems()) {
            await SyncQueue.processQueue();
        }
        await this.syncOnLaunch();
    },

    /**
     * Check if sync is possible
     */
    canSync() {
        const isOnline = navigator.onLine;
        const isAuth = typeof AuthService !== 'undefined' && AuthService.isAuthenticated();
        const isSyncReady = typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync();
        return isOnline && isAuth && isSyncReady;
    },

    /**
     * Force manual sync
     */
    async forceSync() {
        if (this.isSyncing) {
            console.log('[BackgroundSync] Already syncing');
            return;
        }
        console.log('[BackgroundSync] Manual sync triggered');
        await this.syncOnLaunch();
    },

    /**
     * Get sync status
     */
    getSyncStatus() {
        return {
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime,
            canSync: this.canSync(),
            queueSize: window.SyncQueue ? SyncQueue.getQueueSize() : 0
        };
    },

    /**
     * Update sync status indicator in UI
     */
    updateSyncStatus(status) {
        const syncStatus = document.getElementById('syncStatus');
        if (!syncStatus) return;

        switch (status) {
            case 'syncing':
                syncStatus.innerHTML = '⏳';
                syncStatus.title = 'Syncing...';
                syncStatus.classList.remove('synced');
                break;
            case 'synced':
                syncStatus.innerHTML = '☁️';
                syncStatus.title = 'Synced';
                syncStatus.classList.add('synced');
                break;
            case 'error':
                syncStatus.innerHTML = '⚠️';
                syncStatus.title = 'Sync failed (queued)';
                syncStatus.classList.remove('synced');
                break;
            case 'offline':
            default:
                syncStatus.innerHTML = '📴';
                syncStatus.title = 'Offline only';
                syncStatus.classList.remove('synced');
                break;
        }
    }
};
