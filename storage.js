/* ========================================
   Storage Layer - Data Persistence
   ======================================== */

const Storage = {
    // Storage keys
    KEYS: {
        TRIPS: 'mytrip_trips',
        SETTINGS: 'mytrip_settings',
        VERSION: 'mytrip_version'
    },

    // Current schema version
    SCHEMA_VERSION: 1,

    /**
     * Initialize storage and perform migrations if needed
     */
    init() {
        try {
            const version = this.getVersion();
            if (version < this.SCHEMA_VERSION) {
                this.migrate(version, this.SCHEMA_VERSION);
            }
            this.setVersion(this.SCHEMA_VERSION);
            return true;
        } catch (error) {
            console.error('Storage initialization failed:', error);
            return false;
        }
    },

    /**
     * Get current schema version
     */
    getVersion() {
        const version = localStorage.getItem(this.KEYS.VERSION);
        return version ? parseInt(version, 10) : 0;
    },

    /**
     * Set schema version
     */
    setVersion(version) {
        localStorage.setItem(this.KEYS.VERSION, version.toString());
    },

    /**
     * Migrate data between schema versions
     */
    migrate(fromVersion, toVersion) {
        console.log(`Migrating storage from v${fromVersion} to v${toVersion}`);
        // Future migration logic goes here
    },

    /**
     * Get all trips
     */
    getTrips() {
        try {
            const data = localStorage.getItem(this.KEYS.TRIPS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get trips:', error);
            return [];
        }
    },

    /**
     * Save all trips
     */
    saveTrips(trips) {
        try {
            localStorage.setItem(this.KEYS.TRIPS, JSON.stringify(trips));
            return true;
        } catch (error) {
            console.error('Failed to save trips:', error);
            return false;
        }
    },

    /**
     * Get a single trip by ID
     */
    getTrip(tripId) {
        const trips = this.getTrips();
        return trips.find(trip => trip.id === tripId);
    },

    /**
     * Save a single trip (add or update)
     */
    saveTrip(trip) {
        try {
            const trips = this.getTrips();
            const index = trips.findIndex(t => t.id === trip.id);

            if (index >= 0) {
                // Update existing trip
                trip.updatedAt = new Date().toISOString();
                trips[index] = trip;
            } else {
                // Add new trip — mark as never synced to cloud
                trip.createdAt = new Date().toISOString();
                trip.updatedAt = trip.createdAt;
                if (trip._cloudSynced === undefined) trip._cloudSynced = false;
                trips.push(trip);
            }

            const saved = this.saveTrips(trips);

            // Trigger cloud sync — use typeof because SyncServiceEnhanced is a const, not on window
            if (saved && typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync()) {
                SyncServiceEnhanced.syncTripWithRelations(trip).catch(err => {
                    console.warn('[Storage] Cloud sync failed (queued):', err.message);
                });
            } else if (saved && typeof SyncService !== 'undefined' && SyncService.canSync && SyncService.canSync()) {
                SyncService.syncTrip(trip).catch(err => {
                    console.warn('[Storage] Cloud sync fallback failed (queued):', err.message);
                });
            }

            return saved;
        } catch (error) {
            console.error('Failed to save trip:', error);
            return false;
        }
    },

    /**
     * Delete a trip by ID
     */
    deleteTrip(tripId) {
        try {
            const trips = this.getTrips();
            const filtered = trips.filter(trip => trip.id !== tripId);
            const deleted = this.saveTrips(filtered);

            // Trigger cloud delete — use typeof because SyncServiceEnhanced is a const, not on window
            if (deleted && typeof SyncServiceEnhanced !== 'undefined' && SyncServiceEnhanced.canSync()) {
                SyncServiceEnhanced.deleteTrip(tripId).catch(err => {
                    console.warn('[Storage] Cloud delete failed (queued):', err.message);
                });
            } else if (deleted && typeof SyncService !== 'undefined' && SyncService.canSync && SyncService.canSync()) {
                SyncService.deleteTrip(tripId).catch(err => {
                    console.warn('[Storage] Cloud delete fallback failed:', err.message);
                });
            }

            return deleted;
        } catch (error) {
            console.error('Failed to delete trip:', error);
            return false;
        }
    },

    /**
     * Get settings
     */
    getSettings() {
        try {
            const data = localStorage.getItem(this.KEYS.SETTINGS);
            return data ? JSON.parse(data) : this.getDefaultSettings();
        } catch (error) {
            console.error('Failed to get settings:', error);
            return this.getDefaultSettings();
        }
    },

    /**
     * Save settings
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    },

    /**
     * Get default settings
     */
    getDefaultSettings() {
        return {
            currency: 'INR',
            dateFormat: 'dd/mm/yyyy',
            theme: 'auto'
        };
    },

    /**
     * Export all data as JSON
     */
    exportData() {
        return {
            version: this.SCHEMA_VERSION,
            exportDate: new Date().toISOString(),
            trips: this.getTrips(),
            settings: this.getSettings()
        };
    },

    /**
     * Import data from JSON
     */
    importData(data) {
        try {
            if (data.version && data.trips) {
                this.saveTrips(data.trips);
                if (data.settings) {
                    this.saveSettings(data.settings);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    },

    /**
     * Clear all data (use with caution!)
     */
    clearAll() {
        try {
            localStorage.removeItem(this.KEYS.TRIPS);
            localStorage.removeItem(this.KEYS.SETTINGS);
            return true;
        } catch (error) {
            console.error('Failed to clear data:', error);
            return false;
        }
    },

    /**
     * Get storage usage info
     */
    getStorageInfo() {
        try {
            const trips = localStorage.getItem(this.KEYS.TRIPS) || '';
            const settings = localStorage.getItem(this.KEYS.SETTINGS) || '';
            const totalBytes = trips.length + settings.length;
            const totalKB = (totalBytes / 1024).toFixed(2);

            return {
                trips: this.getTrips().length,
                sizeKB: totalKB,
                sizeBytes: totalBytes
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return { trips: 0, sizeKB: '0', sizeBytes: 0 };
        }
    }
};

// Initialize storage on load
Storage.init();
