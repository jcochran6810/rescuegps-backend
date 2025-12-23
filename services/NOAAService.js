/**
 * NOAAService.js - LIGHTWEIGHT VERSION
 * Works anywhere in USA without crashing Railway
 * 
 * Uses pre-defined regional stations instead of loading entire national database
 * All APIs are FREE, no keys needed
 */

const axios = require('axios');

class NOAAService {
  constructor() {
    this.baseUrls = {
      coops: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
      ndbc: 'https://www.ndbc.noaa.gov/data/realtime2',
      weather: 'https://api.weather.gov'
    };

    // Simple cache
    this.cache = new Map();
    this.cacheTimeout = 3 * 60 * 1000; // 3 minutes

    // Pre-defined stations by region (lightweight - no API calls to load)
    this.regionalStations = {
      // GULF COAST - TEXAS
      'gulf-tx': {
        tides: [
          { id: '8771450', name: 'Galveston Pier 21', lat: 29.31, lng: -94.79 },
          { id: '8770613', name: "Morgan's Point", lat: 29.68, lng: -94.99 },
          { id: '8771013', name: 'Eagle Point', lat: 29.48, lng: -94.92 },
          { id: '8770822', name: 'Texas Point', lat: 29.69, lng: -93.84 },
          { id: '8775870', name: 'Corpus Christi', lat: 27.58, lng: -97.22 },
          { id: '8779770', name: 'Port Isabel', lat: 26.06, lng: -97.22 },
        ],
        currents: [
          { id: 'g06010', name: 'Galveston Bay Entrance', lat: 29.35, lng: -94.73 },
          { id: 'g06015', name: 'Galveston Channel', lat: 29.33, lng: -94.77 },
        ],
        buoys: [
          { id: '42035', name: 'Galveston 22NM', lat: 29.23, lng: -94.41 },
          { id: '42019', name: 'Freeport 60NM', lat: 27.91, lng: -95.36 },
          { id: '42020', name: 'Corpus Christi', lat: 26.97, lng: -96.69 },
        ]
      },
      // GULF COAST - LOUISIANA
      'gulf-la': {
        tides: [
          { id: '8761724', name: 'Grand Isle', lat: 29.26, lng: -89.96 },
          { id: '8760922', name: 'Pilottown', lat: 29.18, lng: -89.26 },
          { id: '8764227', name: 'LAWMA', lat: 29.45, lng: -91.34 },
        ],
        currents: [
          { id: 'lm0101', name: 'Mississippi River', lat: 29.15, lng: -89.25 },
        ],
        buoys: [
          { id: '42040', name: 'Luke Offshore', lat: 29.21, lng: -88.21 },
          { id: 'BURL1', name: 'SW Pass', lat: 28.91, lng: -89.43 },
        ]
      },
      // GULF COAST - FLORIDA
      'gulf-fl': {
        tides: [
          { id: '8726520', name: 'St Petersburg', lat: 27.76, lng: -82.63 },
          { id: '8725110', name: 'Naples', lat: 26.13, lng: -81.81 },
          { id: '8723214', name: 'Virginia Key', lat: 25.73, lng: -80.16 },
          { id: '8724580', name: 'Key West', lat: 24.55, lng: -81.81 },
          { id: '8729108', name: 'Panama City', lat: 30.15, lng: -85.67 },
          { id: '8729840', name: 'Pensacola', lat: 30.40, lng: -87.21 },
        ],
        currents: [],
        buoys: [
          { id: '42036', name: 'W Tampa 106NM', lat: 28.50, lng: -84.52 },
          { id: '42003', name: 'E Gulf', lat: 26.01, lng: -85.91 },
        ]
      },
      // ATLANTIC - SOUTHEAST (GA, SC, NC)
      'atlantic-se': {
        tides: [
          { id: '8720218', name: 'Mayport', lat: 30.40, lng: -81.43 },
          { id: '8665530', name: 'Charleston', lat: 32.78, lng: -79.92 },
          { id: '8658120', name: 'Wilmington', lat: 34.23, lng: -77.95 },
          { id: '8656483', name: 'Beaufort', lat: 34.72, lng: -76.67 },
        ],
        currents: [],
        buoys: [
          { id: '41008', name: 'Grays Reef', lat: 31.40, lng: -80.87 },
          { id: '41004', name: 'Edisto 41NM', lat: 32.50, lng: -79.10 },
          { id: '41025', name: 'Diamond Shoals', lat: 35.01, lng: -75.40 },
        ]
      },
      // ATLANTIC - MID (VA, MD, DE, NJ)
      'atlantic-mid': {
        tides: [
          { id: '8638863', name: 'Chesapeake Bay', lat: 36.97, lng: -76.11 },
          { id: '8574680', name: 'Baltimore', lat: 39.27, lng: -76.58 },
          { id: '8551910', name: 'Reedy Point', lat: 39.56, lng: -75.57 },
          { id: '8534720', name: 'Atlantic City', lat: 39.36, lng: -74.42 },
        ],
        currents: [
          { id: 'cb1201', name: 'Chesapeake Channel', lat: 37.00, lng: -76.08 },
        ],
        buoys: [
          { id: '44009', name: 'Delaware Bay', lat: 38.46, lng: -74.70 },
          { id: '44025', name: 'Long Island', lat: 40.25, lng: -73.16 },
        ]
      },
      // ATLANTIC - NORTHEAST (NY, CT, RI, MA, NH, ME)
      'atlantic-ne': {
        tides: [
          { id: '8518750', name: 'The Battery NY', lat: 40.70, lng: -74.01 },
          { id: '8516945', name: 'Kings Point', lat: 40.81, lng: -73.77 },
          { id: '8447930', name: 'Woods Hole', lat: 41.52, lng: -70.67 },
          { id: '8443970', name: 'Boston', lat: 42.35, lng: -71.05 },
          { id: '8418150', name: 'Portland ME', lat: 43.66, lng: -70.25 },
        ],
        currents: [
          { id: 'ACT4176', name: 'The Narrows', lat: 40.61, lng: -74.04 },
        ],
        buoys: [
          { id: '44017', name: 'Montauk Point', lat: 40.69, lng: -72.05 },
          { id: '44013', name: 'Boston 16NM', lat: 42.35, lng: -70.65 },
          { id: '44007', name: 'Portland 12NM', lat: 43.53, lng: -70.14 },
        ]
      },
      // PACIFIC - CALIFORNIA
      'pacific-ca': {
        tides: [
          { id: '9410660', name: 'Los Angeles', lat: 33.72, lng: -118.27 },
          { id: '9410230', name: 'La Jolla', lat: 32.87, lng: -117.26 },
          { id: '9414290', name: 'San Francisco', lat: 37.81, lng: -122.47 },
          { id: '9415020', name: 'Point Reyes', lat: 38.00, lng: -122.98 },
          { id: '9418767', name: 'Humboldt Bay', lat: 40.77, lng: -124.22 },
        ],
        currents: [
          { id: 'SFB1203', name: 'Golden Gate', lat: 37.81, lng: -122.47 },
        ],
        buoys: [
          { id: '46025', name: 'Santa Monica', lat: 33.75, lng: -119.05 },
          { id: '46026', name: 'San Francisco', lat: 37.76, lng: -122.83 },
          { id: '46014', name: 'Pt Arena', lat: 39.23, lng: -123.97 },
        ]
      },
      // PACIFIC - NORTHWEST (OR, WA)
      'pacific-nw': {
        tides: [
          { id: '9432780', name: 'Charleston OR', lat: 43.35, lng: -124.32 },
          { id: '9435380', name: 'South Beach', lat: 44.63, lng: -124.04 },
          { id: '9439040', name: 'Astoria', lat: 46.21, lng: -123.77 },
          { id: '9447130', name: 'Seattle', lat: 47.60, lng: -122.34 },
          { id: '9449880', name: 'Friday Harbor', lat: 48.55, lng: -123.01 },
        ],
        currents: [
          { id: 'PUG1515', name: 'Admiralty Inlet', lat: 48.03, lng: -122.62 },
        ],
        buoys: [
          { id: '46050', name: 'Stonewall', lat: 44.64, lng: -124.50 },
          { id: '46029', name: 'Columbia River', lat: 46.14, lng: -124.51 },
          { id: '46088', name: 'New Dungeness', lat: 48.33, lng: -123.17 },
        ]
      },
      // GREAT LAKES
      'great-lakes': {
        tides: [
          { id: '9063020', name: 'Buffalo', lat: 42.88, lng: -78.89 },
          { id: '9075002', name: 'Mackinaw City', lat: 45.78, lng: -84.73 },
          { id: '9087044', name: 'Calumet Harbor', lat: 41.73, lng: -87.54 },
          { id: '9099064', name: 'Duluth', lat: 46.78, lng: -92.09 },
        ],
        currents: [],
        buoys: [
          { id: '45007', name: 'Michigan City', lat: 42.67, lng: -87.03 },
          { id: '45002', name: 'N Michigan', lat: 45.34, lng: -86.41 },
          { id: '45006', name: 'W Superior', lat: 47.34, lng: -89.79 },
        ]
      },
      // ALASKA
      'alaska': {
        tides: [
          { id: '9455920', name: 'Anchorage', lat: 61.24, lng: -149.89 },
          { id: '9457292', name: 'Kodiak', lat: 57.73, lng: -152.51 },
          { id: '9450460', name: 'Ketchikan', lat: 55.33, lng: -131.63 },
          { id: '9452210', name: 'Juneau', lat: 58.30, lng: -134.41 },
        ],
        currents: [],
        buoys: [
          { id: '46001', name: 'Gulf of Alaska', lat: 56.30, lng: -148.02 },
          { id: '46060', name: 'W Gulf Alaska', lat: 60.58, lng: -146.83 },
        ]
      },
      // HAWAII
      'hawaii': {
        tides: [
          { id: '1612340', name: 'Honolulu', lat: 21.31, lng: -157.87 },
          { id: '1615680', name: 'Kahului', lat: 20.90, lng: -156.47 },
          { id: '1617433', name: 'Kawaihae', lat: 20.04, lng: -155.83 },
        ],
        currents: [],
        buoys: [
          { id: '51001', name: 'NW Hawaii', lat: 23.43, lng: -162.21 },
          { id: '51003', name: 'W Hawaii', lat: 19.29, lng: -160.66 },
        ]
      }
    };
  }

