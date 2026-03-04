/* ========================================
   Account UI Controller
   ======================================== */

const AccountUI = {
    /**
     * Initialize account UI
     */
    init() {
        const accountButton = document.getElementById('accountButton');
        const dropdown = document.getElementById('accountDropdown');

        if (accountButton) {
            accountButton.onclick = (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            };
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.classList.contains('hidden')) {
                this.closeDropdown();
            }
        });

        // Update UI initially
        this.updateUI();

        console.log('[AccountUI] Initialized');
    },

    /**
     * Toggle dropdown
     */
    toggleDropdown() {
        const dropdown = document.getElementById('accountDropdown');
        const button = document.getElementById('accountButton');

        if (dropdown.classList.contains('hidden')) {
            this.openDropdown();
        } else {
            this.closeDropdown();
        }
    },

    /**
     * Open dropdown
     */
    openDropdown() {
        const dropdown = document.getElementById('accountDropdown');
        const button = document.getElementById('accountButton');

        dropdown.classList.remove('hidden');
        button.classList.add('active');
        this.renderDropdownContent();
    },

    /**
     * Close dropdown
     */
    closeDropdown() {
        const dropdown = document.getElementById('accountDropdown');
        const button = document.getElementById('accountButton');

        dropdown.classList.add('hidden');
        button.classList.remove('active');
    },

    /**
     * Render dropdown content
     */
    renderDropdownContent() {
        const content = document.getElementById('accountDropdownContent');
        const user = (typeof AuthService !== 'undefined') ? AuthService.getCurrentUser() : null;
        const syncStatus = (typeof BackgroundSync !== 'undefined') ? BackgroundSync.getSyncStatus() : null;

        if (user) {
            // Logged in
            content.innerHTML = `
                <div class="account-dropdown-header">
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${user.displayName || 'User'}</div>
                    <div class="account-email">${user.email}</div>
                </div>
                
                <div class="account-dropdown-section">
                    <div class="account-dropdown-title">Sync Status</div>
                    ${this.renderSyncStatusDetails(syncStatus)}
                    <div style="margin-top: 0.5rem; font-size: 0.7rem; color: var(--color-text-tertiary); font-family: monospace; background: rgba(0,0,0,0.05); padding: 0.25rem; border-radius: 4px;">
                        UID: ${user.uid.substring(0, 8)}...<br>
                        DB: ${window.firebase ? 'Ready' : 'Not Loaded'}
                    </div>
                </div>
                
                <div class="account-dropdown-section">
                    <div class="account-actions">
                        ${!syncStatus.canSync ? `
                            <button class="btn btn-primary" onclick="AuthService.showSyncConfirmation(AuthService.getCurrentUser(), Storage.getTrips().length)" style="width: 100%; margin-bottom: 0.5rem;">
                                ☁️ Enable Cloud Sync
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="AccountUI.handleViewConflicts()" style="width: 100%;">
                            View Sync Logs
                        </button>
                        <button class="btn btn-secondary" onclick="AccountUI.handleSignOut()" style="width: 100%;">
                            Sign Out
                        </button>
                        <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.5rem;">
                    App Version: v105 (Travel Cloud Sync)
                </div>        </div>
                        <div style="font-size: 0.75rem; color: #666; margin-top: 4px; font-family: monospace;">
                            UID: ${AuthService.currentUser.uid}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Not logged in
            content.innerHTML = `
                <div class="account-dropdown-section">
                    <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); margin-bottom: var(--spacing-md);">
                        Sign in to sync your trips across devices
                    </p>
                    <button class="btn btn-primary" onclick="AccountUI.handleSignIn()" style="width: 100%;">
                        Sign In
                    </button>
                </div>
                
                <div class="account-dropdown-section">
                    <div class="account-dropdown-title">Current Status</div>
                    <div class="sync-status-item active">
                        <div class="sync-status-icon">📴</div>
                        <div class="sync-status-label">Local only</div>
                        <div class="sync-status-value">Not syncing</div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Render sync status details
     */
    renderSyncStatusDetails(syncStatus) {
        if (!syncStatus) {
            return '<p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">Sync unavailable</p>';
        }

        const queueSize = syncStatus.queueSize || 0;
        const isSyncing = syncStatus.isSyncing;
        const canSync = syncStatus.canSync;
        const lastSync = syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleString() : 'Never';

        let statusIcon = '📴';
        let statusLabel = 'Local only';
        let statusValue = 'Not syncing';

        if (isSyncing) {
            statusIcon = '⏳';
            statusLabel = 'Syncing...';
            statusValue = 'In progress';
        } else if (queueSize > 0) {
            statusIcon = '⚠️';
            statusLabel = 'Pending sync';
            statusValue = `${queueSize} item${queueSize > 1 ? 's' : ''}`;
        } else if (canSync) {
            statusIcon = '☁️';
            statusLabel = 'Synced';
            statusValue = 'Up to date';
        } else if (!navigator.onLine) {
            statusIcon = '📴';
            statusLabel = 'Offline';
            statusValue = 'No connection';
        }

        return `
            <div class="sync-status-item ${isSyncing || (canSync && queueSize === 0) ? 'active' : ''}">
                <div class="sync-status-icon">${statusIcon}</div>
                <div class="sync-status-label">${statusLabel}</div>
                <div class="sync-status-value">${statusValue}</div>
            </div>
            ${canSync && !isSyncing ? `
                <div style="margin-top: var(--spacing-sm); padding: 0.5rem; background: var(--color-bg-secondary); border-radius: var(--radius-md);">
                    <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                        Last synced: ${lastSync}
                    </div>
                </div>
            ` : ''}
        `;
    },

    /**
     * Handle sign in
     */
    handleSignIn() {
        this.closeDropdown();
        if (typeof AuthUI !== 'undefined') {
            AuthUI.showSignInModal();
        }
    },

    /**
     * Handle force sync with persistent progress bar (lives outside dropdown)
     */
    async handleForceSync() {
        if (BackgroundSync.isSyncing) {
            if (window.UIComponents) UIComponents.showToast('Sync already in progress…', 'info', 2000);
            return;
        }

        const bar = document.getElementById('syncProgressBar');
        const fill = document.getElementById('syncProgressFill');
        const msg = document.getElementById('syncStatusMsg');
        const syncBtn = document.getElementById('headerSyncBtn');

        // Show bar + start fake progress
        if (bar) { bar.style.display = 'block'; }
        if (fill) { fill.style.width = '0%'; }
        if (msg) { msg.style.display = 'block'; msg.textContent = '🔄 Syncing with cloud…'; }
        if (syncBtn) { syncBtn.disabled = true; syncBtn.style.opacity = '0.5'; }

        // Animate to 80% while waiting
        let fakeProgress = 0;
        const fakeTimer = setInterval(() => {
            fakeProgress = Math.min(fakeProgress + (Math.random() * 8 + 3), 80);
            if (fill) fill.style.width = fakeProgress + '%';
        }, 400);

        try {
            await BackgroundSync.syncOnLaunch();

            clearInterval(fakeTimer);
            if (fill) fill.style.width = '100%';
            if (msg) { msg.textContent = '✅ Sync complete!'; msg.style.color = '#4caf50'; }

            setTimeout(() => {
                if (bar) bar.style.display = 'none';
                if (fill) { fill.style.width = '0%'; }
                if (msg) { msg.style.display = 'none'; msg.style.color = '#f5a623'; }
            }, 2000);

        } catch (err) {
            clearInterval(fakeTimer);
            if (fill) fill.style.width = '100%';
            if (msg) { msg.textContent = '❌ Sync failed — tap 🔄 to retry'; msg.style.color = '#e53935'; }
            setTimeout(() => {
                if (bar) bar.style.display = 'none';
                if (fill) { fill.style.width = '0%'; }
                if (msg) { msg.style.display = 'none'; msg.style.color = '#f5a623'; }
            }, 3500);
        } finally {
            if (syncBtn) { syncBtn.disabled = false; syncBtn.style.opacity = '1'; }
        }
    },

    /**
     * Handle sign out
     */
    async handleSignOut() {
        if (confirm('Are you sure you want to sign out? Your local data will be preserved.')) {
            this.closeDropdown();
            if (typeof AuthUI !== 'undefined') {
                await AuthUI.signOut();
            }
        }
    },

    /**
     * Handle view conflicts
     */
    handleViewConflicts() {
        this.closeDropdown();
        if (typeof ConflictLogger !== 'undefined') {
            const logs = ConflictLogger.getRecentLogs(10);
            if (logs.length === 0) {
                if (typeof UIComponents !== 'undefined') {
                    UIComponents.showToast('No sync conflicts logged', 'info');
                } else {
                    alert('No sync conflicts logged');
                }
            } else {
                // Show in modal
                const content = `
                    <h3 style="margin-bottom: 1rem;">Recent Sync Conflicts</h3>
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${logs.map(log => `
                            <div style="padding: 0.75rem; background: var(--color-bg-secondary); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
                                <div style="font-size: var(--font-size-sm); font-weight: 600; margin-bottom: 0.25rem;">
                                    ${log.type} - ${log.field}
                                </div>
                                <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                                    ${new Date(log.timestamp).toLocaleString()}
                                </div>
                                <div style="margin-top: 0.5rem; font-size: var(--font-size-xs);">
                                    Winner: <strong>${log.winner}</strong>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-secondary" onclick="ConflictLogger.exportLogs(); UIComponents.closeModal();" style="width: 100%;">
                            Export All Logs
                        </button>
                    </div>
                `;

                if (typeof UIComponents !== 'undefined') {
                    UIComponents.showModal(content);
                }
            }
        }
    },

    /**
     * Update UI based on auth state
     */
    updateUI() {
        // This method is kept for compatibility with AuthUI
        // The actual rendering happens when dropdown opens
    },

    /**
     * Update sync status display in header
     */
    updateSyncStatus(status, text) {
        const syncStatus = document.getElementById('syncStatus');
        const syncStatusText = document.getElementById('syncStatusText');

        if (!syncStatus) return;

        let icon = '📴';
        let label = 'Local only';

        switch (status) {
            case 'syncing':
                icon = '⏳';
                label = 'Syncing...';
                syncStatus.classList.add('syncing');
                break;
            case 'synced':
                icon = '☁️';
                label = 'Synced';
                syncStatus.classList.remove('syncing');
                break;
            case 'error':
            case 'pending':
                icon = '⚠️';
                label = text || 'Pending';
                syncStatus.classList.remove('syncing');
                break;
            case 'offline':
                icon = '📴';
                label = 'Offline';
                syncStatus.classList.remove('syncing');
                break;
            default:
                icon = '📴';
                label = 'Local only';
                syncStatus.classList.remove('syncing');
        }

        syncStatus.innerHTML = icon;
        if (syncStatusText) {
            syncStatusText.textContent = label;
        }

        // Update tooltip
        syncStatus.title = label;
    }
};

// Initialize on document ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AccountUI.init();
    });
} else {
    AccountUI.init();
}
