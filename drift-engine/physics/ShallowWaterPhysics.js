/**
 * ShallowWaterPhysics.js
 * Comprehensive shallow water dynamics for coastal SAR operations
 * 
 * Implements:
 * - Bathymetry-induced circulation patterns
 * - Stokes drift with depth correction
 * - Wave breaking / surf zone processes
 * - Tidal asymmetry effects
 * - Bottom friction
 * - Rip currents
 * - Longshore currents
 */

class ShallowWaterPhysics {
  constructor() {
    // Physical constants
    this.g = 9.81; // Gravity (m/s²)
    this.rho = 1025; // Seawater density (kg/m³)
    this.kinematicViscosity = 1.08e-6; // m²/s
    
    // Depth thresholds
    this.shallowWaterThreshold = 20; // meters - below this, shallow water effects apply
    this.surfZoneThreshold = 5; // meters - wave breaking begins
    this.veryShallowThreshold = 2; // meters - extreme shallow effects
    
    // Shore interaction parameters
    this.shoreTypes = {
      'rocky': { 
        stickiness: 0.85, 
        reflection: 0.15, 
        roughness: 0.05,
        permeability: 0.0
      },
      'sandy': { 
        stickiness: 0.60, 
        reflection: 0.30, 
        roughness: 0.02,
        permeability: 0.1
      },
      'muddy': { 
        stickiness: 0.95, 
        reflection: 0.05, 
        roughness: 0.01,
        permeability: 0.05
      },
      'marsh': { 
        stickiness: 1.0, 
        reflection: 0.0, 
        roughness: 0.1,
        permeability: 0.2
      },
      'mangrove': { 
        stickiness: 1.0, 
        reflection: 0.0, 
        roughness: 0.15,
        permeability: 0.3
      },
      'seawall': { 
        stickiness: 0.1, 
        reflection: 0.9, 
        roughness: 0.001,
        permeability: 0.0
      },
      'riprap': { 
        stickiness: 0.4, 
        reflection: 0.5, 
        roughness: 0.08,
        permeability: 0.15
      },
      'coral': { 
        stickiness: 0.7, 
        reflection: 0.2, 
        roughness: 0.1,
        permeability: 0.05
      }
    };
  }

  /**
   * Calculate all shallow water effects on particle drift
   * @param {Object} particle - { lat, lng, depth }
   * @param {Object} env - Environmental conditions
   * @param {Number} depth - Water depth at particle location (meters)
   * @param {Number} deltaHours - Time step
   * @returns {Object} - { lat, lng, status, beachingProbability }
   */
  calculate(particle, env, depth, deltaHours) {
    const result = {
      lat: 0,
      lng: 0,
      status: 'active',
      beachingProbability: 0,
      effects: []
    };

    // Deep water - minimal shallow effects
    if (depth > this.shallowWaterThreshold) {
      return result;
    }

    // Calculate depth ratio for scaling effects
    const depthRatio = depth / this.shallowWaterThreshold;

    // 1. Bottom friction effect
    const bottomFriction = this.calculateBottomFriction(depth, env.current);
    result.lat += bottomFriction.lat;
    result.lng += bottomFriction.lng;
    result.effects.push('bottom_friction');

    // 2. Shallow water Stokes drift (enhanced near surface)
    const stokesDrift = this.calculateShallowStokesDrift(env.waves, depth, deltaHours);
    result.lat += stokesDrift.lat;
    result.lng += stokesDrift.lng;
    result.effects.push('shallow_stokes');

    // 3. Bathymetry-induced circulation
    const bathyCirculation = this.calculateBathymetryCirculation(
      particle, depth, env.current, env.bathymetryGradient
    );
    result.lat += bathyCirculation.lat;
    result.lng += bathyCirculation.lng;
    result.effects.push('bathy_circulation');

    // 4. Tidal asymmetry effects
    if (env.tidal) {
      const tidalAsymmetry = this.calculateTidalAsymmetry(depth, env.tidal, deltaHours);
      result.lat += tidalAsymmetry.lat;
      result.lng += tidalAsymmetry.lng;
      result.effects.push('tidal_asymmetry');
    }

    // 5. Surf zone processes (if in surf zone)
    if (depth <= this.surfZoneThreshold) {
      const surfZone = this.calculateSurfZoneEffects(particle, env, depth, deltaHours);
      result.lat += surfZone.lat;
      result.lng += surfZone.lng;
      result.beachingProbability += surfZone.beachingProbability;
      result.effects.push(...surfZone.effects);
    }

    // 6. Very shallow water effects
    if (depth <= this.veryShallowThreshold) {
      const veryShallow = this.calculateVeryShallowEffects(particle, env, depth, deltaHours);
      result.lat += veryShallow.lat;
      result.lng += veryShallow.lng;
      result.beachingProbability += veryShallow.beachingProbability;
      result.effects.push('very_shallow');
    }

    return result;
  }

