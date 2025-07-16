// Admin login page logic: handle admin authentication and Google email verification

class AdminLogin {
    constructor() {
        this.verifiedEmail = null;
        this.isEmailVerified = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkForOAuthCallback();
    }

    bindEvents() {
        // Verify email button
        document.getElementById('verify-email-btn').addEventListener('click', () => {
            this.initiateOAuth();
        });

        // Form submission
        document.getElementById('admin-login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Input validation
        document.getElementById('username').addEventListener('input', () => {
            this.validateForm();
        });

        document.getElementById('password').addEventListener('input', () => {
            this.validateForm();
        });
    }

    checkForOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const verifiedEmail = urlParams.get('verified_email');
        const error = urlParams.get('error');

        if (error) {
            this.showError('OAuth verification failed. Please try again.');
            // Remove error param from URL
            this.cleanUpOAuthParams();
            return;
        }

        if (verifiedEmail) {
            this.verifiedEmail = decodeURIComponent(verifiedEmail);
            this.verifyEmailWithServer(this.verifiedEmail);
            // Remove verified_email param from URL
            this.cleanUpOAuthParams();
        }
    }

    cleanUpOAuthParams() {
        if (window.history.replaceState) {
            const url = new URL(window.location);
            url.searchParams.delete('verified_email');
            url.searchParams.delete('error');
            window.history.replaceState({}, document.title, url.pathname);
        }
    }

    async initiateOAuth() {
        try {
            // Store current form data in sessionStorage for after OAuth
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                this.showError('Please enter both username and password before verifying email.');
                return;
            }

            sessionStorage.setItem('admin_username', username);
            sessionStorage.setItem('admin_password', password);

            // Redirect to OAuth
            const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4000' : 'https://fitpickd-backend.onrender.com';
            window.location.href = `${API_BASE}/auth/google/not-an-admin`;
        } catch (error) {
            console.error('OAuth initiation error:', error);
            this.showError('Failed to initiate email verification. Please try again.');
        }
    }

    async verifyEmailWithServer(email) {
        try {
            const API_BASE = window.location.hostname === 'localhost'
                ? 'http://localhost:4000'
                : 'https://fitpickd-backend.onrender.com';
            const response = await fetch(`${API_BASE}/admin/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok && data.valid) {
                this.isEmailVerified = true;
                this.showEmailStatus('Email verified successfully!', 'success');
                this.enableSignInButton();
                
                // Restore form data
                const username = sessionStorage.getItem('admin_username');
                const password = sessionStorage.getItem('admin_password');
                
                if (username) document.getElementById('username').value = username;
                if (password) document.getElementById('password').value = password;
                
                // Clear session storage
                sessionStorage.removeItem('admin_username');
                sessionStorage.removeItem('admin_password');
            } else {
                this.isEmailVerified = false;
                this.showEmailStatus('Email not authorized for admin access.', 'error');
                this.disableSignInButton();
            }
        } catch (error) {
            console.error('Email verification error:', error);
            this.showEmailStatus('Failed to verify email. Please try again.', 'error');
            this.disableSignInButton();
        }
    }

    async handleLogin() {
        if (!this.isEmailVerified) {
            this.showError('Please verify your email before signing in.');
            return;
        }

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showError('Please fill in all fields.');
            return;
        }

        try {
            const API_BASE = window.location.hostname === 'localhost'
                ? 'http://localhost:4000'
                : 'https://fitpickd-backend.onrender.com';
            const response = await fetch(`${API_BASE}/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password,
                    email: this.verifiedEmail
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showSuccess('Login successful! Redirecting...');
                
                // Store admin token
                localStorage.setItem('admin_token', data.token);
                
                // Redirect to admin dashboard
                setTimeout(() => {
                    window.location.href = 'https://fitpickd-backend.onrender.com/not-an-admin';
                }, 1000);
            } else {
                this.showError(data.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed. Please try again.');
        }
    }

    validateForm() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const verifyBtn = document.getElementById('verify-email-btn');
        
        if (username && password) {
            verifyBtn.disabled = false;
            verifyBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            verifyBtn.disabled = true;
            verifyBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    showEmailStatus(message, type) {
        const statusDiv = document.getElementById('email-verification-status');
        const statusIcon = document.getElementById('email-status-icon');
        const statusText = document.getElementById('email-status-text');

        statusDiv.className = 'block';
        statusText.textContent = message;

        if (type === 'success') {
            statusDiv.className = 'block p-3 bg-green-100 border border-green-400 text-green-700 rounded-md';
            statusIcon.className = 'fas fa-check-circle mr-2';
        } else if (type === 'error') {
            statusDiv.className = 'block p-3 bg-red-100 border border-red-400 text-red-700 rounded-md';
            statusIcon.className = 'fas fa-times-circle mr-2';
        } else {
            statusDiv.className = 'block p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-md';
            statusIcon.className = 'fas fa-info-circle mr-2';
        }
    }

    enableSignInButton() {
        const signinBtn = document.getElementById('signin-btn');
        signinBtn.disabled = false;
        signinBtn.classList.remove('bg-gray-400', 'btn-disabled');
        signinBtn.classList.add('bg-black', 'hover:bg-gray-800');
    }

    disableSignInButton() {
        const signinBtn = document.getElementById('signin-btn');
        signinBtn.disabled = true;
        signinBtn.classList.remove('bg-black', 'hover:bg-gray-800');
        signinBtn.classList.add('bg-gray-400', 'btn-disabled');
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        const successDiv = document.getElementById('success-message');
        
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 5000);
    }

    showSuccess(message) {
        const successDiv = document.getElementById('success-message');
        const successText = document.getElementById('success-text');
        const errorDiv = document.getElementById('error-message');
        
        successText.textContent = message;
        successDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
    }
}

// Initialize admin login when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdminLogin();
}); 