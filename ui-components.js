/* ========================================
   UI Components - Reusable Elements
   ======================================== */

const UIComponents = {

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <span style="font-size: 1.25rem;">${icon}</span>
            <span style="flex: 1;">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 250ms ease-out forwards';
            setTimeout(() => toast.remove(), 250);
        }, duration);
    },

    getToastIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
            warning: '⚠'
        };
        return icons[type] || icons.info;
    },

    /**
     * Show modal dialog
     */
    showModal(content, onClose) {
        const overlay = document.getElementById('modalOverlay');
        const modalContent = document.getElementById('modalContent');

        modalContent.innerHTML = content;
        overlay.classList.remove('hidden');

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.closeModal();
                if (onClose) onClose();
            }
        };
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        overlay.classList.add('hidden');
    },

    /**
     * Show confirmation dialog
     */
    showConfirm(title, message, onConfirm, onCancel) {
        const content = `
            <h3 style="margin-bottom: 1rem;">${title}</h3>
            <p style="color: var(--color-text-secondary); margin-bottom: 1.5rem;">${message}</p>
            <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button id="cancelBtn" class="btn btn-secondary">Cancel</button>
                <button id="confirmBtn" class="btn btn-primary">Confirm</button>
            </div>
        `;

        this.showModal(content);

        document.getElementById('cancelBtn').onclick = () => {
            this.closeModal();
            if (onCancel) onCancel();
        };

        document.getElementById('confirmBtn').onclick = () => {
            this.closeModal();
            if (onConfirm) onConfirm();
        };
    },

    /**
     * Show/hide loading indicator
     */
    showLoading() {
        document.getElementById('loadingIndicator').classList.remove('hidden');
    },

    hideLoading() {
        document.getElementById('loadingIndicator').classList.add('hidden');
    },

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    },

    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'INR') {
        if (amount === null || amount === undefined || amount === '') return '-';
        const num = parseFloat(amount);
        if (isNaN(num)) return '-';

        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    },

    /**
     * Calculate days between dates
     */
    calculateDays(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1; // Include both start and end days
    },

    /**
     * Create trip card
     */
    createTripCard(trip) {
        const days = this.calculateDays(trip.startDate, trip.endDate);
        const totalExpected = this.calculateTotalExpected(trip);
        const totalActual = this.calculateTotalActual(trip);

        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => window.app.showTripDetail(trip.id);

        const gradients = [
            'var(--gradient-sunset)',
            'var(--gradient-ocean)',
            'var(--gradient-forest)',
            'var(--gradient-sky)'
        ];
        const gradient = gradients[Math.floor(Math.random() * gradients.length)];

        card.innerHTML = `
            <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0 0 0.25rem 0; font-size: 1.25rem;">${trip.tripName || trip.name}</h3>
                    <p style="margin: 0; color: var(--color-text-secondary); font-size: 0.875rem;">
                        📍 ${trip.destination}
                    </p>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button 
                        class="delete-trip-btn" 
                        data-trip-id="${trip.id}"
                        style="padding: 0.5rem; background: none; border: none; cursor: pointer; color: var(--color-error); opacity: 0.7;  transition: opacity 0.2s;"
                        onmouseover="this.style.opacity='1'" 
                        onmouseout="this.style.opacity='0.7'"
                        title="Delete trip"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                    <div style="width: 48px; height: 48px; background: ${gradient}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                        ${this.getTripIcon(trip.transportMode)}
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem; padding: 0.75rem; background: var(--color-bg-secondary); border-radius: 8px;">
                <div style="flex: 1;">
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">DATES</div>
                    <div style="font-size: 0.875rem; font-weight: 600;">
                        ${this.formatDate(trip.startDate)} - ${this.formatDate(trip.endDate)}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary);">${days} day${days > 1 ? 's' : ''}</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div>
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">EXPECTED</div>
                    <div style="font-size: 1rem; font-weight: 600; color: var(--color-primary);">
                        ${this.formatCurrency(totalExpected)}
                    </div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">ACTUAL</div>
                    <div style="font-size: 1rem; font-weight: 600; color: var(--color-secondary);">
                        ${totalActual > 0 ? this.formatCurrency(totalActual) : '-'}
                    </div>
                </div>
            </div>
        `;

        return card;
    },

    getTripIcon(transportMode) {
        const icons = {
            flight: '✈️',
            train: '🚂',
            bus: '🚌',
            car: '🚗',
            mixed: '🚊'
        };
        return icons[transportMode] || '🗺️';
    },

    calculateTotalExpected(trip) {
        // If trip has expectedTotalBudget set, use that as the "planned" budget
        if (trip.expectedTotalBudget && trip.expectedTotalBudget > 0) {
            return trip.expectedTotalBudget;
        }

        // Calculate from day.expenses[] — the UNIFIED source of truth.
        // reconcileDayExpenses() auto-generates expense entries from activities,
        // accommodation, meals, travel, and fuel into day.expenses[].
        // Do NOT also sum those sources directly or you'll double-count.
        let total = 0;

        if (trip.days && Array.isArray(trip.days)) {
            trip.days.forEach(day => {
                if (day.expenses) {
                    day.expenses.forEach(expense => {
                        total += parseFloat(expense.expectedAmount || 0);
                    });
                }
            });
        }

        return total;
    },

    calculateTotalActual(trip) {
        // Sum from day.expenses[] — the UNIFIED source of truth.
        let total = 0;

        if (trip.days && Array.isArray(trip.days)) {
            trip.days.forEach(day => {
                if (day.expenses) {
                    day.expenses.forEach(expense => {
                        total += parseFloat(expense.actualAmount || 0);
                    });
                }
            });
        }

        return total;
    },

    /**
     * Create empty state
     */
    createEmptyState(icon, title, message) {
        return `
            <div style="text-align: center; padding: 3rem 1rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">${icon}</div>
                <h3 style="margin-bottom: 0.5rem; color: var(--color-text);">${title}</h3>
                <p style="color: var(--color-text-secondary);">${message}</p>
            </div>
        `;
    }
};

// Add CSS for slideOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