  // Simple cache methods
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

  // Distance calculation (nautical miles)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3440.065;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // Determine region from coordinates
  getRegion(lat, lng) {
    // Alaska
    if (lat >= 54 && lng <= -130) return 'alaska';
    // Hawaii
    if (lat >= 18 && lat <= 23 && lng >= -162 && lng <= -154) return 'hawaii';
    // Pacific Northwest
    if (lat >= 42 && lat <= 50 && lng >= -125 && lng <= -122) return 'pacific-nw';
    // California
    if (lat >= 32 && lat < 42 && lng >= -125 && lng <= -117) return 'pacific-ca';
    // Great Lakes
    if (lat >= 41 && lat <= 49 && lng >= -93 && lng <= -76) return 'great-lakes';
    // Gulf Texas
    if (lat >= 25 && lat <= 31 && lng >= -98 && lng <= -93) return 'gulf-tx';
    // Gulf Louisiana
    if (lat >= 28 && lat <= 31 && lng > -93 && lng <= -88) return 'gulf-la';
    // Gulf Florida / Atlantic Florida
    if (lat >= 24 && lat <= 31 && lng > -88 && lng <= -79) return 'gulf-fl';
    // Atlantic Southeast
    if (lat >= 30 && lat <= 36 && lng > -82 && lng <= -75) return 'atlantic-se';
    // Atlantic Mid
    if (lat >= 36 && lat < 40 && lng > -77 && lng <= -73) return 'atlantic-mid';
    // Atlantic Northeast
    if (lat >= 40 && lat <= 45 && lng > -74 && lng <= -66) return 'atlantic-ne';
    
    // Default to nearest region
    return 'gulf-tx';
  }

