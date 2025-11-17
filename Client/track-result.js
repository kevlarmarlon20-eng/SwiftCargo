document.addEventListener('DOMContentLoaded', () => {
  // Get tracking number from URL (e.g., .../track-result.html?id=SC12345)
  const urlParams = new URLSearchParams(window.location.search);
  const trackingNumber = urlParams.get('id');

  // --- Select all the elements from your HTML ---
  const trackingDisplay = document.getElementById('tracking-number-display');
  const statusDisplay = document.getElementById('status-text-display');
  const deliveryDateDisplay = document.getElementById('delivery-date-display');
  const progressBar = document.getElementById('progress-bar-inner');
  const timelineContainer = document.getElementById('timeline-container');
  const resultsContainer = document.getElementById('results-container');
  const trackingAlert = document.getElementById('tracking-alert');
  const alertMessage = document.getElementById('alert-message');

  // Receiver & Sender details
  const receiverName = document.getElementById('receiver-name');
  const receiverAddress = document.getElementById('receiver-address');
  const receiverEmail = document.getElementById('receiver-email');
  const receiverPhone = document.getElementById('receiver-phone');
  const senderName = document.getElementById('sender-name');
  const senderAddress = document.getElementById('sender-address');
  const senderEmail = document.getElementById('sender-email');
  const senderPhone = document.getElementById('sender-phone');

  if (!trackingNumber) {
    showError('No tracking ID provided. Please go back and try again.');
    return;
  }

  // Fetch the package data from the server
  fetch(`/track/${trackingNumber}`)
    .then(response => {
      if (!response.ok) {
        // Handle ALL non-OK responses first
        if (response.status === 404) {
          // This is the error we want to show the user
          throw new Error('The tracking number you entered seems incorrect. Please check the number and try again.');
        } else {
          // For other server errors (500, etc.), try to get the server's message
          // Use .json() which returns a promise, so chain the .then()
          return response.json().then(err => { 
            throw new Error(err.message || 'An unknown server error occurred.'); 
          });
        }
      }
      // ONLY parse JSON if the response is OK (200-299)
      return response.json();
    })
    .then(data => {
      // This block will ONLY run if the fetch was successful
      
      // Hide any previous error messages
      trackingAlert.classList.add('hidden');
      resultsContainer.classList.remove('hidden');

      // --- Data received successfully, now fill in the page ---

      // 1. Populate Summary Box
      trackingDisplay.textContent = data.trackingNumber;
      statusDisplay.textContent = data.status ? `${capitalize(data.status)} in ${data.location}` : 'N/A';

      if (data.shipmentInfo && data.shipmentInfo.eta) {
        const etaDate = new Date(data.shipmentInfo.eta).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
        deliveryDateDisplay.textContent = etaDate;
      } else {
        deliveryDateDisplay.textContent = 'N/A';
      }

      // 2. Populate Sender/Receiver
      receiverName.textContent = data.receiver?.name || 'N/A';
      receiverAddress.textContent = data.receiver?.address || 'N/A';
      receiverEmail.textContent = data.receiver?.email || 'N/A';
      receiverPhone.textContent = data.receiver?.phone || 'N/A';
      senderName.textContent = data.sender?.name || 'N/A';
      senderAddress.textContent = data.sender?.address || 'N/A';
      senderEmail.textContent = data.sender?.email || 'N/A';
      senderPhone.textContent = data.sender?.phone || 'N/A';

      // 4. Update Progress Bar
      updateProgressBar(data.status);

      // 5. Build Timeline
      buildTimeline(data.history);

      // 6. Initialize and Update Map
      initializeMap(data.location);
    })
    .catch(error => {
      // This single .catch() block will now handle ALL errors
      showError(error.message);
    });

  let map;
  let marker;

  /**
    * Initializes the Leaflet map
    */
  function initializeMap(initialLocation) {
    if (map) {
      map.remove();
    }

    // Default coordinates (e.g., center of the US) if no location is available
    const defaultCoords = [39.8283, -98.5795];

    map = L.map('map').setView(defaultCoords, 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    if (initialLocation) {
      // We'll need to geocode the location name to get coordinates
      // For now, let's simulate it. Replace with a real geocoding API.
      // Note: This is a placeholder. You'll need a geocoding service.
      simulateGeocoding(initialLocation).then(coords => {
        map.setView(coords, 10);
        if (marker) {
          marker.setLatLng(coords);
        } else {
          marker = L.marker(coords).addTo(map);
        }
        marker.bindPopup(`<b>Current Location:</b><br>${initialLocation}`).openPopup();
      });
    }
  }

  /**
    * Placeholder for a geocoding service
    * In a real app, you would use an API like OpenCage, Mapbox, or Google Maps Geocoding
    */
  async function simulateGeocoding(locationName) {
    // This is a very simple and limited simulation.
    // A real implementation would handle various location formats.
    const locations = {
      "New York, NY": [40.7128, -74.0060],
      "Los Angeles, CA": [34.0522, -118.2437],
      "Chicago, IL": [41.8781, -87.6298],
      "Houston, TX": [29.7604, -95.3698],
      "Phoenix, AZ": [33.4484, -112.0740],
      "Philadelphia, PA": [39.9526, -75.1652],
      "San Antonio, TX": [29.4241, -98.4936],
      "San Diego, CA": [32.7157, -117.1611],
      "Dallas, TX": [32.7767, -96.7970],
      "San Jose, CA": [37.3382, -121.8863],
      "London": [51.5074, -0.1278],
      "Paris": [48.8566, 2.3522],
      "Tokyo": [35.6895, 139.6917],
      "Sydney": [ -33.8688, 151.2093],
    };

    // Attempt to find a match, even if it's partial (e.g., "Paris, Frace")
    const key = Object.keys(locations).find(k => locationName.includes(k));

    return locations[key] || [39.8283, -98.5795]; // Return default if not found
  }

  /**
    * Shows an error message and hides the main content
    */
  function showError(message) {
    resultsContainer.classList.add('hidden');
    trackingAlert.classList.remove('hidden');
    trackingAlert.classList.add('alert-error'); // Add the error class
    alertMessage.textContent = message || 'An unknown error occurred.';
  }
  /**
    * Capitalizes the first letter of each word in a string.
    * @param {string} str The string to capitalize.
    * @returns {string} The capitalized string.
    */
  function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
  }


  /**
    * It builds the timeline, including the description
    */
  function buildTimeline(history) {
    // Clear any placeholder content
    timelineContainer.innerHTML = '';

    if (!history || history.length === 0) {
      timelineContainer.innerHTML = '<p>No shipment history found.</p>';
      return;
    }

    // Show most recent update first
    const reversedHistory = history.slice().reverse();

    // Create a document fragment to build the timeline items
    const fragment = document.createDocumentFragment();

    // Loop through each history item and create HTML for it
    reversedHistory.forEach(item => {
      const timelineItem = document.createElement('div');
      let itemClass = 'timeline-item';
      if (item.status && item.status.toLowerCase() === 'on-hold') {
        itemClass += ' timeline-item-on-hold';
      }
      timelineItem.className = itemClass;

      const itemHtml = `
        <div class="timeline-status">${capitalize(item.status)}</div>
        
        <div class="timeline-description">
          ${item.description}
        </div>
        
        <div class="timeline-date">
          ${new Date(item.timestamp).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          (at ${item.location})
        </div>
      `;
      timelineItem.innerHTML = itemHtml;
      fragment.appendChild(timelineItem);
    });

    // Add the new HTML to the container
    timelineContainer.appendChild(fragment);
  }

  /**
    * Updates the progress bar based on status
    */
  function updateProgressBar(status) {
    let width = '10%'; // Default for 'Pending'
    switch (status) {
      case 'In-Transit':
        width = '40%';
        break;
      case 'On-Hold':
        width = '50%';
        break;
      case 'Out for Delivery':
        width = '70%';
        break;
      case 'Delivered':
        width = '100%';
        break;
      default:
        width = '10%';
        break;
    }
    progressBar.style.width = width;
  }

  // Add functionality to the "Track Another" form
  const trackAnotherForm = document.getElementById('track-another-form');
  if(trackAnotherForm) {
    trackAnotherForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newTrackingId = e.target.querySelector('input').value;
      if (newTrackingId) {
        // Reload the page with the new tracking ID
        window.location.href = `track-result.html?id=${newTrackingId}`;
      }
    });
  }
});