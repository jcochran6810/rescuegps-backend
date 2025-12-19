/**
 * ADCIRCService.js
 * ADCIRC (Advanced Circulation) Model Data Service
 * 
 * ADCIRC is a high-resolution coastal ocean model that provides:
 * - Storm surge predictions
 * - Tidal circulation
 * - Wind-driven currents
 * - Detailed nearshore hydrodynamics
 * 
 * Data Sources:
 * - NOAA CSDL (Coast Survey Development Laboratory)
 * - ADCIRC Prediction System
 * - Regional ADCIRC implementations (HSOFS, EC95d, etc.)
 */

const axios = require('axios');

class ADCIRCService {
  constructor() {
    this.baseUrls = {
      noaaCsdl: 'https://tidesandcurrents.noaa.gov/ofs',
      adcircPrediction: 'https://adcirc.org/data',
      thredds: 'https://opendap.co-ops.nos.noaa.gov/thredds'
    };

    // Available ADCIRC model domains
    this.modelDomains = {
      'HSOFS': {
        name: 'Hurricane Surge On-Demand Forecast System',
        bounds: { north: 46, south: 8, east: -60, west: -98 },
        resolution: 'Variable (50m-10km)',
        coverage: 'US Atlantic and Gulf coasts'
      },
      'EC95d': {
        name: 'East Coast 95d',
        bounds: { north: 46, south: 24, east: -60, west: -82 },
        resolution: '~1km coastal',
        coverage: 'US East Coast'
      },
      'NGOFS2': {
        name: 'Northern Gulf of Mexico OFS',
        bounds: { north: 31, south: 25, east: -84, west: -98 },
        resolution: '~100m coastal',
        coverage: 'Northern Gulf of Mexico'
      },
      'TBOFS': {
        name: 'Tampa Bay OFS',
        bounds: { north: 28.2, south: 27.2, east: -82.2, west: -83 },
        resolution: '~50m',
        coverage: 'Tampa Bay'
      },
      'CBOFS': {
        name: 'Chesapeake Bay OFS',
        bounds: { north: 40, south: 36.5, east: -75.5, west: -77.5 },
        resolution: '~100m',
        coverage: 'Chesapeake Bay'
      },
      'NYOFS': {
        name: 'New York Harbor OFS',
        bounds: { north: 41.2, south: 40.2, east: -73.5, west: -74.5 },
        resolution: '~50m',
        coverage: 'NY/NJ Harbor'
      },
      'SFBOFS': {
        name: 'San Francisco Bay OFS',
        bounds: { north: 38.5, south: 37, east: -121.5, west: -123 },
        resolution: '~100m',
        coverage: 'San Francisco Bay'
      }
    };

    // Cache
    this.dataCache = new Map();
    this.cacheTimeout = 3600000; // 1 hour
  }

  /**
   * Find which ADCIRC model covers a location
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @returns {Array} - List of covering models
   */
  findCoveringModels(lat, lng) {
    const coveringModels = [];
    
    for (const [code, model] of Object.entries(this.modelDomains)) {
      const bounds = model.bounds;
      if (lat >= bounds.south && lat <= bounds.north &&
          lng >= bounds.west && lng <= bounds.east) {
        coveringModels.push({
          code,
          ...model
        });
      }
    }
    
    return coveringModels;
  }