  /**
   * Calculate bottom friction reducing current speed
   * Uses quadratic drag law with Manning's n
   */
  calculateBottomFriction(depth, current) {
    // Manning's roughness coefficient (typical for sandy bottom)
    const manningN = 0.025;
    
    // Friction factor
    const frictionFactor = (this.g * manningN * manningN) / Math.pow(depth, 1/3);
    
    // Reduction factor (0-1, higher = more friction)
    const reductionFactor = Math.min(0.8, frictionFactor * current.speed);
    
    // Apply friction as reduction to current drift
    const dirRad = (current.direction * Math.PI) / 180;
    const reducedSpeed = current.speed * (1 - reductionFactor);
    const speedDiff = current.speed - reducedSpeed;
    
    // Return the reduction (negative drift adjustment)
    return {
      lat: -(speedDiff * Math.cos(dirRad) * 0.001) / 111.32,
      lng: -(speedDiff * Math.sin(dirRad) * 0.001) / 111.32
    };
  }

  /**
   * Calculate Stokes drift with shallow water correction
   * Stokes drift increases significantly in shallow water
   */
  calculateShallowStokesDrift(waves, depth, deltaHours) {
    const H = waves.height || 1; // Wave height (m)
    const T = waves.period || 6; // Wave period (s)
    const direction = waves.direction || 0;
    
    // Angular frequency
    const omega = (2 * Math.PI) / T;
    
    // Wave number using dispersion relation (iterative for shallow water)
    const k = this.calculateWaveNumber(omega, depth);
    
    // Shallow water correction factor
    // In deep water: tanh(kd) ≈ 1
    // In shallow water: tanh(kd) < 1, increases Stokes drift
    const kd = k * depth;
    const shallowFactor = 1 + (1 / (2 * Math.sinh(2 * kd)));
    
    // Stokes drift velocity at surface
    // U_s = (π * H² * c) / (T * λ) where c = wave celerity, λ = wavelength
    const wavelength = (2 * Math.PI) / k;
    const celerity = wavelength / T;
    const stokesDrift = (Math.PI * H * H * celerity) / (T * wavelength) * shallowFactor;
    
    // Convert to km drift
    const driftKm = stokesDrift * deltaHours * 3.6; // m/s to km/h
    const dirRad = (direction * Math.PI) / 180;
    
    return {
      lat: (driftKm * Math.cos(dirRad)) / 111.32,
      lng: (driftKm * Math.sin(dirRad)) / 111.32
    };
  }

  /**
   * Solve dispersion relation for wave number
   * ω² = gk * tanh(kd)
   */
  calculateWaveNumber(omega, depth) {
    // Initial guess (deep water approximation)
    let k = (omega * omega) / this.g;
    
    // Newton-Raphson iteration
    for (let i = 0; i < 20; i++) {
      const tanh_kd = Math.tanh(k * depth);
      const f = omega * omega - this.g * k * tanh_kd;
      const df = -this.g * (tanh_kd + k * depth * (1 - tanh_kd * tanh_kd));
      
      const dk = f / df;
      k = k - dk;
      
      if (Math.abs(dk) < 1e-10) break;
    }
    
    return k;
  }

  /**
   * Calculate bathymetry-induced circulation
   * Depth gradients cause flow deflection and eddies
   */
  calculateBathymetryCirculation(particle, depth, current, bathyGradient) {
    if (!bathyGradient) {
      return { lat: 0, lng: 0 };
    }
    
    // Topographic steering - current tends to follow isobaths (depth contours)
    const gradMagnitude = Math.sqrt(
      bathyGradient.dzdx * bathyGradient.dzdx + 
      bathyGradient.dzdy * bathyGradient.dzdy
    );
    
    if (gradMagnitude < 0.001) {
      return { lat: 0, lng: 0 };
    }
    
    // Direction perpendicular to depth gradient (along isobath)
    const isobathDir = Math.atan2(-bathyGradient.dzdx, bathyGradient.dzdy);
    
    // Steering strength increases with current speed and gradient
    const steeringStrength = current.speed * gradMagnitude * 0.1;
    
    // Calculate deflection toward isobath direction
    const currentDirRad = (current.direction * Math.PI) / 180;
    const angleDiff = isobathDir - currentDirRad;
    
    const deflection = steeringStrength * Math.sin(angleDiff);
    
    return {
      lat: (deflection * Math.cos(isobathDir)) / 111.32,
      lng: (deflection * Math.sin(isobathDir)) / 111.32
    };
  }

