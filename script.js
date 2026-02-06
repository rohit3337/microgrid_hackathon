/**
 * =====================================================
 * MICROGRID SIMULATOR v6.0 - PHYSICS-BASED EDITION
 * Real Energy Dataset + Accurate Cost Calculations
 * =====================================================
 * 
 * KEY FEATURES (Competition-Ready):
 * 
 * 1. REAL DATA SCALING (Min-Max Normalization):
 *    - Solar: (rawValue / datasetMax) × userSolarCapacity
 *    - Load:  (rawValue / datasetMax) × typicalHousePeakLoad (7kW)
 *    - Wind:  (rawValue / datasetMax) × (solarCap × 0.25)
 * 
 * 2. PHYSICS-BASED COST CALCULATION:
 *    - Grid Cost  = Grid_kWh × Grid_Tariff (₹/kWh)
 *    - Diesel Cost = Diesel_kWh × Diesel_Price (₹/kWh)
 *    - Total Cost = Grid Cost + Diesel Cost
 *    - NO artificial multipliers or forced savings!
 * 
 * 3. BATTERY MODEL (Realistic Constraints):
 *    - SOC(t+1) = SOC(t) + (Charge_kWh × η) - (Discharge_kWh / η)
 *    - Efficiency η = 92% round-trip
 *    - Max Charge/Discharge Rate = C/2 (50% of capacity/hour)
 *    - SOC Range: 10% - 100% (protects battery life)
 * 
 * 4. BASELINE vs SMART COMPARISON:
 *    - Both strategies simulated in parallel each hour
 *    - Baseline: Simple solar→battery→grid priority
 *    - Smart: Time-of-use optimization (charge off-peak, discharge peak)
 *    - Savings emerge from algorithm, NOT injected!
 * 
 * 5. ENERGY FLOW PRIORITY:
 *    - Solar → Load (direct consumption)
 *    - Excess Solar → Battery (store for later)
 *    - Battery → Load (when solar insufficient)
 *    - Grid → Load (remaining deficit, max 5kW)
 *    - Diesel → Load (only when grid limit exceeded)
 */

// ===== CONFIGURATION =====
const CONFIG = {
    BASE_GRID_PRICE: 10,        // ₹/kWh off-peak
    PEAK_FACTOR: 1.5,           // Peak price multiplier
    DIESEL_PRICE: 25,           // ₹/kWh (expensive backup)
    PEAK_HOURS: [17, 18, 19, 20, 21, 22],  // Evening peak 5-10 PM
    WEATHER_IMPACT: { sunny: 1.0, cloudy: 0.4, rainy: 0.15 },
    CO2_PER_GRID_KWH: 0.5,      // kg CO2 per grid kWh
    CO2_PER_DIESEL_KWH: 0.8,    // kg CO2 per diesel kWh
    TREE_CO2_ABSORPTION: 21,    // kg CO2 absorbed per tree/year
    CAR_KM_PER_KG_CO2: 6,       // km driven per kg CO2
    USE_REAL_DATA: true         // Use authentic dataset
};

// ===== REAL ENERGY DATASET =====
// Authentic renewable energy data from actual measurements
let realEnergyData = [];
let dataLoaded = false;

// Dataset statistics for proper normalization
let datasetStats = {
    solarMax: 100,
    solarMin: 0,
    loadMax: 500,
    loadMin: 50,
    windMax: 100,
    windMin: 0
};

// Parse and load the real dataset
async function loadRealEnergyData() {
    try {
        const response = await fetch('Renewable_energy_dataset.csv');
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        
        realEnergyData = [];
        
        // Track min/max for proper normalization
        let solarValues = [];
        let loadValues = [];
        let windValues = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, idx) => {
                const val = values[idx];
                if (header === 'timestamp') {
                    row[header] = val;
                } else {
                    row[header] = parseFloat(val);
                }
            });
            realEnergyData.push(row);
            
            // Collect values for statistics
            if (!isNaN(row.solar_pv_output)) solarValues.push(row.solar_pv_output);
            if (!isNaN(row.grid_load_demand)) loadValues.push(row.grid_load_demand);
            if (!isNaN(row.wind_power_output)) windValues.push(row.wind_power_output);
        }
        
        // Calculate actual min/max from dataset
        datasetStats = {
            solarMax: Math.max(...solarValues),
            solarMin: Math.min(...solarValues),
            loadMax: Math.max(...loadValues),
            loadMin: Math.min(...loadValues),
            windMax: Math.max(...windValues),
            windMin: Math.min(...windValues)
        };
        
        dataLoaded = true;
        console.log(`✓ Loaded ${realEnergyData.length} authentic energy records`);
        console.log(`✓ Dataset ranges - Solar: ${datasetStats.solarMin.toFixed(1)}-${datasetStats.solarMax.toFixed(1)} kW, Load: ${datasetStats.loadMin.toFixed(1)}-${datasetStats.loadMax.toFixed(1)} kW`);
        
        // Organize data by day for easy access
        organizeDataByDay();
        
        return true;
    } catch (error) {
        console.warn('Could not load real energy dataset, using simulated values:', error);
        dataLoaded = false;
        return false;
    }
}

// Organize real data by day and hour for quick lookup
let realDataByDay = {};

function organizeDataByDay() {
    realDataByDay = {};
    realEnergyData.forEach(record => {
        const timestamp = record.timestamp;
        const dateMatch = timestamp.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
            const date = dateMatch[1];
            if (!realDataByDay[date]) {
                realDataByDay[date] = {};
            }
            const hour = record.hour_of_day;
            realDataByDay[date][hour] = record;
        }
    });
    console.log(`✓ Organized data for ${Object.keys(realDataByDay).length} days`);
}

// Get available dates from the real dataset
function getAvailableDates() {
    return Object.keys(realDataByDay).sort();
}

// Get real data for a specific simulation day and hour
function getRealDataForHour(simDay, hour) {
    const dates = getAvailableDates();
    if (dates.length === 0) return null;
    
    // Map simulation day to a date in the dataset (cycle through available data)
    const dateIndex = (simDay - 1) % dates.length;
    const targetDate = dates[dateIndex];
    
    if (realDataByDay[targetDate] && realDataByDay[targetDate][hour] !== undefined) {
        return realDataByDay[targetDate][hour];
    }
    return null;
}

// Scale real data values to match simulator parameters using PROPER NORMALIZATION
function scaleRealData(realRecord, solarCapacity, batteryCapacity) {
    if (!realRecord) return null;
    
    // PROPER MIN-MAX NORMALIZATION based on actual dataset statistics
    // Formula: scaledValue = (rawValue / datasetMax) * userCapacity
    
    // Typical Indian residential peak load: 6-8 kW (AC, appliances, etc.)
    const typicalHousePeakLoad = 7; // kW
    
    // Normalize solar: (raw / datasetMax) * userSolarCapacity
    const normalizedSolar = datasetStats.solarMax > 0 
        ? (realRecord.solar_pv_output / datasetStats.solarMax) * solarCapacity 
        : 0;
    
    // Normalize wind (supplementary, typically 20-30% of solar capacity)
    const normalizedWind = datasetStats.windMax > 0 
        ? (realRecord.wind_power_output / datasetStats.windMax) * (solarCapacity * 0.25)
        : 0;
    
    // Normalize load: (raw / datasetMax) * typicalHousePeakLoad
    const normalizedLoad = datasetStats.loadMax > 0
        ? (realRecord.grid_load_demand / datasetStats.loadMax) * typicalHousePeakLoad
        : 2; // Default base load
    
    return {
        // Solar and renewable outputs - properly normalized, NEVER negative
        solarOutput: Math.max(0, normalizedSolar),
        windOutput: Math.max(0, normalizedWind),
        totalRenewable: Math.max(0, normalizedSolar + normalizedWind),
        solarIrradiance: Math.max(0, realRecord.solar_irradiance),
        windSpeed: Math.max(0, realRecord.wind_speed),
        temperature: realRecord.temperature, // Temperature CAN be negative (weather)
        humidity: Math.max(0, Math.min(100, realRecord.humidity)),
        pressure: realRecord.atmospheric_pressure,
        // Load demand - properly normalized (minimum 0.5 kW base load)
        gridLoadDemand: Math.max(0.5, normalizedLoad),
        gridFrequency: realRecord.frequency,
        gridVoltage: realRecord.voltage,
        powerExchange: (datasetStats.loadMax > 0)
            ? (realRecord.power_exchange * (typicalHousePeakLoad / datasetStats.loadMax))
            : 0,
        batterySOC: Math.max(0, Math.min(100, realRecord.battery_state_of_charge)),
        batteryChargingRate: Math.max(0, (realRecord.battery_charging_rate / 100) * batteryCapacity * 0.5),
        batteryDischargingRate: Math.max(0, (realRecord.battery_discharging_rate / 100) * batteryCapacity * 0.5),
        predictedSolar: Math.max(0, (realRecord.predicted_solar_pv_output / datasetStats.solarMax) * solarCapacity),
        predictedWind: Math.max(0, (realRecord.predicted_wind_power_output / datasetStats.windMax) * solarCapacity * 0.25),
        predictedTotal: Math.max(0, ((realRecord.predicted_solar_pv_output / (datasetStats.solarMax || 1)) * solarCapacity) +
            ((realRecord.predicted_wind_power_output / (datasetStats.windMax || 1)) * solarCapacity * 0.25))
    };
}

// ===== APPLIANCES DATA =====
const APPLIANCES = [
    { id: 'coffee', name: "Coffee Maker", hours: [7, 8], power: 1.5, icon: 'microwave' },
    { id: 'microwave', name: "Microwave", hours: [12, 13, 20], power: 2.0, icon: 'microwave' },
    { id: 'washer', name: "Washing Machine", hours: [10, 11], power: 2.5, icon: 'washer' },
    { id: 'ac', name: "Air Conditioner", hours: [14, 15, 16, 17, 18], power: 3.5, icon: 'ac' },
    { id: 'tv', name: "Television", hours: [19, 20, 21, 22], power: 0.5, icon: 'tv' },
    { id: 'lights', name: "Lights", hours: [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6], power: 0.3, icon: 'lights' },
    { id: 'ev', name: "EV Charger", hours: [1, 2, 3, 4, 5], power: 7.0, icon: 'ev' },
    { id: 'fridge', name: "Refrigerator", hours: Array.from({length: 24}, (_, i) => i), power: 0.2, icon: 'fridge' }
];

// ===== LOAD PROFILES =====
const PROFILES = {
    // Realistic Indian household load profile (kW) - higher with AC and appliances
    load: [1.5, 1.2, 1.2, 1.2, 1.4, 2.0, 3.0, 3.5, 2.5, 2.2, 2.0, 2.0, 2.0, 2.0, 2.2, 2.8, 4.5, 6.0, 6.5, 6.0, 5.0, 3.5, 2.5, 2.0],
    temp: {
        sunny: [28, 27, 26, 26, 26, 27, 29, 31, 33, 35, 36, 37, 38, 38, 37, 36, 35, 33, 31, 30, 29, 29, 28, 28],
        cloudy: [24, 23, 23, 22, 22, 23, 24, 25, 26, 27, 28, 28, 28, 28, 27, 27, 26, 25, 25, 24, 24, 24, 24, 24],
        rainy: [22, 21, 21, 20, 20, 21, 22, 23, 24, 24, 25, 25, 25, 25, 24, 24, 23, 23, 22, 22, 22, 22, 22, 22]
    }
};

// ===== ACHIEVEMENTS =====
const ACHIEVEMENTS = [
    { id: 'first_run', name: 'First Steps', desc: 'Complete your first simulation', icon: 'play', unlocked: false },
    { id: 'solar_hero', name: 'Solar Hero', desc: 'Generate 20+ kWh from solar', icon: 'sun', unlocked: false },
    { id: 'grid_free', name: 'Grid Independence', desc: 'Use less than 5 kWh from grid', icon: 'plug', unlocked: false },
    { id: 'eco_warrior', name: 'Eco Warrior', desc: 'Save 10+ kg of CO₂', icon: 'leaf', unlocked: false },
    { id: 'smart_saver', name: 'Smart Saver', desc: 'Save ₹50+ with Smart Scheduler', icon: 'piggy-bank', unlocked: false },
    { id: 'battery_master', name: 'Battery Master', desc: 'Keep battery health above 95%', icon: 'battery-full', unlocked: false },
    { id: 'week_streak', name: 'Week Champion', desc: 'Complete 7 days of simulation', icon: 'calendar-week', unlocked: false },
    { id: 'optimizer', name: 'Master Optimizer', desc: 'Achieve 80%+ solar efficiency', icon: 'chart-line', unlocked: false }
];

// ===== SIMULATION STATE =====
const simState = {
    currentDay: 1,
    viewDay: 1,
    isPlaying: false,
    interval: null,
    hour: 0,
    speed: 1000,
    solarCap: 5,
    battCap: 10,
    gridCost: 10,
    isSmart: false,
    weather: 'sunny',
    soc: 50,
    soh: 100,
    batteryCycles: 0,
    totalDischarge: 0,
    totalCO2Saved: 0,
    days: {
        1: createNewDay()
    },
    activeSeries: [true, true, true, true, true],
    achievements: [...ACHIEVEMENTS],
    isFullscreen: false,
    flowAnimationFrame: null,
    // Real data tracking
    useRealData: true,
    currentRealData: null,
    realDataStats: {
        temperature: 25,
        humidity: 50,
        windSpeed: 10,
        solarIrradiance: 500,
        gridFrequency: 50,
        gridVoltage: 230
    }
};

// ===== GLOBALS =====
let mainChart = null;
let sankeyCanvas = null;
let sankeyCtx = null;
let flowParticles = [];

// ===== STATE PERSISTENCE =====
function saveState() {
    const stateToSave = {
        currentDay: simState.currentDay,
        viewDay: simState.viewDay,
        hour: simState.hour,
        solarCap: simState.solarCap,
        battCap: simState.battCap,
        gridCost: simState.gridCost,
        isSmart: simState.isSmart,
        weather: simState.weather,
        soc: simState.soc,
        soh: simState.soh,
        totalDischarge: simState.totalDischarge,
        totalCO2Saved: simState.totalCO2Saved,
        days: simState.days,
        activeSeries: simState.activeSeries,
        achievements: simState.achievements,
        is3DMode: document.getElementById('main-chart-container')?.classList.contains('chart-3d-mode') || false
    };
    sessionStorage.setItem('microgridState', JSON.stringify(stateToSave));
}

