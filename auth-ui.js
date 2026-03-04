/* ========================================
   Auth UI Components
   ======================================== */

const AuthUI = {
    /**
     * Show sign-in modal
     */
    showSignInModal() {
        const modal = `
            <div class="auth-modal-content">
                <h2>Sign In to Sync Your Data</h2>
                <p class="auth-subtitle">Access your trips from any device</p>
                
                <button class="btn btn-google" onclick="AuthUI.signInWithGoogle()">
                    <svg width="18" height="18" viewBox="0 0 18 18">
                        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                        <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.336z"/>
                        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                    </svg>
                    Continue with Google
                </button>
                
                <div class="auth-divider">
                    <span>or</span>
                </div>
                
                <form id="emailSignInForm" onsubmit="AuthUI.handleEmailSignIn(event)">
                    <input type="email" id="signInEmail" placeholder="Email" required class="form-input">
                    <input type="password" id="signInPassword" placeholder="Password" required class="form-input">
                    <button type="submit" class="btn btn-primary" style="width: 100%">
                        Sign In with Email
                    </button>
                </form>
                
                <p class="auth-footer">
                    Don't have an account? 
                    <a href="#" onclick="AuthUI.showSignUpModal(); return false;">Sign Up</a>
                </p>
                
                <p class="auth-footer">
                    <a href="#" onclick="UIComponents.closeModal(); return false;">Continue without signing in</a>
                </p>
            </div>
        `;

        UIComponents.showModal(modal);
    },

    /**
     * Show sign-up modal
     */
    showSignUpModal() {
        const modal = `
            <div class="auth-modal-content">
                <h2>Create Account</h2>
                <p class="auth-subtitle">Sync your trips across all devices</p>
                
                <button class="btn btn-google" onclick="AuthUI.signInWithGoogle()">
                    <svg width="18" height="18" viewBox="0 0 18 18">
                        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                        <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.336z"/>
                        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                    </svg>
                    Sign Up with Google
                </button>
                
                <div class="auth-divider">
                    <span>or</span>
                </div>
                
                <form id="emailSignUpForm" onsubmit="AuthUI.handleEmailSignUp(event)">
                    <input type="email" id="signUpEmail" placeholder="Email" required class="form-input">
                    <input type="password" id="signUpPassword" placeholder="Password (min 6 characters)" required minlength="6" class="form-input">
                    <button type="submit" class="btn btn-primary" style="width: 100%">
                        Create Account
                    </button>
                </form>
                
                <p class="auth-footer">
                    Already have an account? 
                    <a href="#" onclick="AuthUI.showSignInModal(); return false;">Sign In</a>
                </p>
            </div>
        `;

        UIComponents.showModal(modal);
    },

    /**
     * Handle Google sign-in
     */
    async signInWithGoogle() {
        const result = await AuthService.signInWithGoogle();
        if (result.success) {
            UIComponents.closeModal();
            UIComponents.showToast('Signed in successfully!', 'success');
            this.updateAuthUI();
            // Trigger sync
            SyncService.syncAll();
        } else {
            UIComponents.showToast(result.error, 'error');
        }
    },

    /**
     * Handle email sign-in
     */
    async handleEmailSignIn(event) {
        event.preventDefault();
        const email = document.getElementById('signInEmail').value;
        const password = document.getElementById('signInPassword').value;

        const result = await AuthService.signInWithEmail(email, password);
        if (result.success) {
            UIComponents.closeModal();
            UIComponents.showToast('Signed in successfully!', 'success');
            this.updateAuthUI();
            // Trigger sync
            SyncService.syncAll();
        } else {
            UIComponents.showToast(result.error, 'error');
        }
    },

    /**
     * Handle email sign-up
     */
    async handleEmailSignUp(event) {
        event.preventDefault();
        const email = document.getElementById('signUpEmail').value;
        const password = document.getElementById('signUpPassword').value;

        const result = await AuthService.signUpWithEmail(email, password);
        if (result.success) {
            UIComponents.closeModal();
            UIComponents.showToast('Account created successfully!', 'success');
            this.updateAuthUI();
            // Trigger sync
            SyncService.syncAll();
        } else {
            UIComponents.showToast(result.error, 'error');
        }
    },

    /**
     * Handle sign-out
     */
    async signOut() {
        const result = await AuthService.signOut();
        if (result.success) {
            UIComponents.showToast('Signed out successfully', 'success');
            this.updateAuthUI();
        }
    },

    /**
     * Update auth UI based on state
     */
    updateAuthUI() {
        const user = AuthService.getCurrentUser();
        const authButton = document.getElementById('authButton');
        const syncStatus = document.getElementById('syncStatus');

        if (user) {
            // User is signed in
            if (authButton) {
                authButton.innerHTML = `
                    <div class="user-menu">
                        <span class="user-email">${user.email || 'User'}</span>
                        <button class="btn btn-secondary btn-sm" onclick="AuthUI.signOut()">Sign Out</button>
                    </div>
                `;
            }

            if (syncStatus) {
                syncStatus.classList.add('synced');
                syncStatus.innerHTML = '☁️';
                syncStatus.title = 'Synced';
            }
        } else {
            // User is  signed out
            if (authButton) {
                authButton.innerHTML = `
                    <button class="btn btn-secondary btn-sm" onclick="AuthUI.showSignInModal()">
                        Sign In
                    </button>
                `;
            }

            if (syncStatus) {
                syncStatus.classList.remove('synced');
                syncStatus.innerHTML = '📴';
                syncStatus.title = 'Offline only';
            }
        }
    }
};

// Initialize auth UI on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AuthUI.updateAuthUI();
    });
} else {
    AuthUI.updateAuthUI();
}
