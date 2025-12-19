/**
 * CoastlineService.js
 * Provides coastline detection, land/water boundaries, and shore classification
 * 
 * Data Sources:
 * - NOAA Shoreline Data (high-resolution US coastlines)
 * - NOAA ESI (Environmental Sensitivity Index) for shore types
 * - OpenStreetMap coastlines (global fallback)
 * - GSHHS (Global Self-consistent Hierarchical High-resolution Shorelines)
 */

const axios = require('axios');

class CoastlineService {
  constructor() {
    this.baseUrls = {
      noaaShoreline: 'https://coast.noaa.gov/arcgis/rest/services/Shoreline',
      noaaEsi: 'https://coast.noaa.gov/arcgis/rest/services/ESI',
      osmCoastline: 'https://nominatim.openstreetmap.org'
    };

    // Cache for land/water lookups
    this.landCache = new Map();
    this.cacheResolution = 0.0005; // ~50m resolution
    
    // Shore type classification from NOAA ESI
    this.esiShoreTypes = {
      '1A': { type: 'rocky', name: 'Exposed rocky shores', stickiness: 0.9 },
      '1B': { type: 'rocky', name: 'Exposed rocky cliffs', stickiness: 0.85 },
      '2A': { type: 'rocky', name: 'Exposed wave-cut platforms', stickiness: 0.8 },
      '3A': { type: 'sandy', name: 'Fine-grained sand beaches', stickiness: 0.5 },
      '3B': { type: 'sandy', name: 'Scarps in sand', stickiness: 0.6 },
      '4': { type: 'sandy', name: 'Coarse-grained sand beaches', stickiness: 0.55 },
      '5': { type: 'sandy', name: 'Mixed sand and gravel beaches', stickiness: 0.6 },
      '6A': { type: 'riprap', name: 'Gravel beaches', stickiness: 0.65 },
      '6B': { type: 'riprap', name: 'Riprap', stickiness: 0.4 },
      '7': { type: 'rocky', name: 'Exposed tidal flats', stickiness: 0.7 },
      '8A': { type: 'muddy', name: 'Sheltered rocky shores', stickiness: 0.85 },
      '8B': { type: 'muddy', name: 'Sheltered scarps in clay', stickiness: 0.9 },
      '8C': { type: 'seawall', name: 'Sheltered seawalls', stickiness: 0.15 },
      '9A': { type: 'muddy', name: 'Sheltered tidal flats', stickiness: 0.95 },
      '9B': { type: 'muddy', name: 'Vegetated low banks', stickiness: 0.85 },
      '10A': { type: 'marsh', name: 'Salt/brackish marsh', stickiness: 1.0 },
      '10B': { type: 'marsh', name: 'Freshwater marsh', stickiness: 1.0 },
      '10C': { type: 'mangrove', name: 'Swamps', stickiness: 1.0 },
      '10D': { type: 'mangrove', name: 'Mangroves', stickiness: 1.0 }
    };
  }

