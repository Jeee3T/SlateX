const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signInBtn = document.getElementById('sign-in-btn');
const signUpBtn = document.getElementById('sign-up-btn');
const forgotLink = document.getElementById('forgot-link');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const closeBtn = document.querySelector('.close-btn');

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    successMessage.classList.remove('show');
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 5000);
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.classList.add('show');
    errorMessage.classList.remove('show');
    setTimeout(() => {
        successMessage.classList.remove('show');
    }, 5000);
}

function setLoading(isLoading) {
    signInBtn.disabled = isLoading;
    signUpBtn.disabled = isLoading;
    emailInput.disabled = isLoading;
    passwordInput.disabled = isLoading;

    if (isLoading) {
        signInBtn.textContent = 'Signing in...';
    } else {
        signInBtn.textContent = 'Sign In';
    }
}

function handleSignIn(email, password) {
    try {
        setLoading(true);

        // Simulate authentication
        if (!email.includes('@')) {
            showError('Please enter a valid email address.');
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters long.');
            setLoading(false);
            return;
        }

        // Store credentials in localStorage (for demo purposes)
        localStorage.setItem('user', JSON.stringify({ email, signedIn: true }));

        showSuccess('Successfully signed in! Redirecting...');
        setTimeout(() => {
            window.location.href = '/room';
        }, 1500);
    } catch (err) {
        showError('An unexpected error occurred. Please try again.');
        console.error('Sign in error:', err);
        setLoading(false);
    }
}

function handleSignUp(email, password) {
    try {
        setLoading(true);
        signUpBtn.disabled = true;
        signUpBtn.textContent = 'Signing up...';

        if (!email.includes('@')) {
            showError('Please enter a valid email address.');
            setLoading(false);
            signUpBtn.disabled = false;
            signUpBtn.innerHTML = '<span class="user-icon">👤</span> Sign Up';
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters long.');
            setLoading(false);
            signUpBtn.disabled = false;
            signUpBtn.innerHTML = '<span class="user-icon">👤</span> Sign Up';
            return;
        }

        // Store credentials in localStorage (for demo purposes)
        localStorage.setItem('user', JSON.stringify({ email, signedIn: true }));

        showSuccess('Account created successfully! Redirecting...');
        setTimeout(() => {
            window.location.href = '/room';
        }, 1500);
    } catch (err) {
        showError('An unexpected error occurred. Please try again.');
        console.error('Sign up error:', err);
        setLoading(false);
        signUpBtn.disabled = false;
        signUpBtn.innerHTML = '<span class="user-icon">👤</span> Sign Up';
    }
}

function handleForgotPassword(email) {
    if (!email) {
        showError('Please enter your email address first.');
        return;
    }

    if (!email.includes('@')) {
        showError('Please enter a valid email address.');
        return;
    }

    showSuccess('Password reset email would be sent to ' + email);
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }

    handleSignIn(email, password);
});

signUpBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }

    handleSignUp(email, password);
});

forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    handleForgotPassword(email);
});

closeBtn.addEventListener('click', () => {
    window.history.back();
});

// Check if user is already signed in
window.addEventListener('load', () => {
    const user = localStorage.getItem('user');
    if (user) {
        const userData = JSON.parse(user);
        if (userData.signedIn) {
            window.location.href = '/room';
        }
    }
});
