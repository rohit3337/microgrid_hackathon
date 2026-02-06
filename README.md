# ⚡ MicroGrid Simulator v6.0 | Physics-Based Smart Energy Scheduler

> **International Hackathon 2026 Submission**: Research-Grade Solar Microgrid Digital Twin with Real Dataset Integration, Physics-Based Battery Model & Deterministic Baseline vs Smart Comparison.

---

## 📖 Overview

**MicroGrid Simulator** is a research-grade energy management system that creates a **digital twin** of a residential microgrid. Unlike toy simulations, this system uses **authentic renewable energy datasets** and **physics-compliant models** to demonstrate how intelligent scheduling can reduce energy costs.

### What Makes This Different?
- 📊 **Real Dataset**: Uses actual renewable energy measurements (3548 hourly records)
- ⚗️ **Physics-Based**: No fake savings - costs emerge from actual energy flow calculations
- 🔬 **Deterministic**: Baseline & Smart run under **identical conditions** for fair comparison
- 📐 **Research-Grade**: Proper min-max normalization, battery constraints, strict cost formulas

---

## 🧮 Mathematical Model

### 1. Data Normalization (Min-Max Scaling)

All dataset values are normalized to user-configured capacities:

$$Solar_{output}(t) = \frac{Solar_{raw}(t)}{Solar_{max}^{dataset}} \times Capacity_{solar}^{user}$$

$$Load_{demand}(t) = \frac{Load_{raw}(t)}{Load_{max}^{dataset}} \times Load_{peak}^{typical}$$

Where:
- $Solar_{max}^{dataset}$ = Maximum solar output in dataset
- $Load_{peak}^{typical}$ = 7 kW (typical Indian household with AC)

### 2. Battery State Model

The battery state-of-charge (SOC) evolves according to:

$$SOC(t+1) = SOC(t) + \eta_c \cdot P_{charge}(t) \cdot \Delta t - \frac{P_{discharge}(t) \cdot \Delta t}{\eta_d}$$

Where:
- $\eta_c = \sqrt{\eta_{roundtrip}}$ = Charging efficiency (~94%)
- $\eta_d = \sqrt{\eta_{roundtrip}}$ = Discharging efficiency (~94%)
- $\eta_{roundtrip}$ = 88% (realistic Li-ion efficiency)

**Battery Constraints:**
$$SOC_{min} \leq SOC(t) \leq SOC_{max}$$
$$0 \leq P_{charge}(t) \leq P_{max}^{charge}$$
$$0 \leq P_{discharge}(t) \leq P_{max}^{discharge}$$

With:
- $SOC_{min}$ = 20% (protects battery longevity)
- $SOC_{max}$ = 100%
- $P_{max}^{charge} = P_{max}^{discharge} = \frac{Capacity}{4}$ (C/4 rate)

### 3. Energy Flow Priority

Each hour, power is dispatched in strict priority order:

```
1. Solar → Load       (direct consumption, free)
2. Excess Solar → Battery  (store for later)
3. Battery → Load     (policy-controlled discharge)
4. Grid → Load        (up to 5kW limit)
5. Diesel → Load      (expensive backup, last resort)
```

### 4. Cost Calculation (Strict Physics)

**No artificial multipliers or forced savings!**

$$Cost_{hour}(t) = P_{grid}(t) \times Tariff(t) + P_{diesel}(t) \times Price_{diesel}$$

**Time-of-Use Tariff:**
$$Tariff(t) = \begin{cases} Base_{price} \times 1.5 & \text{if } t \in [17:00, 22:00] \text{ (Peak)} \\ Base_{price} & \text{otherwise (Off-Peak)} \end{cases}$$

**Total Daily Cost:**
$$Cost_{total} = \sum_{t=0}^{23} Cost_{hour}(t)$$

### 5. Baseline vs Smart Strategy

Both strategies are simulated under **identical inputs** (same solar, load, tariffs, initial SOC):

| Aspect | Baseline Policy | Smart Policy |
|--------|----------------|--------------|
| Battery Discharge | Always allowed | Only when solar insufficient OR during peak |
| Grid Charging | Never | Off-peak if deficit predicted |
| Optimization | None | Time-of-use arbitrage |

**Savings emerge from algorithm behavior, NOT injected!**

$$\Delta Cost = Cost_{baseline} - Cost_{smart}$$

Smart can be better, similar, or slightly worse depending on conditions.

### 6. CO₂ Emissions Model

$$CO_2(t) = P_{grid}(t) \times EF_{grid} + P_{diesel}(t) \times EF_{diesel}$$

