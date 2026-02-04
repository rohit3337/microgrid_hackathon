# ⚡ MicroGrid Simulator | Smart Energy Scheduler v4.0

> **International Hackathon 2026 Submission**: Advanced Physics-Based Solar Microgrid Digital Twin with Real-Time 3D Visualization, AI-Powered Scheduling & Comprehensive Analytics.

[🔗 Live Demo](https://microgrid-vlab-hackathon.vercel.app/)

---

## 📖 Overview

**MicroGrid Simulator** is a next-generation energy management system that solves the "Dumb Grid" problem through intelligent automation. It creates a **digital twin** of a smart home microgrid, demonstrating how AI-driven decision-making can dramatically reduce energy costs, minimize carbon footprint, and extend battery lifespan.

This isn't just a visualization—it's a **fully physics-compliant simulation engine** featuring:
- ⚡ Real-time Power Flow (Solar → Battery → Load → Grid)
- 💰 Dynamic Grid Pricing (Peak/Off-Peak billing with time-of-use rates)
- 🔋 Realistic Battery Physics (92% efficiency, C/2 charge rate, 10% min SOC)
- 🌤️ Weather Impact Simulation (Sunny/Cloudy/Rainy irradiance modeling)
- 🌱 Environmental Impact Tracking (CO₂ savings, tree equivalents)

---

## 🚀 Key Features

### 🧠 Smart Scheduler AI
The intelligent optimization algorithm that:
- **Peak Hour Detection**: Automatically reserves battery charge for expensive evening spikes (5 PM - 10 PM)
- **Smart Charging**: Charges battery during solar abundance with 92% round-trip efficiency
- **Cost Arbitrage**: Exploits off-peak rates to minimize grid dependency during peak hours
- **Load Balancing**: Limits grid import to 5kW max, using battery to supplement high loads
- **Savings**: Achieves ~20-35% cost reduction compared to baseline operation

### 🔋 Advanced Battery Simulation
- **Realistic Physics**: C/2 charge rate limiting, 92% charge/discharge efficiency
- **SOC Management**: Maintains 10% minimum state-of-charge for battery longevity
- **Charge/Discharge Tracking**: Real-time visualization of battery power flow direction
- **Health Monitoring**: Tracks cumulative energy throughput and cycle count

### 📊 Power Analytics Dashboard
- **5-Dataset Chart**: Solar, Load, Grid, Battery Power, and SOC% on single view
- **Toggle Controls**: Show/hide individual datasets for focused analysis
- **3D Chart Mode**: Interactive 3D perspective with mouse-tracking rotation
- **Fullscreen Mode**: Expand chart to full screen with complete state restoration
- **Real-time Updates**: Live data streaming during simulation

### 📄 Comprehensive PDF Reports
One-click generation of professional audit reports including:
- **Input Configuration**: Solar capacity, battery specs, grid costs, weather conditions
- **Output Results**: Total cost, baseline comparison, savings percentage
- **Environmental Impact**: CO₂ saved, tree equivalents, car km avoided
- **Hourly Data Table**: Complete 24-hour breakdown with all metrics
- **Embedded Chart**: Visual graph snapshot in the report
- **Performance Analysis**: Peak/off-peak breakdown, efficiency metrics, recommendations
- **Multi-Day Comparison**: Historical data across simulation days

### 🎮 Interactive 3D Visualization
- **Animated Environment**: Day/night cycle with sun/moon orbit
- **Weather Effects**: Dynamic rain, clouds, and lightning animations
- **Energy Flow Particles**: Canvas-based particle system showing power flow
- **Component Cards**: Solar panel, battery, load, grid with real-time stats
- **Appliance Board**: Visual status of home appliances (AC, TV, Washer, etc.)

### 🎯 Quick Scenarios
Pre-configured simulation presets:
- **Summer**: High solar, peak AC usage
- **Monsoon**: Reduced solar, moderate load
- **Winter**: Low solar, heating loads
- **Peak Demand**: Stress-test with maximum load

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Vanilla JavaScript (ES6+)** | Core simulation engine, maximum performance |
| **HTML5 Canvas** | Energy particle animations |
| **CSS3** | Glassmorphism, 3D transforms, animations |
| **Chart.js** | Real-time power analytics visualization |
| **jsPDF + AutoTable** | Professional PDF report generation |
| **GSAP** | Smooth UI animations |
| **Font Awesome** | Icon library |

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/rohit3337/microgrid_hackathon
cd microgrid_hackathon
```

### 2. Run Locally
Since this is a client-side application, serve it with any static server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (Live Server)
npx live-server

# Using VS Code
# Install "Live Server" extension and click "Go Live"
```

### 3. Open in Browser
Navigate to `http://localhost:8080` to access the simulator.

---

## 💡 How to Demo

### Basic Demonstration
1. **Baseline Run**: Click "RUN SIMULATION" with Smart Scheduler **OFF**
   - Observe high cost (~₹1400-1600)
   - Notice grid usage during peak hours

2. **Smart Run**: Toggle Smart Scheduler **ON**, run again
   - Observe cost reduction (~₹1000-1200)
   - Battery discharges during peak, charges during solar hours

3. **Compare**: Check the Baseline vs Smart comparison bar
   - Green bar shows savings achieved

### Advanced Features
4. **3D Chart**: Click the cube icon (🎲) to enable 3D perspective
   - Move mouse to rotate the chart view

5. **Fullscreen**: Click expand icon to view chart in fullscreen
   - Press Escape or minimize button to restore original layout

6. **Download Report**: Click download icon for comprehensive PDF
   - Includes all inputs, outputs, hourly data, and chart

7. **Weather Test**: Change weather to "Rainy" and observe solar reduction

8. **Multi-Day**: Use Day navigation to simulate multiple days and compare

---

## 📸 Screenshots

| Dashboard View | 3D Visualization |
|:---:|:---:|
| ![Dashboard](![alt text](image.png)) | ![3D View](![alt text](image-1.png)) |

| PDF Report Page 1 | PDF Report Page 2 |
|:---:|:---:|
| Configuration & Data | Chart & Analysis |

---

## 🏆 Hackathon Highlights

- ✅ **Physics-Accurate**: Real battery efficiency curves, not simplified models
- ✅ **Production-Ready UI**: Glassmorphism design, smooth animations
- ✅ **Complete Documentation**: PDF reports with all technical details
- ✅ **Responsive**: Works on desktop and tablet screens
- ✅ **No Dependencies Hell**: Pure vanilla JS, instant load times
- ✅ **Educational**: Clear visualization of smart grid concepts

---

## 👥 Team

**Built for International Hackathon 2026**

---

## 📄 License

MIT License - Free to use, modify, and distribute!

---

<p align="center">
  <b>⚡ Powering the Future of Smart Energy ⚡</b>
</p>
