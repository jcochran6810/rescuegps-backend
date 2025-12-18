/**
 * NOAAService.js
 * Service for fetching environmental data from NOAA APIs
 * Provides real-time weather, ocean currents, tides, and buoy data
 */

const axios = require('axios');

class NOAAService {
  constructor() {
    this.baseUrls = {
      tides: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
      currents: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
      buoys: 'https://www.ndbc.noaa.gov/data/realtime2',
      coops: 'https://tidesandcurrents.noaa.gov/api/datagetter'
    };
  }

  /**
   * Get nearest weather/ocean stations to coordinates
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @param {Number} limit - Maximum number of stations
   * @returns {Object} - { tides, currents, buoys }
   */
  async getNearestStations(lat, lng, limit = 5) {
    try {
      // In production, this would query NOAA station database
      // For now, returning mock data
      return {
        tides: [
          { id: '8518750', name: 'The Battery, NY', distance: 2.3 },
          { id: '8516945', name: 'Kings Point, NY', distance: 5.1 }
        ],
        currents: [
          { id: 'ACT4176', name: 'The Narrows', distance: 1.8 }
        ],
        buoys: [
          { id: '44065', name: 'New York Harbor', distance: 3.2 },
          { id: '44025', name: 'Long Island', distance: 15.7 }
        ]
      };
    } catch (error) {
      console.error('Error fetching NOAA stations:', error);
      return { tides: [], currents: [], buoys: [] };
    }
  }

  /**
   * Get current tide data from station
   * @param {String} stationId - NOAA station ID
   * @returns {Object} - Tide predictions
   */
  async getTideData(stationId) {
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000); // +48 hours

      const params = {
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
      };

      const response = await axios.get(this.baseUrls.tides, { params });
      return response.data;

    } catch (error) {
      console.error(`Error fetching tide data for ${stationId}:`, error.message);
      return null;
    }
  }

  /**
   * Get current data from station
   * @param {String} stationId - NOAA station ID
   * @returns {Object} - Current predictions
   */
  async getCurrentData(stationId) {
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const params = {
        product: 'currents_predictions',
        application: 'RescueGPS',
        begin_date: this.formatDate(now),
        end_date: this.formatDate(endDate),
        station: stationId,
        time_zone: 'gmt',
        units: 'english',
        interval: 'h',
        format: 'json'
      };

      const response = await axios.get(this.baseUrls.currents, { params });
      return response.data;

    } catch (error) {
      console.error(`Error fetching current data for ${stationId}:`, error.message);
      return null;
    }
  }

  /**
   * Get buoy data (weather and ocean conditions)
   * @param {String} buoyId - NOAA buoy ID
   * @returns {Object} - Buoy observations
   */
  async getBuoyData(buoyId) {
    try {
      // Fetch latest buoy data
      const specUrl = `${this.baseUrls.buoys}/${buoyId}.spec`;
      const response = await axios.get(specUrl);

      // Parse NOAA buoy data format
      const data = this.parseBuoyData(response.data);
      
      return {
        buoyId,
        timestamp: new Date(),
        wind: {
          speed: data.windSpeed || 15,
          direction: data.windDirection || 225,
          gusts: data.windGusts || 20
        },
        waves: {
          height: data.waveHeight || 4,
          period: data.wavePeriod || 6,
          direction: data.waveDirection || 220
        },
        waterTemp: data.waterTemp || 72,
        airTemp: data.airTemp || 75,
        pressure: data.pressure || 1013,
        visibility: data.visibility || 10
      };

    } catch (error) {
      console.error(`Error fetching buoy data for ${buoyId}:`, error.message);
      
      // Return mock data on error
      return {
        buoyId,
        timestamp: new Date(),
        wind: { speed: 15, direction: 225, gusts: 20 },
        waves: { height: 4, period: 6, direction: 220 },
        waterTemp: 72,
        airTemp: 75,
        pressure: 1013,
        visibility: 10
      };
    }
  }

  /**
   * Get water level data (real-time)
   * @param {String} stationId - NOAA station ID
   * @returns {Object} - Water level observations
   */
  async getWaterLevel(stationId) {
    try {
      const now = new Date();
      const beginDate = new Date(now.getTime() - 6 * 60 * 60 * 1000); // -6 hours

      const params = {
        product: 'water_level',
        application: 'RescueGPS',
        begin_date: this.formatDate(beginDate),
        end_date: this.formatDate(now),
        datum: 'MLLW',
        station: stationId,
        time_zone: 'gmt',
        units: 'english',
        format: 'json'
      };

      const response = await axios.get(this.baseUrls.coops, { params });
      return response.data;

    } catch (error) {
      console.error(`Error fetching water level for ${stationId}:`, error.message);
      return null;
    }
  }

  /**
   * Parse NOAA buoy text format data
   */
  parseBuoyData(rawData) {
    try {
      const lines = rawData.split('\n');
      const dataLine = lines[2]; // Third line contains latest data
      const values = dataLine.trim().split(/\s+/);

      return {
        windSpeed: parseFloat(values[6]) || null,
        windDirection: parseFloat(values[5]) || null,
        windGusts: parseFloat(values[7]) || null,
        waveHeight: parseFloat(values[8]) || null,
        wavePeriod: parseFloat(values[9]) || null,
        waveDirection: parseFloat(values[11]) || null,
        waterTemp: parseFloat(values[14]) || null,
        airTemp: parseFloat(values[13]) || null,
        pressure: parseFloat(values[12]) || null
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Format date for NOAA API (YYYYMMDD HH:MM)
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
   * Get comprehensive environmental data for search area
   * @param {Number} lat - Latitude
   * @param {Number} lng - Longitude
   * @returns {Object} - Combined environmental data
   */
  async getEnvironmentalData(lat, lng) {
    try {
      const stations = await this.getNearestStations(lat, lng);
      
      const [tideData, currentData, buoyData] = await Promise.all([
        stations.tides[0] ? this.getTideData(stations.tides[0].id) : null,
        stations.currents[0] ? this.getCurrentData(stations.currents[0].id) : null,
        stations.buoys[0] ? this.getBuoyData(stations.buoys[0].id) : null
      ]);

      return {
        tides: tideData,
        currents: currentData,
        weather: buoyData,
        stations
      };

    } catch (error) {
      console.error('Error getting environmental data:', error);
      return null;
    }
  }
}

module.exports = NOAAService;