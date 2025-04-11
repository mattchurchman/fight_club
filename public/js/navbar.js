document.addEventListener("DOMContentLoaded", function () {
    // First load the navbar HTML
    fetch("/components/navbar.html")
        .then(response => response.text())
        .then(html => {
            // Insert the navbar HTML
            document.getElementById("navbar-container").innerHTML = html;
            
            // Only after navbar is loaded, check auth status
            checkAuthStatus();
        })
        .catch(error => console.error("Error loading navbar:", error));
});

// Moved outside the DOMContentLoaded to avoid nesting callbacks
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

    } catch (error) {
        console.error('Error checking authentication:', error);
        
        // Safely update the auth status element if it exists
        const authStatusElement = document.getElementById('auth-status');
        if (authStatusElement) {
            authStatusElement.textContent = 'Authentication error';
        }
    }
}

// Add a logout function if you need it
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