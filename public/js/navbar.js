document.addEventListener("DOMContentLoaded", function () {
    console.log('DOM Content Loaded');
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
            
            console.log('here');
            // Setup mobile menu functionality after navbar loads
            try {
                setupMobileMenu();
                console.log('here1');
            } catch (error) {
                console.error("Error in setupMobileMenu:", error);
            }
            
            // Critical fix: Ensure checkAuthStatus is properly executed
            console.log('here2');
            console.log('authStatusElement exists:', !!authStatusElement);
            
            // Use a deliberate function call instead of relying on promise chaining
            try {
                // Force the function to execute synchronously first
                const authPromise = runAuthCheck();
                
                // Then handle the async result
                authPromise
                    .then(result => {
                        console.log('Auth check completed with result:', result);
                        
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
                    })
                    .catch(error => {
                        console.error("Error during auth status handling:", error);
                    });
            } catch (error) {
                console.error("Critical error initiating auth check:", error);
            }
        })
        .catch(error => console.error("Error loading navbar:", error));
});

// This function ensures checkAuthStatus is actually called
async function runAuthCheck() {
    console.log('runAuthCheck started - ensuring auth check executes');
    
    try {
        // Force execution of the checkAuthStatus function
        const result = await checkAuthStatus();
        console.log('Auth check function completed execution');
        return result;
    } catch (error) {
        console.error('Error in auth check wrapper:', error);
        throw error;
    }
}

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
    } else {
        console.warn('Hamburger menu elements not found');
    }
}

// Auth status check function
async function checkAuthStatus() {
    console.log('here3');
    
    // Check if auth-status element exists
    const authStatusElement = document.getElementById('auth-status');
    console.log('here4: authStatusElement exists:', !!authStatusElement);
    
    try {
        // Make the fetch request
        console.log('Attempting to fetch auth status');
        const response = await fetch('/api/auth/status', {
            method: 'GET',
            credentials: 'include', // Ensures cookies are sent with request
            cache: 'no-store' // Prevent caching of authentication status
        });

        console.log('Fetch response received:', response.status);
        
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();
        console.log('here5: Auth data received:', data);
        
        // Update auth status display only now that we have data
        if (authStatusElement) {
            authStatusElement.textContent = data.authenticated 
                ? `Logged in as: ${data.username}` 
                : 'Not logged in';
            console.log('Auth status element updated');
        } else {
            console.warn('Auth status element not found when updating content');
        }

        // Handle admin links visibility
        const authLinks = document.querySelectorAll('.admin');
        console.log('Admin links found:', authLinks.length);
        
        // Only show admin links for user "Church" when authenticated
        if (data.authenticated && data.username === 'Church') {
            authLinks.forEach(link => {
                link.style.display = 'inline';
            });
            console.log('Admin links displayed for user Church');
        } else {
            authLinks.forEach(link => {
                link.style.display = 'none';
            });
            console.log('Admin links hidden');
        }

        return data; // Return the data for potential further use

    } catch (error) {
        console.error('Error checking authentication:', error);
        
        // Set error state
        if (authStatusElement) {
            authStatusElement.textContent = 'Authentication error';
            console.log('Auth status set to error state');
        } else {
            console.warn('Auth status element not found when setting error state');
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
    console.log('Logout function called');
    fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    })
    .then(response => {
        console.log('Logout response received:', response.status);
        if (response.ok) {
            // Force refresh auth status after logout
            runAuthCheck().then(() => {
                window.location.href = '/';  // Redirect to home page after logout
            });
        } else {
            console.error('Logout failed');
        }
    })
    .catch(error => console.error('Error during logout:', error));
}