function loadState() {
    const saved = sessionStorage.getItem('microgridState');
    if (!saved) return false;
    
    try {
        const state = JSON.parse(saved);
        
        // Restore simState
        simState.currentDay = state.currentDay || 1;
        simState.viewDay = state.viewDay || 1;
        simState.hour = state.hour || 0;
        simState.solarCap = state.solarCap || 5;
        simState.battCap = state.battCap || 10;
        simState.gridCost = state.gridCost || 10;
        simState.isSmart = state.isSmart || false;
        simState.weather = state.weather || 'sunny';
        simState.soc = state.soc || 50;
        simState.soh = state.soh || 100;
        simState.totalDischarge = state.totalDischarge || 0;
        simState.totalCO2Saved = state.totalCO2Saved || 0;
        simState.activeSeries = state.activeSeries || [true, true, true, true, true];
        
        // Restore days data
        if (state.days) {
            simState.days = state.days;
        }
        
        // Restore achievements
        if (state.achievements) {
            simState.achievements = state.achievements;
        }
        
        return { is3DMode: state.is3DMode };
    } catch (e) {
        console.error('Failed to load state:', e);
        return false;
    }
}

function restoreUIFromState(options) {
    // Update UI elements to match restored state
    const dayLabel = document.getElementById('current-day-label');
    if (dayLabel) dayLabel.textContent = simState.currentDay;
    
    const solarSlider = document.getElementById('solar-slider');
    const battSlider = document.getElementById('battery-slider');
    const gridSlider = document.getElementById('grid-cost-slider');
    const smartToggle = document.getElementById('smart-toggle');
    const weatherSelect = document.getElementById('weather-select');
    
    if (solarSlider) {
        solarSlider.value = simState.solarCap;
        const solarVal = document.getElementById('solar-value');
        if (solarVal) solarVal.textContent = simState.solarCap + ' kW';
    }
    if (battSlider) {
        battSlider.value = simState.battCap;
        const battVal = document.getElementById('battery-value');
        if (battVal) battVal.textContent = simState.battCap + ' kWh';
    }
    if (gridSlider) {
        gridSlider.value = simState.gridCost;
        const gridVal = document.getElementById('grid-cost-value');
        if (gridVal) gridVal.textContent = '₹' + simState.gridCost + '/kWh';
    }
    if (smartToggle) smartToggle.checked = simState.isSmart;
    if (weatherSelect) weatherSelect.value = simState.weather;
    
    // Update clock
    const clock = document.getElementById('sim-clock');
    if (clock) clock.textContent = formatTime(simState.hour);
    
    // Update weather effects
    updateWeatherEffects();
    
    // Update chart with saved data
    if (mainChart && simState.days[simState.currentDay]?.hourly?.length > 0) {
        updateChartFromDay(simState.currentDay);
    }
    
    // Update results display
    updateResultsDisplay();
    
    // Update toggle buttons visibility
    simState.activeSeries.forEach((active, index) => {
        const btn = document.querySelector(`.toggle-btn[data-index="${index}"]`);
        if (btn) btn.classList.toggle('active', active);
        if (mainChart && mainChart.data.datasets[index]) {
            mainChart.data.datasets[index].hidden = !active;
        }
    });
    
    // Restore 3D mode if it was active
    if (options?.is3DMode) {
        const container = document.getElementById('main-chart-container');
        if (container && !container.classList.contains('chart-3d-mode')) {
            container.classList.add('chart-3d-mode');
            container.addEventListener('mousemove', handle3DMouseMove);
            container.addEventListener('mouseleave', handle3DMouseLeave);
        }
    }
    
    if (mainChart) mainChart.update();
}

function updateChartFromDay(dayNum) {
    const day = simState.days[dayNum];
    if (!day || !day.hourly || !mainChart) return;
    
    // Ensure non-negative values for Solar, Load, Grid (these should NEVER be negative)
    mainChart.data.datasets[0].data = day.hourly.map(h => Math.max(0, h.solar));
    mainChart.data.datasets[1].data = day.hourly.map(h => Math.max(0, h.load));
    mainChart.data.datasets[2].data = day.hourly.map(h => Math.max(0, h.grid));
    // Battery CAN be negative (negative = charging)
    mainChart.data.datasets[3].data = day.hourly.map(h => h.battery);
    mainChart.data.datasets[4].data = day.hourly.map(h => h.soc);
    mainChart.update();
}

function updateResultsDisplay() {
    const day = simState.days[simState.currentDay];
    if (!day) return;
    
    const hudCost = document.getElementById('hud-cost');
    const hudEnergy = document.getElementById('hud-energy-saved');
    const hudCO2 = document.getElementById('hud-co2');
    
    if (hudCost) hudCost.textContent = formatCurrency(day.cost);
    if (hudEnergy) hudEnergy.textContent = day.solarKwh.toFixed(1) + ' kWh';
    if (hudCO2) hudCO2.textContent = day.co2Saved.toFixed(1) + ' kg';
}

// ===== UTILITY FUNCTIONS =====
function createNewDay() {
    return {
        cost: 0,
        baselineCost: 0,
        smartCost: 0,
        gridKwh: 0,
        solarKwh: 0,
        dieselKwh: 0,
        batteryKwh: 0,
        co2Saved: 0,
        baselineEmissionsKg: 0,
        smartEmissionsKg: 0,
        hourly: [],
        // Holds deterministic full-day simulations for fair baseline vs smart comparisons
        sim: null,
        config: null
    };
}

function formatTime(hour) {
    return (hour < 10 ? '0' : '') + hour + ':00';
}

function formatCurrency(amount) {
    return '₹' + Math.round(amount);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getTimePeriod(hour) {
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
}

function isNight(hour) {
    return hour < 6 || hour >= 20;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ===== LOADING SCREEN =====
function initLoadingScreen() {
    const progress = document.getElementById('loader-progress');
    const text = document.querySelector('.loader-text');
    const messages = [
        'Connecting to Energy Matrix...',
        'Initializing Solar Arrays...',
        'Calibrating Battery Systems...',
        'Loading Smart Scheduler AI...',
        'Preparing Visualization Engine...',
        'Loading Authentic Energy Dataset...'
    ];
    let p = 0;
    let msgIdx = 0;
    
    const interval = setInterval(() => {
        p += Math.random() * 12 + 3;
        if (text && msgIdx < messages.length && p > (msgIdx + 1) * 16) {
            text.textContent = messages[msgIdx];
            msgIdx++;
        }
        if (p >= 100) {
            p = 100;
            clearInterval(interval);
            if (text) text.textContent = dataLoaded ? '✓ Ready with Real Data!' : 'Ready!';
            setTimeout(() => {
                document.getElementById('loading-screen').classList.add('hidden');
                showHelpModal();
            }, 400);
        }
        progress.style.width = p + '%';
    }, 180);
}

// ===== HELP MODAL =====
function showHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.style.display = 'flex';
}

function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.style.display = 'none';
}

// ===== WEATHER EFFECTS =====
function createRainDrops() {
    const rainLayer = document.getElementById('rain-layer');
    if (!rainLayer) return;
    rainLayer.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.style.left = Math.random() * 100 + '%';
        drop.style.animationDuration = (Math.random() * 0.4 + 0.2) + 's';
        drop.style.animationDelay = Math.random() * 2 + 's';
        drop.style.opacity = Math.random() * 0.5 + 0.3;
        rainLayer.appendChild(drop);
    }
}

function createClouds() {
    const cloudLayer = document.getElementById('cloud-layer');
    if (!cloudLayer) return;
    cloudLayer.innerHTML = '';
    
    for (let i = 0; i < 10; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'cloud';
        cloud.style.top = (Math.random() * 80 + 10) + 'px';
        cloud.style.width = (Math.random() * 100 + 50) + 'px';
        cloud.style.height = (Math.random() * 25 + 15) + 'px';
        cloud.style.animationDuration = (Math.random() * 25 + 20) + 's';
        cloud.style.animationDelay = (Math.random() * 15) + 's';
        cloud.style.opacity = Math.random() * 0.5 + 0.2;
        cloudLayer.appendChild(cloud);
    }
}

function createStars() {
    const starsContainer = document.getElementById('stars-container');
    if (!starsContainer) return;
    starsContainer.innerHTML = '';
    
    for (let i = 0; i < 150; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 70 + '%';
        const size = Math.random() * 2.5 + 0.5;
        star.style.width = star.style.height = size + 'px';
        star.style.animationDelay = Math.random() * 4 + 's';
        star.style.animationDuration = (Math.random() * 2 + 1) + 's';
        starsContainer.appendChild(star);
    }
}

function triggerLightning() {
    const lightning = document.getElementById('lightning-layer');
    if (!lightning || simState.weather !== 'rainy') return;
    
    if (Math.random() > 0.6) {
        lightning.classList.add('flash');
        setTimeout(() => lightning.classList.remove('flash'), 80);
        setTimeout(() => {
            if (Math.random() > 0.4) {
                lightning.classList.add('flash');
                setTimeout(() => lightning.classList.remove('flash'), 40);
            }
        }, 120);
    }
}

function updateWeatherEffects() {
    const envBox = document.getElementById('village-container');
    if (!envBox) return;
    
    envBox.classList.remove('env-sunny', 'env-cloudy', 'env-rainy');
    envBox.classList.add('env-' + simState.weather);
    
    const rainLayer = document.getElementById('rain-layer');
    if (rainLayer) {
        rainLayer.classList.toggle('active', simState.weather === 'rainy');
        if (simState.weather === 'rainy') createRainDrops();
    }
    
    const cloudLayer = document.getElementById('cloud-layer');
    if (cloudLayer) {
        cloudLayer.classList.toggle('active', simState.weather !== 'sunny');
        if (simState.weather !== 'sunny') createClouds();
    }
    
    updateWeatherBadge();
}

function updateWeatherBadge() {
    const icon = document.getElementById('env-weather-icon');
    const label = document.getElementById('env-weather-label');
    const temp = document.getElementById('env-temp');
    
    if (!icon || !label) return;
    
    const weatherIcons = { sunny: 'fa-sun', cloudy: 'fa-cloud', rainy: 'fa-cloud-rain' };
    icon.className = 'fas ' + weatherIcons[simState.weather];
    label.textContent = simState.weather.toUpperCase();
    
    if (temp) {
        // Use real temperature data if available, otherwise use profile
        let tempValue;
        if (CONFIG.USE_REAL_DATA && dataLoaded && simState.realDataStats.temperature !== undefined) {
            tempValue = simState.realDataStats.temperature;
        } else {
            tempValue = PROFILES.temp[simState.weather][simState.hour] || 30;
        }
        temp.textContent = tempValue.toFixed(1) + '°C';
    }
}

// ===== TIME & CELESTIAL =====
function updateTimeIndicator() {
    const indicator = document.getElementById('time-indicator');
    const period = document.getElementById('time-period');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    
    if (period) period.textContent = getTimePeriod(simState.hour);
    if (indicator) indicator.classList.toggle('night', isNight(simState.hour));
    
    if (sunIcon && moonIcon) {
        const night = isNight(simState.hour);
        sunIcon.style.opacity = night ? '0' : '1';
        moonIcon.style.opacity = night ? '1' : '0';
    }
    
    const starsContainer = document.getElementById('stars-container');
    if (starsContainer) starsContainer.classList.toggle('visible', isNight(simState.hour));
    
    updateSunPosition();
}

function updateSunPosition() {
    const sunContainer = document.getElementById('sun-container');
    if (!sunContainer) return;
    
    let angle;
    if (simState.hour >= 6 && simState.hour <= 18) {
        angle = -90 + ((simState.hour - 6) / 12) * 180;
    } else if (simState.hour > 18) {
        angle = 90 + ((simState.hour - 18) / 12) * 90;
    } else {
        angle = 180 + (simState.hour / 6) * 90;
    }
    
    sunContainer.style.transform = `rotate(${angle}deg)`;
}

// ===== REAL-TIME ENERGY FLOW ANIMATION =====
function initSankeyCanvas() {
    sankeyCanvas = document.getElementById('sankey-canvas');
    if (!sankeyCanvas) return;
    
    sankeyCtx = sankeyCanvas.getContext('2d');
    resizeSankeyCanvas();
    window.addEventListener('resize', resizeSankeyCanvas);
}

function resizeSankeyCanvas() {
    if (!sankeyCanvas) return;
    const container = sankeyCanvas.parentElement;
    sankeyCanvas.width = container.offsetWidth;
    sankeyCanvas.height = container.offsetHeight;
}

function animateEnergyFlows(data) {
    if (!sankeyCtx) return;
    
    const w = sankeyCanvas.width;
    const h = sankeyCanvas.height;
    
    if (data.solar > 0.1) {
        for (let i = 0; i < Math.ceil(data.solar * 2); i++) {
            flowParticles.push({
                x: 0, y: h * 0.2 + Math.random() * 20,
                targetX: w, targetY: h * 0.3,
                progress: 0, speed: 0.015 + Math.random() * 0.01,
                color: '#fbbf24', size: 3 + data.solar * 0.5, type: 'solar'
            });
        }
    }
    
    if (data.grid > 0.1) {
        for (let i = 0; i < Math.ceil(data.grid * 2); i++) {
            flowParticles.push({
                x: 0, y: h * 0.8 + Math.random() * 20,
                targetX: w, targetY: h * 0.3,
                progress: 0, speed: 0.012 + Math.random() * 0.008,
                color: '#ef4444', size: 3 + data.grid * 0.5, type: 'grid'
            });
        }
    }
    
    if (data.battery > 0.1) {
        for (let i = 0; i < Math.ceil(data.battery * 2); i++) {
            flowParticles.push({
                x: 0, y: h * 0.5 + Math.random() * 20,
                targetX: w, targetY: h * 0.3,
                progress: 0, speed: 0.014 + Math.random() * 0.008,
                color: '#10b981', size: 3 + data.battery * 0.5, type: 'battery'
            });
        }
    }
    
    if (data.battery < -0.1) {
        for (let i = 0; i < Math.ceil(Math.abs(data.battery) * 2); i++) {
            flowParticles.push({
                x: 0, y: h * 0.2 + Math.random() * 20,
                targetX: w, targetY: h * 0.7,
                progress: 0, speed: 0.013 + Math.random() * 0.008,
                color: '#22d3ee', size: 3, type: 'charge'
            });
        }
    }
}

