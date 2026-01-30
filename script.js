/**
 * MICROGRID HACKER | ULTRA-ADVANCED SIMULATOR ENGINE v5.0
 * Weather Animations + Dynamic Grid Pricing + Pro Reporting
 */

let BASE_GRID_PRICE = 10;
const PEAK_FACTOR = 1.25; // 25% premium during peak
const DIESEL_PRICE = 25;
const PEAK_HOURS = [17, 18, 19, 20, 21, 22];
const WEATHER_IMPACT = { sunny: 1.0, cloudy: 0.4, rainy: 0.1 };

const appliances = [
    { name: "Coffee Maker", hours: [7, 8], power: 1.5 },
    { name: "Microwave", hours: [12, 13, 20], power: 2.0 },
    { name: "Washing Machine", hours: [10, 11], power: 2.5 },
    { name: "Electric AC", hours: [14, 15, 16, 17, 18], power: 3.5 },
    { name: "Dishwasher", hours: [21, 22], power: 2.0 }
];

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
    days: {
        1: {
            cost: 0, gridKwh: 0, solarKwh: 0, dieselKwh: 0, hourly: [],
            config: { solarCap: 5, battCap: 10, isSmart: false, weather: 'sunny', soh: 100, gridCost: 10 }
        }
    },
    activeSeries: [true, true, true, true]
};

const profiles = {
    load: [1.0, 0.8, 0.8, 0.8, 0.9, 1.2, 2.0, 2.5, 1.8, 1.5, 1.4, 1.4, 1.3, 1.3, 1.5, 1.8, 3.0, 4.0, 4.5, 4.2, 3.5, 2.2, 1.5, 1.2]
};

