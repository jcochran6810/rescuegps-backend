/**
 * server.js
 * RescueGPS Drift Engine Backend Server
 * 
 * ENHANCED with:
 * - Bathymetry endpoints
 * - Coastline data
 * - HF Radar integration
 * - ADCIRC model data
 * - Shallow water physics
 */

const express = require('express');
const cors = require('cors');
const SimulationController = require('./drift-engine/api/SimulationController');
const BathymetryService = require('./services/BathymetryService');
const CoastlineService = require('./services/CoastlineService');
const HFRadarService = require('./services/HFRadarService');
const ADCIRCService = require('./services/ADCIRCService');
const NOAAService = require('./services/NOAAService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize services
const simulationController = new SimulationController();
const bathymetryService = new BathymetryService();
const coastlineService = new CoastlineService();
const hfRadarService = new HFRadarService();
const adcircService = new ADCIRCService();
const noaaService = new NOAAService();

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RescueGPS Drift Engine',
    version: '2.0.0',
    features: [
      'particle-simulation',
      'shallow-water-physics',
      'bathymetry',
      'coastline-detection',
      'hf-radar',
      'adcirc-model'
    ],
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================
// SIMULATION ENDPOINTS
// ============================================

app.post('/api/simulations', async (req, res) => {
  try {
    const result = await simulationController.startSimulation(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/simulations', (req, res) => {
  try {
    res.json(simulationController.listSimulations());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/simulations/:id/status', (req, res) => {
  try {
    res.json(simulationController.getSimulationStatus(req.params.id));
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/simulations/:id/results', (req, res) => {
  try {
    res.json(simulationController.getSimulationResults(req.params.id));
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.delete('/api/simulations/:id', (req, res) => {
  try {
    simulationController.deleteSimulation(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// ============================================
// BATHYMETRY ENDPOINTS
// ============================================

/**
 * GET /api/bathymetry/depth
 * Get depth at a specific point
 */
app.get('/api/bathymetry/depth', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const depth = await bathymetryService.getDepth(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json(depth);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bathymetry/grid
 * Get depth grid for an area (for visualization)
 */
app.post('/api/bathymetry/grid', async (req, res) => {
  try {
    const { bounds, resolution } = req.body;
    const grid = await bathymetryService.getDepthGrid(
      bounds,
      resolution || 0.005
    );
    res.json(grid);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bathymetry/contours
 * Get depth contours for visualization
 */
app.post('/api/bathymetry/contours', async (req, res) => {
  try {
    const { bounds, levels } = req.body;
    const contours = await bathymetryService.getDepthContours(
      bounds,
      levels || [2, 5, 10, 20, 50, 100]
    );
    res.json(contours);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bathymetry/gradient
 * Get bathymetry gradient at a point
 */
app.get('/api/bathymetry/gradient', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const gradient = await bathymetryService.getBathymetryGradient(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json(gradient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// COASTLINE ENDPOINTS
// ============================================

/**
 * GET /api/coastline/check
 * Check if a point is on land or water
 */
app.get('/api/coastline/check', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const result = await coastlineService.isOnLand(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/coastline/shore-type
 * Get shore classification at a point
 */
app.get('/api/coastline/shore-type', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const shoreType = await coastlineService.getShoreType(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json(shoreType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/coastline/distance
 * Get distance and direction to nearest shore
 */
app.get('/api/coastline/distance', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const distance = await coastlineService.getDistanceToShore(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json(distance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/coastline/polyline
 * Get coastline for an area (for visualization)
 */
app.post('/api/coastline/polyline', async (req, res) => {
  try {
    const { bounds } = req.body;
    const coastline = await coastlineService.getCoastlinePolyline(bounds);
    res.json(coastline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HF RADAR ENDPOINTS
// ============================================

/**
 * GET /api/hfradar/currents
 * Get HF Radar surface currents
 */
app.get('/api/hfradar/currents', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const currents = await hfRadarService.getSurfaceCurrents(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json(currents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/hfradar/coverage
 * Check if location is in HF Radar coverage
 */
app.get('/api/hfradar/coverage', (req, res) => {
  try {
    const { lat, lng } = req.query;
    const coverage = hfRadarService.isInCoverage(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json(coverage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hfradar/grid
 * Get HF Radar current grid for visualization
 */
app.post('/api/hfradar/grid', async (req, res) => {
  try {
    const { bounds, resolution } = req.body;
    const grid = await hfRadarService.getCurrentGrid(bounds, resolution);
    res.json(grid);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADCIRC MODEL ENDPOINTS
// ============================================

/**
 * GET /api/adcirc/data
 * Get ADCIRC model data at a point
 */
app.get('/api/adcirc/data', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const data = await adcircService.getModelData(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/adcirc/models
 * List available ADCIRC models for a location
 */
app.get('/api/adcirc/models', (req, res) => {
  try {
    const { lat, lng } = req.query;
    const models = adcircService.findCoveringModels(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/adcirc/water-level
 * Get water level forecast
 */
app.get('/api/adcirc/water-level', async (req, res) => {
  try {
    const { lat, lng, hours } = req.query;
    const forecast = await adcircService.getWaterLevelForecast(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(hours) || 48
    );
    res.json(forecast);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/adcirc/tidal-currents
 * Get tidal current forecast
 */
app.get('/api/adcirc/tidal-currents', async (req, res) => {
  try {
    const { lat, lng, hours } = req.query;
    const forecast = await adcircService.getTidalCurrentForecast(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(hours) || 24
    );
    res.json(forecast);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SHALLOW WATER PHYSICS ENDPOINTS
// ============================================

/**
 * GET /api/physics/shore-types
 * List all modeled shore types
 */
app.get('/api/physics/shore-types', (req, res) => {
  const ShallowWaterPhysics = require('./drift-engine/physics/ShallowWaterPhysics');
  const physics = new ShallowWaterPhysics();
  
  res.json({
    types: physics.listShoreTypes(),
    descriptions: {
      rocky: 'Exposed rocky shores - high stickiness (90%)',
      sandy: 'Sand beaches - moderate stickiness (60%)',
      muddy: 'Mud flats - very high stickiness (95%)',
      marsh: 'Salt marsh - maximum stickiness (100%)',
      mangrove: 'Mangrove forests - maximum stickiness (100%)',
      seawall: 'Seawalls/bulkheads - low stickiness, high reflection (90%)',
      riprap: 'Riprap/rubble - moderate stickiness and reflection',
      coral: 'Coral reefs - high stickiness (70%)'
    }
  });
});

/**
 * POST /api/physics/shallow-water
 * Calculate shallow water effects at a point
 */
app.post('/api/physics/shallow-water', (req, res) => {
  try {
    const ShallowWaterPhysics = require('./drift-engine/physics/ShallowWaterPhysics');
    const physics = new ShallowWaterPhysics();
    
    const { particle, environmental, depth, deltaHours } = req.body;
    const effects = physics.calculate(particle, environmental, depth, deltaHours);
    
    res.json(effects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NOAA DATA ENDPOINTS
// ============================================

app.get('/api/noaa/stations', async (req, res) => {
  try {
    const { lat, lng, limit } = req.query;
    const stations = await noaaService.getNearestStations(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(limit) || 5
    );
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/noaa/environmental', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const data = await noaaService.getEnvironmentalData(
      parseFloat(lat),
      parseFloat(lng)
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// OBJECT TYPES
// ============================================
app.get('/api/object-types', (req, res) => {
  res.json({
    types: [
      { id: 'person-in-water', name: 'Person in Water (PIW)', leeway: 0.03 },
      { id: 'person-with-pfd', name: 'Person with PFD', leeway: 0.04 },
      { id: 'life-raft-4', name: 'Life Raft (4-person)', leeway: 0.06 },
      { id: 'life-raft-6', name: 'Life Raft (6-person)', leeway: 0.065 },
      { id: 'kayak', name: 'Kayak', leeway: 0.045 },
      { id: 'small-vessel', name: 'Small Vessel', leeway: 0.05 },
      { id: 'sailboat', name: 'Sailboat', leeway: 0.08 },
      { id: 'surfboard', name: 'Surfboard', leeway: 0.035 },
      { id: 'debris', name: 'Debris/Cooler', leeway: 0.04 }
    ]
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ════════════════════════════════════════════════════════');
  console.log('🚀 RescueGPS Drift Engine v2.0.0');
  console.log('🚀 ════════════════════════════════════════════════════════');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Health check: http://localhost:${PORT}/health`);
  console.log('🚀 ────────────────────────────────────────────────────────');
  console.log('🚀 Features:');
  console.log('🚀   ✓ Particle Simulation (5K-200K)');
  console.log('🚀   ✓ Shallow Water Physics');
  console.log('🚀   ✓ Bathymetry/Depth Charts');
  console.log('🚀   ✓ Coastline Detection');
  console.log('🚀   ✓ Shore Type Classification');
  console.log('🚀   ✓ HF Radar Currents');
  console.log('🚀   ✓ ADCIRC Model Data');
  console.log('🚀 ════════════════════════════════════════════════════════');
});

module.exports = app;
