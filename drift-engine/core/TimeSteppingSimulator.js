/**
 * TimeSteppingSimulator.js
 * Main simulation loop - advances particles through time using physics models
 * Integrates all drift forces and updates particle positions
 */

const WindDriftCalculator = require('../physics/WindDriftCalculator');
const CurrentDriftCalculator = require('../physics/CurrentDriftCalculator');
const WaveDriftCalculator = require('../physics/WaveDriftCalculator');
const LeewayCalculator = require('../physics/LeewayCalculator');

class TimeSteppingSimulator {
  constructor(particleEngine, environmentalManager, config) {
    this.particleEngine = particleEngine;
    this.environmentalManager = environmentalManager;
    this.config = config;
    
    // Initialize physics calculators
    this.windCalc = new WindDriftCalculator();
    this.currentCalc = new CurrentDriftCalculator();
    this.waveCalc = new WaveDriftCalculator();
    this.leewayCalc = new LeewayCalculator(config.objectType);
    
    this.currentTime = 0; // Simulation time in seconds
    this.snapshots = []; // Hourly snapshots for playback
  }

  /**
   * Advance simulation by deltaSeconds
   * Updates all particles based on environmental forces
   */
  step(deltaSeconds) {
    const particles = this.particleEngine.getActiveParticles();
    const deltaHours = deltaSeconds / 3600;

    // Update environmental conditions
    this.environmentalManager.updateConditions(this.currentTime);

    particles.forEach(particle => {
      // Get local environmental conditions
      const env = this.environmentalManager.getConditionsAt(
        particle.lat,
        particle.lng,
        this.currentTime
      );

      // Calculate drift from each force
      const windDrift = this.windCalc.calculate(env.wind, deltaHours);
      const currentDrift = this.currentCalc.calculate(env.current, deltaHours);
      const waveDrift = this.waveCalc.calculate(env.waves, deltaHours);
      const leeway = this.leewayCalc.calculate(env.wind, deltaHours);

      // Sum all drift components
      const totalLatDrift = windDrift.lat + currentDrift.lat + waveDrift.lat + leeway.lat;
      const totalLngDrift = windDrift.lng + currentDrift.lng + waveDrift.lng + leeway.lng;

      // Update particle position
      particle.lat += totalLatDrift;
      particle.lng += totalLngDrift;
      particle.age += deltaSeconds;

      // Check for beaching
      if (this.checkBeaching(particle)) {
        particle.status = 'beached';
        particle.beachedAt = this.currentTime;
      }
    });

    this.currentTime += deltaSeconds;
    
    // Save hourly snapshots
    if (this.currentTime % 3600 === 0) {
      this.snapshots.push(this.createSnapshot());
    }
  }

  /**
   * Check if particle has reached shore
   * In production, this would use coastline data
   */
  checkBeaching(particle) {
    // Simplified beaching check (random for now)
    // Real implementation would check against coastline database
    return Math.random() < 0.0001; // Very small probability per time step
  }

  /**
   * Create snapshot of current particle positions
   */
  createSnapshot() {
    return {
      time: this.currentTime,
      particles: this.particleEngine.getAllParticles().map(p => ({
        lat: p.lat,
        lng: p.lng,
        status: p.status
      }))
    };
  }

  /**
   * Get all snapshots for playback
   */
  getSnapshots() {
    return this.snapshots;
  }

  /**
   * Get current simulation time
   */
  getCurrentTime() {
    return this.currentTime;
  }
}

module.exports = TimeSteppingSimulator;