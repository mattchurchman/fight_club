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
            
            // Setup mobile menu functionality after navbar loads
            setupMobileMenu();
            
            // Use setTimeout to ensure this runs in a new stack frame
            setTimeout(() => {
                try {
                    // Direct function execution - no promises or async handling yet
                    const authStatusElement = document.getElementById('auth-status');
                    
                    // Make fetch request without using await
                    fetch('/api/auth/status', {
                        method: 'GET',
                        credentials: 'include',
                        cache: 'no-store'
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Server responded with status ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
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
                        }
                        
                        // Handle admin links visibility
                        const authLinks = document.querySelectorAll('.admin');
                        
                        if (data.authenticated && data.username === 'Church') {
                            authLinks.forEach(link => {
                                link.style.display = 'inline';
                            });
                        } else {
                            authLinks.forEach(link => {
                                link.style.display = 'none';
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Authentication error:', error);
                        
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
                    console.error('Error in auth check:', error);
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
            // Perform page redirect after successful logout
            window.location.href = '/';
        } else {
            console.error('Logout failed');
        }
    })
    .catch(error => console.error('Error during logout:', error));
}