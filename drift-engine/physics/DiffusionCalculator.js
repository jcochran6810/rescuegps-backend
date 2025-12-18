/**
 * DiffusionCalculator.js
 * Calculates random diffusion/dispersion of particles
 * Simulates turbulent mixing and uncertainty in drift prediction
 */

class DiffusionCalculator {
  constructor() {
    this.diffusionRate = 0.001; // Base diffusion rate (km²/h)
  }

  /**
   * Apply random walk diffusion to particles
   * @param {Array} particles - Array of particle objects
   * @param {Number} deltaHours - Time step in hours
   */
  calculate(particles, deltaHours) {
    const diffusionDistance = Math.sqrt(this.diffusionRate * deltaHours);
    
    particles.forEach(particle => {
      // Random walk in 2D
      const randomAngle = Math.random() * 2 * Math.PI;
      const randomDistance = diffusionDistance * Math.random();
      
      const randomLat = (randomDistance * Math.cos(randomAngle)) / 111.32;
      const randomLng = (randomDistance * Math.sin(randomAngle)) / 111.32;
      
      particle.lat += randomLat;
      particle.lng += randomLng;
    });
  }

  /**
   * Apply directional diffusion (biased random walk)
   */
  calculateDirectional(particles, direction, strength, deltaHours) {
    const directionRad = (direction * Math.PI) / 180;
    const diffusionDistance = Math.sqrt(this.diffusionRate * deltaHours) * strength;
    
    particles.forEach(particle => {
      // Biased random walk
      const randomAngle = directionRad + (Math.random() - 0.5) * Math.PI / 2; // +/- 45 degrees
      const randomDistance = diffusionDistance * (0.5 + Math.random() * 0.5); // 50-100% of max
      
      const randomLat = (randomDistance * Math.cos(randomAngle)) / 111.32;
      const randomLng = (randomDistance * Math.sin(randomAngle)) / 111.32;
      
      particle.lat += randomLat;
      particle.lng += randomLng;
    });
  }

  /**
   * Set diffusion rate
   */
  setDiffusionRate(rate) {
    this.diffusionRate = rate;
  }
}

module.exports = DiffusionCalculator;