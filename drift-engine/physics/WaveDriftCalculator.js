/**
 * WaveDriftCalculator.js
 * Calculates Stokes drift - particle transport in the direction of wave propagation
 * Waves cause net forward motion even in deep water
 */

class WaveDriftCalculator {
  constructor() {
    this.stokesFactor = 0.01; // Wave-induced drift factor
  }

  /**
   * Calculate wave-induced drift (Stokes drift)
   * @param {Object} waves - { height (m), period (s), direction (degrees) }
   * @param {Number} deltaHours - Time step in hours
   * @returns {Object} - { lat, lng } drift in degrees
   */
  calculate(waves, deltaHours) {
    const waveHeight = waves.height;
    const wavePeriod = waves.period;
    
    // Stokes drift is proportional to wave height squared
    // and inversely proportional to period
    const driftSpeed = (waveHeight * waveHeight) / wavePeriod * this.stokesFactor;
    
    // Direction includes some randomness to simulate wave spreading
    const baseDirection = waves.direction || Math.random() * 360;
    const directionVariation = (Math.random() - 0.5) * 30; // +/- 15 degrees
    const directionRad = ((baseDirection + directionVariation) * Math.PI) / 180;
    
    // Calculate drift distance
    const driftKm = driftSpeed * deltaHours;
    
    // Convert to lat/lng offsets
    const latDrift = (driftKm * Math.cos(directionRad)) / 111.32;
    const lngDrift = (driftKm * Math.sin(directionRad)) / 111.32;
    
    return {
      lat: latDrift,
      lng: lngDrift
    };
  }

  /**
   * Calculate wave-induced drift for specific wave conditions
   */
  calculateStokes(waveHeight, wavelength, depth, deltaHours) {
    // Deep water Stokes drift formula
    const k = (2 * Math.PI) / wavelength; // Wave number
    const omega = Math.sqrt(9.81 * k); // Angular frequency (deep water)
    
    // Stokes drift velocity at surface
    const stokesDrift = (waveHeight * waveHeight * omega * k) / 2;
    
    const driftKm = stokesDrift * deltaHours * 3.6; // m/s to km/h
    
    return driftKm;
  }
}

module.exports = WaveDriftCalculator;