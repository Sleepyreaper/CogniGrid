const socket = io();

// Store data for charts
let voltageData = [];
let powerData = [];
const maxDataPoints = 20;

// System variables
let weatherLevel = 0;
let renewablesEnabled = false;
let purchasePowerEnabled = false;
const baseDemand = 4500; // MW - Updated to match server
let currentSupply = 0;

// AI automation variables
let aiEnabled = false;
let aiInterval = null;
const AI_DURATION = 30000; // 30 seconds
const AI_TARGET_WEATHER = 47; // Target weather level
const AI_PRICE_THRESHOLD = 15.0; // Try to keep price below this (¢/kWh)
let aiStartTime = null;
let aiStartWeather = 0;

// Initialize charts
const voltageChart = new Chart(document.getElementById('voltageChart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Voltage (kV)',
      data: [],
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Voltage Trend'
      }
    },
    scales: {
      y: {
        beginAtZero: false
      }
    }
  }
});

const powerChart = new Chart(document.getElementById('powerChart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Power (MW)',
      data: [],
      borderColor: 'rgb(255, 99, 132)',
      tension: 0.1
    }]
  },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Power Output Trend'
      }
    },
    scales: {
      y: {
        beginAtZero: false
      }
    }
  }
});

// Initialize map
const map = L.map('map').setView([39.8283, -98.5795], 4); // Center of US

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Storm locations in southern US
const stormLocations = [
  { lat: 29.7604, lng: -95.3698, name: 'Houston, TX' },
  { lat: 25.7617, lng: -80.1918, name: 'Miami, FL' },
  { lat: 29.9511, lng: -90.0715, name: 'New Orleans, LA' },
  { lat: 32.7767, lng: -96.7970, name: 'Dallas, TX' },
  { lat: 30.4518, lng: -91.1871, name: 'Baton Rouge, LA' },
  { lat: 33.7490, lng: -84.3880, name: 'Atlanta, GA' },
  { lat: 32.3182, lng: -86.9023, name: 'Montgomery, AL' }
];

let stormMarkers = [];

