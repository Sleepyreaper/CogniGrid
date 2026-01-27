# Electrical Grid Operations Dashboard

A fake web application that simulates an electrical grid operations dashboard with real-time IoT sensor telemetry data.

## Features

- Real-time display of simulated IoT sensor data from various grid components
- Interactive weather simulation slider affecting power distribution
- Renewable energy toggle demonstrating grid stabilization
- Live weather map of the United States with storm indicators in southern regions
- Cost analysis showing traditional vs renewable generation costs
- Outage risk indicator that increases with weather severity
- Dynamic microclimate cost per kWh that lowers with renewable adoption
- EIA data integration showing real southern states power statistics
- Clean, professional dashboard interface
- Live charts showing voltage and power trends
- System-wide power supply/demand balance monitoring
- Simulated telemetry updates every 2 seconds
- Responsive design for different screen sizes

## Simulated Sensors

- **Substation A**: Voltage monitoring (kV)
- **Substation B**: Current monitoring (A)
- **Transformer C**: Power output (MW) - Traditional
- **Line D**: Frequency monitoring (Hz)
- **Generator E**: Temperature monitoring (°C)
- **Wind Farm F**: Power output (MW) - Renewable
- **Solar Panel G**: Power output (MW) - Renewable

## Interactive Controls

- **Weather Slider**: Adjusts extreme weather severity (0-100%), affecting power output and demand
- **Renewables Toggle**: Enables/disables renewable energy sources, demonstrating their role in grid stability

## Installation

1. Make sure you have Node.js installed (version 14 or higher)
2. Clone or download this repository
3. Navigate to the project directory
4. Install dependencies:

```bash
npm install
```

## Running the Application

Start the server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

Open your browser and go to `http://localhost:3000`

## Technologies Used

- **Backend**: Node.js with Express.js
- **Real-time Communication**: Socket.io
- **Frontend**: HTML5, CSS3, JavaScript
- **Charts**: Chart.js

## Project Structure

```
/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── public/            # Static files
│   ├── index.html     # Main dashboard page
│   ├── css/
│   │   └── style.css  # Stylesheet
│   └── js/
│       └── app.js     # Client-side JavaScript
└── README.md          # This file
```

## Simulation Details

The application simulates IoT sensors sending telemetry data. Each sensor reports data with slight random variations to mimic real-world fluctuations. Extreme weather reduces traditional power output while potentially boosting wind power and reducing solar power. Enabling renewables provides additional power capacity to help meet increasing demand during adverse conditions.

Data updates every 2 seconds, and charts display the last 20 data points for trending analysis.