  // Get nearest stations
  getNearestStations(lat, lng) {
    const region = this.getRegion(lat, lng);
    const stations = this.regionalStations[region] || this.regionalStations['gulf-tx'];
    
    const addDistance = (list) => list.map(s => ({
      ...s,
      distance: this.calculateDistance(lat, lng, s.lat, s.lng)
    })).sort((a, b) => a.distance - b.distance);

    return {
      region,
      tides: addDistance(stations.tides),
      currents: addDistance(stations.currents),
      buoys: addDistance(stations.buoys)
    };
  }

  // Format date for NOAA
  formatDate(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    return `${y}${m}${d} ${h}:${min}`;
  }

  // Fetch tide predictions
  async getTidePredictions(stationId) {
    const cacheKey = `tides_${stationId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const now = new Date();
      const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      
      const url = `${this.baseUrls.coops}?product=predictions&application=RescueGPS&begin_date=${this.formatDate(now)}&end_date=${this.formatDate(end)}&datum=MLLW&station=${stationId}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;
      
      const response = await axios.get(url, { timeout: 8000 });
      const data = { stationId, predictions: response.data.predictions || [], fetchedAt: new Date().toISOString() };
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Tide fetch error ${stationId}:`, error.message);
      return { stationId, predictions: [], error: error.message };
    }
  }

  // Fetch water level
  async getWaterLevel(stationId) {
    const cacheKey = `wl_${stationId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const now = new Date();
      const start = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      const url = `${this.baseUrls.coops}?product=water_level&application=RescueGPS&begin_date=${this.formatDate(start)}&end_date=${this.formatDate(now)}&datum=MLLW&station=${stationId}&time_zone=lst_ldt&units=english&format=json`;
      
      const response = await axios.get(url, { timeout: 8000 });
      const obs = response.data.data || [];
      const latest = obs[obs.length - 1];
      
      const data = { stationId, current: latest ? parseFloat(latest.v) : null, time: latest?.t, fetchedAt: new Date().toISOString() };
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Water level error ${stationId}:`, error.message);
      return { stationId, current: null, error: error.message };
    }
  }

  // Fetch current predictions
  async getCurrentPredictions(stationId) {
    const cacheKey = `curr_${stationId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const now = new Date();
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const url = `${this.baseUrls.coops}?product=currents_predictions&application=RescueGPS&begin_date=${this.formatDate(now)}&end_date=${this.formatDate(end)}&station=${stationId}&time_zone=lst_ldt&units=english&interval=30&format=json`;
      
      const response = await axios.get(url, { timeout: 8000 });
      const preds = response.data.current_predictions?.cp || [];
      const curr = preds[0];
      
      const data = {
        stationId,
        current: curr ? { speed: parseFloat(curr.Speed), direction: curr.Direction, time: curr.Time } : null,
        fetchedAt: new Date().toISOString()
      };
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Current error ${stationId}:`, error.message);
      return { stationId, current: null, error: error.message };
    }
  }

  // Fetch buoy data
  async getBuoyData(buoyId) {
    const cacheKey = `buoy_${buoyId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrls.ndbc}/${buoyId}.txt`;
      const response = await axios.get(url, { timeout: 8000 });
      const data = this.parseBuoyData(buoyId, response.data);
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Buoy error ${buoyId}:`, error.message);
      return { buoyId, error: error.message };
    }
  }

