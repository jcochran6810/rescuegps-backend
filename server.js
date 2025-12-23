/**
 * server.js - STABLE VERSION
 * RescueGPS Backend - Works anywhere in USA
 * Fixed paths for Railway folder structure
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Lazy load services with correct paths
let noaaService = null;
let shorelineService = null;

const getNoaaService = () => {
  if (!noaaService) {
    try {
      // Try services folder first (your current structure)
      const NOAAService = require('./drift-engine/services/NOAAService');
      noaaService = new NOAAService();
    } catch (e) {
      // Fallback to root
      try {
        const NOAAService = require('./NOAAService');
        noaaService = new NOAAService();
      } catch (e2) {
        console.error('NOAAService not found in either location');
        return null;
      }
    }
  }
  return noaaService;
};

const getShorelineService = () => {
  if (!shorelineService) {
    try {
      const ShorelineService = require('./drift-engine/services/ShorelineService');
      shorelineService = new ShorelineService();
    } catch (e) {
      try {
        const ShorelineService = require('./ShorelineService');
        shorelineService = new ShorelineService();
      } catch (e2) {
        console.error('ShorelineService not found');
        return null;
      }
    }
  }
  return shorelineService;
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RescueGPS Backend',
    version: '2.2.1',
    coverage: 'USA Nationwide',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// ============================================
// NOAA ENVIRONMENTAL DATA
// ============================================

app.get('/api/noaa/environmental', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat, lng' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const svc = getNoaaService();
    if (!svc) {
      return res.status(500).json({ error: 'NOAA service not available' });
    }

    const data = await svc.getEnvironmentalData(latitude, longitude);
    res.json(data);

  } catch (error) {
    console.error('Env data error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/stations/nearest', (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Missing lat, lng' });
    
    const svc = getNoaaService();
    if (!svc) return res.status(500).json({ error: 'Service not available' });
    
    const stations = svc.getNearestStations(parseFloat(lat), parseFloat(lng));
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/tides/:stationId', async (req, res) => {
  try {
    const svc = getNoaaService();
    if (!svc) return res.status(500).json({ error: 'Service not available' });
    const data = await svc.getTidePredictions(req.params.stationId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/waterlevel/:stationId', async (req, res) => {
  try {
    const svc = getNoaaService();
    if (!svc) return res.status(500).json({ error: 'Service not available' });
    const data = await svc.getWaterLevel(req.params.stationId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/currents/:stationId', async (req, res) => {
  try {
    const svc = getNoaaService();
    if (!svc) return res.status(500).json({ error: 'Service not available' });
    const data = await svc.getCurrentPredictions(req.params.stationId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/buoy/:buoyId', async (req, res) => {
  try {
    const svc = getNoaaService();
    if (!svc) return res.status(500).json({ error: 'Service not available' });
    const data = await svc.getBuoyData(req.params.buoyId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/weather', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Missing lat, lng' });
    const svc = getNoaaService();
    if (!svc) return res.status(500).json({ error: 'Service not available' });
    const data = await svc.getWeather(parseFloat(lat), parseFloat(lng));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SHORELINE DATA
// ============================================

app.get('/api/shoreline', (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Missing lat, lng' });
    
    const svc = getShorelineService();
    if (!svc) return res.status(500).json({ error: 'Service not available' });
    
    const data = svc.getShorelineData(parseFloat(lat), parseFloat(lng), parseFloat(radius) || 50);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shoreline/check-point', (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Missing lat, lng' });
    
    const svc = getShorelineService();
    if (!svc) return res.status(500).json({ error: 'Service not available' });
    
    const data = svc.getShorelineData(parseFloat(lat), parseFloat(lng), 20);
    const isLand = svc.isPointOnLand(parseFloat(lat), parseFloat(lng), data);
    
    res.json({ lat: parseFloat(lat), lng: parseFloat(lng), isLand, isWater: !isLand });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/shoreline/clip', (req, res) => {
  try {
    const { polygon, lat, lng } = req.body;
    if (!polygon || !lat || !lng) return res.status(400).json({ error: 'Missing data' });
    
    const svc = getShorelineService();
    if (!svc) return res.status(500).json({ error: 'Service not available' });
    
    const data = svc.getShorelineData(lat, lng, 50);
    const clipped = svc.clipPolygonToWater(polygon, data);
    
    res.json({ original: polygon.length, clipped: clipped.length, polygon: clipped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CHART INFO
// ============================================

app.get('/api/charts/info', (req, res) => {
  res.json({
    nautical: 'https://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png',
    enc: 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/tile/{z}/{y}/{x}',
    coverage: 'All US Waters'
  });
});

// ============================================
// SIMULATIONS
// ============================================

const simulations = new Map();

app.post('/api/simulations', (req, res) => {
  const id = `sim_${Date.now()}`;
  simulations.set(id, { id, status: 'running', progress: 0, config: req.body });
  
  let p = 0;
  const i = setInterval(() => {
    p += 10;
    const s = simulations.get(id);
    if (s) {
      s.progress = Math.min(p, 100);
      if (p >= 100) { s.status = 'completed'; clearInterval(i); }
    }
  }, 500);
  
  res.json({ simulationId: id, status: 'started' });
});

app.get('/api/simulations/:id/status', (req, res) => {
  const s = simulations.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({ id: s.id, status: s.status, progress: s.progress });
});

app.get('/api/simulations/:id/results', (req, res) => {
  const s = simulations.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({ id: s.id, status: s.status, results: { probabilityZones: [] } });
});

// ============================================
// OBJECT TYPES
// ============================================

app.get('/api/object-types', (req, res) => {
  res.json({
    types: ['person-in-water','person-with-pfd','life-raft-4','life-raft-6','small-vessel','kayak','paddleboard','debris']
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

// ============================================
// START
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== RescueGPS Backend v2.2.1 ===`);
  console.log(`Port: ${PORT}`);
  console.log(`Coverage: USA Nationwide`);
  console.log(`Status: Ready\n`);
});

module.exports = app;
