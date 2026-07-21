(() => {
    // ====== DOM Elements ======
    const canvas = document.getElementById('simCanvas');
    const ctx = canvas.getContext('2d');
    
    // Sliders & Controls
    const freqSlider = document.getElementById('slider-freq');
    const tensionSlider = document.getElementById('slider-tension');
    const dampingSlider = document.getElementById('slider-damping');
    const timeFactorSlider = document.getElementById('sim-time-factor');
    
    // Labels
    const lblFreq = document.getElementById('lbl-freq');
    const lblTension = document.getElementById('lbl-tension');
    const lblDamping = document.getElementById('lbl-damping');
    const lblTimeFactor = document.getElementById('lbl-time-factor');
    
    // HUD Indicators
    const hudFreq = document.getElementById('hud-freq');
    const hudTension = document.getElementById('hud-tension');
    const hudSpeed = document.getElementById('hud-speed');
    const hudLambda = document.getElementById('hud-lambda');
    const hudAmplitude = document.getElementById('hud-amplitude');
    
    // Play/Pause & Sensor elements
    const playPauseBtn = document.getElementById('sim-play-pause-btn');
    const btnRequestSensor = document.getElementById('btn-request-sensor');
    const btnCalibrateSensor = document.getElementById('btn-calibrate-sensor');
    const sensorStatusText = document.getElementById('sensor-status-text');
    const sensorStatusDot = document.getElementById('sensor-status-dot');

    // ====== Physics / State Variables ======
    let simType = 'transverse'; // 'transverse' or 'longitudinal'
    let simIsPlaying = true;
    let simTime = 0; // cumulative physics time
    let timeScale = 1.0; // speed factor (slow-mo)
    
    // Physics Parameters (Default)
    let frequency = 1.5; // f (Hz)
    let tension = 4.0; // T (N)
    let damping = 10; // Damping constant
    let baseAmplitude = 45; // A (px)
    let currentAmplitude = 45; // current amplitude (can be boosted by shake)
    
    // Device Sensor Orientation state
    let sensorActive = false;
    let neutralBeta = 0;
    let neutralGamma = 0;
    let hasCalibrated = false;
    let orientationPermissionGranted = false;

    // Shake Detection
    let lastX = null, lastY = null, lastZ = null;
    let shakeThreshold = 12; // acceleration threshold for shake
    let shakeDecay = 0.95; // damping of the shake energy

    // Particle settings for Longitudinal wave
    const numLongParticles = 40; // 40 columns
    const longParticlesHeight = 6; // rows of particles for density representation
    let gasParticles = []; // 2D noise offset array
    
    function initGasParticles() {
        gasParticles = [];
        for (let i = 0; i < numLongParticles; i++) {
            let row = [];
            for (let j = 0; j < longParticlesHeight; j++) {
                // random offsets within a local box to look like a fluid
                row.push({
                    yOffset: (j - (longParticlesHeight - 1)/2) * 15 + (Math.random() - 0.5) * 6,
                    xOffset: (Math.random() - 0.5) * 8
                });
            }
            gasParticles.push(row);
        }
    }
    initGasParticles();

    // ====== Physics Calculations ======
    // Wave speed: v = c * sqrt(T), let c = 100 for visual pixel scale
    function getWaveSpeed() {
        return 100 * Math.sqrt(tension);
    }
    
    // Wavelength: lambda = v / f
    function getWavelength() {
        return getWaveSpeed() / frequency;
    }
    
    // Displacement equation: y = A * e^(-damping_factor * x) * sin(2 * pi * (f * t - x / lambda))
    function getDisplacement(x, t) {
        const waveSpeed = getWaveSpeed();
        const lambda = getWavelength();
        
        // Damping factor: scale damping slider to visual scale
        const dampingFactor = (damping * 0.00015);
        const amp = currentAmplitude * Math.exp(-dampingFactor * x);
        
        // Traveling wave phase
        const phase = 2 * Math.PI * (frequency * t - x / lambda);
        return amp * Math.sin(phase);
    }

    // ====== UI Event Handlers ======
    window.switchSimType = function(type) {
        simType = type;
        
        // Update tab buttons
        const tabs = document.querySelectorAll('.sim-tab');
        tabs.forEach(tab => {
            if (tab.innerText.toLowerCase().includes(type)) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Reset amplitudes
        currentAmplitude = baseAmplitude;
    };
    
    window.toggleSimPlay = function() {
        simIsPlaying = !simIsPlaying;
        if (simIsPlaying) {
            playPauseBtn.innerHTML = "<i class='bx bx-pause'></i> Jeda";
            playPauseBtn.classList.remove('active');
        } else {
            playPauseBtn.innerHTML = "<i class='bx bx-play'></i> Putar";
            playPauseBtn.classList.add('active');
        }
    };
    
    window.stepSimForward = function() {
        if (!simIsPlaying) {
            // increment time by a small fraction (e.g. 0.05 sec)
            simTime += 0.05;
        }
    };
    
    window.resetSim = function() {
        simTime = 0;
        currentAmplitude = baseAmplitude;
        if (!simIsPlaying) {
            simTime = 0;
        }
    };
    
    window.updateSimTimeFactor = function(val) {
        timeScale = parseFloat(val);
        if (timeScale === 1.0) {
            lblTimeFactor.innerText = "Normal";
        } else if (timeScale === 0.0) {
            lblTimeFactor.innerText = "Jeda";
        } else {
            lblTimeFactor.innerText = `${timeScale.toFixed(2)}x (Lambat)`;
        }
    };

    // ====== Event Listeners for Sliders ======
    function syncSlidersWithUI() {
        if (freqSlider) {
            frequency = parseFloat(freqSlider.value);
            lblFreq.innerText = `${frequency.toFixed(2)} Hz`;
        }
        if (tensionSlider) {
            tension = parseFloat(tensionSlider.value);
            lblTension.innerText = `${tension.toFixed(2)} N`;
        }
        if (dampingSlider) {
            damping = parseInt(dampingSlider.value);
            lblDamping.innerText = damping;
        }
        
        // Update HUD
        const speed = getWaveSpeed() / 100; // in meters/sec equivalent
        const lambda = getWavelength() / 100; // in meters equivalent
        
        if (hudFreq) hudFreq.innerText = `${frequency.toFixed(2)} Hz`;
        if (hudTension) hudTension.innerText = `${tension.toFixed(2)} N`;
        if (hudSpeed) hudSpeed.innerText = `${speed.toFixed(2)} m/s`;
        if (hudLambda) hudLambda.innerText = `${lambda.toFixed(2)} m`;
        if (hudAmplitude) hudAmplitude.innerText = `${(currentAmplitude/100).toFixed(2)} m`;
    }
    
    if (freqSlider) freqSlider.addEventListener('input', syncSlidersWithUI);
    if (tensionSlider) tensionSlider.addEventListener('input', syncSlidersWithUI);
    if (dampingSlider) dampingSlider.addEventListener('input', syncSlidersWithUI);
    
    // Initialize UI values
    syncSlidersWithUI();

    // ====== Device Motion & Orientation Sensor Logic ======
    window.toggleMotionSensor = function() {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                            DeviceOrientationEvent.requestPermission().catch(console.error);
                        }
                        activateSensor();
                    } else {
                        alert("Izin sensor ditolak.");
                    }
                })
                .catch(console.error);
        } else {
            activateSensor();
        }
    };
    
    function activateSensor() {
        sensorActive = true;
        if (sensorStatusDot) sensorStatusDot.classList.add('active');
        if (sensorStatusText) sensorStatusText.innerText = "Sensor Aktif! Goyang HP Anda.";
        if (btnRequestSensor) btnRequestSensor.style.display = 'none';
        
        window.addEventListener('deviceorientation', handleOrientation);
        window.addEventListener('devicemotion', handleMotion);
        
        hasCalibrated = false;
        currentAmplitude = 0; // Mulai dari 0 untuk menunggu guncangan HP
    }
    
    function handleOrientation(event) {
        if (!sensorActive) return;
        
        let beta = event.beta; // forward/backward tilt [-180, 180]
        let gamma = event.gamma; // left/right tilt [-90, 90]
        
        if (beta === null || gamma === null) return;
        
        if (!hasCalibrated) {
            neutralBeta = beta;
            neutralGamma = gamma;
            hasCalibrated = true;
        }
        
        // Calculate offsets relative to neutral orientation
        let deltaBeta = beta - neutralBeta;
        let deltaGamma = gamma - neutralGamma;
        
        // Map deltaBeta (tilt forward/backward) to frequency [0.5 - 3.0 Hz]
        let freqOffset = (deltaBeta / 20.0);
        let targetFreq = 1.5 + freqOffset;
        targetFreq = Math.max(0.5, Math.min(3.0, targetFreq));
        
        // Map deltaGamma (tilt left/right) to tension [1.0 - 9.0 N]
        let tensionOffset = (deltaGamma / 15.0) * 3.0;
        let targetTension = 4.0 + tensionOffset;
        targetTension = Math.max(1.0, Math.min(9.0, targetTension));
        
        // Apply values and sync UI
        frequency = targetFreq;
        if (freqSlider) freqSlider.value = frequency;
        if (lblFreq) lblFreq.innerText = `${frequency.toFixed(2)} Hz`;
        
        tension = targetTension;
        if (tensionSlider) tensionSlider.value = tension;
        if (lblTension) lblTension.innerText = `${tension.toFixed(2)} N`;
        
        // Trigger manual HUD update
        const speed = getWaveSpeed() / 100;
        const lambda = getWavelength() / 100;
        if (hudFreq) hudFreq.innerText = `${frequency.toFixed(2)} Hz`;
        if (hudTension) hudTension.innerText = `${tension.toFixed(2)} N`;
        if (hudSpeed) hudSpeed.innerText = `${speed.toFixed(2)} m/s`;
        if (hudLambda) hudLambda.innerText = `${lambda.toFixed(2)} m`;
    }
    
    function handleMotion(event) {
        if (!sensorActive) return;
        
        let acc = event.acceleration;
        if (acc) {
            let totalForce = Math.abs(acc.x || 0) + Math.abs(acc.y || 0) + Math.abs(acc.z || 0);
            let strength = totalForce * 15; // Sensitivitas

            if (strength > 2) {
                const maxAmp = (simType === 'transverse') 
                                ? canvas.height / 2 - 10 
                                : 50; 
                currentAmplitude = Math.min(strength, maxAmp); 
            }
        }
    }

    // ====== Rendering Functions ======
    
    function drawGridLines() {
        ctx.strokeStyle = '#1e293b'; // slate 800
        ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x < canvas.width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < canvas.height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Equilibrium line
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'; // slate 400 with opacity
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.setLineDash([]); // reset
    }

    // Drawing the Transverse Wave
    function drawTransverseWave() {
        const yMid = canvas.height / 2;
        const startX = 60; // offset for the piston
        
        // 1. Draw equilibrium line
        drawGridLines();
        
        // 2. Draw equilibrium label
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Outfit';
        ctx.fillText("GARIS KESETIMBANGAN", 70, yMid - 6);

        // 3. Draw vibration source (piston / hand) at x = startX
        const pistonY = yMid + getDisplacement(0, simTime);
        ctx.fillStyle = '#475569';
        ctx.fillRect(10, pistonY - 20, startX - 10, 40);
        ctx.strokeStyle = '#f97316'; // orange border for source
        ctx.lineWidth = 2;
        ctx.strokeRect(10, pistonY - 20, startX - 10, 40);
        
        // Label "SUMBER GETARAN"
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 10px Outfit';
        ctx.fillText("SUMBER", 12, pistonY - 24);
        
        // Vibration Direction Arrow
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        // Up arrow
        ctx.beginPath();
        ctx.moveTo(35, pistonY - 35);
        ctx.lineTo(35, pistonY - 55);
        ctx.lineTo(30, pistonY - 50);
        ctx.moveTo(35, pistonY - 55);
        ctx.lineTo(40, pistonY - 50);
        // Down arrow
        ctx.moveTo(35, pistonY + 35);
        ctx.lineTo(35, pistonY + 55);
        ctx.lineTo(30, pistonY + 50);
        ctx.moveTo(35, pistonY + 55);
        ctx.lineTo(40, pistonY + 50);
        ctx.stroke();
        
        ctx.fillStyle = '#f97316';
        ctx.font = '9px Outfit';
        ctx.fillText("Arah Getar", 48, pistonY - 45);

        // 4. Draw wave points and lines
        const points = [];
        const lambda = getWavelength();
        const highlightStart = 150;
        const highlightEnd = highlightStart + lambda;
        
        for (let x = startX; x < canvas.width; x += 4) {
            const y = yMid + getDisplacement(x - startX, simTime);
            points.push({ x, y });
        }
        
        // Draw continuous line representing the rope/medium
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (points.length > 0) {
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
        }
        ctx.stroke();

        // Draw beads (particles of medium)
        const beadSpacing = 16;
        for (let x = startX; x < canvas.width - 20; x += beadSpacing) {
            const disp = getDisplacement(x - startX, simTime);
            const y = yMid + disp;
            
            // Check if within the highlighted wavelength segment
            const isHighlighted = x >= highlightStart && x <= highlightEnd;
            
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = isHighlighted ? '#f97316' : '#38bdf8'; // Orange for lambda, sky blue for others
            ctx.shadowBlur = isHighlighted ? 8 : 4;
            ctx.shadowColor = isHighlighted ? '#f97316' : '#38bdf8';
            ctx.fill();
            ctx.shadowBlur = 0; // reset
        }

        // 5. Draw Wavelength Bracket Label (lambda)
        if (highlightEnd < canvas.width) {
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            // Start tick
            ctx.moveTo(highlightStart, yMid - 60);
            ctx.lineTo(highlightStart, yMid - 75);
            // End tick
            ctx.moveTo(highlightEnd, yMid - 60);
            ctx.lineTo(highlightEnd, yMid - 75);
            // Connecting line
            ctx.moveTo(highlightStart, yMid - 70);
            ctx.lineTo(highlightEnd, yMid - 70);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = '#f97316';
            ctx.font = 'bold 11px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`Panjang Gelombang (λ) = ${(lambda/100).toFixed(2)} m`, (highlightStart + highlightEnd) / 2, yMid - 80);
            ctx.textAlign = 'left'; // reset
        }
        
        // 6. Draw Amplitude indicator at source
        const maxAmp = currentAmplitude;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(90, yMid);
        ctx.lineTo(90, yMid - maxAmp);
        ctx.moveTo(85, yMid - maxAmp);
        ctx.lineTo(95, yMid - maxAmp);
        ctx.stroke();
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px Outfit';
        ctx.fillText(`Amplitudo (A) = ${(maxAmp/100).toFixed(2)} m`, 98, yMid - maxAmp/2);

        // 7. Draw Propagation direction (Arah Rambat)
        ctx.strokeStyle = '#10b981'; // green
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(canvas.width - 150, 30);
        ctx.lineTo(canvas.width - 50, 30);
        ctx.lineTo(canvas.width - 60, 25);
        ctx.moveTo(canvas.width - 50, 30);
        ctx.lineTo(canvas.width - 60, 35);
        ctx.stroke();
        
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 10px Outfit';
        ctx.fillText("Arah Rambat (v)", canvas.width - 145, 18);
    }

    // Drawing the Longitudinal Wave
    function drawLongitudinalWave() {
        const yMid = canvas.height / 2;
        const startX = 60;
        const endX = canvas.width - 30;
        const usableWidth = endX - startX;
        
        drawGridLines();
        
        const lambda = getWavelength();
        
        // 1. Calculate and Draw Compression (Rapatan) and Rarefaction (Renggangan) Labels
        // phase(x) = 2*pi*(f*t - x/lambda). Compressions at phase = 2n*pi, Rarefactions at phase = (2n+1)*pi
        // x_c = lambda * (f * t - n), x_r = lambda * (f * t - n - 0.5)
        const t = simTime;
        
        // Find visible compressions
        const compressions = [];
        const rarefactions = [];
        
        // scan a range of integers n
        const startN = Math.floor(frequency * t - canvas.width / lambda) - 2;
        const endN = Math.ceil(frequency * t) + 2;
        
        for (let n = startN; n <= endN; n++) {
            let xc = startX + lambda * (frequency * t - n);
            let xr = startX + lambda * (frequency * t - n - 0.5);
            
            if (xc >= startX && xc <= endX) compressions.push(xc);
            if (xr >= startX && xr <= endX) rarefactions.push(xr);
        }
        
        // Draw Compressions (Rapatan) labels
        ctx.fillStyle = '#ef4444'; // Red for high pressure/compression
        ctx.font = 'bold 10px Outfit';
        ctx.textAlign = 'center';
        compressions.forEach(xc => {
            ctx.fillText("RAPATAN", xc, yMid - 95);
            // Draw a thin dashed guideline down
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(xc, yMid - 85);
            ctx.lineTo(xc, yMid + 80);
            ctx.stroke();
            ctx.setLineDash([]);
        });
        
        // Draw Rarefactions (Renggangan) labels
        ctx.fillStyle = '#0ea5e9'; // Sky blue for low pressure/rarefaction
        ctx.font = 'bold 10px Outfit';
        rarefactions.forEach(xr => {
            ctx.fillText("RENGGANGAN", xr, yMid - 95);
            
            // Draw guideline
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(xr, yMid - 85);
            ctx.lineTo(xr, yMid + 80);
            ctx.stroke();
            ctx.setLineDash([]);
        });
        ctx.textAlign = 'left'; // reset

        // 2. Draw Source piston at left
        // For longitudinal, piston moves left and right
        const pistonDisp = getDisplacement(0, simTime) * 0.4; // scale down horizontal amplitude slightly
        const pistonX = startX - 25 + pistonDisp;
        
        ctx.fillStyle = '#475569';
        ctx.fillRect(pistonX - 15, yMid - 40, 15, 80);
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.strokeRect(pistonX - 15, yMid - 40, 15, 80);
        
        // Connect piston rod
        ctx.fillStyle = '#64748b';
        ctx.fillRect(pistonX - 30, yMid - 10, 15, 20);

        // Label "SUMBER GETARAN"
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 10px Outfit';
        ctx.fillText("SUMBER", pistonX - 20, yMid - 48);

        // Horizontal Vibration Arrow
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Left point
        ctx.moveTo(pistonX - 30, yMid - 25);
        ctx.lineTo(pistonX - 35, yMid - 25);
        ctx.lineTo(pistonX - 32, yMid - 28);
        ctx.moveTo(pistonX - 35, yMid - 25);
        ctx.lineTo(pistonX - 32, yMid - 22);
        // Right point
        ctx.moveTo(pistonX - 10, yMid - 25);
        ctx.lineTo(pistonX - 5, yMid - 25);
        ctx.lineTo(pistonX - 8, yMid - 28);
        ctx.moveTo(pistonX - 5, yMid - 25);
        ctx.lineTo(pistonX - 8, yMid - 22);
        // Bar
        ctx.moveTo(pistonX - 35, yMid - 25);
        ctx.lineTo(pistonX - 5, yMid - 25);
        ctx.stroke();

        // 3. Draw Slinky (overlapping coils)
        // 40 coils spaced evenly, displaced horizontally
        const numCoils = 45;
        const coilSpacing = usableWidth / numCoils;
        const coilRadiusY = 32;
        const coilRadiusX = 6;
        
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        
        // To draw continuous slinky spring, we draw coils one by one
        for (let i = 0; i < numCoils; i++) {
            const eqX = startX + i * coilSpacing;
            const disp = getDisplacement(eqX - startX, simTime) * 0.45; // scale down
            const cx = eqX + disp;
            
            // Draw coil loop
            ctx.beginPath();
            ctx.ellipse(cx, yMid - 25, coilRadiusX, coilRadiusY, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 4. Draw Gas Medium Particles (dots representation below slinky)
        // Group of small dots scattered around their respective equilibrium coordinates
        for (let i = 0; i < numLongParticles; i++) {
            const eqX = startX + i * (usableWidth / numLongParticles);
            const disp = getDisplacement(eqX - startX, simTime) * 0.45;
            const cx = eqX + disp;
            
            // Draw column of 6 particles
            const row = gasParticles[i];
            if (row) {
                row.forEach(p => {
                    ctx.beginPath();
                    ctx.arc(cx + p.xOffset, yMid + 40 + p.yOffset, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#38bdf8'; // cyan gas particles
                    ctx.fill();
                });
            }
        }
        
        // 5. Draw Wavelength Bracket Label (lambda)
        // Wavelength is distance between two compressions
        if (compressions.length >= 2) {
            const startL = compressions[0];
            const endL = compressions[1];
            
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            // Start tick
            ctx.moveTo(startL, yMid - 65);
            ctx.lineTo(startL, yMid - 80);
            // End tick
            ctx.moveTo(endL, yMid - 65);
            ctx.lineTo(endL, yMid - 80);
            // Connecting line
            ctx.moveTo(startL, yMid - 75);
            ctx.lineTo(endL, yMid - 75);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = '#f97316';
            ctx.font = 'bold 11px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`Panjang Gelombang (λ) = ${(lambda/100).toFixed(2)} m`, (startL + endL) / 2, yMid - 85);
            ctx.textAlign = 'left'; // reset
        }

        // 6. Draw Propagation direction (Arah Rambat)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(canvas.width - 150, 30);
        ctx.lineTo(canvas.width - 50, 30);
        ctx.lineTo(canvas.width - 60, 25);
        ctx.moveTo(canvas.width - 50, 30);
        ctx.lineTo(canvas.width - 60, 35);
        ctx.stroke();
        
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 10px Outfit';
        ctx.fillText("Arah Rambat (v)", canvas.width - 145, 18);
    }

    // ====== Simulation Loop ======
    let lastFrameTime = performance.now();
    
    function simLoop(now) {
        // Calculate dt
        let dt = (now - lastFrameTime) / 1000;
        lastFrameTime = now;
        
        // Prevent dt spikes when switching tabs
        if (dt > 0.1) dt = 0.1;
        
        // Advance physics time if simulator active & playing
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'tab-simulasi' && simIsPlaying) {
            simTime += dt * timeScale;
            
            if (sensorActive) {
                // Decay target amplitude based on Damping slider (seperti logic user)
                const decay = 1 - (damping * 0.005);
                currentAmplitude *= decay;
                if (currentAmplitude < 0.1) currentAmplitude = 0;
            } else {
                // Slowly decay boosted amplitude back to base amplitude
                if (currentAmplitude > baseAmplitude) {
                    currentAmplitude = baseAmplitude + (currentAmplitude - baseAmplitude) * shakeDecay;
                    if (currentAmplitude - baseAmplitude < 0.1) currentAmplitude = baseAmplitude;
                } else if (currentAmplitude < baseAmplitude) {
                    currentAmplitude = baseAmplitude;
                }
            }
        }
        
        // Clear canvas
        ctx.fillStyle = '#020617'; // deep slate 950 for simulation space
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw current wave type
        if (simType === 'transverse') {
            drawTransverseWave();
        } else {
            drawLongitudinalWave();
        }
        
        requestAnimationFrame(simLoop);
    }
    
    requestAnimationFrame(simLoop);

})();
