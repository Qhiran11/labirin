const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

let cols, rows;
let w = 40; // Default Cell size
let grid = [];
let current;
let stack = [];
let currentQuestion = {
    question: "Pertanyaan default...",
    answers: ["A", "B", "C", "D"],
    correct: "A"
};
let placedAnswers = [];

// KONFIGURASI GPS OPTIMASI
const METERS_PER_CELL = 5;      // 1 Kotak = 5 Meter (Lebih stabil untuk jalan kaki)
const ACCURACY_THRESHOLD = 20;  // Abaikan sinyal jika akurasi > 20 meter
let startLat = null;
let startLon = null;
let watchId = null;

let gameQuestions = [];
let currentQuestionIndex = 0;

// On Load: Bangun 10 Form Input Soal
window.onload = () => {
    const formContainer = document.getElementById('questions-form');
    for (let i = 0; i < 10; i++) {
        let block = document.createElement('div');
        block.className = 'question-block';
        block.innerHTML = `
            <strong>Soal ${i + 1}</strong>
            <label>Pertanyaan:</label><input type="text" id="q${i}_text">
            <label>Jawaban Benar:</label><input type="text" id="q${i}_ans_true">
            <label>Pilihan Salah 1:</label><input type="text" id="q${i}_ans_f1">
            <label>Pilihan Salah 2:</label><input type="text" id="q${i}_ans_f2">
            <label>Pilihan Salah 3:</label><input type="text" id="q${i}_ans_f3">
        `;
        formContainer.appendChild(block);
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

window.startGame = function () {
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
    setup(); // Start internal game
};

// UI Toggles
window.openHelpModal = () => document.getElementById('helpModal').style.display = 'flex';
window.closeHelpModal = () => document.getElementById('helpModal').style.display = 'none';

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

let player;

let cameraZoom = 1.0;
document.getElementById('zoomSlider').addEventListener('input', (e) => {
    cameraZoom = parseFloat(e.target.value);
});

let moveSensitivity = 1.0;
document.getElementById('sensitivitySlider').addEventListener('input', (e) => {
    moveSensitivity = parseFloat(e.target.value);
});

let compassActive = false;
let compassOffset = 0;

window.addEventListener("deviceorientation", (event) => {
    let alpha = event.alpha;
    if (event.webkitCompassHeading) {
        alpha = event.webkitCompassHeading;
    }
    if (alpha !== null) {
        compassActive = true;
        // Koreksi arah putar perangkat terbalik (dihilangkan negatifnya)
        let rad = alpha * (Math.PI / 180);
        if (player) {
            player.angle = rad - compassOffset;
        }
    }
}, true);

window.resetCompass = function () {
    if (compassActive && player) {
        let currentRawRad = player.angle + compassOffset;
        compassOffset = currentRawRad;
        player.angle = 0;
    }
};

class Player {
    constructor() {
        this.radius = w / 3;
        this.x = w / 2;
        this.y = w / 2;
        this.angle = 0;
        this.targetAngle = 0; // Untuk lerp rotasi
    }

    get i() { return Math.floor(this.x / w); }
    get j() { return Math.floor(this.y / w); }

    show() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        let size = w / 2.5;
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.8, size);
        ctx.lineTo(0, size * 0.5);
        ctx.lineTo(-size * 0.8, size);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ffffff";
        ctx.fill();
        ctx.restore();
    }

    moveContinuous(vx, vy) {
        if (!this.checkCollision(this.x + vx, this.y)) {
            this.x += vx;
        }
        if (!this.checkCollision(this.x, this.y + vy)) {
            this.y += vy;
        }

        if ((Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) && !compassActive) {
            this.targetAngle = Math.atan2(vy, vx) + Math.PI / 2;
        }

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

        if (newX - this.radius < 0 || newX + this.radius > cols * w ||
            newY - this.radius < 0 || newY + this.radius > rows * w) {
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
            closestX = x1;
            closestY = y1;
        } else if (dot > 1) {
            closestX = x2;
            closestY = y2;
        } else {
            closestX = x1 + (dot * dx);
            closestY = y1 + (dot * dy);
        }

        let distX = cx - closestX;
        let distY = cy - closestY;
        return (distX * distX + distY * distY) < (r * r);
    }
}

function checkAnswer() {
    let checkI = player.i;
    let checkJ = player.j;

    for (let ans of placedAnswers) {
        if (checkI === ans.i && checkJ === ans.j) {
            // Mencegah spaming trigger bertubi-tubi
            if (player.justAnswered) return;
            player.justAnswered = true;

            if (ans.isCorrect) {
                setTimeout(() => {
                    alert("BENAR! Lanjut ke soal berikutnya.");
                    currentQuestionIndex++;
                    if (currentQuestionIndex >= 10) {
                        alert("SELAMAT! Anda telah menjawab ke-10 soal dengan benar dan memenangkan permainan!");
                        location.reload(); // Restart ke Form Input
                    } else {
                        generateMaze();
                    }
                }, 100);
            } else {
                setTimeout(() => {
                    alert("SALAH! Coba jelajahi ruangan warna lain.");
                    player.justAnswered = false; // Boleh jawab lagi jika masuk ulang
                }, 100);
            }
        }
    }
}

