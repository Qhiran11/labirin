/* =========================
   WAVE UP - main.js (FIXED)
   - Player always faces up (fixed)
   - Maze/world rotates based on phone heading
   - Movement uses heading, not player rotation
   - Optical flow safe bounds (no NaN)
   - iOS orientation permission supported
   ========================= */

(() => {
    // ====== DOM ======
    const mazeCanvas = document.getElementById('mazeCanvas');
    const ctx = mazeCanvas.getContext('2d');

    // ====== Maze Variables ======
    let cols, rows;
    let w = 40;
    let grid = [];
    let current;
    let stack = [];

    let currentQuestion = {
        question: "Pertanyaan default...",
        answers: ["A", "B", "C", "D"],
        correct: "A"
    };

    let placedAnswers = [];
    let gameQuestions = [];
    let currentQuestionIndex = 0;

    // ====== UI State ======
    let player = null;
    let cameraZoom = 1.0;
    let moveSensitivity = 1.0;

    // ====== World Camera (follow) ======
    let cameraX = 0;
    let cameraY = 0;

    // ====== Heading / Compass (WORLD rotation) ======
    let compassActive = false;
    let heading = 0;          // smooth heading used for rendering & movement
    let targetHeading = 0;    // raw heading after offset
    let headingOffset = 0;    // reset forward reference
    let firstCompassReading = true;

    function normalizeRad(a) {
        while (a <= -Math.PI) a += Math.PI * 2;
        while (a > Math.PI) a -= Math.PI * 2;
        return a;
    }

    function lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    function lerpAngle(current, target, t) {
        const diff = normalizeRad(target - current);
        return current + diff * t;
    }

    // iOS orientation permission request
    async function requestOrientationPermissionIfNeeded() {
        // Must be called from user gesture on iOS
        if (
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function"
        ) {
            const state = await DeviceOrientationEvent.requestPermission();
            if (state !== "granted") {
                throw new Error("Izin Motion & Orientation ditolak. Aktifkan di Safari Settings.");
            }
        }
    }

    // Listen orientation (works on Android directly; iOS after permission)
    window.addEventListener("deviceorientation", (event) => {
        let rad = null;

        if (typeof event.webkitCompassHeading === 'number') {
            // iOS: 0 = North, clockwise
            rad = event.webkitCompassHeading * (Math.PI / 180);
        } else if (typeof event.alpha === 'number') {
            // Android: negate for more intuitive sync with screen rotation
            rad = -event.alpha * (Math.PI / 180);
        }

        if (rad === null) return;

        if (firstCompassReading) {
            headingOffset = rad - targetHeading;      // set initial forward to match current spawn direction
            firstCompassReading = false;
        }

        compassActive = true;
        targetHeading = normalizeRad(rad - headingOffset);
    }, true);

    // State untuk tombol berjalan (Movebutton)
    let isMoveButtonPressed = false;

    // ====== Setup Screen: Generate Form ======
    window.onload = () => {
        const formContainer = document.getElementById('questions-form');
        for (let i = 0; i < 10; i++) {
            let block = document.createElement('div');
            block.className = 'question-block';
            block.innerHTML = `
        <strong>Soal ${i + 1}</strong>
        <label>Pertanyaan:</label><input type="text" id="q${i}_text" style="font-size: 0.5rem;">
        <label>Jawaban Benar:</label><input type="text" id="q${i}_ans_true" style="font-size: 0.5rem;">
        <label>Pilihan Salah 1:</label><input type="text" id="q${i}_ans_f1" style="font-size: 0.5rem;">
        <label>Pilihan Salah 2:</label><input type="text" id="q${i}_ans_f2" style="font-size: 0.5rem;">
        <label>Pilihan Salah 3:</label><input type="text" id="q${i}_ans_f3" style="font-size: 0.5rem;">
      `;
            formContainer.appendChild(block);
        }

        // Slider listeners (exists in DOM even if game screen hidden)
        const zoomSlider = document.getElementById('zoomSlider');
        const sensSlider = document.getElementById('sensitivitySlider');

        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                cameraZoom = parseFloat(e.target.value);
            });
        }

        if (sensSlider) {
            sensSlider.addEventListener('input', (e) => {
                moveSensitivity = parseFloat(e.target.value);
            });
        }

        // Logika Tombol Berjalan (Hold-to-Move)
        const moveBtn = document.getElementById('moveBtn');
        if (moveBtn) {
            const startMove = (e) => { e.preventDefault(); isMoveButtonPressed = true; moveBtn.classList.add('active'); };
            const stopMove = (e) => { e.preventDefault(); isMoveButtonPressed = false; moveBtn.classList.remove('active'); };

            moveBtn.addEventListener('mousedown', startMove);
            moveBtn.addEventListener('touchstart', startMove);
            moveBtn.addEventListener('mouseup', stopMove);
            moveBtn.addEventListener('touchend', stopMove);
            moveBtn.addEventListener('mouseleave', stopMove);
        }
    };

    window.fillDefaultQuestions = function () {
        for (let i = 0; i < 10; i++) {
            document.getElementById(`q${i}_text`).value = `Soal Default ${i + 1}: Dimana Bumi?`;
            document.getElementById(`q${i}_ans_true`).value = `Tata Surya ${i + 1}`;
            document.getElementById(`q${i}_ans_f1`).value = "Andromeda";
            document.getElementById(`q${i}_ans_f2`).value = "Bima Sakti";
            document.getElementById(`q${i}_ans_f3`).value = "Sirius";
        }
    };

    // Start game
    window.startGame = async function () {
        // Request orientation permission early (user gesture) for iOS
        try {
            await requestOrientationPermissionIfNeeded();
        } catch (e) {
            // Jangan stop game, tapi beri info
            console.warn(e.message);
        }

        gameQuestions = [];
        for (let i = 0; i < 10; i++) {
            let text = document.getElementById(`q${i}_text`).value;
            let t = document.getElementById(`q${i}_ans_true`).value;
            let f1 = document.getElementById(`q${i}_ans_f1`).value;
            let f2 = document.getElementById(`q${i}_ans_f2`).value;
            let f3 = document.getElementById(`q${i}_ans_f3`).value;

            if (!text || !t || !f1 || !f2 || !f3) {
                alert("Harap lengkapi ke-10 pertanyaan beserta semua pilihan gandanya untuk bisa bermain.");
                return;
            }

            gameQuestions.push({
                question: text,
                answers: [t, f1, f2, f3],
                correct: t
            });
        }

        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';

        currentQuestionIndex = 0;

        // Reset heading state
        heading = 0;
        targetHeading = 0;
        headingOffset = headingOffset; // keep as is
        firstCompassReading = true;

        setup();
    };

    // ====== Help Modal ======
    window.openHelpModal = () => document.getElementById('helpModal').style.display = 'flex';
    window.closeHelpModal = () => document.getElementById('helpModal').style.display = 'none';

    // ====== Camera View Toggle ======
    let isCameraHidden = false;
    window.toggleCameraView = () => {
        const vc = document.getElementById('camera-view-container');
        const ic = document.getElementById('toggleCameraViewBtn').querySelector('i');
        isCameraHidden = !isCameraHidden;

        if (isCameraHidden) {
            vc.style.display = 'none';
            ic.className = 'bx bx-show';
        } else {
            vc.style.display = 'flex';
            ic.className = 'bx bx-hide';
        }
    };

    // ====== Player ======
    class Player {
        constructor() {
            this.radius = w / 3;
            this.x = w / 2;
            this.y = w / 2;
            this.justAnswered = false;
        }

        get i() { return Math.floor(this.x / w); }
        get j() { return Math.floor(this.y / w); }

        show() {
            // ALWAYS facing up relative to SCREEN
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(heading); // Counter the world rotation so the arrow strictly points UP

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            const size = w / 2.5;
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.8, size);
            ctx.lineTo(0, size * 0.5);
            ctx.lineTo(-size * 0.8, size);
            ctx.closePath();

            ctx.shadowBlur = 15;
            ctx.shadowColor = "#ffffff";
            ctx.fill();
            ctx.restore();
        }

        moveContinuous(vx, vy) {
            if (!this.checkCollision(this.x + vx, this.y)) this.x += vx;
            if (!this.checkCollision(this.x, this.y + vy)) this.y += vy;
            checkAnswer();
        }

        checkCollision(newX, newY) {
            let currI = Math.floor(newX / w);
            let currJ = Math.floor(newY / w);

            let cellsToCheck = [];
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    let c = grid[index(currI + di, currJ + dj)];
                    if (c) cellsToCheck.push(c);
                }
            }

            for (let c of cellsToCheck) {
                let cx = c.i * w;
                let cy = c.j * w;

                if (c.walls[0] && this.lineCircleCollide(cx, cy, cx + w, cy, newX, newY, this.radius)) return true;
                if (c.walls[1] && this.lineCircleCollide(cx + w, cy, cx + w, cy + w, newX, newY, this.radius)) return true;
                if (c.walls[2] && this.lineCircleCollide(cx, cy + w, cx + w, cy + w, newX, newY, this.radius)) return true;
                if (c.walls[3] && this.lineCircleCollide(cx, cy, cx, cy + w, newX, newY, this.radius)) return true;
            }

            if (
                newX - this.radius < 0 || newX + this.radius > cols * w ||
                newY - this.radius < 0 || newY + this.radius > rows * w
            ) {
                return true;
            }

            return false;
        }

        lineCircleCollide(x1, y1, x2, y2, cx, cy, r) {
            let dx = x2 - x1;
            let dy = y2 - y1;
            let lenSq = dx * dx + dy * dy;
            if (lenSq === 0) return false;

            let dot = (((cx - x1) * dx) + ((cy - y1) * dy)) / lenSq;

            let closestX, closestY;
            if (dot < 0) {
                closestX = x1; closestY = y1;
            } else if (dot > 1) {
                closestX = x2; closestY = y2;
            } else {
                closestX = x1 + (dot * dx);
                closestY = y1 + (dot * dy);
            }

            let distX = cx - closestX;
            let distY = cy - closestY;
            return (distX * distX + distY * distY) < (r * r);
        }
    }

    // ====== Maze Cell ======
    class Cell {
        constructor(i, j) {
            this.i = i;
            this.j = j;
            this.walls = [true, true, true, true];
            this.visited = false;
            this.isRoom = false;
            this.roomColor = null;
        }

        checkNeighbors() {
            let neighbors = [];
            let top = grid[index(this.i, this.j - 1)];
            let right = grid[index(this.i + 1, this.j)];
            let bottom = grid[index(this.i, this.j + 1)];
            let left = grid[index(this.i - 1, this.j)];

            if (top && !top.visited) neighbors.push(top);
            if (right && !right.visited) neighbors.push(right);
            if (bottom && !bottom.visited) neighbors.push(bottom);
            if (left && !left.visited) neighbors.push(left);

            return (neighbors.length > 0) ? neighbors[Math.floor(Math.random() * neighbors.length)] : undefined;
        }

        show() {
            let x = this.i * w;
            let y = this.j * w;

            if (this.isRoom) {
                ctx.fillStyle = this.roomColor;
                ctx.fillRect(x, y, w, w);
            }

            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 2;

            if (this.walls[0]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); }
            if (this.walls[1]) { ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + w); ctx.stroke(); }
            if (this.walls[2]) { ctx.beginPath(); ctx.moveTo(x + w, y + w); ctx.lineTo(x, y + w); ctx.stroke(); }
            if (this.walls[3]) { ctx.beginPath(); ctx.moveTo(x, y + w); ctx.lineTo(x, y); ctx.stroke(); }
        }
    }

    function index(i, j) {
        if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) return -1;
        return i + j * cols;
    }

    function removeWalls(a, b) {
        let x = a.i - b.i;
        if (x === 1) { a.walls[3] = false; b.walls[1] = false; }
        else if (x === -1) { a.walls[1] = false; b.walls[3] = false; }

        let y = a.j - b.j;
        if (y === 1) { a.walls[0] = false; b.walls[2] = false; }
        else if (y === -1) { a.walls[2] = false; b.walls[0] = false; }
    }

    // Fungsi pembantu render ulang legenda 1 baris
    function renderLegend() {
        let legendHTML = '';
        for (let ans of placedAnswers) {
            legendHTML += `
                <div class="legend-item">
                    <div class="color-box" style="background-color: ${ans.color};"></div>
                    <div class="legend-text" style="color: ${ans.color};">${ans.text}</div>
                </div>
            `;
        }
        document.getElementById('answer-legend-container').innerHTML = legendHTML;
    }

    // ====== Questions / Answers placement ======
    function placeAnswers() {
        placedAnswers = [];

        // prefer dead ends
        let possibleCells = grid.filter(c => {
            if (c.i === 0 && c.j === 0) return false;
            let wallCount = c.walls.filter(Boolean).length;
            return wallCount >= 3;
        });

        if (possibleCells.length < 4) {
            possibleCells = grid.filter(c => !(c.i === 0 && c.j === 0));
        }

        possibleCells.sort(() => Math.random() - 0.5);

        let answersToPlace = [...currentQuestion.answers].sort(() => Math.random() - 0.5);
        const roomColors = ['#ff3333', '#33ccff', '#33ff33', '#ffff33'];

        for (let i = 0; i < 4; i++) {
            let cell = possibleCells.pop();
            if (!cell) break;

            let ansColor = roomColors[i];
            cell.isRoom = true;
            cell.roomColor = ansColor;

            placedAnswers.push({
                text: answersToPlace[i],
                i: cell.i,
                j: cell.j,
                color: ansColor,
                isCorrect: answersToPlace[i] === currentQuestion.correct
            });
        }

        renderLegend();
    }

    function checkAnswer() {
        if (!player) return;

        let checkI = player.i;
        let checkJ = player.j;

        for (let indexAns = 0; indexAns < placedAnswers.length; indexAns++) {
            let ans = placedAnswers[indexAns];

            if (checkI === ans.i && checkJ === ans.j) {
                if (player.justAnswered) return; // avoid spam
                player.justAnswered = true;

                if (ans.isCorrect) {
                    setTimeout(() => {
                        alert("BENAR! Lanjut ke soal berikutnya.");
                        currentQuestionIndex++;

                        if (currentQuestionIndex >= 10) {
                            alert("SELAMAT! Anda telah menjawab ke-10 soal dengan benar dan memenangkan permainan!");
                            location.reload();
                        } else {
                            generateMaze();
                        }
                    }, 80);
                } else {
                    // JAWABAN SALAH -> Pukul mundur pemain sedikit biar ga kena spam looping 
                    let bounceBackX = -Math.sin(heading) * 10;
                    let bounceBackY = Math.cos(heading) * 10;
                    player.x += bounceBackX;
                    player.y += bounceBackY;

                    setTimeout(() => {
                        alert("SALAH! Coba jelajahi ruangan warna lain.");

                        // Menghapus atribut ruang dari grid labirin
                        let cellIndex = index(ans.i, ans.j);
                        if (grid[cellIndex]) {
                            grid[cellIndex].isRoom = false;
                        }

                        // Menghapus elemen dari legenda (Visual bawah)
                        placedAnswers.splice(indexAns, 1);
                        renderLegend();

                        player.justAnswered = false; // Izinkan pemain jalan lagi
                    }, 50);
                    break; // Break loop
                }
            }
        }
    }

    // ====== Setup / Generate Maze ======
    function setup() {
        const wrapper = document.querySelector('.canvas-wrapper');
        const availableHeight = window.innerHeight - 320;
        const availableWidth = wrapper.clientWidth - 20;

        let size = Math.min(availableWidth, availableHeight);
        if (size < 300) size = 300;

        w = (window.innerWidth < 600) ? 40 : 50;

        const adjustedSize = Math.floor(size / w) * w;
        mazeCanvas.width = adjustedSize;
        mazeCanvas.height = adjustedSize;

        cols = Math.floor(mazeCanvas.width / w);
        rows = Math.floor(mazeCanvas.height / w);

        grid = [];
        stack = [];

        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                grid.push(new Cell(i, j));
            }
        }

        currentQuestion = gameQuestions[currentQuestionIndex];
        document.getElementById('question-text').innerText = currentQuestion.question;
        document.getElementById('question-progress').innerText = `Soal ${currentQuestionIndex + 1} dari 10`;

        current = grid[0];

        // DFS maze generation
        while (true) {
            current.visited = true;
            let next = current.checkNeighbors();
            if (next) {
                next.visited = true;
                stack.push(current);
                removeWalls(current, next);
                current = next;
            } else if (stack.length > 0) {
                current = stack.pop();
            } else {
                break;
            }
        }

        placeAnswers();

        player = new Player();
        cameraX = player.x;
        cameraY = player.y;

        // Arahkan pandangan awal otomatis ke lorong labirin yang terbuka
        let startAngle = 0;
        if (grid.length > 0) {
            if (!grid[0].walls[1]) startAngle = Math.PI / 2; // Lorong Kanan Buka
            else if (!grid[0].walls[2]) startAngle = Math.PI; // Lorong Bawah Buka
        }

        // Jika ganti level dan kompas sudah jalan, kalibrasi ulang offset dunianya
        if (compassActive) {
            let currentRawRad = targetHeading + headingOffset;
            headingOffset = currentRawRad - startAngle;
        }

        targetHeading = startAngle;
        heading = startAngle;

        draw();
    }

    function generateMaze() {
        setup();
    }

    // ====== Draw (WORLD rotates by heading) ======
    function draw() {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, mazeCanvas.width, mazeCanvas.height);

        ctx.save();

        // zoom pivot
        let cx = mazeCanvas.width / 2;
        let cy = mazeCanvas.height / 2;

        ctx.translate(cx, cy);
        ctx.scale(cameraZoom, cameraZoom);

        // Rotate WORLD opposite to heading so "forward" feels stable
        ctx.rotate(-heading);

        // KUNCI PENTING: Selalu posisikan kamera persis menekan jejak (kaki) pemain seberapapun zoom-nya.
        // Supaya poros putaran peta berpusat pada pemain, sehingga pemain selalu paten di tengah dan mengarah lurus ke "||"
        ctx.translate(-cameraX, -cameraY);

        // draw maze
        for (let i = 0; i < grid.length; i++) grid[i].show();

        // start cell highlight
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fillRect(0, 0, w, w);

        // draw player (fixed up)
        if (player) player.show();

        ctx.restore();
    }

    // ====== Resize ======
    window.addEventListener('resize', () => {
        // Dinonaktifkan: jangan panggil setup() lagi di sini agar saat scroll HP tidak mereset seluruh game
    });

    // ====== Keyboard fallback (for testing on PC) ======
    const keys = {};
    window.addEventListener('keydown', e => { keys[e.key] = true; });
    window.addEventListener('keyup', e => { keys[e.key] = false; });

    // ====== Optical Flow Camera Movement ======
    let isCameraActive = false;
    let videoElement, processCtx, debugDiv;
    let prevFrameData = null;

    const COMPRESS_W = 80;
    const COMPRESS_H = 60;
    const SEARCH_RANGE = 12;

    let accumulatedDX = 0;
    let accumulatedDY = 0;

    window.startOpticalTracking = async function () {
        if (isCameraActive) return;

        // Orientation permission also here (good for iOS)
        try {
            await requestOrientationPermissionIfNeeded();
        } catch (e) {
            console.warn(e.message);
            // still allow camera without compass
        }

        videoElement = document.getElementById('cameraFeed');
        const processCanvas = document.getElementById('processCanvas');
        debugDiv = document.getElementById('flow-debug');
        processCtx = processCanvas.getContext('2d', { willReadFrequently: true });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: 320, height: 240, frameRate: 30 }
            });
            videoElement.srcObject = stream;
            isCameraActive = true;
            document.getElementById('startCameraBtn').classList.add('active');
            requestAnimationFrame(trackMovement);
        } catch (err) {
            alert("Kamera Error: " + err.message);
        }
    };

    function trackMovement() {
        if (!isCameraActive) return;
        if (!videoElement || videoElement.readyState < 2) {
            requestAnimationFrame(trackMovement);
            return;
        }

        processCtx.drawImage(videoElement, 0, 0, COMPRESS_W, COMPRESS_H);
        const currentFrameData = processCtx.getImageData(0, 0, COMPRESS_W, COMPRESS_H);

        if (prevFrameData) {
            const flow = calculateGlobalFlow(prevFrameData.data, currentFrameData.data);

            // accumulate movement
            accumulatedDX += flow.dx;
            accumulatedDY += flow.dy;

            if (debugDiv) {
                debugDiv.innerText = `AccDX: ${accumulatedDX.toFixed(0)}, AccDY: ${accumulatedDY.toFixed(0)}`;
            }
        }

        prevFrameData = currentFrameData;
        requestAnimationFrame(trackMovement);
    }

    function calculateGlobalFlow(oldImg, newImg) {
        let totalDx = 0;
        let totalDy = 0;

        // 3x3 points (must be safe inside)
        const points = [
            { x: 18, y: 12 }, { x: 36, y: 12 }, { x: 54, y: 12 },
            { x: 18, y: 28 }, { x: 36, y: 28 }, { x: 54, y: 28 },
            { x: 18, y: 44 }, { x: 36, y: 44 }, { x: 54, y: 44 },
        ];

        for (const p of points) {
            const res = blockMatchingSafe(oldImg, newImg, p.x, p.y);
            totalDx += res.dx;
            totalDy += res.dy;
        }

        return { dx: totalDx / points.length, dy: totalDy / points.length };
    }

    // FIXED: bounds-safe block matching (prevents NaN)
    function blockMatchingSafe(oldImg, newImg, startX, startY) {
        const blockSize = 8;
        let bestDx = 0, bestDy = 0;
        let minSAD = Infinity;

        // clamp to prevent out-of-bounds
        const minDx = Math.max(-SEARCH_RANGE, -startX);
        const maxDx = Math.min(SEARCH_RANGE, COMPRESS_W - blockSize - startX);
        const minDy = Math.max(-SEARCH_RANGE, -startY);
        const maxDy = Math.min(SEARCH_RANGE, COMPRESS_H - blockSize - startY);

        for (let dy = minDy; dy <= maxDy; dy++) {
            for (let dx = minDx; dx <= maxDx; dx++) {
                let sad = 0;

                for (let y = 0; y < blockSize; y++) {
                    for (let x = 0; x < blockSize; x++) {
                        const idxOld = ((startY + y) * COMPRESS_W + (startX + x)) * 4;
                        const idxNew = ((startY + y + dy) * COMPRESS_W + (startX + x + dx)) * 4;

                        // Green channel only
                        sad += Math.abs(oldImg[idxOld + 1] - newImg[idxNew + 1]);
                    }
                }

                if (sad < minSAD) {
                    minSAD = sad;
                    bestDx = dx;
                    bestDy = dy;
                }
            }
        }

        return { dx: bestDx, dy: bestDy };
    }

    // ====== Main Game Loop ======
    let lastTime = performance.now();

    function gameLoop(time) {
        let dt = (time - lastTime) / 1000;
        lastTime = time;
        if (dt > 0.1) dt = 0.1;

        if (player) {
            // smooth heading
            heading = lerpAngle(heading, targetHeading, 10 * dt);

            // manual rotate if no compass (for testing)
            if (!compassActive) {
                if (keys['ArrowLeft'] || keys['a'] || keys['A']) targetHeading -= 3 * dt;
                if (keys['ArrowRight'] || keys['d'] || keys['D']) targetHeading += 3 * dt;
            }

            // keyboard input (relative to screen)
            let kbForward = 0, kbRight = 0;
            if (keys['w'] || keys['W'] || keys['ArrowUp']) kbForward += 1;
            if (keys['s'] || keys['S'] || keys['ArrowDown']) kbForward -= 1;
            if (keys['q'] || keys['Q']) kbRight -= 1;
            if (keys['e'] || keys['E']) kbRight += 1;

            // normalize diagonal
            if (kbForward !== 0 && kbRight !== 0) {
                const len = Math.sqrt(kbForward * kbForward + kbRight * kbRight);
                kbForward /= len;
                kbRight /= len;
            }

            const speed = 150; // px/sec

            // optical flow -> relative motion (screen frame)
            let optForward = 0;
            let optRight = 0;

            if (isMoveButtonPressed) {
                // Damping & scaling (feel free adjust)
                if (Math.abs(accumulatedDY) > 0.5) {
                    optForward += accumulatedDY * 30.0;
                    accumulatedDY *= 0.85;
                } else {
                    accumulatedDY *= 0.95;
                }

                if (Math.abs(accumulatedDX) > 0.5) {
                    optRight -= accumulatedDX * 30.0;
                    accumulatedDX *= 0.85;
                } else {
                    accumulatedDX *= 0.95;
                }
            } else {
                // Jika tombol tidak ditahan, reset sisa pergerakan flow agar tidak menyentak saat baru dipencet
                accumulatedDX = 0;
                accumulatedDY = 0;
            }

            // total screen-relative movement (forward/right)
            const totalForward = (kbForward * speed * dt) + (optForward * dt);
            const totalRight = (kbRight * speed * dt) + (optRight * dt);

            // Convert screen-relative -> world using heading
            let vx = totalForward * Math.sin(heading) + totalRight * Math.cos(heading);
            let vy = totalForward * -Math.cos(heading) + totalRight * Math.sin(heading);

            vx *= moveSensitivity;
            vy *= moveSensitivity;

            if (vx !== 0 || vy !== 0) player.moveContinuous(vx, vy);

            // camera follow
            cameraX = lerp(cameraX, player.x, 5 * dt);
            cameraY = lerp(cameraY, player.y, 5 * dt);
        }

        draw();
        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
})();