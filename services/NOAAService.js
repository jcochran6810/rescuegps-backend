/**
 * NOAAService.js
 * PRODUCTION service for fetching REAL environmental data from NOAA APIs
 * 
 * WORKS ANYWHERE IN THE USA - Dynamically discovers nearest stations
 * 
 * Data Sources (All FREE, No API Keys):
 * - CO-OPS: Tides, water levels, currents (tidesandcurrents.noaa.gov)
 * - NDBC: Buoy data - wind, waves, temps (ndbc.noaa.gov)
 * - NWS: Weather forecasts (api.weather.gov)
 */

const axios = require('axios');

class NOAAService {
  constructor() {
    // NOAA API base URLs
    this.baseUrls = {
      coops: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
      coopsMeta: 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json',
      ndbc: 'https://www.ndbc.noaa.gov/data/realtime2',
      ndbcStations: 'https://www.ndbc.noaa.gov/data/stations/station_table.txt',
      ndbcActive: 'https://www.ndbc.noaa.gov/activestations.xml',
      weather: 'https://api.weather.gov'
    };

    // Cache for API responses (3 minute default)
    this.cache = new Map();
    this.cacheTimeout = 3 * 60 * 1000;
    
    // Station cache (24 hours - stations don't move)
    this.stationCache = new Map();
    this.stationCacheTimeout = 24 * 60 * 60 * 1000;
    
    // National station lists (loaded on first request)
    this.tideStations = null;
    this.currentStations = null;
    this.buoyStations = null;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in nautical miles
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Format date for NOAA CO-OPS API (YYYYMMDD HH:MM)
   */
  formatDateCOOPS(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}${month}${day} ${hours}:${minutes}`;
  }

  // ============================================
  // CACHE MANAGEMENT
  // ============================================
  
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  getStationCached(key) {
    const cached = this.stationCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.stationCacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setStationCache(key, data) {
    this.stationCache.set(key, { data, timestamp: Date.now() });
  }

  // ============================================
  // DYNAMIC STATION DISCOVERY - NATIONWIDE
  // ============================================

  /**
   * Load ALL NOAA tide/water level stations in the US
   * Called once, then cached for 24 hours
   */
  async loadTideStations() {
    const cached = this.getStationCached('tide_stations_national');
    if (cached) {
      this.tideStations = cached;
      return cached;
    }

    try {
      console.log('Loading national tide station database...');
      const response = await axios.get(this.baseUrls.coopsMeta, {
        params: { type: 'waterlevels', units: 'english' },
        timeout: 30000
      });

      const stations = (response.data.stations || [])
        .filter(s => s.lat && s.lng && s.state)
        .map(s => ({
          id: s.id,
          name: s.name,
          state: s.state,
          lat: parseFloat(s.lat),
          lng: parseFloat(s.lng),
          type: 'tide'
        }));

      console.log(`Loaded ${stations.length} tide stations nationwide`);
      this.tideStations = stations;
      this.setStationCache('tide_stations_national', stations);
      return stations;

    } catch (error) {
      console.error('Error loading tide stations:', error.message);
      return [];
    }
  }

  /**
   * Load ALL NOAA current stations in the US
   */
  async loadCurrentStations() {
    const cached = this.getStationCached('current_stations_national');
    if (cached) {
      this.currentStations = cached;
      return cached;
    }

    try {
      console.log('Loading national current station database...');
      const response = await axios.get(this.baseUrls.coopsMeta, {
        params: { type: 'currentpredictions', units: 'english' },
        timeout: 30000
      });

      const stations = (response.data.stations || [])
        .filter(s => s.lat && s.lng)
        .map(s => ({
          id: s.id,
          name: s.name,
          state: s.state || '',
          lat: parseFloat(s.lat),
          lng: parseFloat(s.lng),
          type: 'current'
        }));

      console.log(`Loaded ${stations.length} current stations nationwide`);
      this.currentStations = stations;
      this.setStationCache('current_stations_national', stations);
      return stations;

    } catch (error) {
      console.error('Error loading current stations:', error.message);
      return [];
    }
  }

  /**
   * Load ALL NDBC buoy stations
   * Parses the NDBC active stations list
   */
  async loadBuoyStations() {
    const cached = this.getStationCached('buoy_stations_national');
    if (cached) {
      this.buoyStations = cached;
      return cached;
    }

    try {
      console.log('Loading national buoy station database...');
      
      // NDBC provides station locations in their station table
      const response = await axios.get('https://www.ndbc.noaa.gov/data/stations/station_table.txt', {
        timeout: 30000
      });

      const lines = response.data.split('\n');
      const stations = [];

      for (const line of lines) {
        // Skip header lines
        if (line.startsWith('#') || line.startsWith('STATION') || !line.trim()) continue;
        
        // Parse: STATION|OWNER|TTYPE|HULL|NAME|PAYLOAD|LOCATION|TIMEZONE|FORECAST|NOTE
        const parts = line.split('|');
        if (parts.length >= 6) {
          const id = parts[0]?.trim();
          const name = parts[4]?.trim() || id;
          const location = parts[5]?.trim() || '';
          
          // Parse location like "29.232 N 94.413 W"
          const locMatch = location.match(/([\d.]+)\s*([NS])\s+([\d.]+)\s*([EW])/);
          if (locMatch) {
            let lat = parseFloat(locMatch[1]);
            let lng = parseFloat(locMatch[3]);
            if (locMatch[2] === 'S') lat = -lat;
            if (locMatch[4] === 'W') lng = -lng;
            
            stations.push({
              id,
              name,
              lat,
              lng,
              type: 'buoy'
            });
          }
        }
      }

      console.log(`Loaded ${stations.length} buoy stations nationwide`);
      this.buoyStations = stations;
      this.setStationCache('buoy_stations_national', stations);
      return stations;

    } catch (error) {
      console.error('Error loading buoy stations:', error.message);
      
      // Fallback to known major buoys if the station table fails
      const fallbackBuoys = [
        { id: '42035', name: 'Galveston 22NM', lat: 29.232, lng: -94.413 },
        { id: '42019', name: 'Freeport, TX', lat: 27.913, lng: -95.360 },
        { id: '42020', name: 'Corpus Christi', lat: 26.966, lng: -96.694 },
        { id: '42001', name: 'Mid Gulf', lat: 25.888, lng: -89.658 },
        { id: '44013', name: 'Boston 16NM', lat: 42.346, lng: -70.651 },
        { id: '44025', name: 'Long Island', lat: 40.251, lng: -73.164 },
        { id: '46025', name: 'Santa Monica Basin', lat: 33.749, lng: -119.053 },
        { id: '46026', name: 'San Francisco', lat: 37.759, lng: -122.833 },
        { id: '46050', name: 'Stonewall Banks', lat: 44.641, lng: -124.500 },
        { id: '45007', name: 'Michigan City', lat: 42.674, lng: -87.026 },
        { id: 'KPTN6', name: 'Kings Point, NY', lat: 40.810, lng: -73.765 },
        { id: 'BURL1', name: 'Southwest Pass, LA', lat: 28.905, lng: -89.428 },
      ];
      
      this.buoyStations = fallbackBuoys;
      return fallbackBuoys;
    }
  }

  /**
   * Find nearest stations to given coordinates
   * Dynamically searches the national database
   */
  async getNearestStations(lat, lng, radiusNm = 100) {
    // Ensure station databases are loaded
    if (!this.tideStations) await this.loadTideStations();
    if (!this.currentStations) await this.loadCurrentStations();
    if (!this.buoyStations) await this.loadBuoyStations();

    const findNearest = (stations, maxResults = 5) => {
      if (!stations || stations.length === 0) return [];
      
      return stations
        .map(s => ({
          ...s,
          distance: this.calculateDistance(lat, lng, s.lat, s.lng)
        }))
        .filter(s => s.distance <= radiusNm)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxResults);
    };

    const result = {
      tides: findNearest(this.tideStations || [], 5),
      currents: findNearest(this.currentStations || [], 5),
      buoys: findNearest(this.buoyStations || [], 5),
      searchLocation: { lat, lng },
      searchRadius: radiusNm
    };

    console.log(`Found stations near ${lat.toFixed(3)}, ${lng.toFixed(3)}:`);
    console.log(`  Tides: ${result.tides.length} (nearest: ${result.tides[0]?.name || 'none'})`);
    console.log(`  Currents: ${result.currents.length} (nearest: ${result.currents[0]?.name || 'none'})`);
    console.log(`  Buoys: ${result.buoys.length} (nearest: ${result.buoys[0]?.name || 'none'})`);

    return result;
  }

  // ============================================
  // DATA FETCHING METHODS
  // ============================================

  /**
   * GET TIDE PREDICTIONS from CO-OPS
   */
  async getTidePredictions(stationId) {
    const cacheKey = `tides_${stationId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        product: 'predictions',
        application: 'RescueGPS',
        begin_date: this.formatDateCOOPS(now),
        end_date: this.formatDateCOOPS(endDate),
        datum: 'MLLW',
        station: stationId,
        time_zone: 'lst_ldt',
        units: 'english',
        interval: 'hilo',
        format: 'json'
      });

