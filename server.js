/**
 * server.js
 * RescueGPS Drift Engine Backend Server v2.3.0
 * Express API for drift physics simulations and NOAA data
 * 
 * DEPLOY TO: Railway (GitHub rescuegps-backend repo root)
 */

const express = require('express');
const cors = require('cors');

// Try to load NOAAService from multiple possible paths
let NOAAService;
try {
  NOAAService = require('./drift-engine/services/NOAAService');
  console.log('[Server] NOAAService loaded from drift-engine/services/');
} catch (e1) {
  try {
    NOAAService = require('./NOAAService');
    console.log('[Server] NOAAService loaded from root');
  } catch (e2) {
    try {
      NOAAService = require('./services/NOAAService');
      console.log('[Server] NOAAService loaded from services/');
    } catch (e3) {
      console.error('[Server] WARNING: Could not load NOAAService from any path');
      NOAAService = null;
    }
  }
}

// Try to load SimulationController
let SimulationController;
try {
  SimulationController = require('./drift-engine/api/SimulationController');
  console.log('[Server] SimulationController loaded');
} catch (e) {
  console.log('[Server] SimulationController not available');
  SimulationController = null;
}

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Initialize services
const noaaService = NOAAService ? new NOAAService() : null;
const simulationController = SimulationController ? new SimulationController() : null;

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RescueGPS Drift Engine',
    version: '2.3.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    noaaAvailable: !!noaaService,
    simulationAvailable: !!simulationController
  });
});

// ============================================
// NOAA ENVIRONMENTAL DATA ENDPOINTS
// ============================================

/**
 * GET /api/noaa/environmental
 * Get comprehensive environmental data for a location
 * This is the MAIN endpoint the frontend calls
 */
app.get('/api/noaa/environmental', async (req, res) => {
  try {
    const { lat, lng, refresh } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        error: 'Missing required parameters: lat, lng' 
      });
    }
    
    if (!noaaService) {
      return res.status(503).json({ 
        error: 'NOAA service not available',
        details: 'NOAAService failed to load. Check server logs.'
      });
    }
    
    console.log(`[NOAA] Fetching environmental data for ${lat}, ${lng}`);
    
    const data = await noaaService.getEnvironmentalData(
      parseFloat(lat), 
      parseFloat(lng)
    );
    
    if (!data) {
      return res.status(500).json({ 
        error: 'Failed to fetch NOAA data',
        isSimulated: true
      });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('[NOAA] Error fetching environmental data:', error);
    res.status(500).json({ 
      error: error.message,
      isSimulated: true
    });
  }
});

/**
 * GET /api/noaa/stations/nearest
 * Get nearest NOAA stations to coordinates
 */