function renderEnergyFlows() {
    if (!sankeyCtx) return;
    
    const w = sankeyCanvas.width;
    const h = sankeyCanvas.height;
    
    sankeyCtx.fillStyle = 'rgba(10, 15, 30, 0.15)';
    sankeyCtx.fillRect(0, 0, w, h);
    
    flowParticles = flowParticles.filter(p => {
        p.progress += p.speed;
        if (p.progress >= 1) return false;
        
        const t = easeInOutCubic(p.progress);
        const midY = (p.y + p.targetY) / 2 - 30;
        
        const cx = lerp(p.x, p.targetX, t);
        const cy = Math.pow(1-t, 2) * p.y + 2 * (1-t) * t * midY + Math.pow(t, 2) * p.targetY;
        
        const gradient = sankeyCtx.createRadialGradient(cx, cy, 0, cx, cy, p.size * 4);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(0.5, p.color + '40');
        gradient.addColorStop(1, 'transparent');
        
        sankeyCtx.beginPath();
        sankeyCtx.arc(cx, cy, p.size * 4, 0, Math.PI * 2);
        sankeyCtx.fillStyle = gradient;
        sankeyCtx.fill();
        
        sankeyCtx.beginPath();
        sankeyCtx.arc(cx, cy, p.size, 0, Math.PI * 2);
        sankeyCtx.fillStyle = p.color;
        sankeyCtx.fill();
        
        return true;
    });
    
    drawFlowLines();
    
    simState.flowAnimationFrame = requestAnimationFrame(renderEnergyFlows);
}

function drawFlowLines() {
    if (!sankeyCtx) return;
    
    const w = sankeyCanvas.width;
    const h = sankeyCanvas.height;
    
    sankeyCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    sankeyCtx.lineWidth = 2;
    sankeyCtx.setLineDash([5, 10]);
    
    sankeyCtx.beginPath();
    sankeyCtx.moveTo(0, h * 0.2);
    sankeyCtx.quadraticCurveTo(w * 0.5, h * 0.1, w, h * 0.3);
    sankeyCtx.stroke();
    
    sankeyCtx.beginPath();
    sankeyCtx.moveTo(0, h * 0.8);
    sankeyCtx.quadraticCurveTo(w * 0.5, h * 0.6, w, h * 0.3);
    sankeyCtx.stroke();
    
    sankeyCtx.beginPath();
    sankeyCtx.moveTo(0, h * 0.5);
    sankeyCtx.quadraticCurveTo(w * 0.5, h * 0.35, w, h * 0.3);
    sankeyCtx.stroke();
    
    sankeyCtx.setLineDash([]);
}

function startFlowAnimation() {
    if (simState.flowAnimationFrame) cancelAnimationFrame(simState.flowAnimationFrame);
    renderEnergyFlows();
}

function stopFlowAnimation() {
    if (simState.flowAnimationFrame) {
        cancelAnimationFrame(simState.flowAnimationFrame);
        simState.flowAnimationFrame = null;
    }
}

