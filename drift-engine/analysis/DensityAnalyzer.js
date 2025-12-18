/**
 * DensityAnalyzer.js
 * Analyzes particle density distribution to create heat maps
 * Divides search area into grid cells and counts particles per cell
 */

class DensityAnalyzer {
  constructor() {
    this.gridSize = 0.01; // Grid cell size in degrees (~1.1 km)
  }

  /**
   * Analyze particle density and create heat map data
   * @param {Array} particles - Array of particle objects
   * @returns {Object} - { heatMap, grid, maxDensity }
   */
  analyze(particles) {
    const grid = {};
    let maxDensity = 0;

    // Only analyze active particles
    const activeParticles = particles.filter(p => p.status === 'active');

    // Count particles in each grid cell
    activeParticles.forEach(p => {
      const cellLat = Math.floor(p.lat / this.gridSize) * this.gridSize;
      const cellLng = Math.floor(p.lng / this.gridSize) * this.gridSize;
      const key = `${cellLat},${cellLng}`;
      
      if (!grid[key]) {
        grid[key] = {
          lat: cellLat,
          lng: cellLng,
          count: 0,
          particles: []
        };
      }
      
      grid[key].count++;
      grid[key].particles.push(p.id);
      
      if (grid[key].count > maxDensity) {
        maxDensity = grid[key].count;
      }
    });

    // Convert grid to heat map format
    // Each point has lat, lng, and normalized weight (0-1)
    const heatMap = Object.values(grid).map(cell => ({
      lat: cell.lat + this.gridSize / 2, // Center of cell
      lng: cell.lng + this.gridSize / 2,
      weight: cell.count / maxDensity, // Normalized 0-1
      count: cell.count
    }));

    // Sort by density (highest first)
    heatMap.sort((a, b) => b.count - a.count);

    return {
      heatMap,
      grid,
      maxDensity,
      totalCells: Object.keys(grid).length,
      gridSize: this.gridSize
    };
  }

  /**
   * Get high-density areas (top 10%)
   */
  getHighDensityAreas(particles) {
    const analysis = this.analyze(particles);
    const threshold = analysis.maxDensity * 0.1; // Top 10%
    
    return analysis.heatMap.filter(cell => cell.count >= threshold);
  }

  /**
   * Set grid resolution
   */
  setGridSize(size) {
    this.gridSize = size;
  }

  /**
   * Calculate search area from particle distribution
   */
  calculateSearchArea(particles) {
    const activeParticles = particles.filter(p => p.status === 'active');
    
    if (activeParticles.length === 0) {
      return { area: 0, bounds: null };
    }

    const lats = activeParticles.map(p => p.lat);
    const lngs = activeParticles.map(p => p.lng);

    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };

    // Calculate area in square kilometers
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    const avgLat = (bounds.north + bounds.south) / 2;
    
    const areaKm2 = latDiff * 111.32 * lngDiff * 111.32 * Math.cos(avgLat * Math.PI / 180);

    return {
      area: areaKm2,
      bounds
    };
  }
}

module.exports = DensityAnalyzer;