  /**
   * Calculate tidal asymmetry effects
   * Flood/ebb tides have different durations and velocities in shallow water
   */
  calculateTidalAsymmetry(depth, tidal, deltaHours) {
    // Tidal asymmetry parameter
    // In shallow water, flood tide is often shorter but stronger
    const asymmetryFactor = 0.1 * (this.shallowWaterThreshold / depth);
    
    // Phase of tide (0-1, 0=low, 0.5=high)
    const tidalPhase = tidal.phase || 0;
    
    // During flood (0-0.5): enhanced onshore transport
    // During ebb (0.5-1): slightly reduced offshore transport
    let asymmetryEffect;
    if (tidalPhase < 0.5) {
      // Flood tide - enhanced shoreward
      asymmetryEffect = asymmetryFactor * Math.sin(tidalPhase * Math.PI);
    } else {
      // Ebb tide - reduced seaward
      asymmetryEffect = -asymmetryFactor * 0.7 * Math.sin((tidalPhase - 0.5) * Math.PI);
    }
    
    // Apply in direction toward/away from shore
    const shoreDir = tidal.shoreDirection || 0;
    const dirRad = (shoreDir * Math.PI) / 180;
    
    const driftKm = asymmetryEffect * deltaHours;
    
    return {
      lat: (driftKm * Math.cos(dirRad)) / 111.32,
      lng: (driftKm * Math.sin(dirRad)) / 111.32
    };
  }

  /**
   * Calculate surf zone effects
   * Wave breaking dramatically changes drift behavior
   */
  calculateSurfZoneEffects(particle, env, depth, deltaHours) {
    const result = {
      lat: 0,
      lng: 0,
      beachingProbability: 0,
      effects: []
    };
    
    const waves = env.waves || { height: 1, period: 6, direction: 0 };
    
    // 1. Wave breaking criterion (H/d > 0.78)
    const breakingRatio = waves.height / depth;
    const isBreaking = breakingRatio > 0.78;
    
    if (isBreaking) {
      result.effects.push('wave_breaking');
      
      // Breaking waves create strong onshore transport
      const breakingTransport = this.calculateBreakingWaveTransport(waves, depth, deltaHours);
      result.lat += breakingTransport.lat;
      result.lng += breakingTransport.lng;
      
      // Increased beaching probability in breaking zone
      result.beachingProbability += 0.15 * deltaHours;
    }
    
    // 2. Longshore current (from oblique wave approach)
    const longshore = this.calculateLongshoreCurrent(waves, depth, deltaHours);
    result.lat += longshore.lat;
    result.lng += longshore.lng;
    if (longshore.magnitude > 0.01) {
      result.effects.push('longshore_current');
    }
    
    // 3. Rip current possibility
    if (env.ripCurrentRisk && env.ripCurrentRisk > 0.5) {
      const ripCurrent = this.calculateRipCurrent(env, depth, deltaHours);
      result.lat += ripCurrent.lat;
      result.lng += ripCurrent.lng;
      result.effects.push('rip_current');
    }
    
    // 4. Undertow (near-bottom offshore return flow)
    const undertow = this.calculateUndertow(waves, depth, deltaHours);
    result.lat += undertow.lat;
    result.lng += undertow.lng;
    if (undertow.magnitude > 0.01) {
      result.effects.push('undertow');
    }
    
    return result;
  }

  /**
   * Calculate transport from breaking waves
   */
  calculateBreakingWaveTransport(waves, depth, deltaHours) {
    const H = waves.height;
    const direction = waves.direction || 0;
    
    // Breaking wave transport velocity (empirical)
    // Approximately 1-2% of wave celerity
    const celerity = Math.sqrt(this.g * depth); // Shallow water wave speed
    const transportSpeed = 0.015 * celerity * (H / depth);
    
    const driftKm = transportSpeed * deltaHours * 3.6;
    const dirRad = (direction * Math.PI) / 180;
    
    return {
      lat: (driftKm * Math.cos(dirRad)) / 111.32,
      lng: (driftKm * Math.sin(dirRad)) / 111.32
    };
  }

  /**
   * Calculate longshore current from oblique waves
   * Using Longuet-Higgins formula
   */
  calculateLongshoreCurrent(waves, depth, deltaHours) {
    const H = waves.height || 1;
    const direction = waves.direction || 0;
    const shoreNormal = waves.shoreNormal || 270; // Assume west-facing shore
    
    // Wave approach angle relative to shore normal
    const approachAngle = (direction - shoreNormal) * Math.PI / 180;
    
    // Longshore current velocity (Longuet-Higgins approximation)
    // V_l ≈ 0.2 * sqrt(g * Hb) * sin(2α)
    const breakerHeight = Math.min(H, 0.78 * depth);
    const Vl = 0.2 * Math.sqrt(this.g * breakerHeight) * Math.sin(2 * approachAngle);
    
    // Longshore direction (perpendicular to shore normal)
    const longshoreDirRad = ((shoreNormal + 90) * Math.PI) / 180;
    
    const driftKm = Vl * deltaHours * 3.6;
    
    return {
      lat: (driftKm * Math.cos(longshoreDirRad)) / 111.32,
      lng: (driftKm * Math.sin(longshoreDirRad)) / 111.32,
      magnitude: Math.abs(Vl)
    };
  }

