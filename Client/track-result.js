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
      initializeMap(data);
    })
    .catch(error => {
      // This single .catch() block will now handle ALL errors
      showError(error.message);
    });

  let map;

  /**
    * Initializes the Leaflet map and displays the shipment route.
    * @param {object} packageData - The full package data object from the API.
    */
  async function initializeMap(packageData) {
    if (map) {
      map.remove(); // Remove previous map instance if it exists
    }

    // Default coordinates (e.g., center of the US) if no location is available
    const defaultCoords = [39.8283, -98.5795];
    map = L.map('map').setView(defaultCoords, 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    if (packageData && packageData.history && packageData.history.length > 0) {
      // Create an array of geocoding promises
      const geocodePromises = packageData.history.map(item => geocodeLocation(item.location));
      
      try {
        // Wait for all locations to be geocoded
        const coordinates = await Promise.all(geocodePromises);
        
        // Filter out any failed geocoding results (which return defaultCoords)
        const validCoordinates = coordinates.filter(coord => coord !== defaultCoords);

        if (validCoordinates.length > 1) {
          // Create a polyline to show the route
          const polyline = L.polyline(validCoordinates, { color: 'var(--clr-primary)' }).addTo(map);

          // Add markers for the start and end points
          const startMarker = L.marker(validCoordinates[0]).addTo(map)
            .bindPopup(`<b>Origin:</b><br>${packageData.history[0].location}`);
          const endMarker = L.marker(validCoordinates[validCoordinates.length - 1]).addTo(map)
            .bindPopup(`<b>Current Location:</b><br>${packageData.history[packageData.history.length - 1].location}`);

          // Fit the map to the bounds of the route
          map.fitBounds(polyline.getBounds());
        } else if (validCoordinates.length === 1) {
          // If only one point, just center on it
          map.setView(validCoordinates[0], 10);
           L.marker(validCoordinates[0]).addTo(map)
            .bindPopup(`<b>Location:</b><br>${packageData.history[0].location}`).openPopup();
        }

      } catch (error) {
        console.error("Error geocoding the path:", error);
        // Fallback to showing just the last known location if path fails
        const lastLocation = packageData.history[packageData.history.length - 1].location;
        const coords = await geocodeLocation(lastLocation);
        map.setView(coords, 10);
        L.marker(coords).addTo(map).bindPopup(`<b>Current Location:</b><br>${lastLocation}`).openPopup();
      }
    }
  }

  /**
    * Geocodes a location name using the free Nominatim API.
    * @param {string} locationName - The name of the location to geocode.
    * @returns {Promise<[number, number]>} A promise that resolves to [lat, lon].
    */
  async function geocodeLocation(locationName) {
    const defaultCoords = [39.8283, -98.5795]; // Center of US
    if (!locationName) return defaultCoords;

    const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Geocoding API returned status ${response.status}`);
      }
      const data = await response.json();

      if (data && data.length > 0) {
        // Return the coordinates of the first result
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      } else {
        // No results found
        console.warn(`Geocoding failed for: ${locationName}. No results found.`);
        return defaultCoords;
      }
    } catch (error) {
      console.error(`Error during geocoding for "${locationName}":`, error);
      return defaultCoords; // Return default on error
    }
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
    // Normalize status coming from server/admin (server uses kebab-case, lowercase)
    const s = (status || '').toString().trim().toLowerCase();
    let width = '10%'; // Default for 'pending' or unknown
    switch (s) {
      case 'in-transit':
        width = '40%';
        break;
      case 'on-hold':
        width = '50%';
        break;
      case 'out-for-delivery':
        width = '70%';
        break;
      case 'delivered':
        width = '100%';
        break;
      default:
        width = '10%';
        break;
    }
    if (progressBar) progressBar.style.width = width;
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