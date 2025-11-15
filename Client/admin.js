// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
  // Select the forms
  const registerForm = document.getElementById('register-package-form');
  const updateForm = document.getElementById('update-status-form');

  // Select the status message elements (we'll add these to the HTML next)
  const registerStatus = document.getElementById('register-form-status');
  const updateStatus = document.getElementById('update-form-status');

  // 1. Handle the "Register New Package" form submission
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // Stop the form from submitting the traditional way
      clearStatus(registerStatus); // Clear previous messages

      // Get the form data
      const formData = new FormData(registerForm);
      // Convert FormData to a plain object
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/register-package', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
          // Success!
          showStatus(
            registerStatus,
            `Success! New Tracking ID: ${result.trackingNumber}`,
            false
          );
          registerForm.reset(); // Clear the form fields
        } else {
          // Error from the server (e.g., 400, 404)
          showStatus(registerStatus, `Error: ${result.message}`, true);
        }
      } catch (error) {
        // Network error or other fetch error
        console.error('Registration error:', error);
        showStatus(
          registerStatus,
          'A network error occurred. Please try again.',
          true
        );
      }
    });
  }

  // 2. Handle the "Update Package Status" form submission
  if (updateForm) {
    updateForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // Stop the form from submitting
      clearStatus(updateStatus); // Clear previous messages

      // Get and convert form data
      const formData = new FormData(updateForm);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/update-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
          // Success!
          showStatus(updateStatus, `Success: ${result.message}`, false);
          updateForm.reset(); // Clear the form fields
        } else {
          // Error from the server
          showStatus(updateStatus, `Error: ${result.message}`, true);
        }
      } catch (error) {
        // Network error
        console.error('Update error:', error);
        showStatus(
          updateStatus,
          'A network error occurred. Please try again.',
          true
        );
      }
    });
  }

  // --- Helper Functions ---

  /**
   * Displays a status message (success or error)
   * @param {HTMLElement} element - The status div to show the message in
   * @param {string} message - The message to display
   * @param {boolean} isError - True for error styling, false for success
   */
  function showStatus(element, message, isError) {
    if (!element) return;
    element.textContent = message;
    element.className = 'form-status'; // Reset classes
    if (isError) {
      element.classList.add('error');
    } else {
      element.classList.add('success');
    }
  }

  /**
   * Clears any existing status message
   * @param {HTMLElement} element - The status div to clear
   */
  function clearStatus(element) {
    if (!element) return;
    element.textContent = '';
    element.className = 'form-status';
  }
});