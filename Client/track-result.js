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

      // 2. Populate Sender/Receiver
      receiverName.textContent = sanitizeHTML(data.receiver?.name || 'N/A');
      receiverAddress.textContent = sanitizeHTML(data.receiver?.address || 'N/A');
      receiverEmail.textContent = sanitizeHTML(data.receiver?.email || 'N/A');
      receiverPhone.textContent = sanitizeHTML(data.receiver?.phone || 'N/A');
      senderName.textContent = sanitizeHTML(data.sender?.name || 'N/A');
      senderAddress.textContent = sanitizeHTML(data.sender?.address || 'N/A');
      senderEmail.textContent = sanitizeHTML(data.sender?.email || 'N/A');
      senderPhone.textContent = sanitizeHTML(data.sender?.phone || 'N/A');

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
      // Geocode each history item, but allow individual failures
      const settleResults = await Promise.allSettled(
        packageData.history.map(item => geocodeLocation(item.location))
      );

      // Pair history entries with coords (or null)
      const paired = packageData.history.map((item, idx) => ({
        item,
        coord: settleResults[idx].status === 'fulfilled' ? settleResults[idx].value : null
      }));

      // Filter only entries with coordinates
      const validEntries = paired.filter(p => p.coord && Array.isArray(p.coord));

      // Resolve polyline color from CSS variable
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--clr-primary').trim() || '#007bff';

      if (validEntries.length > 1) {
        const coords = validEntries.map(v => v.coord);
        const polyline = L.polyline(coords, { color: primaryColor }).addTo(map);

        // Add markers with correct paired popups
        validEntries.forEach((v, i) => {
          const label = i === 0 ? `<b>Origin:</b><br>${sanitizeHTML(v.item.location)}` : (i === validEntries.length - 1 ? `<b>Current Location:</b><br>${sanitizeHTML(v.item.location)}` : sanitizeHTML(v.item.location));
          L.marker(v.coord).addTo(map).bindPopup(label);
        });

        map.fitBounds(polyline.getBounds());
      } else if (validEntries.length === 1) {
        map.setView(validEntries[0].coord, 10);
        L.marker(validEntries[0].coord).addTo(map).bindPopup(`<b>Location:</b><br>${sanitizeHTML(validEntries[0].item.location)}`).openPopup();
      } else {
        // No geocoded points: try cache for last known or fallback to default
        const last = packageData.history[packageData.history.length - 1];
        const normalized = last.location.toLowerCase();
        const cacheKey = Object.keys(locationCache).find(k => normalized.includes(k) || k.includes(normalized));
        if (cacheKey) {
          const coords = locationCache[cacheKey];
          map.setView(coords, 6);
          L.marker(coords).addTo(map).bindPopup(`<b>Approx Location:</b><br>${sanitizeHTML(last.location)}`).openPopup();
        } else {
          // Final fallback center
          map.setView(defaultCoords, 3);
        }
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

    // Step 1: Try the full location name first (best fidelity)
    let coords = await tryGeocoding(locationName);
    if (coords) return coords;

    // Step 2: Check cache for common city names (partial match)
    // Keep cacheKey for fallback but do not log until used
    const cacheKey = Object.keys(locationCache).find(key => normalizedName.includes(key) || key.includes(normalizedName));

    // Step 3: Try the first comma-separated part (commonly the city)
    const parts = locationName.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const firstPart = parts[0];
      coords = await tryGeocoding(firstPart, locationName);
      if (coords) return coords;
    }

    // Step 4: Try left-to-right parts (useful when address lists street, city, region, country)
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      // skip short tokens and likely postal codes
      if (!part || part.length < 3 || /\d/.test(part)) continue;
      coords = await tryGeocoding(part, locationName);
      if (coords) return coords;
    }

    // Step 5: Try the first word as a last attempt (handles simple typos)
    const firstWord = locationName.split(/[\s,]+/)[0];
    if (firstWord && firstWord !== locationName) {
      coords = await tryGeocoding(firstWord, locationName);
      if (coords) return coords;
    }

    // Step 6: If cacheKey exists, use cached coords as a fallback
    if (cacheKey) {
      return locationCache[cacheKey];
    }

    // Step 7: If all else fails, return null so caller can handle fallback
    console.warn(`Geocoding failed for: ${locationName}. No coordinates found.`);
    return null;
  }

  /**
    * Helper function to attempt geocoding with Nominatim API.
    * @param {string} query - The location query string.
    * @returns {Promise<[number, number]|null>} Coordinates if found, null otherwise.
    */
  async function tryGeocoding(query) {
    if (!query) return null;

    const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) return null;

      const data = await response.json();
      if (data && data.length > 0) {
        // If an originalName was provided, try to pick the best candidate
        if (originalName) {
          const on = originalName.toLowerCase();
          // Prefer a candidate whose display_name contains tokens from originalName (e.g., country)
          const tokens = on.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);

          // Rank candidates: +1 for matching token in display_name, +1 for place-type (city/town/village), higher importance
          let best = null;
          let bestScore = -Infinity;

          data.forEach(d => {
            let score = 0;
            const name = (d.display_name || '').toLowerCase();
            tokens.forEach(tok => {
              if (tok.length > 2 && name.includes(tok)) score += 2;
            });
            if (d.type && ['city','town','village','municipality','hamlet'].includes(d.type)) score += 1;
            if (d.importance) score += parseFloat(d.importance);
            if (score > bestScore) {
              bestScore = score;
              best = d;
            }
          });

          const chosen = best || data[0];
          const result = [parseFloat(chosen.lat), parseFloat(chosen.lon)];
          console.log(`Geocoding success for "${query}" (chosen):`, result, 'from', data.map(x=>x.display_name));
          return result;
        }

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