function setup() {
    const wrapper = document.querySelector('.canvas-wrapper');
    const availableHeight = window.innerHeight - 320;
    const availableWidth = wrapper.clientWidth - 20;

    let size = Math.min(availableWidth, availableHeight);
    if (size < 300) size = 300;

    w = (window.innerWidth < 600) ? 40 : 50;

    const adjustedSize = Math.floor(size / w) * w;
    canvas.width = adjustedSize;
    canvas.height = adjustedSize;

    cols = Math.floor(canvas.width / w);
    rows = Math.floor(canvas.height / w);

    grid = [];
    stack = [];

    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            grid.push(new Cell(i, j));
        }
    }

    // Set the current question
    currentQuestion = gameQuestions[currentQuestionIndex];
    document.getElementById('question-text').innerText = currentQuestion.question;
    document.getElementById('question-progress').innerText = `Soal ${currentQuestionIndex + 1} dari 10`;

    current = grid[0];

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
    draw();
}

function generateMaze() {
    setup();
}

// --- LOGIKA OPTICAL FLOW (Kamera Navigasi) ---
// --- LOGIKA OPTICAL FLOW V2 (ROBUST VERSION) ---
let isCameraActive = false;
let videoElement, processCtx, debugDiv;
let prevFrameData = null;

const COMPRESS_W = 80;  // Naikkan sedikit resolusi untuk detail tekstur
const COMPRESS_H = 60;
const ACCUMULATOR_THRESHOLD = 50; // Jarak gerak HP (dalam unit flow) untuk pindah 1 kotak
const SEARCH_RANGE = 12; // Jangkauan pencarian lebih luas

let accumulatedDX = 0;
let accumulatedDY = 0;

async function startOpticalTracking() {
    if (isCameraActive) return;
    videoElement = document.getElementById('cameraFeed');
    const canvas = document.getElementById('processCanvas');
    debugDiv = document.getElementById('flow-debug');
    processCtx = canvas.getContext('2d', { willReadFrequently: true });

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
}

function trackMovement() {
    if (!isCameraActive) return;

    processCtx.drawImage(videoElement, 0, 0, COMPRESS_W, COMPRESS_H);
    const currentFrameData = processCtx.getImageData(0, 0, COMPRESS_W, COMPRESS_H);

    if (prevFrameData) {
        const flow = calculateGlobalFlow(prevFrameData.data, currentFrameData.data);

        // Akumulasi gerakan (seperti sensor mouse mengumpulkan DPI)
        accumulatedDX += flow.dx;
        accumulatedDY += flow.dy;

        debugDiv.innerText = `AccDX: ${accumulatedDX.toFixed(0)}, AccDY: ${accumulatedDY.toFixed(0)}`;

        // Pergerakan pemain sekarang ditangani di dalam gameLoop utama
    }

    prevFrameData = currentFrameData;
    requestAnimationFrame(trackMovement);
}

// Menganalisis 9 titik (Grid 3x3) untuk kestabilan
function calculateGlobalFlow(oldImg, newImg) {
    let totalDx = 0;
    let totalDy = 0;
    let points = [
        { x: 20, y: 15 }, { x: 40, y: 15 }, { x: 60, y: 15 },
        { x: 20, y: 30 }, { x: 40, y: 30 }, { x: 60, y: 30 },
        { x: 20, y: 45 }, { x: 40, y: 45 }, { x: 60, y: 45 }
    ];

    points.forEach(p => {
        let res = blockMatching(oldImg, newImg, p.x, p.y);
        totalDx += res.dx;
        totalDy += res.dy;
    });

    return { dx: totalDx / points.length, dy: totalDy / points.length };
}

