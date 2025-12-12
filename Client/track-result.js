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

  // Receiver & Sender details - these elements are not currently in track-result.html, but were in the template
  // const receiverName = document.getElementById('receiver-name');
  // const receiverAddress = document.getElementById('receiver-address');
  // const receiverEmail = document.getElementById('receiver-email');
  // const receiverPhone = document.getElementById('receiver-phone');
  // const senderName = document.getElementById('sender-name');
  // const senderAddress = document.getElementById('sender-address');
  // const senderEmail = document.getElementById('sender-email');
  // const senderPhone = document.getElementById('sender-phone');

  function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }

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

      // Store package data for real-time updates
      window.__packageData = data;

      // --- Data received successfully, now fill in the page ---

      // 1. Populate Summary Box
      trackingDisplay.textContent = sanitizeHTML(data.trackingNumber);
      statusDisplay.textContent = data.status ? `${capitalize(sanitizeHTML(data.status))} in ${sanitizeHTML(data.location)}` : 'N/A';

      if (data.shipmentInfo && data.shipmentInfo.eta) {
        const etaDate = new Date(data.shipmentInfo.eta).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
        deliveryDateDisplay.textContent = sanitizeHTML(etaDate);
      } else {
        deliveryDateDisplay.textContent = 'N/A';
      }

      // 2. Populate Sender/Receiver - (These elements are commented out in HTML, so this part remains commented)
      // SENDER AND RECEIVER INFO REMOVED FOR SECURITY

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
  let updateInterval;
  let updateAttempts = 0;
  const MAX_UPDATE_ATTEMPTS = 10;
  const REAL_TIME_UPDATE_INTERVAL = 5000; // 5 seconds

  /**
   * Map layer objects for real-time updates
   */
  const mapLayers = {
    markers: [],
    polyline: null,
    updateIndicator: null,
  };

  /**
   * Initializes the Leaflet map and displays the shipment route.
   * @param {object} packageData - The full package data object from the API.
   */
  async function initializeMap(packageData) {
    if (map) {
      map.remove();
      clearInterval(updateInterval);
    }

    // Default coordinates (e.g., center of the US) if no location is available
    const defaultCoords = [39.8283, -98.5795];
    map = L.map('map').setView(defaultCoords, 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Render the map with current data
    await renderMapRoute(packageData);

    // Start real-time updates if we have a tracking number
    if (trackingNumber) {
      startRealTimeUpdates(trackingNumber);
    }
  }

  /**
   * Renders the shipping route on the map with coordinates
   * @param {object} packageData - Package data with coordinates
   */
  async function renderMapRoute(packageData) {
    // Clear existing markers and polylines
    mapLayers.markers.forEach(marker => map.removeLayer(marker));
    mapLayers.markers = [];
    if (mapLayers.polyline) {
      map.removeLayer(mapLayers.polyline);
      mapLayers.polyline = null;
    }

    if (!packageData || !packageData.history || packageData.history.length === 0) {
      // Show default view if no data
      map.setView([39.8283, -98.5795], 3);
      return;
    }

    // Extract coordinates from history
    const routePoints = packageData.history
      .filter(item => item.coordinates && isValidCoordinates(item.coordinates))
      .map(item => [item.coordinates.lat, item.coordinates.lng]);

    // Add current location if it has coordinates
    if (packageData.coordinates && isValidCoordinates(packageData.coordinates)) {
      routePoints.push([packageData.coordinates.lat, packageData.coordinates.lng]);
    }

    if (routePoints.length === 0) {
      // No valid coordinates, show default
      map.setView([39.8283, -98.5795], 3);
      return;
    }

    // Get primary color from CSS
    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--clr-primary')
      .trim() || '#007bff';

    // Draw polyline for the route
    if (routePoints.length > 1) {
      mapLayers.polyline = L.polyline(routePoints, {
        color: primaryColor,
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 5',
      }).addTo(map);
    }

    // Define custom icons
    const originIcon = createCustomIcon('#28a745'); // Green
    const currentIcon = createCustomIcon('#dc3545'); // Red (active)
    const intermediateIcon = createCustomIcon(primaryColor);

    // Add markers for each history point
    packageData.history.forEach((item, index) => {
      if (!item.coordinates || !isValidCoordinates(item.coordinates)) {
        return;
      }

      const coord = [item.coordinates.lat, item.coordinates.lng];
      let icon = intermediateIcon;
      let popupContent = sanitizeHTML(item.location);

      if (index === 0) {
        icon = originIcon;
        popupContent = `<b style="color: #28a745;">📦 Origin</b><br>${sanitizeHTML(item.location)}`;
      } else if (index === packageData.history.length - 1) {
        icon = currentIcon;
        popupContent = `<b style="color: #dc3545;">📍 Current Location</b><br>${sanitizeHTML(item.location)}`;
      } else {
        popupContent = `<b>✓ Stop</b><br>${sanitizeHTML(item.location)}`;
      }

      const marker = L.marker(coord, { icon })
        .addTo(map)
        .bindPopup(popupContent, { maxWidth: 250 });

      // Open popup for current location
      if (index === packageData.history.length - 1) {
        marker.openPopup();
      }

      mapLayers.markers.push(marker);
    });

    // Fit map bounds to show entire route
    if (mapLayers.polyline) {
      map.fitBounds(mapLayers.polyline.getBounds(), { padding: [50, 50] });
    } else if (mapLayers.markers.length > 0) {
      const bounds = L.featureGroup(mapLayers.markers).getBounds();
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  /**
   * Creates a custom marker icon with a specified color
   * @param {string} color - Hex color code
   * @returns {Object} Leaflet icon object
   */
  function createCustomIcon(color) {
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="41" viewBox="0 0 32 41">
        <defs>
          <style>
            .marker-fill { fill: ${color}; }
            .marker-stroke { stroke: white; stroke-width: 2; }
          </style>
        </defs>
        <path class="marker-fill marker-stroke" d="M16,1 C9,1 3,7 3,14 C3,22 16,39 16,39 C16,39 29,22 29,14 C29,7 23,1 16,1 Z" />
        <circle cx="16" cy="14" r="4" fill="white" />
      </svg>
    `;

    return L.icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
      iconSize: [32, 41],
      iconAnchor: [16, 41],
      popupAnchor: [0, -35],
    });
  }

  /**
   * Validates coordinate object
   * @param {object} coords - Coordinate object with lat and lng
   * @returns {boolean} True if valid
   */
  function isValidCoordinates(coords) {
    return (
      coords &&
      typeof coords === 'object' &&
      typeof coords.lat === 'number' &&
      typeof coords.lng === 'number' &&
      coords.lat >= -90 &&
      coords.lat <= 90 &&
      coords.lng >= -180 &&
      coords.lng <= 180
    );
  }

  /**
   * Starts polling for real-time updates to the package location
   * @param {string} trackingNum - The tracking number
   */
  function startRealTimeUpdates(trackingNum) {
    updateAttempts = 0;

    updateInterval = setInterval(async () => {
      if (updateAttempts >= MAX_UPDATE_ATTEMPTS) {
        console.log('Max update attempts reached. Stopping real-time updates.');
        clearInterval(updateInterval);
        return;
      }

      try {
        updateAttempts++;
        const response = await fetch(`/track/${trackingNum}`);

        if (!response.ok) {
          console.warn(`Real-time update failed: ${response.status}`);
          return;
        }

        const updatedData = await response.json();

        // Check if location has changed
        if (hasLocationChanged(updatedData)) {
          console.log('Package location updated. Refreshing map...');
          await renderMapRoute(updatedData);
          updateAttempts = 0; // Reset attempts on successful update
        }
      } catch (error) {
        console.error('Error fetching real-time update:', error);
      }
    }, REAL_TIME_UPDATE_INTERVAL);
  }

  /**
   * Checks if the package location has changed
   * @param {object} newData - Updated package data
   * @returns {boolean} True if location changed
   */
  function hasLocationChanged(newData) {
    const currentData = window.__packageData || {};
    if (!currentData.history || currentData.history.length !== newData.history.length) {
      return true;
    }

    const currentLast = currentData.history[currentData.history.length - 1];
    const newLast = newData.history[newData.history.length - 1];

    return currentLast?.location !== newLast?.location;
  }

  /**
   * Shows an error message and hides the main content
   */
  function showError(message) {
    resultsContainer.classList.add('hidden');
    trackingAlert.classList.remove('hidden');
    trackingAlert.classList.add('alert-error'); // Add the error class
    alertMessage.textContent = sanitizeHTML(message) || 'An unknown error occurred.';
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
        <div class="timeline-status">${capitalize(sanitizeHTML(item.status))}</div>
        
        <div class="timeline-description">
          ${sanitizeHTML(item.description)}
        </div>
        
        <div class="timeline-date">
          ${new Date(item.timestamp).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          (at ${sanitizeHTML(item.location)})
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
