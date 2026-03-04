/* ========================================
   Sync Service - Cloud Synchronization
   ======================================== */

const SyncService = {
    db: null,
    syncEnabled: false,
    syncQueue: [],
    isSyncing: false,
    lastSyncTime: null,

    /**
     * Initialize sync service
     */
    init(firebaseApp) {
        if (!window.firebase || !window.firebase.firestore) {
            console.error('Firebase Firestore not loaded');
            return false;
        }

        this.db = firebase.firestore();
        this.loadSyncQueue();

        // Listen for auth changes
        AuthService.onAuthStateChange((user) => {
            if (user) {
                this.enableSync();
                this.syncAll();
            } else {
                this.disableSync();
            }
        });

        // Listen for online/offline
        window.addEventListener('online', () => {
            console.log('[Sync] Online - processing queue');
            this.processQueue();
        });

        window.addEventListener('offline', () => {
            console.log('[Sync] Offline - queueing changes');
        });

        return true;
    },

    /**
     * Enable sync
     */
    enableSync() {
        this.syncEnabled = true;
        localStorage.setItem('sync_enabled', 'true');
    },

    /**
     * Disable sync
     */
    disableSync() {
        this.syncEnabled = false;
        localStorage.setItem('sync_enabled', 'false');
    },

    /**
     * Check if sync is enabled
     */
    isSyncEnabled() {
        return this.syncEnabled && AuthService.isSignedIn() && navigator.onLine;
    },

    /**
     * Sync a single trip
     */
    async syncTrip(trip) {
        if (!this.isSyncEnabled()) {
            this.queueChange('save', trip);
            return { success: true, queued: true };
        }

        try {
            const userId = AuthService.getUserId();
            const tripRef = this.db.collection('users').doc(userId).collection('trips').doc(trip.id);

            const syncData = {
                ...trip,
                userId: userId,
                syncedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: trip.updatedAt || new Date().toISOString()
            };

            await tripRef.set(syncData, { merge: true });

            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('last_sync_time', this.lastSyncTime);

            return { success: true, synced: true };
        } catch (error) {
            console.error('[Sync] Failed to sync trip:', error);
            this.queueChange('save', trip);
            return { success: false, error: error.message, queued: true };
        }
    },

    /**
     * Delete trip from cloud
     */
    async deleteTrip(tripId) {
        if (!this.isSyncEnabled()) {
            this.queueChange('delete', { id: tripId });
            return { success: true, queued: true };
        }

        try {
            const userId = AuthService.getUserId();
            await this.db.collection('users').doc(userId).collection('trips').doc(tropId).delete();

            return { success: true, deleted: true };
        } catch (error) {
            console.error('[Sync] Failed to delete trip:', error);
            this.queueChange('delete', { id: tripId });
            return { success: false, error: error.message, queued: true };
        }
    },

    /**
     * Sync all trips
     */
    async syncAll() {
        if (!this.isSyncEnabled()) {
            console.log('[Sync] Sync disabled or offline');
            return { success: false, reason: 'sync_disabled' };
        }

        try {
            // Get local trips
            const localTrips = Storage.getTrips();

            // Get cloud trips
            const userId = AuthService.getUserId();
            const snapshot = await this.db.collection('users').doc(userId).collection('trips').get();

            const cloudTrips = {};
            snapshot.forEach(doc => {
                cloudTrips[doc.id] = doc.data();
            });

            // Merge trips
            const mergedTrips = this.mergeTrips(localTrips, Object.values(cloudTrips));

            // Update local storage
            Storage.saveTrips(mergedTrips);

            // Push any local-only trips to cloud
            for (const trip of mergedTrips) {
                if (!cloudTrips[trip.id] || new Date(trip.updatedAt) > new Date(cloudTrips[trip.id].updatedAt)) {
                    await this.syncTrip(trip);
                }
            }

            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('last_sync_time', this.lastSyncTime);

            return { success: true, count: mergedTrips.length };
        } catch (error) {
            console.error('[Sync] Failed to sync all trips:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Merge local and cloud trips (conflict resolution)
     */
    mergeTrips(localTrips, cloudTrips) {
        const merged = new Map();

        // Add all local trips
        localTrips.forEach(trip => {
            merged.set(trip.id, trip);
        });

        // Merge cloud trips (last-write-wins)
        cloudTrips.forEach(cloudTrip => {
            const localTrip = merged.get(cloudTrip.id);

            if (!localTrip) {
                // Cloud-only trip
                merged.set(cloudTrip.id, cloudTrip);
            } else {
                // Conflict - use newer version
                const localTime = new Date(localTrip.updatedAt || localTrip.createdAt);
                const cloudTime = new Date(cloudTrip.updatedAt || cloudTrip.createdAt);

                if (cloudTime >= localTime) {
                    merged.set(cloudTrip.id, cloudTrip);
                }
            }
        });

        return Array.from(merged.values());
    },

    /**
     * Queue a change for later sync
     */
    queueChange(operation, data) {
        this.syncQueue.push({
            operation: operation,
            data: data,
            timestamp: new Date().toISOString()
        });

        this.saveSyncQueue();
    },

    /**
     * Process sync queue
     */
    async processQueue() {
        if (this.isSyncing || !this.isSyncEnabled() || this.syncQueue.length === 0) {
            return;
        }

        this.isSyncing = true;
        console.log(`[Sync] Processing ${this.syncQueue.length} queued changes`);

        const queue = [...this.syncQueue];
        this.syncQueue = [];

        for (const item of queue) {
            try {
                if (item.operation === 'save') {
                    await this.syncTrip(item.data);
                } else if (item.operation === 'delete') {
                    await this.deleteTrip(item.data.id);
                }
            } catch (error) {
                console.error('[Sync] Queue item failed:', error);
                this.syncQueue.push(item); // Re-queue on failure
            }
        }

        this.saveSyncQueue();
        this.isSyncing = false;
    },

    /**
     * Save sync queue to localStorage
     */
    saveSyncQueue() {
        localStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
    },

    /**
     * Load sync queue from localStorage
     */
    loadSyncQueue() {
        const saved = localStorage.getItem('sync_queue');
        this.syncQueue = saved ? JSON.parse(saved) : [];
    },

    /**
     * Get sync status
     */
    getSyncStatus() {
        return {
            enabled: this.syncEnabled,
            signedIn: AuthService.isSignedIn(),
            online: navigator.onLine,
            lastSyncTime: this.lastSyncTime,
            queuedChanges: this.syncQueue.length,
            syncing: this.isSyncing
        };
    }
};
