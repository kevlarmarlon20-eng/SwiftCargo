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
    * Predefined cache of common shipping hub locations (fallback for bad geocoding).
    * Used as last resort if Nominatim fails.
    */
  const locationCache = {
    'london': [51.5074, -0.1278],
    'paris': [48.8566, 2.3522],
    'new york': [40.7128, -74.0060],
    'tokyo': [35.6762, 139.6503],
    'singapore': [1.3521, 103.8198],
    'dubai': [25.2048, 55.2708],
    'shanghai': [31.2304, 121.4737],
    'hong kong': [22.3193, 114.1694],
    'amsterdam': [52.3676, 4.9041],
    'frankfurt': [50.1109, 8.6821],
    'los angeles': [34.0522, -118.2437],
    'chicago': [41.8781, -87.6298],
    'toronto': [43.6532, -79.3832],
    'sydney': [33.8688, 151.2093],
    'mumbai': [19.0760, 72.8777],
    'bangkok': [13.7563, 100.5018],
  };

  /**
    * Geocodes a location name using the free Nominatim API with fallback strategies.
    * @param {string} locationName - The name of the location to geocode.
    * @returns {Promise<[number, number]>} A promise that resolves to [lat, lon].
    */
  async function geocodeLocation(locationName) {
    const defaultCoords = [39.8283, -98.5795]; // Center of US
    if (!locationName) return defaultCoords;

    // Normalize the location name for cache lookup
    const normalizedName = locationName.toLowerCase().trim();

    // Step 1: Check cache first for exact or partial matches
    const cacheKey = Object.keys(locationCache).find(key => 
      normalizedName.includes(key) || key.includes(normalizedName)
    );
    if (cacheKey) {
      console.log(`Found location in cache: ${cacheKey} for "${locationName}"`);
      return locationCache[cacheKey];
    }

    // Step 2: Try the full location name
    let coords = await tryGeocoding(locationName);
    if (coords) return coords;

    // Step 3: Extract city (last comma-separated segment or last word)
    const parts = locationName.split(',').map(p => p.trim());
    if (parts.length > 1) {
      const city = parts[parts.length - 1]; // Last part (usually city)
      coords = await tryGeocoding(city);
      if (coords) return coords;

      // Also try second-to-last part (country)
      if (parts.length > 2) {
        const country = parts[parts.length - 2];
        coords = await tryGeocoding(country);
        if (coords) return coords;
      }
    }

    // Step 4: Try just the first word (in case of typos)
    const firstWord = locationName.split(/[\s,]+/)[0];
    if (firstWord && firstWord !== locationName) {
      coords = await tryGeocoding(firstWord);
      if (coords) return coords;
    }

    // Step 5: If all else fails, return default
    console.warn(`Geocoding failed for: ${locationName}. Using default center.`);
    return defaultCoords;
  }

  /**
    * Helper function to attempt geocoding with Nominatim API.
    * @param {string} query - The location query string.
    * @returns {Promise<[number, number]|null>} Coordinates if found, null otherwise.
    */
  async function tryGeocoding(query) {
    if (!query) return null;

    const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) return null;

      const data = await response.json();
      if (data && data.length > 0) {
        const result = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        console.log(`Geocoding success for "${query}":`, result);
        return result;
      }
      return null;
    } catch (error) {
      console.error(`Geocoding error for "${query}":`, error);
      return null;
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