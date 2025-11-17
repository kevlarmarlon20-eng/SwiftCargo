document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.querySelector('.contact-form');

    // --- THIS IS THE FIX ---
    // Only run this code if the contact form actually exists on the page
    if (contactForm) {
        const formStatus = document.getElementById('form-status');

        // Small extra check: make sure the status message element exists too
        if (!formStatus) {
            console.error("Error: The #form-status element was not found.");
            return;
        }

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;

            if (!name || !email || !message) {
                formStatus.textContent = 'Please fill out all fields.';
                formStatus.className = 'error';
                return;
            }

            // Optional: Show a "sending" message
            formStatus.textContent = 'Sending...';
            formStatus.className = 'pending';

            try {
                const response = await fetch('/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, message }),
                });

                if (response.ok) {
                    formStatus.textContent = 'Thank you, your message has been sent.';
                    formStatus.className = 'success';
                    contactForm.reset();
                } else {
                    const errorData = await response.json();
                    formStatus.textContent = `An error occurred: ${errorData.message || response.statusText}`;
                    formStatus.className = 'error';
                }
            } catch (error) {
                formStatus.textContent = 'A network error occurred. Please try again later.';
                formStatus.className = 'error';
            }
        });
    } // --- END OF THE FIX ---
});