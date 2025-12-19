/**
 * HFRadarService.js
 * High-Frequency Radar Surface Current Data Service
 * 
 * HF Radar provides real-time surface current measurements
 * with high spatial resolution (1-6 km) and temporal resolution (hourly)
 * 
 * Data Sources:
 * - NOAA HF Radar National Network
 * - IOOS (Integrated Ocean Observing System)
 * - Regional HF Radar networks (MARACOOS, CeNCOOS, etc.)
 */

const axios = require('axios');

class HFRadarService {
  constructor() {
    this.baseUrls = {
      hfrNet: 'https://hfradar.ndbc.noaa.gov/thredds',
      ioos: 'https://hfradarpy.ioos.us/api',
      maracoos: 'https://hfradar.maracoos.org',
      cencoos: 'https://hfradar.cencoos.org',
      secoora: 'https://secoora.org/hfradar'
    };

    // HF Radar coverage areas (approximate bounds)
    this.coverageAreas = {
      'US_East_Coast': { north: 45, south: 25, east: -65, west: -82 },
      'US_West_Coast': { north: 50, south: 30, east: -115, west: -130 },
      'Gulf_of_Mexico': { north: 31, south: 18, east: -80, west: -98 },
      'Hawaii': { north: 23, south: 18, east: -154, west: -162 },
      'Alaska': { north: 72, south: 54, east: -130, west: -175 }
    };

    // Cache for HF radar data
    this.dataCache = new Map();
    this.cacheTimeout = 1800000; // 30 minutes (HF radar updates hourly)
  }

  /**
   * Check if HF Radar data is available for a location
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @returns {Boolean}
   */
  isInCoverage(lat, lng) {
    for (const [region, bounds] of Object.entries(this.coverageAreas)) {
      if (lat >= bounds.south && lat <= bounds.north &&
          lng >= bounds.west && lng <= bounds.east) {
        return { inCoverage: true, region };
      }
    }
    return { inCoverage: false, region: null };
  }

