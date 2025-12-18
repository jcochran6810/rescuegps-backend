/**
 * SurvivalAnalyzer.js
 * Analyzes victim survival probability based on environmental conditions
 * Factors: water temperature, time in water, age, PFD, clothing
 */

class SurvivalAnalyzer {
  /**
   * Analyze survival probability
   * @param {Object} victimProfile - { age, gender, hasPFD, clothing }
   * @param {Object} environmentalConditions - { waterTemp, airTemp, seaState }
   * @param {Number} elapsedHours - Time since incident
   * @returns {Object} - { probability, timeRemaining, urgency, factors }
   */
  analyze(victimProfile, environmentalConditions, elapsedHours) {
    const baseRate = this.getBaseSurvivalRate(victimProfile);
    const tempFactor = this.getTemperatureFactor(environmentalConditions.waterTemp);
    const timeFactor = this.getTimeFactor(elapsedHours);
    const pfdBonus = victimProfile.hasPFD ? 0.2 : 0;
    const clothingBonus = this.getClothingFactor(victimProfile.clothing || 'light');

    // Calculate overall survival probability
    const survivalProbability = Math.max(0, Math.min(1, 
      baseRate * tempFactor * timeFactor + pfdBonus + clothingBonus
    ));

    // Estimate time remaining until critical
    const timeRemaining = this.estimateTimeRemaining(
      survivalProbability,
      environmentalConditions.waterTemp
    );

    // Determine urgency level
    let urgency;
    if (survivalProbability < 0.3) urgency = 'critical';
    else if (survivalProbability < 0.5) urgency = 'urgent';
    else if (survivalProbability < 0.75) urgency = 'high';
    else urgency = 'moderate';

    return {
      probability: survivalProbability,
      timeRemaining,
      urgency,
      factors: {
        baseRate,
        temperature: tempFactor,
        time: timeFactor,
        pfd: pfdBonus,
        clothing: clothingBonus
      },
      recommendations: this.getRecommendations(survivalProbability, environmentalConditions)
    };
  }

  /**
   * Base survival rate by age and fitness
   */
  getBaseSurvivalRate(profile) {
    const age = profile.age || 40;
    
    if (age < 18) return 0.85; // Young, generally fit
    if (age < 30) return 0.90; // Peak physical condition
    if (age < 50) return 0.88; // Good condition
    if (age < 65) return 0.80; // Reduced stamina
    return 0.70; // Elderly, reduced capabilities
  }

  /**
   * Temperature factor (water temperature impact)
   * Based on cold water immersion survival data
   */
  getTemperatureFactor(waterTemp) {
    if (waterTemp > 80) return 1.0;   // Warm water - hypothermia not a factor
    if (waterTemp > 70) return 0.95;  // Mild water - slow hypothermia
    if (waterTemp > 60) return 0.85;  // Cool water - moderate hypothermia risk
    if (waterTemp > 50) return 0.65;  // Cold water - significant hypothermia risk
    if (waterTemp > 40) return 0.40;  // Very cold - severe hypothermia risk
    return 0.20; // Extreme cold - critical hypothermia risk
  }

  /**
   * Time factor (survival decreases with time)
   */
  getTimeFactor(hours) {
    if (hours < 1) return 1.0;   // First hour - highest survival
    if (hours < 3) return 0.95;  // 1-3 hours - still strong
    if (hours < 6) return 0.85;  // 3-6 hours - fatigue setting in
    if (hours < 12) return 0.70; // 6-12 hours - serious fatigue
    if (hours < 24) return 0.50; // 12-24 hours - critical
    return 0.30; // 24+ hours - very low
  }

  /**
   * Clothing insulation factor
   */
  getClothingFactor(clothing) {
    const factors = {
      'none': -0.1,
      'light': 0,
      'normal': 0.05,
      'heavy': 0.1,
      'wetsuit': 0.2,
      'drysuit': 0.3
    };
    
    return factors[clothing] || 0;
  }

  /**
   * Estimate time remaining until critical condition
   */
  estimateTimeRemaining(probability, waterTemp) {
    // Base survival times by water temperature (hours)
    let baseTime;
    if (waterTemp > 80) baseTime = 48;
    else if (waterTemp > 70) baseTime = 24;
    else if (waterTemp > 60) baseTime = 12;
    else if (waterTemp > 50) baseTime = 6;
    else if (waterTemp > 40) baseTime = 3;
    else baseTime = 1.5;

    // Adjust by current probability
    return baseTime * probability;
  }

  /**
   * Get search recommendations based on analysis
   */
  getRecommendations(probability, conditions) {
    const recommendations = [];

    if (probability < 0.5) {
      recommendations.push('URGENT: Deploy all available assets immediately');
      recommendations.push('Prioritize high-density search areas');
    }

    if (conditions.waterTemp < 60) {
      recommendations.push('Cold water: Hypothermia risk - time is critical');
      recommendations.push('Prepare medical support for hypothermia treatment');
    }

    if (conditions.seaState > 4) {
      recommendations.push('Rough seas: Victim may be difficult to spot visually');
      recommendations.push('Consider aerial search assets');
    }

    return recommendations;
  }

  /**
   * Calculate hypothermia stage based on time and temperature
   */
  calculateHypothermiaStage(waterTemp, hoursInWater) {
    const coldShockTime = 0.05; // 3 minutes
    const exhaustionTime = waterTemp > 50 ? 1 : 0.5;
    
    if (hoursInWater < coldShockTime) {
      return 'cold-shock'; // 0-3 minutes: Cold shock response
    } else if (hoursInWater < exhaustionTime) {
      return 'swim-failure'; // 3-30 minutes: Swimming failure
    } else if (hoursInWater < this.estimateTimeRemaining(0.5, waterTemp)) {
      return 'mild-hypothermia'; // Conscious but hypothermic
    } else {
      return 'severe-hypothermia'; // Critical condition
    }
  }
}

module.exports = SurvivalAnalyzer;