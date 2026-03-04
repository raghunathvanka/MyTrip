/* ========================================
   Conflict Logger - Internal Debugging
   ======================================== */

const ConflictLogger = {
    LOG_KEY: 'mytrip_conflict_log',
    MAX_LOGS: 100,

    /**
     * Log a conflict for debugging
     */
    log(conflict) {
        try {
            const logs = this.getLogs();

            const logEntry = {
                id: UUIDGenerator ? UUIDGenerator.generate() : Date.now().toString(),
                timestamp: new Date().toISOString(),
                type: conflict.type,
                entityId: conflict.entityId,
                field: conflict.field,
                localValue: conflict.localValue,
                cloudValue: conflict.cloudValue,
                resolution: conflict.resolution,
                winner: conflict.winner
            };

            logs.unshift(logEntry); // Add to beginning

            // Keep only last MAX_LOGS
            if (logs.length > this.MAX_LOGS) {
                logs.splice(this.MAX_LOGS);
            }

            localStorage.setItem(this.LOG_KEY, JSON.stringify(logs));
            console.log('[ConflictLogger] Logged conflict:', logEntry);
        } catch (error) {
            console.error('[ConflictLogger] Failed to log conflict:', error);
        }
    },

    /**
     * Get all conflict logs
     */
    getLogs() {
        try {
            const data = localStorage.getItem(this.LOG_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('[ConflictLogger] Failed to get logs:', error);
            return [];
        }
    },

    /**
     * Get logs for specific entity
     */
    getLogsForEntity(entityId) {
        return this.getLogs().filter(log => log.entityId === entityId);
    },

    /**
     * Get recent logs (last N)
     */
    getRecentLogs(count = 10) {
        return this.getLogs().slice(0, count);
    },

    /**
     * Clear logs
     */
    clearLogs() {
        localStorage.removeItem(this.LOG_KEY);
        console.log('[ConflictLogger] Logs cleared');
    },

    /**
     * Export logs for debugging
     */
    exportLogs() {
        const logs = this.getLogs();
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `conflict-logs-${new Date().toISOString()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }
};
