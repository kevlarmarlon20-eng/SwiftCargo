/**
 * Coordinate Management Module
 * Handles validation, caching, and geocoding for real-time package tracking
 */

// Cache for frequently used location coordinates
const locationCoordinateCache = {
  'london': { lat: 51.5074, lng: -0.1278 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'shanghai': { lat: 31.2304, lng: 121.4737 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 },
  'frankfurt': { lat: 50.1109, lng: 8.6821 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'toronto': { lat: 43.6532, lng: -79.3832 },
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
};

/**
 * Validates coordinate object format
 * @param {Object} coords - Coordinate object with lat and lng properties
 * @returns {boolean} True if valid
 */
export function isValidCoordinate(coords) {
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
 * Gets cached coordinates for a location
 * @param {string} locationName - Location name to look up
 * @returns {Object|null} Coordinates object or null
 */
export function getCachedCoordinates(locationName) {
  if (!locationName || typeof locationName !== 'string') {
    return null;
  }

  const normalized = locationName.toLowerCase().trim();
  const cacheKey = Object.keys(locationCoordinateCache).find(
    key => normalized.includes(key) || key.includes(normalized)
  );

  return cacheKey ? locationCoordinateCache[cacheKey] : null;
}

/**
 * Adds coordinates to cache
 * @param {string} locationName - Location name
 * @param {Object} coords - Coordinate object with lat and lng
 */
export function cacheCoordinates(locationName, coords) {
  if (!locationName || !isValidCoordinate(coords)) {
    return false;
  }
  
  const key = locationName.toLowerCase().trim();
  locationCoordinateCache[key] = { ...coords };
  return true;
}

/**
 * Rate-limited geocoding request to Nominatim API
 * @param {string} query - Location query
 * @returns {Promise<Object|null>} Coordinates object or null
 */
async function fetchNominatimCoordinates(query) {
  if (!query || typeof query !== 'string') {
    return null;
  }

  try {
    const endpoint = `https://nominatim.openstreetmap.org/search`;
    const params = new URLSearchParams({
      format: 'json',
      q: query,
      limit: 1,
      addressdetails: 1,
    });

    const response = await fetch(`${endpoint}?${params}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SwiftCargo-Tracker/1.0',
      },
      timeout: 5000,
    });

    if (!response.ok) {
      console.warn(`Nominatim API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };
  } catch (error) {
    console.error(`Geocoding error for "${query}":`, error.message);
    return null;
  }
}

/**
 * Gets coordinates for a location with multiple fallback strategies
 * @param {string} locationName - Location name to geocode
 * @returns {Promise<Object|null>} Coordinates object or null
 */
export async function getCoordinates(locationName) {
  if (!locationName || typeof locationName !== 'string') {
    return null;
  }

  // Step 1: Check cache first
  const cached = getCachedCoordinates(locationName);
  if (cached) {
    return cached;
  }

  // Step 2: Try full location name via API
  let coords = await fetchNominatimCoordinates(locationName);
  if (coords && isValidCoordinate(coords)) {
    cacheCoordinates(locationName, coords);
    return coords;
  }

  // Step 3: Try first part (before comma) - common pattern for "City, Country"
  const parts = locationName.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    for (const part of parts) {
      if (part.length < 3) continue; // Skip very short tokens
      coords = await fetchNominatimCoordinates(part);
      if (coords && isValidCoordinate(coords)) {
        cacheCoordinates(locationName, coords);
        return coords;
      }
    }
  }

  // Step 4: Try first word
  const firstWord = locationName.split(/[\s,]+/)[0];
  if (firstWord && firstWord.length > 2) {
    coords = await fetchNominatimCoordinates(firstWord);
    if (coords && isValidCoordinate(coords)) {
      cacheCoordinates(locationName, coords);
      return coords;
    }
  }

  console.warn(`Unable to geocode location: ${locationName}`);
  return null;
}

/**
 * Batch geocodes multiple locations
 * @param {string[]} locations - Array of location names
 * @returns {Promise<Object>} Map of location names to coordinates
 */
export async function batchGetCoordinates(locations) {
  if (!Array.isArray(locations)) {
    return {};
  }

  const results = {};
  const uniqueLocations = [...new Set(locations.filter(Boolean))];

  for (const location of uniqueLocations) {
    // Rate limit: ~1 request per second for Nominatim compliance
    await new Promise(resolve => setTimeout(resolve, 100));
    const coords = await getCoordinates(location);
    if (coords) {
      results[location] = coords;
    }
  }

  return results;
}

/**
 * Converts coordinate format from [lat, lng] array to object
 * @param {number[]} arrayCoords - [lat, lng] format
 * @returns {Object|null} {lat, lng} format or null
 */
export function arrayToCoordinate(arrayCoords) {
  if (
    !Array.isArray(arrayCoords) ||
    arrayCoords.length !== 2 ||
    typeof arrayCoords[0] !== 'number' ||
    typeof arrayCoords[1] !== 'number'
  ) {
    return null;
  }

  return {
    lat: arrayCoords[0],
    lng: arrayCoords[1],
  };
}

/**
 * Converts coordinate format from object to [lat, lng] array
 * @param {Object} coords - {lat, lng} format
 * @returns {number[]|null} [lat, lng] format or null
 */
export function coordinateToArray(coords) {
  if (!isValidCoordinate(coords)) {
    return null;
  }

  return [coords.lat, coords.lng];
}

/**
 * Calculates distance between two coordinates in kilometers
 * Uses Haversine formula
 * @param {Object} from - Starting {lat, lng}
 * @param {Object} to - Ending {lat, lng}
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(from, to) {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
    return 0;
  }

  const R = 6371; // Earth's radius in km
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
