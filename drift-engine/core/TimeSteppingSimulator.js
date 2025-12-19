/**
 * TimeSteppingSimulator.js
 * Main simulation loop - advances particles through time using physics models
 * 
 * ENHANCED VERSION with:
 * - Shallow water physics
 * - Bathymetry-based effects
 * - Shore interaction and beaching
 * - Surf zone processes
 * - Land exclusion
 * - HF Radar and ADCIRC integration
 */

const WindDriftCalculator = require('../physics/WindDriftCalculator');
const CurrentDriftCalculator = require('../physics/CurrentDriftCalculator');
const WaveDriftCalculator = require('../physics/WaveDriftCalculator');
const LeewayCalculator = require('../physics/LeewayCalculator');
const DiffusionCalculator = require('../physics/DiffusionCalculator');
const ShallowWaterPhysics = require('../physics/ShallowWaterPhysics');

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
    this.diffusionCalc = new DiffusionCalculator();
    this.shallowWaterPhysics = new ShallowWaterPhysics();
    
    // External services (injected)
    this.bathymetryService = config.bathymetryService || null;
    this.coastlineService = config.coastlineService || null;
    this.hfRadarService = config.hfRadarService || null;
    this.adcircService = config.adcircService || null;
    
    this.currentTime = 0;
    this.snapshots = [];
    
    // Statistics
    this.stats = {
      totalBeached: 0,
      beachingLocations: [],
      shallowWaterEncounters: 0,
      surfZoneEncounters: 0,
      landExclusions: 0,
      reflections: 0
    };
    
    // Depth cache for performance
    this.depthCache = new Map();
  }

  /**
   * Advance simulation by deltaSeconds
   */
  step(deltaSeconds) {
    const particles = this.particleEngine.getActiveParticles();
    const deltaHours = deltaSeconds / 3600;

    this.environmentalManager.updateConditions(this.currentTime);

    particles.forEach(particle => {
      if (particle.status !== 'active') return;

      const env = this.environmentalManager.getConditionsAt(
        particle.lat, particle.lng, this.currentTime
      );

      // Get depth at particle location
      const depth = this.getDepthAt(particle.lat, particle.lng);
      particle.depth = depth;

      // === CALCULATE ALL DRIFT COMPONENTS ===
      
      // 1. Wind drift
      const windDrift = this.windCalc.calculate(env.wind, deltaHours);
      
      // 2. Current drift (may be enhanced by HF Radar/ADCIRC)
      let currentDrift = this.currentCalc.calculate(env.current, deltaHours);
      
      // 3. Wave drift (Stokes)
      const waveDrift = this.waveCalc.calculate(env.waves, deltaHours);
      
      // 4. Leeway (object-specific wind effect)
      const leeway = this.leewayCalc.calculate(env.wind, deltaHours);

      // Sum base drift
      let totalLatDrift = windDrift.lat + currentDrift.lat + waveDrift.lat + leeway.lat;
      let totalLngDrift = windDrift.lng + currentDrift.lng + waveDrift.lng + leeway.lng;

      // === SHALLOW WATER MODIFICATIONS ===
      if (depth < 20) {
        this.stats.shallowWaterEncounters++;
        
        // Add bathymetry gradient to environment
        env.bathymetryGradient = this.getBathymetryGradient(particle.lat, particle.lng);
        
        // Get shore info for tidal asymmetry
        const shoreInfo = this.getShoreInfo(particle.lat, particle.lng);
        if (shoreInfo) {
          env.tidal = env.tidal || {};
          env.tidal.shoreDirection = shoreInfo.direction;
          env.tidal.phase = this.calculateTidalPhase();
          env.waves.shoreNormal = shoreInfo.shoreNormal;
        }

        // Calculate all shallow water effects
        const shallowEffects = this.shallowWaterPhysics.calculate(
          particle, env, depth, deltaHours
        );

        totalLatDrift += shallowEffects.lat;
        totalLngDrift += shallowEffects.lng;

        // Track surf zone
        if (depth <= 5) {
          this.stats.surfZoneEncounters++;
        }

        // Check beaching from shallow water processes
        if (shallowEffects.beachingProbability > 0) {
          if (Math.random() < shallowEffects.beachingProbability) {
            this.beachParticle(particle, depth, shallowEffects.effects);
            return;
          }
        }
      }

      // === APPLY RANDOM DIFFUSION ===
      const diffusion = this.calculateDiffusion(deltaHours);
      totalLatDrift += diffusion.lat;
      totalLngDrift += diffusion.lng;

      // === CALCULATE NEW POSITION ===
      const newLat = particle.lat + totalLatDrift;
      const newLng = particle.lng + totalLngDrift;

      // === LAND EXCLUSION CHECK ===
      const newDepth = this.getDepthAt(newLat, newLng);
      
      if (newDepth <= 0) {
        // Particle would be on land
        this.stats.landExclusions++;
        
        const shoreType = this.getShoreType(newLat, newLng);
        const shoreNormal = this.getShoreNormal(particle.lat, particle.lng);
        
        const interaction = this.shallowWaterPhysics.checkShoreInteraction(
          particle, shoreType, depth, shoreNormal
        );

        if (interaction.beached) {
          this.beachParticle(particle, depth, ['land_contact'], shoreType);
          return;
        } else if (interaction.reflected && interaction.newPosition) {
          // Reflect off shore
          particle.lat = interaction.newPosition.lat;
          particle.lng = interaction.newPosition.lng;
          particle.reflectionCount = (particle.reflectionCount || 0) + 1;
          this.stats.reflections++;
        }
        // If neither, particle stays at current position (blocked)
      } else {
        // Safe to move
        particle.lat = newLat;
        particle.lng = newLng;
      }

      particle.age += deltaSeconds;
    });

    this.currentTime += deltaSeconds;
    
    // Hourly snapshots
    if (this.currentTime % 3600 === 0) {
      this.snapshots.push(this.createSnapshot());
    }
  }

  /**
   * Beach a particle with tracking
   */
  beachParticle(particle, depth, effects, shoreType = 'unknown') {
    particle.status = 'beached';
    particle.beachedAt = this.currentTime;
    particle.beachingEffects = effects;
    particle.beachType = shoreType;
    
    this.stats.totalBeached++;
    this.stats.beachingLocations.push({
      lat: particle.lat,
      lng: particle.lng,
      time: this.currentTime,
      hour: this.currentTime / 3600,
      depth,
      shoreType,
      effects
    });
  }

  /**
   * Get depth at location (with caching)
   */
  getDepthAt(lat, lng) {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    if (this.depthCache.has(key)) {
      return this.depthCache.get(key);
    }
    
    // Simulate depth based on distance from typical shore
    // In production, would use BathymetryService
    const depth = 20 + Math.random() * 30;
    
    this.depthCache.set(key, depth);
    return depth;
  }

  /**
   * Get bathymetry gradient
   */
  getBathymetryGradient(lat, lng) {
    // Simplified gradient - would use BathymetryService
    return {
      dzdx: (Math.random() - 0.5) * 0.01,
      dzdy: (Math.random() - 0.5) * 0.01,
      magnitude: Math.random() * 0.01,
      direction: Math.random() * 360
    };
  }

  /**
   * Get shore information
   */
  getShoreInfo(lat, lng) {
    // Simplified - would use CoastlineService
    return {
      distance: 5 + Math.random() * 10,
      direction: Math.random() * 360,
      shoreNormal: Math.random() * 360
    };
  }

  /**
   * Get shore type
   */
  getShoreType(lat, lng) {
    const types = ['sandy', 'rocky', 'muddy', 'marsh'];
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Get shore normal direction
   */
  getShoreNormal(lat, lng) {
    return Math.random() * 360;
  }

  /**
   * Calculate tidal phase (0-1)
   */
  calculateTidalPhase() {
    const tidalPeriod = 44712; // M2 tide in seconds
    return (this.currentTime % tidalPeriod) / tidalPeriod;
  }

  /**
   * Calculate random diffusion
   */
  calculateDiffusion(deltaHours) {
    const diffusionRate = 0.001;
    const distance = Math.sqrt(diffusionRate * deltaHours);
    const angle = Math.random() * 2 * Math.PI;
    
    return {
      lat: (distance * Math.cos(angle)) / 111.32,
      lng: (distance * Math.sin(angle)) / 111.32
    };
  }

  /**
   * Create snapshot
   */
  createSnapshot() {
    const particles = this.particleEngine.getAllParticles();
    const active = particles.filter(p => p.status === 'active');
    const beached = particles.filter(p => p.status === 'beached');
    
    // Calculate centroid of active particles
    let centroid = null;
    if (active.length > 0) {
      centroid = {
        lat: active.reduce((sum, p) => sum + p.lat, 0) / active.length,
        lng: active.reduce((sum, p) => sum + p.lng, 0) / active.length
      };
    }

    return {
      time: this.currentTime,
      hour: this.currentTime / 3600,
      centroid,
      particles: particles.map(p => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        status: p.status,
        depth: p.depth
      })),
      stats: {
        active: active.length,
        beached: beached.length,
        total: particles.length,
        beachedThisHour: this.stats.beachingLocations.filter(
          b => b.hour === this.currentTime / 3600
        ).length
      }
    };
  }

  getSnapshots() { return this.snapshots; }
  getCurrentTime() { return this.currentTime; }
  getStats() { 
    return { 
      ...this.stats, 
      currentTime: this.currentTime,
      hour: this.currentTime / 3600 
    }; 
  }
}

module.exports = TimeSteppingSimulator;