// Function to update storm visibility based on weather
function updateStorms() {
  // Clear existing markers
  stormMarkers.forEach(marker => map.removeLayer(marker));
  stormMarkers = [];

  if (weatherLevel > 20) { // Show storms when weather severity > 20%
    stormLocations.forEach(location => {
      const marker = L.marker([location.lat, location.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map).bindPopup(`<b>Storm Active</b><br>${location.name}`);
      stormMarkers.push(marker);
    });
  }
}

// EIA Data Update for Southern States - Using Fake Data
const southernStates = [
  'AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'
];

function updateEIAData(weatherLevel, renewablesEnabled, purchasePowerEnabled) {
  // Base fake data
  const basePrice = 12.5; // ¢/kWh
  const totalRevenue = 25300; // $M
  const totalSales = 180500; // MWh
  const totalCustomers = 45200; // Thousands
  
  // Adjust price based on weather, renewables, and purchased power
  const weatherIncrease = (weatherLevel / 100) * 5; // Increase by up to 5¢ with max weather
  const renewableDecrease = renewablesEnabled ? 2.0 : 0; // Decrease by 2¢ with renewables
  const purchasePowerIncrease = purchasePowerEnabled ? 3.5 : 0; // Increase by 3.5¢ with purchased power (2x cost)
  const adjustedPrice = Math.max(5, basePrice + weatherIncrease - renewableDecrease + purchasePowerIncrease); // Min 5¢
  
  // Calculate outage risk for EIA data
  const baseOutageRisk = (weatherLevel / 2) - (renewablesEnabled ? 10 : 0);
  const eiaOutageRisk = Math.min(100, Math.max(0, baseOutageRisk));
  
  // Update UI
  document.getElementById('avg-price').textContent = adjustedPrice.toFixed(2) + ' ¢/kWh';
  document.getElementById('total-revenue').textContent = (totalRevenue / 1000).toFixed(1) + ' $B';
  document.getElementById('total-sales').textContent = (totalSales / 1000000).toFixed(1) + ' TWh';
  document.getElementById('total-customers').textContent = (totalCustomers / 1000).toFixed(1) + ' M';
  document.getElementById('eia-outage-risk').textContent = eiaOutageRisk.toFixed(1) + ' %';
}

// Load initial EIA data on page load
updateEIAData(0, false, false);

// Listen for telemetry data
socket.on('telemetry', (data) => {
  updateSensorCard(data);
  updateCharts(data);
});

// Listen for system status updates
socket.on('systemStatus', (status) => {
  weatherLevel = status.weatherLevel;
  renewablesEnabled = status.renewablesEnabled;
  purchasePowerEnabled = status.purchasePowerEnabled || false;
  document.getElementById('weather-slider').value = weatherLevel;
  document.getElementById('weather-value').textContent = weatherLevel;
  document.getElementById('renewables-toggle').checked = renewablesEnabled;
  document.getElementById('purchase-power-toggle').checked = purchasePowerEnabled;
  updateStorms(); // Update storm markers
  updateEIAData(weatherLevel, renewablesEnabled, purchasePowerEnabled); // Update EIA data based on all controls
  
  // Update cost and outage info
  if (status.totalCost !== undefined) {
    document.getElementById('total-supply').textContent = status.totalPower;
    document.getElementById('demand').textContent = status.demand;
    document.getElementById('purchased-power').textContent = status.purchasedPower || 0;
    document.getElementById('balance').textContent = status.totalPower - status.demand;
    document.getElementById('total-cost').textContent = status.totalCost;
    document.getElementById('microclimate-cost').textContent = status.microclimateCost;
    document.getElementById('outage-probability').textContent = status.outageProbability;
    
    // Update balance status
    const balance = status.totalPower - status.demand;
    const balanceStatus = document.getElementById('balance-status');
    if (balance >= 0) {
      balanceStatus.textContent = '(Surplus)';
      balanceStatus.style.color = '#28a745';
    } else {
      balanceStatus.textContent = '(Deficit)';
      balanceStatus.style.color = '#dc3545';
    }
  }
});

// Listen for periodic system metrics updates
socket.on('systemMetrics', (metrics) => {
  document.getElementById('total-supply').textContent = metrics.totalPower;
  document.getElementById('demand').textContent = metrics.demand;
  document.getElementById('purchased-power').textContent = metrics.purchasedPower || 0;
  document.getElementById('balance').textContent = metrics.totalPower - metrics.demand;
  document.getElementById('total-cost').textContent = metrics.totalCost;
  document.getElementById('microclimate-cost').textContent = metrics.microclimateCost;
  document.getElementById('outage-probability').textContent = metrics.outageProbability;
  
  // Update balance status
  const balance = metrics.totalPower - metrics.demand;
  const balanceStatus = document.getElementById('balance-status');
  if (balance >= 0) {
    balanceStatus.textContent = '(Surplus)';
    balanceStatus.style.color = '#28a745';
  } else {
    balanceStatus.textContent = '(Deficit)';
    balanceStatus.style.color = '#dc3545';
  }
  
  // Update EIA data dynamically
  updateEIAData(weatherLevel, renewablesEnabled, purchasePowerEnabled);
});

// Initialize controls
document.getElementById('weather-slider').addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  document.getElementById('weather-value').textContent = value;
  socket.emit('updateWeather', value);
});

document.getElementById('renewables-toggle').addEventListener('change', (e) => {
  socket.emit('toggleRenewables', e.target.checked);
});

document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
  document.body.classList.toggle('dark', e.target.checked);
});

document.getElementById('purchase-power-toggle').addEventListener('change', (e) => {
  socket.emit('togglePurchasePower', e.target.checked);
});

document.getElementById('ai-toggle').addEventListener('change', (e) => {
  aiEnabled = e.target.checked;
  if (aiEnabled) {
    startAIAutomation();
  } else {
    stopAIAutomation();
  }
});

