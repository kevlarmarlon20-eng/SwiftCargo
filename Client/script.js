document.addEventListener("DOMContentLoaded", () => {
  // --- ADDED: Mobile Navigation Toggle ---
  const navToggle = document.querySelector(".nav-toggle");
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      document.body.classList.toggle("nav-is-open");
    });
  }

  // --- ADDED: Close Mobile Nav on Link Click ---
  const mobileNavLinks = document.querySelectorAll("nav a");
  mobileNavLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (document.body.classList.contains("nav-is-open")) {
        document.body.classList.remove("nav-is-open");
      }
    });
  });
  // --- END ADDED ---


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

  // --- Tracking Form Submission ---
  const trackingForm = document.querySelector(".tracking-form");
  if (trackingForm) {
    trackingForm.addEventListener("submit", (e) => {
      e.preventDefault();

      // Clear previous error messages
      let errorContainer = document.querySelector(".error-container");
      if (errorContainer) {
        errorContainer.innerHTML = "";
      }

      const trackingNumberInput = document.getElementById("tracking-number-hero");
      const trackingNumber = trackingNumberInput.value.trim();

      if (trackingNumber) {
        // Redirect to the tracking result page
        window.location.href = `track-result.html?id=${encodeURIComponent(
          trackingNumber
        )}`;
      } else {
        // If no tracking number is entered, display an error message
        if (!errorContainer) {
          errorContainer = document.createElement("div");
          errorContainer.className = "error-container";
          trackingForm.before(errorContainer);
        }
        errorContainer.innerHTML = `<p class="error">Please enter a tracking number.</p>`;
      }
    });
  } // <-- BUG FIX: Added this missing closing brace for 'if (trackingForm)'

  // --- Dynamic Year for Footer ---
  const currentYearSpan = document.getElementById("current-year");
  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }
});