/**
 * LeewayCalculator.js
 * Calculates object-specific leeway drift
 * Different objects have different windage and drift characteristics
 * Based on USCG and IAMSAR leeway coefficients
 */

class LeewayCalculator {
  constructor(objectType) {
    this.objectType = objectType;
    
    // Leeway coefficients from USCG SAR studies
    // Format: { downwind: speed factor, crosswind: angle offset }
    this.leewayFactors = {
      'person-in-water': { downwind: 0.03, crosswind: 15 },
      'person-with-pfd': { downwind: 0.04, crosswind: 20 },
      'person-in-drysuit': { downwind: 0.05, crosswind: 25 },
      'life-raft-4': { downwind: 0.06, crosswind: 10 },
      'life-raft-6': { downwind: 0.065, crosswind: 12 },
      'life-raft-10-plus': { downwind: 0.07, crosswind: 15 },
      'small-vessel': { downwind: 0.05, crosswind: 5 },
      'medium-vessel': { downwind: 0.04, crosswind: 3 },
      'sailboat': { downwind: 0.08, crosswind: 20 },
      'kayak': { downwind: 0.045, crosswind: 18 },
      'canoe': { downwind: 0.05, crosswind: 20 },
      'surfboard': { downwind: 0.035, crosswind: 25 },
      'paddleboard': { downwind: 0.04, crosswind: 22 },
      'wood-debris': { downwind: 0.02, crosswind: 30 },
      'plastic-debris': { downwind: 0.045, crosswind: 25 },
      'cooler': { downwind: 0.055, crosswind: 15 }
    };
  }

  /**
   * Calculate leeway drift
   * @param {Object} wind - { speed (knots), direction (degrees) }
   * @param {Number} deltaHours - Time step in hours
   * @returns {Object} - { lat, lng } drift in degrees
   */
  calculate(wind, deltaHours) {
    const factor = this.leewayFactors[this.objectType] || this.leewayFactors['person-in-water'];
    
    const speedKnots = wind.speed * factor.downwind;
    
    // Leeway direction is wind direction plus crosswind angle
    const leewayDirection = wind.direction + factor.crosswind;
    const directionRad = (leewayDirection * Math.PI) / 180;
    
    // Calculate drift distance
    const driftKm = speedKnots * deltaHours * 1.852;
    
    // Convert to lat/lng offsets
    const latDrift = (driftKm * Math.cos(directionRad)) / 111.32;
    const lngDrift = (driftKm * Math.sin(directionRad)) / 111.32;
    
    return {
      lat: latDrift,
      lng: lngDrift
    };
  }

  /**
   * Get leeway parameters for current object type
   */
  getLeewayParams() {
    return this.leewayFactors[this.objectType] || this.leewayFactors['person-in-water'];
  }

  /**
   * Update object type
   */
  setObjectType(newType) {
    this.objectType = newType;
  }
}

module.exports = LeewayCalculator;