  /**
   * Check if a point is on land or water
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @returns {Object} - { isLand, confidence, source }
   */
  async isOnLand(lat, lng) {
    // Check cache
    const cacheKey = this.getCacheKey(lat, lng);
    if (this.landCache.has(cacheKey)) {
      return this.landCache.get(cacheKey);
    }

    let result = null;

    // Try NOAA shoreline service first
    try {
      result = await this.checkNoaaShoreline(lat, lng);
      if (result !== null) {
        this.landCache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.log('NOAA shoreline check failed:', error.message);
    }

    // Fallback to OSM
    try {
      result = await this.checkOsmLand(lat, lng);
      if (result !== null) {
        this.landCache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.log('OSM land check failed:', error.message);
    }

    // Default to water if no data
    result = { isLand: false, confidence: 'low', source: 'default' };
    this.landCache.set(cacheKey, result);
    return result;
  }

  /**
   * Check land/water using NOAA shoreline data
   */
  async checkNoaaShoreline(lat, lng) {
    const url = `${this.baseUrls.noaaShoreline}/Shoreline_Composite/MapServer/identify`;
    
    const params = {
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      layers: 'all',
      tolerance: 5,
      mapExtent: `${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}`,
      imageDisplay: '400,400,96',
      returnGeometry: false,
      f: 'json'
    };

    const response = await axios.get(url, { params, timeout: 5000 });
    
    if (response.data && response.data.results) {
      // If we get shoreline features nearby, we're near coast
      // Need to determine which side
      return {
        isLand: response.data.results.length > 0,
        confidence: 'medium',
        source: 'NOAA_Shoreline'
      };
    }

    return null;
  }

  /**
   * Check land/water using OpenStreetMap Nominatim
   */
  async checkOsmLand(lat, lng) {
    const url = `${this.baseUrls.osmCoastline}/reverse`;
    
    const params = {
      lat,
      lon: lng,
      format: 'json',
      zoom: 18
    };

    const response = await axios.get(url, { 
      params, 
      timeout: 5000,
      headers: { 'User-Agent': 'RescueGPS-SAR/1.0' }
    });
    
    if (response.data) {
      // If we get an address, it's land
      // If error or no result, likely water
      const isLand = response.data.address !== undefined;
      return {
        isLand,
        confidence: 'medium',
        source: 'OSM'
      };
    }

    return null;
  }

  /**
   * Get shore type/classification at a coastal point
   * Uses NOAA ESI (Environmental Sensitivity Index)
   */
  async getShoreType(lat, lng) {
    try {
      const url = `${this.baseUrls.noaaEsi}/ESI_All/MapServer/identify`;
      
      const params = {
        geometry: `${lng},${lat}`,
        geometryType: 'esriGeometryPoint',
        layers: 'all',
        tolerance: 100, // 100 pixel tolerance to find nearby shore
        mapExtent: `${lng-0.02},${lat-0.02},${lng+0.02},${lat+0.02}`,
        imageDisplay: '400,400,96',
        returnGeometry: false,
        f: 'json'
      };

      const response = await axios.get(url, { params, timeout: 5000 });
      
      if (response.data && response.data.results && response.data.results.length > 0) {
        const esiResult = response.data.results[0];
        const esiCode = esiResult.attributes?.ESI || esiResult.attributes?.ESI_CODE;
        
        if (esiCode && this.esiShoreTypes[esiCode]) {
          return {
            ...this.esiShoreTypes[esiCode],
            esiCode,
            confidence: 'high',
            source: 'NOAA_ESI'
          };
        }
      }
    } catch (error) {
      console.log('ESI shore type lookup failed:', error.message);
    }

    // Default to sandy beach
    return {
      type: 'sandy',
      name: 'Unknown shore type',
      stickiness: 0.6,
      confidence: 'low',
      source: 'default'
    };
  }

  /**
   * Get distance and direction to nearest shore
   * @param {Number} lat - Latitude  
   * @param {Number} lng - Longitude
   * @returns {Object} - { distance, direction, shoreType }
   */
  async getDistanceToShore(lat, lng) {
    // Search in expanding circles until we find land
    const searchRadii = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2]; // degrees
    const directions = 16; // Check 16 directions
    
    for (const radius of searchRadii) {
      for (let i = 0; i < directions; i++) {
        const angle = (i / directions) * 2 * Math.PI;
        const testLat = lat + radius * Math.cos(angle);
        const testLng = lng + radius * Math.sin(angle);
        
        const landCheck = await this.isOnLand(testLat, testLng);
        
        if (landCheck.isLand) {
          // Found land - calculate distance and direction
          const distanceKm = radius * 111.32; // Approximate km
          const directionDeg = (angle * 180 / Math.PI + 360) % 360;
          
          // Get shore type at this location
          const shoreType = await this.getShoreType(testLat, testLng);
          
          return {
            distance: distanceKm,
            direction: directionDeg,
            shorePoint: { lat: testLat, lng: testLng },
            shoreType,
            confidence: landCheck.confidence
          };
        }
      }
    }

    // No land found within search radius
    return {
      distance: null,
      direction: null,
      shoreType: null,
      confidence: 'none',
      note: 'No land found within 20km'
    };
  }

  /**
   * Get shore normal (perpendicular direction to coastline)
   * Used for wave approach angle calculations
   */
  async getShoreNormal(lat, lng) {
    const shoreInfo = await this.getDistanceToShore(lat, lng);
    
    if (shoreInfo.distance !== null) {
      // Shore normal points offshore (opposite of direction to shore)
      const shoreNormal = (shoreInfo.direction + 180) % 360;
      return {
        normal: shoreNormal,
        confidence: shoreInfo.confidence
      };
    }

    return { normal: null, confidence: 'none' };
  }

  /**
   * Get coastline polyline for visualization
   * @param {Object} bounds - { north, south, east, west }
   * @returns {Array} - Array of coastline segments
   */
  async getCoastlinePolyline(bounds) {
    try {
      const url = `${this.baseUrls.noaaShoreline}/Shoreline_Composite/MapServer/0/query`;
      
      const params = {
        geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
        geometryType: 'esriGeometryEnvelope',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: true,
        f: 'json'
      };

      const response = await axios.get(url, { params, timeout: 10000 });
      
      if (response.data && response.data.features) {
        return response.data.features.map(feature => ({
          geometry: feature.geometry,
          attributes: feature.attributes
        }));
      }
    } catch (error) {
      console.log('Coastline fetch failed:', error.message);
    }

    return [];
  }

  /**
   * Find all land polygons in area (for exclusion zones)
   */
  async getLandPolygons(bounds) {
    // In production, would query NOAA or OSM for land polygons
    // These would be used to exclude particles from drifting onto land
    return [];
  }

  /**
   * Cache management
   */
  getCacheKey(lat, lng) {
    const gridLat = Math.round(lat / this.cacheResolution) * this.cacheResolution;
    const gridLng = Math.round(lng / this.cacheResolution) * this.cacheResolution;
    return `${gridLat.toFixed(5)},${gridLng.toFixed(5)}`;
  }

  clearCache() {
    this.landCache.clear();
  }
}

module.exports = CoastlineService;
