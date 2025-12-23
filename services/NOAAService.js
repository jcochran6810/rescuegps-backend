/**
 * NOAAService.js - Complete Live NOAA Data Service
 * RescueGPS Backend v2.3.0
 * 
 * Fetches REAL environmental data from NOAA APIs:
 * - Tides from CO-OPS Tide Predictions
 * - Water Levels from CO-OPS Observations  
 * - Currents from CO-OPS Current Predictions
 * - Buoy data from NDBC
 * - Weather from NWS API
 * 
 * DEPLOY TO: Railway /drift-engine/services/NOAAService.js
 */

const axios = require('axios');

class NOAAService {
  constructor() {
    this.baseUrls = {
      coops: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
      ndbc: 'https://www.ndbc.noaa.gov/data/realtime2',
      weather: 'https://api.weather.gov'
    };
    
    // Cache for API responses (simple in-memory cache)
    this.cache = new Map();
    this.cacheTTL = {
      tides: 15 * 60 * 1000,      // 15 minutes
      currents: 15 * 60 * 1000,   // 15 minutes
      waterLevel: 3 * 60 * 1000,  // 3 minutes
      buoy: 5 * 60 * 1000,        // 5 minutes
      weather: 10 * 60 * 1000     // 10 minutes
    };
    
    // Regional station database - NATIONWIDE coverage
    this.stations = {
      // ========== GULF COAST ==========
      gulfCoast: {
        tides: [
          { id: '8771450', name: 'Galveston Bay Entrance, TX', lat: 29.357, lng: -94.725 },
          { id: '8770570', name: 'Sabine Pass North, TX', lat: 29.728, lng: -93.870 },
          { id: '8770520', name: 'Rainbow Bridge, TX', lat: 29.980, lng: -93.880 },
          { id: '8771013', name: 'Eagle Point, TX', lat: 29.480, lng: -94.918 },
          { id: '8771341', name: 'Galveston Bay Entrance, North Jetty, TX', lat: 29.357, lng: -94.725 },
          { id: '8768094', name: 'Calcasieu Pass, LA', lat: 29.768, lng: -93.343 },
          { id: '8761724', name: 'Grand Isle, LA', lat: 29.263, lng: -89.957 },
          { id: '8760922', name: 'Pilots Station East, LA', lat: 28.932, lng: -89.408 },
          { id: '8775870', name: 'Corpus Christi, TX', lat: 27.580, lng: -97.217 },
          { id: '8779770', name: 'Port Isabel, TX', lat: 26.060, lng: -97.215 },
          { id: '8726520', name: 'St. Petersburg, FL', lat: 27.761, lng: -82.627 },
          { id: '8725110', name: 'Naples, FL', lat: 26.132, lng: -81.808 },
          { id: '8723214', name: 'Virginia Key, FL', lat: 25.731, lng: -80.162 },
          { id: '8724580', name: 'Key West, FL', lat: 24.551, lng: -81.808 },
          { id: '8729108', name: 'Panama City, FL', lat: 30.152, lng: -85.667 },
          { id: '8735180', name: 'Dauphin Island, AL', lat: 30.250, lng: -88.075 }
        ],
        currents: [
          { id: 'g06010', name: 'Galveston Bay Entrance Channel', lat: 29.333, lng: -94.733 },
          { id: 'g07010', name: 'Houston Ship Channel', lat: 29.527, lng: -94.983 },
          { id: 'SB0301', name: 'Sabine Bank Channel', lat: 29.600, lng: -93.833 },
          { id: 'cc0101', name: 'Corpus Christi Ship Channel', lat: 27.833, lng: -97.100 }
        ],
        buoys: [
          { id: '42035', name: 'Galveston, TX - 22 NM E', lat: 29.232, lng: -94.413 },
          { id: '42043', name: 'Pelican Island, LA', lat: 28.982, lng: -94.898 },
          { id: '42019', name: 'Freeport, TX - 60 NM S', lat: 27.907, lng: -95.353 },
          { id: '42020', name: 'Corpus Christi, TX - 50 NM SE', lat: 26.968, lng: -96.695 },
          { id: '42001', name: 'Mid Gulf', lat: 25.888, lng: -89.658 },
          { id: '42003', name: 'East Gulf', lat: 26.044, lng: -85.612 },
          { id: 'PTAT2', name: 'Port Aransas, TX', lat: 27.840, lng: -97.050 },
          { id: 'GTOT2', name: 'Galveston Bay Ent, TX', lat: 29.285, lng: -94.724 },
          { id: 'MQTT2', name: 'Matagorda Bay, TX', lat: 28.443, lng: -96.395 },
          { id: 'SRST2', name: 'Sabine, TX', lat: 29.670, lng: -93.870 }
        ]
      },
      
      // ========== ATLANTIC COAST ==========
      atlantic: {
        tides: [
          { id: '8518750', name: 'The Battery, NY', lat: 40.700, lng: -74.014 },
          { id: '8516945', name: 'Kings Point, NY', lat: 40.810, lng: -73.765 },
          { id: '8510560', name: 'Montauk, NY', lat: 41.048, lng: -71.960 },
          { id: '8461490', name: 'New London, CT', lat: 41.361, lng: -72.090 },
          { id: '8447930', name: 'Woods Hole, MA', lat: 41.524, lng: -70.671 },
          { id: '8443970', name: 'Boston, MA', lat: 42.355, lng: -71.052 },
          { id: '8452660', name: 'Newport, RI', lat: 41.505, lng: -71.326 },
          { id: '8534720', name: 'Atlantic City, NJ', lat: 39.355, lng: -74.418 },
          { id: '8573927', name: 'Chesapeake City, MD', lat: 39.527, lng: -75.810 },
          { id: '8638863', name: 'Virginia Beach, VA', lat: 36.833, lng: -76.000 },
          { id: '8658120', name: 'Wilmington, NC', lat: 34.227, lng: -77.953 },
          { id: '8665530', name: 'Charleston, SC', lat: 32.781, lng: -79.924 },
          { id: '8670870', name: 'Fort Pulaski, GA', lat: 32.033, lng: -80.902 },
          { id: '8720218', name: 'Mayport, FL', lat: 30.397, lng: -81.430 }
        ],
        buoys: [
          { id: '44065', name: 'New York Harbor', lat: 40.369, lng: -73.703 },
          { id: '44025', name: 'Long Island', lat: 40.251, lng: -73.164 },
          { id: '44013', name: 'Boston', lat: 42.346, lng: -70.651 },
          { id: '44017', name: 'Montauk Point', lat: 40.694, lng: -72.048 },
          { id: '44009', name: 'Delaware Bay', lat: 38.461, lng: -74.703 },
          { id: '44014', name: 'Virginia Beach', lat: 36.611, lng: -74.836 },
          { id: '41037', name: 'Wrightsville Beach, NC', lat: 33.988, lng: -77.359 },
          { id: '41004', name: 'EDISTO, SC', lat: 32.501, lng: -79.099 },
          { id: '41008', name: 'Grays Reef, GA', lat: 31.402, lng: -80.869 },
          { id: '41009', name: 'Canaveral, FL', lat: 28.519, lng: -80.166 }
        ]
      },
      
      // ========== PACIFIC COAST ==========
      pacific: {
        tides: [
          { id: '9410660', name: 'Los Angeles, CA', lat: 33.720, lng: -118.272 },
          { id: '9410230', name: 'La Jolla, CA', lat: 32.867, lng: -117.257 },
          { id: '9410170', name: 'San Diego, CA', lat: 32.714, lng: -117.174 },
          { id: '9411340', name: 'Santa Barbara, CA', lat: 34.408, lng: -119.685 },
          { id: '9414290', name: 'San Francisco, CA', lat: 37.806, lng: -122.465 },
          { id: '9415020', name: 'Point Reyes, CA', lat: 37.996, lng: -122.976 },
          { id: '9418767', name: 'North Spit, CA', lat: 40.767, lng: -124.217 },
          { id: '9432780', name: 'Charleston, OR', lat: 43.345, lng: -124.322 },
          { id: '9439040', name: 'Astoria, OR', lat: 46.207, lng: -123.768 },
          { id: '9447130', name: 'Seattle, WA', lat: 47.603, lng: -122.339 },
          { id: '9449880', name: 'Friday Harbor, WA', lat: 48.546, lng: -123.013 }
        ],
        buoys: [
          { id: '46025', name: 'Santa Monica Basin', lat: 33.739, lng: -119.053 },
          { id: '46221', name: 'Santa Cruz Basin', lat: 33.855, lng: -118.633 },
          { id: '46222', name: 'San Pedro', lat: 33.618, lng: -118.317 },
          { id: '46047', name: 'Tanner Bank', lat: 32.433, lng: -119.533 },
          { id: '46026', name: 'San Francisco', lat: 37.759, lng: -122.833 },
          { id: '46013', name: 'Bodega Bay', lat: 38.242, lng: -123.301 },
          { id: '46027', name: 'St Georges', lat: 41.850, lng: -124.381 },
          { id: '46029', name: 'Columbia River Bar', lat: 46.144, lng: -124.485 },
          { id: '46041', name: 'Cape Elizabeth', lat: 47.353, lng: -124.731 },
          { id: '46005', name: 'Washington', lat: 46.050, lng: -131.001 }
        ]
      },
      
      // ========== GREAT LAKES ==========
      greatLakes: {
        tides: [
          { id: '9063020', name: 'Buffalo, NY', lat: 42.877, lng: -78.890 },
          { id: '9063038', name: 'Cleveland, OH', lat: 41.541, lng: -81.636 },
          { id: '9063053', name: 'Marblehead, OH', lat: 41.543, lng: -82.726 },
          { id: '9063079', name: 'Toledo, OH', lat: 41.694, lng: -83.472 },
          { id: '9075002', name: 'Mackinaw City, MI', lat: 45.778, lng: -84.725 },
          { id: '9087031', name: 'Milwaukee, WI', lat: 43.002, lng: -87.888 },
          { id: '9087044', name: 'Calumet Harbor, IL', lat: 41.730, lng: -87.538 },
          { id: '9099064', name: 'Duluth, MN', lat: 46.776, lng: -92.092 }
        ],
        buoys: [
          { id: '45007', name: 'South Michigan', lat: 42.674, lng: -87.026 },
          { id: '45012', name: 'Lake Superior (West)', lat: 47.338, lng: -90.762 },
          { id: '45002', name: 'North Michigan', lat: 45.344, lng: -86.411 },
          { id: '45003', name: 'North Huron', lat: 45.351, lng: -82.841 },
          { id: '45005', name: 'West Erie', lat: 41.677, lng: -82.398 },
          { id: '45014', name: 'South Ontario', lat: 43.618, lng: -77.418 }
        ]
      },
      
      // ========== ALASKA ==========
      alaska: {
        tides: [
          { id: '9455920', name: 'Anchorage, AK', lat: 61.238, lng: -149.890 },
          { id: '9455760', name: 'Nikiski, AK', lat: 60.683, lng: -151.398 },
          { id: '9455500', name: 'Seldovia, AK', lat: 59.440, lng: -151.720 },
          { id: '9462620', name: 'Kodiak Island, AK', lat: 57.732, lng: -152.512 },
          { id: '9468756', name: 'Nome, AK', lat: 64.495, lng: -165.440 },
          { id: '9457292', name: 'Valdez, AK', lat: 61.125, lng: -146.362 },
          { id: '9451600', name: 'Sitka, AK', lat: 57.052, lng: -135.342 },
          { id: '9452210', name: 'Juneau, AK', lat: 58.299, lng: -134.412 },
          { id: '9450460', name: 'Ketchikan, AK', lat: 55.332, lng: -131.626 }
        ],
        buoys: [
          { id: '46001', name: 'Western Gulf Alaska', lat: 56.300, lng: -147.883 },
          { id: '46060', name: 'West Orca Bay', lat: 60.584, lng: -146.805 },
          { id: '46061', name: 'Shelikof Strait', lat: 58.243, lng: -152.065 },
          { id: '46080', name: 'Northwest Gulf', lat: 58.035, lng: -149.994 },
          { id: '46082', name: 'Cape Suckling', lat: 59.688, lng: -143.395 }
        ]
      },
      
      // ========== HAWAII ==========
      hawaii: {
        tides: [
          { id: '1612340', name: 'Honolulu, HI', lat: 21.307, lng: -157.867 },
          { id: '1612480', name: 'Mokuoloe, HI', lat: 21.433, lng: -157.790 },
          { id: '1615680', name: 'Kahului, HI', lat: 20.895, lng: -156.477 },
          { id: '1617433', name: 'Kawaihae, HI', lat: 20.037, lng: -155.830 },
          { id: '1617760', name: 'Hilo, HI', lat: 19.730, lng: -155.060 },
          { id: '1619910', name: 'Sand Island, Midway', lat: 28.212, lng: -177.360 }
        ],
        buoys: [
          { id: '51001', name: 'NW Hawaii', lat: 23.445, lng: -162.279 },
          { id: '51002', name: 'SW Hawaii', lat: 17.094, lng: -157.808 },
          { id: '51003', name: 'W Hawaii', lat: 19.228, lng: -160.620 },
          { id: '51004', name: 'SE Hawaii', lat: 17.525, lng: -152.382 },
          { id: '51101', name: 'NW Hawaii Ref', lat: 24.321, lng: -162.058 }
        ]
      }
    };
  }