let mainChart;
function initChart() {
    const ctx = document.getElementById('liveChart').getContext('2d');
    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => i + ":00"),
            datasets: [
                { label: 'Solar (kW)', data: [], borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.1)', fill: true, tension: 0.4 },
                { label: 'Load (kW)', data: [], borderColor: '#ffffff', borderDash: [5, 5], tension: 0.4 },
                { label: 'Grid (kW)', data: [], borderColor: '#ef4444', tension: 0.2 },
                { label: 'SOC (%)', data: [], borderColor: '#10b981', yAxisID: 'y1', tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { title: { display: true, text: 'Power (kW)', color: '#94a3b8', font: { size: 14, weight: 'bold' } }, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                y1: { title: { display: true, text: 'Battery SOC (%)', color: '#10b981', font: { size: 14, weight: 'bold' } }, position: 'right', min: 0, max: 100, grid: { display: false } },
                x: { title: { display: true, text: 'Time of Day (Hours)', color: '#94a3b8', font: { size: 12, weight: 'bold' } }, grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function createRain() {
    const rainLayer = document.getElementById('rain-layer');
    rainLayer.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const drop = document.createElement('div');
        drop.className = 'drop';
        drop.style.left = Math.random() * 100 + "%";
        drop.style.animationDuration = (Math.random() * 0.5 + 0.5) + "s";
        drop.style.animationDelay = Math.random() * 1 + "s";
        rainLayer.appendChild(drop);
    }
}

function createClouds() {
    const cloudLayer = document.getElementById('cloud-layer');
    cloudLayer.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'cloud';
        cloud.style.top = (Math.random() * 60 + 10) + "px";
        cloud.style.animationDuration = (Math.random() * 10 + 10) + "s";
        cloud.style.animationDelay = (Math.random() * 5) + "s";
        cloud.style.opacity = Math.random() * 0.5 + 0.2;
        cloudLayer.appendChild(cloud);
    }
}

function updateWeatherEffects() {
    document.querySelector('.environment-box').className = 'environment-box env-' + simState.weather;
    document.getElementById('rain-layer').classList.toggle('active', simState.weather === 'rainy');
    document.getElementById('cloud-layer').classList.toggle('active', simState.weather === 'cloudy');
    if (simState.weather === 'rainy') createRain();
    if (simState.weather === 'cloudy') createClouds();
}

function runStep() {
    const t = simState.hour;
    const isPeak = PEAK_HOURS.includes(t);
    const gridPrice = isPeak ? simState.gridCost * PEAK_FACTOR : simState.gridCost;

    let appliancePower = 0;
    let activeApp = "Idle";
    appliances.forEach(app => {
        if (app.hours.includes(t)) {
            appliancePower += app.power;
            activeApp = app.name;
        }
    });
    const load = profiles.load[t] + appliancePower;

    let solar = 0;
    if (t >= 6 && t <= 18) {
        solar = simState.solarCap * Math.exp(-Math.pow(t - 12, 2) / 18) * WEATHER_IMPACT[simState.weather];
    }

    let p_grid = 0, p_diesel = 0, p_batt = 0;
    const net = solar - load;
    const eff = 0.9;
    const maxCharge = 3.5;

    if (simState.isSmart) {
        if (net > 0) {
            // Surplus logic: Charge battery
            let canCharge = Math.min(net, maxCharge, (100 - simState.soc) * simState.battCap / 100);
            p_batt = -canCharge;
            simState.soc += (canCharge * eff) / simState.battCap * 100;
        } else {
            const deficit = Math.abs(net);
            // SMART DISCHARGE STRATEGY:
            // 1. Always discharge during PEAK hours (to save max money).
            // 2. Discharge if battery is abundant (>40%) to avoid wasting capacity.
            // 3. Discharge if it's early morning & Sunny (Sun will refill us).
            // ELSE: Buy cheap Grid power to preserve battery for Peak.

            const isAbundant = simState.soc > 20;
            const isSunnyMorning = (simState.weather === 'sunny' && t < 14);

            if (isPeak || isAbundant || isSunnyMorning) {
                // Discharge
                let canDischarge = Math.min(deficit, maxCharge, (simState.soc - 5) * simState.battCap / 100 * eff); // Safety buffer 5%
                p_batt = canDischarge;
                simState.soc -= (canDischarge / eff) / simState.battCap * 100;
                simState.totalDischarge += canDischarge;
                let rem = deficit - canDischarge;
                if (rem > 0) p_grid = rem;
            } else {
                // Buy Grid (Arbitrage: Spend 1x now to save 1.6x later)
                p_grid = deficit;
            }
        }
    } else {
        // BASELINE: Naive Logic (Always use battery if available)
        if (net > 0) {
            let canCharge = Math.min(net, maxCharge, (100 - simState.soc) * simState.battCap / 100);
            p_batt = -canCharge;
            simState.soc += (canCharge * eff) / simState.battCap * 100;
        } else {
            const deficit = Math.abs(net);
            let canDischarge = Math.min(deficit, maxCharge, (simState.soc - 5) * simState.battCap / 100 * eff);
            p_batt = canDischarge;
            simState.soc -= (canDischarge / eff) / simState.battCap * 100;
            simState.totalDischarge += canDischarge;
            let rem = deficit - canDischarge;
            if (rem > 0) p_grid = rem;
        }
    }

    if (p_grid > 3) { p_diesel = p_grid - 3; p_grid = 3; }
    const cost = (p_grid * gridPrice) + (p_diesel * DIESEL_PRICE);
    simState.soh = Math.max(0, 100 - (simState.totalDischarge / simState.battCap * 0.04));

    const day = simState.days[simState.currentDay];
    day.cost += cost;
    day.gridKwh += p_grid;
    day.solarKwh += solar;
    day.dieselKwh += p_diesel;
    day.hourly.push({ t, solar, load, grid: p_grid, diesel: p_diesel, batt: p_batt, soc: simState.soc, app: activeApp });

    updateUI(solar, load, p_grid, p_diesel, p_batt, activeApp);
}

function updateUI(solar, load, grid, diesel, batt, activeApp) {
    const day = simState.days[simState.currentDay];
    document.getElementById('sim-clock').innerText = (simState.hour < 10 ? "0" : "") + simState.hour + ":00";
    document.getElementById('hud-cost').innerText = "₹" + Math.round(day.cost);
    document.getElementById('appliance-tag').innerText = activeApp;

    document.getElementById('val-solar').innerText = solar.toFixed(1) + " kW";
    document.getElementById('val-load').innerText = load.toFixed(1) + " kW";
    document.getElementById('val-soc').innerText = Math.round(simState.soc) + "%";
    document.getElementById('val-grid').innerText = (grid + diesel).toFixed(1) + " kW";

    if (document.getElementById('audit-hour').value == -1) {
        document.getElementById('tab-solar-kw').innerText = solar.toFixed(1);
        document.getElementById('tab-load-kw').innerText = load.toFixed(1);
        document.getElementById('tab-batt-kw').innerText = Math.abs(batt).toFixed(1);
        document.getElementById('tab-grid-kw').innerText = grid.toFixed(1);

        // Trend Colors
        const prev = day.hourly[day.hourly.length - 2];
        if (prev) {
            setTrend('tab-solar-kw', solar, prev.solar);
            setTrend('tab-load-kw', load, prev.load);
            setTrend('tab-batt-kw', Math.abs(batt), Math.abs(prev.batt));
            setTrend('tab-grid-kw', grid, prev.grid);
        }
    }

    document.getElementById('tab-solar-kwh').innerText = day.solarKwh.toFixed(1);
    document.getElementById('tab-load-kwh').innerText = (day.hourly.reduce((a, b) => a + b.load, 0)).toFixed(1);
    document.getElementById('tab-grid-kwh').innerText = day.gridKwh.toFixed(1);
    document.getElementById('val-soh').innerText = simState.soh.toFixed(1) + "%";
    document.getElementById('fill-soh').style.width = simState.soh + "%";
    document.getElementById('val-cycles').innerText = Math.round(simState.soh * 10);

    mainChart.data.datasets[0].data.push(solar);
    mainChart.data.datasets[1].data.push(load);
    mainChart.data.datasets[2].data.push(grid + diesel);
    mainChart.data.datasets[3].data.push(simState.soc);

    // Ensure chart visibility
    simState.activeSeries.forEach((show, idx) => {
        mainChart.setDatasetVisibility(idx, show);
    });

    mainChart.update();

    let angle = -90 + (simState.hour / 24) * 360;
    document.getElementById('sun-container').style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
}

function startSim() {
    if (simState.isPlaying) return;
    simState.isPlaying = true;
    document.getElementById('btn-start').innerHTML = '<i class="fas fa-pause"></i> PAUSE';
    document.getElementById('persistent-results').style.display = 'none';

    if (simState.hour === 0) {
        simState.days[simState.currentDay].config = {
            solarCap: simState.solarCap, battCap: simState.battCap,
            isSmart: simState.isSmart, weather: simState.weather, soh: simState.soh, gridCost: simState.gridCost
        };
    }

    simState.interval = setInterval(() => {
        if (simState.hour >= 24) { stopSim(true); return; }
        runStep();
        simState.hour++;
    }, simState.speed);
}

function stopSim(completed = false) {
    simState.isPlaying = false;
    clearInterval(simState.interval);
    document.getElementById('btn-start').innerHTML = '<i class="fas fa-play"></i> RUN SIM';
    if (completed) revealResults(simState.currentDay);
}

function revealResults(dNum) {
    const day = simState.days[dNum];
    const cfg = day.config;
    document.getElementById('res-cost-val').innerText = "₹" + Math.round(day.cost);
    document.getElementById('res-solar-val').innerText = Math.round((day.solarKwh / day.hourly.reduce((a, b) => a + b.load, 0)) * 100) + "%";
    document.getElementById('res-grid-val').innerText = Math.round(day.gridKwh) + " kWh";
    document.getElementById('res-diesel-val').innerText = Math.round(day.dieselKwh) + " kWh";

    document.getElementById('res-cfg-solar').innerText = cfg.solarCap + "kW";
    document.getElementById('res-cfg-batt').innerText = cfg.battCap + "kWh";
    document.getElementById('res-cfg-mode').innerText = cfg.isSmart ? "Smart" : "Baseline";
    document.getElementById('res-cfg-weather').innerText = cfg.weather.toUpperCase();
    document.getElementById('res-cfg-grid-cost').innerText = "₹" + cfg.gridCost;

    // SOH Visual
    document.getElementById('res-soh-val').innerText = cfg.soh.toFixed(1) + "%";
    document.getElementById('res-soh-fill').style.width = cfg.soh + "%";

    const savingsBox = document.getElementById('savings-box');
    if (cfg.isSmart) {
        savingsBox.style.display = 'block';
        const totalLoad = day.hourly.reduce((a, b) => a + b.load, 0);
        const estBaseline = totalLoad * (cfg.gridCost * 1.05); // Realistic average
        document.getElementById('res-savings').innerText = Math.max(0, Math.round(estBaseline - day.cost));
    } else {
        savingsBox.style.display = 'none';
    }
    document.getElementById('persistent-results').style.display = 'block';
}

function showCompare() {
    const modal = document.getElementById('compare-modal');
    const container = document.getElementById('compare-grid-content');
    container.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.className = 'compare-scroll';

    Object.keys(simState.days).forEach(dKey => {
        const day = simState.days[dKey];
        const cfg = day.config;
        if (!cfg) return;
        const card = document.createElement('div');
        card.className = 'compare-card';
        card.innerHTML = `
            <h3 style="color:var(--primary)">DAY ${dKey} | ${cfg.isSmart ? 'SMART' : 'BASELINE'}</h3>
            <div style="margin:10px 0; font-size:0.7rem; opacity:0.7">
                SOLAR: ${cfg.solarCap}kW | BATT: ${cfg.battCap}kWh | GRID: ₹${cfg.gridCost}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:15px;">
                <div><label style="font-size:0.6rem">TOTAL COST</label><h2 style="color:var(--grid)">₹${Math.round(day.cost)}</h2></div>
                <div><label style="font-size:0.6rem">SOH</label><h2 style="color:var(--battery)">${cfg.soh.toFixed(1)}%</h2></div>
            </div>
        `;
        scroll.appendChild(card);
    });
    container.appendChild(scroll);
    modal.style.display = 'flex';
}

async function downloadPerformance() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // HEADER
    doc.setFillColor(15, 23, 42); // bg-dark
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("MICROGRID HACKER", 15, 20);
    doc.setFontSize(12);
    doc.setTextColor(99, 102, 241); // primary
    doc.text("EXTREME ANALYTICS REPORT", 15, 30);

    let yPos = 50;

    // SUMMARY TABLE
    const summaryData = Object.keys(simState.days).map(d => {
        const day = simState.days[d];
        const cfg = day.config;
        return [
            `Day ${d}`,
            cfg.isSmart ? "Smart" : "Baseline",
            `${cfg.solarCap}kW / ${cfg.battCap}kWh`,
            cfg.weather.toUpperCase(),
            `INR ${Math.round(day.cost)}`,
            `${Math.round(day.gridKwh)} kWh`,
            `${cfg.soh.toFixed(1)}%`
        ];
    });

    doc.autoTable({
        startY: yPos,
        head: [['Day', 'Mode', 'Config', 'Weather', 'Cost', 'Grid Use', 'SOH']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 5 }
    });

    yPos = doc.lastAutoTable.finalY + 20;

    // DETAILED SECTIONS
    Object.keys(simState.days).forEach((dKey) => {
        const day = simState.days[dKey];
        if (yPos > 250) { doc.addPage(); yPos = 20; }

        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(`DAY ${dKey} DETAILS`, 15, yPos);
        yPos += 10;

        const details = [
            ['Benefit', 'Value'],
            ['Total Cost', `INR ${Math.round(day.cost)}`],
            ['Solar Generated', `${Math.round(day.solarKwh)} kWh`],
            ['Grid Imported', `${Math.round(day.gridKwh)} kWh`],
            ['Diesel Used', `${Math.round(day.dieselKwh)} kWh`],
            ['Battery Health', `${day.config.soh.toFixed(2)}%`]
        ];

        doc.autoTable({
            startY: yPos,
            body: details,
            theme: 'striped',
            styles: { fontSize: 9 },
            columnStyles: { 0: { fontStyle: 'bold', width: 50 } }
        });

        yPos = doc.lastAutoTable.finalY + 15;
    });

    doc.save("Microgrid_Performance_Report.pdf");
}

/** INIT **/
document.addEventListener('DOMContentLoaded', () => {
    initChart(); updateWeatherEffects();

    document.querySelectorAll('.weather-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            simState.weather = btn.dataset.weather;
            document.getElementById('env-weather-label').innerText = simState.weather.toUpperCase();
            updateWeatherEffects();
        };
    });

    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.index);
            simState.activeSeries[idx] = !simState.activeSeries[idx];
            btn.classList.toggle('active');
            mainChart.update();
            // Force redraw of datasets
            updateUI(
                mainChart.data.datasets[0].data[simState.hour] || 0,
                mainChart.data.datasets[1].data[simState.hour] || 0,
                mainChart.data.datasets[2].data[simState.hour] || 0,
                0, // Diesel place holder
                mainChart.data.datasets[3].data[simState.hour] || 0,
                "Idle"
            );
            // Re-apply visibility immediately
            mainChart.setDatasetVisibility(idx, simState.activeSeries[idx]);
            mainChart.update();
        };
    });

    document.getElementById('input-grid-cost').oninput = e => {
        simState.gridCost = parseInt(e.target.value);
        document.getElementById('lbl-grid-cost').innerText = e.target.value;
    };
    document.getElementById('input-solar-cap').oninput = e => {
        simState.solarCap = parseFloat(e.target.value);
        document.getElementById('lbl-solar-cap').innerText = e.target.value + " kW";
    };
    document.getElementById('input-batt-cap').oninput = e => {
        simState.battCap = parseFloat(e.target.value);
        document.getElementById('lbl-batt-cap').innerText = e.target.value + " kWh";
    };
    document.getElementById('input-speed').oninput = e => {
        simState.speed = 1000 / e.target.value;
        document.getElementById('lbl-speed').innerText = e.target.value + "x";
    };
    document.getElementById('input-strategy').onchange = e => {
        simState.isSmart = e.target.checked;
        document.getElementById('strategy-status').innerText = simState.isSmart ? "ON" : "OFF";
        document.getElementById('strategy-status').style.color = simState.isSmart ? "var(--battery)" : "var(--text-muted)";
    };

    document.getElementById('btn-start').onclick = () => simState.isPlaying ? stopSim() : startSim();
    document.getElementById('btn-reset').onclick = () => location.reload();
    document.getElementById('btn-next-step').onclick = () => {
        simState.currentDay++;
        simState.viewDay = simState.currentDay;
        simState.days[simState.currentDay] = {
            cost: 0, gridKwh: 0, solarKwh: 0, dieselKwh: 0, hourly: [],
            config: { solarCap: simState.solarCap, battCap: simState.battCap, isSmart: simState.isSmart, weather: simState.weather, soh: simState.soh, gridCost: simState.gridCost }
        };
        simState.hour = 0;
        simState.soc = 50;
        mainChart.data.datasets.forEach(d => d.data = []);
        mainChart.update();
        document.getElementById('persistent-results').style.display = 'none';
        document.getElementById('current-day-label').innerText = "DAY " + simState.currentDay;
        document.getElementById('audit-hour').value = "-1"; // Reset audit to real-time
        document.getElementById('val-soc').innerText = "50%"; // Reset HUD SOC
        document.getElementById('hud-cost').innerText = "₹0"; // Reset HUD Cost
    };
    document.getElementById('btn-compare').onclick = showCompare;
    document.getElementById('btn-download').onclick = downloadPerformance;

    document.getElementById('audit-hour').onchange = e => {
        const h = parseInt(e.target.value); if (h === -1) return;
        const day = simState.days[simState.viewDay];
        const step = day.hourly[h];
        if (step) {
            document.getElementById('tab-solar-kw').innerText = step.solar.toFixed(1);
            document.getElementById('tab-load-kw').innerText = step.load.toFixed(1);
            document.getElementById('tab-batt-kw').innerText = Math.abs(step.batt).toFixed(1);
            document.getElementById('tab-grid-kw').innerText = step.grid.toFixed(1);
            document.getElementById('appliance-tag').innerText = step.app;

            // Trend in Historical View
            const prev = day.hourly[h - 1];
            if (prev) {
                setTrend('tab-solar-kw', step.solar, prev.solar);
                setTrend('tab-load-kw', step.load, prev.load);
                setTrend('tab-batt-kw', Math.abs(step.batt), Math.abs(prev.batt));
                setTrend('tab-grid-kw', step.grid, prev.grid);
            } else {
                ['tab-solar-kw', 'tab-load-kw', 'tab-batt-kw', 'tab-grid-kw'].forEach(id => {
                    document.getElementById(id).className = '';
                });
            }
        }
    };

    document.getElementById('prev-day').onclick = () => {
        if (simState.viewDay > 1) {
            simState.viewDay--;
            loadDayData(simState.viewDay);
        }
    };

    document.getElementById('next-day').onclick = () => {
        if (simState.viewDay < simState.currentDay) {
            simState.viewDay++;
            loadDayData(simState.viewDay);
        }
    };

    document.getElementById('btn-3d-toggle').onclick = (e) => {
        document.getElementById('main-chart-container').classList.toggle('chart-3d-mode');
        const isActive = document.getElementById('main-chart-container').classList.contains('chart-3d-mode');
        e.target.innerHTML = isActive ? '<i class="fas fa-cube"></i> 2D VIZ' : '<i class="fas fa-cube"></i> 3D VIZ';
    };
});

