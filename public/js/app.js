const socket = io();

// Store data for charts
let voltageData = [];
let powerData = [];
const maxDataPoints = 20;

// System variables
let weatherLevel = 0;
let renewablesEnabled = false;
const baseDemand = 12000; // MW
let currentSupply = 0;

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

function updateEIAData(weatherLevel, renewablesEnabled) {
  // Base fake data
  const basePrice = 12.5; // ¢/kWh
  const totalRevenue = 25300; // $M
  const totalSales = 180500; // MWh
  const totalCustomers = 45200; // Thousands
  
  // Adjust price based on weather and renewables
  const weatherIncrease = (weatherLevel / 100) * 5; // Increase by up to 5¢ with max weather
  const renewableDecrease = renewablesEnabled ? 2.0 : 0; // Decrease by 2¢ with renewables
  const adjustedPrice = Math.max(5, basePrice + weatherIncrease - renewableDecrease); // Min 5¢
  
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
updateEIAData(0, false);

// Listen for telemetry data
socket.on('telemetry', (data) => {
  updateSensorCard(data);
  updateCharts(data);
});

// Listen for system status updates
socket.on('systemStatus', (status) => {
  weatherLevel = status.weatherLevel;
  renewablesEnabled = status.renewablesEnabled;
  document.getElementById('weather-slider').value = weatherLevel;
  document.getElementById('weather-value').textContent = weatherLevel;
  document.getElementById('renewables-toggle').checked = renewablesEnabled;
  updateStorms(); // Update storm markers
  updateEIAData(weatherLevel, renewablesEnabled); // Update EIA data based on weather and renewables
  
  // Update cost and outage info
  if (status.totalCost !== undefined) {
    document.getElementById('total-cost').textContent = status.totalCost;
    document.getElementById('microclimate-cost').textContent = status.microclimateCost;
    document.getElementById('outage-probability').textContent = status.outageProbability;
  }
});

// Listen for periodic system metrics updates
socket.on('systemMetrics', (metrics) => {
  document.getElementById('total-supply').textContent = metrics.totalPower;
  document.getElementById('total-cost').textContent = metrics.totalCost;
  document.getElementById('microclimate-cost').textContent = metrics.microclimateCost;
  document.getElementById('outage-probability').textContent = metrics.outageProbability;
  
  // Calculate demand and balance
  const demand = baseDemand * (1 + weatherLevel / 200);
  const balance = metrics.totalPower - demand;
  
  document.getElementById('demand').textContent = demand.toFixed(2);
  document.getElementById('balance').textContent = Math.abs(balance).toFixed(2);

  const balanceStatus = document.getElementById('balance-status');
  if (balance >= 0) {
    balanceStatus.textContent = '(Surplus)';
    balanceStatus.style.color = '#27ae60';
  } else {
    balanceStatus.textContent = '(Deficit)';
    balanceStatus.style.color = '#e74c3c';
  }
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