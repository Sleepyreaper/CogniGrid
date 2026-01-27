# Copilot instructions for this repository

A real-time electrical grid operations dashboard simulating IoT telemetry with interactive weather/renewable controls.

## Architecture

**Data Flow**: Client connects → Server emits initial telemetry & metrics → Client updates UI → User adjusts controls → Socket.io events trigger recalculation → Server broadcasts updated metrics to all clients → Cycle repeats every 2s

**Key Components**:
- `server.js`: Express + Socket.io server; manages global simulation state (weatherLevel, renewablesEnabled, purchasePowerEnabled); calculates system metrics (demand, power, costs, outage risk)
- `public/js/app.js`: Client-side logic; maintains Chart.js instances; listens for telemetry/systemStatus/systemMetrics events; emits control changes
- `public/index.html`: Static dashboard with sensor cards, charts, US map, EIA data panel
- `public/css/style.css`: Responsive grid layout with dark mode support (.dark class)

**Simulation Logic** (in `server.js`):
- 7 sensors: 5 traditional (voltage, current, power, frequency, temp), 2 renewable (wind, solar)
- Weather effects: Traditional power decreases (`1 - weatherLevel/200`), wind increases (`1 + weatherLevel/200`), solar decreases (`1 - weatherLevel/400`)
- Demand calculation: `BASE_DEMAND * (1 + weatherLevel/200)` (increases with weather)
- Cost: Traditional $45/MW, Renewable $15/MW, Purchased Power $90/MW (2x)
- Outage risk: `(weatherLevel/2) - (renewables ? 15 : 0)`, capped 0-100%

## Workflows

**Development**:
```bash
npm install          # Install dependencies
npm run dev          # Start with nodemon (auto-restart on changes)
npm start            # Production mode
```

**Testing**: No automated tests configured. Manual testing: adjust weather slider (0-100%), toggle renewables, verify storms appear on map when weather >20%

**Debugging**: Server logs to console on client connect/disconnect. Use browser DevTools for Socket.io messages (`socket.on`/`socket.emit` events)

## Conventions

**Socket.io Event Patterns**:
- Server → Client: `telemetry` (individual sensor data), `systemStatus` (initial state), `systemMetrics` (periodic updates)
- Client → Server: `updateWeather`, `toggleRenewables`, `togglePurchasePower`

**State Management**:
- Server holds single source of truth (global variables at top of server.js)
- Client mirrors subset of state (weatherLevel, renewablesEnabled) for UI controls
- All calculations (metrics) happen server-side in `calculateSystemMetrics()`

**Frontend Patterns**:
- Direct DOM manipulation via `getElementById` (no framework)
- Chart updates: push to array, shift if >20 points, update chart.data, call chart.update()
- Map markers: clear `stormMarkers` array, remove from map, recreate based on weatherLevel

**CSS Patterns**:
- `.renewable` class for Wind/Solar sensor cards (green border/gradient)
- Dark mode via `body.dark` class toggle (applies to all components)
- Responsive grid: `.sensor-grid` uses CSS Grid with auto-fit columns

## Integration Points

**External Services**:
- Chart.js 4.x CDN: line charts for voltage/power trends
- Leaflet 1.9.4 CDN: US map centered at [39.8283, -98.5795] zoom 4
- Socket.io 4.7.4 CDN: real-time bidirectional communication

**Data Sources**:
- EIA data: Currently fake/simulated in `updateEIAData()` function (no real API calls)
- Storm locations: Hardcoded array of 7 southern US cities in `stormLocations`

**Cross-Component Communication**:
- All control changes (weather, renewables, purchase power) emit Socket.io events
- Server broadcasts metrics to all connected clients (multi-user aware)
- Charts update on `telemetry` events filtered by sensor type (Voltage/Power)

## File-Specific Notes

**server.js**:
- Telemetry interval: 2000ms (line ~204)
- Base constants: TRADITIONAL_COST_PER_MW=45, RENEWABLE_COST_PER_MW=15, BASE_DEMAND=12000

**app.js**:
- maxDataPoints=20 for chart history
- Storm threshold: weatherLevel >20% to show markers
- EIA data: Base values (basePrice=12.5, totalRevenue=25300) adjusted by weather/renewables

**index.html**:
- CDN scripts loaded in <head> (Socket.io, Chart.js, Leaflet CSS/JS)
- Purchase power toggle added to controls (new feature)

**BicepScript/backendazure.bicep**: Empty file (placeholder for Azure deployment)

## Common Tasks

**Add new sensor**: Edit sensors array in server.js, add corresponding card in index.html with matching id="sensor-X", update generateTelemetry() if needed

**Modify cost calculation**: Update TRADITIONAL_COST_PER_MW/RENEWABLE_COST_PER_MW constants or adjust formula in calculateSystemMetrics()

**Add new Socket.io event**: Emit from client with socket.emit('eventName', data), listen on server with socket.on('eventName', callback), broadcast with io.emit() if needed by all clients
