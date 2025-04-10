document.addEventListener("DOMContentLoaded", function () {
    fetch("/components/navbar.html")
        .then(response => response.text())
        .then(html => {
            document.getElementById("navbar-container").innerHTML = html;
        })
        .catch(error => console.error("Error loading navbar:", error));

        async function checkAuthStatus() {
            try {
                const response = await fetch('/api/auth/status', {
                    method: 'GET',
                    credentials: 'include' // Ensures cookies are sent
                });

                if (!response.ok) {
                    throw new Error('Authentication check failed');
                }

                const data = await response.json();
                const isAuthenticated = data.authenticated;
                const authLinks = document.querySelectorAll('.admin');

                if (data.username == 'Church') {
                    // Show restricted links
                    authLinks.forEach(link => link.style.display = 'inline');
                }
                else {
                    // Hide restricted links
                    authLinks.forEach(link => link.style.display = 'none');
                }

                // Update the div content
                document.getElementById('auth-status').textContent = 
                    data.authenticated ? `Logged in as: ${data.username}` : 'Not logged in';

            } catch (error) {
                console.error('Error checking authentication:', error);
                document.getElementById('auth-status').textContent = 'Error checking authentication';
            }
        }

        // Run the auth check on page load
        checkAuthStatus();

    });
