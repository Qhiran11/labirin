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

    // ====== Multiplayer State ======
    let isHost = false;
    let peer = null;            // PeerJS instance
    let myPlayerId = null;      // "Host" or "P1", "P2"...
    let hostConnection = null;  // For players: connection to Host
    let connections = [];       // For host: list of connections to generic players
    let playersData = {};       // Game state of all participants { P1: {x,y, heading, color, score}, P2... }
    let gameTimer = 360;        // 6 Menit (360 detik)
    let timerInterval = null;

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
        // Form generation ditunda sampai Host di-klik di role-selection

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

    // Role Selection Logic
    window.selectRole = function (role) {
        document.getElementById('role-selection-screen').style.display = 'none';

        if (role === 'host') {
            isHost = true;
            document.getElementById('host-setup-screen').style.display = 'block';

            // Build Question Form
            const formContainer = document.getElementById('questions-form');
            formContainer.innerHTML = ''; // reset
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

            // Initiate WebRTC Network as Host Master
            initHostPeer();
        } else {
            isHost = false;
            document.getElementById('player-setup-screen').style.display = 'block';
        }
    };

    window.fillDefaultQuestions = function () {
        for (let i = 0; i < 10; i++) {
            let el = document.getElementById(`q${i}_text`);
            if (el) el.value = `Soal Default ${i + 1}: Dimana Bumi?`;

            let aT = document.getElementById(`q${i}_ans_true`);
            if (aT) aT.value = `Tata Surya ${i + 1}`;

            let f1 = document.getElementById(`q${i}_ans_f1`);
            if (f1) f1.value = "Andromeda";

            let f2 = document.getElementById(`q${i}_ans_f2`);
            if (f2) f2.value = "Bima Sakti";

            let f3 = document.getElementById(`q${i}_ans_f3`);
            if (f3) f3.value = "Sirius";
        }
    };

    // ====== P2P Network Initialization ======
    function generateRoomId() {
        return Math.random().toString(36).substring(2, 7).toUpperCase();
    }

    function initHostPeer() {
        const roomId = generateRoomId();
        peer = new Peer(roomId);

        peer.on('open', (id) => {
            document.getElementById('hostRoomIdDisplay').innerText = id;
            myPlayerId = 'Host';
        });

        peer.on('connection', (conn) => {
            if (connections.length >= 4) {
                conn.send({ type: 'error', message: 'Room penuh (Maks 4 Pemain)!' });
                setTimeout(() => conn.close(), 500);
                return;
            }

            let pName = (conn.metadata && conn.metadata.playerName) ? conn.metadata.playerName : ('P' + (connections.length + 1));
            let newPlayerId = pName;

            // Cegah duplikasi nama (contoh: jika ada yang daftar pakai nama sama)
            if (connections.find(c => c.playerId === newPlayerId)) {
                newPlayerId += "_" + Math.floor(Math.random() * 100);
            }

            conn.playerId = newPlayerId;
            connections.push(conn);

            updateHostWaitingList();

            conn.on('data', (data) => {
                handleHostReceiveData(conn.playerId, data);
            });

            conn.on('close', () => {
                connections = connections.filter(c => c !== conn);
                updateHostWaitingList();
                
                if (document.getElementById('host-setup-screen').style.display !== 'none') {
                    alert(`Pemain ${conn.playerId} telah meninggalkan lobi.`);
                } else {
                    alert(`Pemain ${conn.playerId} terputus dari permainan.`);
                    if(playersData[conn.playerId]) {
                        delete playersData[conn.playerId];
                    }
                    if(isHost) {
                        updateHostScoreboard();
                    }
                }
                
                broadcastToPlayers({ type: 'player_left', playerId: conn.playerId });
            });

            conn.send({ type: 'assigned_id', playerId: newPlayerId });
        });

        peer.on('error', (err) => {
            console.error(err);
            alert("Koneksi Host Error: " + err.message);
        });
    }

    function updateHostWaitingList() {
        document.getElementById('playerCount').innerText = connections.length;
        const ul = document.getElementById('waitingPlayersList');
        ul.innerHTML = '';
        if (connections.length === 0) {
            ul.innerHTML = '<li style="color: #666;">Belum ada pemain bergabung</li>';
            document.getElementById('startGameBtn').style.opacity = '0.5';
            document.getElementById('startGameBtn').disabled = true;
        } else {
            connections.forEach((c) => {
                let li = document.createElement('li');
                li.style.color = '#fff';
                li.innerText = c.playerId + ' Berhasil Terhubung';
                ul.appendChild(li);
            });
            document.getElementById('startGameBtn').style.opacity = '1';
            document.getElementById('startGameBtn').disabled = false;
        }
    }

    function broadcastToPlayers(data) {
        connections.forEach(c => c.send(data));
    }

    function handleHostReceiveData(playerId, data) {
        if (data.type === 'player_moved') {
            if (!playersData[playerId]) playersData[playerId] = {};
            playersData[playerId].x = data.x;
            playersData[playerId].y = data.y;
            playersData[playerId].heading = data.heading;

            // Broadcast pergerakan ke semua temannya
            connections.forEach(c => {
                if (c.playerId !== playerId) {
                    c.send({ type: 'enemy_moved', playerId: playerId, x: data.x, y: data.y, heading: data.heading, color: playersData[playerId].color });
                }
            });
        }
        else if (data.type === 'check_answer') {
            processAnswerHit(playerId, data.i, data.j); // logika host verifikasi nanti
        }
    }

    window.joinGame = function () {
        const playerNameInput = document.getElementById('joinPlayerNameInput');
        let playerName = "";
        if (playerNameInput) playerName = playerNameInput.value.trim();

        if (!playerName) { alert("Masukkan nama Anda!"); return; }

        const destId = document.getElementById('joinRoomIdInput').value.trim().toUpperCase();
        if (!destId) { alert("Masukkan kode room!"); return; }

        document.getElementById('joinRoomBtn').style.display = 'none';
        const stDiv = document.getElementById('player-waiting-status');
        const stText = document.getElementById('playerWaitText');
        stDiv.style.display = 'block';
        stText.innerText = "Mencari Host...";

        peer = new Peer();

        peer.on('open', (id) => {
            hostConnection = peer.connect(destId, { reliable: true, metadata: { playerName: playerName } });

            hostConnection.on('open', () => {
                stText.innerText = "Terhubung! Menunggu Host memulai permainan...";
            });

            hostConnection.on('data', (data) => {
                handlePlayerReceiveData(data);
            });

            hostConnection.on('close', () => {
                alert("Koneksi terputus dari Host.");
                location.reload();
            });
        });

        peer.on('error', (err) => {
            stDiv.style.display = 'none';
            document.getElementById('joinRoomBtn').style.display = 'block';
            alert("Gagal konek: " + err.message);
        });
    };

    let playerScoreReal = 0.0;

    function updateHostScoreboard() {
        if (!isHost) return;
        const hostSb = document.getElementById('host-scoreboard');
        const hostSbList = document.getElementById('host-score-list');
        if (hostSb && hostSbList) {
            hostSb.style.display = 'block';
            let html = "";
            let sortedPlayers = Object.keys(playersData).map(pId => {
                return { name: pId, score: playersData[pId].score || 0, color: playersData[pId].color || '#fff' };
            }).sort((a,b) => b.score - a.score);

            sortedPlayers.forEach(p => {
                html += `<div style="margin-bottom:5px;"><span style="color:${p.color}; font-weight:bold;">${p.name}:</span> ${p.score.toFixed(1)}</div>`;
            });
            hostSbList.innerHTML = html;
        }
    }

    function updateMyScore(added) {
        playerScoreReal += added;
        document.getElementById('player-my-score').innerText = playerScoreReal.toFixed(1);
    }

    function handlePlayerReceiveData(data) {
        if (data.type === 'error') {
            alert(data.message);
            location.reload();
        }
        else if (data.type === 'assigned_id') {
            myPlayerId = data.playerId;
        }
        else if (data.type === 'game_start') {
            startGameAsPlayer(data);
        }
        else if (data.type === 'player_left') {
            if (playersData[data.playerId]) {
                delete playersData[data.playerId];
            }
        }
        else if (data.type === 'enemy_moved') {
            if (!playersData[data.playerId]) playersData[data.playerId] = {};
            playersData[data.playerId].x = data.x;
            playersData[data.playerId].y = data.y;
            playersData[data.playerId].heading = data.heading;
            playersData[data.playerId].color = data.color;
        }
        else if (data.type === 'answer_result') {
            if (data.isCorrect) {
                 if (data.triggerPlayerId === myPlayerId) {
                     updateMyScore(1.0);
                 }
            } else {
                if (data.triggerPlayerId === myPlayerId) {
                    updateMyScore(-0.1);
                }
                // Singkirkan labirin salah
                let cellIndex = index(data.i, data.j);
                if (grid[cellIndex]) grid[cellIndex].isRoom = false;
                placedAnswers = placedAnswers.filter(a => !(a.i === data.i && a.j === data.j));
                renderLegend();
            }
        }
        else if (data.type === 'next_question') {
            currentQuestionIndex++;
            currentQuestion = gameQuestions[currentQuestionIndex];
            document.getElementById('question-text').innerText = currentQuestion.question;
            document.getElementById('question-progress').innerText = `Soal ${currentQuestionIndex + 1} dari 10`;
            generateMazeFromData(data.mazeData, data.answersData, data.startX, data.startY);
        }
        else if (data.type === 'timer_update') {
            const timeDiv = document.getElementById('game-timer');
            timeDiv.style.display = 'block';

            let m = Math.floor(data.time / 60).toString().padStart(2, '0');
            let s = (data.time % 60).toString().padStart(2, '0');
            timeDiv.innerText = `${m}:${s}`;
        }
        else if (data.type === 'game_over_ranking') {
            showRankingUI(data.leaderboard);
        }
        else if (data.type === 'game_over_time') {
            alert("Waktu Berakhir! Permainan dihentikan.");
            location.reload();
        }
    }

    // Start game
    window.startGame = async function () {
        if (connections.length === 0) {
            alert("Tunggu setidaknya 1 pemain untuk bergabung sebelum memulai permainan!");
            return;
        }

        // Request orientation permission early (user gesture) for iOS
        try {
            await requestOrientationPermissionIfNeeded();
        } catch (e) {
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

        document.getElementById('role-selection-screen').style.display = 'none';
        document.getElementById('host-setup-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        document.getElementById('player-score-hud').style.display = 'flex';

        currentQuestionIndex = 0;

        // Buat Labirin Root
        let seed = Math.floor(Math.random() * 9999);
        mazeSeed = seed;
        setupMultiplayerGrid();

        // Tentukan Posisi Acak untuk tiap klien
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6']; // Merah, Biru, Hijau, Ungu

        connections.forEach((c, index) => {
            let startPos = getRandomEmptyCell();
            let cColor = colors[index % colors.length];

            // simpan data lokal host
            playersData[c.playerId] = { x: startPos.x, y: startPos.y, heading: 0, color: cColor, score: 0.0 };

            c.send({
                type: 'game_start',
                questions: gameQuestions,
                mazeData: serializeGrid(),
                answersData: placedAnswers,
                startX: startPos.x,
                startY: startPos.y,
                color: cColor
            });
        });

        // Host spectate mode: kamera di pusat, agar melihat seluruh map bebas
        cameraX = cols * w / 2;
        cameraY = rows * w / 2;
        cameraZoom = 0.5;

        heading = 0;
        targetHeading = 0;

        // Hilangkan navigasi manual (karena Host diam)
        document.querySelector('.sensor-controls').style.display = 'none';
        document.getElementById('moveBtn').style.display = 'none';

        draw();
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

    // ===== PRNG untuk Sinkronisasi Labirin (Host & Player layouts match) =====
    let mazeSeed = 1;
    function myRandom() {
        let x = Math.sin(mazeSeed++) * 10000;
        return x - Math.floor(x);
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

            return (neighbors.length > 0) ? neighbors[Math.floor(myRandom() * neighbors.length)] : undefined;
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
                    <div class="color-box" style="background-color: ${ans.color}; width: 20px; height: 20px;"></div>
                    <div class="legend-text" style="color: ${ans.color}; font-size: 0.8rem;" >${ans.text}</div>
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

        possibleCells.sort(() => myRandom() - 0.5);

        let answersToPlace = [...currentQuestion.answers].sort(() => myRandom() - 0.5);
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

        // Host bisa melihat legenda. Pemain juga bisa.
        renderLegend();
    }

    function checkAnswer() {
        if (!player) return;

        let checkI = player.i;
        let checkJ = player.j;

        for (let indexAns = 0; indexAns < placedAnswers.length; indexAns++) {
            let ans = placedAnswers[indexAns];

            if (checkI === ans.i && checkJ === ans.j) {
                if (player.justAnswered) return;
                player.justAnswered = true;

                // Jangan evaluasi langsung, KIRIM ke Host (Verification Endpoint)
                if (!isHost && hostConnection) {
                    hostConnection.send({ type: 'check_answer', i: ans.i, j: ans.j });
                }
                break;
            }
        }
    }

    // Hanya dipanggil oleh Host sebagai Game Master
    function processAnswerHit(triggerPlayerId, i, j) {
        let targetAns = placedAnswers.find(a => a.i === i && a.j === j);
        if (!targetAns) return; // sudah ga ada

        if (targetAns.isCorrect) {
            if (playersData[triggerPlayerId]) playersData[triggerPlayerId].score += 1.0;
            if (isHost) updateHostScoreboard();

            // Beri tahu semua
            broadcastToPlayers({ type: 'answer_result', isCorrect: true, triggerPlayerId: triggerPlayerId });

            // Host logic next question
            currentQuestionIndex++;
            if (currentQuestionIndex >= 10) {
                finishGameAndShowRanking();
            } else {
                setupMultiplayerGrid();

                cameraX = cols * w / 2;
                cameraY = rows * w / 2;
                draw();

                connections.forEach((c) => {
                    let startPos = getRandomEmptyCell();
                    if (playersData[c.playerId]) {
                        playersData[c.playerId].x = startPos.x;
                        playersData[c.playerId].y = startPos.y;
                    }
                    c.send({
                        type: 'next_question',
                        mazeData: serializeGrid(),
                        answersData: placedAnswers,
                        startX: startPos.x,
                        startY: startPos.y
                    });
                });
            }
        } else {
            if (playersData[triggerPlayerId]) playersData[triggerPlayerId].score -= 0.1;
            if (isHost) updateHostScoreboard();

            // Beri tahu salah ruang ini dihapus
            broadcastToPlayers({ type: 'answer_result', isCorrect: false, triggerPlayerId: triggerPlayerId, i: i, j: j });

            // Hapus di Host juga
            let cellIndex = index(i, j);
            if (grid[cellIndex]) grid[cellIndex].isRoom = false;
            placedAnswers = placedAnswers.filter(a => !(a.i === i && a.j === j));
            renderLegend();
        }
    }



    // Dapatkan sel kosong acak untuk spawn player (Bukan 0,0 dan Bukan isRoom)
    window.getRandomEmptyCell = function () {
        let emptyCells = grid.filter(c => !c.isRoom && (c.i !== 0 || c.j !== 0));
        let c = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        if (!c) c = grid[0];
        return { x: c.i * w + w / 2, y: c.j * w + w / 2 };
    };

    function setupMultiplayerGrid() {
        // Untuk Multiplayer P2P, Ukuran Labirin (kolom x baris) HARUS absolut identik
        // bagi Host maupun Player terlepas dari seberapa besar layar HP mereka.
        w = 40;
        cols = 10;
        rows = 10;

        // Resolusi Asli Canvas (Bukan tampilan CSS)
        mazeCanvas.width = cols * w;
        mazeCanvas.height = rows * w;

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

        // DFS maze generation pakai PRNG
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

        // Membuat labirin lebih terbuka (Multiple interconnecting routes)
        // Membobol tembok internal ekstra untuk menciptakan jalur alternatif
        let loopsToCreate = 12; // Menambahkan beberapa jalan pintas
        for (let l = 0; l < loopsToCreate; l++) {
            let rndIndex = Math.floor(myRandom() * grid.length);
            let rc = grid[rndIndex];
            
            let startDir = Math.floor(myRandom() * 4);
            for(let d=0; d<4; d++) {
                let dir = (startDir + d) % 4;
                if(rc.walls[dir]) {
                    let neighbor = null;
                    if(dir === 0 && rc.j > 0) neighbor = grid[index(rc.i, rc.j-1)];
                    if(dir === 1 && rc.i < cols-1) neighbor = grid[index(rc.i+1, rc.j)];
                    if(dir === 2 && rc.j < rows-1) neighbor = grid[index(rc.i, rc.j+1)];
                    if(dir === 3 && rc.i > 0) neighbor = grid[index(rc.i-1, rc.j)];

                    if(neighbor) {
                        removeWalls(rc, neighbor);
                        break;
                    }
                }
            }
        }

        placeAnswers();
    }

    function serializeGrid() {
        return grid.map(c => ({ w: [...c.walls], i: c.isRoom, c: c.roomColor }));
    }

    function generateMazeFromData(mazeData, answersData, startX, startY) {
        w = 40; cols = 10; rows = 10;
        mazeCanvas.width = cols * w; mazeCanvas.height = rows * w;
        grid = [];
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                let cell = new Cell(i, j);
                let idx = index(i, j);
                if (mazeData && mazeData[idx]) {
                    cell.walls = [...mazeData[idx].w];
                    cell.isRoom = mazeData[idx].i;
                    cell.roomColor = mazeData[idx].c;
                }
                grid.push(cell);
            }
        }
        placedAnswers = answersData || [];
        renderLegend();

        // Atur player ke posisi awal dari host
        player = new Player();
        player.x = startX;
        player.y = startY;
        cameraX = player.x;
        cameraY = player.y;

        // Auto align pandangan ke arah buka
        let startAngle = 0;
        let cI = Math.floor(startX / w);
        let cJ = Math.floor(startY / w);
        let cIdx = index(cI, cJ);
        if (grid[cIdx]) {
            if (!grid[cIdx].walls[1]) startAngle = Math.PI / 2;
            else if (!grid[cIdx].walls[2]) startAngle = Math.PI;
            else if (!grid[cIdx].walls[0]) startAngle = -Math.PI / 2;
        }

        if (compassActive) {
            let currentRawRad = targetHeading + headingOffset;
            headingOffset = currentRawRad - startAngle;
        }

        targetHeading = startAngle;
        heading = startAngle;

        draw();
    }

    window.startGameAsPlayer = function (data) {
        let setupScreen = document.getElementById('setup-screen');
        if (setupScreen) setupScreen.style.display = 'none';

        document.getElementById('role-selection-screen').style.display = 'none';
        document.getElementById('player-setup-screen').style.display = 'none';

        document.getElementById('game-screen').style.display = 'block';
        document.getElementById('player-score-hud').style.display = 'flex';

        gameQuestions = data.questions;
        currentQuestionIndex = 0;

        currentQuestion = gameQuestions[currentQuestionIndex];
        document.getElementById('question-text').innerText = currentQuestion.question;
        document.getElementById('question-progress').innerText = `Soal ${currentQuestionIndex + 1} dari 10`;

        generateMazeFromData(data.mazeData, data.answersData, data.startX, data.startY);
    };

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

        // draw player original location (fixed up)
        if (player && !isHost) {
            player.show();
        }

        // Draw Player Multipemain Teman
        for (let pId in playersData) {
            let p = playersData[pId];
            if (pId === myPlayerId) continue; // Jangan mereplika diri kita ganda

            ctx.save();
            ctx.translate(p.x, p.y);

            // Kompensasi rotasi kamera kita dan rotasi mereka
            // Kita render map berputar sejauh -heading, jadi arah teman mesti + p.heading
            ctx.rotate(p.heading);

            ctx.fillStyle = p.color || '#ff00ff';
            ctx.beginPath();
            const size = w / 2.5;
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.8, size);
            ctx.lineTo(0, size * 0.5);
            ctx.lineTo(-size * 0.8, size);
            ctx.closePath();

            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color || "#ff00ff";
            ctx.fill();

            // Nickname
            ctx.fillStyle = "white";
            ctx.font = "bold 14px Outfit";
            ctx.textAlign = "center";
            ctx.fillText(pId, 0, -size - 10);

            ctx.restore();
        }

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

            const speed = 50; // px/sec

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

            if (vx !== 0 || vy !== 0) {
                player.moveContinuous(vx, vy);
                if (!isHost && hostConnection) {
                    hostConnection.send({ type: 'player_moved', x: player.x, y: player.y, heading: heading });
                }
            }

            // camera follow
            cameraX = lerp(cameraX, player.x, 5 * dt);
            cameraY = lerp(cameraY, player.y, 5 * dt);
        }

        draw();
        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);

    function finishGameAndShowRanking() {
        if (timerInterval) clearInterval(timerInterval);
        
        let leaderboard = Object.keys(playersData).map(pId => {
            return { name: pId, score: playersData[pId].score || 0 };
        }).sort((a,b) => b.score - a.score);
        
        broadcastToPlayers({ type: 'game_over_ranking', leaderboard: leaderboard });
        showRankingUI(leaderboard);
    }

    window.showRankingUI = function(leaderboard) {
        document.getElementById('rankingModal').style.display = 'flex';
        let listStr = "";
        leaderboard.forEach((p, index) => {
            let color = index === 0 ? "#FFD700" : (index === 1 ? "#C0C0C0" : "#CD7F32");
            listStr += `
            <li style="padding: 10px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-weight: bold; margin-right: 15px; color: ${color};">#${index+1}</span>
                    <span style="color: white; font-size: 1.1rem;">${p.name}</span>
                </div>
                <span style="color: #00ffcc; font-weight: bold;">${p.score.toFixed(1)} Poin</span>
            </li>`;
        });
        document.getElementById('rankingList').innerHTML = listStr;
    }
})();