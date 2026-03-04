/* ========================================
   Enhanced Sync Service - Normalized Entities
   ======================================== */

const SyncServiceEnhanced = {
    db: null,

    /**
     * Initialize enhanced sync service
     */
    init(firebaseApp) {
        if (!window.firebase || !window.firebase.firestore) {
            console.error('[SyncEnhanced] Firestore not loaded');
            return false;
        }

        this.db = firebase.firestore();
        console.log('[SyncEnhanced] Initialized');
        return true;
    },

    /**
     * Get current user ID
     */
    getUserId() {
        return AuthService ? AuthService.getUserId() : null;
    },

    /**
     * Check if sync is available
     */
    canSync() {
        return this.db && this.getUserId() && navigator.onLine;
    },

    /**
     * Ensure user profile exists in Firestore
     * Used for collaborator lookup
     */
    async ensureUserProfile(user) {
        if (!this.db || !user) return;

        try {
            const userRef = this.db.collection('users').doc(user.uid);
            await userRef.set({
                uid: user.uid,
                email: (user.email || '').toLowerCase(),
                displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
                photoURL: user.photoURL || null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Apply any pending invites for this email
            if (user.email) {
                await this._applyPendingInvites(user.uid, user.email.toLowerCase());
            }
        } catch (error) {
            console.error('[SyncEnhanced] Failed to update user profile:', error);
        }
    },

    /**
     * Check for pending invites stored in trip documents and apply them.
     * When owner adds collaborator by email, email is stored in trip.pendingInvites.
     * On login, we look for any such trips and add the user as a real collaborator.
     */
    async _applyPendingInvites(uid, email) {
        try {
            // Query trips where this email appears in pendingInvites
            const tripsSnapshot = await this.db.collection('trips')
                .where('pendingInvites', 'array-contains', email)
                .get();

            if (tripsSnapshot.empty) return;

            const batch = this.db.batch();
            tripsSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    collaborators: firebase.firestore.FieldValue.arrayUnion(uid),
                    pendingInvites: firebase.firestore.FieldValue.arrayRemove(email),
                    version: firebase.firestore.FieldValue.increment(1),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            console.log(`[SyncEnhanced] Applied ${tripsSnapshot.size} pending invite(s) for ${email}`);
        } catch (error) {
            // Non-critical: log but don't block login
            console.warn('[SyncEnhanced] Could not apply pending invites:', error.message);
        }
    },

    /**
     * Check if local trip version matches cloud
     * Returns valid: true if safe to write
     */
    async checkTripVersion(tripId, localVersion) {
        if (!this.canSync()) return { valid: true }; // Offline mode serves as own truth

        try {
            const doc = await this.db.collection('trips').doc(tripId).get();
            if (!doc.exists) return { valid: true };

            const remoteVersion = doc.data().version || 0;
            // Allow if local version is same (about to increment) or greater (already ahead)
            // But strict concurrency (optimistic locking) usually requires:
            // update ... where version == lastKnownVersion

            // Here we just warn if cloud is ahead
            if (remoteVersion > localVersion) {
                console.warn(`[SyncEnhanced] Version mismatch. Cloud: ${remoteVersion}, Local: ${localVersion}`);
                return { valid: false, remoteVersion };
            }

            return { valid: true, remoteVersion };
        } catch (error) {
            console.error('[SyncEnhanced] Version check failed:', error);
            // Fail open or closed? Closed prevents data loss.
            return { valid: false, error: error.message };
        }
    },

    // ========================================
    // TRIP METHODS
    // ========================================

    /**
     * Sync trip (top-level data only)
     */
    /**
     * Sync trip (top-level data only)
     * Handles versioning and ownership
     */
    async syncTrip(trip) {
        if (!this.canSync()) {
            console.log('[SyncEnhanced] Cannot sync trip - offline or not authenticated');
            return { success: false, reason: 'offline_or_not_authenticated' };
        }

        try {
            const userId = this.getUserId();
            const tripRef = this.db.collection('trips').doc(trip.id);

            // Check if trip exists to handle creation vs update
            const doc = await tripRef.get();
            const exists = doc.exists;
            const currentData = exists ? doc.data() : {};

            const tripData = {
                // Ownership & Access
                ownerId: currentData.ownerId || trip.ownerId || userId,
                collaborators: currentData.collaborators || trip.collaborators || [userId],

                // Versioning
                version: exists ? firebase.firestore.FieldValue.increment(1) : 1,

                // Content
                id: trip.id,
                tripName: trip.tripName || '',
                destination: trip.destination || '',
                startDate: trip.startDate || '',
                endDate: trip.endDate || '',
                numberOfTravelers: trip.numberOfTravelers || 1,
                defaultTransportMode: trip.defaultTransportMode || 'car',
                isSelfDriveTrip: trip.isSelfDriveTrip || false,
                expectedTotalBudget: trip.expectedTotalBudget || 0,
                notes: trip.notes || '',
                vehicleName: trip.vehicleName || '',
                startingOdometer: trip.startingOdometer || 0,
                mileage: trip.mileage || 0,
                createdAt: trip.createdAt || new Date().toISOString(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastsyncedBy: userId
            };

            // Remove any remaining undefined keys
            Object.keys(tripData).forEach(key =>
                tripData[key] === undefined && delete tripData[key]
            );

            // Use merge: true to preserve other fields if any
            await tripRef.set(tripData, { merge: true });

            // Read back the actual version from Firestore and update local trip + localStorage
            // Without this, local version stays stale and future checkTripVersion rejects syncs
            try {
                const updatedDoc = await tripRef.get();
                if (updatedDoc.exists) {
                    const newVersion = updatedDoc.data().version || 0;
                    trip.version = newVersion;
                    console.log(`[SyncEnhanced] Trip synced: ${trip.id} (version now ${newVersion})`);

                    // Update localStorage so future syncs use the correct version
                    const trips = Storage.getTrips();
                    const idx = trips.findIndex(t => t.id === trip.id);
                    if (idx !== -1) {
                        trips[idx].version = newVersion;
                        Storage.saveTrips(trips);
                    }
                }
            } catch (readErr) {
                console.warn('[SyncEnhanced] Version readback failed (non-critical):', readErr.message);
            }

            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync trip:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Delete trip from cloud
     */
    async deleteTrip(tripId) {
        if (!this.canSync()) return { success: false };

        try {
            const userId = this.getUserId();

            // Delete trip
            await this.db.collection('trips').doc(tripId).delete();

            // Delete all related days
            const daysSnapshot = await this.db.collection('days')
                .where('tripId', '==', tripId)
                .where('userId', '==', userId)
                .get();

            const batch = this.db.batch();
            daysSnapshot.forEach(doc => batch.delete(doc.ref));

            // Delete all related activities
            const activitiesSnapshot = await this.db.collection('activities')
                .where('tripId', '==', tripId)
                .where('userId', '==', userId)
                .get();
            activitiesSnapshot.forEach(doc => batch.delete(doc.ref));

            // Delete all related expenses
            const expensesSnapshot = await this.db.collection('expenses')
                .where('tripId', '==', tripId)
                .where('userId', '==', userId)
                .get();
            expensesSnapshot.forEach(doc => batch.delete(doc.ref));

            // Delete accommodations and meals similarly
            const accommodationsSnapshot = await this.db.collection('accommodations')
                .where('tripId', '==', tripId)
                .where('userId', '==', userId)
                .get();
            accommodationsSnapshot.forEach(doc => batch.delete(doc.ref));

            const mealsSnapshot = await this.db.collection('meals')
                .where('tripId', '==', tripId)
                .where('userId', '==', userId)
                .get();
            mealsSnapshot.forEach(doc => batch.delete(doc.ref));

            // Delete all related travel
            const travelSnapshot = await this.db.collection('travel')
                .where('tripId', '==', tripId)
                .where('userId', '==', userId)
                .get();
            travelSnapshot.forEach(doc => batch.delete(doc.ref));

            await batch.commit();

            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to delete trip:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Delete a single document from a Firestore collection.
     * Used when user deletes an activity, meal, travel, or accommodation.
     */
    async deleteFromCloud(collection, docId) {
        if (!this.canSync() || !docId) return { success: false };
        try {
            await this.db.collection(collection).doc(docId).delete();
            console.log(`[SyncEnhanced] Deleted ${collection}/${docId} from cloud`);
            return { success: true };
        } catch (error) {
            console.warn(`[SyncEnhanced] Failed to delete ${collection}/${docId}:`, error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Delete a day and ALL its sub-entities from Firestore.
     * Cascades: activities, expenses, meals, travel, accommodations for that dayId.
     */
    async deleteDayFromCloud(dayId, tripId) {
        if (!this.canSync() || !dayId) return { success: false };
        try {
            const userId = this.getUserId();
            const batch = this.db.batch();

            // Delete the day document itself
            const daySnapshot = await this.db.collection('days')
                .where('id', '==', dayId)
                .where('userId', '==', userId)
                .get();
            daySnapshot.forEach(doc => batch.delete(doc.ref));

            // Delete all sub-entities for this day
            const collections = ['activities', 'expenses', 'meals', 'travel', 'accommodations'];
            for (const col of collections) {
                const snapshot = await this.db.collection(col)
                    .where('dayId', '==', dayId)
                    .where('userId', '==', userId)
                    .get();
                snapshot.forEach(doc => batch.delete(doc.ref));
            }

            await batch.commit();
            console.log(`[SyncEnhanced] Cascade-deleted day ${dayId} and all sub-entities`);
            return { success: true };
        } catch (error) {
            console.warn(`[SyncEnhanced] Failed to cascade-delete day ${dayId}:`, error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Remove all existing expense documents for a day before re-syncing.
     * Prevents stale expense accumulation (reconcileDayExpenses creates new IDs each time).
     */
    async cleanupDayExpenses(dayId) {
        if (!this.canSync() || !dayId) return { success: false };
        try {
            const userId = this.getUserId();
            const snapshot = await this.db.collection('expenses')
                .where('dayId', '==', dayId)
                .where('userId', '==', userId)
                .get();

            if (snapshot.empty) return { success: true };

            const batch = this.db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log(`[SyncEnhanced] Cleaned up ${snapshot.size} stale expenses for day ${dayId}`);
            return { success: true };
        } catch (error) {
            console.warn(`[SyncEnhanced] Failed to cleanup expenses for day ${dayId}:`, error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * After writing local sub-entities to Firestore, delete any Firestore docs
     * that are NOT in the local list (i.e., items deleted locally).
     * This is the correct way to sync deletions —  compare local IDs vs cloud IDs.
     */
    async cleanupOrphanedSubEntities(day, tripId) {
        if (!this.canSync()) return;
        try {
            const userId = this.getUserId();
            const dayId = day.id;
            const batch = this.db.batch();
            let orphanCount = 0;

            // Build sets of local IDs for each sub-entity type
            const localActivityIds = new Set((day.activities || []).map(a => a.id).filter(Boolean));
            const localMealIds = new Set((day.meals || []).map(m => m.id).filter(Boolean));
            const localTravelIds = new Set((day.travel || []).map(t => t.id).filter(Boolean));
            const localAccIds = new Set(day.accommodation && day.accommodation.id ? [day.accommodation.id] : []);

            // Check each collection for orphans
            const checks = [
                { collection: 'activities', localIds: localActivityIds },
                { collection: 'meals', localIds: localMealIds },
                { collection: 'travel', localIds: localTravelIds },
                { collection: 'accommodations', localIds: localAccIds },
            ];

            for (const { collection, localIds } of checks) {
                const snapshot = await this.db.collection(collection)
                    .where('dayId', '==', dayId)
                    .where('userId', '==', userId)
                    .get();

                snapshot.forEach(doc => {
                    const docData = doc.data();
                    const docId = docData.id || doc.id;
                    if (!localIds.has(docId)) {
                        batch.delete(doc.ref);
                        orphanCount++;
                        console.log(`[SyncEnhanced] Orphan found: ${collection}/${docId} (not in local)`);
                    }
                });
            }

            if (orphanCount > 0) {
                await batch.commit();
                console.log(`[SyncEnhanced] Cleaned up ${orphanCount} orphaned sub-entities for day ${dayId}`);
            }
        } catch (error) {
            console.warn(`[SyncEnhanced] Orphan cleanup failed for day ${day.id}:`, error.message);
        }
    },

    // ========================================
    // DAY METHODS
    // ========================================

    /**
     * Sync day
     */
    async syncDay(day, tripId) {
        if (!this.canSync()) return { success: false };

        try {
            const userId = this.getUserId();
            const dayData = {
                userId,
                tripId,
                id: day.id,
                date: day.date,
                dayNumber: day.dayNumber,
                startOdometer: day.startOdometer,
                endOdometer: day.endOdometer,
                fuelFilled: day.fuelFilled,
                fuelCost: day.fuelCost,
                transportOverride: day.transportOverride,
                dayNotes: day.dayNotes,
                createdAt: day.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                syncedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('days').doc(day.id).set(dayData);
            console.log('[SyncEnhanced] Day synced:', day.id);

            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync day:', error);
            return { success: false, error: error.message };
        }
    },

    // ========================================
    // ACTIVITY METHODS
    // ========================================

    /**
     * Sync activity
     */
    async syncActivity(activity, tripId, dayId) {
        if (!this.canSync()) return { success: false };

        try {
            const userId = this.getUserId();
            const activityData = {
                userId,
                tripId,
                dayId,
                id: activity.id,
                name: activity.name,
                location: activity.location,
                expectedCost: activity.expectedCost,
                actualCost: activity.actualCost,
                notes: activity.notes,
                createdAt: activity.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                syncedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('activities').doc(activity.id).set(activityData);
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync activity:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sync multiple activities
     */
    async syncActivities(activities, tripId, dayId) {
        if (!activities || activities.length === 0) return { success: true };
        if (!this.canSync()) return { success: false };

        try {
            const batch = this.db.batch();
            const userId = this.getUserId();

            activities.forEach(activity => {
                const activityRef = this.db.collection('activities').doc(activity.id);
                batch.set(activityRef, {
                    userId,
                    tripId,
                    dayId,
                    ...activity,
                    updatedAt: new Date().toISOString(),
                    syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            console.log(`[SyncEnhanced] ${activities.length} activities synced`);
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync activities:', error);
            return { success: false, error: error.message };
        }
    },

    // ========================================
    // EXPENSE METHODS
    // ========================================

    /**
     * Sync expense
     */
    async syncExpense(expense, tripId, dayId) {
        if (!this.canSync()) return { success: false };

        try {
            const userId = this.getUserId();
            const expenseData = {
                userId,
                tripId,
                dayId,
                id: expense.id,
                category: expense.category,
                description: expense.description,
                amount: expense.amount,
                notes: expense.notes,
                createdAt: expense.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                syncedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('expenses').doc(expense.id).set(expenseData);
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync expense:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sync multiple expenses
     */
    async syncExpenses(expenses, tripId, dayId) {
        if (!expenses || expenses.length === 0) return { success: true };
        if (!this.canSync()) return { success: false };

        try {
            const batch = this.db.batch();
            const userId = this.getUserId();

            expenses.forEach(expense => {
                const expenseRef = this.db.collection('expenses').doc(expense.id);
                batch.set(expenseRef, {
                    userId,
                    tripId,
                    dayId,
                    ...expense,
                    updatedAt: new Date().toISOString(),
                    syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            console.log(`[SyncEnhanced] ${expenses.length} expenses synced`);
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync expenses:', error);
            return { success: false, error: error.message };
        }
    },

    // ========================================
    // ACCOMMODATION METHODS
    // ========================================

    /**
     * Sync accommodation
     */
    async syncAccommodation(accommodation, tripId, dayId) {
        if (!this.canSync()) return { success: false };
        if (!accommodation || !accommodation.name) return { success: true }; // Skip empty

        try {
            const userId = this.getUserId();
            const accommodationData = {
                userId,
                tripId,
                dayId,
                id: accommodation.id || UUIDGenerator.generate(),
                type: accommodation.type,
                name: accommodation.name,
                expectedCost: accommodation.expectedCost,
                actualCost: accommodation.actualCost,
                notes: accommodation.notes,
                updatedAt: new Date().toISOString(),
                syncedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('accommodations').doc(accommodationData.id).set(accommodationData);
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync accommodation:', error);
            return { success: false, error: error.message };
        }
    },

    // ========================================
    // MEAL METHODS
    // ========================================

    /**
     * Sync meals (breakfast, lunch, dinner)
     */
    async syncMeals(food, tripId, dayId) {
        if (!this.canSync()) return { success: false };
        if (!food) return { success: true };

        try {
            const userId = this.getUserId();
            const batch = this.db.batch();

            ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
                const meal = food[mealType];
                if (meal && (meal.venue || meal.expectedCost > 0 || meal.actualCost > 0)) {
                    const mealId = meal.id || UUIDGenerator.generate();
                    const mealRef = this.db.collection('meals').doc(mealId);

                    batch.set(mealRef, {
                        userId,
                        tripId,
                        dayId,
                        id: mealId,
                        type: mealType,
                        venue: meal.venue,
                        expectedCost: meal.expectedCost,
                        actualCost: meal.actualCost,
                        notes: meal.notes,
                        updatedAt: new Date().toISOString(),
                        syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            await batch.commit();
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync meals:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sync meals from array format (day.meals[]) used by the meal form UI
     */
    async syncMealsArray(meals, tripId, dayId) {
        if (!meals || meals.length === 0) return { success: true };
        if (!this.canSync()) return { success: false };

        try {
            const batch = this.db.batch();
            const userId = this.getUserId();

            meals.forEach(meal => {
                if (meal && (meal.venue || meal.restaurantName || meal.expectedCost > 0 || meal.actualCost > 0)) {
                    const mealRef = this.db.collection('meals').doc(meal.id);
                    batch.set(mealRef, {
                        userId,
                        tripId,
                        dayId,
                        ...meal,
                        updatedAt: new Date().toISOString(),
                        syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            await batch.commit();
            console.log(`[SyncEnhanced] ${meals.length} meals (array) synced`);
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync meals array:', error);
            return { success: false, error: error.message };
        }
    },

    // ========================================
    // TRAVEL METHODS
    // ========================================

    /**
     * Sync travel entry
     */
    async syncTravel(travel, tripId, dayId) {
        if (!this.canSync()) return { success: false };

        try {
            const userId = this.getUserId();
            const travelData = {
                userId,
                tripId,
                dayId,
                id: travel.id,
                type: travel.type,
                from: travel.from,
                to: travel.to,
                time: travel.time,
                expectedCost: travel.expectedCost || 0,
                actualCost: travel.actualCost || 0,
                splitBetween: travel.splitBetween || 1,
                notes: travel.notes || '',
                updatedAt: new Date().toISOString(),
                syncedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('travel').doc(travel.id).set(travelData);
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync travel:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sync multiple travel entries
     */
    async syncTravels(travels, tripId, dayId) {
        if (!travels || travels.length === 0) return { success: true };
        if (!this.canSync()) return { success: false };

        try {
            const batch = this.db.batch();
            const userId = this.getUserId();

            travels.forEach(travel => {
                const travelRef = this.db.collection('travel').doc(travel.id);
                batch.set(travelRef, {
                    userId,
                    tripId,
                    dayId,
                    ...travel,
                    updatedAt: new Date().toISOString(),
                    syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            console.log(`[SyncEnhanced] ${travels.length} travel entries synced`);
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync travels:', error);
            return { success: false, error: error.message };
        }
    },

    // ========================================
    // COMPOSITE SYNC METHODS
    // ========================================

    /**
     * Sync entire trip with all related entities
     */
    async syncTripWithRelations(trip) {
        if (!this.canSync()) {
            console.log('[SyncEnhanced] Queueing trip for later sync');
            return { success: false, queued: true };
        }

        try {
            // Version check: log a warning but DO NOT block the sync.
            // Sub-entities (activities, meals, travel, etc.) have unique IDs and are
            // idempotent writes — safe to sync regardless of trip version.
            // For same-user multi-device usage, last-write-wins is acceptable.
            const versionCheck = await this.checkTripVersion(trip.id, trip.version || 0);
            if (!versionCheck.valid) {
                console.warn(`[SyncEnhanced] Version mismatch (local=${trip.version || 0}, cloud=${versionCheck.remoteVersion}) — proceeding anyway for same-user sync`);
            }

            // 1. Sync trip (this will increment version)
            const tripResult = await this.syncTrip(trip);
            if (!tripResult.success) return tripResult;

            // 2. Sync all days with their relations
            if (trip.days && trip.days.length > 0) {
                console.log(`[SyncEnhanced] Syncing ${trip.days.length} day(s) for trip ${trip.id}`);
                for (const day of trip.days) {
                    await this.syncDayWithRelations(day, trip.id);
                }
            } else {
                console.warn(`[SyncEnhanced] Trip ${trip.id} has NO days to sync (days=${JSON.stringify(trip.days)})`);
            }

            console.log('[SyncEnhanced] Full trip synced:', trip.id);

            // Mark as cloud-synced in localStorage so merge can detect cross-device deletions
            trip._cloudSynced = true;
            try {
                const trips = Storage.getTrips();
                const idx = trips.findIndex(t => t.id === trip.id);
                if (idx !== -1) {
                    trips[idx]._cloudSynced = true;
                    Storage.saveTrips(trips);
                }
            } catch (_) { /* non-critical */ }

            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync trip with relations:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sync day with all related entities
     */
    async syncDayWithRelations(day, tripId) {
        if (!this.canSync()) return { success: false };

        try {
            // 1. Sync day
            await this.syncDay(day, tripId);

            // 2. Sync activities
            if (day.activities && day.activities.length > 0) {
                await this.syncActivities(day.activities, tripId, day.id);
            }

            // 3. Sync expenses
            if (day.expenses && day.expenses.length > 0) {
                await this.syncExpenses(day.expenses, tripId, day.id);
            }

            // 4. Sync accommodation
            if (day.accommodation) {
                await this.syncAccommodation(day.accommodation, tripId, day.id);
            }

            // 5. Sync meals (object format from day.food)
            if (day.food) {
                await this.syncMeals(day.food, tripId, day.id);
            }

            // 5b. Sync meals (array format from day.meals — used by meal form UI)
            if (day.meals && day.meals.length > 0) {
                await this.syncMealsArray(day.meals, tripId, day.id);
            }

            // 6. Sync travel
            if (day.travel && day.travel.length > 0) {
                await this.syncTravels(day.travel, tripId, day.id);
            }

            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to sync day with relations:', error);
            return { success: false, error: error.message };
        }
    },

    // ========================================
    // PULL/FETCH METHODS
    // ========================================

    async fetchUserTrips() {
        if (!this.canSync()) return { success: false, trips: [] };

        try {
            const userId = this.getUserId();

            // Query 1: Trips where user is OWNER
            const ownerPromise = this.db.collection('trips')
                .where('ownerId', '==', userId)
                .get();

            // Query 2: Trips where user is COLLABORATOR
            // Querying 'collaborators' array-contains userId
            const collanderPromise = this.db.collection('trips')
                .where('collaborators', 'array-contains', userId)
                .get();

            const [ownerSnapshot, collaboratorSnapshot] = await Promise.all([
                ownerPromise,
                collanderPromise
            ]);

            const tripsMap = new Map();

            // Add owner trips
            ownerSnapshot.forEach(doc => {
                tripsMap.set(doc.id, doc.data());
            });

            // Add collaborator trips (merging duplicates if any)
            collaboratorSnapshot.forEach(doc => {
                // If trip already exists (e.g. owner is also in collaborators list), this overwrites it (fine)
                tripsMap.set(doc.id, doc.data());
            });

            const trips = Array.from(tripsMap.values());

            // Sort in memory
            trips.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

            console.log(`[SyncEnhanced] Fetched ${trips.length} trips (Owner: ${ownerSnapshot.size}, Shared: ${collaboratorSnapshot.size})`);
            return { success: true, trips };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to fetch trips:', error);
            // If query fails (e.g. index missing), try basic fallback
            if (error.code === 'failed-precondition') {
                console.warn('[SyncEnhanced] Missing index for collaboration query. Falling back to owner-only.');
                return this.fetchUserTripsFallback();
            }
            return { success: false, trips: [], error: error.message };
        }
    },

    /**
     * Fallback fetch for owner-only trips (if index missing)
     */
    async fetchUserTripsFallback() {
        try {
            const userId = this.getUserId();
            const snapshot = await this.db.collection('trips')
                .where('ownerId', '==', userId)
                .get();

            const trips = [];
            snapshot.forEach(doc => trips.push(doc.data()));
            trips.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
            return { success: true, trips };
        } catch (e) {
            return { success: false, trips: [], error: e.message };
        }
    },

    /**
     * Fetch trip with all relations (reconstruct denormalized structure)
     */
    async fetchTripWithRelations(tripId) {
        if (!this.canSync()) return { success: false, trip: null };

        try {
            const userId = this.getUserId();

            // 1. Fetch trip
            const tripDoc = await this.db.collection('trips').doc(tripId).get();
            if (!tripDoc.exists) {
                return { success: false, trip: null, error: 'Trip not found' };
            }

            const tripData = tripDoc.data();
            const isOwner = tripData.ownerId === userId;
            const isCollaborator = tripData.collaborators && tripData.collaborators.includes(userId);

            if (!isOwner && !isCollaborator) {
                console.warn('[SyncEnhanced] Access denied to trip:', tripId);
                return { success: false, trip: null, error: 'Access denied' };
            }

            const trip = tripData;

            // 2. Fetch days
            console.log(`[SyncEnhanced] Fetching days for trip ${tripId}, userId=${userId}`);
            let daysSnapshot;
            try {
                daysSnapshot = await this.db.collection('days')
                    .where('tripId', '==', tripId)
                    .where('userId', '==', userId)
                    .get();
                console.log(`[SyncEnhanced] Days query returned ${daysSnapshot.size} documents for trip ${tripId}`);
            } catch (daysErr) {
                console.error(`[SyncEnhanced] Days query FAILED for trip ${tripId}:`, daysErr.code, daysErr.message);
                // Try without userId filter as fallback
                try {
                    daysSnapshot = await this.db.collection('days')
                        .where('tripId', '==', tripId)
                        .get();
                    console.log(`[SyncEnhanced] Days fallback query returned ${daysSnapshot.size} documents`);
                } catch (fallbackErr) {
                    console.error(`[SyncEnhanced] Days fallback also FAILED:`, fallbackErr.code, fallbackErr.message);
                    daysSnapshot = { docs: [], size: 0 };
                }
            }

            trip.days = [];
            for (const dayDoc of daysSnapshot.docs) {
                const day = dayDoc.data();

                // Fetch activities for this day
                const activitiesSnapshot = await this.db.collection('activities')
                    .where('dayId', '==', day.id)
                    .where('userId', '==', userId)
                    .get();
                day.activities = activitiesSnapshot.docs.map(doc => doc.data());

                // Fetch expenses for this day
                const expensesSnapshot = await this.db.collection('expenses')
                    .where('dayId', '==', day.id)
                    .where('userId', '==', userId)
                    .get();
                day.expenses = expensesSnapshot.docs.map(doc => doc.data());

                // Fetch accommodation
                const accommodationSnapshot = await this.db.collection('accommodations')
                    .where('dayId', '==', day.id)
                    .where('userId', '==', userId)
                    .limit(1)
                    .get();
                day.accommodation = accommodationSnapshot.empty ? null : accommodationSnapshot.docs[0].data();

                // Fetch meals
                const mealsSnapshot = await this.db.collection('meals')
                    .where('dayId', '==', day.id)
                    .where('userId', '==', userId)
                    .get();

                day.food = { breakfast: {}, lunch: {}, dinner: {} };
                day.meals = []; // Array format used by reconcileDayExpenses
                mealsSnapshot.forEach(doc => {
                    const meal = doc.data();
                    if (meal.type) {
                        day.food[meal.type] = meal;
                    }
                    day.meals.push(meal); // reconcileDayExpenses reads from day.meals[]
                });

                // Fetch travel
                const travelSnapshot = await this.db.collection('travel')
                    .where('dayId', '==', day.id)
                    .where('userId', '==', userId)
                    .get();
                day.travel = travelSnapshot.docs.map(doc => doc.data());

                trip.days.push(day);
            }

            // Sort days in memory (moved from query)
            trip.days.sort((a, b) => a.dayNumber - b.dayNumber);

            console.log('[SyncEnhanced] Fetched trip with relations:', tripId);
            return { success: true, trip };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to fetch trip with relations:', error);
            return { success: false, trip: null, error: error.message };
        }
    },

    /**
     * Add collaborator to trip by email.
     * If they've already signed in → add directly to collaborators.
     * Otherwise → add email to trip's pendingInvites array (applies on their first login).
     */
    async addCollaborator(tripId, email) {
        if (!this.canSync()) return { success: false, error: 'Not signed in or offline. Please sign in first.' };

        const normalizedEmail = email.toLowerCase().trim();
        const currentUid = this.getUserId();

        // STEP 1: Look up user by email
        let usersSnapshot;
        try {
            usersSnapshot = await this.db.collection('users')
                .where('email', '==', normalizedEmail)
                .limit(1)
                .get();
        } catch (err) {
            console.error('[SyncEnhanced] User lookup failed:', err);
            return { success: false, error: 'User lookup failed: ' + err.message };
        }

        if (!usersSnapshot.empty) {
            // STEP 2a: User found — add directly to collaborators
            const collaborator = usersSnapshot.docs[0].data();
            try {
                const tripRef = this.db.collection('trips').doc(tripId);
                await tripRef.update({
                    collaborators: firebase.firestore.FieldValue.arrayUnion(collaborator.uid),
                    version: firebase.firestore.FieldValue.increment(1),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('[SyncEnhanced] Added existing user as collaborator:', normalizedEmail);
                return { success: true, user: collaborator, pending: false };
            } catch (err) {
                console.error('[SyncEnhanced] Trip collaborator update failed:', err);
                if (err.code === 'not-found') {
                    return { success: false, error: 'Trip not synced to cloud yet. Please use Force Sync first, then try again.' };
                }
                return { success: false, error: 'Trip update failed: ' + err.message };
            }
        }

        // STEP 2b: User not found — check if trip exists in Firestore before updating
        const tripRef = this.db.collection('trips').doc(tripId);
        let tripDoc;
        try {
            tripDoc = await tripRef.get();
        } catch (err) {
            // With new rules, resource==null is allowed — so this error means real permission issue
            console.error('[SyncEnhanced] Trip read failed:', err);
            return { success: false, needsSync: true, error: 'Trip read failed: ' + err.message };
        }

        if (!tripDoc.exists) {
            // Trip not in Firestore — signal caller to sync first then retry
            console.warn('[SyncEnhanced] Trip not in Firestore:', tripId);
            return { success: false, needsSync: true, error: 'Trip not synced yet' };
        }

        // Verify this user is the owner (graceful check)
        const tripData = tripDoc.data();
        if (tripData.ownerId && tripData.ownerId !== currentUid) {
            return { success: false, error: 'Only the trip owner can share it.' };
        }

        // STEP 3: Add email to pendingInvites
        try {
            await tripRef.update({
                pendingInvites: firebase.firestore.FieldValue.arrayUnion(normalizedEmail),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('[SyncEnhanced] Stored pending invite in trip doc for:', normalizedEmail);
            return {
                success: true,
                pending: true,
                user: { displayName: normalizedEmail, email: normalizedEmail, uid: null }
            };
        } catch (err) {
            console.error('[SyncEnhanced] PendingInvites update failed:', err);
            return { success: false, error: 'Invite storage failed: ' + err.message };
        }
    },

    /**
     * Remove collaborator from trip (owner only)
     */
    async removeCollaborator(tripId, collaboratorUid) {
        if (!this.canSync()) return { success: false, error: 'Offline' };

        try {
            const tripRef = this.db.collection('trips').doc(tripId);
            await tripRef.update({
                collaborators: firebase.firestore.FieldValue.arrayRemove(collaboratorUid),
                version: firebase.firestore.FieldValue.increment(1),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('[SyncEnhanced] Removed collaborator:', collaboratorUid);
            return { success: true };
        } catch (error) {
            console.error('[SyncEnhanced] Failed to remove collaborator:', error);
            return { success: false, error: error.message };
        }
    }
};
