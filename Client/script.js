document.addEventListener("DOMContentLoaded", () => {
  // --- Smooth Scrolling for Navigation Links ---
  const navLinks = document.querySelectorAll('nav a[href^="#"]');

  navLinks.forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const href = this.getAttribute("href");

      // Allow for the top link to just go to the top of the page.
      if (href === "#") {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
        return;
      }

      const targetElement = document.querySelector(href);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
        });
      }
    });
  });

  // --- Contact Form Submission ---
  const contactForm = document.querySelector(".contact-form form");
  if (contactForm) {
    const formStatus = document.getElementById("form-status");
    const submitButton = contactForm.querySelector('button[type="submit"]');

    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault(); // Prevent the default form submission

      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const subject = document.getElementById("subject").value.trim();
      const message = document.getElementById("message").value.trim();

      if (!name || !email || !subject || !message) {
        formStatus.textContent = "Please fill out all required fields.";
        formStatus.className = "form-status error";
        return;
      }
      
      const formData = { name, email, subject, message };

      // Provide visual feedback during submission
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
      formStatus.textContent = "";
      formStatus.className = "form-status";

      try {
        const response = await fetch("/send-message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (response.ok) {
          formStatus.textContent = "Thank you! Your message has been sent.";
          formStatus.className = "form-status success";
          contactForm.reset(); // Clear the form fields
        } else {
          formStatus.textContent = `Error: ${result.message}`;
          formStatus.className = "form-status error";
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        formStatus.textContent = "An unexpected error occurred. Please try again later.";
        formStatus.className = "form-status error";
      } finally {
        // Re-enable the button after the request is complete
        submitButton.disabled = false;
        submitButton.textContent = "Send Message";
      }
    });
  }

  // --- Tracking Form Submission ---
  const trackingForm = document.querySelector('.tracking-form');
  if (trackingForm) {
    trackingForm.addEventListener('submit', e => {
      e.preventDefault();
      const trackingNumberInput = document.getElementById('Tracking-Number');
      const trackingNumber = trackingNumberInput.value.trim();

      if (trackingNumber) {
        // Redirect to the tracking result page
        window.location.href = `track-result.html?trackingNumber=${encodeURIComponent(
          trackingNumber
        )}`;
      } else {
        // If no tracking number is entered, display an error message
        let errorContainer = document.querySelector('.error-container');
        if (!errorContainer) {
          errorContainer = document.createElement('div');
          errorContainer.className = 'error-container';
          trackingForm.before(errorContainer);
        }
        errorContainer.innerHTML = `<p class="error">Please enter a tracking number.</p>`;
      }
    });
  }
});