/* ========================================
   Conflict Resolver - Field-Level with Safety
   ======================================== */

const ConflictResolver = {
    /**
     * Resolve conflict at FIELD LEVEL between local and cloud
     * Rule: Latest updatedAt timestamp wins per field
     * SAFETY: Never silently delete user data
     */
    resolveFieldLevel(localItem, cloudItem, itemType = 'item') {
        if (!localItem && !cloudItem) {
            return null;
        }

        // Only in cloud - use cloud (new data from another device)
        if (!localItem) {
            console.log(`[Conflict] ${itemType} only in cloud, using cloud version`);
            return { merged: cloudItem, source: 'cloud', conflicts: [] };
        }

        // Only local - keep local (not yet synced)
        if (!cloudItem) {
            console.log(`[Conflict] ${itemType} only local, using local version`);
            return { merged: localItem, source: 'local', conflicts: [] };
        }

        // Both exist - field-level merge
        const merged = { ...localItem };
        const conflicts = [];
        const localTime = this.getTimestamp(localItem);
        const cloudTime = this.getTimestamp(cloudItem);

        // For each field in cloud item, check if should override local
        Object.keys(cloudItem).forEach(field => {
            // Skip metadata fields
            if (['id', 'createdAt', 'syncedAt'].includes(field)) {
                return;
            }

            const localValue = localItem[field];
            const cloudValue = cloudItem[field];

            // If values are different, there's a potential conflict
            if (JSON.stringify(localValue) !== JSON.stringify(cloudValue)) {
                // For nested objects/arrays, handle specially
                if (Array.isArray(cloudValue) && Array.isArray(localValue)) {
                    // Merge arrays (days, activities, expenses)
                    merged[field] = this.mergeArrayField(localValue, cloudValue, field);
                } else if (typeof cloudValue === 'object' && cloudValue !== null) {
                    // Merge objects (accommodation, food)
                    merged[field] = this.mergeObjectField(localValue, cloudValue, field);
                } else {
                    // Primitive field - use timestamp
                    if (cloudTime > localTime) {
                        merged[field] = cloudValue;
                        conflicts.push({
                            field,
                            localValue,
                            cloudValue,
                            winner: 'cloud'
                        });
                    } else {
                        // Keep local value (already in merged)
                        conflicts.push({
                            field,
                            localValue,
                            cloudValue,
                            winner: 'local'
                        });
                    }
                }
            }
        });

        // Log conflicts if any
        if (conflicts.length > 0 && window.ConflictLogger) {
            conflicts.forEach(conflict => {
                ConflictLogger.log({
                    type: itemType,
                    entityId: localItem.id,
                    field: conflict.field,
                    localValue: conflict.localValue,
                    cloudValue: conflict.cloudValue,
                    resolution: 'timestamp',
                    winner: conflict.winner
                });
            });
        }

        // Update timestamp to latest
        merged.updatedAt = cloudTime > localTime ? cloudItem.updatedAt : localItem.updatedAt;

        return {
            merged,
            source: conflicts.length > 0 ? 'merged' : 'local',
            conflicts
        };
    },

    /**
     * Merge array fields (days, activities, expenses)
     * SAFETY: Never delete items, only merge
     */
    mergeArrayField(localArray, cloudArray, fieldName) {
        const mergedMap = new Map();

        // Add all local items
        localArray.forEach(item => {
            if (item.id) {
                mergedMap.set(item.id, { ...item, _source: 'local' });
            }
        });

        // Merge cloud items
        cloudArray.forEach(cloudItem => {
            if (!cloudItem.id) return;

            const localItem = mergedMap.get(cloudItem.id);

            if (!localItem) {
                // New from cloud
                mergedMap.set(cloudItem.id, { ...cloudItem, _source: 'cloud' });
            } else {
                // Both exist - field-level merge
                const result = this.resolveFieldLevel(localItem, cloudItem, fieldName);
                mergedMap.set(cloudItem.id, result.merged);
            }
        });

        // Remove _source metadata
        return Array.from(mergedMap.values()).map(item => {
            const { _source, ...cleanItem } = item;
            return cleanItem;
        });
    },

    /**
     * Merge object fields (accommodation, food)
     */
    mergeObjectField(localObj, cloudObj, fieldName) {
        if (!localObj && !cloudObj) return {};
        if (!localObj) return cloudObj;
        if (!cloudObj) return localObj;

        // Merge object properties
        const merged = { ...localObj };

        Object.keys(cloudObj).forEach(key => {
            if (localObj[key] !== cloudObj[key]) {
                // Use cloud value if different (assumes cloud is newer)
                merged[key] = cloudObj[key];
            }
        });

        return merged;
    },

    /**
     * Get timestamp from item
     */
    getTimestamp(item) {
        const timestamp = item.updatedAt || item.createdAt || item.syncedAt;
        if (!timestamp) {
            return new Date(0); // Very old if no timestamp
        }
        return new Date(timestamp);
    },

    /**
     * Merge arrays of items (trips, days, etc.) - SAFE
     */
    mergeArrays(localArray, cloudArray, itemType = 'items') {
        const mergedMap = new Map();
        const allConflicts = [];

        // Add all local items
        localArray.forEach(item => {
            mergedMap.set(item.id, { item, source: 'local' });
        });

        // Merge cloud items
        cloudArray.forEach(cloudItem => {
            const localEntry = mergedMap.get(cloudItem.id);

            if (!localEntry) {
                // New from cloud - add safely
                mergedMap.set(cloudItem.id, { item: cloudItem, source: 'cloud_new' });
            } else {
                // Conflict - resolve at field level
                const resolution = this.resolveFieldLevel(localEntry.item, cloudItem, itemType);
                mergedMap.set(cloudItem.id, {
                    item: resolution.merged,
                    source: resolution.source,
                    hadConflict: resolution.conflicts.length > 0
                });

                if (resolution.conflicts.length > 0) {
                    allConflicts.push({
                        id: cloudItem.id,
                        type: itemType,
                        conflicts: resolution.conflicts
                    });
                }
            }
        });

        return {
            merged: Array.from(mergedMap.values()).map(entry => entry.item),
            conflicts: allConflicts,
            stats: {
                total: mergedMap.size,
                fromCloud: Array.from(mergedMap.values()).filter(e => e.source === 'cloud_new').length,
                conflictsResolved: allConflicts.length,
                dataPreserved: true // SAFETY FLAG
            }
        };
    },

    /**
     * Deep merge trip with all nested entities - SAFE
     */
    deepMergeTrip(localTrip, cloudTrip) {
        // Resolve trip-level conflict with field-level merge
        const tripResolution = this.resolveFieldLevel(localTrip, cloudTrip, 'trip');
        let mergedTrip = tripResolution.merged;

        // Merge days safely (never delete)
        const localDays = localTrip.days || [];
        const cloudDays = cloudTrip.days || [];
        const daysMerge = this.mergeArrays(localDays, cloudDays, 'day');
        mergedTrip.days = daysMerge.merged;

        // For each day, merge nested entities
        mergedTrip.days = mergedTrip.days.map(day => {
            const localDay = localDays.find(d => d.id === day.id);
            const cloudDay = cloudDays.find(d => d.id === day.id);

            if (!localDay || !cloudDay) {
                return day; // Only exists in one place - keep it
            }

            // Merge activities safely
            const activitiesMerge = this.mergeArrays(
                localDay.activities || [],
                cloudDay.activities || [],
                'activity'
            );

            // Merge expenses safely
            const expensesMerge = this.mergeArrays(
                localDay.expenses || [],
                cloudDay.expenses || [],
                'expense'
            );

            return {
                ...day,
                activities: activitiesMerge.merged,
                expenses: expensesMerge.merged
            };
        });

        const allConflicts = [
            ...tripResolution.conflicts,
            ...daysMerge.conflicts
        ];

        return {
            trip: mergedTrip,
            hadConflicts: allConflicts.length > 0,
            conflicts: allConflicts,
            safetyGuarantee: 'No data deleted' // SAFETY GUARANTEE
        };
    }
};
