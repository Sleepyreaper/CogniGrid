# Copilot instructions for this repository

Purpose: give AI coding agents the essential, repository-specific knowledge
they need to be immediately productive. This file is intentionally concise —
keep edits small and factual.

Repository status: Contains a Node.js web application for an electrical grid dashboard with simulated IoT telemetry, interactive weather simulation, renewable energy controls, US weather map, economic cost analysis, and EIA data integration.

What an agent should know
- Primary language: JavaScript (Node.js backend, vanilla JS frontend)
- Framework: Express.js for server, Socket.io for real-time communication
- Entry points: server.js (main server), public/index.html (dashboard)
- Key directories: public/ for static assets, .github/ for instructions
- Interactive features: Weather slider affects power distribution and shows storms on map, renewables toggle adjusts consumption and costs, cost analysis shows economic benefits, EIA data shows real southern states statistics

Project-specific workflows
- Install: npm install
- Run: npm start (production), npm run dev (development with nodemon)
- Build: No build step required, served directly
- Test: No tests configured yet

Conventions and patterns
- Real-time updates: Use Socket.io for telemetry data and system status
- Frontend: Vanilla JS with Chart.js for visualizations, Leaflet for map, event listeners for controls
- Styling: CSS with responsive grid layout, special styling for renewable sensors
- Simulation: Weather affects power output (traditional decrease, renewables vary), storms appear on map in south when weather >20%, costs calculated per MW with renewables being cheaper
- System info: Calculate total supply/demand balance, generation costs, outage risk, and microclimate pricing
- External data: EIA API integration for real electricity retail sales data

Integration points and external services
- Socket.io for real-time communication between server and client
- Chart.js CDN for charts
- Leaflet CDN for map
- EIA.gov API for electricity retail sales data

How to propose changes
- When making changes, include a single short summary comment in the PR description explaining intent and risk.
- Prefer incremental edits: change one file and run unit tests before expanding scope.

When this file is stale
- Update this file when adding new features, dependencies, or changing architecture.

Questions for the repo owner
- What is the primary language/runtime for this repo?
- Where are the main app entrypoints and tests located?
- Are there any non-obvious build/test commands or CI expectations?

If you want, I can re-scan after you add files and produce a repo-specific version of this document.