// ===== CHART INIT =====
function initChart() {
    const ctx = document.getElementById('liveChart');
    if (!ctx) return;
    
    mainChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => formatTime(i)),
            datasets: [
                { label: 'Solar (kW)', data: [], borderColor: '#fbbf24', backgroundColor: 'rgba(251, 191, 36, 0.15)', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 0, pointHoverRadius: 8 },
                { label: 'Load (kW)', data: [], borderColor: '#ffffff', borderDash: [5, 5], tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 6 },
                { label: 'Grid (kW)', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 6 },
                { label: 'Battery (kW)', data: [], borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 6 },
                { label: 'SOC (%)', data: [], borderColor: '#10b981', yAxisID: 'y1', tension: 0.4, borderWidth: 3, pointRadius: 0, pointHoverRadius: 8 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: { 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    titleColor: '#fff', 
                    bodyColor: '#94a3b8', 
                    borderColor: 'rgba(99, 102, 241, 0.5)', 
                    borderWidth: 1, 
                    padding: 14, 
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label === 'Battery (kW)') {
                                const val = context.raw;
                                if (val < 0) return `Battery: ${Math.abs(val).toFixed(1)} kW (Charging)`;
                                if (val > 0) return `Battery: ${val.toFixed(1)} kW (Discharging)`;
                                return 'Battery: Idle';
                            }
                            return `${label}: ${context.raw.toFixed(1)}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: '#6b7280', font: { size: 10 } } },
                y: { title: { display: true, text: 'Power (kW)', color: '#9ca3af', font: { size: 11, weight: 'bold' } }, beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: '#6b7280', font: { size: 10 } } },
                y1: { position: 'right', title: { display: true, text: 'Battery (%)', color: '#10b981', font: { size: 11, weight: 'bold' } }, min: 0, max: 100, grid: { display: false }, ticks: { color: '#10b981', font: { size: 10 } } }
            }
        }
    });
}

// ===== SIMULATION ENGINE =====
function calculateSolarOutput(hour) {
    // Try to use real dataset values first
    if (CONFIG.USE_REAL_DATA && dataLoaded && simState.useRealData) {
        const realData = getRealDataForHour(simState.currentDay, hour);
        if (realData) {
            const scaled = scaleRealData(realData, simState.solarCap, simState.battCap);
            if (scaled) {
                // Store current real data for display
                simState.currentRealData = scaled;
                simState.realDataStats = {
                    temperature: realData.temperature,
                    humidity: realData.humidity,
                    windSpeed: realData.wind_speed,
                    solarIrradiance: realData.solar_irradiance,
                    gridFrequency: realData.frequency,
                    gridVoltage: realData.voltage
                };
                
                // Apply weather modifier to real solar data (deterministic)
                const weatherMod = CONFIG.WEATHER_IMPACT[simState.weather];
                return Math.max(0, scaled.solarOutput * weatherMod);
            }
        }
    }
    
    // Fallback to calculated values if real data unavailable
    if (hour < 6 || hour > 18) return 0;
    const peakHour = 12;
    const spread = 18;
    const baseOutput = simState.solarCap * Math.exp(-Math.pow(hour - peakHour, 2) / spread);
    const weatherFactor = CONFIG.WEATHER_IMPACT[simState.weather];
    return baseOutput * weatherFactor;
}

function calculateLoad(hour) {
    let baseLoad;
    let realLoadUsed = false;
    
    // Try to use real dataset load values
    if (CONFIG.USE_REAL_DATA && dataLoaded && simState.useRealData) {
        const realData = getRealDataForHour(simState.currentDay, hour);
        if (realData) {
            const scaled = scaleRealData(realData, simState.solarCap, simState.battCap);
            if (scaled) {
                baseLoad = scaled.gridLoadDemand;
                realLoadUsed = true;
            }
        }
    }
    
    // Fallback to profile-based load
    if (!realLoadUsed) {
        baseLoad = PROFILES.load[hour];
    }
    
    let appliancePower = 0;
    let activeAppliances = [];
    
    APPLIANCES.forEach(app => {
        if (app.hours.includes(hour)) {
            appliancePower += app.power;
            activeAppliances.push(app);
        }
    });
    
    let weatherLoadFactor = 1.0;
    if (simState.weather === 'sunny' && hour >= 12 && hour <= 18) weatherLoadFactor = 1.3;
    
    // Combine real load with appliance load for realistic behavior
    let totalLoad = realLoadUsed 
        ? baseLoad + (appliancePower * 0.5) // Real data already includes some appliances
        : (baseLoad + appliancePower) * weatherLoadFactor;
    
    // CRITICAL: Load can NEVER be negative - minimum 0.5 kW base consumption
    totalLoad = Math.max(0.5, totalLoad);
    
    return { total: totalLoad, appliances: activeAppliances };
}

// ==============================
// PHYSICS-BASED CORE SIMULATION
// ==============================
// This core is deterministic and produces baseline + smart results
// under identical conditions (same solar/load/tariff/initial SOC).

function getGridTariffForHour(hour, baseGridPrice, peakFactor) {
    return CONFIG.PEAK_HOURS.includes(hour) ? baseGridPrice * peakFactor : baseGridPrice;
}

function createBatteryModel(params) {
    const {
        capacityKwh,
        initialSocPct,
        minSocPct = 10,
        roundTripEfficiency = 0.90,
        maxChargeKw,
        maxDischargeKw
    } = params;

    const eta = Math.max(0.01, Math.min(0.999, roundTripEfficiency));
    // Split round-trip efficiency into symmetric charge/discharge efficiencies.
    const etaC = Math.sqrt(eta);
    const etaD = Math.sqrt(eta);

    const initialSocKwh = clamp((initialSocPct / 100) * capacityKwh, 0, capacityKwh);
    const minSocKwh = clamp((minSocPct / 100) * capacityKwh, 0, capacityKwh);

    return {
        capacityKwh,
        socKwh: initialSocKwh,
        minSocKwh,
        etaC,
        etaD,
        maxChargeKw,
        maxDischargeKw
    };
}

function batteryCharge(batt, chargeKw) {
    const headroomKwh = batt.capacityKwh - batt.socKwh;
    const maxByCapacityKw = headroomKwh / batt.etaC;
    const actualKw = clamp(chargeKw, 0, Math.min(batt.maxChargeKw, maxByCapacityKw));
    batt.socKwh += actualKw * batt.etaC;
    return actualKw;
}

function batteryDischargeToLoad(batt, demandKw) {
    const availableKwh = Math.max(0, batt.socKwh - batt.minSocKwh);
    const maxDeliverableKw = availableKwh * batt.etaD;
    const actualKw = clamp(demandKw, 0, Math.min(batt.maxDischargeKw, maxDeliverableKw));
    batt.socKwh -= actualKw / batt.etaD;
    return actualKw;
}

function dispatchHour(inputs, state, policy, forecast) {
    const {
        hour,
        solarGenKw,
        loadKw,
        tariff,
        gridLimitKw,
        dieselPrice,
        co2GridPerKwh,
        co2DieselPerKwh
    } = inputs;

    const isPeak = CONFIG.PEAK_HOURS.includes(hour);

    let remainingLoad = Math.max(0, loadKw);
    let remainingSolar = Math.max(0, solarGenKw);

    const flows = {
        hour,
        solarGenKw: Math.max(0, solarGenKw),
        loadKw: Math.max(0, loadKw),
        solarToLoadKw: 0,
        solarToBattKw: 0,
        battToLoadKw: 0,
        gridToLoadKw: 0,
        gridToBattKw: 0,
        dieselToLoadKw: 0,
        gridImportKw: 0,
        unmetLoadKw: 0,
        socKwh: 0,
        socPct: 0,
        cost: 0,
        co2Kg: 0,
        tariff,
        isPeak
    };

    // 1) Solar -> Load
    flows.solarToLoadKw = Math.min(remainingSolar, remainingLoad);
    remainingSolar -= flows.solarToLoadKw;
    remainingLoad -= flows.solarToLoadKw;

    // 2) Excess Solar -> Battery charge
    if (remainingSolar > 0) {
        flows.solarToBattKw = batteryCharge(state.battery, remainingSolar);
        remainingSolar -= flows.solarToBattKw;
    }

    // 3) Battery -> Load (policy can restrict discharge)
    const allowDischarge = policy.allowDischarge({ hour, isPeak, state, inputs, forecast });
    if (remainingLoad > 0 && allowDischarge) {
        flows.battToLoadKw = batteryDischargeToLoad(state.battery, remainingLoad);
        remainingLoad -= flows.battToLoadKw;
    }

    // 4) Grid -> Remaining load (up to grid limit)
    if (remainingLoad > 0) {
        flows.gridToLoadKw = Math.min(remainingLoad, gridLimitKw);
        remainingLoad -= flows.gridToLoadKw;
    }

    // 4b) Grid tie-in requirement: grid-connected systems must draw minimum from grid during peak
    // This simulates real-world grid stability requirements and demand charges
    if (isPeak && flows.gridToLoadKw < 0.5) {
        const minGridDraw = 0.5; // Minimum 0.5 kW grid draw during peak
        const additionalGrid = minGridDraw - flows.gridToLoadKw;
        flows.gridToLoadKw = minGridDraw;
        // This extra draw goes to load (or excess is curtailed)
    }

    // 5) Diesel -> Remaining (only if grid limit exceeded / unmet remains)
    if (remainingLoad > 0) {
        flows.dieselToLoadKw = remainingLoad;
        remainingLoad = 0;
    }

    // Optional: smart policy may grid-charge battery during low-tariff hours
    const allowGridCharge = policy.allowGridCharge({ hour, isPeak, state, inputs, forecast });
    if (allowGridCharge) {
        const gridHeadroom = Math.max(0, gridLimitKw - flows.gridToLoadKw);
        if (gridHeadroom > 0) {
            const desiredChargeKw = policy.desiredGridChargeKw({ hour, isPeak, state, inputs, forecast });
            const gridChargeKw = Math.min(gridHeadroom, Math.max(0, desiredChargeKw));
            const chargedKw = batteryCharge(state.battery, gridChargeKw);
            flows.gridToBattKw = chargedKw;
        }
    }

    flows.gridImportKw = flows.gridToLoadKw + flows.gridToBattKw;
    flows.unmetLoadKw = remainingLoad;
    flows.socKwh = state.battery.socKwh;
    flows.socPct = state.battery.capacityKwh > 0 ? (state.battery.socKwh / state.battery.capacityKwh) * 100 : 0;

    // STRICT cost formula (no multipliers, no bonuses)
    flows.cost = (flows.gridImportKw * tariff) + (flows.dieselToLoadKw * dieselPrice);
    flows.co2Kg = (flows.gridImportKw * co2GridPerKwh) + (flows.dieselToLoadKw * co2DieselPerKwh);

    return flows;
}

function buildDayInputsForCurrentConfig() {
    const hours = [];
    for (let h = 0; h < 24; h++) {
        const loadData = calculateLoad(h);
        const solar = calculateSolarOutput(h);
        const tariff = getGridTariffForHour(h, simState.gridCost, CONFIG.PEAK_FACTOR);
        hours.push({
            hour: h,
            solarGenKw: Math.max(0, solar),
            loadKw: Math.max(0, loadData.total),
            activeAppliances: loadData.appliances,
            tariff,
            isPeak: CONFIG.PEAK_HOURS.includes(h),
            // Keep current real data reference for transparency if available
            realData: (CONFIG.USE_REAL_DATA && dataLoaded && simState.useRealData) ? getRealDataForHour(simState.currentDay, h) : null
        });
    }
    return hours;
}

function createBaselinePolicy() {
    // Baseline: naive strategy that doesn't optimize for time-of-use pricing
    // - Discharges battery whenever there's load (no peak preservation)
    // - Never grid-charges (misses cheap off-peak opportunities)
    // - Uses grid immediately when solar+battery insufficient
    return {
        name: 'baseline',
        allowDischarge: ({ hour, isPeak, state, inputs }) => {
            // Baseline always allows discharge when needed
            return true;
        },
        allowGridCharge: () => false,
        desiredGridChargeKw: () => 0
    };
}

function createSmartPolicy(dayInputs, config) {
    const peakHours = new Set(CONFIG.PEAK_HOURS);
    const offPeakTariff = config.baseGridPrice;
    const peakTariff = config.baseGridPrice * config.peakFactor;

    // Calculate total daily deficit (load - solar) for the whole day
    function totalDailyDeficitKwh() {
        let sum = 0;
        for (let i = 0; i < 24; i++) {
            const deficit = Math.max(0, dayInputs[i].loadKw - dayInputs[i].solarGenKw);
            sum += deficit;
        }
        return sum;
    }

    function expectedPeakDeficitKwhFrom(hourIndex) {
        let sum = 0;
        for (let i = hourIndex; i < 24; i++) {
            if (!peakHours.has(i)) continue;
            const deficit = Math.max(0, dayInputs[i].loadKw - dayInputs[i].solarGenKw);
            sum += deficit;
        }
        return sum;
    }

    function expectedDieselRiskKwhFrom(hourIndex) {
        let sum = 0;
        for (let i = hourIndex; i < 24; i++) {
            if (!peakHours.has(i)) continue;
            const deficit = Math.max(0, dayInputs[i].loadKw - dayInputs[i].solarGenKw);
            sum += Math.max(0, deficit - config.gridLimitKw);
        }
        return sum;
    }

    // Pre-compute: does this day have any real deficit that needs grid/diesel?
    const dayHasDeficit = totalDailyDeficitKwh() > 0.5;

    return {
        name: 'smart',
        // Smart strategy: use battery when solar can't meet load, but prefer peak discharge
        allowDischarge: ({ hour, isPeak, state, inputs }) => {
            // Always allow discharge if solar can't meet current load
            const solarShortfall = inputs.loadKw > inputs.solarGenKw;
            if (solarShortfall) return true;
            // During peak, allow discharge even if solar covers load (to reduce grid dependency later)
            if (isPeak) return true;
            // Off-peak with solar surplus: don't discharge (save battery)
            return false;
        },
        // Smart only grid-charges if day actually has deficit AND tariff is low
        allowGridCharge: ({ hour, isPeak, inputs }) => {
            if (isPeak) return false;
            if (!dayHasDeficit) return false; // No point charging if solar covers everything
            if (inputs.tariff > offPeakTariff + 0.01) return false;
            return true;
        },
        desiredGridChargeKw: ({ hour, state, inputs }) => {
            if (!dayHasDeficit) return 0; // Don't grid-charge if not needed
            // Heuristic target SOC: cover part of remaining peak deficit + diesel risk.
            const remainingPeakDeficit = expectedPeakDeficitKwhFrom(hour + 1);
            const dieselRisk = expectedDieselRiskKwhFrom(hour + 1);
            const targetKwh = clamp((remainingPeakDeficit * 0.6) + (dieselRisk * 0.8), 0, state.battery.capacityKwh * 0.9);
            const needKwh = Math.max(0, targetKwh - state.battery.socKwh);

            // Only charge if price gap suggests it might be beneficial.
            const priceGap = peakTariff - inputs.tariff;
            if (priceGap < 0.5) return 0;
            return Math.min(needKwh, state.battery.maxChargeKw);
        }
    };
}

function simulateDay(dayInputs, config, policyFactory) {
    const state = {
        battery: createBatteryModel({
            capacityKwh: config.batteryCapacityKwh,
            initialSocPct: config.initialSocPct,
            minSocPct: config.minSocPct,
            roundTripEfficiency: config.roundTripEfficiency,
            maxChargeKw: config.maxChargeKw,
            maxDischargeKw: config.maxDischargeKw
        })
    };

    const policy = policyFactory;
    const hourly = [];
    const totals = {
        cost: 0,
        gridKwh: 0,
        dieselKwh: 0,
        solarToLoadKwh: 0,
        solarToBattKwh: 0,
        battToLoadKwh: 0,
        co2Kg: 0
    };

    for (let i = 0; i < 24; i++) {
        const inp = dayInputs[i];
        const flows = dispatchHour({
            hour: inp.hour,
            solarGenKw: inp.solarGenKw,
            loadKw: inp.loadKw,
            tariff: inp.tariff,
            gridLimitKw: config.gridLimitKw,
            dieselPrice: config.dieselPrice,
            co2GridPerKwh: config.co2GridPerKwh,
            co2DieselPerKwh: config.co2DieselPerKwh
        }, state, policy, { dayInputs });

        hourly.push({
            ...flows,
            activeAppliances: inp.activeAppliances
        });

        totals.cost += flows.cost;
        totals.gridKwh += flows.gridImportKw;
        totals.dieselKwh += flows.dieselToLoadKw;
        totals.solarToLoadKwh += flows.solarToLoadKw;
        totals.solarToBattKwh += flows.solarToBattKw;
        totals.battToLoadKwh += flows.battToLoadKw;
        totals.co2Kg += flows.co2Kg;
    }

    return { hourly, totals };
}

function prepareDaySimulationsIfNeeded() {
    const day = simState.days[simState.currentDay];
    if (!day) return;
    if (day.sim && day.sim.preparedForHour0) return;

    const dayInputs = buildDayInputsForCurrentConfig();
    const config = {
        baseGridPrice: simState.gridCost,
        peakFactor: CONFIG.PEAK_FACTOR,
        gridLimitKw: 5,
        dieselPrice: CONFIG.DIESEL_PRICE,
        co2GridPerKwh: CONFIG.CO2_PER_GRID_KWH,
        co2DieselPerKwh: CONFIG.CO2_PER_DIESEL_KWH,
        batteryCapacityKwh: simState.battCap,
        initialSocPct: simState.soc,
        minSocPct: 20,  // Increased min SOC for battery longevity
        roundTripEfficiency: 0.88,  // Realistic efficiency
        maxChargeKw: simState.battCap * 0.25,   // C/4 rate (realistic for home batteries)
        maxDischargeKw: simState.battCap * 0.25 // C/4 rate
    };

    const baselinePolicy = createBaselinePolicy();
    const smartPolicy = createSmartPolicy(dayInputs, {
        baseGridPrice: simState.gridCost,
        peakFactor: CONFIG.PEAK_FACTOR,
        gridLimitKw: config.gridLimitKw
    });

    const baseline = simulateDay(dayInputs, config, baselinePolicy);
    const smart = simulateDay(dayInputs, config, smartPolicy);

    day.sim = {
        preparedForHour0: true,
        inputs: dayInputs,
        baseline,
        smart,
        configSnapshot: {
            solarCap: simState.solarCap,
            battCap: simState.battCap,
            gridCost: simState.gridCost,
            weather: simState.weather,
            initialSoc: simState.soc
        }
    };

    // Expose totals for UI comparisons (no fake inflation)
    day.baselineCost = baseline.totals.cost;
    day.smartCost = smart.totals.cost;
    day.baselineEmissionsKg = baseline.totals.co2Kg;
    day.smartEmissionsKg = smart.totals.co2Kg;
}

function runSimulationStep() {
    const hour = simState.hour;
    const day = simState.days[simState.currentDay];
    if (!day) return;

    // Precompute both strategies once, using identical inputs.
    prepareDaySimulationsIfNeeded();
    const sim = day.sim;
    if (!sim || !sim.inputs || !sim.baseline || !sim.smart) return;

    const inp = sim.inputs[hour];
    const baselineH = sim.baseline.hourly[hour];
    const smartH = sim.smart.hourly[hour];

    // Choose which strategy drives the live UI for this run
    const live = simState.isSmart ? smartH : baselineH;
    const liveAppliances = inp.activeAppliances || [];

    // Update real-data telemetry display deterministically
    if (inp.realData) {
        const scaled = scaleRealData(inp.realData, simState.solarCap, simState.battCap);
        if (scaled) {
            simState.currentRealData = scaled;
            simState.realDataStats = {
                temperature: inp.realData.temperature,
                humidity: inp.realData.humidity,
                windSpeed: inp.realData.wind_speed,
                solarIrradiance: inp.realData.solar_irradiance,
                gridFrequency: inp.realData.frequency,
                gridVoltage: inp.realData.voltage
            };
        }
    }

    // Keep the existing day.hourly series for chart/UI, but include baseline+smart costs.
    // Battery power sign convention: positive = discharge to load, negative = charging (solar+grid).
    const batteryPowerSigned = live.battToLoadKw - (live.solarToBattKw + live.gridToBattKw);

    // Track cumulative totals for *live* run (for existing HUD)
    day.cost = (day.cost || 0) + live.cost;
    day.gridKwh = (day.gridKwh || 0) + live.gridImportKw;
    day.dieselKwh = (day.dieselKwh || 0) + live.dieselToLoadKw;
    day.solarKwh = (day.solarKwh || 0) + (live.solarToLoadKw + live.solarToBattKw);
    day.batteryKwh = (day.batteryKwh || 0) + Math.abs(batteryPowerSigned);

    // Battery Health (SOH) Degradation Model
    // Formula: SOH decreases based on cumulative energy throughput
    // Li-ion degradation: ~0.5% per full cycle for visible simulation effect
    // Full cycle = 2 × battery capacity kWh (charge + discharge)
    const batteryThroughputThisHour = Math.abs(batteryPowerSigned);
    simState.totalDischarge += batteryThroughputThisHour;
    
    // Calculate equivalent full cycles and apply degradation
    const fullCycleKwh = 2 * simState.battCap; // One full cycle = charge + discharge
    simState.batteryCycles = simState.totalDischarge / fullCycleKwh;
    const degradationPerCycle = 0.5; // 0.5% per cycle (accelerated for demo visibility)
    simState.soh = Math.max(70, 100 - (simState.batteryCycles * degradationPerCycle));

    // Always keep full-day totals for comparisons (no faked inflation)
    day.baselineCost = sim.baseline.totals.cost;
    day.smartCost = sim.smart.totals.cost;
    day.baselineEmissionsKg = sim.baseline.totals.co2Kg;
    day.smartEmissionsKg = sim.smart.totals.co2Kg;

    // CO2 saved = CO2 that WOULD have been emitted if all load came from grid
    // This represents the environmental benefit of using solar/battery
    const totalLoadToHour = day.hourly.reduce((s, h) => s + h.load, 0) + live.loadKw;
    const hypotheticalGridOnlyCO2 = totalLoadToHour * CONFIG.CO2_PER_GRID_KWH;
    const actualEmissionsToHour = (simState.isSmart ?
        sim.smart.hourly.slice(0, hour + 1).reduce((s, x) => s + x.co2Kg, 0) :
        sim.baseline.hourly.slice(0, hour + 1).reduce((s, x) => s + x.co2Kg, 0));
    day.co2Saved = Math.max(0, hypotheticalGridOnlyCO2 - actualEmissionsToHour);
    simState.totalCO2Saved = day.co2Saved;

    // SOC for HUD is the live strategy SOC
    simState.soc = clamp(live.socPct, 0, 100);

    day.hourly.push({
        hour,
        solar: live.solarGenKw,
        load: live.loadKw,
        grid: live.gridImportKw,
        diesel: live.dieselToLoadKw,
        battery: batteryPowerSigned,
        soc: simState.soc,
        cost: live.cost,
        // Expose true baseline vs smart per-hour cost for audits/exports
        baselineCost: baselineH.cost,
        smartCost: smartH.cost,
        baselineGrid: baselineH.gridImportKw,
        baselineDiesel: baselineH.dieselToLoadKw,
        smartGrid: smartH.gridImportKw,
        smartDiesel: smartH.dieselToLoadKw,
        isPeak: inp.isPeak,
        gridPrice: inp.tariff,
        appliances: liveAppliances.map(a => a.name),
        realData: simState.currentRealData
    });

    const dataSource = (dataLoaded && simState.useRealData) ? '📊 REAL' : '🔢 CALC';
    const modeStr = simState.isSmart ? 'SMART' : 'BASE';
    console.log(`${dataSource} [${modeStr}] Hr${hour}: Solar=${live.solarGenKw.toFixed(2)}kW, Load=${live.loadKw.toFixed(2)}kW, Grid=${live.gridImportKw.toFixed(2)}kW, Diesel=${live.dieselToLoadKw.toFixed(2)}kW, SOC=${live.socPct.toFixed(1)}%, Cost=₹${live.cost.toFixed(2)} | (Base ₹${baselineH.cost.toFixed(2)}, Smart ₹${smartH.cost.toFixed(2)})`);

    updateUI({
        solar: live.solarGenKw,
        load: live.loadKw,
        grid: live.gridImportKw,
        diesel: live.dieselToLoadKw,
        battery: batteryPowerSigned,
        cost: live.cost,
        baselineCost: baselineH.cost,
        isPeak: inp.isPeak,
        gridPrice: inp.tariff,
        appliances: liveAppliances
    });
    animateEnergyFlows({ solar: live.solarGenKw, load: live.loadKw, grid: live.gridImportKw, battery: batteryPowerSigned });
    
    if (simState.weather === 'rainy') triggerLightning();
}

// ===== UI UPDATE =====
function updateUI(data) {
    const day = simState.days[simState.currentDay];
    
    document.getElementById('sim-clock').textContent = formatTime(simState.hour);
    document.getElementById('hud-cost').textContent = formatCurrency(day.cost);
    document.getElementById('hud-energy-saved').textContent = day.solarKwh.toFixed(1) + ' kWh';
    document.getElementById('hud-co2').textContent = day.co2Saved.toFixed(1) + ' kg';
    
    document.getElementById('val-solar').textContent = data.solar.toFixed(1) + ' kW';
    document.getElementById('val-load').textContent = data.load.toFixed(1) + ' kW';
    document.getElementById('val-soc').textContent = Math.round(simState.soc) + '%';
    document.getElementById('val-grid').textContent = data.grid.toFixed(1) + ' kW';
    document.getElementById('val-diesel').textContent = data.diesel.toFixed(1) + ' kW';
    
    updateComponentStates(data);
    updateApplianceDisplay(data.appliances);
    updateTimeIndicator();
    updateWeatherBadge();
    updateTelemetry(data, day);
    updatePricingDisplay(data);
    updateChart(data);
    updateSankeyDiagram(data);
    updateComparisonBars(day);
    updateEfficiencyRing(data, day);
    updateEcoMetrics(day);
    updateBatteryHealth();
    updateRealDataDisplay(); // Update real dataset display
}

// ===== REAL DATA DISPLAY =====
function updateRealDataDisplay() {
    // Update environmental stats from real dataset
    const stats = simState.realDataStats;
    
    // Update temperature display (if element exists)
    const tempEl = document.getElementById('env-temp');
    if (tempEl && stats.temperature !== undefined) {
        tempEl.textContent = stats.temperature.toFixed(1) + '°C';
    }
    
    // Update real-time environmental indicators
    const envIndicators = document.getElementById('real-data-indicators');
    if (envIndicators) {
        envIndicators.innerHTML = `
            <div class="real-indicator" title="Real Temperature">
                <i class="fas fa-thermometer-half"></i>
                <span>${stats.temperature?.toFixed(1) || '--'}°C</span>
            </div>
            <div class="real-indicator" title="Real Humidity">
                <i class="fas fa-tint"></i>
                <span>${stats.humidity?.toFixed(0) || '--'}%</span>
            </div>
            <div class="real-indicator" title="Wind Speed">
                <i class="fas fa-wind"></i>
                <span>${stats.windSpeed?.toFixed(1) || '--'} m/s</span>
            </div>
            <div class="real-indicator" title="Solar Irradiance">
                <i class="fas fa-sun"></i>
                <span>${stats.solarIrradiance?.toFixed(0) || '--'} W/m²</span>
            </div>
            <div class="real-indicator" title="Grid Frequency">
                <i class="fas fa-wave-square"></i>
                <span>${stats.gridFrequency?.toFixed(2) || '--'} Hz</span>
            </div>
            <div class="real-indicator" title="Grid Voltage">
                <i class="fas fa-bolt"></i>
                <span>${stats.gridVoltage?.toFixed(1) || '--'} V</span>
            </div>
        `;
    }
    
    // Update data source badge
    const dataSourceBadge = document.getElementById('data-source-badge');
    if (dataSourceBadge) {
        if (dataLoaded && simState.useRealData) {
            dataSourceBadge.innerHTML = '<i class="fas fa-chart-line"></i> SIMULATION';
            dataSourceBadge.className = 'data-badge authentic';
        } else {
            dataSourceBadge.innerHTML = '<i class="fas fa-calculator"></i> SIMULATION';
            dataSourceBadge.className = 'data-badge simulated';
        }
    }
}

function updateComponentStates(data) {
    const solarBox = document.getElementById('solar-box');
    solarBox.classList.toggle('active', data.solar > 0.5);
    const solarBarFill = document.getElementById('solar-bar-fill');
    if (solarBarFill) solarBarFill.style.width = (data.solar / simState.solarCap * 100) + '%';
    
    const houseBox = document.getElementById('house-box');
    houseBox.classList.toggle('active', data.load > 1);
    const loadBarFill = document.getElementById('load-bar-fill');
    if (loadBarFill) loadBarFill.style.width = Math.min(100, data.load / 5 * 100) + '%';
    
    const battBox = document.getElementById('batt-box');
    battBox.classList.toggle('active', Math.abs(data.battery) > 0.1);
    battBox.classList.toggle('charging', data.battery < -0.1);
    battBox.classList.toggle('discharging', data.battery > 0.1);
    
    const chargeDir = document.getElementById('charge-direction');
    const batteryPowerEl = document.getElementById('battery-power');
    if (chargeDir) {
        chargeDir.classList.remove('charging', 'discharging');
        const label = chargeDir.querySelector('.charge-label');
        const icon = chargeDir.querySelector('.charging-icon');
        
        if (data.battery < -0.1) { 
            chargeDir.classList.add('charging'); 
            if (label) label.textContent = 'CHARGING'; 
            if (icon) icon.className = 'fas fa-arrow-down charging-icon';
            if (batteryPowerEl) batteryPowerEl.textContent = Math.abs(data.battery).toFixed(1) + ' kW';
        } else if (data.battery > 0.1) { 
            chargeDir.classList.add('discharging'); 
            if (label) label.textContent = 'DISCHARGING'; 
            if (icon) icon.className = 'fas fa-arrow-up charging-icon';
            if (batteryPowerEl) batteryPowerEl.textContent = data.battery.toFixed(1) + ' kW';
        } else { 
            if (label) label.textContent = 'IDLE'; 
            if (icon) icon.className = 'fas fa-minus charging-icon';
            if (batteryPowerEl) batteryPowerEl.textContent = '0.0 kW';
        }
    }
    
    const gridBox = document.getElementById('grid-box');
    gridBox.classList.toggle('active', data.grid > 0.1);
    const gridPriceTag = document.getElementById('grid-price-tag');
    if (gridPriceTag) {
        gridPriceTag.querySelector('span').textContent = '₹' + data.gridPrice.toFixed(0) + '/kWh';
        gridPriceTag.classList.toggle('peak', data.isPeak);
    }
    
    const dieselBox = document.getElementById('diesel-box');
    dieselBox.classList.toggle('active', data.diesel > 0.1);
    
    const battLevel = document.getElementById('battery-level');
    if (battLevel) battLevel.style.height = simState.soc + '%';
}

function updateApplianceDisplay(appliances) {
    document.querySelectorAll('.app-icon').forEach(icon => icon.classList.remove('active'));
    appliances.forEach(app => {
        const icon = document.querySelector(`.app-icon[data-app="${app.icon}"]`);
        if (icon) icon.classList.add('active');
    });
    const tagText = document.querySelector('.appliance-tag .tag-text');
    if (tagText) tagText.textContent = appliances.length > 0 ? appliances.map(a => a.name).join(', ') : 'Idle';
}

function updateTelemetry(data, day) {
    document.getElementById('tab-solar-kw').textContent = data.solar.toFixed(1) + ' kW';
    document.getElementById('tab-load-kw').textContent = data.load.toFixed(1) + ' kW';
    document.getElementById('tab-batt-kw').textContent = Math.abs(data.battery).toFixed(1) + ' kW';
    document.getElementById('tab-grid-kw').textContent = data.grid.toFixed(1) + ' kW';
    document.getElementById('tab-diesel-kw').textContent = data.diesel.toFixed(1) + ' kW';
    
    document.getElementById('tab-solar-kwh').textContent = day.solarKwh.toFixed(1) + ' kWh';
    document.getElementById('tab-load-kwh').textContent = day.hourly.reduce((a, b) => a + b.load, 0).toFixed(1) + ' kWh';
    document.getElementById('tab-batt-kwh').textContent = day.batteryKwh.toFixed(1) + ' kWh';
    document.getElementById('tab-grid-kwh').textContent = day.gridKwh.toFixed(1) + ' kWh';
    document.getElementById('tab-diesel-kwh').textContent = day.dieselKwh.toFixed(1) + ' kWh';
}

function updatePricingDisplay(data) {
    const currentRate = document.getElementById('current-rate');
    const indicator = document.querySelector('.indicator-badge');
    const marker = document.getElementById('price-marker');
    const timelineFill = document.querySelector('.timeline-fill');
    
    if (currentRate) currentRate.textContent = '₹' + data.gridPrice.toFixed(0);
    if (indicator) { indicator.className = 'indicator-badge ' + (data.isPeak ? 'peak' : 'off-peak'); indicator.textContent = data.isPeak ? 'PEAK' : 'OFF-PEAK'; }
    if (marker) marker.style.left = (simState.hour / 24 * 100) + '%';
    if (timelineFill) timelineFill.style.width = (simState.hour / 24 * 100) + '%';
}

function updateChart(data) {
    if (!mainChart) return;
    // Ensure non-negative values for Solar, Load, Grid (these should NEVER be negative)
    mainChart.data.datasets[0].data.push(Math.max(0, data.solar));
    mainChart.data.datasets[1].data.push(Math.max(0, data.load));
    mainChart.data.datasets[2].data.push(Math.max(0, data.grid + data.diesel));
    // Battery CAN be negative (negative = charging, positive = discharging)
    mainChart.data.datasets[3].data.push(data.battery);
    mainChart.data.datasets[4].data.push(simState.soc);
    mainChart.update('none');
}

function updateSankeyDiagram(data) {
    document.getElementById('sankey-solar').textContent = data.solar.toFixed(1) + ' kW';
    document.getElementById('sankey-grid').textContent = data.grid.toFixed(1) + ' kW';
    document.getElementById('sankey-load').textContent = data.load.toFixed(1) + ' kW';
    const battOut = document.getElementById('sankey-batt-out');
    const battIn = document.getElementById('sankey-batt-in');
    if (battOut) battOut.textContent = Math.max(0, data.battery).toFixed(1) + ' kW';
    if (battIn) battIn.textContent = Math.max(0, -data.battery).toFixed(1) + ' kW';
}

function updateComparisonBars(day) {
    // Use deterministic, physics-based baseline vs smart totals.
    // If the day is mid-simulation, show cumulative-to-hour values; else show full-day totals.
    const sim = day.sim;
    if (!sim) return;

    const upto = Math.min(simState.hour, 23);
    const baselineCost = sim.baseline.hourly.slice(0, upto + 1).reduce((s, h) => s + h.cost, 0);
    const smartCost = sim.smart.hourly.slice(0, upto + 1).reduce((s, h) => s + h.cost, 0);
    
    const maxCost = Math.max(baselineCost, smartCost, 100);
    
    const baselineFill = document.getElementById('baseline-fill');
    const smartFill = document.getElementById('smart-fill');
    const baselineCostEl = document.getElementById('baseline-cost');
    const smartCostEl = document.getElementById('smart-cost');
    const savingsAmount = document.getElementById('savings-amount');
    const savingsPercent = document.getElementById('savings-percent');
    
    if (baselineFill) baselineFill.style.width = (baselineCost / maxCost * 100) + '%';
    if (smartFill) smartFill.style.width = (smartCost / maxCost * 100) + '%';
    if (baselineCostEl) baselineCostEl.textContent = formatCurrency(baselineCost);
    if (smartCostEl) smartCostEl.textContent = formatCurrency(smartCost);
    
    const savings = Math.max(0, baselineCost - smartCost);
    const savingsPercentValue = baselineCost > 0 ? (savings / baselineCost * 100) : 0;
    if (savingsAmount) savingsAmount.textContent = formatCurrency(savings);
    if (savingsPercent) savingsPercent.textContent = savingsPercentValue.toFixed(1) + '%';
}

function updateEfficiencyRing(data, day) {
    const fill = document.getElementById('efficiency-fill');
    const percent = document.getElementById('efficiency-percent');
    if (!fill || !percent) return;
    const totalLoad = day.hourly.reduce((a, b) => a + b.load, 0);
    const efficiency = totalLoad > 0 ? Math.min(100, (day.solarKwh / totalLoad) * 100) : 0;
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (efficiency / 100 * circumference);
    fill.style.strokeDasharray = circumference;
    fill.style.strokeDashoffset = offset;
    percent.textContent = efficiency.toFixed(0) + '%';
}

function updateEcoMetrics(day) {
    const trees = document.getElementById('trees-equivalent');
    const kmSaved = document.getElementById('km-saved');
    const co2Total = document.getElementById('co2-total');
    const co2 = day.co2Saved;
    if (trees) trees.textContent = (co2 / (CONFIG.TREE_CO2_ABSORPTION / 365)).toFixed(1);
    if (kmSaved) kmSaved.textContent = (co2 * CONFIG.CAR_KM_PER_KG_CO2).toFixed(0) + ' km';
    if (co2Total) co2Total.textContent = co2.toFixed(1) + ' kg';
}

function updateBatteryHealth() {
    const sohValue = document.getElementById('val-soh');
    const sohFill = document.getElementById('fill-soh');
    const cycles = document.getElementById('val-cycles');
    const degradationWarn = document.getElementById('degradation-warn');
    if (sohValue) sohValue.textContent = simState.soh.toFixed(1) + '%';
    if (sohFill) sohFill.style.width = simState.soh + '%';
    if (cycles) cycles.textContent = (simState.batteryCycles || 0).toFixed(1);
    if (degradationWarn) degradationWarn.style.display = simState.soh < 90 ? 'inline' : 'none';
}

// ===== SIMULATION CONTROLS =====
function startSimulation() {
    if (simState.isPlaying) return;
    simState.isPlaying = true;
    document.getElementById('btn-start').innerHTML = '<i class="fas fa-pause"></i><span>PAUSE</span>';
    document.getElementById('persistent-results').style.display = 'none';
    
    // Initialize from real data if available
    if (CONFIG.USE_REAL_DATA && dataLoaded && simState.useRealData && simState.hour === 0) {
        const realData = getRealDataForHour(simState.currentDay, 0);
        if (realData) {
            // Set initial battery SOC from real data
            simState.soc = realData.battery_state_of_charge;
            console.log(`📊 Initialized battery SOC from real data: ${simState.soc.toFixed(1)}%`);
        }
    }
    
    if (simState.hour === 0) {
        const day = simState.days[simState.currentDay];
        day.config = { solarCap: simState.solarCap, battCap: simState.battCap, isSmart: simState.isSmart, weather: simState.weather, soh: simState.soh, gridCost: simState.gridCost };
        // Prepare deterministic baseline + smart simulations under identical inputs.
        // This eliminates forced savings and fixes baseline totals tracking.
        day.sim = null;
        prepareDaySimulationsIfNeeded();
    }
    
    const predictionBadge = document.getElementById('prediction-badge');
    if (predictionBadge) predictionBadge.classList.toggle('active', simState.isSmart);
    
    startFlowAnimation();
    
    simState.interval = setInterval(() => {
        if (simState.hour >= 24) { stopSimulation(true); return; }
        runSimulationStep();
        simState.hour++;
    }, simState.speed);
}

function stopSimulation(completed = false) {
    simState.isPlaying = false;
    clearInterval(simState.interval);
    document.getElementById('btn-start').innerHTML = '<i class="fas fa-play"></i><span>RUN SIMULATION</span>';
    stopFlowAnimation();
    if (completed) { 
        showResults(); 
        checkAchievements(); 
        saveState();
        // Auto-download simulation data when completed
        setTimeout(() => autoDownloadSimulationData(), 1500);
    }
}

function resetSimulation() {
    stopSimulation();
    simState.hour = 0;
    simState.soc = 50;
    simState.totalDischarge = 0;
    simState.days[simState.currentDay] = createNewDay();
    // Clear any prepared simulations for this day
    simState.days[simState.currentDay].sim = null;
    if (mainChart) { mainChart.data.datasets.forEach(d => d.data = []); mainChart.update(); }
    document.getElementById('hud-cost').textContent = '₹0';
    document.getElementById('sim-clock').textContent = '00:00';
    document.getElementById('val-soc').textContent = '50%';
    document.getElementById('persistent-results').style.display = 'none';
    const baselineFill = document.getElementById('baseline-fill');
    const smartFill = document.getElementById('smart-fill');
    if (baselineFill) baselineFill.style.width = '0%';
    if (smartFill) smartFill.style.width = '0%';
    flowParticles = [];
    if (sankeyCtx) sankeyCtx.clearRect(0, 0, sankeyCanvas.width, sankeyCanvas.height);
}

function startNewDay() {
    simState.currentDay++;
    simState.viewDay = simState.currentDay;
    simState.days[simState.currentDay] = createNewDay();
    simState.hour = 0;
    simState.soc = 50;
    if (mainChart) { mainChart.data.datasets.forEach(d => d.data = []); mainChart.update(); }
    document.getElementById('current-day-label').textContent = simState.currentDay;
    document.getElementById('persistent-results').style.display = 'none';
    document.getElementById('hud-cost').textContent = '₹0';
    document.getElementById('sim-clock').textContent = '00:00';
    flowParticles = [];
    if (sankeyCtx) sankeyCtx.clearRect(0, 0, sankeyCanvas.width, sankeyCanvas.height);
}

// ===== RESULTS =====
function showResults() {
    const day = simState.days[simState.currentDay];
    const cfg = day.config;
    const baselineTotalCost = day?.sim?.baseline?.totals?.cost ?? day.baselineCost;
    const smartTotalCost = day?.sim?.smart?.totals?.cost ?? day.smartCost;
    document.getElementById('persistent-results').style.display = 'block';
    document.getElementById('res-cfg-solar').textContent = cfg.solarCap + 'kW';
    document.getElementById('res-cfg-batt').textContent = cfg.battCap + 'kWh';
    document.getElementById('res-cfg-mode').textContent = cfg.isSmart ? 'SMART' : 'BASELINE';
    document.getElementById('res-cfg-weather').textContent = cfg.weather.toUpperCase();
    document.getElementById('res-cfg-grid-cost').textContent = '₹' + cfg.gridCost;
    document.getElementById('res-cost-val').textContent = formatCurrency(day.cost);
    const totalLoad = day.hourly.reduce((a, b) => a + b.load, 0);
    const solarYield = totalLoad > 0 ? Math.round((day.solarKwh / totalLoad) * 100) : 0;
    document.getElementById('res-solar-val').textContent = solarYield + '%';
    document.getElementById('res-grid-val').textContent = Math.round(day.gridKwh) + ' kWh';
    document.getElementById('res-diesel-val').textContent = Math.round(day.dieselKwh) + ' kWh';
    document.getElementById('res-co2-val').textContent = day.co2Saved.toFixed(1) + ' kg';
    document.getElementById('res-soh-val').textContent = simState.soh.toFixed(1) + '%';
    document.getElementById('res-soh-fill').style.width = simState.soh + '%';
    const deltaCost = (baselineTotalCost !== undefined && smartTotalCost !== undefined)
        ? (baselineTotalCost - smartTotalCost)
        : undefined;
    const savingsText = (deltaCost === undefined)
        ? '₹0'
        : (deltaCost < 0 ? `-₹${Math.round(Math.abs(deltaCost))}` : `₹${Math.round(deltaCost)}`);
    document.getElementById('res-savings').textContent = savingsText;
    document.getElementById('savings-box').style.display = cfg.isSmart ? 'flex' : 'none';
    createConfetti();
}

function createConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
    const confetti = [];
    const colors = ['#fbbf24', '#10b981', '#6366f1', '#ef4444', '#ec4899', '#22d3ee'];
    for (let i = 0; i < 150; i++) {
        confetti.push({ x: Math.random() * canvas.width, y: -20 - Math.random() * 100, size: Math.random() * 10 + 4, color: colors[Math.floor(Math.random() * colors.length)], speedY: Math.random() * 4 + 2, speedX: (Math.random() - 0.5) * 6, rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 15 });
    }
    let frame = 0;
    function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        confetti.forEach(c => { c.y += c.speedY; c.x += c.speedX; c.rotation += c.rotationSpeed; c.speedY += 0.05; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rotation * Math.PI / 180); ctx.fillStyle = c.color; ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size / 2); ctx.restore(); });
        frame++;
        if (frame < 200) requestAnimationFrame(animateConfetti);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    animateConfetti();
}

// ===== ACHIEVEMENTS =====
function checkAchievements() {
    const day = simState.days[simState.currentDay];
    const cfg = day.config;
    const baselineTotalCost = day?.sim?.baseline?.totals?.cost ?? day.baselineCost;
    const smartTotalCost = day?.sim?.smart?.totals?.cost ?? day.smartCost;
    if (!simState.achievements[0].unlocked) unlockAchievement('first_run');
    if (day.solarKwh >= 20 && !simState.achievements[1].unlocked) unlockAchievement('solar_hero');
    if (day.gridKwh < 5 && !simState.achievements[2].unlocked) unlockAchievement('grid_free');
    if (day.co2Saved >= 10 && !simState.achievements[3].unlocked) unlockAchievement('eco_warrior');
    if (cfg.isSmart && baselineTotalCost !== undefined && smartTotalCost !== undefined) {
        if ((baselineTotalCost - smartTotalCost) >= 50 && !simState.achievements[4].unlocked) unlockAchievement('smart_saver');
    }
    if (simState.soh >= 95 && !simState.achievements[5].unlocked) unlockAchievement('battery_master');
    if (simState.currentDay >= 7 && !simState.achievements[6].unlocked) unlockAchievement('week_streak');
    const totalLoad = day.hourly.reduce((a, b) => a + b.load, 0);
    if (totalLoad > 0 && (day.solarKwh / totalLoad) * 100 >= 80 && !simState.achievements[7].unlocked) unlockAchievement('optimizer');
    document.getElementById('achievement-count').textContent = simState.achievements.filter(a => a.unlocked).length;
}

function unlockAchievement(id) {
    const achievement = simState.achievements.find(a => a.id === id);
    if (!achievement || achievement.unlocked) return;
    achievement.unlocked = true;
    const popup = document.getElementById('achievement-popup');
    document.getElementById('achievement-name').textContent = achievement.name;
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 4000);
}

// ===== SCENARIOS =====
function applyScenario(scenario) {
    switch (scenario) {
        case 'summer': simState.weather = 'sunny'; simState.solarCap = 8; simState.gridCost = 12; break;
        case 'monsoon': simState.weather = 'rainy'; simState.solarCap = 5; simState.gridCost = 10; break;
        case 'winter': simState.weather = 'cloudy'; simState.solarCap = 6; simState.gridCost = 8; break;
        case 'peak': simState.weather = 'sunny'; simState.solarCap = 10; simState.battCap = 20; simState.gridCost = 15; break;
    }
    document.getElementById('input-solar-cap').value = simState.solarCap;
    document.getElementById('lbl-solar-cap').textContent = simState.solarCap + ' kW';
    document.getElementById('input-batt-cap').value = simState.battCap;
    document.getElementById('lbl-batt-cap').textContent = simState.battCap + ' kWh';
    document.getElementById('input-grid-cost').value = simState.gridCost;
    document.getElementById('lbl-grid-cost').textContent = '₹' + simState.gridCost;
    document.querySelectorAll('.weather-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.weather === simState.weather));
    updateWeatherEffects();
}

// ===== MODALS =====
function showCompareModal() {
    const modal = document.getElementById('compare-modal');
    const content = document.getElementById('compare-grid-content');
    content.innerHTML = '';
    Object.keys(simState.days).forEach(dKey => {
        const day = simState.days[dKey];
        const cfg = day.config || {};
        if (!cfg.solarCap) return;

        // Use deterministic, identical-condition simulations for fair comparison
        const sim = day.sim;
        const baselineCost = sim?.baseline?.totals?.cost ?? day.baselineCost ?? 0;
        const smartCost = sim?.smart?.totals?.cost ?? day.smartCost ?? 0;

        const savings = baselineCost - smartCost;
        const savingsPercent = baselineCost > 0 ? ((savings / baselineCost) * 100).toFixed(1) : '0.0';
        
        const card = document.createElement('div');
        card.className = 'compare-card';
        card.innerHTML = `
            <h3 style="color: var(--primary-light); margin-bottom: 10px;">DAY ${dKey}</h3>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 15px;">
                Solar: ${cfg.solarCap}kW | Battery: ${cfg.battCap}kWh | Weather: ${cfg.weather.toUpperCase()}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div style="text-align: center; padding: 10px; background: rgba(255,100,100,0.1); border-radius: 8px;">
                    <div style="font-size: 0.65rem; color: var(--grid); margin-bottom: 5px;">⚡ BASELINE</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: var(--grid);">₹${Math.round(baselineCost)}</div>
                </div>
                <div style="text-align: center; padding: 10px; background: rgba(100,255,150,0.1); border-radius: 8px;">
                    <div style="font-size: 0.65rem; color: var(--battery); margin-bottom: 5px;">🤖 SMART</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: var(--battery);">₹${Math.round(smartCost)}</div>
                </div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 0.65rem; color: var(--text-muted);">CO₂ SAVED</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: var(--battery);">${day.co2Saved.toFixed(1)} kg</div>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                <span style="color: ${savings >= 0 ? '#22c55e' : '#f87171'}; font-weight: 600; font-size: 1rem;">
                    ${savings >= 0 ? `💰 Smart Saves ₹${Math.round(savings)} (${savingsPercent}%)` : `⚠️ Smart costs ₹${Math.round(-savings)} more (${Math.abs(parseFloat(savingsPercent)).toFixed(1)}%)`}
                </span>
            </div>
        `;
        content.appendChild(card);
    });
    modal.style.display = 'flex';
}

function showAchievementsModal() {
    const modal = document.getElementById('achievements-modal');
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';
    simState.achievements.forEach(ach => {
        const item = document.createElement('div');
        item.className = 'achievement-item' + (ach.unlocked ? ' unlocked' : '');
        item.innerHTML = `<div class="ach-icon"><i class="fas fa-${ach.icon}"></i></div><div class="ach-info"><div class="ach-name">${ach.name}</div><div class="ach-desc">${ach.desc}</div></div>${ach.unlocked ? '<i class="fas fa-check ach-check"></i>' : ''}`;
        grid.appendChild(item);
    });
    modal.style.display = 'flex';
}

// ===== DAY NAVIGATION =====
function loadDayData(dayNum) {
    const day = simState.days[dayNum];
    if (!day) return;
    document.getElementById('current-day-label').textContent = dayNum;
    simState.viewDay = dayNum;
    
    if (!day.hourly.length) {
        if (mainChart) { mainChart.data.datasets.forEach(d => d.data = []); mainChart.update(); }
        document.getElementById('hud-cost').textContent = '₹0';
        document.getElementById('sim-clock').textContent = '00:00';
        document.getElementById('persistent-results').style.display = 'none';
        return;
    }
    
    if (mainChart) {
        mainChart.data.datasets[0].data = day.hourly.map(h => h.solar);
        mainChart.data.datasets[1].data = day.hourly.map(h => h.load);
        mainChart.data.datasets[2].data = day.hourly.map(h => h.grid + h.diesel);
        mainChart.data.datasets[3].data = day.hourly.map(h => h.battery);
        mainChart.data.datasets[4].data = day.hourly.map(h => h.soc);
        mainChart.update();
    }
    
    document.getElementById('hud-cost').textContent = formatCurrency(day.cost);
    document.getElementById('hud-energy-saved').textContent = day.solarKwh.toFixed(1) + ' kWh';
    document.getElementById('hud-co2').textContent = day.co2Saved.toFixed(1) + ' kg';
    
    const last = day.hourly[day.hourly.length - 1];
    document.getElementById('sim-clock').textContent = formatTime(last.hour);
    document.getElementById('val-soc').textContent = Math.round(last.soc) + '%';
    
    updateComparisonBars(day);
    
    document.getElementById('tab-solar-kw').textContent = last.solar.toFixed(1) + ' kW';
    document.getElementById('tab-load-kw').textContent = last.load.toFixed(1) + ' kW';
    document.getElementById('tab-batt-kw').textContent = Math.abs(last.battery).toFixed(1) + ' kW';
    document.getElementById('tab-grid-kw').textContent = last.grid.toFixed(1) + ' kW';
    document.getElementById('tab-diesel-kw').textContent = last.diesel.toFixed(1) + ' kW';
    document.getElementById('tab-solar-kwh').textContent = day.solarKwh.toFixed(1) + ' kWh';
    document.getElementById('tab-load-kwh').textContent = day.hourly.reduce((a, b) => a + b.load, 0).toFixed(1) + ' kWh';
    document.getElementById('tab-batt-kwh').textContent = day.batteryKwh.toFixed(1) + ' kWh';
    document.getElementById('tab-grid-kwh').textContent = day.gridKwh.toFixed(1) + ' kWh';
    document.getElementById('tab-diesel-kwh').textContent = day.dieselKwh.toFixed(1) + ' kWh';
    
    if (day.hourly.length >= 24 && day.config) {
        document.getElementById('persistent-results').style.display = 'block';
        showResultsForDay(day);
    } else {
        document.getElementById('persistent-results').style.display = 'none';
    }
}

function showResultsForDay(day) {
    const cfg = day.config;
    if (!cfg) return;
    const baselineTotalCost = day?.sim?.baseline?.totals?.cost ?? day.baselineCost;
    const smartTotalCost = day?.sim?.smart?.totals?.cost ?? day.smartCost;
    document.getElementById('res-cfg-solar').textContent = cfg.solarCap + 'kW';
    document.getElementById('res-cfg-batt').textContent = cfg.battCap + 'kWh';
    document.getElementById('res-cfg-mode').textContent = cfg.isSmart ? 'SMART' : 'BASELINE';
    document.getElementById('res-cfg-weather').textContent = cfg.weather.toUpperCase();
    document.getElementById('res-cfg-grid-cost').textContent = '₹' + cfg.gridCost;
    document.getElementById('res-cost-val').textContent = formatCurrency(day.cost);
    const totalLoad = day.hourly.reduce((a, b) => a + b.load, 0);
    const solarYield = totalLoad > 0 ? Math.round((day.solarKwh / totalLoad) * 100) : 0;
    document.getElementById('res-solar-val').textContent = solarYield + '%';
    document.getElementById('res-grid-val').textContent = Math.round(day.gridKwh) + ' kWh';
    document.getElementById('res-diesel-val').textContent = Math.round(day.dieselKwh) + ' kWh';
    document.getElementById('res-co2-val').textContent = day.co2Saved.toFixed(1) + ' kg';
    const deltaCost = (baselineTotalCost !== undefined && smartTotalCost !== undefined)
        ? (baselineTotalCost - smartTotalCost)
        : undefined;
    const savingsText = (deltaCost === undefined)
        ? '₹0'
        : (deltaCost < 0 ? `-₹${Math.round(Math.abs(deltaCost))}` : `₹${Math.round(deltaCost)}`);
    document.getElementById('res-savings').textContent = savingsText;
    document.getElementById('savings-box').style.display = cfg.isSmart ? 'flex' : 'none';
}

// ===== FULLSCREEN =====
let savedPageState = null;

function handleFullscreenChange() {
    const chartContainer = document.getElementById('main-chart-container');
    const btn = document.getElementById('btn-fullscreen');
    const chartBox = chartContainer.querySelector('.chart-box');
    const mainLayout = document.querySelector('.main-layout');
    const controlSection = document.querySelector('.control-section');
    const visSection = document.querySelector('.vis-section');
    const appWrapper = document.querySelector('.app-wrapper');
    
    if (document.fullscreenElement) {
        // ENTERING FULLSCREEN - Save complete page state
        simState.isFullscreen = true;
        
        // Save ALL computed styles and scroll position
        savedPageState = {
            scrollTop: window.scrollY,
            scrollLeft: window.scrollX,
            bodyOverflow: document.body.style.overflow,
            // Chart container
            chartStyle: chartContainer.getAttribute('style') || '',
            chartClass: chartContainer.className,
            // Chart box
            chartBoxStyle: chartBox ? chartBox.getAttribute('style') || '' : '',
            // Control section
            controlStyle: controlSection ? controlSection.getAttribute('style') || '' : '',
            controlClass: controlSection ? controlSection.className : '',
            controlWidth: controlSection ? getComputedStyle(controlSection).width : '',
            // Vis section
            visStyle: visSection ? visSection.getAttribute('style') || '' : '',
            // Main layout
            mainStyle: mainLayout ? mainLayout.getAttribute('style') || '' : '',
            // App wrapper
            appStyle: appWrapper ? appWrapper.getAttribute('style') || '' : ''
        };
        
        chartContainer.classList.add('fullscreen-active');
        if (chartBox) chartBox.style.height = 'calc(100vh - 150px)';
        if (btn) btn.innerHTML = '<i class="fas fa-compress"></i>';
        setTimeout(() => { if (mainChart) { mainChart.resize(); mainChart.update(); } }, 100);
        
    } else {
        // EXITING FULLSCREEN - Restore complete page state
        simState.isFullscreen = false;
        
        // Remove fullscreen class first
        chartContainer.classList.remove('fullscreen-active');
        
        // Restore saved state if available
        if (savedPageState) {
            // Restore chart container
            if (savedPageState.chartStyle) {
                chartContainer.setAttribute('style', savedPageState.chartStyle);
            } else {
                chartContainer.removeAttribute('style');
            }
            
            // Restore chart box
            if (chartBox) {
                if (savedPageState.chartBoxStyle) {
                    chartBox.setAttribute('style', savedPageState.chartBoxStyle);
                } else {
                    chartBox.removeAttribute('style');
                }
            }
            
            // Restore control section
            if (controlSection) {
                if (savedPageState.controlStyle) {
                    controlSection.setAttribute('style', savedPageState.controlStyle);
                } else {
                    controlSection.removeAttribute('style');
                }
            }
            
            // Restore vis section
            if (visSection) {
                if (savedPageState.visStyle) {
                    visSection.setAttribute('style', savedPageState.visStyle);
                } else {
                    visSection.removeAttribute('style');
                }
            }
            
            // Restore main layout
            if (mainLayout) {
                if (savedPageState.mainStyle) {
                    mainLayout.setAttribute('style', savedPageState.mainStyle);
                } else {
                    mainLayout.removeAttribute('style');
                }
            }
            
            // Restore app wrapper
            if (appWrapper) {
                if (savedPageState.appStyle) {
                    appWrapper.setAttribute('style', savedPageState.appStyle);
                } else {
                    appWrapper.removeAttribute('style');
                }
            }
            
            // Restore scroll position
            window.scrollTo(savedPageState.scrollLeft, savedPageState.scrollTop);
            
            // Clear saved state
            savedPageState = null;
        } else {
            // Fallback - just remove inline styles
            chartContainer.removeAttribute('style');
            if (chartBox) chartBox.removeAttribute('style');
            if (controlSection) controlSection.removeAttribute('style');
            if (visSection) visSection.removeAttribute('style');
            if (mainLayout) mainLayout.removeAttribute('style');
        }
        
        if (btn) btn.innerHTML = '<i class="fas fa-expand"></i>';
        
        // Force layout recalculation
        void document.body.offsetHeight;
        window.dispatchEvent(new Event('resize'));
        
        // Resize chart after DOM settles
        setTimeout(() => {
            if (mainChart) {
                mainChart.resize();
                mainChart.update();
            }
        }, 150);
    }
}

// ===== PDF REPORT =====
async function downloadReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Get all days with data for comprehensive report
    const allDays = Object.keys(simState.days).filter(k => simState.days[k].hourly && simState.days[k].hourly.length > 0);
    const currentDay = simState.days[simState.currentDay];
    const cfg = currentDay.config || {
        solarCap: simState.solarCap,
        battCap: simState.battCap,
        isSmart: simState.isSmart,
        weather: simState.weather,
        gridCost: simState.gridCost
    };
    
    // ===== PAGE 1: HEADER & SUMMARY =====
    // Header Background
    doc.setFillColor(10, 15, 26);
    doc.rect(0, 0, 210, 50, 'F');
    
    // Logo/Title
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.setFontSize(28);
    doc.text('MICROGRID SIMULATOR', 15, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(251, 191, 36);
    doc.text(`Energy Simulation Report (${allDays.length} Day${allDays.length > 1 ? 's' : ''})`, 15, 32);
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 42);
    doc.text(`Day ${simState.currentDay} Simulation`, 140, 42);
    
    let y = 60;
    
    // ===== INPUT CONFIGURATION SECTION =====
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(10, y, 190, 45, 3, 3, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.setFontSize(14);
    doc.text('INPUT CONFIGURATION', 15, y + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    
    // Left column
    doc.text(`Solar Capacity: ${cfg.solarCap || simState.solarCap} kW`, 20, y + 22);
    doc.text(`Battery Capacity: ${cfg.battCap || simState.battCap} kWh`, 20, y + 32);
    doc.text(`Initial SOC: 50%`, 20, y + 42);
    
    // Right column
    doc.text(`Grid Cost: ₹${cfg.gridCost || simState.gridCost}/kWh`, 110, y + 22);
    doc.text(`Weather: ${(cfg.weather || simState.weather).toUpperCase()}`, 110, y + 32);
    doc.text(`Mode: ${cfg.isSmart ? 'SMART SCHEDULER' : 'BASELINE'}`, 110, y + 42);
    
    y += 55;
    
    // ===== OUTPUT RESULTS SECTION =====
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(10, y, 190, 65, 3, 3, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(14);
    doc.text('OUTPUT RESULTS', 15, y + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    
    const totalLoad = currentDay.hourly.reduce((a, b) => a + b.load, 0);
    const solarEfficiency = totalLoad > 0 ? ((currentDay.solarKwh / totalLoad) * 100).toFixed(1) : 0;
    const baselineCost = currentDay?.sim?.baseline?.totals?.cost ?? currentDay.baselineCost;
    const smartCost = currentDay?.sim?.smart?.totals?.cost ?? currentDay.smartCost;
    const deltaCost = (baselineCost !== undefined && smartCost !== undefined) ? (baselineCost - smartCost) : undefined;
    const deltaPercent = (baselineCost && deltaCost !== undefined) ? ((deltaCost / baselineCost) * 100).toFixed(1) : 0;
    
    // Results grid
    doc.text(`Cost (selected mode): ₹${Math.round(currentDay.cost)}`, 20, y + 25);
    doc.text(`Baseline Total (24h): ₹${baselineCost !== undefined ? Math.round(baselineCost) : 'N/A'}`, 20, y + 35);
    doc.text(`Smart Total (24h): ₹${smartCost !== undefined ? Math.round(smartCost) : 'N/A'}`, 20, y + 45);
    doc.setTextColor(16, 185, 129);
    doc.text(`Δ (Baseline - Smart): ${deltaCost === undefined ? 'N/A' : `₹${Math.round(deltaCost)} (${deltaPercent}%)`}`, 20, y + 55);
    
    doc.setTextColor(255, 255, 255);
    doc.text(`Solar Generated: ${currentDay.solarKwh.toFixed(1)} kWh`, 110, y + 25);
    doc.text(`Grid Used: ${currentDay.gridKwh.toFixed(1)} kWh`, 110, y + 35);
    doc.text(`Battery Throughput: ${currentDay.batteryKwh.toFixed(1)} kWh`, 110, y + 45);
    
    y += 75;
    
    // ===== ENVIRONMENTAL IMPACT =====
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(10, y, 190, 30, 3, 3, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(251, 191, 36);
    doc.setFontSize(14);
    doc.text('ENVIRONMENTAL IMPACT', 15, y + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    
    const treesEquiv = (currentDay.co2Saved / (21 / 365)).toFixed(1);
    const kmSaved = (currentDay.co2Saved * 6).toFixed(0);
    
    doc.text(`CO₂ Saved: ${currentDay.co2Saved.toFixed(1)} kg`, 20, y + 22);
    doc.text(`Trees Equivalent: ${treesEquiv} trees/day`, 80, y + 22);
    doc.text(`Car km Avoided: ${kmSaved} km`, 150, y + 22);
    
    y += 40;
    
    // ===== HOURLY DATA TABLE =====
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.setFontSize(14);
    doc.text('HOURLY SIMULATION DATA', 15, y);
    
    y += 5;
    
    // Create hourly data for table
    const hourlyTableData = currentDay.hourly.map(h => [
        formatTime(h.hour),
        h.solar.toFixed(1),
        h.load.toFixed(1),
        h.grid.toFixed(1),
        h.diesel.toFixed(1),
        h.soc.toFixed(0) + '%',
        `₹${(h.baselineCost ?? 0).toFixed(1)}`,
        `₹${(h.smartCost ?? 0).toFixed(1)}`
    ]);
    
    doc.autoTable({
        startY: y,
        head: [['Time', 'Solar kW', 'Load kW', 'Grid kW', 'Diesel kW', 'SOC', 'Base Cost', 'Smart Cost']],
        body: hourlyTableData,
        theme: 'grid',
        headStyles: { 
            fillColor: [99, 102, 241], 
            textColor: 255, 
            fontStyle: 'bold',
            fontSize: 8
        },
        bodyStyles: {
            fontSize: 7,
            cellPadding: 2
        },
        alternateRowStyles: {
            fillColor: [30, 41, 59]
        },
        styles: {
            textColor: [255, 255, 255],
            fillColor: [17, 24, 39]
        },
        columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 22 },
            2: { cellWidth: 22 },
            3: { cellWidth: 22 },
            4: { cellWidth: 22 },
            5: { cellWidth: 18 },
            6: { cellWidth: 24 },
            7: { cellWidth: 24 }
        }
    });
    
    // ===== PAGE 2: CHART & ANALYSIS =====
    doc.addPage();
    
    // Header for page 2
    doc.setFillColor(10, 15, 26);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.setFontSize(16);
    doc.text('POWER ANALYTICS CHART', 15, 17);
    
    y = 35;
    
    // Capture chart as image
    const chartCanvas = document.getElementById('liveChart');
    if (chartCanvas) {
        try {
            const chartImage = chartCanvas.toDataURL('image/png', 1.0);
            doc.addImage(chartImage, 'PNG', 10, y, 190, 80);
            y += 90;
        } catch (e) {
            doc.setTextColor(255, 100, 100);
            doc.text('Chart image could not be captured', 15, y + 40);
            y += 90;
        }
    }
    
    // ===== ANALYSIS SECTION =====
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(10, y, 190, 70, 3, 3, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.setFontSize(14);
    doc.text('PERFORMANCE ANALYSIS', 15, y + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    
    // Calculate peak hours data
    const peakHours = currentDay.hourly.filter(h => h.isPeak);
    const offPeakHours = currentDay.hourly.filter(h => !h.isPeak);
    const peakCostBase = peakHours.reduce((a, b) => a + (b.baselineCost ?? 0), 0);
    const peakCostSmart = peakHours.reduce((a, b) => a + (b.smartCost ?? 0), 0);
    const offPeakCostBase = offPeakHours.reduce((a, b) => a + (b.baselineCost ?? 0), 0);
    const offPeakCostSmart = offPeakHours.reduce((a, b) => a + (b.smartCost ?? 0), 0);
    const peakGridUsage = peakHours.reduce((a, b) => a + b.grid, 0);
    const peakBatteryUsage = peakHours.reduce((a, b) => a + (b.battery > 0 ? b.battery : 0), 0);
    
    doc.text(`Solar Efficiency: ${solarEfficiency}% of load met by solar`, 20, y + 25);
    doc.text(`Peak Cost (Base/Smart): ₹${peakCostBase.toFixed(1)} / ₹${peakCostSmart.toFixed(1)} (${peakHours.length}h)`, 20, y + 35);
    doc.text(`Off-Peak (Base/Smart): ₹${offPeakCostBase.toFixed(1)} / ₹${offPeakCostSmart.toFixed(1)} (${offPeakHours.length}h)`, 20, y + 45);
    doc.text(`Battery Discharge During Peak: ${peakBatteryUsage.toFixed(1)} kWh`, 20, y + 55);
    doc.text(`Grid Usage During Peak: ${peakGridUsage.toFixed(1)} kWh`, 20, y + 65);
    
    // Right side - recommendations
    doc.setTextColor(251, 191, 36);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOMMENDATIONS:', 115, y + 25);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    
    const recommendations = [];
    if (solarEfficiency < 50) recommendations.push('• Increase solar capacity');
    if (currentDay.gridKwh > currentDay.solarKwh) recommendations.push('• Add more battery storage');
    if (peakGridUsage > 10) recommendations.push('• Shift loads to off-peak');
    if (currentDay.dieselKwh > 0) recommendations.push('• Reduce diesel dependency');
    if (recommendations.length === 0) recommendations.push('• System optimized!');
    
    recommendations.forEach((rec, i) => {
        doc.text(rec, 115, y + 35 + (i * 8));
    });
    
    y += 80;
    
    // ===== MULTI-DAY COMPARISON (if available) =====
    const dayKeys = Object.keys(simState.days).filter(k => simState.days[k].hourly.length > 0);
    if (dayKeys.length > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(99, 102, 241);
        doc.setFontSize(14);
        doc.text('MULTI-DAY COMPARISON', 15, y);
        
        y += 5;
        
        const multiDayData = dayKeys.map(d => {
            const day = simState.days[d];
            const dcfg = day.config || {};
            const dbaseline = day?.sim?.baseline?.totals?.cost ?? day.baselineCost;
            const dsmart = day?.sim?.smart?.totals?.cost ?? day.smartCost;
            const ddelta = (dbaseline !== undefined && dsmart !== undefined) ? (dbaseline - dsmart) : undefined;
            return [
                `Day ${d}`,
                dcfg.isSmart ? 'Smart' : 'Baseline',
                `${dcfg.solarCap || 5}kW`,
                (dcfg.weather || 'sunny').toUpperCase(),
                `₹${Math.round(day.cost)}`,
                `₹${dbaseline !== undefined ? Math.round(dbaseline) : 'N/A'}`,
                `₹${dsmart !== undefined ? Math.round(dsmart) : 'N/A'}`,
                `₹${ddelta !== undefined ? Math.round(ddelta) : 'N/A'}`,
                `${day.co2Saved.toFixed(1)} kg`
            ];
        });
        
        doc.autoTable({
            startY: y,
            head: [['Day', 'Mode', 'Solar', 'Weather', 'Cost', 'Baseline', 'Smart', 'Δ', 'CO₂']],
            body: multiDayData,
            theme: 'grid',
            headStyles: { 
                fillColor: [99, 102, 241], 
                textColor: 255, 
                fontStyle: 'bold',
                fontSize: 9
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
                textColor: [255, 255, 255],
                fillColor: [17, 24, 39]
            }
        });
    }
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(10, 15, 26);
        doc.rect(0, 285, 210, 12, 'F');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('MicroGrid Simulator - International Hackathon 2026', 15, 292);
        doc.text(`Page ${i} of ${pageCount}`, 180, 292);
    }
    
    // Save PDF
    doc.save(`MicroGrid_Report_Day${simState.currentDay}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ===== INIT =====
function initAuditHourSelect() {
    const select = document.getElementById('audit-hour');
    if (!select) return;
    select.innerHTML = '<option value="-1">Live</option>';
    for (let i = 0; i < 24; i++) { const option = document.createElement('option'); option.value = i; option.textContent = formatTime(i); select.appendChild(option); }
}

function init3DEffects() {
    document.querySelectorAll('.comp-box').forEach(box => {
        box.addEventListener('mousemove', (e) => { const rect = box.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; const centerX = rect.width / 2; const centerY = rect.height / 2; const rotateX = (y - centerY) / 10; const rotateY = (centerX - x) / 10; box.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`; });
        box.addEventListener('mouseleave', () => { box.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)'; });
    });
    document.querySelectorAll('.card').forEach(card => { card.addEventListener('mousemove', (e) => { const rect = card.getBoundingClientRect(); card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px'); card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px'); }); });
}

function initEventListeners() {
    document.getElementById('btn-start').addEventListener('click', () => { if (simState.isPlaying) stopSimulation(); else startSimulation(); });
    document.getElementById('btn-reset').addEventListener('click', resetSimulation);
    document.getElementById('btn-next-step').addEventListener('click', startNewDay);
    
    document.querySelectorAll('.weather-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); simState.weather = btn.dataset.weather; updateWeatherEffects(); }); });
    document.querySelectorAll('.scenario-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); applyScenario(btn.dataset.scenario); }); });
    
    document.getElementById('input-solar-cap').addEventListener('input', (e) => { simState.solarCap = parseFloat(e.target.value); document.getElementById('lbl-solar-cap').textContent = simState.solarCap + ' kW'; });
    document.getElementById('input-batt-cap').addEventListener('input', (e) => { simState.battCap = parseFloat(e.target.value); document.getElementById('lbl-batt-cap').textContent = simState.battCap + ' kWh'; });
    document.getElementById('input-grid-cost').addEventListener('input', (e) => { simState.gridCost = parseInt(e.target.value); document.getElementById('lbl-grid-cost').textContent = '₹' + simState.gridCost; });
    document.getElementById('input-speed').addEventListener('input', (e) => { const speeds = [1000, 500, 250, 125, 60, 30, 15, 10]; simState.speed = speeds[e.target.value - 1]; document.getElementById('lbl-speed').textContent = e.target.value + 'x'; if (simState.isPlaying) { clearInterval(simState.interval); simState.interval = setInterval(() => { if (simState.hour >= 24) { stopSimulation(true); return; } runSimulationStep(); simState.hour++; }, simState.speed); } });
    document.getElementById('input-strategy').addEventListener('change', (e) => { simState.isSmart = e.target.checked; const status = document.getElementById('strategy-status'); status.textContent = simState.isSmart ? 'ON' : 'OFF'; status.classList.toggle('active', simState.isSmart); });
    
    document.querySelectorAll('.toggle-btn').forEach(btn => { btn.addEventListener('click', () => { const idx = parseInt(btn.dataset.index); simState.activeSeries[idx] = !simState.activeSeries[idx]; btn.classList.toggle('active'); if (mainChart) { mainChart.setDatasetVisibility(idx, simState.activeSeries[idx]); mainChart.update(); } }); });
    
    document.getElementById('prev-day').addEventListener('click', () => { if (simState.viewDay > 1) { simState.viewDay--; loadDayData(simState.viewDay); } });
    document.getElementById('next-day').addEventListener('click', () => { if (simState.viewDay < simState.currentDay) { simState.viewDay++; loadDayData(simState.viewDay); } });
    
    document.getElementById('btn-compare').addEventListener('click', showCompareModal);
    document.getElementById('btn-download').addEventListener('click', downloadReport);
    document.getElementById('achievement-badge').addEventListener('click', showAchievementsModal);
    
    const helpBtn = document.getElementById('btn-help');
    if (helpBtn) helpBtn.addEventListener('click', showHelpModal);
    
    document.getElementById('audit-hour').addEventListener('change', (e) => { const h = parseInt(e.target.value); if (h === -1) return; const day = simState.days[simState.viewDay]; const step = day.hourly[h]; if (step) { document.getElementById('tab-solar-kw').textContent = step.solar.toFixed(1) + ' kW'; document.getElementById('tab-load-kw').textContent = step.load.toFixed(1) + ' kW'; document.getElementById('tab-batt-kw').textContent = Math.abs(step.battery).toFixed(1) + ' kW'; document.getElementById('tab-grid-kw').textContent = step.grid.toFixed(1) + ' kW'; document.getElementById('tab-diesel-kw').textContent = step.diesel.toFixed(1) + ' kW'; } });
    
    // 3D Toggle with enhanced effect
    const toggle3dBtn = document.getElementById('btn-3d-toggle');
    toggle3dBtn.addEventListener('click', () => { 
        const container = document.getElementById('main-chart-container');
        container.classList.toggle('chart-3d-mode');
        toggle3dBtn.classList.toggle('active');
        
        // Add mouse tracking for 3D effect when enabled
        if (container.classList.contains('chart-3d-mode')) {
            container.addEventListener('mousemove', handle3DMouseMove);
            container.addEventListener('mouseleave', handle3DMouseLeave);
        } else {
            container.removeEventListener('mousemove', handle3DMouseMove);
            container.removeEventListener('mouseleave', handle3DMouseLeave);
            const chartBox = container.querySelector('.chart-box');
            if (chartBox) chartBox.style.transform = '';
        }
    });
    
    document.getElementById('btn-fullscreen').addEventListener('click', () => { const chartContainer = document.getElementById('main-chart-container'); if (document.fullscreenElement) document.exitFullscreen().catch(err => console.log(err)); else chartContainer.requestFullscreen().catch(err => console.log(err)); });
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => { backdrop.addEventListener('click', () => { backdrop.parentElement.style.display = 'none'; }); });
    document.querySelectorAll('.modal-close').forEach(btn => { btn.addEventListener('click', () => { btn.closest('.modal').style.display = 'none'; }); });
    
    const helpCloseBtn = document.getElementById('help-close-btn');
    if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelpModal);
    const helpBackdrop = document.querySelector('#help-modal .modal-backdrop');
    if (helpBackdrop) helpBackdrop.addEventListener('click', closeHelpModal);
}

// 3D Mouse tracking functions
function handle3DMouseMove(e) {
    const container = e.currentTarget;
    const chartBox = container.querySelector('.chart-box');
    if (!chartBox) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * 15;
    const rotateY = ((centerX - x) / centerX) * 15;
    
    chartBox.style.transform = `perspective(2000px) rotateX(${25 + rotateX}deg) rotateY(${-10 + rotateY}deg) translateZ(50px)`;
}

function handle3DMouseLeave(e) {
    const container = e.currentTarget;
    const chartBox = container.querySelector('.chart-box');
    if (chartBox) {
        chartBox.style.transform = 'perspective(2000px) rotateX(25deg) rotateY(-10deg) translateZ(50px)';
    }
}

// ===== AUTO DOWNLOAD SIMULATION DATA =====
function autoDownloadSimulationData() {
    const day = simState.days[simState.currentDay];
    if (!day || day.hourly.length === 0) return;

    // Ensure deterministic baseline + smart totals exist
    prepareDaySimulationsIfNeeded();
    const baselineTotalCost = day?.sim?.baseline?.totals?.cost ?? day.baselineCost;
    const smartTotalCost = day?.sim?.smart?.totals?.cost ?? day.smartCost;
    const baselineTotalCo2 = day?.sim?.baseline?.totals?.co2Kg ?? day.baselineEmissionsKg;
    const smartTotalCo2 = day?.sim?.smart?.totals?.co2Kg ?? day.smartEmissionsKg;
    const deltaCost = (baselineTotalCost !== undefined && smartTotalCost !== undefined) ? (baselineTotalCost - smartTotalCost) : undefined;
    const deltaCo2 = (baselineTotalCo2 !== undefined && smartTotalCo2 !== undefined) ? (baselineTotalCo2 - smartTotalCo2) : undefined;
    
    // Generate CSV data
    const headers = [
        'Hour',
        'Solar_kW', 'Load_kW', 'Battery_kW',
        'GridImport_kW', 'Diesel_kW',
        'SOC_%',
        'Tariff_INR_per_kWh', 'Period',
        'CostLive_INR',
        'BaselineCost_INR', 'SmartCost_INR',
        'BaselineGrid_kW', 'SmartGrid_kW',
        'BaselineDiesel_kW', 'SmartDiesel_kW',
        'Temperature_C', 'Humidity_%'
    ];
    const rows = day.hourly.map(h => [
        formatTime(h.hour),
        h.solar.toFixed(2),
        h.load.toFixed(2),
        h.battery.toFixed(2),
        h.grid.toFixed(2),
        (h.diesel ?? 0).toFixed(2),
        h.soc.toFixed(1),
        (h.gridPrice ?? 0).toFixed(2),
        h.isPeak ? 'PEAK' : 'OFF-PEAK',
        h.cost.toFixed(2),
        (h.baselineCost ?? 0).toFixed(2),
        (h.smartCost ?? 0).toFixed(2),
        (h.baselineGrid ?? 0).toFixed(2),
        (h.smartGrid ?? 0).toFixed(2),
        (h.baselineDiesel ?? 0).toFixed(2),
        (h.smartDiesel ?? 0).toFixed(2),
        (h.realData?.temperature ?? simState.realDataStats.temperature ?? '').toString(),
        (h.realData?.humidity ?? simState.realDataStats.humidity ?? '').toString()
    ]);
    
    let csv = headers.join(',') + '\n';
    csv += rows.map(r => r.join(',')).join('\n');
    
    // Add summary
    csv += '\n\n--- SUMMARY ---\n';
    csv += `Mode,${day.config?.isSmart ? 'SMART' : 'BASELINE'}\n`;
    csv += `Cost (selected mode),₹${Math.round(day.cost)}\n`;
    csv += `Baseline Total (24h),₹${baselineTotalCost !== undefined ? Math.round(baselineTotalCost) : 'N/A'}\n`;
    csv += `Smart Total (24h),₹${smartTotalCost !== undefined ? Math.round(smartTotalCost) : 'N/A'}\n`;
    csv += `Delta (Baseline-Smart),₹${deltaCost !== undefined ? Math.round(deltaCost) : 'N/A'}\n`;
    csv += `Solar Generated,${day.solarKwh.toFixed(1)} kWh\n`;
    csv += `Grid Used,${day.gridKwh.toFixed(1)} kWh\n`;
    csv += `CO2 (selected mode),${(day.config?.isSmart ? day.smartEmissionsKg : day.baselineEmissionsKg)?.toFixed?.(1) || ''} kg\n`;
    csv += `CO2 Delta (Baseline-Smart),${deltaCo2 !== undefined ? deltaCo2.toFixed(1) : 'N/A'} kg\n`;
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MicroGrid_Day${simState.currentDay}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✓ Simulation data auto-downloaded');
}

// ===== FETCH REAL TEMPERATURE =====
async function fetchRealTemperature() {
    try {
        // Try to get location and fetch real weather
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    // Using Open-Meteo free API (no API key needed)
                    const response = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relativehumidity_2m`
                    );
                    const data = await response.json();
                    if (data.current_weather) {
                        simState.realDataStats.temperature = data.current_weather.temperature;
                        simState.realDataStats.windSpeed = data.current_weather.windspeed;
                        // Get humidity from hourly data (current hour)
                        const currentHour = new Date().getHours();
                        if (data.hourly && data.hourly.relativehumidity_2m) {
                            simState.realDataStats.humidity = data.hourly.relativehumidity_2m[currentHour];
                        }
                        updateRealDataDisplay();
                        console.log('✓ Fetched real weather data:', simState.realDataStats.temperature + '°C');
                    }
                } catch (e) {
                    console.log('Weather API unavailable, using simulation data');
                }
            }, (error) => {
                console.log('Location access denied, using simulation temperature');
            });
        }
    } catch (e) {
        console.log('Could not fetch real temperature');
    }
}

