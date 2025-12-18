/**
 * CurrentDriftCalculator.js
 * Calculates particle drift due to ocean/water currents
 * Currents are the primary drift force in most marine SAR scenarios
 */

class CurrentDriftCalculator {
  constructor() {
    this.currentFactor = 1.0; // Currents directly move objects at their speed
  }

  /**
   * Calculate current-induced drift
   * @param {Object} current - { speed (knots), direction (degrees) }
   * @param {Number} deltaHours - Time step in hours
   * @returns {Object} - { lat, lng } drift in degrees
   */
  calculate(current, deltaHours) {
    const speedKnots = current.speed * this.currentFactor;
    const directionRad = (current.direction * Math.PI) / 180;
    
    // Calculate drift distance in kilometers
    // 1 knot = 1.852 km/h
    const driftKm = speedKnots * deltaHours * 1.852;
    
    // Convert to lat/lng offsets
    // 1 degree latitude â‰ˆ 111.32 km
    const latDrift = (driftKm * Math.cos(directionRad)) / 111.32;
    const lngDrift = (driftKm * Math.sin(directionRad)) / 111.32;
    
    return {
      lat: latDrift,
      lng: lngDrift
    };
  }

  /**
   * Calculate tidal current component
   * @param {Object} tidal - { phase, amplitude, direction }
   * @param {Number} time - Current simulation time in seconds
   * @param {Number} deltaHours - Time step in hours
   * @returns {Object} - { lat, lng } drift in degrees
   */
  calculateTidal(tidal, time, deltaHours) {
    // Tidal cycle is approximately 12.42 hours (44712 seconds)
    const tidalPeriod = 44712;
    const phase = (time % tidalPeriod) / tidalPeriod * 2 * Math.PI;
    
    // Current speed varies sinusoidally with tide
    const speedKnots = tidal.amplitude * Math.sin(phase + (tidal.phase || 0));
    const directionRad = (tidal.direction * Math.PI) / 180;
    
    // Reverse direction on ebb tide
    const adjustedDirection = speedKnots < 0 ? directionRad + Math.PI : directionRad;
    const adjustedSpeed = Math.abs(speedKnots);
    
    const driftKm = adjustedSpeed * deltaHours * 1.852;
    
    const latDrift = (driftKm * Math.cos(adjustedDirection)) / 111.32;
    const lngDrift = (driftKm * Math.sin(adjustedDirection)) / 111.32;
    
    return {
      lat: latDrift,
      lng: lngDrift
    };
  }

  /**
   * Calculate depth-averaged current
   * Surface currents are typically stronger than depth-averaged
   * @param {Object} surfaceCurrent - { speed, direction }
   * @param {Number} depth - Object draft in meters
   * @returns {Object} - Adjusted current { speed, direction }
   */
  depthAdjust(surfaceCurrent, depth) {
    // Exponential decay with depth (Ekman spiral approximation)
    const depthFactor = Math.exp(-depth / 50); // 50m e-folding depth
    
    return {
      speed: surfaceCurrent.speed * depthFactor,
      direction: surfaceCurrent.direction + (depth * 0.5) // Slight rotation with depth
    };
  }

  /**
   * Set custom current factor
   */
  setCurrentFactor(factor) {
    this.currentFactor = factor;
  }
}

module.exports = CurrentDriftCalculator;