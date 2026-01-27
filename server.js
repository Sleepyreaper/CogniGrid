const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Global simulation variables
let weatherLevel = 0; // 0-100, severity of extreme weather
let renewablesEnabled = false;
let purchasePowerEnabled = false;

// Cost constants (per MW per hour)
const TRADITIONAL_COST_PER_MW = 45; // $/MW
const RENEWABLE_COST_PER_MW = 15; // $/MW
const MICROCLIMATE_BASE_COST = 0.12; // $/kWh base rate
const BASE_DEMAND = 12000; // MW

// Outage variables
let outageProbability = 0; // 0-100%

// Serve static files from public directory
app.use(express.static('public'));

// Route for the main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Simulated IoT sensors data
const sensors = [
  { id: 'sensor-1', location: 'Substation A', type: 'Voltage' },
  { id: 'sensor-2', location: 'Substation B', type: 'Current' },
  { id: 'sensor-3', location: 'Transformer C', type: 'Power', renewable: false },
  { id: 'sensor-4', location: 'Line D', type: 'Frequency' },
  { id: 'sensor-5', location: 'Generator E', type: 'Temperature' },
  { id: 'sensor-6', location: 'Wind Farm F', type: 'Power', renewable: true },
  { id: 'sensor-7', location: 'Solar Panel G', type: 'Power', renewable: true }
];

// Function to calculate system costs and outage
function calculateSystemMetrics() {
  let totalTraditionalPower = 0;
  let totalRenewablePower = 0;
  let totalPower = 0;

  // Calculate power from all sensors
  sensors.forEach(sensor => {
    if (sensor.type === 'Power') {
      let power = 5000 + (Math.random() - 0.5) * 0.1 * 5000; // Base power calculation

      // Apply weather effects
      if (sensor.renewable) {
        if (sensor.location.includes('Wind')) {
          power *= (1 + weatherLevel / 200);
        } else if (sensor.location.includes('Solar')) {
          power *= (1 - weatherLevel / 400);
        }
        if (!renewablesEnabled) {
          power = 0;
        }
        totalRenewablePower += power;
      } else {
        power *= (1 - weatherLevel / 200);
        totalTraditionalPower += power;
      }
      totalPower += power;
    }
  });

  // Calculate demand (increases with weather)
  const demand = BASE_DEMAND * (1 + weatherLevel / 200);
  const deficit = Math.max(0, demand - totalPower);

  let purchasedPower = 0;
  let purchasedCost = 0;

  if (purchasePowerEnabled && deficit > 0) {
    // Cover 50%-98% of deficit
    const coverageRatio = 0.5 + Math.random() * 0.48;
    purchasedPower = deficit * coverageRatio;
    purchasedCost = purchasedPower * TRADITIONAL_COST_PER_MW * 2 / 1000; // 2x cost
    totalPower += purchasedPower;
  }

  // Calculate costs
  const traditionalCost = totalTraditionalPower * TRADITIONAL_COST_PER_MW / 1000; // Convert to $/hour
  const renewableCost = totalRenewablePower * RENEWABLE_COST_PER_MW / 1000;
  const totalCost = traditionalCost + renewableCost + purchasedCost;

  // Calculate microclimate cost (cost per kWh)
  const microclimateCost = MICROCLIMATE_BASE_COST * (1 + weatherLevel / 500) * (totalTraditionalPower / (totalTraditionalPower + totalRenewablePower + 1));

  // Calculate outage probability
  outageProbability = Math.min(100, Math.max(0, (weatherLevel / 2) - (renewablesEnabled ? 15 : 0)));

  return {
    demand: Math.round(demand),
    totalTraditionalPower: Math.round(totalTraditionalPower),
    totalRenewablePower: Math.round(totalRenewablePower),
    totalPower: Math.round(totalPower),
    purchasedPower: Math.round(purchasedPower),
    traditionalCost: Math.round(traditionalCost * 100) / 100,
    renewableCost: Math.round(renewableCost * 100) / 100,
    purchasedCost: Math.round(purchasedCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    microclimateCost: Math.round(microclimateCost * 10000) / 10000,
    outageProbability: Math.round(outageProbability * 100) / 100
  };
}
function generateTelemetry(sensor) {
  const baseValue = {
    Voltage: 220, // kV
    Current: 100, // A
    Power: 5000, // MW
    Frequency: 60, // Hz
    Temperature: 75 // °C
  };

  let value = baseValue[sensor.type] + (Math.random() - 0.5) * 0.1 * baseValue[sensor.type];

  // Apply weather effects
  if (sensor.type === 'Power') {
    if (sensor.renewable) {
      // Renewables: wind increases with weather, solar decreases
      if (sensor.location.includes('Wind')) {
        value *= (1 + weatherLevel / 200); // Up to 50% increase
      } else if (sensor.location.includes('Solar')) {
        value *= (1 - weatherLevel / 400); // Up to 25% decrease
      }
      // Only active if renewables enabled
      if (!renewablesEnabled) {
        value = 0;
      }
    } else {
      // Non-renewables: decrease with extreme weather
      value *= (1 - weatherLevel / 200); // Up to 50% decrease
    }
  }

  const timestamp = new Date().toISOString();

  return {
    sensorId: sensor.id,
    location: sensor.location,
    type: sensor.type,
    value: Math.round(value * 100) / 100,
    unit: sensor.type === 'Voltage' ? 'kV' : sensor.type === 'Current' ? 'A' : sensor.type === 'Power' ? 'MW' : sensor.type === 'Frequency' ? 'Hz' : '°C',
    timestamp: timestamp,
    status: Math.random() > 0.95 ? 'Warning' : 'Normal', // Occasional warnings
    renewable: sensor.renewable
  };
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected');

  // Send initial data
  sensors.forEach(sensor => {
    socket.emit('telemetry', generateTelemetry(sensor));
  });

  // Send initial system status and metrics
  const metrics = calculateSystemMetrics();
  socket.emit('systemStatus', { weatherLevel, renewablesEnabled, purchasePowerEnabled, ...metrics });

  // Listen for weather updates
  socket.on('updateWeather', (level) => {
    weatherLevel = Math.max(0, Math.min(100, level));
    const metrics = calculateSystemMetrics();
    io.emit('systemStatus', { weatherLevel, renewablesEnabled, purchasePowerEnabled, ...metrics });
  });

  // Listen for renewables toggle
  socket.on('toggleRenewables', (enabled) => {
    renewablesEnabled = enabled;
    const metrics = calculateSystemMetrics();
    io.emit('systemStatus', { weatherLevel, renewablesEnabled, purchasePowerEnabled, ...metrics });
  });

  // Listen for purchase power toggle
  socket.on('togglePurchasePower', (enabled) => {
    purchasePowerEnabled = enabled;
    const metrics = calculateSystemMetrics();
    io.emit('systemStatus', { weatherLevel, renewablesEnabled, purchasePowerEnabled, ...metrics });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Emit telemetry data and metrics every 2 seconds
setInterval(() => {
  sensors.forEach(sensor => {
    io.emit('telemetry', generateTelemetry(sensor));
  });
  
  const metrics = calculateSystemMetrics();
  io.emit('systemMetrics', metrics);
}, 2000);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});