Where:
- $EF_{grid}$ = 0.5 kg CO₂/kWh (Indian grid average)
- $EF_{diesel}$ = 0.8 kg CO₂/kWh (diesel generator)

---

## 🚀 Key Features

### 📊 Real Dataset Integration
- **3548 hourly records** from authentic renewable energy measurements
- Fields: Solar PV output, wind power, grid load demand, battery SOC, temperature, humidity, irradiance
- Proper min-max normalization for scaling to user configuration

### 🔋 Advanced Battery Physics
- Realistic 88% round-trip efficiency (split into charge/discharge)
- C/4 rate limiting (max 25% of capacity per hour)
- 20% minimum SOC protection
- Energy throughput tracking

### ⚖️ Fair Comparison System
- Baseline and Smart run on **identical inputs**
- Deterministic simulation (no random noise)
- Precomputed 24-hour results for both strategies
- Real savings calculation (can be positive, zero, or negative)

### 📈 Real-Time Visualization
- 5-dataset power chart (Solar, Load, Grid, Battery, SOC)
- 3D interactive chart mode
- Animated energy flow particles
- Day/night cycle with weather effects

### 📄 Research-Grade Reports
- PDF export with hourly baseline vs smart costs
- CSV auto-download with per-hour metrics
- Multi-day comparison tables

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Vanilla JavaScript (ES6+)** | Physics simulation engine |
| **HTML5 Canvas** | Energy flow animations |
| **CSS3** | Glassmorphism UI, 3D transforms |
| **Chart.js** | Real-time power analytics |
| **jsPDF + AutoTable** | PDF report generation |

---

## ⚙️ Installation & Setup

### 1. Clone Repository
```bash
git clone https://github.com/rohit3337/microgrid_hackathon
cd microgrid_hackathon
```

### 2. Run Locally
```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx live-server

# Using VS Code Live Server extension
# Click "Go Live"
```

### 3. Open Browser
Navigate to `http://localhost:8080`

---

## 💡 How to Demo

### Basic Comparison
1. **Set Configuration**: Solar = 5kW, Battery = 10kWh, Grid Cost = ₹10
2. **Baseline Run**: Smart Scheduler **OFF** → Run Simulation
3. **Smart Run**: Smart Scheduler **ON** → Reset → Run Simulation
4. **Compare**: Click "Compare" button to see side-by-side costs

### Stress Test
- **High Solar (15kW)**: Watch baseline approach ₹0 (solar covers everything)
- **Low Battery (5kWh)**: See grid dependency increase
- **Rainy Weather**: Solar drops to 15%, grid usage spikes

---

## 📐 Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `BASE_GRID_PRICE` | ₹10/kWh | Off-peak electricity rate |
| `PEAK_FACTOR` | 1.5× | Peak hour multiplier |
| `DIESEL_PRICE` | ₹25/kWh | Backup generator cost |
| `PEAK_HOURS` | 17-22 | Evening peak (5-10 PM) |
| `GRID_LIMIT` | 5 kW | Max grid import |
| `MIN_SOC` | 20% | Battery floor |
| `EFFICIENCY` | 88% | Round-trip efficiency |

---

## 📊 Dataset Fields

The `Renewable_energy_dataset.csv` contains:

| Field | Unit | Description |
|-------|------|-------------|
| `solar_pv_output` | kW | Solar panel generation |
| `wind_power_output` | kW | Wind turbine generation |
| `grid_load_demand` | kW | Household consumption |
| `battery_state_of_charge` | % | Battery SOC |
| `temperature` | °C | Ambient temperature |
| `humidity` | % | Relative humidity |
| `solar_irradiance` | W/m² | Solar radiation |
| `frequency` | Hz | Grid frequency |
| `voltage` | V | Grid voltage |

---

## 🏆 Hackathon Highlights

- ✅ **Research-Grade**: No fake savings, physics-based calculations
- ✅ **Real Data**: Authentic renewable energy dataset
- ✅ **Fair Comparison**: Identical conditions for baseline vs smart
- ✅ **Complete Math**: All formulas documented and implemented
- ✅ **Production UI**: Glassmorphism design, smooth animations
- ✅ **Zero Dependencies**: Pure vanilla JS, instant load

---

## 👥 Team

**Built for International Hackathon 2026**

---

## 📄 License

MIT License - Free to use, modify, and distribute.

---

<p align="center">
  <b>⚡ Physics-Based Smart Energy Simulation ⚡</b>
</p>