  // Parse NDBC buoy data
  parseBuoyData(buoyId, raw) {
    try {
      const lines = raw.trim().split('\n');
      let headers = [], values = [];
      
      for (const line of lines) {
        if (line.startsWith('#YY')) headers = line.substring(1).trim().split(/\s+/);
        else if (!line.startsWith('#') && line.trim()) { values = line.trim().split(/\s+/); break; }
      }
      
      const get = (name) => {
        const i = headers.indexOf(name);
        if (i === -1) return null;
        const v = parseFloat(values[i]);
        return isNaN(v) || v === 999 || v === 9999 ? null : v;
      };
      
      const msToKt = (v) => v ? v * 1.944 : null;
      const cToF = (v) => v ? (v * 9/5) + 32 : null;
      const mToFt = (v) => v ? v * 3.28084 : null;

      return {
        buoyId,
        wind: { direction: get('WDIR'), speed: msToKt(get('WSPD')), gusts: msToKt(get('GST')) },
        waves: { height: mToFt(get('WVHT')), period: get('DPD'), direction: get('MWD') },
        air: { temperature: cToF(get('ATMP')), pressure: get('PRES') },
        water: { temperature: cToF(get('WTMP')) },
        fetchedAt: new Date().toISOString()
      };
    } catch (e) {
      return { buoyId, error: 'Parse error' };
    }
  }

