/**
 * Simulation and UI Controller for Fuzzy Logic Traffic Management
 * By: Jaskirat Singh and Rishi Bhardwaj
 */

document.addEventListener('DOMContentLoaded', () => {
  const fuzzy = new FuzzyTrafficController();

  // --- Configuration & State ---
  let mode = 'fuzzy'; // 'fixed' or 'fuzzy'
  let isRunning = true;

  let flowRateNS = 25; // cars per minute
  let flowRateEW = 25; // cars per minute

  // Phase: 'NS_GREEN' (North-South Green) -> 'NS_YELLOW' -> 'EW_GREEN' (East-West Green) -> 'EW_YELLOW'
  let phase = 'NS_GREEN';
  let phaseTimer = 15;
  let currentGreenDuration = 15;
  const yellowDuration = 3;

  let vehicles = [];
  let nextVehicleId = 1;

  // Performance metrics
  let totalVehiclesCleared = 0;
  let totalWaitTime = 0;

  // Last fuzzy evaluation record
  let lastFuzzyEval = null;

  // Canvas setup
  const canvas = document.getElementById('trafficCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // --- Vehicle Spawning ---
  function spawnVehicle(dir) {
    const carsInLane = vehicles.filter(v => v.dir === dir);
    if (carsInLane.some(v => v.pos < 30)) return;

    vehicles.push({
      id: nextVehicleId++,
      dir: dir,
      pos: 0,
      speed: 75,
      isStopped: false,
      waitTime: 0,
      cleared: false
    });
  }

  function handleSpawning(dt) {
    const probNS = (flowRateNS / 60) * dt;
    const probEW = (flowRateEW / 60) * dt;

    if (Math.random() < probNS / 2) spawnVehicle('N');
    if (Math.random() < probNS / 2) spawnVehicle('S');
    if (Math.random() < probEW / 2) spawnVehicle('E');
    if (Math.random() < probEW / 2) spawnVehicle('W');
  }

  // Count stopped cars waiting in a direction
  function getQueueCount(dirs) {
    return vehicles.filter(v => dirs.includes(v.dir) && !v.cleared && v.isStopped).length;
  }

  // --- Traffic Light Phase Transitions ---
  function computeNextGreenDuration(nextPhase) {
    if (mode === 'fixed') {
      return 15; // Standard fixed green time (15 seconds)
    }

    const isNS = (nextPhase === 'NS_GREEN');
    const queue = isNS ? getQueueCount(['N', 'S']) : getQueueCount(['E', 'W']);
    const rate = isNS ? flowRateNS : flowRateEW;

    const result = fuzzy.compute(queue, rate);
    lastFuzzyEval = {
      dirName: isNS ? 'North-South' : 'East-West',
      ...result
    };

    return result.greenTime;
  }

  function updatePhase(dt) {
    phaseTimer -= dt;

    if (phaseTimer <= 0) {
      if (phase === 'NS_GREEN') {
        phase = 'NS_YELLOW';
        phaseTimer = yellowDuration;
      } else if (phase === 'NS_YELLOW') {
        phase = 'EW_GREEN';
        currentGreenDuration = computeNextGreenDuration('EW_GREEN');
        phaseTimer = currentGreenDuration;
      } else if (phase === 'EW_GREEN') {
        phase = 'EW_YELLOW';
        phaseTimer = yellowDuration;
      } else if (phase === 'EW_YELLOW') {
        phase = 'NS_GREEN';
        currentGreenDuration = computeNextGreenDuration('NS_GREEN');
        phaseTimer = currentGreenDuration;
      }
    }
  }

  // --- Vehicle Physics & Queue Handling ---
  function updateVehicles(dt) {
    const stopLine = 150;
    const intersectionExit = 250;
    const carGap = 26;

    const isNSGreen = (phase === 'NS_GREEN');
    const isEWGreen = (phase === 'EW_GREEN');

    ['N', 'S', 'E', 'W'].forEach(dir => {
      const laneCars = vehicles.filter(v => v.dir === dir).sort((a, b) => b.pos - a.pos);
      const hasGreen = (dir === 'N' || dir === 'S') ? isNSGreen : isEWGreen;

      for (let i = 0; i < laneCars.length; i++) {
        const car = laneCars[i];

        if (car.cleared) {
          car.pos += car.speed * dt;
          continue;
        }

        const leaderPos = (i > 0) ? laneCars[i - 1].pos : 999;
        const approachingStopLine = (car.pos < stopLine && (stopLine - car.pos) <= 8 && !hasGreen);
        const approachingLeader = (leaderPos - car.pos <= carGap);

        if (approachingStopLine || approachingLeader) {
          car.isStopped = true;
          car.waitTime += dt;
          totalWaitTime += dt;
        } else {
          car.isStopped = false;
          car.pos += car.speed * dt;
        }

        if (car.pos >= intersectionExit && !car.cleared) {
          car.cleared = true;
          totalVehiclesCleared++;
        }
      }
    });

    vehicles = vehicles.filter(v => v.pos < 450);
  }

  // --- Canvas Rendering (Simple 4-Way Intersection) ---
  function render() {
    ctx.clearRect(0, 0, W, H);

    // 1. Background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, W, H);

    // 2. Roads
    ctx.fillStyle = '#555555';
    ctx.fillRect(160, 0, 80, H); // North-South
    ctx.fillRect(0, 160, W, 80); // East-West

    // Intersection center
    ctx.fillStyle = '#444444';
    ctx.fillRect(160, 160, 80, 80);

    // 3. Dashed Median Lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(200, 0); ctx.lineTo(200, 150);
    ctx.moveTo(200, 250); ctx.lineTo(200, H);
    ctx.moveTo(0, 200); ctx.lineTo(150, 200);
    ctx.moveTo(250, 200); ctx.lineTo(W, 200);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // 4. White Stop Lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(160, 150); ctx.lineTo(200, 150); // North stop line
    ctx.moveTo(200, 250); ctx.lineTo(240, 250); // South stop line
    ctx.moveTo(150, 200); ctx.lineTo(150, 240); // West stop line
    ctx.moveTo(250, 160); ctx.lineTo(250, 200); // East stop line
    ctx.stroke();

    // 5. Traffic Signal Lights
    const isNSGreen = (phase === 'NS_GREEN');
    const isNSYellow = (phase === 'NS_YELLOW');
    const isEWGreen = (phase === 'EW_GREEN');
    const isEWYellow = (phase === 'EW_YELLOW');

    const nsColor = isNSGreen ? '#28a745' : (isNSYellow ? '#ffc107' : '#dc3545');
    const ewColor = isEWGreen ? '#28a745' : (isEWYellow ? '#ffc107' : '#dc3545');

    function drawLight(x, y, color) {
      ctx.fillStyle = '#222222';
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    drawLight(145, 145, nsColor); // North signal
    drawLight(255, 255, nsColor); // South signal
    drawLight(255, 145, ewColor); // East signal
    drawLight(145, 255, ewColor); // West signal

    // 6. Direction Labels
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', 200, 16);
    ctx.fillText('S', 200, H - 6);
    ctx.textAlign = 'left';
    ctx.fillText('W', 6, 195);
    ctx.textAlign = 'right';
    ctx.fillText('E', W - 6, 195);

    // 7. Draw Vehicles
    vehicles.forEach(v => {
      let x = 0, y = 0, w = 12, h = 18;

      if (v.dir === 'N') {
        x = 180 - w / 2;
        y = v.pos;
      } else if (v.dir === 'S') {
        x = 220 - w / 2;
        y = H - v.pos - h;
      } else if (v.dir === 'W') {
        x = v.pos;
        y = 220 - h / 2;
        w = 18; h = 12;
      } else if (v.dir === 'E') {
        x = W - v.pos - w;
        y = 180 - h / 2;
        w = 18; h = 12;
      }

      // Blue = moving, Red = waiting in queue
      ctx.fillStyle = v.isStopped ? '#dc3545' : '#007bff';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    });
  }

  // --- UI Update Routine ---
  function updateUI() {
    const phaseNames = {
      NS_GREEN: 'North-South: GREEN',
      NS_YELLOW: 'North-South: YELLOW',
      EW_GREEN: 'East-West: GREEN',
      EW_YELLOW: 'East-West: YELLOW'
    };
    document.getElementById('hud-phase').textContent = phaseNames[phase];
    document.getElementById('hud-timer').textContent = `${Math.ceil(phaseTimer)}s`;

    const nsQ = getQueueCount(['N', 'S']);
    const ewQ = getQueueCount(['E', 'W']);
    document.getElementById('stat-ns-queue').textContent = `${nsQ} cars`;
    document.getElementById('stat-ew-queue').textContent = `${ewQ} cars`;

    const avgWait = (totalVehiclesCleared > 0) ? (totalWaitTime / totalVehiclesCleared).toFixed(1) : '0.0';
    document.getElementById('metric-wait').textContent = `${avgWait} s`;
    document.getElementById('metric-cleared').textContent = totalVehiclesCleared;

    const evalData = lastFuzzyEval || fuzzy.compute(nsQ, flowRateNS);

    document.getElementById('fz-dir').textContent = evalData.dirName || 'North-South';
    document.getElementById('fz-crisp-inputs').textContent = `Queue = ${evalData.queue} cars, Rate = ${evalData.arrivalRate} cars/min`;

    document.getElementById('fz-q-short').textContent = evalData.queueMF.short.toFixed(2);
    document.getElementById('fz-q-med').textContent = evalData.queueMF.medium.toFixed(2);
    document.getElementById('fz-q-long').textContent = evalData.queueMF.long.toFixed(2);

    document.getElementById('fz-r-low').textContent = evalData.rateMF.low.toFixed(2);
    document.getElementById('fz-r-med').textContent = evalData.rateMF.medium.toFixed(2);
    document.getElementById('fz-r-high').textContent = evalData.rateMF.high.toFixed(2);

    document.getElementById('fz-rule').textContent = evalData.dominantRule ? evalData.dominantRule.name : 'N/A';
    document.getElementById('fz-rule-weight').textContent = evalData.dominantWeight ? evalData.dominantWeight.toFixed(2) : '1.00';

    if (mode === 'fixed') {
      document.getElementById('fz-output').textContent = '15 seconds (Fixed Mode)';
    } else {
      document.getElementById('fz-output').textContent = `${evalData.greenTime} seconds`;
    }
  }

  // --- Mode Selection via Radio Buttons ---
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      mode = e.target.value;
    });
  });

  const btnPause = document.getElementById('btn-pause');
  btnPause.addEventListener('click', () => {
    isRunning = !isRunning;
    btnPause.textContent = isRunning ? 'Pause' : 'Resume';
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    vehicles = [];
    totalVehiclesCleared = 0;
    totalWaitTime = 0;
    phase = 'NS_GREEN';
    phaseTimer = (mode === 'fixed') ? 15 : computeNextGreenDuration('NS_GREEN');
    updateUI();
  });

  const sliderNS = document.getElementById('slider-ns');
  const sliderEW = document.getElementById('slider-ew');
  sliderNS.addEventListener('input', (e) => {
    flowRateNS = parseInt(e.target.value);
    document.getElementById('val-ns').textContent = `${flowRateNS} cars/min`;
  });
  sliderEW.addEventListener('input', (e) => {
    flowRateEW = parseInt(e.target.value);
    document.getElementById('val-ew').textContent = `${flowRateEW} cars/min`;
  });

  // --- Animation Loop ---
  let lastTime = performance.now();

  function loop(currentTime) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    if (isRunning) {
      handleSpawning(dt);
      updatePhase(dt);
      updateVehicles(dt);
    }

    render();
    updateUI();

    requestAnimationFrame(loop);
  }

  currentGreenDuration = computeNextGreenDuration('NS_GREEN');
  phaseTimer = currentGreenDuration;
  requestAnimationFrame(loop);
});
