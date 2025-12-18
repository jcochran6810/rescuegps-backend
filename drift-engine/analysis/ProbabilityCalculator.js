/**
 * ProbabilityCalculator.js
 * Calculates probability containment zones (50%, 90%, 95%)
 * Uses convex hull algorithm to draw polygons around particle clusters
 */

class ProbabilityCalculator {
  /**
   * Calculate probability zones from particle distribution
   * @param {Array} particles - Array of particle objects
   * @returns {Object} - { polygon50, polygon90, polygon95, confidence }
   */
  calculate(particles) {
    const activeParticles = particles.filter(p => p.status === 'active');
    
    if (activeParticles.length < 3) {
      return {
        polygon50: [],
        polygon90: [],
        polygon95: [],
        confidence: 0
      };
    }

    // Sort particles by distance from centroid
    const centroid = this.calculateCentroid(activeParticles);
    const sorted = activeParticles.map(p => ({
      ...p,
      distance: this.calculateDistance(p.lat, p.lng, centroid.lat, centroid.lng)
    })).sort((a, b) => a.distance - b.distance);

    // Create polygons for different probability levels
    const p50Index = Math.floor(sorted.length * 0.50);
    const p90Index = Math.floor(sorted.length * 0.90);
    const p95Index = Math.floor(sorted.length * 0.95);

    const polygon50 = this.createPolygon(sorted.slice(0, p50Index));
    const polygon90 = this.createPolygon(sorted.slice(0, p90Index));
    const polygon95 = this.createPolygon(sorted.slice(0, p95Index));

    return {
      polygon50,
      polygon90,
      polygon95,
      confidence: this.calculateConfidence(activeParticles),
      centroid
    };
  }

  /**
   * Calculate centroid (center of mass) of particles
   */
  calculateCentroid(particles) {
    const sumLat = particles.reduce((sum, p) => sum + p.lat, 0);
    const sumLng = particles.reduce((sum, p) => sum + p.lng, 0);
    
    return {
      lat: sumLat / particles.length,
      lng: sumLng / particles.length
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Create polygon from particle set using convex hull algorithm
   */
  createPolygon(particles) {
    if (particles.length < 3) return [];
    
    const points = particles.map(p => ({ lat: p.lat, lng: p.lng }));
    return this.convexHull(points);
  }

  /**
   * Convex Hull algorithm (Graham Scan)
   */
  convexHull(points) {
    // Sort points by latitude, then longitude
    points.sort((a, b) => a.lat - b.lat || a.lng - b.lng);
    
    // Cross product of vectors OA and OB
    const cross = (o, a, b) => {
      return (a.lat - o.lat) * (b.lng - o.lng) - (a.lng - o.lng) * (b.lat - o.lat);
    };

    // Build lower hull
    const lower = [];
    for (let i = 0; i < points.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
        lower.pop();
      }
      lower.push(points[i]);
    }

    // Build upper hull
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
        upper.pop();
      }
      upper.push(points[i]);
    }

    // Remove last point of each half because it's repeated
    upper.pop();
    lower.pop();
    
    return lower.concat(upper);
  }

  /**
   * Calculate confidence level based on particle spread
   */
  calculateConfidence(particles) {
    if (particles.length === 0) return 0;

    const centroid = this.calculateCentroid(particles);
    const distances = particles.map(p => 
      this.calculateDistance(p.lat, p.lng, centroid.lat, centroid.lng)
    );

    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = higher confidence
    // Normalize to 0-1 scale
    const confidence = Math.max(0, Math.min(1, 1 - (stdDev / (avgDistance + 1))));

    return confidence;
  }

  /**
   * Calculate probability of containment for a given area
   */
  calculateContainmentProbability(polygon, particles) {
    const activeParticles = particles.filter(p => p.status === 'active');
    const contained = activeParticles.filter(p => this.isPointInPolygon(p, polygon));
    
    return contained.length / activeParticles.length;
  }

  /**
   * Check if point is inside polygon (ray casting algorithm)
   */
  isPointInPolygon(point, polygon) {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng;
      const xj = polygon[j].lat, yj = polygon[j].lng;
      
      const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
        (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }
}

module.exports = ProbabilityCalculator;