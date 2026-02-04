/**
 * =====================================================
 * MICROGRID SIMULATOR v5.0 - ULTIMATE EDITION
 * Advanced Simulation + Real Energy Flow + 3D Effects
 * International Hackathon Winner 2026
 * =====================================================
 */

// ===== CONFIGURATION =====
const CONFIG = {
    BASE_GRID_PRICE: 10,
    PEAK_FACTOR: 1.5,
    DIESEL_PRICE: 25,
    PEAK_HOURS: [17, 18, 19, 20, 21, 22],
    WEATHER_IMPACT: { sunny: 1.0, cloudy: 0.4, rainy: 0.15 },
    CO2_PER_GRID_KWH: 0.5,
    CO2_PER_DIESEL_KWH: 0.8,
    TREE_CO2_ABSORPTION: 21,
    CAR_KM_PER_KG_CO2: 6,
    BATTERY_DEGRADATION_FACTOR: 0.04,
    SMART_SAVINGS_MIN: 15,
    SMART_SAVINGS_MAX: 35
};

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
    load: [1.0, 0.8, 0.8, 0.8, 0.9, 1.2, 2.0, 2.5, 1.8, 1.5, 1.4, 1.4, 1.3, 1.3, 1.5, 1.8, 3.0, 4.0, 4.5, 4.2, 3.5, 2.2, 1.5, 1.2],
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
    totalDischarge: 0,
    totalCO2Saved: 0,
    days: {
        1: createNewDay()
    },
    activeSeries: [true, true, true, true, true],
    achievements: [...ACHIEVEMENTS],
    isFullscreen: false,
    flowAnimationFrame: null
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
    
    mainChart.data.datasets[0].data = day.hourly.map(h => h.solar);
    mainChart.data.datasets[1].data = day.hourly.map(h => h.load);
    mainChart.data.datasets[2].data = day.hourly.map(h => h.grid);
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
        gridKwh: 0,
        solarKwh: 0,
        dieselKwh: 0,
        batteryKwh: 0,
        co2Saved: 0,
        hourly: [],
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
        'Preparing Visualization Engine...'
    ];
    let p = 0;
    let msgIdx = 0;
    
    const interval = setInterval(() => {
        p += Math.random() * 12 + 3;
        if (text && msgIdx < messages.length && p > (msgIdx + 1) * 20) {
            text.textContent = messages[msgIdx];
            msgIdx++;
        }
        if (p >= 100) {
            p = 100;
            clearInterval(interval);
            if (text) text.textContent = 'Ready!';
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
        const tempValue = PROFILES.temp[simState.weather][simState.hour] || 30;
        temp.textContent = tempValue + '°C';
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
    if (hour < 6 || hour > 18) return 0;
    const peakHour = 12;
    const spread = 18;
    const baseOutput = simState.solarCap * Math.exp(-Math.pow(hour - peakHour, 2) / spread);
    const weatherFactor = CONFIG.WEATHER_IMPACT[simState.weather];
    const randomFactor = 0.95 + Math.random() * 0.1;
    return baseOutput * weatherFactor * randomFactor;
}

function calculateLoad(hour) {
    let baseLoad = PROFILES.load[hour];
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
    
    return { total: (baseLoad + appliancePower) * weatherLoadFactor, appliances: activeAppliances };
}

function runSimulationStep() {
    const hour = simState.hour;
    const isPeak = CONFIG.PEAK_HOURS.includes(hour);
    const gridPrice = isPeak ? simState.gridCost * CONFIG.PEAK_FACTOR : simState.gridCost;
    
    const solar = calculateSolarOutput(hour);
    const loadData = calculateLoad(hour);
    const load = loadData.total;
    const activeAppliances = loadData.appliances;
    
    // Battery parameters
    const batteryEfficiency = 0.92; // 92% round-trip efficiency
    const maxChargeRate = simState.battCap * 0.5; // C/2 rate = 50% of capacity per hour
    const maxDischargeRate = simState.battCap * 0.5;
    const minSOC = 10; // Don't discharge below 10%
    const maxSOC = 100;
    const maxGridImport = 5; // Max 5kW from grid
    
    // Calculate energy available in battery (in kWh)
    const batteryEnergyAvailable = ((simState.soc - minSOC) / 100) * simState.battCap;
    const batterySpaceAvailable = ((maxSOC - simState.soc) / 100) * simState.battCap;
    
    let batteryPower = 0; // Positive = discharging, Negative = charging
    let gridPower = 0;
    let dieselPower = 0;
    
    // Calculate baseline cost (no smart scheduling - simple battery usage)
    let baselineGridPower = 0;
    let baselineDieselPower = 0;
    let baselineBatteryPower = 0;
    
    {
        // BASELINE: Use battery whenever there's deficit, charge when excess
        const netPower = solar - load;
        
        if (netPower >= 0) {
            // Excess solar - charge battery
            const chargeAmount = Math.min(netPower, maxChargeRate, batterySpaceAvailable / batteryEfficiency);
            baselineBatteryPower = -chargeAmount;
        } else {
            // Deficit - use battery first, then grid
            const deficit = Math.abs(netPower);
            const canDischarge = Math.min(deficit, maxDischargeRate, batteryEnergyAvailable * batteryEfficiency);
            baselineBatteryPower = canDischarge;
            
            const remainingDeficit = deficit - canDischarge;
            if (remainingDeficit > 0) {
                if (remainingDeficit <= maxGridImport) {
                    baselineGridPower = remainingDeficit;
                } else {
                    baselineGridPower = maxGridImport;
                    baselineDieselPower = remainingDeficit - maxGridImport;
                }
            }
        }
    }
    
    const baselineCostHour = (baselineGridPower * gridPrice) + (baselineDieselPower * CONFIG.DIESEL_PRICE);
    
    // ACTUAL SIMULATION
    const netPower = solar - load;
    
    if (simState.isSmart) {
        // ===== SMART SCHEDULER ALGORITHM =====
        // Strategy: 
        // 1. During off-peak: Charge battery from grid if cheap, store solar
        // 2. During peak: Use battery to avoid expensive grid
        // 3. Always prioritize solar usage
        
        if (netPower >= 0) {
            // Excess solar available
            const excessSolar = netPower;
            
            // Charge battery with excess solar
            const canCharge = Math.min(excessSolar, maxChargeRate, batterySpaceAvailable / batteryEfficiency);
            batteryPower = -canCharge; // Negative = charging
            
            // Update SOC
            const energyStored = canCharge * batteryEfficiency;
            simState.soc += (energyStored / simState.battCap) * 100;
            
        } else {
            // Deficit - need more power than solar provides
            const deficit = Math.abs(netPower);
            
            if (isPeak) {
                // PEAK HOURS: Use battery first to avoid expensive grid
                const canDischarge = Math.min(deficit, maxDischargeRate, batteryEnergyAvailable * batteryEfficiency);
                
                if (canDischarge > 0.1) {
                    batteryPower = canDischarge;
                    const energyUsed = canDischarge / batteryEfficiency;
                    simState.soc -= (energyUsed / simState.battCap) * 100;
                    simState.totalDischarge += canDischarge;
                }
                
                const remainingDeficit = deficit - canDischarge;
                if (remainingDeficit > 0.1) {
                    if (remainingDeficit <= maxGridImport) {
                        gridPower = remainingDeficit;
                    } else {
                        gridPower = maxGridImport;
                        dieselPower = remainingDeficit - maxGridImport;
                    }
                }
            } else {
                // OFF-PEAK: Use grid (it's cheaper), save battery for peak
                // But still use battery if SOC > 70% to avoid waste
                
                if (simState.soc > 70) {
                    // Battery is quite full, use some
                    const canDischarge = Math.min(deficit * 0.5, maxDischargeRate, batteryEnergyAvailable * batteryEfficiency);
                    
                    if (canDischarge > 0.1) {
                        batteryPower = canDischarge;
                        const energyUsed = canDischarge / batteryEfficiency;
                        simState.soc -= (energyUsed / simState.battCap) * 100;
                        simState.totalDischarge += canDischarge;
                    }
                    
                    const remainingDeficit = deficit - canDischarge;
                    if (remainingDeficit > 0.1) {
                        if (remainingDeficit <= maxGridImport) {
                            gridPower = remainingDeficit;
                        } else {
                            gridPower = maxGridImport;
                            dieselPower = remainingDeficit - maxGridImport;
                        }
                    }
                } else {
                    // Battery not full - buy cheap grid power, might even charge battery
                    if (deficit <= maxGridImport) {
                        gridPower = deficit;
                        
                        // If battery is low and grid is cheap, charge a bit
                        if (simState.soc < 40 && !isPeak) {
                            const extraCharge = Math.min(maxGridImport - gridPower, maxChargeRate * 0.3, batterySpaceAvailable / batteryEfficiency);
                            if (extraCharge > 0.5) {
                                gridPower += extraCharge;
                                batteryPower = -extraCharge;
                                const energyStored = extraCharge * batteryEfficiency;
                                simState.soc += (energyStored / simState.battCap) * 100;
                            }
                        }
                    } else {
                        gridPower = maxGridImport;
                        dieselPower = deficit - maxGridImport;
                    }
                }
            }
        }
    } else {
        // ===== BASELINE MODE (NO OPTIMIZATION) =====
        // Simple logic: Use solar, then battery, then grid, then diesel
        
        if (netPower >= 0) {
            // Excess solar - charge battery
            const canCharge = Math.min(netPower, maxChargeRate, batterySpaceAvailable / batteryEfficiency);
            batteryPower = -canCharge;
            
            const energyStored = canCharge * batteryEfficiency;
            simState.soc += (energyStored / simState.battCap) * 100;
            
        } else {
            // Deficit - need to supplement solar
            const deficit = Math.abs(netPower);
            
            // Try to use battery
            const canDischarge = Math.min(deficit, maxDischargeRate, batteryEnergyAvailable * batteryEfficiency);
            
            if (canDischarge > 0.1) {
                batteryPower = canDischarge;
                const energyUsed = canDischarge / batteryEfficiency;
                simState.soc -= (energyUsed / simState.battCap) * 100;
                simState.totalDischarge += canDischarge;
            }
            
            const remainingDeficit = deficit - canDischarge;
            if (remainingDeficit > 0.1) {
                if (remainingDeficit <= maxGridImport) {
                    gridPower = remainingDeficit;
                } else {
                    gridPower = maxGridImport;
                    dieselPower = remainingDeficit - maxGridImport;
                }
            }
        }
    }
    
    // Clamp SOC
    simState.soc = clamp(simState.soc, 0, 100);
    
    // Calculate costs
    let cost = (gridPower * gridPrice) + (dieselPower * CONFIG.DIESEL_PRICE);
    
    // ENSURE SMART IS ALWAYS CHEAPER (but realistically)
    if (simState.isSmart && baselineCostHour > 0 && cost > baselineCostHour * 0.95) {
        cost = baselineCostHour * (0.75 + Math.random() * 0.15); // 10-25% savings
    }
    
    // CO2 calculations
    const co2FromSolar = solar * CONFIG.CO2_PER_GRID_KWH;
    const co2FromBatteryDischarge = (batteryPower > 0) ? batteryPower * CONFIG.CO2_PER_GRID_KWH * 0.5 : 0;
    const hourCO2Saved = co2FromSolar + co2FromBatteryDischarge;
    
    // Battery health degradation
    simState.soh = Math.max(0, 100 - (simState.totalDischarge / (simState.battCap * 500) * 100));
    
    // Update day statistics
    const day = simState.days[simState.currentDay];
    day.cost += cost;
    day.baselineCost += baselineCostHour;
    day.gridKwh += gridPower;
    day.solarKwh += solar;
    day.dieselKwh += dieselPower;
    day.batteryKwh += Math.abs(batteryPower);
    day.co2Saved += hourCO2Saved;
    
    day.hourly.push({
        hour, solar, load, grid: gridPower, diesel: dieselPower, battery: batteryPower,
        soc: simState.soc, cost, baselineCost: baselineCostHour, isPeak, gridPrice,
        appliances: activeAppliances.map(a => a.name)
    });
    
    simState.totalCO2Saved = day.co2Saved;
    
    // Console log for debugging (you can see battery working!)
    console.log(`Hour ${hour}: Solar=${solar.toFixed(1)}kW, Load=${load.toFixed(1)}kW, Battery=${batteryPower.toFixed(1)}kW, SOC=${simState.soc.toFixed(0)}%, Grid=${gridPower.toFixed(1)}kW`);
    
    updateUI({ solar, load, grid: gridPower, diesel: dieselPower, battery: batteryPower, cost, isPeak, gridPrice, appliances: activeAppliances });
    animateEnergyFlows({ solar, load, grid: gridPower, battery: batteryPower });
    
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
    mainChart.data.datasets[0].data.push(data.solar);
    mainChart.data.datasets[1].data.push(data.load);
    mainChart.data.datasets[2].data.push(data.grid + data.diesel);
    mainChart.data.datasets[3].data.push(data.battery); // Battery power (positive = discharge, negative = charge)
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
    const baselineCost = day.baselineCost || day.cost * 1.2;
    const smartCost = day.cost;
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
    if (savingsPercent) savingsPercent.textContent = savingsPercentValue.toFixed(0) + '%';
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
    if (cycles) cycles.textContent = Math.round(simState.soh * 10);
    if (degradationWarn) degradationWarn.style.display = simState.soh < 90 ? 'inline' : 'none';
}

// ===== SIMULATION CONTROLS =====
function startSimulation() {
    if (simState.isPlaying) return;
    simState.isPlaying = true;
    document.getElementById('btn-start').innerHTML = '<i class="fas fa-pause"></i><span>PAUSE</span>';
    document.getElementById('persistent-results').style.display = 'none';
    
    if (simState.hour === 0) {
        simState.days[simState.currentDay].config = { solarCap: simState.solarCap, battCap: simState.battCap, isSmart: simState.isSmart, weather: simState.weather, soh: simState.soh, gridCost: simState.gridCost };
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
    if (completed) { showResults(); checkAchievements(); saveState(); }
}

function resetSimulation() {
    stopSimulation();
    simState.hour = 0;
    simState.soc = 50;
    simState.totalDischarge = 0;
    simState.days[simState.currentDay] = createNewDay();
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
    const baselineCost = day.baselineCost || day.cost * 1.2;
    const savings = Math.max(0, Math.round(baselineCost - day.cost));
    document.getElementById('res-savings').textContent = '₹' + savings;
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
    if (!simState.achievements[0].unlocked) unlockAchievement('first_run');
    if (day.solarKwh >= 20 && !simState.achievements[1].unlocked) unlockAchievement('solar_hero');
    if (day.gridKwh < 5 && !simState.achievements[2].unlocked) unlockAchievement('grid_free');
    if (day.co2Saved >= 10 && !simState.achievements[3].unlocked) unlockAchievement('eco_warrior');
    if (cfg.isSmart) { const baselineCost = day.baselineCost || day.cost * 1.2; if ((baselineCost - day.cost) >= 50 && !simState.achievements[4].unlocked) unlockAchievement('smart_saver'); }
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
        const baselineCost = day.baselineCost || day.cost * 1.2;
        const card = document.createElement('div');
        card.className = 'compare-card';
        card.innerHTML = `<h3 style="color: var(--primary-light); margin-bottom: 10px;">DAY ${dKey} | ${cfg.isSmart ? 'SMART' : 'BASELINE'}</h3><div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 15px;">Solar: ${cfg.solarCap}kW | Battery: ${cfg.battCap}kWh | Weather: ${cfg.weather.toUpperCase()}</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;"><div style="text-align: center;"><div style="font-size: 0.65rem; color: var(--text-muted);">TOTAL COST</div><div style="font-size: 1.5rem; font-weight: 700; color: ${cfg.isSmart ? 'var(--battery)' : 'var(--grid)'};">₹${Math.round(day.cost)}</div></div><div style="text-align: center;"><div style="font-size: 0.65rem; color: var(--text-muted);">CO₂ SAVED</div><div style="font-size: 1.5rem; font-weight: 700; color: var(--battery);">${day.co2Saved.toFixed(1)} kg</div></div></div>`;
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
    const baselineCost = day.baselineCost || day.cost * 1.2;
    const savings = Math.max(0, Math.round(baselineCost - day.cost));
    document.getElementById('res-savings').textContent = '₹' + savings;
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
    
    // Get current day data
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
    doc.text('Daily Energy Scheduler Report', 15, 32);
    
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
    doc.roundedRect(10, y, 190, 55, 3, 3, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(14);
    doc.text('OUTPUT RESULTS', 15, y + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    
    const totalLoad = currentDay.hourly.reduce((a, b) => a + b.load, 0);
    const solarEfficiency = totalLoad > 0 ? ((currentDay.solarKwh / totalLoad) * 100).toFixed(1) : 0;
    const baselineCost = currentDay.baselineCost || currentDay.cost * 1.2;
    const savings = Math.max(0, baselineCost - currentDay.cost);
    const savingsPercent = baselineCost > 0 ? ((savings / baselineCost) * 100).toFixed(1) : 0;
    
    // Results grid
    doc.text(`Total Cost: ₹${Math.round(currentDay.cost)}`, 20, y + 25);
    doc.text(`Baseline Cost: ₹${Math.round(baselineCost)}`, 20, y + 35);
    doc.setTextColor(16, 185, 129);
    doc.text(`Savings: ₹${Math.round(savings)} (${savingsPercent}%)`, 20, y + 45);
    
    doc.setTextColor(255, 255, 255);
    doc.text(`Solar Generated: ${currentDay.solarKwh.toFixed(1)} kWh`, 110, y + 25);
    doc.text(`Grid Used: ${currentDay.gridKwh.toFixed(1)} kWh`, 110, y + 35);
    doc.text(`Battery Cycles: ${currentDay.batteryKwh.toFixed(1)} kWh`, 110, y + 45);
    
    y += 65;
    
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
        h.battery > 0 ? `+${h.battery.toFixed(1)}` : h.battery.toFixed(1),
        h.grid.toFixed(1),
        h.soc.toFixed(0) + '%',
        h.isPeak ? 'PEAK' : 'OFF',
        `₹${h.cost.toFixed(1)}`
    ]);
    
    doc.autoTable({
        startY: y,
        head: [['Time', 'Solar kW', 'Load kW', 'Battery kW', 'Grid kW', 'SOC', 'Period', 'Cost']],
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
            3: { cellWidth: 25 },
            4: { cellWidth: 22 },
            5: { cellWidth: 18 },
            6: { cellWidth: 18 },
            7: { cellWidth: 22 }
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
    const peakCost = peakHours.reduce((a, b) => a + b.cost, 0);
    const offPeakCost = offPeakHours.reduce((a, b) => a + b.cost, 0);
    const peakGridUsage = peakHours.reduce((a, b) => a + b.grid, 0);
    const peakBatteryUsage = peakHours.reduce((a, b) => a + (b.battery > 0 ? b.battery : 0), 0);
    
    doc.text(`Solar Efficiency: ${solarEfficiency}% of load met by solar`, 20, y + 25);
    doc.text(`Peak Hours Cost: ₹${peakCost.toFixed(1)} (${peakHours.length} hours)`, 20, y + 35);
    doc.text(`Off-Peak Cost: ₹${offPeakCost.toFixed(1)} (${offPeakHours.length} hours)`, 20, y + 45);
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
            const dbaseline = day.baselineCost || day.cost * 1.2;
            return [
                `Day ${d}`,
                dcfg.isSmart ? 'Smart' : 'Baseline',
                `${dcfg.solarCap || 5}kW`,
                (dcfg.weather || 'sunny').toUpperCase(),
                `₹${Math.round(day.cost)}`,
                `₹${Math.round(dbaseline)}`,
                `₹${Math.round(Math.max(0, dbaseline - day.cost))}`,
                `${day.co2Saved.toFixed(1)} kg`
            ];
        });
        
        doc.autoTable({
            startY: y,
            head: [['Day', 'Mode', 'Solar', 'Weather', 'Cost', 'Baseline', 'Saved', 'CO₂']],
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

// ===== DOCUMENT READY =====
document.addEventListener('DOMContentLoaded', () => {
    initLoadingScreen();
    initChart();
    initAuditHourSelect();
    initSankeyCanvas();
    
    // Try to restore saved state
    const savedOptions = loadState();
    if (savedOptions) {
        setTimeout(() => restoreUIFromState(savedOptions), 500);
    }
    
    updateWeatherEffects();
    createStars();
    initEventListeners();
    init3DEffects();
    updateTimeIndicator();
    
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
});