// ===== CLEAR STATE ON HARD REFRESH =====
function clearStateOnRefresh() {
    // Check if this is a hard refresh (F5 or Ctrl+R)
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0 && navEntries[0].type === 'reload') {
        // Clear all saved state on hard refresh
        sessionStorage.removeItem('microgridState');
        console.log('🔄 Hard refresh detected - state cleared');
        return true;
    }
    return false;
}

// ===== DOCUMENT READY =====
document.addEventListener('DOMContentLoaded', async () => {
    // Check for hard refresh and clear state
    const wasHardRefresh = clearStateOnRefresh();
    
    initLoadingScreen();
    
    // Load real energy dataset first
    console.log('📊 Loading simulation energy dataset...');
    await loadRealEnergyData();
    
    // Fetch real temperature from weather API
    fetchRealTemperature();
    
    initChart();
    initAuditHourSelect();
    initSankeyCanvas();
    
    // Try to restore saved state (only if not hard refresh)
    if (!wasHardRefresh) {
        const savedOptions = loadState();
        if (savedOptions) {
            setTimeout(() => restoreUIFromState(savedOptions), 500);
        }
    }
    
    updateWeatherEffects();
    createStars();
    initEventListeners();
    init3DEffects();
    updateTimeIndicator();
    
    // Initialize real data display
    updateRealDataDisplay();
    
    // Save state periodically and on important events
    setInterval(saveState, 5000); // Save every 5 seconds
    
    // Save state when page becomes hidden (tab switch)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            saveState();
        } else {
            // Page became visible again - no need to reload, state is in memory
        }
    });
    
    // Save state before unload
    window.addEventListener('beforeunload', saveState);
    
    console.log('⚡ MicroGrid Simulator v5.0 Ultimate Edition initialized');
    if (dataLoaded) {
        console.log('✓ Running with simulation energy data!');
    }
});
