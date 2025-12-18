/**
 * CoordinateUtils.js
 * Utility functions for coordinate calculations
 * Distance, bearing, midpoints, and coordinate transformations
 */

class CoordinateUtils {
  /**
   * Convert degrees to radians
   */
  static toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  /**
   * Convert radians to degrees
   */
  static toDegrees(radians) {
    return radians * 180 / Math.PI;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {Number} lat1 - Latitude of point 1
   * @param {Number} lng1 - Longitude of point 1
   * @param {Number} lat2 - Latitude of point 2
   * @param {Number} lng2 - Longitude of point 2
   * @returns {Number} - Distance in kilometers
   */
  static distance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Calculate bearing between two points
   * @returns {Number} - Bearing in degrees (0-360)
   */
  static bearing(lat1, lng1, lat2, lng2) {
    const dLng = this.toRadians(lng2 - lng1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    const bearing = this.toDegrees(Math.atan2(y, x));
    
    // Normalize to 0-360
    return (bearing + 360) % 360;
  }

  /**
   * Calculate destination point given distance and bearing
   * @param {Number} lat - Starting latitude
   * @param {Number} lng - Starting longitude
   * @param {Number} distance - Distance in kilometers
   * @param {Number} bearing - Bearing in degrees
   * @returns {Object} - { lat, lng }
   */
  static destination(lat, lng, distance, bearing) {
    const R = 6371; // Earth radius in km
    const bearingRad = this.toRadians(bearing);
    const latRad = this.toRadians(lat);
    const lngRad = this.toRadians(lng);
    
    const lat2Rad = Math.asin(
      Math.sin(latRad) * Math.cos(distance / R) +
      Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad)
    );
    
    const lng2Rad = lngRad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad),
      Math.cos(distance / R) - Math.sin(latRad) * Math.sin(lat2Rad)
    );
    
    return {
      lat: this.toDegrees(lat2Rad),
      lng: this.toDegrees(lng2Rad)
    };
  }

  /**
   * Calculate midpoint between two coordinates
   */
  static midpoint(lat1, lng1, lat2, lng2) {
    const lat1Rad = this.toRadians(lat1);
    const lng1Rad = this.toRadians(lng1);
    const lat2Rad = this.toRadians(lat2);
    const dLng = this.toRadians(lng2 - lng1);
    
    const Bx = Math.cos(lat2Rad) * Math.cos(dLng);
    const By = Math.cos(lat2Rad) * Math.sin(dLng);
    
    const lat3Rad = Math.atan2(
      Math.sin(lat1Rad) + Math.sin(lat2Rad),
      Math.sqrt((Math.cos(lat1Rad) + Bx) * (Math.cos(lat1Rad) + Bx) + By * By)
    );
    
    const lng3Rad = lng1Rad + Math.atan2(By, Math.cos(lat1Rad) + Bx);
    
    return {
      lat: this.toDegrees(lat3Rad),
      lng: this.toDegrees(lng3Rad)
    };
  }

  /**
   * Calculate bounding box for a set of coordinates
   * @param {Array} coordinates - Array of {lat, lng} objects
   * @returns {Object} - { north, south, east, west }
   */
  static boundingBox(coordinates) {
    if (coordinates.length === 0) return null;
    
    const lats = coordinates.map(c => c.lat);
    const lngs = coordinates.map(c => c.lng);
    
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
  }

  /**
   * Check if point is within bounding box
   */
  static isInBounds(lat, lng, bounds) {
    return lat >= bounds.south && 
           lat <= bounds.north && 
           lng >= bounds.west && 
           lng <= bounds.east;
  }

  /**
   * Convert nautical miles to kilometers
   */
  static nmToKm(nm) {
    return nm * 1.852;
  }

  /**
   * Convert kilometers to nautical miles
   */
  static kmToNm(km) {
    return km / 1.852;
  }

  /**
   * Convert knots to km/h
   */
  static knotsToKmh(knots) {
    return knots * 1.852;
  }

  /**
   * Convert km/h to knots
   */
  static kmhToKnots(kmh) {
    return kmh / 1.852;
  }

  /**
   * Format coordinates for display
   */
  static formatCoordinate(lat, lng, precision = 6) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    
    return `${Math.abs(lat).toFixed(precision)}°${latDir}, ${Math.abs(lng).toFixed(precision)}°${lngDir}`;
  }

  /**
   * Parse coordinate string to decimal degrees
   * Supports: "40.7128° N, 74.0060° W" or "40.7128, -74.0060"
   */
  static parseCoordinate(coordString) {
    // Remove degree symbols and extra spaces
    const clean = coordString.replace(/°/g, '').trim();
    
    // Try decimal format first
    const decimalMatch = clean.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
    if (decimalMatch) {
      return {
        lat: parseFloat(decimalMatch[1]),
        lng: parseFloat(decimalMatch[2])
      };
    }
    
    // Try DMS format: 40°42'46"N, 74°0'21"W
    const dmsMatch = clean.match(/(\d+)[°\s]+(\d+)['\s]+(\d+\.?\d*)["'\s]*([NS])[,\s]+(\d+)[°\s]+(\d+)['\s]+(\d+\.?\d*)["'\s]*([EW])/i);
    if (dmsMatch) {
      const lat = parseFloat(dmsMatch[1]) + parseFloat(dmsMatch[2])/60 + parseFloat(dmsMatch[3])/3600;
      const lng = parseFloat(dmsMatch[5]) + parseFloat(dmsMatch[6])/60 + parseFloat(dmsMatch[7])/3600;
      
      return {
        lat: dmsMatch[4].toUpperCase() === 'S' ? -lat : lat,
        lng: dmsMatch[8].toUpperCase() === 'W' ? -lng : lng
      };
    }
    
    return null;
  }
}

module.exports = CoordinateUtils;