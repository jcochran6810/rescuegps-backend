/**
 * server.js
 * RescueGPS Drift Engine Backend Server
 * Express API for drift physics simulations
 */

const express = require('express');
const cors = require('cors');
const SimulationController = require('./drift-engine/api/SimulationController');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize simulation controller
const simulationController = new SimulationController();

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RescueGPS Drift Engine',
    version: '1.0.3',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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
    const results = simulationController.getSimulationResults(req.params.id);
    res.json(results);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * GET /api/simulations/:id/snapshot/:hour
 * Get snapshot at specific hour
 */
app.get('/api/simulations/:id/snapshot/:hour', (req, res) => {
  try {
    const snapshot = simulationController.getSnapshot(
      req.params.id,
      parseInt(req.params.hour)
    );
    res.json(snapshot);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * DELETE /api/simulations/:id
 * Delete simulation
 */
app.delete('/api/simulations/:id', (req, res) => {
  try {
    simulationController.deleteSimulation(req.params.id);
    res.json({ message: 'Simulation deleted successfully' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /api/simulations/:id/stop
 * Stop running simulation
 */
app.post('/api/simulations/:id/stop', (req, res) => {
  try {
    simulationController.stopSimulation(req.params.id);
    res.json({ message: 'Simulation stopped' });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// ============================================
// NOAA DATA ENDPOINTS
// ============================================

/**
 * GET /api/noaa/stations/nearest
 * Get nearest NOAA stations
 */
app.get('/api/noaa/stations/nearest', async (req, res) => {
  try {
    const { lat, lng, limit } = req.query;
    
    // Mock response for now
    res.json({
      tides: [],
      currents: [],
      buoys: []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/noaa/data/buoy/:buoyId
 * Get buoy data
 */
app.get('/api/noaa/data/buoy/:buoyId', async (req, res) => {
  try {
    // Mock response
    res.json({
      buoyId: req.params.buoyId,
      wind: { speed: 15, direction: 225, gusts: 20 },
      waves: { height: 4, period: 6, direction: 220 },
      waterTemp: 72,
      airTemp: 75
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      'wood-debris',
      'plastic-debris',
      'cooler'
    ]
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ════════════════════════════════════════════════════════');
  console.log('🚀 RescueGPS Drift Engine Server');
  console.log('🚀 ════════════════════════════════════════════════════════');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Health check: http://localhost:${PORT}/health`);
  console.log(`🚀 API base: http://localhost:${PORT}/api`);
  console.log('🚀 ════════════════════════════════════════════════════════');
});

module.exports = app;