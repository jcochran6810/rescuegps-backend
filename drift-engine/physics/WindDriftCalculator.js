/**
 * WindDriftCalculator.js
 * Calculates particle drift due to direct wind forcing
 * Wind typically causes 2-4% drift in downwind direction
 */

class WindDriftCalculator {
  constructor() {
    this.windFactor = 0.03; // 3% of wind speed becomes drift
  }

  /**
   * Calculate wind-induced drift
   * @param {Object} wind - { speed (knots), direction (degrees) }
   * @param {Number} deltaHours - Time step in hours
   * @returns {Object} - { lat, lng } drift in degrees
   */
  calculate(wind, deltaHours) {
    const speedKnots = wind.speed;
    const directionRad = (wind.direction * Math.PI) / 180;
    
    // Calculate drift distance in kilometers
    const driftKm = speedKnots * this.windFactor * deltaHours * 1.852; // 1 knot = 1.852 km/h
    
    // Convert to lat/lng offsets
    // 1 degree latitude ≈ 111.32 km
    const latDrift = (driftKm * Math.cos(directionRad)) / 111.32;
    const lngDrift = (driftKm * Math.sin(directionRad)) / 111.32; // Simplified, not accounting for latitude
    
    return {
      lat: latDrift,
      lng: lngDrift
    };
  }

  /**
   * Set custom wind factor (for different conditions)
   */
  setWindFactor(factor) {
    this.windFactor = factor;
  }
}

module.exports = WindDriftCalculator;