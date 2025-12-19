/**
 * BathymetryService.js
 * Provides water depth data from multiple sources
 * 
 * Data Sources:
 * - NOAA NCEI Bathymetry (high-resolution coastal)
 * - GEBCO (global bathymetry)
 * - NOAA ENC (Electronic Navigational Charts)
 * - Local depth soundings cache
 */

const axios = require('axios');

class BathymetryService {
  constructor() {
    this.baseUrls = {
      noaaNcei: 'https://gis.ngdc.noaa.gov/arcgis/rest/services',
      gebco: 'https://www.gebco.net/data_and_products/gebco_web_services',
      noaaEnc: 'https://seamlessrnc.nauticalcharts.noaa.gov/arcgis/rest/services',
      noaaCs: 'https://chs.coast.noaa.gov/arcgis/rest/services'
    };
    
    // Local depth cache for performance
    this.depthCache = new Map();
    this.cacheMaxSize = 10000;
    this.cacheTimeout = 3600000; // 1 hour
    
    // Grid for interpolation
    this.gridResolution = 0.001; // ~100m resolution
  }

  /**
   * Get depth at a specific coordinate
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @returns {Object} - { depth, source, quality }
   */
  async getDepth(lat, lng) {
    // Check cache first
    const cacheKey = this.getCacheKey(lat, lng);
    if (this.depthCache.has(cacheKey)) {
      const cached = this.depthCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    // Try multiple sources in order of preference
    let depthData = null;

    // 1. Try NOAA Coastal Relief Model (best for US coastal)
    try {
      depthData = await this.getNoaaCoastalDepth(lat, lng);
      if (depthData && depthData.depth !== null) {
        this.cacheDepth(cacheKey, depthData);
        return depthData;
      }
    } catch (error) {
      console.log('NOAA Coastal depth unavailable:', error.message);
    }

    // 2. Try NOAA BAG (Bathymetric Attributed Grid)
    try {
      depthData = await this.getNoaaBagDepth(lat, lng);
      if (depthData && depthData.depth !== null) {
        this.cacheDepth(cacheKey, depthData);
        return depthData;
      }
    } catch (error) {
      console.log('NOAA BAG depth unavailable:', error.message);
    }

    // 3. Fallback to GEBCO global
    try {
      depthData = await this.getGebcoDepth(lat, lng);
      if (depthData && depthData.depth !== null) {
        this.cacheDepth(cacheKey, depthData);
        return depthData;
      }
    } catch (error) {
      console.log('GEBCO depth unavailable:', error.message);
    }

    // 4. Estimate from distance to shore
    depthData = this.estimateDepthFromShore(lat, lng);
    this.cacheDepth(cacheKey, depthData);
    return depthData;
  }

  /**
   * Get depth from NOAA Coastal Relief Model
   */
  async getNoaaCoastalDepth(lat, lng) {
    const url = `${this.baseUrls.noaaNcei}/DEM_mosaics/DEM_all/ImageServer/identify`;
    
    const params = {
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      returnGeometry: false,
      returnCatalogItems: false,
      f: 'json'
    };

    const response = await axios.get(url, { params, timeout: 5000 });
    
    if (response.data && response.data.value !== 'NoData') {
      // NOAA returns elevation (negative for water depth)
      const elevation = parseFloat(response.data.value);
      return {
        depth: elevation < 0 ? Math.abs(elevation) : 0,
        source: 'NOAA_CRM',
        quality: 'high',
        resolution: 3, // 3 arc-second (~90m)
        unit: 'meters'
      };
    }

    return null;
  }

  /**
   * Get depth from NOAA BAG data
   */
  async getNoaaBagDepth(lat, lng) {
    const url = `${this.baseUrls.noaaCs}/Bathymetry/MapServer/identify`;
    
    const params = {
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      layers: 'all',
      tolerance: 10,
      mapExtent: `${lng-0.1},${lat-0.1},${lng+0.1},${lat+0.1}`,
      imageDisplay: '400,400,96',
      returnGeometry: false,
      f: 'json'
    };

    const response = await axios.get(url, { params, timeout: 5000 });
    
    if (response.data && response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      if (result.attributes && result.attributes.Depth) {
        return {
          depth: Math.abs(parseFloat(result.attributes.Depth)),
          source: 'NOAA_BAG',
          quality: 'high',
          resolution: 1, // 1m typical for BAG
          unit: 'meters'
        };
      }
    }

    return null;
  }

  /**
   * Get depth from GEBCO global bathymetry
   */
  async getGebcoDepth(lat, lng) {
    // GEBCO WCS service
    const url = `${this.baseUrls.gebco}/2021/wcs`;
    
    const params = {
      service: 'WCS',
      version: '1.0.0',
      request: 'GetCoverage',
      coverage: 'gebco_2021',
      CRS: 'EPSG:4326',
      BBOX: `${lng-0.001},${lat-0.001},${lng+0.001},${lat+0.001}`,
      width: 1,
      height: 1,
      format: 'GeoTIFF'
    };

    // Note: GEBCO requires special handling - using estimation for now
    // In production, would parse GeoTIFF response
    
    return null;
  }

  /**
   * Estimate depth based on distance from shore
   * Used as fallback when no data available
   */
  estimateDepthFromShore(lat, lng) {
    // This is a rough estimation - would use actual coastline data in production
    // Assumes typical shelf slope of 1:1000 to 1:500
    
    // For now, return moderate depth estimate
    return {
      depth: 15, // Default moderate depth
      source: 'estimated',
      quality: 'low',
      resolution: null,
      unit: 'meters',
      warning: 'Depth estimated - no bathymetry data available'
    };
  }

  /**
   * Get depth grid for an area (for visualization and interpolation)
   * @param {Object} bounds - { north, south, east, west }
   * @param {Number} resolution - Grid resolution in degrees
   * @returns {Object} - { grid, bounds, resolution }
   */
  async getDepthGrid(bounds, resolution = 0.005) {
    const grid = [];
    
    for (let lat = bounds.south; lat <= bounds.north; lat += resolution) {
      const row = [];
      for (let lng = bounds.west; lng <= bounds.east; lng += resolution) {
        const depthData = await this.getDepth(lat, lng);
        row.push({
          lat,
          lng,
          depth: depthData.depth,
          source: depthData.source
        });
      }
      grid.push(row);
    }

    return {
      grid,
      bounds,
      resolution,
      rows: grid.length,
      cols: grid[0]?.length || 0
    };
  }

  /**
   * Calculate bathymetry gradient at a point
   * Used for topographic steering calculations
   */
  async getBathymetryGradient(lat, lng, delta = 0.001) {
    const [depthCenter, depthNorth, depthSouth, depthEast, depthWest] = await Promise.all([
      this.getDepth(lat, lng),
      this.getDepth(lat + delta, lng),
      this.getDepth(lat - delta, lng),
      this.getDepth(lat, lng + delta),
      this.getDepth(lat, lng - delta)
    ]);

    // Calculate gradients (change in depth per degree)
    const dzdx = (depthEast.depth - depthWest.depth) / (2 * delta); // East-West gradient
    const dzdy = (depthNorth.depth - depthSouth.depth) / (2 * delta); // North-South gradient

    // Gradient magnitude and direction
    const magnitude = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
    const direction = Math.atan2(dzdx, dzdy) * 180 / Math.PI;

    return {
      dzdx,
      dzdy,
      magnitude,
      direction,
      centerDepth: depthCenter.depth
    };
  }

  /**
   * Get depth contours for visualization
   */
  async getDepthContours(bounds, contourLevels = [2, 5, 10, 20, 50, 100]) {
    const grid = await this.getDepthGrid(bounds, 0.002);
    const contours = [];

    // Simple contour extraction (would use marching squares in production)
    for (const level of contourLevels) {
      const contourPoints = [];
      
      for (let i = 0; i < grid.grid.length; i++) {
        for (let j = 0; j < grid.grid[i].length; j++) {
          const depth = grid.grid[i][j].depth;
          if (Math.abs(depth - level) < 1) {
            contourPoints.push({
              lat: grid.grid[i][j].lat,
              lng: grid.grid[i][j].lng
            });
          }
        }
      }

      if (contourPoints.length > 0) {
        contours.push({
          depth: level,
          points: contourPoints,
          color: this.getContourColor(level)
        });
      }
    }

    return contours;
  }

  /**
   * Get color for depth contour visualization
   */
  getContourColor(depth) {
    if (depth <= 2) return '#ff0000';      // Red - very shallow
    if (depth <= 5) return '#ff6600';      // Orange - shallow
    if (depth <= 10) return '#ffcc00';     // Yellow - moderate shallow
    if (depth <= 20) return '#00cc66';     // Green - moderate
    if (depth <= 50) return '#0099cc';     // Light blue - deep
    return '#003366';                       // Dark blue - very deep
  }

  /**
   * Check if location is on land
   */
  async isOnLand(lat, lng) {
    const depth = await this.getDepth(lat, lng);
    return depth.depth <= 0;
  }

  /**
   * Get shore type based on location characteristics
   * Would use NOAA ESI (Environmental Sensitivity Index) in production
   */
  async getShoreType(lat, lng) {
    // In production, query NOAA ESI database
    // For now, return default
    return {
      type: 'sandy',
      confidence: 'low',
      source: 'default'
    };
  }

  /**
   * Cache management
   */
  getCacheKey(lat, lng) {
    // Round to grid resolution for consistent caching
    const gridLat = Math.round(lat / this.gridResolution) * this.gridResolution;
    const gridLng = Math.round(lng / this.gridResolution) * this.gridResolution;
    return `${gridLat.toFixed(4)},${gridLng.toFixed(4)}`;
  }

  cacheDepth(key, data) {
    // Limit cache size
    if (this.depthCache.size >= this.cacheMaxSize) {
      // Remove oldest entries
      const keysToDelete = Array.from(this.depthCache.keys()).slice(0, 1000);
      keysToDelete.forEach(k => this.depthCache.delete(k));
    }

    this.depthCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.depthCache.clear();
  }
}

module.exports = BathymetryService;
