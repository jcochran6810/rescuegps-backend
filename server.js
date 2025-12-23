/**
 * server.js
 * RescueGPS Backend Server - NATIONWIDE COVERAGE
 * 
 * Works for ANY US coastal location:
 * - Dynamic station discovery
 * - Regional shoreline data
 * - Real-time NOAA data
 */

const express = require('express');
const cors = require('cors');
const NOAAService = require('./NOAAService');
const ShorelineService = require('./ShorelineService');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const noaaService = new NOAAService();
const shorelineService = new ShorelineService();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RescueGPS Backend',
    version: '2.1.0',
    coverage: 'Nationwide USA',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    features: [
      'dynamic-station-discovery',
      'nationwide-coverage', 
      'real-time-noaa',
      'shoreline-clipping',
      'drift-simulation'
    ]
  });
});

// ============================================
// NOAA ENVIRONMENTAL DATA - WORKS ANYWHERE
// ============================================

/**
 * GET /api/noaa/environmental
 * Main endpoint - Get all environmental data for ANY US location
 * Automatically discovers nearest stations
 */
app.get('/api/noaa/environmental', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        error: 'Missing required parameters: lat, lng',
        example: '/api/noaa/environmental?lat=29.31&lng=-94.79'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Validate US coverage (rough bounds)
    if (latitude < 24 || latitude > 50 || longitude < -130 || longitude > -65) {
      return res.status(400).json({ 
        error: 'Coordinates outside US coverage area',
        bounds: { lat: '24-50', lng: '-130 to -65' }
      });
    }

    const data = await noaaService.getEnvironmentalData(latitude, longitude);
    res.json(data);

  } catch (error) {
    console.error('Error fetching environmental data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/noaa/stations/nearest
 * Find nearest stations to any coordinates
 */
app.get('/api/noaa/stations/nearest', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat, lng' });
    }

    const stations = await noaaService.getNearestStations(
      parseFloat(lat), 
      parseFloat(lng),
      parseFloat(radius) || 100
    );
    
    res.json(stations);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Individual data type endpoints
 */
app.get('/api/noaa/tides/:stationId', async (req, res) => {
  try {
    const data = await noaaService.getTidePredictions(req.params.stationId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/waterlevel/:stationId', async (req, res) => {
  try {
    const data = await noaaService.getWaterLevel(req.params.stationId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/currents/:stationId', async (req, res) => {
  try {
    const data = await noaaService.getCurrentPredictions(req.params.stationId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/buoy/:buoyId', async (req, res) => {
  try {
    const data = await noaaService.getBuoyData(req.params.buoyId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/weather', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat, lng' });
    }
    const data = await noaaService.getWeatherForecast(parseFloat(lat), parseFloat(lng));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SHORELINE / LAND POLYGON DATA
// ============================================

/**
 * GET /api/shoreline
 * Get shoreline/land polygons for any US coastal area
 * Used for clipping probability zones to water only
 */
app.get('/api/shoreline', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        error: 'Missing required parameters: lat, lng',
        example: '/api/shoreline?lat=29.31&lng=-94.79&radius=50'
      });
    }

    const data = await shorelineService.getShorelineData(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius) || 50
    );
    
    res.json(data);

  } catch (error) {
    console.error('Error fetching shoreline data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/shoreline/clip
 * Clip a polygon to remove land areas
 * Body: { polygon: [{lat, lng}, ...], lat, lng }
 */
app.post('/api/shoreline/clip', async (req, res) => {
  try {
    const { polygon, lat, lng } = req.body;
    
    if (!polygon || !lat || !lng) {
      return res.status(400).json({ error: 'Missing polygon, lat, or lng' });
    }

    // Get shoreline data for the area
    const shorelineData = await shorelineService.getShorelineData(lat, lng, 50);
    
    // Clip the polygon
    const clippedPolygon = shorelineService.clipPolygonToWater(polygon, shorelineData);
    
    res.json({
      original: polygon,
      clipped: clippedPolygon,
      pointsRemoved: polygon.length - clippedPolygon.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/shoreline/check-point
 * Check if a single point is on land or water
 */
app.get('/api/shoreline/check-point', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat, lng' });
    }

    const shorelineData = await shorelineService.getShorelineData(
      parseFloat(lat), 
      parseFloat(lng), 
      20
    );
    
    const isLand = shorelineService.isPointOnLand(
      parseFloat(lat), 
      parseFloat(lng), 
      shorelineData
    );
    
    res.json({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      isLand,
      isWater: !isLand
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CHART TILE INFO
// ============================================

/**
 * GET /api/charts/info
 * Get info about available chart tile services
 * These work NATIONWIDE - no regional configuration needed
 */
app.get('/api/charts/info', (req, res) => {
  res.json({
    description: 'NOAA chart tiles work for entire US coast - no configuration needed',
    tiles: {
      nauticalCharts: {
        name: 'NOAA Nautical Charts (RNC)',
        url: 'https://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png',
        coverage: 'All US coastal waters',
        zoom: { min: 3, max: 16 }
      },
      encCharts: {
        name: 'NOAA Electronic Charts (ENC)',
        url: 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/tile/{z}/{y}/{x}',
        coverage: 'All US coastal waters',
        zoom: { min: 3, max: 18 }
      },
      bathymetry: {
        name: 'NOAA Bathymetry',
        url: 'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/tile/{z}/{y}/{x}',
        coverage: 'Global',
        zoom: { min: 1, max: 13 }
      }
    },
    usage: 'Add as tile layer to Google Maps or Leaflet - works anywhere in the US'
  });
});

// ============================================
// SIMULATION ENDPOINTS
// ============================================

const simulations = new Map();

app.post('/api/simulations', async (req, res) => {
  try {
    const id = `sim_${Date.now()}`;
    
    simulations.set(id, {
      id,
      status: 'running',
      progress: 0,
      config: req.body,
      startedAt: new Date().toISOString()
    });
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      const sim = simulations.get(id);
      if (sim) {
        sim.progress = Math.min(progress, 100);
        if (progress >= 100) {
          sim.status = 'completed';
          clearInterval(interval);
        }
      }
    }, 500);
    
    res.json({ simulationId: id, status: 'started' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/simulations/:id/status', (req, res) => {
  const sim = simulations.get(req.params.id);
  if (!sim) return res.status(404).json({ error: 'Simulation not found' });
  res.json({ id: sim.id, status: sim.status, progress: sim.progress });
});

app.get('/api/simulations/:id/results', (req, res) => {
  const sim = simulations.get(req.params.id);
  if (!sim) return res.status(404).json({ error: 'Simulation not found' });
  res.json({
    id: sim.id,
    status: sim.status,
    results: {
      particleCount: sim.config?.particleCount || 1000,
      probabilityZones: [],
      centroid: sim.config?.lkp || { lat: 29.5, lng: -94.8 }
    }
  });
});

// ============================================
// OBJECT TYPES
// ============================================

app.get('/api/object-types', (req, res) => {
  res.json({
    types: [
      'person-in-water', 'person-with-pfd', 'person-in-drysuit',
      'life-raft-4', 'life-raft-6', 'life-raft-10-plus',
      'small-vessel', 'medium-vessel', 'sailboat',
      'kayak', 'canoe', 'surfboard', 'paddleboard',
      'wood-debris', 'plastic-debris', 'cooler'
    ]
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    availableEndpoints: [
      'GET  /health',
      'GET  /api/noaa/environmental?lat=&lng=',
      'GET  /api/noaa/stations/nearest?lat=&lng=',
      'GET  /api/noaa/tides/:stationId',
      'GET  /api/noaa/currents/:stationId',
      'GET  /api/noaa/buoy/:buoyId',
      'GET  /api/noaa/weather?lat=&lng=',
      'GET  /api/shoreline?lat=&lng=&radius=',
      'POST /api/shoreline/clip',
      'GET  /api/shoreline/check-point?lat=&lng=',
      'GET  /api/charts/info'
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('================================================================');
  console.log('   RescueGPS Backend Server v2.1.0 - NATIONWIDE COVERAGE');
  console.log('================================================================');
  console.log(`   Port: ${PORT}`);
  console.log('   Coverage: All US Coastal Waters + Great Lakes');
  console.log('   NOAA Data: Real-time (Dynamic Station Discovery)');
  console.log('   Shoreline: Regional Polygons + OSM Coastline');
  console.log('   Charts: National NOAA Tile Services');
  console.log('----------------------------------------------------------------');
  console.log('   Test: /api/noaa/environmental?lat=29.31&lng=-94.79');
  console.log('================================================================');
  console.log('');
});

module.exports = app;
