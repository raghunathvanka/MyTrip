/* ========================================
   Authentication Service - Firebase Auth
   ======================================== */

const AuthService = {
    currentUser: null,
    authStateListeners: [],

    /**
     * Initialize Firebase Auth
     */
    init(firebaseApp) {
        if (!window.firebase || !window.firebase.auth) {
            console.error('Firebase Auth not loaded');
            return false;
        }

        this.auth = firebase.auth();

        // Listen for auth state changes
        this.auth.onAuthStateChanged((user) => {
            const wasSignedIn = this.currentUser !== null;
            this.currentUser = user;
            this.notifyAuthStateChange(user);

            if (user) {
                console.log('[Auth] User signed in:', user.email || user.uid);

                // Ensure user profile exists for collaboration
                if (window.SyncServiceEnhanced) {
                    SyncServiceEnhanced.ensureUserProfile(user);
                }

                // Check for first-time login with local trips
                if (!wasSignedIn) {
                    this.handleFirstLogin(user);
                }
            } else {
                console.log('[Auth] User signed out');
            }
        });

        return true;
    },

    /**
     * Get current user's UID
     */
    getUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    },

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await this.auth.signInWithPopup(provider);
            return {
                success: true,
                user: result.user
            };
        } catch (error) {
            console.error('[Auth] Google sign-in failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Sign in with Email & Password
     */
    async signInWithEmail(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            return {
                success: true,
                user: result.user
            };
        } catch (error) {
            console.error('[Auth] Email sign-in failed:', error);
            return {
                success: false,
                error: this.getFriendlyErrorMessage(error.code)
            };
        }
    },

    /**
     * Sign up with Email & Password
     */
    async signUpWithEmail(email, password) {
        try {
            const result = await this.auth.createUserWithEmailAndPassword(email, password);
            return {
                success: true,
                user: result.user
            };
        } catch (error) {
            console.error('[Auth] Email sign-up failed:', error);
            return {
                success: false,
                error: this.getFriendlyErrorMessage(error.code)
            };
        }
    },

    /**
     * Sign out
     */
    async signOut() {
        try {
            // Stop real-time Firestore listeners before signing out
            if (window.BackgroundSync) BackgroundSync.stopRealtimeListeners();
            await this.auth.signOut();
            return { success: true };
        } catch (error) {
            console.error('[Auth] Sign-out failed:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * Check if user is signed in
     */
    isSignedIn() {
        return this.currentUser !== null;
    },

    /**
     * Get user ID
     */
    getUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    },

    /**
     * Get user email
     */
    getUserEmail() {
        return this.currentUser ? this.currentUser.email : null;
    },

    /**
     * Listen for auth state changes
     */
    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);
    },

    /**
     * Notify all listeners of auth state change
     */
    notifyAuthStateChange(user) {
        this.authStateListeners.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('[Auth] Listener error:', error);
            }
        });
    },

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email) {
        try {
            await this.auth.sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            console.error('[Auth] Password reset failed:', error);
            return {
                success: false,
                error: this.getFriendlyErrorMessage(error.code)
            };
        }
    },

    /**
     * Get friendly error message
     */
    getFriendlyErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/email-already-in-use': 'Email already registered',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/invalid-email': 'Invalid email address',
            'auth/popup-closed-by-user': 'Sign-in cancelled',
            'auth/network-request-failed': 'Network error. Please check your connection'
        };

        return errorMessages[errorCode] || 'Authentication error. Please try again';
    },

    /**
     * Check if user is authenticated (alias)
     */
    isAuthenticated() {
        return this.isSignedIn();
    },

    /**
     * Handle first login - check for local trips and ask about syncing
     */
    async handleFirstLogin(user) {
        // Check if we've already asked this user
        const askedKey = `mytrip_sync_asked_${user.uid}`;
        const alreadyAsked = localStorage.getItem(askedKey);

        if (alreadyAsked) {
            console.log('[Auth] User already answered sync question');
            return;
        }

        // Check if there are local trips
        const localTrips = window.Storage ? Storage.getTrips() : [];

        if (localTrips.length === 0) {
            console.log('[Auth] No local trips to sync');
            // Mark as asked so we don't show again
            localStorage.setItem(askedKey, 'true');
            return;
        }

        // Show confirmation dialog
        setTimeout(() => {
            this.showSyncConfirmation(user, localTrips.length);
        }, 1000); // Small delay to let UI settle
    },

    /**
     * Show sync confirmation dialog
     */
    showSyncConfirmation(user, tripCount) {
        const content = `
            <div style="text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">☁️</div>
                <h3 style="margin-bottom: 1rem;">Sync Your Trips to Cloud?</h3>
                <p style="color: var(--color-text-secondary); margin-bottom: 1.5rem;">
                    You have <strong>${tripCount} trip${tripCount > 1 ? 's' : ''}</strong> stored locally. 
                    Would you like to sync ${tripCount > 1 ? 'them' : 'it'} to the cloud?
                </p>
                <div style="background: var(--color-bg-secondary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; text-align: left;">
                    <div style="font-size: var(--font-size-sm); margin-bottom: 0.5rem;">
                        <strong>✅ Recommended: Yes</strong>
                    </div>
                    <ul style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: 0; padding-left: 1.5rem;">
                        <li>Access trips from any device</li>
                        <li>Automatic backup</li>
                        <li>Never lose your data</li>
                    </ul>
                </div>
                <div style="display: flex; gap: 0.75rem;">
                    <button id="syncNo" class="btn btn-secondary" style="flex: 1;">
                        No, Keep Local Only
                    </button>
                    <button id="syncYes" class="btn btn-primary" style="flex: 2;">
                        Yes, Sync to Cloud
                    </button>
                </div>
            </div>
        `;

        if (window.UIComponents) {
            UIComponents.showModal(content);

            // Set up button handlers
            document.getElementById('syncYes').onclick = () => {
                this.handleSyncConfirmation(user, true);
                UIComponents.closeModal();
            };

            document.getElementById('syncNo').onclick = () => {
                this.handleSyncConfirmation(user, false);
                UIComponents.closeModal();
            };
        }
    },

    /**
     * Handle sync confirmation response
     */
    async handleSyncConfirmation(user, shouldSync) {
        const askedKey = `mytrip_sync_asked_${user.uid}`;
        localStorage.setItem(askedKey, 'true');

        if (shouldSync) {
            console.log('[Auth] User chose to sync local trips');

            if (window.UIComponents) {
                UIComponents.showToast('Syncing your trips...', 'info', 2000);
            }

            // Sync all local trips
            const localTrips = window.Storage ? Storage.getTrips() : [];

            for (const trip of localTrips) {
                if (window.SyncServiceEnhanced) {
                    await SyncServiceEnhanced.syncTripWithRelations(trip);
                }
            }

            if (window.UIComponents) {
                UIComponents.showToast(`${localTrips.length} trip${localTrips.length > 1 ? 's' : ''} synced to cloud!`, 'success', 3000);
            }

            // Trigger background sync to merge with any existing cloud data
            if (window.BackgroundSync) {
                setTimeout(() => {
                    BackgroundSync.syncOnLaunch();
                }, 500);
            }
        } else {
            console.log('[Auth] User chose to keep trips local only');

            if (window.UIComponents) {
                UIComponents.showToast('Trips remain local. You can sync anytime from settings.', 'info', 3000);
            }
        }
    }
};
