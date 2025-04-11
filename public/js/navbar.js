document.addEventListener("DOMContentLoaded", function () {
    // First load the navbar HTML
    fetch("/components/navbar.html")
        .then(response => response.text())
        .then(html => {
            // Insert the navbar HTML
            document.getElementById("navbar-container").innerHTML = html;
            
            // Setup mobile menu functionality after navbar loads
            setupMobileMenu();
            
            // Only after navbar is loaded, check auth status
            checkAuthStatus();
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
        const response = await fetch('/api/auth/status', {
            method: 'GET',
            credentials: 'include' // Ensures cookies are sent with request
        });

        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();
        
        // Find the auth-status element
        const authStatusElement = document.getElementById('auth-status');
        
        // Only update if the element exists
        if (authStatusElement) {
            authStatusElement.textContent = data.authenticated 
                ? `Logged in as: ${data.username}` 
                : 'Not logged in';
        } else {
            console.warn('auth-status element not found in the DOM');
        }

        // Handle admin links visibility
        const authLinks = document.querySelectorAll('.admin');
        if (authLinks.length > 0) {
            // Only show admin links for user "Church"
            const isAdmin = data.authenticated && data.username === 'Church';
            authLinks.forEach(link => {
                link.style.display = isAdmin ? 'inline' : 'none';
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

    } catch (error) {
        console.error('Error checking authentication:', error);
        
        // Safely update the auth status element if it exists
        const authStatusElement = document.getElementById('auth-status');
        if (authStatusElement) {
            authStatusElement.textContent = 'Authentication error';
        }
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
            window.location.href = '/';  // Redirect to home page after logout
        } else {
            console.error('Logout failed');
        }
    })
    .catch(error => console.error('Error during logout:', error));
}