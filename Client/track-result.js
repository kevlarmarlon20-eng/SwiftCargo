// This function now makes a real fetch request to your backend API.
async function fetchTrackingData(trackingNumber) {
  const response = await fetch(`/track/${trackingNumber}`);

  if (!response.ok) {
    // If the server returns a 404 or other error, handle it.
    const errorResult = await response.json();
    throw new Error(errorResult.message || "Failed to fetch tracking data.");
  }

  return response.json();
}

// This function is updated to populate the page with data from your actual server.
function populateTrackingData(data, trackingNumber) {
  // 1. Populate Summary Box
  document.getElementById("tracking-number-display").textContent = trackingNumber;
  document.getElementById("status-text-display").textContent = data.status;
  document.getElementById("current-location").textContent = data.location;

  // Use receiver's address as the destination
  if (data.receiver && data.receiver.address) {
    document.getElementById("destination-address").textContent = data.receiver.address;
  } else {
    document.getElementById("destination-address").textContent = "Not available";
  }

  // Hide elements for which the server doesn't provide data
  document.getElementById("delivery-date-display").parentElement.style.display = "none";
  document.querySelector(".progress-bar").style.display = "none";
  document.querySelector(".share-btn").style.display = "none";
  document.getElementById("tracking-alert").style.display = "none";

  // 2. Populate Shipment Timeline
  const timelineContainer = document.getElementById("timeline-container");
  timelineContainer.innerHTML = ""; // Clear placeholder

  if (data.history && data.history.length > 0) {
    // Set origin address from the first history event
    document.getElementById("origin-address").textContent = data.history[0].location;

    data.history.reverse().forEach((item) => {
      const timelineItem = document.createElement("div");
      timelineItem.className = "timeline-item";

      // Format the timestamp
      const itemDate = new Date(item.timestamp).toLocaleString();

      timelineItem.innerHTML = `
        <span class="timeline-status">${item.status}</span>
        <span class="timeline-location">${item.location}</span>
        <span class="timeline-date">${itemDate}</span>
      `;
      timelineContainer.appendChild(timelineItem);
    });
  } else {
    timelineContainer.innerHTML = "<p>No history available.</p>";
    document.getElementById("origin-address").textContent = "Not available";
  }

  // 3. Hide the entire "Package Details" card as the server doesn't provide this.
  // A more robust solution would be to check for each field, but this is cleaner for now.
  const packageDetailsCard = document.querySelector(".package-details-grid").closest(".card");
  if (packageDetailsCard) {
    packageDetailsCard.style.display = "none";
  }
  
  // Also hide the map, as there's no map integration yet.
  const mapCard = document.getElementById("map").closest(".card");
  if (mapCard) {
    mapCard.style.display = "none";
  }


  // 4. Populate Sidebar with Sender/Receiver Info
  if (data.receiver) {
    document.getElementById("receiver-name").textContent = data.receiver.name || "N/A";
    document.getElementById("receiver-email").textContent = data.receiver.email || "N/A";
    document.getElementById("receiver-address").textContent = data.receiver.address || "N/A";
  }
  if (data.sender) {
    document.getElementById("sender-name").textContent = data.sender.name || "N/A";
    document.getElementById("sender-email").textContent = data.sender.email || "N/A";
    document.getElementById("sender-address").textContent = data.sender.address || "N/A";
  }
}

// Main script execution starts here
document.addEventListener("DOMContentLoaded", () => {
  const resultsContainer = document.getElementById("results-container");
  const pageContainer = document.querySelector(".track-results-container");
  const params = new URLSearchParams(window.location.search);
  const trackingNumber = params.get("trackingNumber");

  // Handle the "Track Another Shipment" form in the sidebar
  const trackAnotherForm = document.getElementById("track-another-form");
  if (trackAnotherForm) {
    trackAnotherForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = trackAnotherForm.querySelector("input");
      if (input && input.value) {
        window.location.href = `track-result.html?trackingNumber=${input.value.trim()}`;
      }
    });
  }

  // --- Main Tracking Logic ---

  if (!trackingNumber) {
    pageContainer.innerHTML =
      '<p class="error" style="text-align: center; padding: 40px;">No tracking number provided. <a href="index.html">Go back</a>.</p>';
    return;
  }

  // Hide results and show a loading message
  resultsContainer.style.display = "none";
  const loadingMessage = document.createElement("p");
  loadingMessage.id = "loading-message";
  loadingMessage.textContent = `Searching for tracking number: ${trackingNumber}...`;
  loadingMessage.style.textAlign = "center";
  loadingMessage.style.padding = "40px";
  pageContainer.appendChild(loadingMessage);

  // Call the fetch function
  fetchTrackingData(trackingNumber)
    .then((data) => {
      // Success!
      document.getElementById("loading-message")?.remove();
      populateTrackingData(data, trackingNumber); // Populate all the fields
      resultsContainer.style.display = "block"; // Show the results
    })
    .catch((error) => {
      // Error!
      document.getElementById("loading-message")?.remove();
      // Show the error message inside the main container
      pageContainer.innerHTML = `<p class="error" style="text-align: center; padding: 40px;">${error.message} <a href="index.html">Try again</a>.</p>`;
    });
});