function startAIAutomation() {
  aiStartTime = Date.now();
  aiStartWeather = weatherLevel;
  
  // Clear any existing interval
  if (aiInterval) {
    clearInterval(aiInterval);
  }
  
  // Update every 100ms for smooth progression
  aiInterval = setInterval(() => {
    const elapsed = Date.now() - aiStartTime;
    const progress = Math.min(1, elapsed / AI_DURATION);
    
    // Calculate target weather based on progress
    const targetWeather = Math.round(aiStartWeather + (AI_TARGET_WEATHER - aiStartWeather) * progress);
    
    // Update weather if different from current
    if (targetWeather !== weatherLevel) {
      document.getElementById('weather-slider').value = targetWeather;
      document.getElementById('weather-value').textContent = targetWeather;
      socket.emit('updateWeather', targetWeather);
    }
    
    // AI decision making for cost optimization
    makeAIDecisions();
    
    // Stop when target reached
    if (progress >= 1) {
      clearInterval(aiInterval);
      aiInterval = null;
    }
  }, 100);
}

function stopAIAutomation() {
  if (aiInterval) {
    clearInterval(aiInterval);
    aiInterval = null;
  }
}

function makeAIDecisions() {
  // Calculate current estimated price
  const basePrice = 12.5;
  const weatherIncrease = (weatherLevel / 100) * 5;
  const renewableDecrease = renewablesEnabled ? 2.0 : 0;
  const purchasePowerIncrease = purchasePowerEnabled ? 3.5 : 0;
  const estimatedPrice = basePrice + weatherIncrease - renewableDecrease + purchasePowerIncrease;
  
  // AI Strategy: Enable renewables first (cheaper), then purchase power if needed
  
  // Enable renewables if weather > 15% and not already enabled
  if (weatherLevel > 15 && !renewablesEnabled) {
    document.getElementById('renewables-toggle').checked = true;
    socket.emit('toggleRenewables', true);
  }
  
  // Enable purchase power if price is high and deficit exists
  if (estimatedPrice > AI_PRICE_THRESHOLD && weatherLevel > 30 && !purchasePowerEnabled) {
    document.getElementById('purchase-power-toggle').checked = true;
    socket.emit('togglePurchasePower', true);
  }
  
  // Disable purchase power if price is low and renewables are sufficient
  if (estimatedPrice < (AI_PRICE_THRESHOLD - 2) && purchasePowerEnabled && renewablesEnabled) {
    document.getElementById('purchase-power-toggle').checked = false;
    socket.emit('togglePurchasePower', false);
  }
}

function updateSensorCard(data) {
  const card = document.getElementById(data.sensorId);
  if (card) {
    const valueElement = card.querySelector('.sensor-value');
    const statusElement = card.querySelector('.sensor-status');
    const timeElement = card.querySelector('.sensor-time');

    valueElement.textContent = `${data.value} ${data.unit}`;
    statusElement.textContent = `Status: ${data.status}`;
    statusElement.className = `sensor-status ${data.status.toLowerCase()}`;
    timeElement.textContent = new Date(data.timestamp).toLocaleTimeString();

    // Update renewable indicator
    if (data.renewable) {
      card.classList.add('renewable');
    }
  }
}

function updateCharts(data) {
  const time = new Date(data.timestamp).toLocaleTimeString();

  if (data.type === 'Voltage') {
    voltageData.push({ time, value: data.value });
    if (voltageData.length > maxDataPoints) {
      voltageData.shift();
    }
    voltageChart.data.labels = voltageData.map(d => d.time);
    voltageChart.data.datasets[0].data = voltageData.map(d => d.value);
    voltageChart.update();
  } else if (data.type === 'Power') {
    powerData.push({ time, value: data.value });
    if (powerData.length > maxDataPoints) {
      powerData.shift();
    }
    powerChart.data.labels = powerData.map(d => d.time);
    powerChart.data.datasets[0].data = powerData.map(d => d.value);
    powerChart.update();
  }
}

function updateSystemInfo() {
  // This function is no longer used - metrics come from server
}