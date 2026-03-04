/* ========================================
   UUID Generator Utility
   ======================================== */

const UUIDGenerator = {
    /**
     * Generate RFC4122 v4 compliant UUID
     */
    generate() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Validate UUID format
     */
    isValid(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    },

    /**
     * Generate UUID for specific entity type (with prefix for debugging)
     * @param {string} type - Entity type (trip, day, activity, etc.)
     */
    generateForEntity(type) {
        // For backward compatibility tracking, we can optionally prefix
        // But pure UUID is better for database normalization
        return this.generate();
    }
};