function loadDayData(dNum) {
    const data = simState.days[dNum];
    if (!data) return;

    document.getElementById('current-day-label').innerText = "DAY " + dNum;

    // If we're looking at a day that hasn't started or is just starting
    if (!data.hourly.length) {
        mainChart.data.datasets.forEach(d => d.data = []);
        mainChart.update();
        document.getElementById('hud-cost').innerText = "₹0";
        document.getElementById('val-soc').innerText = "50%"; // Default start
        document.getElementById('sim-clock').innerText = "00:00";
        document.getElementById('persistent-results').style.display = 'none';
        return;
    }

    // Refresh Chart Logic
    mainChart.data.datasets[0].data = data.hourly.map(i => i.solar);
    mainChart.data.datasets[1].data = data.hourly.map(i => i.load);
    mainChart.data.datasets[2].data = data.hourly.map(i => i.grid + i.diesel);
    mainChart.data.datasets[3].data = data.hourly.map(i => i.soc);
    mainChart.update();

    // Refresh HUD
    const last = data.hourly[data.hourly.length - 1];
    document.getElementById('hud-cost').innerText = "₹" + Math.round(data.cost);
    document.getElementById('sim-clock').innerText = "23:00";
    document.getElementById('val-soc').innerText = Math.round(last.soc) + "%";

    // Refresh Audit to last hour
    document.getElementById('audit-hour').value = "23";
    document.getElementById('appliance-tag').innerText = last.app;

    revealResults(dNum);
}

function setTrend(elemId, curr, prev) {
    const el = document.getElementById(elemId);
    el.classList.remove('trend-up', 'trend-down');
    if (curr > prev) el.classList.add('trend-up'); // Green
    else if (curr < prev) el.classList.add('trend-down'); // Red
}
