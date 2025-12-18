/**
 * SimulationController.js
 * Main API controller for drift simulations
 * Manages simulation lifecycle: create, run, monitor, retrieve results
 */

const ParticleEngine = require('../core/ParticleEngine');
const EnvironmentalManager = require('../core/EnvironmentalManager');
const TimeSteppingSimulator = require('../core/TimeSteppingSimulator');
const DensityAnalyzer = require('../analysis/DensityAnalyzer');
const ProbabilityCalculator = require('../analysis/ProbabilityCalculator');
const SurvivalAnalyzer = require('../analysis/SurvivalAnalyzer');

class SimulationController {
  constructor() {
    this.simulations = new Map(); // Active simulations
  }

  /**
   * Start a new drift simulation
   * @param {Object} config - Simulation configuration
   * @returns {Object} - { simulationId, status }
   */
  async startSimulation(config) {
    const id = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate configuration
    if (!config.lkp || !config.lkp.lat || !config.lkp.lng) {
      throw new Error('Invalid LKP coordinates');
    }

    // Initialize simulation components
    const particleEngine = new ParticleEngine({
      particleCount: config.particleCount || 10000,
      lkp: config.lkp,
      objectType: config.objectType || 'person-in-water'
    });

    const envManager = new EnvironmentalManager(config.lkp);
    
    const simulator = new TimeSteppingSimulator(
      particleEngine,
      envManager,
      {
        objectType: config.objectType || 'person-in-water',
        durationHours: config.durationHours || 72
      }
    );

    // Store simulation
    const simulation = {
      id,
      status: 'running',
      progress: 0,
      config,
      simulator,
      particleEngine,
      envManager,
      startTime: Date.now(),
      endTime: null,
      results: null
    };

    this.simulations.set(id, simulation);

    // Run simulation asynchronously
    setImmediate(() => this.runSimulation(id));

    return {
      simulationId: id,
      status: 'started',
      estimatedDuration: config.durationHours || 72
    };
  }

  /**
   * Run simulation to completion
   */
  async runSimulation(id) {
    const sim = this.simulations.get(id);
    if (!sim) return;

    try {
      const durationHours = sim.config.durationHours || 72;
      const timeStepSeconds = 600; // 10-minute time steps
      const totalSteps = (durationHours * 3600) / timeStepSeconds;

      for (let step = 0; step < totalSteps; step++) {
        sim.simulator.step(timeStepSeconds);
        sim.progress = ((step + 1) / totalSteps) * 100;

        // Yield control periodically to prevent blocking
        if (step % 10 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      // Simulation complete - generate results
      sim.status = 'completed';
      sim.results = this.generateResults(sim);
      sim.endTime = Date.now();
      sim.progress = 100;

    } catch (error) {
      sim.status = 'failed';
      sim.error = error.message;
    }
  }

  /**
   * Generate comprehensive results from simulation
   */
  generateResults(sim) {
    const densityAnalyzer = new DensityAnalyzer();
    const probabilityCalc = new ProbabilityCalculator();
    const survivalAnalyzer = new SurvivalAnalyzer();

    const particles = sim.particleEngine.getAllParticles();
    
    // Analyze particle distribution
    const density = densityAnalyzer.analyze(particles);
    const probability = probabilityCalc.calculate(particles);
    
    // Calculate survival factors
    const elapsedHours = (sim.endTime - sim.startTime) / (1000 * 3600);
    const survival = survivalAnalyzer.analyze(
      sim.config.victimProfile || { age: 40, hasPFD: false },
      sim.envManager.conditions,
      elapsedHours
    );

    // Particle statistics
    const stats = sim.particleEngine.getStats();

    return {
      simulationId: sim.id,
      particles: {
        total: stats.total,
        active: stats.active,
        beached: stats.beached,
        recovered: stats.recovered
      },
      density: {
        heatMap: density.heatMap,
        maxDensity: density.maxDensity,
        totalCells: density.totalCells
      },
      probability: {
        polygon50: probability.polygon50,
        polygon90: probability.polygon90,
        centroid: probability.centroid,
        confidence: probability.confidence
      },
      survival: {
        probability: survival.probability,
        timeRemaining: survival.timeRemaining,
        urgency: survival.urgency,
        recommendations: survival.recommendations
      },
      environmental: sim.envManager.conditions,
      snapshots: sim.simulator.getSnapshots(),
      duration: {
        simulated: sim.config.durationHours,
        elapsed: (sim.endTime - sim.startTime) / 1000
      }
    };
  }

  /**
   * Get simulation status
   */
  getSimulationStatus(id) {
    const sim = this.simulations.get(id);
    if (!sim) {
      throw new Error('Simulation not found');
    }

    return {
      id: sim.id,
      status: sim.status,
      progress: Math.round(sim.progress),
      startTime: sim.startTime,
      endTime: sim.endTime,
      error: sim.error
    };
  }

  /**
   * Get simulation results
   */
  getSimulationResults(id) {
    const sim = this.simulations.get(id);
    if (!sim) {
      throw new Error('Simulation not found');
    }
    
    if (sim.status !== 'completed') {
      throw new Error('Simulation not completed yet');
    }

    return sim.results;
  }

  /**
   * Get snapshot at specific hour
   */
  getSnapshot(id, hour) {
    const sim = this.simulations.get(id);
    if (!sim) {
      throw new Error('Simulation not found');
    }

    const snapshots = sim.simulator.getSnapshots();
    const snapshot = snapshots.find(s => s.time === hour * 3600);
    
    if (!snapshot) {
      throw new Error('Snapshot not found for specified hour');
    }

    return snapshot;
  }

  /**
   * List all simulations
   */
  listSimulations() {
    return Array.from(this.simulations.values()).map(sim => ({
      id: sim.id,
      status: sim.status,
      progress: Math.round(sim.progress),
      startTime: sim.startTime,
      config: {
        lkp: sim.config.lkp,
        objectType: sim.config.objectType,
        durationHours: sim.config.durationHours
      }
    }));
  }

  /**
   * Delete simulation
   */
  deleteSimulation(id) {
    if (!this.simulations.has(id)) {
      throw new Error('Simulation not found');
    }
    
    this.simulations.delete(id);
  }

  /**
   * Stop running simulation
   */
  stopSimulation(id) {
    const sim = this.simulations.get(id);
    if (!sim) {
      throw new Error('Simulation not found');
    }

    if (sim.status === 'running') {
      sim.status = 'stopped';
    }
  }
}

module.exports = SimulationController;