  /**
   * Calculate rip current effects
   * Rip currents are channelized offshore flows
   */
  calculateRipCurrent(env, depth, deltaHours) {
    const ripStrength = env.ripCurrentStrength || 0.5; // 0-1 scale
    const ripDirection = env.ripCurrentDirection || 180; // Typically offshore
    
    // Rip current speed can be 1-2 m/s
    const ripSpeed = ripStrength * 1.5; // m/s
    
    const driftKm = ripSpeed * deltaHours * 3.6;
    const dirRad = (ripDirection * Math.PI) / 180;
    
    return {
      lat: (driftKm * Math.cos(dirRad)) / 111.32,
      lng: (driftKm * Math.sin(dirRad)) / 111.32
    };
  }

  /**
   * Calculate undertow (return flow beneath breaking waves)
   */
  calculateUndertow(waves, depth, deltaHours) {
    const H = waves.height || 1;
    const direction = waves.direction || 0;
    
    // Undertow is offshore (opposite to wave direction)
    const undertowDir = (direction + 180) % 360;
    
    // Undertow velocity depends on wave height and depth
    // Typically 0.1-0.3 m/s
    const undertowSpeed = 0.2 * (H / depth) * Math.min(1, 3 / depth);
    
    const driftKm = undertowSpeed * deltaHours * 3.6;
    const dirRad = (undertowDir * Math.PI) / 180;
    
    return {
      lat: (driftKm * Math.cos(dirRad)) / 111.32,
      lng: (driftKm * Math.sin(dirRad)) / 111.32,
      magnitude: undertowSpeed
    };
  }

  /**
   * Calculate very shallow water effects (< 2m)
   * Extreme friction, wave effects, high beaching probability
   */
  calculateVeryShallowEffects(particle, env, depth, deltaHours) {
    const depthFactor = depth / this.veryShallowThreshold;
    
    // Very high bottom friction
    const frictionReduction = 0.5 * (1 - depthFactor);
    
    // High beaching probability
    const beachingProbability = 0.3 * (1 - depthFactor) * deltaHours;
    
    // Apply friction as general speed reduction
    const currentDir = env.current?.direction || 0;
    const dirRad = (currentDir * Math.PI) / 180;
    const reduction = frictionReduction * (env.current?.speed || 0) * 0.001;
    
    return {
      lat: -(reduction * Math.cos(dirRad)) / 111.32,
      lng: -(reduction * Math.sin(dirRad)) / 111.32,
      beachingProbability
    };
  }

  /**
   * Check if particle has beached based on shore interaction
   * @param {Object} particle - Particle position
   * @param {String} shoreType - Type of shoreline
   * @param {Number} depth - Water depth
   * @returns {Object} - { beached, reflected, newPosition }
   */
  checkShoreInteraction(particle, shoreType, depth, shoreNormal) {
    const shore = this.shoreTypes[shoreType] || this.shoreTypes['sandy'];
    
    if (depth > 0.5) {
      return { beached: false, reflected: false };
    }
    
    // Random determination based on shore properties
    const rand = Math.random();
    
    if (rand < shore.stickiness) {
      // Particle beaches (sticks to shore)
      return { 
        beached: true, 
        reflected: false,
        beachType: shoreType
      };
    } else if (rand < shore.stickiness + shore.reflection) {
      // Particle reflects off shore
      const reflectionAngle = shoreNormal + 180 + (Math.random() - 0.5) * 60;
      const reflectionDistance = 0.01 + Math.random() * 0.02; // Small push offshore
      
      const reflectDirRad = (reflectionAngle * Math.PI) / 180;
      
      return {
        beached: false,
        reflected: true,
        newPosition: {
          lat: particle.lat + (reflectionDistance * Math.cos(reflectDirRad)) / 111.32,
          lng: particle.lng + (reflectionDistance * Math.sin(reflectDirRad)) / 111.32
        }
      };
    }
    
    // Particle continues (e.g., permeable shore)
    return { beached: false, reflected: false };
  }

  /**
   * Get shore type parameters
   */
  getShoreType(type) {
    return this.shoreTypes[type] || this.shoreTypes['sandy'];
  }

  /**
   * List all available shore types
   */
  listShoreTypes() {
    return Object.keys(this.shoreTypes);
  }
}

module.exports = ShallowWaterPhysics;
