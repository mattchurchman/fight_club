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
            
            console.log('here2');
            console.log('authStatusElement exists:', !!authStatusElement);
            
            // FINAL FIX: Force direct function execution with explicit error handling
            console.log('Attempting direct function execution');
            
            // Use setTimeout to ensure this runs in a new stack frame
            setTimeout(() => {
                try {
                    console.log('Starting manual auth check');
                    
                    // Direct function execution - no promises or async handling yet
                    const authStatusElement = document.getElementById('auth-status');
                    console.log('here3 - direct call');
                    
                    // Make fetch request without using await
                    console.log('Attempting to fetch auth status directly');
                    fetch('/api/auth/status', {
                        method: 'GET',
                        credentials: 'include',
                        cache: 'no-store'
                    })
                    .then(response => {
                        console.log('Direct fetch response received:', response.status);
                        if (!response.ok) {
                            throw new Error(`Server responded with status ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('Auth data received directly:', data);
                        
                        // Update auth status display
                        if (authStatusElement) {
                            authStatusElement.textContent = data.authenticated 
                                ? `Logged in as: ${data.username}` 
                                : 'Not logged in';
                            authStatusElement.style.visibility = 'visible';
                            
                            // Add a subtle fade-in effect
                            authStatusElement.style.opacity = '0';
                            authStatusElement.style.transition = 'opacity 0.3s ease';
                            setTimeout(() => {
                                authStatusElement.style.opacity = '1';
                            }, 10);
                            
                            console.log('Auth status element updated directly');
                        }
                        
                        // Handle admin links visibility
                        const authLinks = document.querySelectorAll('.admin');
                        console.log('Admin links found directly:', authLinks.length);
                        
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
                    })
                    .catch(error => {
                        console.error('Error in direct auth check:', error);
                        
                        // Handle error state
                        if (authStatusElement) {
                            authStatusElement.textContent = 'Authentication error';
                            authStatusElement.style.visibility = 'visible';
                        }
                        
                        const authLinks = document.querySelectorAll('.admin');
                        authLinks.forEach(link => {
                            link.style.display = 'none';
                        });
                    });
                    
                } catch (error) {
                    console.error('Critical error in direct auth check execution:', error);
                }
            }, 200); // Small delay to ensure DOM is ready
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
    } else {
        console.warn('Hamburger menu elements not found');
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
            // Perform page redirect after successful logout
            window.location.href = '/';
        } else {
            console.error('Logout failed');
        }
    })
    .catch(error => console.error('Error during logout:', error));
}