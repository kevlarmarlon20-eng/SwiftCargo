document.addEventListener("DOMContentLoaded", () => {
  /**
   * A reusable helper function to handle form submissions via fetch.
   * @param {HTMLFormElement} form - The form element being submitted.
   * @param {string} url - The URL endpoint to post data to.
   * @param {object} body - The request body to be sent as JSON.
   * @param {HTMLElement} statusElement - The element to display form status messages.
   * @param {function} onSuccess - A callback function to run on successful submission.
   */
  const handleFormSubmit = async (form, url, body, statusElement, onSuccess) => {
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;

    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = "Processing...";
    statusElement.textContent = "";
    statusElement.className = "form-status";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok) {
        onSuccess(result); // Execute the success callback
      } else {
        statusElement.textContent = `Error: ${result.message}`;
        statusElement.className = "form-status error";
      }
    } catch (error)
    {
      console.error(`Failed to submit form to ${url}:`, error);
      statusElement.textContent = "An unexpected network error occurred.";
      statusElement.className = "form-status error";
    } finally {
      // Re-enable button
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  };

  // --- Register Package Form Submission ---
  const registerForm = document.getElementById("register-package-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusElement = document.getElementById("register-form-status");

      // Collect form data
      const formData = new FormData(registerForm);
      const body = {
        sender: {
          name: formData.get("sender-name"),
          address: formData.get("sender-address"),
          phone: formData.get("sender-phone"),
          email: formData.get("sender-email"),
        },
        receiver: {
          name: formData.get("receiver-name"),
          address: formData.get("receiver-address"),
          phone: formData.get("receiver-phone"),
          email: formData.get("receiver-email"),
        },
      };

      // Define success behavior
      const onSuccess = (result) => {
        statusElement.textContent = `Success! New tracking number: ${result.trackingNumber}`;
        statusElement.className = "form-status success";
        registerForm.reset();
      };

      // Use the helper to handle the submission
      await handleFormSubmit(registerForm, "/register-package", body, statusElement, onSuccess);
    });
  }

  // --- Update Status Form Submission ---
  const updateForm = document.getElementById("update-status-form");
  if (updateForm) {
    updateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusElement = document.getElementById("update-form-status");

      // Collect form data
      const formData = new FormData(updateForm);
      const body = { trackingNumber: formData.get('update-tracking-number'), status: formData.get('update-status-text'), location: formData.get('update-location') };

      if (!body.trackingNumber || !body.status || !body.location) {
        statusElement.textContent = "Please fill out all fields.";
        statusElement.className = "form-status error";
        return;
      }

      // Define success behavior
      const onSuccess = (result) => {
        statusElement.textContent = result.message;
        statusElement.className = "form-status success";
        updateForm.reset();
      };

      // Use the helper to handle the submission
      await handleFormSubmit(updateForm, "/update-status", body, statusElement, onSuccess);
    });
  }
});