      const response = await axios.get(`${this.baseUrls.coops}?${params}`, { timeout: 10000 });

      const data = {
        stationId,
        predictions: response.data.predictions || [],
        fetchedAt: new Date().toISOString()
      };

      this.setCache(cacheKey, data);
      return data;

    } catch (error) {
      console.error(`Error fetching tides for ${stationId}:`, error.message);
      return { stationId, predictions: [], error: error.message };
    }
  }

  /**
   * GET WATER LEVEL from CO-OPS (real-time observations)
   */
  async getWaterLevel(stationId) {
    const cacheKey = `waterlevel_${stationId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const now = new Date();
      const beginDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        product: 'water_level',
        application: 'RescueGPS',
        begin_date: this.formatDateCOOPS(beginDate),
        end_date: this.formatDateCOOPS(now),
        datum: 'MLLW',
        station: stationId,
        time_zone: 'lst_ldt',
        units: 'english',
        format: 'json'
      });

      const response = await axios.get(`${this.baseUrls.coops}?${params}`, { timeout: 10000 });
      const observations = response.data.data || [];
      const latest = observations[observations.length - 1];

      const data = {
        stationId,
        current: latest ? parseFloat(latest.v) : null,
        time: latest ? latest.t : null,
        fetchedAt: new Date().toISOString()
      };

      this.setCache(cacheKey, data);
      return data;

    } catch (error) {
      console.error(`Error fetching water level for ${stationId}:`, error.message);
      return { stationId, current: null, error: error.message };
    }
  }

  /**
   * GET CURRENT PREDICTIONS from CO-OPS
   */
  async getCurrentPredictions(stationId) {
    const cacheKey = `currents_${stationId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        product: 'currents_predictions',
        application: 'RescueGPS',
        begin_date: this.formatDateCOOPS(now),
        end_date: this.formatDateCOOPS(endDate),
        station: stationId,
        time_zone: 'lst_ldt',
        units: 'english',
        interval: '30',
        format: 'json'
      });

      const response = await axios.get(`${this.baseUrls.coops}?${params}`, { timeout: 10000 });
      const predictions = response.data.current_predictions?.cp || [];
      const current = predictions[0];

      const data = {
        stationId,
        current: current ? {
          speed: parseFloat(current.Speed),
          direction: current.Direction,
          time: current.Time,
          type: current.Type
        } : null,
        predictions: predictions.slice(0, 24),
        fetchedAt: new Date().toISOString()
      };

      this.setCache(cacheKey, data);
      return data;

    } catch (error) {
      console.error(`Error fetching currents for ${stationId}:`, error.message);
      return { stationId, current: null, predictions: [], error: error.message };
    }
  }

  /**
   * GET BUOY DATA from NDBC
   */
  async getBuoyData(buoyId) {
    const cacheKey = `buoy_${buoyId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const txtUrl = `${this.baseUrls.ndbc}/${buoyId}.txt`;
      const response = await axios.get(txtUrl, { 
        timeout: 10000,
        headers: { 'Accept': 'text/plain' }
      });

      const data = this.parseNDBCData(buoyId, response.data);
      this.setCache(cacheKey, data);
      return data;

    } catch (error) {
      console.error(`Error fetching buoy ${buoyId}:`, error.message);
      return { buoyId, error: error.message };
    }
  }

  /**
   * Parse NDBC standard text format
   */
  parseNDBCData(buoyId, rawData) {
    try {
      const lines = rawData.trim().split('\n');
      let headerLine = '';
      let dataLine = '';
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#YY')) {
          headerLine = lines[i].substring(1).trim();
        } else if (!lines[i].startsWith('#') && lines[i].trim()) {
          dataLine = lines[i].trim();
          break;
        }
      }

      if (!dataLine) return { buoyId, error: 'No data available' };

      const headers = headerLine.split(/\s+/);
      const values = dataLine.split(/\s+/);

      const getValue = (name) => {
        const idx = headers.indexOf(name);
        if (idx === -1) return null;
        const val = parseFloat(values[idx]);
        return isNaN(val) || val === 999 || val === 9999 || val === 99 ? null : val;
      };

      const msToKnots = (ms) => ms !== null ? ms * 1.944 : null;
      const cToF = (c) => c !== null ? (c * 9/5) + 32 : null;
      const mToFt = (m) => m !== null ? m * 3.28084 : null;

      return {
        buoyId,
        stationName: buoyId,
        timestamp: new Date().toISOString(),
        wind: {
          direction: getValue('WDIR'),
          speed: msToKnots(getValue('WSPD')),
          gusts: msToKnots(getValue('GST'))
        },
        waves: {
          height: mToFt(getValue('WVHT')),
          period: getValue('DPD'),
          direction: getValue('MWD')
        },
        air: {
          temperature: cToF(getValue('ATMP')),
          pressure: getValue('PRES')
        },
        water: {
          temperature: cToF(getValue('WTMP'))
        },
        visibility: getValue('VIS'),
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      return { buoyId, error: 'Parse error' };
    }
  }

  /**
   * GET WEATHER FORECAST from NWS
   */
  async getWeatherForecast(lat, lng) {
    const cacheKey = `weather_${lat.toFixed(2)}_${lng.toFixed(2)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const pointsUrl = `${this.baseUrls.weather}/points/${lat.toFixed(4)},${lng.toFixed(4)}`;
      const pointsResponse = await axios.get(pointsUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'RescueGPS (contact@universalhazard.com)' }
      });

      const forecastUrl = pointsResponse.data.properties.forecast;
      const forecastResponse = await axios.get(forecastUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'RescueGPS (contact@universalhazard.com)' }
      });

      const periods = forecastResponse.data.properties.periods || [];
      const current = periods[0];

      const data = {
        location: { lat, lng },
        current: current ? {
          name: current.name,
          temperature: current.temperature,
          temperatureUnit: current.temperatureUnit,
          windSpeed: current.windSpeed,
          windDirection: current.windDirection,
          shortForecast: current.shortForecast
        } : null,
        periods: periods.slice(0, 6),
        fetchedAt: new Date().toISOString()
      };

      this.setCache(cacheKey, data);
      return data;

    } catch (error) {
      console.error(`Error fetching weather for ${lat},${lng}:`, error.message);
      return { location: { lat, lng }, error: error.message };
    }
  }

  // ============================================
  // MAIN METHOD - GET ALL ENVIRONMENTAL DATA
  // ============================================

  /**
   * Get comprehensive environmental data for ANY US location
   * Automatically finds nearest stations
   */
  async getEnvironmentalData(lat, lng) {
    console.log(`\n========================================`);
    console.log(`Fetching environmental data for ${lat}, ${lng}`);
    console.log(`========================================`);

    // Find nearest stations dynamically
    const stations = await this.getNearestStations(lat, lng, 150);
    
    const nearestTide = stations.tides[0];
    const nearestCurrent = stations.currents[0];
    const nearestBuoy = stations.buoys[0];

    // Fetch all data in parallel
    const [tides, waterLevel, currents, buoy, weather] = await Promise.all([
      nearestTide ? this.getTidePredictions(nearestTide.id) : null,
      nearestTide ? this.getWaterLevel(nearestTide.id) : null,
      nearestCurrent ? this.getCurrentPredictions(nearestCurrent.id) : null,
      nearestBuoy ? this.getBuoyData(nearestBuoy.id) : null,
      this.getWeatherForecast(lat, lng)
    ]);

    // Determine tide state
    let tideState = 'unknown';
    if (tides?.predictions?.length >= 2) {
      const now = new Date();
      const upcoming = tides.predictions.filter(p => new Date(p.t) > now);
      if (upcoming.length > 0) {
        tideState = upcoming[0].type === 'H' ? 'rising' : 'falling';
      }
    }

    // Build summary
    const summary = {
      surfaceCurrent: {
        speed: currents?.current?.speed || null,
        direction: currents?.current?.direction || null,
        status: this.getCurrentStatus(currents?.current?.speed),
        station: nearestCurrent
      },
      wind: {
        speed: buoy?.wind?.speed || null,
        direction: buoy?.wind?.direction || null,
        gusts: buoy?.wind?.gusts || null,
        status: this.getWindStatus(buoy?.wind?.speed),
        station: nearestBuoy
      },
      waves: {
        height: buoy?.waves?.height || null,
        period: buoy?.waves?.period || null,
        direction: buoy?.waves?.direction || null,
        status: this.getWaveStatus(buoy?.waves?.height),
        station: nearestBuoy
      },
      waterTemp: {
        value: buoy?.water?.temperature || null,
        status: this.getWaterTempStatus(buoy?.water?.temperature),
        station: nearestBuoy
      },
      airTemp: {
        value: buoy?.air?.temperature || weather?.current?.temperature || null,
        station: nearestBuoy
      },
      waterLevel: {
        value: waterLevel?.current || null,
        station: nearestTide
      },
      tideState: {
        state: tideState,
        nextChange: tides?.predictions?.[0]?.t || null,
        nextType: tides?.predictions?.[0]?.type === 'H' ? 'High' : 'Low',
        station: nearestTide
      },
      visibility: {
        value: buoy?.visibility || 10,
        status: this.getVisibilityStatus(buoy?.visibility)
      },
      overallConditions: this.getOverallConditions(buoy, currents)
    };

    return {
      location: { lat, lng },
      summary,
      tides: { ...tides, stationName: nearestTide?.name, stationDistance: nearestTide?.distance },
      waterLevel: { ...waterLevel, stationName: nearestTide?.name },
      currents: { ...currents, stationName: nearestCurrent?.name, stationDistance: nearestCurrent?.distance },
      buoy: { ...buoy, stationName: nearestBuoy?.name, stationDistance: nearestBuoy?.distance },
      weather,
      stations,
      alternatives: {
        tides: stations.tides.slice(1, 4),
        currents: stations.currents.slice(1, 4),
        buoys: stations.buoys.slice(1, 4)
      },
      fetchedAt: new Date().toISOString()
    };
  }

  // Status helper methods
  getCurrentStatus(speed) {
    if (speed === null) return 'unknown';
    if (speed < 0.5) return 'slack';
    if (speed < 1.5) return 'moderate';
    if (speed < 2.5) return 'strong';
    return 'very_strong';
  }

  getWindStatus(speed) {
    if (speed === null) return 'unknown';
    if (speed < 10) return 'calm';
    if (speed < 20) return 'moderate';
    if (speed < 30) return 'strong';
    return 'severe';
  }

  getWaveStatus(height) {
    if (height === null) return 'unknown';
    if (height < 2) return 'calm';
    if (height < 4) return 'moderate';
    if (height < 6) return 'rough';
    return 'severe';
  }

  getWaterTempStatus(temp) {
    if (temp === null) return 'unknown';
    if (temp < 60) return 'cold';
    if (temp < 70) return 'cool';
    if (temp < 80) return 'warm';
    return 'warm';
  }

  getVisibilityStatus(vis) {
    if (vis === null) return 'unknown';
    if (vis >= 5) return 'good';
    if (vis >= 2) return 'moderate';
    return 'poor';
  }

  getOverallConditions(buoy, currents) {
    const factors = [];
    if (buoy?.wind?.speed > 25) factors.push('severe');
    else if (buoy?.wind?.speed > 15) factors.push('challenging');
    if (buoy?.waves?.height > 5) factors.push('severe');
    else if (buoy?.waves?.height > 3) factors.push('challenging');
    if (currents?.current?.speed > 2) factors.push('challenging');

    if (factors.includes('severe')) return 'hazardous';
    if (factors.includes('challenging')) return 'challenging';
    if (factors.length === 0) return 'favorable';
    return 'moderate';
  }
}

module.exports = NOAAService;
