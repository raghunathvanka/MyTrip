/* ========================================
   Sync Queue Manager - Offline Operations
   ======================================== */

const SyncQueue = {
    QUEUE_KEY: 'mytrip_sync_queue',
    MAX_RETRIES: 5,

    /**
     * Initialize queue
     */
    init() {
        console.log('[SyncQueue] Initialized');

        // Listen for online event
        window.addEventListener('online', () => {
            console.log('[SyncQueue] Network reconnected, processing queue');
            this.processQueue();
        });
    },

    /**
     * Get queue from storage
     */
    getQueue() {
        try {
            const data = localStorage.getItem(this.QUEUE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('[SyncQueue] Failed to get queue:', error);
            return [];
        }
    },

    /**
     * Save queue to storage
     */
    saveQueue(queue) {
        try {
            localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
            return true;
        } catch (error) {
            console.error('[SyncQueue] Failed to save queue:', error);
            return false;
        }
    },

    /**
     * Enqueue sync operation
     */
    enqueue(operation) {
        const queue = this.getQueue();

        const queueItem = {
            id: UUIDGenerator ? UUIDGenerator.generate() : Date.now().toString(),
            type: operation.type,
            data: operation.data,
            timestamp: new Date().toISOString(),
            retries: 0
        };

        queue.push(queueItem);
        this.saveQueue(queue);

        console.log(`[SyncQueue] Enqueued: ${operation.type}`, queueItem);

        // Try to process immediately if online
        if (navigator.onLine) {
            setTimeout(() => this.processQueue(), 100);
        }

        return queueItem.id;
    },

    /**
     * Dequeue item by ID
     */
    dequeue(itemId) {
        const queue = this.getQueue();
        const filtered = queue.filter(item => item.id !== itemId);
        this.saveQueue(filtered);
        console.log(`[SyncQueue] Dequeued: ${itemId}`);
    },

    /**
     * Process queue
     */
    async processQueue() {
        if (!navigator.onLine) {
            console.log('[SyncQueue] Offline, skipping queue processing');
            return;
        }

        if (!window.SyncServiceEnhanced || !SyncServiceEnhanced.canSync()) {
            console.log('[SyncQueue] Not authenticated, skipping queue processing');
            return;
        }

        const queue = this.getQueue();
        if (queue.length === 0) {
            console.log('[SyncQueue] Queue empty');
            return;
        }

        console.log(`[SyncQueue] Processing ${queue.length} items`);

        const results = {
            success: 0,
            failed: 0,
            total: queue.length
        };

        // Process items sequentially
        for (const item of queue) {
            try {
                const success = await this.processItem(item);
                if (success) {
                    this.dequeue(item.id);
                    results.success++;
                } else {
                    results.failed++;
                    // Increment retry count
                    item.retries++;
                    if (item.retries >= this.MAX_RETRIES) {
                        console.error(`[SyncQueue] Max retries reached for ${item.id}`);
                        this.dequeue(item.id); // Remove from queue
                    }
                }
            } catch (error) {
                console.error(`[SyncQueue] Error processing ${item.id}:`, error);
                results.failed++;
                item.retries++;
            }
        }

        // Update queue with retry counts
        this.saveQueue(queue);

        console.log(`[SyncQueue] Processed: ${results.success} success, ${results.failed} failed`);

        // Show toast if all synced
        if (results.success > 0 && results.failed === 0 && window.UIComponents) {
            UIComponents.showToast(`Synced ${results.success} pending changes`, 'success', 2000);
        }
    },

    /**
     * Process individual queue item
     */
    async processItem(item) {
        console.log(`[SyncQueue] Processing: ${item.type}`, item.id);

        try {
            switch (item.type) {
                case 'SYNC_TRIP':
                    const result = await SyncServiceEnhanced.syncTripWithRelations(item.data);
                    return result.success;

                case 'DELETE_TRIP':
                    const deleteResult = await SyncServiceEnhanced.deleteTrip(item.data.tripId);
                    return deleteResult.success;

                case 'SYNC_DAY':
                    const dayResult = await SyncServiceEnhanced.syncDayWithRelations(
                        item.data.day,
                        item.data.tripId
                    );
                    return dayResult.success;

                case 'SYNC_ACTIVITY':
                    const activityResult = await SyncServiceEnhanced.syncActivity(
                        item.data.activity,
                        item.data.tripId,
                        item.data.dayId
                    );
                    return activityResult.success;

                case 'SYNC_EXPENSE':
                    const expenseResult = await SyncServiceEnhanced.syncExpense(
                        item.data.expense,
                        item.data.tripId,
                        item.data.dayId
                    );
                    return expenseResult.success;

                default:
                    console.warn(`[SyncQueue] Unknown operation type: ${item.type}`);
                    return false;
            }
        } catch (error) {
            console.error(`[SyncQueue] Failed to process ${item.type}:`, error);
            return false;
        }
    },

    /**
     * Clear queue
     */
    clearQueue() {
        this.saveQueue([]);
        console.log('[SyncQueue] Queue cleared');
    },

    /**
     * Get queue size
     */
    getQueueSize() {
        return this.getQueue().length;
    },

    /**
     * Check if queue has items
     */
    hasItems() {
        return this.getQueueSize() > 0;
    }
};