function blockMatching(oldImg, newImg, startX, startY) {
    const blockSize = 8;
    let bestDx = 0;
    let bestDy = 0;
    let minSAD = Infinity;

    for (let dy = -SEARCH_RANGE; dy <= SEARCH_RANGE; dy++) {
        for (let dx = -SEARCH_RANGE; dx <= SEARCH_RANGE; dx++) {
            let sad = 0;
            for (let y = 0; y < blockSize; y++) {
                for (let x = 0; x < blockSize; x++) {
                    const idxOld = ((startY + y) * COMPRESS_W + (startX + x)) * 4;
                    const idxNew = ((startY + y + dy) * COMPRESS_W + (startX + x + dx)) * 4;

                    // Gunakan Green Channel saja (lebih tajam untuk tekstur)
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
// --- END LOGIKA OPTICAL FLOW ---
function placeAnswers() {
    placedAnswers = [];

    // Cari kamar buntu (dead-end: kotak dgn minimal 3 tembok pembatas tertutup)
    let possibleCells = grid.filter(c => {
        if (c.i === 0 && c.j === 0) return false;
        let wallCount = c.walls.filter(w => w).length;
        return wallCount >= 3;
    });

    // Jika dead-end kurang dari 4 (jarang terjadi tapi mungkin untuk map kecil), ambil cell acak
    if (possibleCells.length < 4) {
        possibleCells = grid.filter(c => !(c.i === 0 && c.j === 0));
    }

    possibleCells.sort(() => Math.random() - 0.5);

    let answersToPlace = [...currentQuestion.answers].sort(() => Math.random() - 0.5);
    const roomColors = ['#ff3333', '#33ccff', '#33ff33', '#ffff33'];

    let legendHTML = '';

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

        legendHTML += `
            <div class="legend-item">
                <div class="color-box" style="background-color: ${ansColor};"></div>
                <div class="legend-text" style="color: ${ansColor};">${answersToPlace[i]}</div>
            </div>
        `;
    }

    document.getElementById('answer-legend-container').innerHTML = legendHTML;
}

function index(i, j) {
    if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) return -1;
    return i + j * cols;
}

class Cell {
    constructor(i, j) {
        this.i = i;
        this.j = j;
        this.walls = [true, true, true, true];
        this.visited = false;
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

function removeWalls(a, b) {
    let x = a.i - b.i;
    if (x === 1) { a.walls[3] = false; b.walls[1] = false; }
    else if (x === -1) { a.walls[1] = false; b.walls[3] = false; }
    let y = a.j - b.j;
    if (y === 1) { a.walls[0] = false; b.walls[2] = false; }
    else if (y === -1) { a.walls[2] = false; b.walls[0] = false; }
}

let cameraX = 0;
let cameraY = 0;

function draw() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Tentukan pusat fokus zoom (ke labirin jika zoom out, ke karakter jika sebaliknya)
    let cx = canvas.width / 2;
    let cy = canvas.height / 2;

    ctx.translate(cx, cy);
    ctx.scale(cameraZoom, cameraZoom);

    if (cameraZoom < 1.0) {
        // Fokuskan bagian tengah seluruh labirin (grid.length mengacu jumlah cell, total map cols*w x rows*w)
        let mazeCenterX = (cols * w) / 2;
        let mazeCenterY = (rows * w) / 2;
        ctx.translate(-mazeCenterX, -mazeCenterY);
    } else {
        // Fokus ke kamera mini-map (yang di-lerp)
        if (player) {
            ctx.translate(-cameraX, -cameraY);
        }
    }

    for (let i = 0; i < grid.length; i++) grid[i].show();

    // FillText dihapus karena jawaban kini direpresentasikan sebagai kotak warna The Room

    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.fillRect(0, 0, w, w);

    if (player) player.show();

    ctx.restore();
}

// Hapus pemanggilan setip awal karena Setup Screen menanganinya.
window.addEventListener('resize', () => {
    if (document.getElementById('game-screen').style.display === 'block') {
        setup();
    }
});

// Keyboard support for testing in browser
const keys = {};
window.addEventListener('keydown', e => Object.assign(keys, { [e.key]: true }));
window.addEventListener('keyup', e => Object.assign(keys, { [e.key]: false }));

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

let lastTime = performance.now();
function gameLoop(time) {
    let dt = (time - lastTime) / 1000;
    lastTime = time;
    if (dt > 0.1) dt = 0.1;

    if (player) {
        let speed = 150; // pixels per sec
        let vx = 0; let vy = 0;

        if (keys['ArrowUp'] || keys['w'] || keys['W']) vy -= 1;
        if (keys['ArrowDown'] || keys['s'] || keys['S']) vy += 1;
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) vx -= 1;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) vx += 1;

        // Normalisasi pergerakan diagonal (agar tidak lebih cepat)
        if (vx !== 0 && vy !== 0) {
            let length = Math.sqrt(vx * vx + vy * vy);
            vx /= length;
            vy /= length;
        }

        vx *= speed * dt;
        vy *= speed * dt;

        // Optical flow movement integration
        if (Math.abs(accumulatedDX) > 0.5) {
            vx -= accumulatedDX * 3.0 * dt;
            accumulatedDX *= 0.8;
        }
        if (Math.abs(accumulatedDY) > 0.5) {
            vy -= accumulatedDY * 3.0 * dt;
            accumulatedDY *= 0.8;
        }

        // Terapkan modifier sensitivitas dari slider
        vx *= moveSensitivity;
        vy *= moveSensitivity;

        if (vx !== 0 || vy !== 0) {
            player.moveContinuous(vx, vy);
        }

        // --- MANAJEMEN LERP (ANIMASI HALUS) ---
        // 1. Lerp Rotasi Arah Player
        if (!compassActive) {
            let diff = player.targetAngle - player.angle;
            // Koreksi sudut terpendek (menghindari putaran 360 derajat aneh)
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            player.angle += diff * 10 * dt; // Kecepatan putar sudut (10)
        }

        // 2. Lerp Penyusutan Kamera (Mini-map style)
        cameraX = lerp(cameraX, player.x, 5 * dt);
        cameraY = lerp(cameraY, player.y, 5 * dt);
    }

    draw();
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);