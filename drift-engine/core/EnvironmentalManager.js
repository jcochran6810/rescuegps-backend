/**
 * EnvironmentalManager.js
 * Manages environmental conditions (wind, currents, waves, temperature)
 * Provides spatially and temporally varying environmental data
 */

class EnvironmentalManager {
  constructor(lkp) {
    this.lkp = lkp;
    this.conditions = this.generateConditions();
  }

  /**
   * Generate realistic environmental conditions
   * In production, this would fetch from NOAA/weather APIs
   */
  generateConditions() {
    return {
      wind: {
        speed: 10 + Math.random() * 15, // knots (10-25)
        direction: Math.random() * 360, // degrees true
        gusts: 15 + Math.random() * 20 // knots
      },
      current: {
        speed: 0.5 + Math.random() * 1.5, // knots (0.5-2.0)
        direction: Math.random() * 360, // degrees true
        variation: 0.2 // +/- variation
      },
      waves: {
        height: 1 + Math.random() * 3, // meters (1-4)
        period: 4 + Math.random() * 6, // seconds (4-10)
        direction: Math.random() * 360
      },
      waterTemp: 60 + Math.random() * 20, // °F (60-80)
      airTemp: 65 + Math.random() * 20, // °F (65-85)
      visibility: 5 + Math.random() * 10, // nautical miles
      seaState: this.calculateSeaState(1 + Math.random() * 3)
    };
  }

  /**
   * Get environmental conditions at specific location and time
   * Adds spatial variation for realism
   */
  getConditionsAt(lat, lng, time) {
    // Add small spatial variations
    const spatialVariation = {
      wind: {
        speed: this.conditions.wind.speed + (Math.random() - 0.5) * 2,
        direction: this.conditions.wind.direction + (Math.random() - 0.5) * 10
      },
      current: {
        speed: this.conditions.current.speed + (Math.random() - 0.5) * 0.2,
        direction: this.conditions.current.direction + (Math.random() - 0.5) * 15
      },
      waves: this.conditions.waves,
      waterTemp: this.conditions.waterTemp,
      airTemp: this.conditions.airTemp
    };

    return spatialVariation;
  }

  /**
   * Update environmental conditions over time
   * Simulates changing weather patterns
   */
  updateConditions(time) {
    // Gradually change wind direction (weather systems moving)
    this.conditions.wind.direction += (Math.random() - 0.5) * 10;
    if (this.conditions.wind.direction < 0) this.conditions.wind.direction += 360;
    if (this.conditions.wind.direction >= 360) this.conditions.wind.direction -= 360;

    // Vary wind speed slightly
    this.conditions.wind.speed += (Math.random() - 0.5) * 2;
    this.conditions.wind.speed = Math.max(0, Math.min(40, this.conditions.wind.speed));

    // Current direction changes more slowly
    this.conditions.current.direction += (Math.random() - 0.5) * 5;
    if (this.conditions.current.direction < 0) this.conditions.current.direction += 360;
    if (this.conditions.current.direction >= 360) this.conditions.current.direction -= 360;
  }

  /**
   * Calculate sea state from wave height (Douglas Sea Scale)
   */
  calculateSeaState(waveHeight) {
    if (waveHeight < 0.1) return 0; // Calm
    if (waveHeight < 0.5) return 1; // Smooth
    if (waveHeight < 1.25) return 2; // Slight
    if (waveHeight < 2.5) return 3; // Moderate
    if (waveHeight < 4) return 4; // Rough
    if (waveHeight < 6) return 5; // Very Rough
    if (waveHeight < 9) return 6; // High
    if (waveHeight < 14) return 7; // Very High
    return 8; // Phenomenal
  }
}

module.exports = EnvironmentalManager;