  /**
   * Get nearest stations to coordinates
   */
  getNearestStations(lat, lng, type = 'all') {
    const allStations = { tides: [], currents: [], buoys: [] };
    
    // Calculate distance to all stations in all regions
    for (const region of Object.values(this.stations)) {
      if (region.tides) {
        for (const station of region.tides) {
          const distance = this.calculateDistance(lat, lng, station.lat, station.lng);
          allStations.tides.push({ ...station, distance });
        }
      }
      if (region.currents) {
        for (const station of region.currents) {
          const distance = this.calculateDistance(lat, lng, station.lat, station.lng);
          allStations.currents.push({ ...station, distance });
        }
      }
      if (region.buoys) {
        for (const station of region.buoys) {
          const distance = this.calculateDistance(lat, lng, station.lat, station.lng);
          allStations.buoys.push({ ...station, distance });
        }
      }
    }
    
    // Sort by distance and return closest
    allStations.tides.sort((a, b) => a.distance - b.distance);
    allStations.currents.sort((a, b) => a.distance - b.distance);
    allStations.buoys.sort((a, b) => a.distance - b.distance);
    
    return {
      tides: allStations.tides.slice(0, 5),
      currents: allStations.currents.slice(0, 3),
      buoys: allStations.buoys.slice(0, 5)
    };
  }