  // Fetch weather
  async getWeather(lat, lng) {
    const cacheKey = `wx_${lat.toFixed(1)}_${lng.toFixed(1)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const pointsRes = await axios.get(`${this.baseUrls.weather}/points/${lat.toFixed(4)},${lng.toFixed(4)}`, {
        timeout: 8000,
        headers: { 'User-Agent': 'RescueGPS' }
      });
      
      const forecastRes = await axios.get(pointsRes.data.properties.forecast, {
        timeout: 8000,
        headers: { 'User-Agent': 'RescueGPS' }
      });
      
      const periods = forecastRes.data.properties.periods || [];
      const data = { current: periods[0] || null, fetchedAt: new Date().toISOString() };
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Weather error:`, error.message);
      return { current: null, error: error.message };
    }
  }

  // Main method - get all environmental data
  async getEnvironmentalData(lat, lng) {
    console.log(`\nFetching env data for ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    
    const stations = this.getNearestStations(lat, lng);
    const tide = stations.tides[0];
    const curr = stations.currents[0];
    const buoy = stations.buoys[0];

    console.log(`Region: ${stations.region}`);
    console.log(`Nearest: Tide=${tide?.name}, Buoy=${buoy?.name}`);

    // Fetch in parallel with error handling
    const [tides, waterLevel, currents, buoyData, weather] = await Promise.all([
      tide ? this.getTidePredictions(tide.id).catch(e => ({ error: e.message })) : null,
      tide ? this.getWaterLevel(tide.id).catch(e => ({ error: e.message })) : null,
      curr ? this.getCurrentPredictions(curr.id).catch(e => ({ error: e.message })) : null,
      buoy ? this.getBuoyData(buoy.id).catch(e => ({ error: e.message })) : null,
      this.getWeather(lat, lng).catch(e => ({ error: e.message }))
    ]);

    // Determine tide state
    let tideState = 'unknown';
    if (tides?.predictions?.length >= 1) {
      const next = tides.predictions[0];
      tideState = next?.type === 'H' ? 'Incoming' : 'Outgoing';
    }

    return {
      location: { lat, lng },
      region: stations.region,
      summary: {
        wind: {
          speed: buoyData?.wind?.speed || null,
          direction: buoyData?.wind?.direction || null,
          gusts: buoyData?.wind?.gusts || null,
          station: buoy?.name
        },
        waves: {
          height: buoyData?.waves?.height || null,
          period: buoyData?.waves?.period || null,
          station: buoy?.name
        },
        waterTemp: {
          value: buoyData?.water?.temperature || null,
          station: buoy?.name
        },
        airTemp: {
          value: buoyData?.air?.temperature || weather?.current?.temperature || null
        },
        current: {
          speed: currents?.current?.speed || null,
          direction: currents?.current?.direction || null,
          station: curr?.name
        },
        tide: {
          state: tideState,
          height: waterLevel?.current || null,
          station: tide?.name
        },
        visibility: { value: 10 },
        overallConditions: this.getConditions(buoyData, currents)
      },
      tides: { ...tides, stationName: tide?.name, stationId: tide?.id },
      currents: { ...currents, stationName: curr?.name, stationId: curr?.id },
      buoy: { ...buoyData, stationName: buoy?.name, stationId: buoy?.id },
      weather,
      stations,
      fetchedAt: new Date().toISOString()
    };
  }

  getConditions(buoy, currents) {
    if (buoy?.wind?.speed > 25 || buoy?.waves?.height > 6) return 'hazardous';
    if (buoy?.wind?.speed > 15 || buoy?.waves?.height > 4) return 'challenging';
    if (buoy?.wind?.speed > 10 || buoy?.waves?.height > 2) return 'moderate';
    return 'favorable';
  }
}

module.exports = NOAAService;
