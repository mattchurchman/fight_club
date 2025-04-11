document.addEventListener("DOMContentLoaded", function () {
    // First load the navbar HTML
    fetch("/components/navbar.html")
        .then(response => response.text())
        .then(html => {
            // Insert the navbar HTML
            document.getElementById("navbar-container").innerHTML = html;
            
            // Hide admin links by default until auth check completes
            const authLinks = document.querySelectorAll('.admin');
            authLinks.forEach(link => {
                link.style.display = 'none';
            });
            
            // Hide auth status message until we have real data
            const authStatusElement = document.getElementById('auth-status');
            if (authStatusElement) {
                // Make it invisible but preserve layout space
                authStatusElement.style.visibility = 'hidden';
            }
            
            // Setup mobile menu functionality after navbar loads
            setupMobileMenu();
            
            // Only after navbar is loaded, check auth status
            checkAuthStatus().then(() => {
                // Show the auth status once we have data
                if (authStatusElement) {
                    authStatusElement.style.visibility = 'visible';
                    
                    // Add a subtle fade-in effect
                    authStatusElement.style.opacity = '0';
                    authStatusElement.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        authStatusElement.style.opacity = '1';
                    }, 10);
                }
            });
        })
        .catch(error => console.error("Error loading navbar:", error));
});

// Setup hamburger menu functionality
function setupMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            // Toggle active class for mobile menu
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
        
        // Close menu when a link is clicked
        const navItems = document.querySelectorAll('.nav-links a');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navLinks.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }
}

// Auth status check function
async function checkAuthStatus() {
    try {
        const authStatusElement = document.getElementById('auth-status');
        
        // Make the fetch request
        const response = await fetch('/api/auth/status', {
            method: 'GET',
            credentials: 'include', // Ensures cookies are sent with request
            cache: 'no-store' // Prevent caching of authentication status
        });

        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();
        
        // Update auth status display only now that we have data
        if (authStatusElement) {
            authStatusElement.textContent = data.authenticated 
                ? `Logged in as: ${data.username}` 
                : 'Not logged in';
        }

        // Handle admin links visibility
        const authLinks = document.querySelectorAll('.admin');
        // Only show admin links for user "Church" when authenticated
        if (data.authenticated && data.username === 'Church') {
            authLinks.forEach(link => {
                link.style.display = 'inline';
            });
        } else {
            authLinks.forEach(link => {
                link.style.display = 'none';
            });
        }
        
        // Update login button if user is authenticated
        if (data.authenticated) {
            const loginBtn = document.querySelector('.login-btn');
            if (loginBtn) {
                loginBtn.textContent = 'Account';
                // You might want to change the href too
                // loginBtn.href = "account.html";
            }
        }

        return data; // Return the data for potential further use

    } catch (error) {
        console.error('Error checking authentication:', error);
        
        // Set error state
        const authStatusElement = document.getElementById('auth-status');
        if (authStatusElement) {
            authStatusElement.textContent = 'Authentication error';
        }
        
        // Ensure admin links stay hidden on error
        const authLinks = document.querySelectorAll('.admin');
        authLinks.forEach(link => {
            link.style.display = 'none';
        });
        
        return { authenticated: false }; // Return default state
    }
}

// Logout function
function logout() {
    fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    })
    .then(response => {
        if (response.ok) {
            // Force refresh auth status after logout
            checkAuthStatus().then(() => {
                window.location.href = '/';  // Redirect to home page after logout
            });
        } else {
            console.error('Logout failed');
        }
    })
    .catch(error => console.error('Error during logout:', error));
}