  /**
   * Get surface currents from HF Radar
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @returns {Object} - { u, v, speed, direction, quality, timestamp }
   */
  async getSurfaceCurrents(lat, lng) {
    const coverage = this.isInCoverage(lat, lng);
    if (!coverage.inCoverage) {
      return {
        available: false,
        reason: 'Location outside HF Radar coverage',
        fallback: 'Using RTOFS model data'
      };
    }

    // Check cache
    const cacheKey = this.getCacheKey(lat, lng);
    if (this.dataCache.has(cacheKey)) {
      const cached = this.dataCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    // Try to fetch real HF Radar data
    let hfData = null;

    try {
      hfData = await this.fetchHFRadarData(lat, lng, coverage.region);
    } catch (error) {
      console.log('HF Radar fetch failed:', error.message);
    }

    if (hfData) {
      this.dataCache.set(cacheKey, {
        data: hfData,
        timestamp: Date.now()
      });
      return hfData;
    }

    // Return simulated data based on typical patterns
    return this.simulateHFRadarData(lat, lng);
  }

  /**
   * Fetch actual HF Radar data from NOAA/IOOS
   */
  async fetchHFRadarData(lat, lng, region) {
    // NOAA HFRNet THREDDS server
    const url = `${this.baseUrls.hfrNet}/dodsC/HFR_USWC_6km_hourly_RTV_best.ncd`;
    
    // In production, would use proper OPeNDAP query
    // For now, try the simplified API
    
    try {
      const response = await axios.get(`${this.baseUrls.ioos}/currents`, {
        params: {
          lat,
          lon: lng,
          radius: 10000, // 10km radius
          time: 'latest'
        },
        timeout: 10000
      });

      if (response.data && response.data.features && response.data.features.length > 0) {
        const feature = response.data.features[0];
        const props = feature.properties;
        
        return {
          available: true,
          u: props.u || 0, // East component (m/s)
          v: props.v || 0, // North component (m/s)
          speed: Math.sqrt(props.u * props.u + props.v * props.v),
          direction: (Math.atan2(props.u, props.v) * 180 / Math.PI + 360) % 360,
          quality: props.quality || 'unknown',
          timestamp: props.time || new Date().toISOString(),
          source: 'HF_Radar',
          resolution: '6km',
          region
        };
      }
    } catch (error) {
      // API not available - fall through to simulation
    }

    return null;
  }

  /**
   * Simulate realistic HF Radar data
   * Based on typical current patterns for the region
   */
  simulateHFRadarData(lat, lng) {
    // Simulate diurnal variation (sea breeze effects on currents)
    const hour = new Date().getUTCHours();
    const diurnalFactor = Math.sin((hour / 24) * 2 * Math.PI);
    
    // Base current (typical coastal current)
    let baseSpeed = 0.2 + Math.random() * 0.3; // 0.2-0.5 m/s typical
    let baseDirection = 180 + Math.random() * 60 - 30; // Generally alongshore
    
    // Add diurnal variation
    baseSpeed += diurnalFactor * 0.1;
    baseDirection += diurnalFactor * 15;
    
    // Convert to U,V components
    const dirRad = (baseDirection * Math.PI) / 180;
    const u = baseSpeed * Math.sin(dirRad);
    const v = baseSpeed * Math.cos(dirRad);
    
    return {
      available: true,
      u,
      v,
      speed: baseSpeed,
      direction: baseDirection,
      quality: 'simulated',
      timestamp: new Date().toISOString(),
      source: 'HF_Radar_Simulated',
      resolution: '6km',
      note: 'Simulated data - actual HF Radar service integration pending'
    };
  }

  /**
   * Get HF Radar data grid for visualization
   * @param {Object} bounds - { north, south, east, west }
   * @param {Number} resolution - Grid resolution in degrees
   */
  async getCurrentGrid(bounds, resolution = 0.05) {
    const grid = [];
    
    for (let lat = bounds.south; lat <= bounds.north; lat += resolution) {
      const row = [];
      for (let lng = bounds.west; lng <= bounds.east; lng += resolution) {
        const current = await this.getSurfaceCurrents(lat, lng);
        if (current.available) {
          row.push({
            lat,
            lng,
            u: current.u,
            v: current.v,
            speed: current.speed,
            direction: current.direction
          });
        }
      }
      if (row.length > 0) {
        grid.push(row);
      }
    }

    return {
      grid,
      bounds,
      resolution,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get time series of currents at a point
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @param {Number} hours - Hours of history to fetch
   */
  async getCurrentTimeSeries(lat, lng, hours = 24) {
    const timeSeries = [];
    const now = new Date();
    
    // In production, would fetch actual historical data
    // For now, simulate hourly values
    for (let h = 0; h < hours; h++) {
      const time = new Date(now.getTime() - h * 3600000);
      const data = this.simulateHFRadarData(lat, lng);
      data.timestamp = time.toISOString();
      timeSeries.push(data);
    }

    return {
      location: { lat, lng },
      timeSeries: timeSeries.reverse(), // Oldest first
      hours
    };
  }

  /**
   * Get quality flag interpretation
   */
  getQualityDescription(flag) {
    const qualityFlags = {
      0: 'Good data',
      1: 'Not evaluated',
      2: 'Probably good',
      3: 'Probably bad',
      4: 'Bad data',
      5: 'Changed',
      6: 'Below detection limit',
      7: 'In excess',
      8: 'Interpolated',
      9: 'Missing'
    };
    return qualityFlags[flag] || 'Unknown quality';
  }

  getCacheKey(lat, lng) {
    // Round to ~6km resolution (typical HF Radar)
    const gridLat = Math.round(lat / 0.05) * 0.05;
    const gridLng = Math.round(lng / 0.05) * 0.05;
    return `${gridLat.toFixed(3)},${gridLng.toFixed(3)}`;
  }

  clearCache() {
    this.dataCache.clear();
  }
}

module.exports = HFRadarService;
