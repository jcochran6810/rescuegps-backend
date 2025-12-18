/**
 * ParticleEngine.js
 * Manages particle initialization and state tracking for drift simulation
 * Creates 10,000+ particles distributed around Last Known Position (LKP)
 */

class ParticleEngine {
  constructor(config) {
    this.particles = [];
    this.config = {
      count: config.particleCount || 10000,
      lkp: config.lkp, // { lat, lng }
      objectType: config.objectType || 'person-in-water'
    };
    this.initializeParticles();
  }

  /**
   * Initialize particles in circular distribution around LKP
   * Uses polar coordinates for even distribution
   */
  initializeParticles() {
    const radiusKm = 0.1; // Initial spread radius in kilometers
    
    for (let i = 0; i < this.config.count; i++) {
      // Polar coordinates for even circular distribution
      const angle = Math.random() * 2 * Math.PI;
      const r = Math.sqrt(Math.random()) * radiusKm;
      
      // Convert to lat/lng offsets
      const offsetLat = (r * Math.cos(angle)) / 111.32; // 1 degree lat ≈ 111.32 km
      const offsetLng = (r * Math.sin(angle)) / (111.32 * Math.cos(this.config.lkp.lat * Math.PI / 180));
      
      this.particles.push({
        id: i,
        lat: this.config.lkp.lat + offsetLat,
        lng: this.config.lkp.lng + offsetLng,
        status: 'active', // 'active', 'beached', 'recovered'
        age: 0, // seconds since initialization
        beachedAt: null,
        recoveredAt: null
      });
    }
  }

  /**
   * Get all active particles (not beached or recovered)
   */
  getActiveParticles() {
    return this.particles.filter(p => p.status === 'active');
  }

  /**
   * Get all particles regardless of status
   */
  getAllParticles() {
    return this.particles;
  }

  /**
   * Update a specific particle's properties
   */
  updateParticle(id, updates) {
    const particle = this.particles.find(p => p.id === id);
    if (particle) {
      Object.assign(particle, updates);
    }
  }

  /**
   * Get particle statistics
   */
  getStats() {
    return {
      total: this.particles.length,
      active: this.particles.filter(p => p.status === 'active').length,
      beached: this.particles.filter(p => p.status === 'beached').length,
      recovered: this.particles.filter(p => p.status === 'recovered').length
    };
  }
}

module.exports = ParticleEngine;