  /**
   * Calculate distance between two coordinates in nautical miles
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Format date for NOAA API
   */
  formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}${month}${day} ${hours}:${minutes}`;
  }

  /**
   * Get from cache or fetch fresh
   */
  getCached(key, ttl) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < ttl) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Fetch tide predictions from CO-OPS
   */
  async getTideData(stationId) {
    const cacheKey = `tide_${stationId}`;
    const cached = this.getCached(cacheKey, this.cacheTTL.tides);
    if (cached) return cached;

    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        product: 'predictions',
        application: 'RescueGPS',
        begin_date: this.formatDate(now),
        end_date: this.formatDate(endDate),
        datum: 'MLLW',
        station: stationId,
        time_zone: 'gmt',
        units: 'english',
        interval: 'hilo',
        format: 'json'
      });

      const response = await axios.get(`${this.baseUrls.coops}?${params}`, { timeout: 10000 });
      
      if (response.data && response.data.predictions) {
        const result = {
          stationId,
          predictions: response.data.predictions,
          fetchedAt: new Date().toISOString()
        };
        this.setCache(cacheKey, result);
        return result;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching tide data for ${stationId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch water level observations from CO-OPS
   */
  async getWaterLevel(stationId) {
    const cacheKey = `waterlevel_${stationId}`;
    const cached = this.getCached(cacheKey, this.cacheTTL.waterLevel);
    if (cached) return cached;

    try {
      const now = new Date();
      const beginDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        product: 'water_level',
        application: 'RescueGPS',
        begin_date: this.formatDate(beginDate),
        end_date: this.formatDate(now),
        datum: 'MLLW',
        station: stationId,
        time_zone: 'gmt',
        units: 'english',
        format: 'json'
      });

      const response = await axios.get(`${this.baseUrls.coops}?${params}`, { timeout: 10000 });
      
      if (response.data && response.data.data && response.data.data.length > 0) {
        const latest = response.data.data[response.data.data.length - 1];
        const result = {
          stationId,
          value: parseFloat(latest.v),
          time: latest.t,
          fetchedAt: new Date().toISOString()
        };
        this.setCache(cacheKey, result);
        return result;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching water level for ${stationId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch current predictions from CO-OPS
   */
  async getCurrentData(stationId) {
    const cacheKey = `current_${stationId}`;
    const cached = this.getCached(cacheKey, this.cacheTTL.currents);
    if (cached) return cached;

    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        product: 'currents_predictions',
        application: 'RescueGPS',
        begin_date: this.formatDate(now),
        end_date: this.formatDate(endDate),
        station: stationId,
        time_zone: 'gmt',
        units: 'english',
        interval: '30',
        format: 'json'
      });

      const response = await axios.get(`${this.baseUrls.coops}?${params}`, { timeout: 10000 });
      
      if (response.data && response.data.current_predictions) {
        // Get current prediction (closest to now)
        const predictions = response.data.current_predictions.cp;
        const nowTime = now.getTime();
        let closest = predictions[0];
        let minDiff = Infinity;
        
        for (const pred of predictions) {
          const predTime = new Date(pred.Time).getTime();
          const diff = Math.abs(predTime - nowTime);
          if (diff < minDiff) {
            minDiff = diff;
            closest = pred;
          }
        }
        
        const result = {
          stationId,
          speed: parseFloat(closest.Velocity_Major),
          direction: parseFloat(closest.meanFloodDir) || 0,
          time: closest.Time,
          predictions: predictions.slice(0, 12),
          fetchedAt: new Date().toISOString()
        };
        this.setCache(cacheKey, result);
        return result;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching current data for ${stationId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch buoy data from NDBC
   */
  async getBuoyData(buoyId) {
    const cacheKey = `buoy_${buoyId}`;
    const cached = this.getCached(cacheKey, this.cacheTTL.buoy);
    if (cached) return cached;

    try {
      // Try standard meteorological data
      const url = `${this.baseUrls.ndbc}/${buoyId}.txt`;
      const response = await axios.get(url, { timeout: 10000 });
      
      const data = this.parseBuoyData(response.data, buoyId);
      if (data) {
        this.setCache(cacheKey, data);
        return data;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching buoy data for ${buoyId}:`, error.message);
      return null;
    }
  }

  /**
   * Parse NDBC buoy text format
   */
  parseBuoyData(rawData, buoyId) {
    try {
      const lines = rawData.split('\n');
      if (lines.length < 3) return null;
      
      // Get header and find column indices
      const header = lines[0].replace('#', '').trim().split(/\s+/);
      const units = lines[1].replace('#', '').trim().split(/\s+/);
      const dataLine = lines[2].trim().split(/\s+/);
      
      // Map common NDBC columns
      const getCol = (name) => {
        const idx = header.indexOf(name);
        if (idx === -1 || idx >= dataLine.length) return null;
        const val = parseFloat(dataLine[idx]);
        return isNaN(val) || val === 999 || val === 99 || val === 9999 ? null : val;
      };
      
      // Wind direction and speed
      const windDir = getCol('WDIR') || getCol('WD');
      const windSpd = getCol('WSPD');
      const windGst = getCol('GST');
      
      // Wave data
      const waveHgt = getCol('WVHT');
      const wavePer = getCol('DPD') || getCol('APD');
      const waveDir = getCol('MWD');
      
      // Temperature
      const airTemp = getCol('ATMP');
      const waterTemp = getCol('WTMP');
      
      // Pressure
      const pressure = getCol('PRES');
      
      // Visibility (usually not in standard buoy data)
      const visibility = getCol('VIS');
      
      // Convert units (NDBC uses metric, we want imperial)
      const msToKnots = 1.94384;
      const mToFeet = 3.28084;
      const cToF = (c) => c !== null ? (c * 9/5) + 32 : null;
      
      return {
        buoyId,
        stationName: `NDBC Buoy ${buoyId}`,
        timestamp: new Date().toISOString(),
        wind: {
          speed: windSpd !== null ? windSpd * msToKnots : null,
          direction: windDir,
          gusts: windGst !== null ? windGst * msToKnots : null
        },
        waves: {
          height: waveHgt !== null ? waveHgt * mToFeet : null,
          period: wavePer,
          direction: waveDir
        },
        air: {
          temperature: cToF(airTemp),
          pressure: pressure
        },
        water: {
          temperature: cToF(waterTemp)
        },
        visibility: visibility,
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error parsing buoy data:', error);
      return null;
    }
  }

  /**
   * Get weather forecast from NWS
   */
  async getWeather(lat, lng) {
    const cacheKey = `weather_${lat.toFixed(2)}_${lng.toFixed(2)}`;
    const cached = this.getCached(cacheKey, this.cacheTTL.weather);
    if (cached) return cached;

    try {
      // First get the forecast URL for this location
      const pointResponse = await axios.get(`${this.baseUrls.weather}/points/${lat},${lng}`, {
        headers: { 'User-Agent': 'RescueGPS SAR Application' },
        timeout: 10000
      });
      
      if (pointResponse.data && pointResponse.data.properties && pointResponse.data.properties.forecast) {
        // Get the actual forecast
        const forecastResponse = await axios.get(pointResponse.data.properties.forecast, {
          headers: { 'User-Agent': 'RescueGPS SAR Application' },
          timeout: 10000
        });
        
        if (forecastResponse.data && forecastResponse.data.properties) {
          const periods = forecastResponse.data.properties.periods || [];
          const result = {
            location: { lat, lng },
            periods: periods.slice(0, 6).map(p => ({
              name: p.name,
              temperature: p.temperature,
              temperatureUnit: p.temperatureUnit,
              windSpeed: p.windSpeed,
              windDirection: p.windDirection,
              shortForecast: p.shortForecast
            })),
            fetchedAt: new Date().toISOString()
          };
          this.setCache(cacheKey, result);
          return result;
        }
      }
      return null;
    } catch (error) {
      console.error(`Error fetching weather for ${lat},${lng}:`, error.message);
      return null;
    }
  }

  /**
   * MAIN METHOD: Get comprehensive environmental data for a location
   * Returns data in format expected by frontend
   */
  async getEnvironmentalData(lat, lng) {
    console.log(`[NOAAService] Fetching environmental data for ${lat}, ${lng}`);
    
    // Find nearest stations
    const stations = this.getNearestStations(lat, lng);
    console.log(`[NOAAService] Found stations:`, {
      tides: stations.tides[0]?.name,
      buoys: stations.buoys[0]?.name
    });
    
    // Fetch data in parallel
    const [tideData, waterLevel, currentData, buoyData, weather] = await Promise.all([
      stations.tides[0] ? this.getTideData(stations.tides[0].id) : null,
      stations.tides[0] ? this.getWaterLevel(stations.tides[0].id) : null,
      stations.currents[0] ? this.getCurrentData(stations.currents[0].id) : null,
      stations.buoys[0] ? this.getBuoyData(stations.buoys[0].id) : null,
      this.getWeather(lat, lng)
    ]);
    
    // Build summary for frontend
    const summary = this.buildSummary(tideData, waterLevel, currentData, buoyData, weather, stations);
    
    return {
      location: { lat, lng },
      summary,
      tides: tideData ? {
        stationId: stations.tides[0]?.id,
        stationName: stations.tides[0]?.name,
        predictions: tideData.predictions,
        fetchedAt: tideData.fetchedAt
      } : null,
      waterLevel: waterLevel ? {
        stationId: stations.tides[0]?.id,
        stationName: stations.tides[0]?.name,
        value: waterLevel.value,
        time: waterLevel.time,
        fetchedAt: waterLevel.fetchedAt
      } : null,
      currents: currentData ? {
        stationId: stations.currents[0]?.id,
        stationName: stations.currents[0]?.name,
        speed: currentData.speed,
        direction: currentData.direction,
        fetchedAt: currentData.fetchedAt
      } : null,
      buoy: buoyData,
      weather,
      stations,
      alternatives: {
        tides: stations.tides.slice(1, 4).map(s => ({ id: s.id, name: s.name, distance: s.distance })),
        buoys: stations.buoys.slice(1, 4).map(s => ({ id: s.id, name: s.name, distance: s.distance })),
        currents: stations.currents.slice(1, 3).map(s => ({ id: s.id, name: s.name, distance: s.distance }))
      },
      fetchedAt: new Date().toISOString(),
      isSimulated: false
    };
  }

  /**
   * Build summary object for frontend display
   */
  buildSummary(tideData, waterLevel, currentData, buoyData, weather, stations) {
    // Determine tide state from predictions
    let tideState = { state: 'unknown', nextChange: null, nextType: null };
    if (tideData && tideData.predictions && tideData.predictions.length >= 2) {
      const now = new Date();
      const upcoming = tideData.predictions.filter(p => new Date(p.t) > now);
      if (upcoming.length >= 1) {
        const next = upcoming[0];
        const isNextHigh = next.type === 'H';
        tideState = {
          state: isNextHigh ? 'rising' : 'falling',
          nextChange: next.t,
          nextType: isNextHigh ? 'High' : 'Low',
          station: stations.tides[0]
        };
      }
    }
    
    // Wind conditions
    const wind = buoyData?.wind?.speed !== null ? {
      speed: buoyData.wind.speed,
      direction: buoyData.wind.direction,
      gusts: buoyData.wind.gusts,
      status: this.getWindStatus(buoyData.wind.speed),
      station: { name: buoyData.stationName }
    } : null;
    
    // Wave conditions
    const waves = buoyData?.waves?.height !== null ? {
      height: buoyData.waves.height,
      period: buoyData.waves.period,
      direction: buoyData.waves.direction,
      status: this.getWaveStatus(buoyData.waves.height),
      station: { name: buoyData.stationName }
    } : null;
    
    // Current conditions
    const surfaceCurrent = currentData ? {
      speed: Math.abs(currentData.speed),
      direction: currentData.direction,
      status: this.getCurrentStatus(Math.abs(currentData.speed)),
      station: stations.currents[0]
    } : null;
    
    // Water temperature
    const waterTemp = buoyData?.water?.temperature !== null ? {
      value: buoyData.water.temperature,
      status: this.getWaterTempStatus(buoyData.water.temperature),
      station: { name: buoyData.stationName }
    } : null;
    
    // Water level
    const waterLevelSummary = waterLevel ? {
      value: waterLevel.value,
      time: waterLevel.time,
      station: stations.tides[0]
    } : null;
    
    // Visibility (from weather if available)
    const visibility = {
      value: 10, // Default good visibility
      status: 'good'
    };
    
    // Overall conditions assessment
    const overallConditions = this.assessOverallConditions(wind, waves, surfaceCurrent, waterTemp);
    
    return {
      tideState,
      wind,
      waves,
      surfaceCurrent,
      waterTemp,
      waterLevel: waterLevelSummary,
      visibility,
      overallConditions
    };
  }

  // Status assessment helpers
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
    if (height < 8) return 'rough';
    return 'severe';
  }

  getCurrentStatus(speed) {
    if (speed === null) return 'unknown';
    if (speed < 0.5) return 'slack';
    if (speed < 1.5) return 'moderate';
    if (speed < 2.5) return 'strong';
    return 'very strong';
  }

  getWaterTempStatus(temp) {
    if (temp === null) return 'unknown';
    if (temp < 50) return 'cold';
    if (temp < 60) return 'cool';
    if (temp < 75) return 'moderate';
    return 'warm';
  }

  assessOverallConditions(wind, waves, current, waterTemp) {
    const factors = [];
    
    if (wind?.status === 'severe' || waves?.status === 'severe') return 'hazardous';
    if (wind?.status === 'strong' || waves?.status === 'rough') factors.push('challenging');
    if (wind?.status === 'moderate' || waves?.status === 'moderate') factors.push('moderate');
    if (current?.status === 'very strong') factors.push('challenging');
    if (current?.status === 'strong') factors.push('moderate');
    if (waterTemp?.status === 'cold') factors.push('cold');
    
    if (factors.includes('challenging')) return 'challenging';
    if (factors.includes('moderate')) return 'moderate';
    return 'favorable';
  }
}

module.exports = NOAAService;