app.get('/api/noaa/stations/nearest', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng parameters' });
    }
    
    if (!noaaService) {
      return res.status(503).json({ error: 'NOAA service not available' });
    }
    
    const stations = noaaService.getNearestStations(
      parseFloat(lat), 
      parseFloat(lng)
    );
    
    res.json(stations);
    
  } catch (error) {
    console.error('[NOAA] Error getting nearest stations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/noaa/tides/:stationId
 * Get tide predictions for a specific station
 */
app.get('/api/noaa/tides/:stationId', async (req, res) => {
  try {
    if (!noaaService) {
      return res.status(503).json({ error: 'NOAA service not available' });
    }
    
    const data = await noaaService.getTideData(req.params.stationId);
    
    if (!data) {
      return res.status(404).json({ error: 'No tide data available for this station' });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('[NOAA] Error fetching tide data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/noaa/waterlevel/:stationId
 * Get water level observations for a specific station
 */
app.get('/api/noaa/waterlevel/:stationId', async (req, res) => {
  try {
    if (!noaaService) {
      return res.status(503).json({ error: 'NOAA service not available' });
    }
    
    const data = await noaaService.getWaterLevel(req.params.stationId);
    
    if (!data) {
      return res.status(404).json({ error: 'No water level data available' });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('[NOAA] Error fetching water level:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/noaa/currents/:stationId
 * Get current predictions for a specific station
 */
app.get('/api/noaa/currents/:stationId', async (req, res) => {
  try {
    if (!noaaService) {
      return res.status(503).json({ error: 'NOAA service not available' });
    }
    
    const data = await noaaService.getCurrentData(req.params.stationId);
    
    if (!data) {
      return res.status(404).json({ error: 'No current data available' });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('[NOAA] Error fetching current data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/noaa/buoy/:buoyId
 * Get buoy data from NDBC
 */
app.get('/api/noaa/buoy/:buoyId', async (req, res) => {
  try {
    if (!noaaService) {
      return res.status(503).json({ error: 'NOAA service not available' });
    }
    
    const data = await noaaService.getBuoyData(req.params.buoyId);
    
    if (!data) {
      return res.status(404).json({ error: 'No buoy data available' });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('[NOAA] Error fetching buoy data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/noaa/weather
 * Get weather forecast from NWS
 */
app.get('/api/noaa/weather', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng parameters' });
    }
    
    if (!noaaService) {
      return res.status(503).json({ error: 'NOAA service not available' });
    }
    
    const data = await noaaService.getWeather(
      parseFloat(lat), 
      parseFloat(lng)
    );
    
    if (!data) {
      return res.status(404).json({ error: 'No weather data available' });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('[NOAA] Error fetching weather:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/noaa/refresh/:dataType/:stationId
 * Force refresh data from a specific station
 */
app.post('/api/noaa/refresh/:dataType/:stationId', async (req, res) => {
  try {
    if (!noaaService) {
      return res.status(503).json({ error: 'NOAA service not available' });
    }
    
    const { dataType, stationId } = req.params;
    let data;
    
    switch (dataType) {
      case 'tides':
        data = await noaaService.getTideData(stationId);
        break;
      case 'currents':
        data = await noaaService.getCurrentData(stationId);
        break;
      case 'buoy':
        data = await noaaService.getBuoyData(stationId);
        break;
      case 'waterlevel':
        data = await noaaService.getWaterLevel(stationId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid data type' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'No data available' });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('[NOAA] Error refreshing data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SIMULATION ENDPOINTS
// ============================================

/**
 * POST /api/simulations
 * Start a new drift simulation
 */
app.post('/api/simulations', async (req, res) => {
  try {
    if (!simulationController) {
      return res.status(503).json({ error: 'Simulation service not available' });
    }
    const result = await simulationController.startSimulation(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to start simulation'
    });
  }
});

/**
 * GET /api/simulations
 * List all simulations
 */
app.get('/api/simulations', (req, res) => {
  try {
    if (!simulationController) {
      return res.status(503).json({ error: 'Simulation service not available' });
    }
    const simulations = simulationController.listSimulations();
    res.json(simulations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/simulations/:id/status
 * Get simulation status
 */
app.get('/api/simulations/:id/status', (req, res) => {
  try {
    if (!simulationController) {
      return res.status(503).json({ error: 'Simulation service not available' });
    }
    const status = simulationController.getSimulationStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * GET /api/simulations/:id/results
 * Get simulation results
 */
app.get('/api/simulations/:id/results', (req, res) => {
  try {
    if (!simulationController) {
      return res.status(503).json({ error: 'Simulation service not available' });
    }
    const results = simulationController.getSimulationResults(req.params.id);
    res.json(results);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * DELETE /api/simulations/:id
 * Cancel/delete a simulation
 */
app.delete('/api/simulations/:id', (req, res) => {
  try {
    if (!simulationController) {
      return res.status(503).json({ error: 'Simulation service not available' });
    }
    simulationController.cancelSimulation(req.params.id);
    res.json({ success: true, message: 'Simulation cancelled' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// ============================================
// OBJECT TYPES ENDPOINT
// ============================================

/**
 * GET /api/object-types
 * Get available drift object types
 */
app.get('/api/object-types', (req, res) => {
  res.json({
    types: [
      'person-in-water',
      'person-with-pfd',
      'person-in-drysuit',
      'life-raft-4',
      'life-raft-6',
      'life-raft-10-plus',
      'small-vessel',
      'medium-vessel',
      'sailboat',
      'kayak',
      'canoe',
      'surfboard',
      'paddleboard',
      'debris-small',
      'debris-large'
    ]
  });
});

// ============================================
// BATHYMETRY ENDPOINT (placeholder)
// ============================================
app.post('/api/bathymetry/contours', (req, res) => {
  res.json({ 
    contours: [],
    message: 'Bathymetry data not yet implemented'
  });
});

// ============================================
// SHORELINE DATA ENDPOINT
// ============================================
app.get('/api/shoreline', (req, res) => {
  const { lat, lng, radius } = req.query;
  
  res.json({
    polygons: [
      {
        name: 'Texas City',
        coordinates: [
          { lat: 29.4200, lng: -94.9500 },
          { lat: 29.4200, lng: -94.8800 },
          { lat: 29.3800, lng: -94.8800 },
          { lat: 29.3800, lng: -94.9500 }
        ]
      },
      {
        name: 'Galveston Island',
        coordinates: [
          { lat: 29.3100, lng: -94.8600 },
          { lat: 29.2700, lng: -94.8200 },
          { lat: 29.2000, lng: -94.7800 },
          { lat: 29.1800, lng: -94.8800 },
          { lat: 29.2200, lng: -94.9500 },
          { lat: 29.2700, lng: -94.9200 }
        ]
      }
    ],
    source: 'fallback',
    fetchedAt: new Date().toISOString()
  });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path 
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=== RescueGPS Backend v2.3.0 ===');
  console.log(`Port: ${PORT}`);
  console.log(`NOAA Service: ${noaaService ? 'LOADED' : 'NOT AVAILABLE'}`);
  console.log(`Simulation Service: ${simulationController ? 'LOADED' : 'NOT AVAILABLE'}`);
  console.log('Coverage: USA Nationwide');
  console.log('Status: Ready');
  console.log('================================');
  console.log('');
});