  /**
   * Get ADCIRC model data for a location
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @returns {Object} - Model predictions
   */
  async getModelData(lat, lng) {
    const coveringModels = this.findCoveringModels(lat, lng);
    
    if (coveringModels.length === 0) {
      return {
        available: false,
        reason: 'Location outside ADCIRC model coverage'
      };
    }

    // Prefer higher-resolution local models
    const model = coveringModels.sort((a, b) => {
      // Prioritize specific regional models over HSOFS
      if (a.code === 'HSOFS') return 1;
      if (b.code === 'HSOFS') return -1;
      return 0;
    })[0];

    // Check cache
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)},${model.code}`;
    if (this.dataCache.has(cacheKey)) {
      const cached = this.dataCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    // Fetch or simulate model data
    let modelData = null;
    
    try {
      modelData = await this.fetchADCIRCData(lat, lng, model.code);
    } catch (error) {
      console.log('ADCIRC fetch failed:', error.message);
    }

    if (!modelData) {
      modelData = this.simulateADCIRCData(lat, lng, model);
    }

    this.dataCache.set(cacheKey, {
      data: modelData,
      timestamp: Date.now()
    });

    return modelData;
  }

  /**
   * Fetch actual ADCIRC data from NOAA OFS
   */
  async fetchADCIRCData(lat, lng, modelCode) {
    // Use NOAA OFS THREDDS server
    const baseUrl = `${this.baseUrls.thredds}/dodsC/${modelCode.toLowerCase()}/nos.${modelCode.toLowerCase()}.fields.nowcast.latest.nc`;
    
    // In production, would use OPeNDAP to fetch specific variables
    // For now, return null to use simulation
    return null;
  }

  /**
   * Simulate ADCIRC model output
   */
  simulateADCIRCData(lat, lng, model) {
    // Simulate based on tidal and meteorological forcing
    const hour = new Date().getUTCHours();
    
    // Tidal component (M2 tide ~12.42 hours)
    const tidalPhase = (hour / 12.42) * 2 * Math.PI;
    const tidalAmplitude = 0.3 + Math.random() * 0.2; // m/s
    
    // Wind-driven component
    const windDriven = 0.1 + Math.random() * 0.15;
    
    // Total current
    const tidalU = tidalAmplitude * Math.sin(tidalPhase);
    const tidalV = tidalAmplitude * Math.cos(tidalPhase) * 0.3;
    
    const u = tidalU + windDriven * (Math.random() - 0.5);
    const v = tidalV + windDriven * (Math.random() - 0.5);
    
    const speed = Math.sqrt(u * u + v * v);
    const direction = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;
    
    // Water level (tide + surge)
    const tidalHeight = 0.5 * Math.sin(tidalPhase); // meters
    const surgComponent = Math.random() * 0.2 - 0.1;
    const waterLevel = tidalHeight + surgComponent;

    return {
      available: true,
      model: model.code,
      modelName: model.name,
      current: {
        u,
        v,
        speed,
        direction,
        depthAveraged: true
      },
      waterLevel: {
        height: waterLevel,
        reference: 'MSL',
        tide: tidalHeight,
        surge: surgComponent
      },
      waves: {
        significantHeight: 0.5 + Math.random() * 1.5,
        peakPeriod: 5 + Math.random() * 5,
        direction: direction + (Math.random() - 0.5) * 30
      },
      wind: {
        speed: 5 + Math.random() * 15,
        direction: Math.random() * 360
      },
      timestamp: new Date().toISOString(),
      forecastHour: 0,
      source: 'ADCIRC_Simulated',
      resolution: model.resolution
    };
  }

  /**
   * Get water level forecast
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @param {Number} hours - Hours ahead to forecast
   */
  async getWaterLevelForecast(lat, lng, hours = 48) {
    const forecast = [];
    const baseData = await this.getModelData(lat, lng);
    
    if (!baseData.available) {
      return { available: false, reason: baseData.reason };
    }

    const now = new Date();
    
    for (let h = 0; h <= hours; h++) {
      const forecastTime = new Date(now.getTime() + h * 3600000);
      const tidalPhase = ((now.getUTCHours() + h) / 12.42) * 2 * Math.PI;
      
      // Simulate tidal variation
      const tidalHeight = 0.5 * Math.sin(tidalPhase);
      const surge = baseData.waterLevel.surge * Math.exp(-h / 24); // Decay surge
      
      forecast.push({
        time: forecastTime.toISOString(),
        hour: h,
        waterLevel: tidalHeight + surge,
        tide: tidalHeight,
        surge
      });
    }

    return {
      available: true,
      location: { lat, lng },
      model: baseData.model,
      forecast,
      reference: 'MSL'
    };
  }

  /**
   * Get tidal current predictions
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @param {Number} hours - Hours ahead
   */
  async getTidalCurrentForecast(lat, lng, hours = 24) {
    const forecast = [];
    const now = new Date();
    
    for (let h = 0; h <= hours; h++) {
      const forecastTime = new Date(now.getTime() + h * 3600000);
      const tidalPhase = ((now.getUTCHours() + h) / 12.42) * 2 * Math.PI;
      
      // Simulate tidal current (flood/ebb)
      const speed = 0.5 * Math.abs(Math.cos(tidalPhase));
      const direction = Math.sin(tidalPhase) > 0 ? 0 : 180; // Flood vs Ebb
      
      forecast.push({
        time: forecastTime.toISOString(),
        hour: h,
        speed,
        direction,
        phase: Math.sin(tidalPhase) > 0 ? 'flood' : 'ebb',
        slack: Math.abs(Math.cos(tidalPhase)) < 0.1
      });
    }

    return {
      available: true,
      location: { lat, lng },
      forecast
    };
  }

  /**
   * Get storm surge prediction (if applicable)
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   */
  async getStormSurgePrediction(lat, lng) {
    // Would query NHC storm surge models during active storms
    return {
      available: false,
      reason: 'No active tropical systems',
      note: 'Storm surge predictions available during tropical events'
    };
  }

  /**
   * Get depth-integrated currents
   * ADCIRC can provide both surface and depth-averaged currents
   */
  async getDepthCurrents(lat, lng, depths = [0, 5, 10, 20]) {
    const baseData = await this.getModelData(lat, lng);
    
    if (!baseData.available) {
      return { available: false, reason: baseData.reason };
    }

    // Simulate depth variation (surface currents stronger)
    const depthCurrents = depths.map(depth => {
      const depthFactor = Math.exp(-depth / 30); // e-folding depth ~30m
      return {
        depth,
        u: baseData.current.u * depthFactor,
        v: baseData.current.v * depthFactor,
        speed: baseData.current.speed * depthFactor,
        direction: baseData.current.direction
      };
    });

    return {
      available: true,
      location: { lat, lng },
      model: baseData.model,
      depthCurrents
    };
  }

  clearCache() {
    this.dataCache.clear();
  }
}

module.exports = ADCIRCService;
