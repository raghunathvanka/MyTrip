/**
 * Unified Expense Data Model
 * Standardizes expense structure across the application
 */
class Expense {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || '';
        this.category = data.category || 'Other';
        this.expectedAmount = parseFloat(data.expectedAmount) || 0;
        this.actualAmount = parseFloat(data.actualAmount) || 0;
        this.splitCount = parseInt(data.splitCount) || 1;
        this.linkedDayId = data.linkedDayId || null;
        this.source = data.source || 'manual'; // manual, imported, auto-fuel

        // Validation
        if (this.splitCount < 1) this.splitCount = 1;
    }

    /**
     * Calculate per person amount based on actual amount
     * @returns {number} Amount per person
     */
    get perPersonAmount() {
        if (this.actualAmount > 0 && this.splitCount > 0) {
            return parseFloat((this.actualAmount / this.splitCount).toFixed(2));
        }
        return 0;
    }

    /**
     * Generate unique ID
     * @returns {string} UUID
     */
    generateId() {
        return 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Convert to simple object for storage
     * @returns {Object} Plain object
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            category: this.category,
            expectedAmount: this.expectedAmount,
            actualAmount: this.actualAmount,
            splitCount: this.splitCount,
            linkedDayId: this.linkedDayId,
            source: this.source,
            variance: this.variance, // Include derived variance calculation
            perPersonAmount: this.perPersonAmount // Included for easy reading, though calculated
        };
    }
}

// Export if using modules, otherwise attach to window
if (typeof window !== 'undefined') {
    window.Expense = Expense;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = Expense;
}
