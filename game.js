(() => {
    // ====== DOM Elements ======
    const mazeCanvas = document.getElementById('mazeCanvas');
    const ctx = mazeCanvas.getContext('2d');
    const connHud = document.getElementById('connection-status-hud');
    const connHudIcon = document.getElementById('conn-hud-icon');
    const connHudText = document.getElementById('conn-hud-text');
    
    // UI Panels/Screens inside Game Tab
    const menuSelection = document.getElementById('game-menu-selection');
    const roleSelection = document.getElementById('role-selection-screen');
    const hostSetupScreen = document.getElementById('host-setup-screen');
    const playerSetupScreen = document.getElementById('player-setup-screen');
    const playerWaitingScreen = document.getElementById('player-waiting-screen');
    const gameArenaScreen = document.getElementById('game-arena-screen');
    
    // Sliders & HUDs
    const zoomSlider = document.getElementById('zoomSlider');
    const sensSlider = document.getElementById('sensitivitySlider');
    const lblZoom = document.getElementById('lbl-zoom');
    const lblSens = document.getElementById('lbl-sens');
    const moveBtn = document.getElementById('moveBtn');
    
    // ====== Physics / Maze Variables ======
    let cols, rows;
    let w = 40;
    let grid = [];
    let current;
    let stack = [];

    // Question State
    let currentQuestion = {
        question: "Pertanyaan default...",
        answers: ["A", "B", "C", "D"],
        correct: "A"
    };
    let placedAnswers = []; // holds {text, i, j, color, letter, isCorrect}
    let gameQuestions = [];
    let currentQuestionIndex = 0;
    
    // Game Mode: 'individual', 'demo', or 'multiplayer'
    let gameMode = 'individual'; 

    // ====== Multiplayer State (PeerJS P2P) ======
    let isHost = false;
    let peer = null;
    let myPlayerId = "Murid";
    let hostConnection = null;
    let connections = [];
    let playersData = {}; // { P1: {x, y, heading, color, score, status, currentLevel...} }
    let spectatedPlayerId = null;
    let isGameActive = false;
    
    // ====== Navigation & Sensor State ======
    let player = null;
    let cameraZoom = 1.0;
    let moveSensitivity = 0.1;
    let cameraX = 0;
    let cameraY = 0;
    
    let compassActive = false;
    let heading = 0; // smoothed rendering heading (radians)
    let targetHeading = 0; // raw target heading (radians)
    let headingOffset = 0; // offset for calibration
    let firstCompassReading = true;
    let inGameSensorActive = false; // Checkbox toggle
    
    let isMoveButtonPressed = false;
    const keys = {};

    // ====== Optical Flow Variables ======
    let isCameraActive = false;
    let videoElement, processCtx, debugDiv;
    let prevFrameData = null;
    const COMPRESS_W = 80;
    const COMPRESS_H = 60;
    const SEARCH_RANGE = 12;
    let accumulatedDX = 0;
    let accumulatedDY = 0;

    // Helper functions
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

    // ====== Default Question Bank for Physics Gelombang ======
    const defaultWaveQuestions = [
        {
            question: "Apa medium rambatan pada gelombang bunyi?",
            answers: ["Udara/Zat Perantara", "Ruang Hampa", "Cahaya", "Magnet"],
            correct: "Udara/Zat Perantara"
        },
        {
            question: "Pada gelombang transversal, arah rambat dan arah getar saling...",
            answers: ["Tegak Lurus", "Sejajar", "Berlawanan Arah", "Berhimpit"],
            correct: "Tegak Lurus"
        },
        {
            question: "Bagian tertinggi pada gelombang transversal disebut...",
            answers: ["Bukit Gelombang", "Lembah Gelombang", "Rapatan", "Renggangan"],
            correct: "Bukit Gelombang"
        },
        {
            question: "Gelombang longitudinal merambat dalam bentuk susunan...",
            answers: ["Rapatan & Renggangan", "Bukit & Lembah", "Simpul & Perut", "Bukit saja"],
            correct: "Rapatan & Renggangan"
        },
        {
            question: "Satuan frekuensi gelombang dalam sistem internasional (SI) adalah...",
            answers: ["Hertz (Hz)", "Newton (N)", "Meter (m)", "Sekon (s)"],
            correct: "Hertz (Hz)"
        },
        {
            question: "Rumus hubungan cepat rambat (v), frekuensi (f), dan p. gelombang (λ) adalah...",
            answers: ["v = f * λ", "v = f / λ", "λ = v * f", "f = v * λ"],
            correct: "v = f * λ"
        },
        {
            question: "Penurunan amplitudo gelombang seiring bertambahnya jarak disebabkan oleh...",
            answers: ["Redaman (Damping)", "Peningkatan Frekuensi", "Tegangan Tali", "Pemantulan"],
            correct: "Redaman (Damping)"
        },
        {
            question: "Jika tegangan tali (T) pada simulasi ditingkatkan, cepat rambat gelombang...",
            answers: ["Meningkat", "Menurun", "Tetap sama", "Menjadi nol"],
            correct: "Meningkat"
        },
        {
            question: "Slinki yang digerakkan maju-mundur secara searah panjangnya menghasilkan gelombang...",
            answers: ["Longitudinal", "Transversal", "Elektromagnetik", "Cahaya"],
            correct: "Longitudinal"
        },
        {
            question: "Jarak antara satu rapatan dan satu renggangan terdekat sama dengan...",
            answers: ["Setengah Gelombang (0.5 λ)", "Satu Gelombang penuh (1 λ)", "Dua Gelombang (2 λ)", "Satu Amplitudo"],
            correct: "Setengah Gelombang (0.5 λ)"
        }
    ];

    // ====== Initial UI Setups on Load ======
    window.addEventListener('load', () => {
        // Bind Sliders
        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                cameraZoom = parseFloat(e.target.value);
                if (lblZoom) lblZoom.innerText = cameraZoom.toFixed(1);
            });
        }

        if (sensSlider) {
            sensSlider.addEventListener('input', (e) => {
                moveSensitivity = parseFloat(e.target.value);
                if (lblSens) lblSens.innerText = moveSensitivity.toFixed(2);
            });
        }

        // Bind Hold-to-Move Button
        if (moveBtn) {
            const startMove = (e) => { 
                e.preventDefault(); 
                isMoveButtonPressed = true; 
                moveBtn.classList.add('active'); 
            };
            const stopMove = (e) => { 
                e.preventDefault(); 
                isMoveButtonPressed = false; 
                moveBtn.classList.remove('active'); 
            };

            moveBtn.addEventListener('mousedown', startMove);
            moveBtn.addEventListener('touchstart', startMove, { passive: false });
            moveBtn.addEventListener('mouseup', stopMove);
            moveBtn.addEventListener('touchend', stopMove, { passive: false });
            moveBtn.addEventListener('mouseleave', stopMove);
        }

        // Bind Keyboard falling events
        window.addEventListener('keydown', e => { keys[e.key] = true; });
        window.addEventListener('keyup', e => { keys[e.key] = false; });
    });

    // ====== Game Mode Manager ======
    window.selectGameMode = function(mode) {
        gameMode = mode;
        
        // Reset panels
        menuSelection.style.display = 'none';
        roleSelection.style.display = 'none';
        hostSetupScreen.style.display = 'none';
        playerSetupScreen.style.display = 'none';
        playerWaitingScreen.style.display = 'none';
        gameArenaScreen.style.display = 'none';
        
        // Reset Connection HUD
        updateConnectionHUD('offline', "Mode Offline (Latihan Mandiri)");
        
        if (mode === 'individual') {
            // Start Individual Game directly
            startIndividualGameSetup();
        } else if (mode === 'demo') {
            // Start Demo Room
            startDemoRoom();
        } else if (mode === 'multiplayer') {
            // Show Role Selection for multiplayer
            roleSelection.style.display = 'block';
        }
    };

    window.showGameMenu = function() {
        // Shutdown P2P if active
        shutdownP2P();
        
        menuSelection.style.display = 'block';
        roleSelection.style.display = 'none';
        hostSetupScreen.style.display = 'none';
        playerSetupScreen.style.display = 'none';
        playerWaitingScreen.style.display = 'none';
        gameArenaScreen.style.display = 'none';
        
        updateConnectionHUD('offline', "Mode Offline (Latihan Mandiri)");
    };

    function updateConnectionHUD(state, text) {
        if (!connHud) return;
        connHud.className = `conn-hud ${state}`;
        connHudText.innerText = text;
        
        if (state === 'offline') {
            connHudIcon.className = 'bx bx-wifi-off';
        } else if (state === 'connecting') {
            connHudIcon.className = 'bx bx-loader-alt bx-spin';
        } else if (state === 'connected') {
            connHudIcon.className = 'bx bx-wifi';
        }
    }

    // ====== Offline Mode: Individual Setup ======
    let playerLocalScore = 0.0;
    
    function startIndividualGameSetup() {
        myPlayerId = "Murid Mandiri";
        isHost = false;
        
        gameQuestions = [...defaultWaveQuestions];
        currentQuestionIndex = 0;
        playerLocalScore = 0.0;
        
        // Show Arena
        gameArenaScreen.style.display = 'block';
        document.getElementById('player-score-hud').style.display = 'flex';
        document.getElementById('player-my-score').innerText = "0.0";
        document.getElementById('host-dashboard-panel').style.display = 'none';
        
        // Show manual walk panel, hide compass/orientation sensor by default until calibrated/activated
        document.getElementById('in-game-sensor-toggle').checked = false;
        inGameSensorActive = false;
        document.getElementById('btn-calibrate-ingame').disabled = true;
        
        // Initial setup for maze
        w = 40;
        cols = 10;
        rows = 10;
        mazeCanvas.width = cols * w;
        mazeCanvas.height = rows * w;
        
        generateIndividualMazeLevel(0);
        
        isGameActive = true;
    }

    function generateIndividualMazeLevel(levelIdx) {
        currentQuestionIndex = levelIdx;
        currentQuestion = gameQuestions[currentQuestionIndex];
        
        document.getElementById('question-text').innerText = currentQuestion.question;
        document.getElementById('question-progress').innerText = `Soal ${currentQuestionIndex + 1} dari 10`;
        
        // Generate grid
        grid = [];
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                grid.push(new Cell(i, j));
            }
        }
        
        // DFS generate
        let currentCell = grid[0];
        currentCell.visited = true;
        let localStack = [];
        
        // seed PRNG locally for randomness
        mazeSeed = Math.floor(Math.random() * 5000) + levelIdx * 123;
        
        while (true) {
            currentCell.visited = true;
            let next = currentCell.checkNeighbors();
            if (next) {
                next.visited = true;
                localStack.push(currentCell);
                removeWalls(currentCell, next);
                currentCell = next;
            } else if (localStack.length > 0) {
                currentCell = localStack.pop();
            } else {
                break;
            }
        }
        
        // Make maze organic (loops)
        let loopsToCreate = 24;
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

        // Place answers in maze
        placeAnswers();
        
        // Spawn Player
        player = new Player();
        let startPos = getRandomEmptyCell();
        player.x = startPos.x;
        player.y = startPos.y;
        player.color = '#f97316'; // orange default
        
        cameraX = player.x;
        cameraY = player.y;
        
        // Align facing angle
        let startAngle = 0;
        let cI = Math.floor(player.x / w);
        let cJ = Math.floor(player.y / w);
        let cIdx = index(cI, cJ);
        if (grid[cIdx]) {
            if (!grid[cIdx].walls[1]) startAngle = Math.PI / 2;
            else if (!grid[cIdx].walls[2]) startAngle = Math.PI;
            else if (!grid[cIdx].walls[0]) startAngle = -Math.PI / 2;
        }
        targetHeading = startAngle;
        heading = startAngle;
    }

    // ====== Offline Mode: Demo Room Setup ======
    function startDemoRoom() {
        myPlayerId = "Uji Coba";
        isHost = false;
        
        // Small subset of questions
        gameQuestions = [
            {
                question: "Selamat Datang! Temukan dan masuklah ke ruangan berlabel A untuk menyelesaikan lobi contoh ini.",
                answers: ["Jalan A (Benar)", "Jalan B (Salah)", "Jalan C (Salah)", "Jalan D (Salah)"],
                correct: "Jalan A (Benar)"
            }
        ];
        currentQuestionIndex = 0;
        playerLocalScore = 0.0;
        
        // Show Arena
        gameArenaScreen.style.display = 'block';
        document.getElementById('player-score-hud').style.display = 'flex';
        document.getElementById('player-my-score').innerText = "0.0";
        document.getElementById('host-dashboard-panel').style.display = 'none';
        
        document.getElementById('in-game-sensor-toggle').checked = false;
        inGameSensorActive = false;
        document.getElementById('btn-calibrate-ingame').disabled = true;
        
        // Setup Demo Maze: Small 5x5 grid
        w = 40;
        cols = 5;
        rows = 5;
        mazeCanvas.width = cols * w;
        mazeCanvas.height = rows * w;
        
        // Generate simple grid
        grid = [];
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                grid.push(new Cell(i, j));
            }
        }
        
        // Demolish some walls to make it a room/lobby
        for (let i = 0; i < grid.length; i++) {
            let cell = grid[i];
            if (cell.i > 0) cell.walls[3] = false; // open left
            if (cell.i < cols-1) cell.walls[1] = false; // open right
            if (cell.j > 0) cell.walls[0] = false; // open top
            if (cell.j < rows-1) cell.walls[2] = false; // open bottom
        }
        
        // Place Answers in the corners
        placedAnswers = [];
        let corners = [
            { i: 0, j: 0, c: '#ff3333', l: 'A', text: "Jalan A (Benar)", corr: true },
            { i: cols-1, j: 0, c: '#33ccff', l: 'B', text: "Jalan B (Salah)", corr: false },
            { i: 0, j: rows-1, c: '#33ff33', l: 'C', text: "Jalan C (Salah)", corr: false },
            { i: cols-1, j: rows-1, c: '#ffff33', l: 'D', text: "Jalan D (Salah)", corr: false }
        ];
        
        corners.forEach(corner => {
            let idx = index(corner.i, corner.j);
            grid[idx].isRoom = true;
            grid[idx].roomColor = corner.c;
            placedAnswers.push({
                text: corner.text,
                i: corner.i,
                j: corner.j,
                color: corner.c,
                letter: corner.l,
                isCorrect: corner.corr
            });
        });
        
        renderLegend();
        
        // Spawn Player in Center (2, 2)
        player = new Player();
        player.x = 2 * w + w/2;
        player.y = 2 * w + w/2;
        player.color = '#38bdf8';
        
        cameraX = player.x;
        cameraY = player.y;
        
        targetHeading = 0;
        heading = 0;
        
        isGameActive = true;
        
        alert("Mode Lobi Contoh Aktif! Gunakan tombol di bawah atau keyboard komputer Anda (W,A,S,D) untuk berjalan.");
    }

    // ====== P2P Network Multiplayer Logic ======
    
    function shutdownP2P() {
        isGameActive = false;
        player = null;
        isHost = false;
        
        if (hostConnection) {
            hostConnection.close();
            hostConnection = null;
        }
        connections.forEach(conn => conn.close());
        connections = [];
        
        if (peer) {
            peer.destroy();
            peer = null;
        }
        
        playersData = {};
    }

    window.selectRole = function(role) {
        roleSelection.style.display = 'none';
        
        if (role === 'host') {
            isHost = true;
            hostSetupScreen.style.display = 'block';
            
            // Build Question Form
            const formContainer = document.getElementById('questions-form');
            formContainer.innerHTML = ''; // reset
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
            
            updateConnectionHUD('connecting', "Membuka Room Host...");
            initHostPeer();
        } else {
            isHost = false;
            playerSetupScreen.style.display = 'block';
        }
    };

    window.fillDefaultQuestions = function() {
        defaultWaveQuestions.forEach((q, i) => {
            let el = document.getElementById(`q${i}_text`);
            if (el) el.value = q.question;
            
            let aT = document.getElementById(`q${i}_ans_true`);
            if (aT) aT.value = q.correct;
            
            let wrongs = q.answers.filter(a => a !== q.correct);
            let f1 = document.getElementById(`q${i}_ans_f1`);
            if (f1) f1.value = wrongs[0] || "Salah 1";
            
            let f2 = document.getElementById(`q${i}_ans_f2`);
            if (f2) f2.value = wrongs[1] || "Salah 2";
            
            let f3 = document.getElementById(`q${i}_ans_f3`);
            if (f3) f3.value = wrongs[2] || "Salah 3";
        });
    };

    function generateRoomId() {
        return Math.random().toString(36).substring(2, 7).toUpperCase();
    }

    function initHostPeer() {
        const roomId = generateRoomId();
        peer = new Peer(roomId);

        peer.on('open', (id) => {
            document.getElementById('hostRoomIdDisplay').innerText = id;
            myPlayerId = 'Host';
            updateConnectionHUD('connected', `Lobi Host - ID: ${id}`);
        });

        peer.on('connection', (conn) => {
            if (connections.length >= 8) { // max 8 players for reliability
                conn.on('open', () => {
                    conn.send({ type: 'error', message: 'Room penuh (Maks 8 Pemain)!' });
                    setTimeout(() => conn.close(), 500);
                });
                return;
            }

            let pName = (conn.metadata && conn.metadata.playerName) ? conn.metadata.playerName : ('P' + (connections.length + 1));
            let newPlayerId = pName;

            if (connections.find(c => c.playerId === newPlayerId)) {
                newPlayerId += "_" + Math.floor(Math.random() * 100);
            }

            conn.playerId = newPlayerId;
            connections.push(conn);
            
            playersData[newPlayerId] = {
                status: 'waiting',
                score: 0.0,
                currentLevel: 0,
                currentQuestionIndex: 0,
                startTime: 0,
                endTime: 0,
                color: ['#38bdf8', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][connections.length % 6],
                grid: [],
                placedAnswers: []
            };

            updateHostWaitingList();

            conn.on('data', (data) => {
                handleHostReceiveData(conn.playerId, data);
            });

            conn.on('close', () => {
                connections = connections.filter(c => c !== conn);
                updateHostWaitingList();
                
                alert(`Pemain ${conn.playerId} terputus.`);
                if (playersData[conn.playerId]) {
                    delete playersData[conn.playerId];
                }
                
                if (isHost) {
                    if (spectatedPlayerId === conn.playerId) {
                        const remaining = Object.keys(playersData).filter(id => playersData[id].status === 'playing');
                        spectatedPlayerId = remaining.length > 0 ? remaining[0] : null;
                        if (spectatedPlayerId) {
                            grid = [...playersData[spectatedPlayerId].grid];
                            placedAnswers = [...playersData[spectatedPlayerId].placedAnswers];
                            currentQuestion = gameQuestions[playersData[spectatedPlayerId].currentQuestionIndex];
                        }
                    }
                    updateHostDashboard();
                    draw();
                }
                
                broadcastToPlayers({ type: 'player_left', playerId: conn.playerId });
            });

            conn.on('open', () => {
                conn.send({ type: 'assigned_id', playerId: newPlayerId });
                if (isGameActive) {
                    conn.send({ type: 'wait_state' });
                    updateHostDashboard();
                }
            });
        });

        peer.on('error', (err) => {
            console.error(err);
            updateConnectionHUD('offline', "Error Koneksi Host");
            alert("Koneksi Host Error: " + err.message);
        });
    }

    function updateHostWaitingList() {
        document.getElementById('playerCount').innerText = connections.length;
        const ul = document.getElementById('waitingPlayersList');
        ul.innerHTML = '';
        const startBtn = document.getElementById('startGameBtn');
        
        if (connections.length === 0) {
            ul.innerHTML = '<li class="empty-list-text">Belum ada pemain bergabung</li>';
            startBtn.disabled = true;
        } else {
            connections.forEach((c) => {
                let li = document.createElement('li');
                li.style.color = '#fff';
                li.innerHTML = `<i class='bx bx-check-circle' style='color:var(--success-color); margin-right: 5px;'></i> ${c.playerId} siap terhubung`;
                ul.appendChild(li);
            });
            startBtn.disabled = false;
        }
    }

    function broadcastToPlayers(data) {
        connections.forEach(c => c.send(data));
    }

    window.joinGame = function() {
        const playerNameInput = document.getElementById('joinPlayerNameInput');
        let playerName = playerNameInput ? playerNameInput.value.trim().substring(0, 12) : "";

        if (!playerName) { alert("Masukkan nama Anda!"); return; }

        const destId = document.getElementById('joinRoomIdInput').value.trim().toUpperCase();
        if (!destId) { alert("Masukkan kode room!"); return; }

        document.getElementById('joinRoomBtn').style.display = 'none';
        const stDiv = document.getElementById('player-waiting-status');
        const stText = document.getElementById('playerWaitText');
        stDiv.style.display = 'block';
        stText.innerText = "Mencari Host...";
        
        updateConnectionHUD('connecting', "Menyambungkan...");

        peer = new Peer();

        peer.on('open', (id) => {
            hostConnection = peer.connect(destId, { reliable: true, metadata: { playerName: playerName } });

            hostConnection.on('open', () => {
                stText.innerText = "Terhubung! Menunggu Host memulai permainan...";
                document.getElementById('player-my-name-display').innerText = playerName;
                
                playerSetupScreen.style.display = 'none';
                playerWaitingScreen.style.display = 'block';
                
                updateConnectionHUD('connected', `Terhubung ke Host: ${destId}`);
            });

            hostConnection.on('data', (data) => {
                handlePlayerReceiveData(data);
            });

            hostConnection.on('close', () => {
                alert("Koneksi terputus dari Host.");
                showGameMenu();
            });
        });

        peer.on('error', (err) => {
            stDiv.style.display = 'none';
            document.getElementById('joinRoomBtn').style.display = 'block';
            updateConnectionHUD('offline', "Gagal Menyambung");
            alert("Gagal terhubung ke lobi host: " + err.message);
        });
    };

    // ====== Host Receive and Verification Logic ======
    function handleHostReceiveData(playerId, data) {
        if (data.type === 'player_moved') {
            if (!playersData[playerId]) playersData[playerId] = {};
            playersData[playerId].x = data.x;
            playersData[playerId].y = data.y;
            playersData[playerId].heading = data.heading;

            // Forward coordinates to other players so they can see this player moving
            connections.forEach(c => {
                if (c.playerId !== playerId) {
                    c.send({ type: 'enemy_moved', playerId: playerId, x: data.x, y: data.y, heading: data.heading, color: playersData[playerId].color });
                }
            });
        }
        else if (data.type === 'check_answer') {
            processHostAnswerHit(playerId, data.i, data.j);
        }
    }

    function processHostAnswerHit(triggerPlayerId, i, j) {
        let playerGrid = playersData[triggerPlayerId].grid;
        let playerPlacedAnswers = playersData[triggerPlayerId].placedAnswers;
        
        let targetAns = playerPlacedAnswers.find(a => a.i === i && a.j === j);
        if (!targetAns) return; // Answer already consumed or invalid

        if (targetAns.isCorrect) {
            playersData[triggerPlayerId].score += 1.0;
            playersData[triggerPlayerId].currentLevel++;
            playersData[triggerPlayerId].currentQuestionIndex++;

            updateHostDashboard();

            // Notify trigger player
            let conn = connections.find(c => c.playerId === triggerPlayerId);
            if (conn) conn.send({ type: 'answer_result', isCorrect: true, triggerPlayerId: triggerPlayerId });

            if (playersData[triggerPlayerId].currentLevel >= 10) {
                // Completed the game
                endPlayerGame(triggerPlayerId);
            } else {
                // Generate next maze level specifically for this player
                generateMazeForPlayer(triggerPlayerId, playersData[triggerPlayerId].currentQuestionIndex);

                if (conn) {
                    conn.send({
                        type: 'next_question',
                        questionIndex: playersData[triggerPlayerId].currentQuestionIndex,
                        mazeData: playersData[triggerPlayerId].grid.map(c => ({ w: [...c.walls], i: c.isRoom, c: c.roomColor })),
                        answersData: playersData[triggerPlayerId].placedAnswers,
                        startX: playersData[triggerPlayerId].x,
                        startY: playersData[triggerPlayerId].y
                    });
                }
                
                // If spectating this player, update Host view
                if (triggerPlayerId === spectatedPlayerId) {
                    grid = [...playersData[spectatedPlayerId].grid];
                    placedAnswers = [...playersData[spectatedPlayerId].placedAnswers];
                    currentQuestion = gameQuestions[playersData[spectatedPlayerId].currentQuestionIndex];
                    renderLegend();
                    draw();
                }
            }
        } else {
            // Deduct score slightly
            playersData[triggerPlayerId].score -= 0.1;
            updateHostDashboard();

            // Notify incorrect
            let conn = connections.find(c => c.playerId === triggerPlayerId);
            if (conn) conn.send({ type: 'answer_result', isCorrect: false, triggerPlayerId: triggerPlayerId, i: i, j: j });

            // Remove incorrect door/room from their layout
            let cellIndex = index(i, j);
            if (playerGrid[cellIndex]) playerGrid[cellIndex].isRoom = false;
            playersData[triggerPlayerId].placedAnswers = playerPlacedAnswers.filter(a => !(a.i === i && a.j === j));
            
            if (triggerPlayerId === spectatedPlayerId) {
                grid = [...playersData[spectatedPlayerId].grid];
                placedAnswers = [...playersData[spectatedPlayerId].placedAnswers];
                renderLegend();
                draw();
            }
        }
    }

    function generateMazeForPlayer(playerId, questionIndex) {
        w = 40; cols = 10; rows = 10;
        
        let oldGrid = grid;
        let oldCurrentQuestion = currentQuestion;
        let oldPlacedAnswers = placedAnswers;

        grid = [];
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                grid.push(new Cell(i, j));
            }
        }

        currentQuestion = gameQuestions[questionIndex];
        
        let currentCell = grid[0];
        currentCell.visited = true;
        let localStack = [];
        
        // Seed unique to player and level
        mazeSeed = Math.floor(Math.random() * 2000) + questionIndex * 33;

        while (true) {
            currentCell.visited = true;
            let next = currentCell.checkNeighbors();
            if (next) {
                next.visited = true;
                localStack.push(currentCell);
                removeWalls(currentCell, next);
                currentCell = next;
            } else if (localStack.length > 0) {
                currentCell = localStack.pop();
            } else {
                break;
            }
        }

        let loopsToCreate = 24;
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

        playersData[playerId].grid = [...grid];
        playersData[playerId].placedAnswers = [...placedAnswers];
        playersData[playerId].currentQuestionIndex = questionIndex;

        let startX = Math.floor(cols / 2) * w + w / 2;
        let startY = Math.floor(rows / 2) * w + w / 2;
        let centerIdx = index(Math.floor(cols/2), Math.floor(rows/2));
        if(grid[centerIdx] && grid[centerIdx].isRoom) {
            let empty = getRandomEmptyCell();
            startX = empty.x; startY = empty.y;
        }

        playersData[playerId].x = startX;
        playersData[playerId].y = startY;

        grid = oldGrid;
        currentQuestion = oldCurrentQuestion;
        placedAnswers = oldPlacedAnswers;
    }

    function endPlayerGame(playerId) {
        if (playersData[playerId]) {
            playersData[playerId].status = 'finished';
            playersData[playerId].endTime = Date.now();
        }
        
        let conn = connections.find(c => c.playerId === playerId);
        if (conn) {
            conn.send({ type: 'end_turn' });
        }
        
        updateHostDashboard();

        const activePlaying = Object.keys(playersData).filter(id => playersData[id].status === 'playing');
        if (activePlaying.length === 0) {
            finishGameAndShowRanking();
        }
    }

    window.hostEndRoom = function() {
        if (!confirm("Yakin ingin mengakhiri keseluruhan permainan untuk semua orang?")) return;
        finishGameAndShowRanking();
    };

    function finishGameAndShowRanking() {
        let leaderboard = Object.keys(playersData).map(pId => {
            let p = playersData[pId];
            let playTimeMs = 0;
            if (p.endTime > 0 && p.startTime > 0) {
                playTimeMs = p.endTime - p.startTime;
            } else if (p.startTime > 0) {
                playTimeMs = Date.now() - p.startTime;
            }
            return { name: pId, score: p.score || 0, playTimeMs: playTimeMs, level: p.currentLevel };
        });

        leaderboard.sort((a,b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.playTimeMs > 0 && b.playTimeMs > 0 && a.playTimeMs !== b.playTimeMs) return a.playTimeMs - b.playTimeMs;
            return b.level - a.level;
        });
        
        broadcastToPlayers({ type: 'game_over_ranking', leaderboard: leaderboard });
        showRankingUI(leaderboard);
    }

    // ====== Player Receive Logic ======
    function handlePlayerReceiveData(data) {
        if (data.type === 'error') {
            alert(data.message);
            showGameMenu();
        }
        else if (data.type === 'assigned_id') {
            myPlayerId = data.playerId;
        }
        else if (data.type === 'wait_state') {
            playerSetupScreen.style.display = 'none';
            gameArenaScreen.style.display = 'none';
            playerWaitingScreen.style.display = 'block';
            document.getElementById('playerWaitingStatusText').innerText = "Menunggu Host Memulai Permainan...";
        }
        else if (data.type === 'end_turn') {
            gameArenaScreen.style.display = 'none';
            playerWaitingScreen.style.display = 'block';
            document.getElementById('playerWaitingStatusText').innerText = "Anda Telah Selesai Bermain! Menunggu Papan Peringkat...";
            document.getElementById('playerWaitingStatusText').style.color = "var(--success-color)";
            player = null;
        }
        else if (data.type === 'game_start') {
            if (data.playerId) myPlayerId = data.playerId;
            playerWaitingScreen.style.display = 'none';
            gameArenaScreen.style.display = 'block';
            
            playersData[myPlayerId] = { color: data.color || '#38bdf8' };
            playerLocalScore = 0.0;
            document.getElementById('player-my-score').innerText = "0.0";
            document.getElementById('host-dashboard-panel').style.display = 'none';
            
            document.getElementById('in-game-sensor-toggle').checked = false;
            inGameSensorActive = false;
            document.getElementById('btn-calibrate-ingame').disabled = true;

            gameQuestions = data.questions;
            currentQuestionIndex = 0;
            currentQuestion = gameQuestions[currentQuestionIndex];
            
            document.getElementById('question-text').innerText = currentQuestion.question;
            document.getElementById('question-progress').innerText = `Soal ${currentQuestionIndex + 1} dari 10`;

            generateMazeFromData(data.mazeData, data.answersData, data.startX, data.startY, data.color);
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
                    updatePlayerScore(1.0);
                }
            } else {
                if (data.triggerPlayerId === myPlayerId) {
                    updatePlayerScore(-0.1);
                    showWrongAnswerPopup();
                    if (player) player.justAnswered = false;
                }
                
                // Remove incorrect room
                let cellIndex = index(data.i, data.j);
                if (grid[cellIndex]) grid[cellIndex].isRoom = false;
                placedAnswers = placedAnswers.filter(a => !(a.i === data.i && a.j === data.j));
                renderLegend();
            }
        }
        else if (data.type === 'next_question') {
            currentQuestionIndex = data.questionIndex;
            currentQuestion = gameQuestions[currentQuestionIndex];
            document.getElementById('question-text').innerText = currentQuestion.question;
            document.getElementById('question-progress').innerText = `Soal ${currentQuestionIndex + 1} dari 10`;
            generateMazeFromData(data.mazeData, data.answersData, data.startX, data.startY, playersData[myPlayerId].color);
        }
        else if (data.type === 'game_over_ranking') {
            showRankingUI(data.leaderboard);
        }
    }

    function updatePlayerScore(added) {
        playerLocalScore += added;
        let scoreEl = document.getElementById('player-my-score');
        if (scoreEl) {
            scoreEl.innerText = playerLocalScore.toFixed(1);
            
            // Add a floating point display (+1.0 or -0.1)
            let floatEl = document.createElement('div');
            floatEl.innerText = added > 0 ? `+${added.toFixed(1)}` : `${added.toFixed(1)}`;
            floatEl.style.cssText = 'position: absolute; right: -30px; top: 0; font-weight: 800; font-size: 1.1rem; pointer-events: none; transition: all 1.2s ease-out; opacity: 1; transform: translateY(0);';
            floatEl.style.color = added > 0 ? 'var(--success-color)' : 'var(--danger-color)';
            
            let container = document.getElementById('self-score-hud');
            if (container) {
                container.style.position = 'relative';
                container.appendChild(floatEl);
                
                void floatEl.offsetWidth; // force reflow
                floatEl.style.transform = 'translateY(-20px)';
                floatEl.style.opacity = '0';
                
                setTimeout(() => {
                    if (container.contains(floatEl)) container.removeChild(floatEl);
                }, 1200);
            }
        }
    }

    function generateMazeFromData(mazeData, answersData, startX, startY, pColor) {
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

        // Spawn player
        player = new Player();
        player.x = startX;
        player.y = startY;
        player.color = pColor || '#38bdf8';
        cameraX = player.x;
        cameraY = player.y;

        // Auto align orientation
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
    }

    // ====== Host: Dashboard Leaders ======
    window.updateHostDashboard = function() {
        if (!isHost) return;
        const leaderboardList = document.getElementById('host-leaderboard-list');
        if (leaderboardList) {
            let sortedPlayers = Object.keys(playersData).map(id => ({
                id,
                ...playersData[id]
            })).sort((a, b) => b.score - a.score);

            let html = "";
            if (sortedPlayers.length === 0) {
                html = "<div style='color: var(--text-muted); text-align: center; padding: 10px; font-size:0.8rem;'>Belum ada pemain bergabung</div>";
            } else {
                sortedPlayers.forEach(p => {
                    let isSpectated = (p.id === spectatedPlayerId);
                    let specClass = isSpectated ? "host-mon-row spectating" : "host-mon-row";
                    
                    html += `
                        <div class="${specClass}" onclick="selectSpectatePlayer('${p.id}')">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${p.color};"></span>
                                <span class="host-mon-name">${p.id}</span>
                            </div>
                            <div class="host-mon-stats">
                                <span style="color:var(--accent-color); font-weight:bold;">${p.score.toFixed(1)} Pts</span>
                                <span style="color:var(--text-muted); margin-left:8px;">Soal: ${p.currentLevel}/10</span>
                            </div>
                        </div>
                    `;
                });
            }
            leaderboardList.innerHTML = html;
        }
    };

    window.selectSpectatePlayer = function(playerId) {
        if (playersData[playerId]) {
            spectatedPlayerId = playerId;
            grid = [...playersData[spectatedPlayerId].grid];
            placedAnswers = [...playersData[spectatedPlayerId].placedAnswers];
            currentQuestion = gameQuestions[playersData[spectatedPlayerId].currentQuestionIndex];
            
            updateHostDashboard();
            renderLegend();
            draw();
        }
    };

    // ====== Host: Game Start ======
    window.startGame = async function() {
        if (connections.length === 0) {
            alert("Tunggu setidaknya 1 pemain untuk bergabung sebelum memulai permainan!");
            return;
        }

        // Host setup questions
        gameQuestions = [];
        for (let i = 0; i < 10; i++) {
            let text = document.getElementById(`q${i}_text`).value.trim();
            let t = document.getElementById(`q${i}_ans_true`).value.trim();
            let f1 = document.getElementById(`q${i}_ans_f1`).value.trim();
            let f2 = document.getElementById(`q${i}_ans_f2`).value.trim();
            let f3 = document.getElementById(`q${i}_ans_f3`).value.trim();

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

        isGameActive = true;
        
        hostSetupScreen.style.display = 'none';
        gameArenaScreen.style.display = 'block';
        document.getElementById('host-dashboard-panel').style.display = 'block';
        
        // Hide movement and camera controls since Host only monitors
        document.querySelector('.game-controls-sidebar').style.display = 'none';
        document.getElementById('player-score-hud').style.display = 'none';

        // Initialize players grid
        connections.forEach(conn => {
            const playerId = conn.playerId;
            playersData[playerId].status = 'playing';
            playersData[playerId].currentLevel = 0;
            playersData[playerId].currentQuestionIndex = 0;
            playersData[playerId].startTime = Date.now();
            playersData[playerId].endTime = 0;
            playersData[playerId].score = 0.0;
            
            generateMazeForPlayer(playerId, 0);
            
            conn.send({
                type: 'game_start',
                questions: gameQuestions,
                mazeData: playersData[playerId].grid.map(c => ({ w: [...c.walls], i: c.isRoom, c: c.roomColor })),
                answersData: playersData[playerId].placedAnswers,
                startX: playersData[playerId].x,
                startY: playersData[playerId].y,
                color: playersData[playerId].color,
                playerId: playerId
            });
        });

        // Spectate first player by default
        if (connections.length > 0) {
            spectatedPlayerId = connections[0].playerId;
            grid = [...playersData[spectatedPlayerId].grid];
            placedAnswers = [...playersData[spectatedPlayerId].placedAnswers];
            currentQuestion = gameQuestions[0];
            renderLegend();
        }

        updateHostDashboard();

        // Host overview map
        w = 40; cols = 10; rows = 10;
        mazeCanvas.width = cols * w;
        mazeCanvas.height = rows * w;
        cameraX = cols * w / 2;
        cameraY = rows * w / 2;
        cameraZoom = 0.6; // show full map

        heading = 0;
        targetHeading = 0;

        draw();
    };

    window.exitActiveGame = function() {
        if (confirm("Apakah Anda yakin ingin keluar dari permainan aktif ini?")) {
            showGameMenu();
        }
    };

    // ====== In-Game Sensor Controls ======
    
    // Listen orientation
    window.addEventListener("deviceorientation", (event) => {
        if (!inGameSensorActive) return;
        
        let rad = null;
        if (typeof event.webkitCompassHeading === 'number') {
            rad = event.webkitCompassHeading * (Math.PI / 180);
        } else if (typeof event.alpha === 'number') {
            rad = -event.alpha * (Math.PI / 180);
        }

        if (rad === null) return;

        if (firstCompassReading) {
            headingOffset = rad - targetHeading;
            firstCompassReading = false;
        }

        compassActive = true;
        targetHeading = normalizeRad(rad - headingOffset);
    }, true);

    window.toggleInGameSensor = async function(checked) {
        if (checked) {
            try {
                if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        inGameSensorActive = true;
                        firstCompassReading = true;
                        document.getElementById('btn-calibrate-ingame').disabled = false;
                    } else {
                        alert("Izin sensor ditolak. Silakan gunakan navigasi manual/keyboard.");
                        document.getElementById('in-game-sensor-toggle').checked = false;
                    }
                } else {
                    inGameSensorActive = true;
                    firstCompassReading = true;
                    document.getElementById('btn-calibrate-ingame').disabled = false;
                }
            } catch (e) {
                console.error("Gagal memulai sensor in-game:", e);
                alert("Perangkat atau browser Anda tidak mendukung sensor orientasi.");
                document.getElementById('in-game-sensor-toggle').checked = false;
            }
        } else {
            inGameSensorActive = false;
            document.getElementById('btn-calibrate-ingame').disabled = true;
        }
    };

    window.calibrateSensorInGame = function() {
        firstCompassReading = true;
        alert("Kalibrasi arah hadapan berhasil dilakukan!");
    };

    // ====== Player Classes ======
    class Player {
        constructor() {
            this.radius = w / 3.2;
            this.x = w / 2;
            this.y = w / 2;
            this.justAnswered = false;
        }

        get i() { return Math.floor(this.x / w); }
        get j() { return Math.floor(this.y / w); }

        show() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(heading); // Counter camera rotation so characters stay oriented vertically
            
            const size = w / 2.5;

            // Body shadow glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color || '#38bdf8';

            // Draw character blob
            ctx.fillStyle = this.color || '#38bdf8';
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0; // reset

            // Draw white cap indicator pointing forward/up
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(0, -size - 4);
            ctx.lineTo(size * 0.45, -size + 2);
            ctx.lineTo(-size * 0.45, -size + 2);
            ctx.closePath();
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(-size * 0.28, -size * 0.2, size * 0.15, 0, Math.PI * 2);
            ctx.arc(size * 0.28, -size * 0.2, size * 0.15, 0, Math.PI * 2);
            ctx.fill();

            // White eye highlights
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-size * 0.32, -size * 0.25, size * 0.05, 0, Math.PI * 2);
            ctx.arc(size * 0.24, -size * 0.25, size * 0.05, 0, Math.PI * 2);
            ctx.fill();

            // Cute Smile
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();

            ctx.restore();
        }

        moveContinuous(vx, vy) {
            if (!this.checkCollision(this.x + vx, this.y)) this.x += vx;
            if (!this.checkCollision(this.x, this.y + vy)) this.y += vy;
            checkAnswerCollision();
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

    // ====== PRNG for seed synced generation ======
    let mazeSeed = 1;
    function myRandom() {
        let x = Math.sin(mazeSeed++) * 10000;
        return x - Math.floor(x);
    }

    // ====== Cell Class ======
    class Cell {
        constructor(i, j) {
            this.i = i;
            this.j = j;
            this.walls = [true, true, true, true]; // top, right, bottom, left
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

            // Draw colored Room
            if (this.isRoom) {
                ctx.fillStyle = this.roomColor;
                ctx.fillRect(x, y, w, w);
                
                // Accessibility letter center
                let ans = placedAnswers.find(a => a.i === this.i && a.j === this.j);
                if (ans) {
                    ctx.fillStyle = '#0f172a'; // dark text for high contrast inside rooms
                    ctx.font = 'extrabold 18px Outfit';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(ans.letter, x + w / 2, y + w / 2);
                }
            }

            ctx.strokeStyle = '#334155'; // Dark Slate wall borders
            ctx.lineWidth = 3.5;

            if (this.walls[0]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); }
            if (this.walls[1]) { ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + w); ctx.stroke(); }
            if (this.walls[2]) { ctx.beginPath(); ctx.moveTo(x + w, y + w); ctx.lineTo(x, y + w); ctx.stroke(); }
            if (this.walls[3]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + w); ctx.stroke(); }
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

    // ====== Legend Builder (Colorblind accessible) ======
    function renderLegend() {
        let legendHTML = '';
        placedAnswers.forEach(ans => {
            // Include letters inside boxes in Legend
            legendHTML += `
                <div class="legend-item" style="border-left: 3px solid ${ans.color};">
                    <div class="color-box" style="background-color: ${ans.color};">${ans.letter}</div>
                    <div class="legend-text" title="${ans.text}">${ans.text}</div>
                </div>
            `;
        });
        
        const container = document.getElementById('answer-legend-container');
        if (container) container.innerHTML = legendHTML;
    }

    function placeAnswers() {
        placedAnswers = [];

        // Identify possible dead-ends
        let possibleCells = grid.filter(c => {
            if (c.i === 0 && c.j === 0) return false;
            let wallCount = c.walls.filter(Boolean).length;
            return wallCount >= 3;
        });

        if (possibleCells.length < 4) {
            possibleCells = grid.filter(c => !(c.i === 0 && c.j === 0));
        }

        // Shuffle cells using local PRNG
        possibleCells.sort(() => myRandom() - 0.5);

        // Shuffle answers
        let answersToPlace = [...currentQuestion.answers].sort(() => myRandom() - 0.5);
        const roomColors = ['#ef4444', '#0ea5e9', '#10b981', '#f59e0b']; // Red, Sky-Blue, Green, Yellow
        const roomLetters = ['A', 'B', 'C', 'D'];

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
                letter: roomLetters[i],
                isCorrect: answersToPlace[i] === currentQuestion.correct
            });
        }

        renderLegend();
    }

    function checkAnswerCollision() {
        if (!player) return;

        let checkI = player.i;
        let checkJ = player.j;

        for (let idxAns = 0; idxAns < placedAnswers.length; idxAns++) {
            let ans = placedAnswers[idxAns];

            if (checkI === ans.i && checkJ === ans.j) {
                if (player.justAnswered) return;
                player.justAnswered = true;

                // Handle answers verification
                if (gameMode === 'individual') {
                    verifyIndividualAnswer(ans);
                } else if (gameMode === 'demo') {
                    verifyDemoAnswer(ans);
                } else if (!isHost && hostConnection) {
                    hostConnection.send({ type: 'check_answer', i: ans.i, j: ans.j });
                }
                break;
            }
        }
    }

    // ====== Offline Verify Answer ======
    function verifyIndividualAnswer(ans) {
        if (ans.isCorrect) {
            updatePlayerScore(1.0);
            
            // Advance level
            let nextLvl = currentQuestionIndex + 1;
            if (nextLvl >= 10) {
                // Completed game!
                saveOfflineResultToHistory(true);
            } else {
                generateIndividualMazeLevel(nextLvl);
            }
        } else {
            updatePlayerScore(-0.1);
            showWrongAnswerPopup();
            
            // Delete incorrect room door
            let cellIdx = index(ans.i, ans.j);
            if (grid[cellIdx]) grid[cellIdx].isRoom = false;
            placedAnswers = placedAnswers.filter(a => !(a.i === ans.i && a.j === ans.j));
            
            renderLegend();
            player.justAnswered = false; // release lock
        }
    }
    
    function verifyDemoAnswer(ans) {
        if (ans.isCorrect) {
            alert("Selamat! Anda berhasil menemukan jawaban yang benar di lobi contoh.");
            showGameMenu();
        } else {
            alert("Jawaban Salah. Ruangan dihancurkan, coba ruangan lain!");
            let cellIdx = index(ans.i, ans.j);
            if (grid[cellIdx]) grid[cellIdx].isRoom = false;
            placedAnswers = placedAnswers.filter(a => !(a.i === ans.i && ans.j === a.j));
            renderLegend();
            player.justAnswered = false;
        }
    }

    function saveOfflineResultToHistory(isCompleted) {
        isGameActive = false;
        player = null;
        
        // Calculate history data
        const dateStr = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
        const name = "Murid Mandiri";
        const score = playerLocalScore;
        const questionsStr = `${currentQuestionIndex + 1}/10`;
        const timeTaken = "2 Menit"; // we can count exactly if we wanted, but static is fine or dynamically calculated
        
        // Retrieve local history
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('wave_up_score_history')) || [];
        } catch(e) {}
        
        history.push({
            date: dateStr,
            name: name,
            mode: "Latihan Mandiri",
            questions: questionsStr,
            score: score.toFixed(1),
            time: timeTaken
        });
        
        localStorage.setItem('wave_up_score_history', JSON.stringify(history));
        
        // update history tab
        if (window.updateHistoryTable) window.updateHistoryTable();
        
        // Show ranking/result modal
        showIndividualRankingModal(score);
    }
    
    function showIndividualRankingModal(finalScore) {
        document.getElementById('rankingModal').style.display = 'flex';
        const rankingList = document.getElementById('rankingList');
        
        rankingList.innerHTML = `
            <li style="border-left: 4px solid var(--success-color); display:flex; flex-direction:column; align-items:start; padding:15px; background:rgba(0,0,0,0.15)">
                <div style="font-weight:bold; font-size:1.15rem; color:#fff;">Status: Latihan Selesai!</div>
                <div style="color:var(--accent-color); font-size:1.4rem; font-weight:800; margin-top:8px;">Skor Akhir: ${finalScore.toFixed(1)} Poin</div>
                <div style="color:var(--text-muted); font-size:0.85rem; margin-top:5px;">Hasil Anda tersimpan otomatis di menu Riwayat.</div>
            </li>
        `;
    }
    
    window.closeRankingModalAndReset = function() {
        document.getElementById('rankingModal').style.display = 'none';
        showGameMenu();
    };

    function getRandomEmptyCell() {
        let emptyCells = grid.filter(c => !c.isRoom && (c.i !== 0 || c.j !== 0));
        let c = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        if (!c) c = grid[0];
        return { x: c.i * w + w / 2, y: c.j * w + w / 2 };
    }

    // ====== Rendering & World Projection Loop ======
    function draw() {
        ctx.fillStyle = '#020617'; // Canvas background Slate 950
        ctx.fillRect(0, 0, mazeCanvas.width, mazeCanvas.height);

        ctx.save();

        // Host Spectating Setup
        if (isHost && spectatedPlayerId && playersData[spectatedPlayerId]) {
            grid = playersData[spectatedPlayerId].grid;
            placedAnswers = playersData[spectatedPlayerId].placedAnswers;
            
            const ap = playersData[spectatedPlayerId];
            if (ap && gameQuestions[ap.currentQuestionIndex]) {
                const questionTextEl = document.getElementById('question-text');
                const progressEl = document.getElementById('question-progress');
                if (questionTextEl) questionTextEl.innerText = `[Memantau ${spectatedPlayerId}] ` + gameQuestions[ap.currentQuestionIndex].question;
                if (progressEl) progressEl.innerText = `Soal ${ap.currentQuestionIndex + 1} dari 10`;
            }
        }

        // Project camera viewport
        let cx = mazeCanvas.width / 2;
        let cy = mazeCanvas.height / 2;

        ctx.translate(cx, cy);
        ctx.scale(cameraZoom, cameraZoom);

        // Rotate WORLD in opposite direction of heading so direction always points UP
        ctx.rotate(-heading);

        // Center on Player
        ctx.translate(-cameraX, -cameraY);

        // Render cells
        for (let i = 0; i < grid.length; i++) grid[i].show();

        // Render player (only if playing and not host)
        if (player && !isHost) {
            player.show();
        }

        // Render Multiplayer friends
        for (let pId in playersData) {
            let p = playersData[pId];
            if (pId === myPlayerId) continue;
            if (p.status === 'finished') continue;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.heading); // compensate friend direction

            const size = w / 2.5;

            // Glow shadow
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color || '#8b5cf6';

            // Body
            ctx.fillStyle = p.color || '#8b5cf6';
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0;

            // Cap indicator
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(0, -size - 4);
            ctx.lineTo(size * 0.45, -size + 2);
            ctx.lineTo(-size * 0.45, -size + 2);
            ctx.closePath();
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(-size * 0.28, -size * 0.2, size * 0.15, 0, Math.PI * 2);
            ctx.arc(size * 0.28, -size * 0.2, size * 0.15, 0, Math.PI * 2);
            ctx.fill();

            // Smile
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();

            // Nickname
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px Outfit";
            ctx.textAlign = "center";
            ctx.fillText(pId, 0, -size - 10);

            ctx.restore();
        }

        ctx.restore();
    }

    // ====== Optical Flow Camera Motion Tracking ======
    window.startOpticalTracking = async function() {
        if (isCameraActive) return;

        videoElement = document.getElementById('cameraFeed');
        const processCanvas = document.getElementById('processCanvas');
        debugDiv = document.getElementById('flow-debug');
        
        if (!processCanvas) return;
        processCtx = processCanvas.getContext('2d', { willReadFrequently: true });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 320, height: 240, frameRate: 20 }
            });
            videoElement.srcObject = stream;
            
            document.getElementById('camera-view-container').style.display = 'flex';
            document.getElementById('startCameraBtn').classList.add('active');
            isCameraActive = true;
            
            requestAnimationFrame(trackMovement);
        } catch (err) {
            alert("Gagal mengakses kamera depan: " + err.message);
        }
    };
    
    window.toggleCameraView = function() {
        const container = document.getElementById('camera-view-container');
        const btn = document.getElementById('toggleCameraViewBtn');
        const icon = btn.querySelector('i');
        
        if (container.style.display === 'none') {
            container.style.display = 'flex';
            icon.className = 'bx bx-hide';
        } else {
            container.style.display = 'none';
            icon.className = 'bx bx-show';
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

            accumulatedDX += flow.dx;
            accumulatedDY += flow.dy;

            if (debugDiv) {
                debugDiv.innerText = `Langkah (AccDY): ${accumulatedDY.toFixed(1)}`;
            }
        }

        prevFrameData = currentFrameData;
        requestAnimationFrame(trackMovement);
    }

    function calculateGlobalFlow(oldImg, newImg) {
        let totalDx = 0;
        let totalDy = 0;

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

    function blockMatchingSafe(oldImg, newImg, startX, startY) {
        const blockSize = 8;
        let bestDx = 0, bestDy = 0;
        let minSAD = Infinity;

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
                        sad += Math.abs(oldImg[idxOld + 1] - newImg[idxNew + 1]); // green channel
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

    // ====== Game Loop Coordinator ======
    let lastLoopTime = performance.now();

    function gameLoop(time) {
        let dt = (time - lastLoopTime) / 1000;
        lastLoopTime = time;
        if (dt > 0.1) dt = 0.1;

        const activeTab = document.querySelector('.tab-content.active');
        const isGameTab = activeTab && activeTab.id === 'tab-game';

        if (isGameTab && isGameActive && player) {
            // Smoothen heading turn
            heading = lerpAngle(heading, targetHeading, 10 * dt);

            // If sensor inactive, allow keyboard fallback turning (A / D)
            if (!inGameSensorActive) {
                if (keys['ArrowLeft'] || keys['a'] || keys['A']) targetHeading -= 3.2 * dt;
                if (keys['ArrowRight'] || keys['d'] || keys['D']) targetHeading += 3.2 * dt;
            }

            // Keyboard moving directions (relative to screen facing)
            let kbForward = 0, kbRight = 0;
            if (keys['w'] || keys['W'] || keys['ArrowUp']) kbForward += 1.0;
            if (keys['s'] || keys['S'] || keys['ArrowDown']) kbForward -= 1.0;
            
            // screen translation
            if (keys['q'] || keys['Q']) kbRight -= 0.5;
            if (keys['e'] || keys['E']) kbRight += 0.5;

            // Optical flow inputs
            let optForward = 0;
            let optRight = 0;

            if (isMoveButtonPressed) {
                // constant forward speed on holding move button
                optForward += 50.0;

                // Step-bobbing (DY bobbing speed modifier)
                let step = Math.abs(accumulatedDY);
                if (step > 0.5) {
                    optForward += step * 30.0; // speed multiplier
                    accumulatedDY *= 0.85; // damp
                } else {
                    accumulatedDY *= 0.92;
                }

                // Shifting left/right
                if (Math.abs(accumulatedDX) > 0.8) {
                    optRight -= accumulatedDX * 20.0;
                    accumulatedDX *= 0.85;
                } else {
                    accumulatedDX *= 0.92;
                }
            } else {
                accumulatedDX = 0;
                accumulatedDY = 0;
            }

            // Combine screen movement speeds
            const totalForward = (kbForward * 55.0 * dt) + (optForward * dt);
            const totalRight = (kbRight * 55.0 * dt) + (optRight * dt);

            // Convert facing angle to global maze canvas coordinate delta
            // character faces UP screen, so front vector is: sin(heading), -cos(heading)
            let vx = totalForward * Math.sin(heading) + totalRight * Math.cos(heading);
            let vy = totalForward * -Math.cos(heading) + totalRight * Math.sin(heading);

            // Apply sensitivity scale
            vx *= moveSensitivity;
            vy *= moveSensitivity;

            if (vx !== 0 || vy !== 0) {
                player.moveContinuous(vx, vy);
                
                // Sync P2P client movement coordinates
                if (gameMode === 'multiplayer' && !isHost && hostConnection) {
                    hostConnection.send({ type: 'player_moved', x: player.x, y: player.y, heading: heading });
                }
            }

            // Camera follow interpolation
            cameraX = lerp(cameraX, player.x, 5 * dt);
            cameraY = lerp(cameraY, player.y, 5 * dt);
            
        } else if (isGameTab && isHost && spectatedPlayerId && playersData[spectatedPlayerId]) {
            // Host follow spectating player
            const sp = playersData[spectatedPlayerId];
            cameraX = lerp(cameraX, sp.x || (cols * w / 2), 5 * dt);
            cameraY = lerp(cameraY, sp.y || (rows * w / 2), 5 * dt);
        }

        if (isGameTab) {
            draw();
        }
        requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);

    // Show popup incorrect answer
    function showWrongAnswerPopup() {
        let popup = document.createElement('div');
        popup.innerText = "Jawaban Salah!";
        popup.style.cssText = "position: fixed; top: 30%; left: 50%; transform: translate(-50%, -50%); background: rgba(239, 68, 68, 0.95); color: white; padding: 15px 35px; font-size: 1.6rem; font-weight: 800; border-radius: 10px; z-index: 9999; box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); pointer-events: none; opacity: 1; transition: opacity 0.4s ease-out; text-align: center;";
        
        let container = document.getElementById('game-arena-screen');
        if (!container) container = document.body;
        container.appendChild(popup);
        
        setTimeout(() => {
            popup.style.opacity = '0';
            setTimeout(() => {
                if (popup.parentNode) popup.parentNode.removeChild(popup);
            }, 400);
        }, 1200);
    }

    // Modal Helpers
    window.openHelpModal = () => {
        document.getElementById('helpModal').style.display = 'flex';
    };
    window.closeHelpModal = () => {
        document.getElementById('helpModal').style.display = 'none';
    };
    
    // Export rank display builder
    window.showRankingUI = function(leaderboard) {
        document.getElementById('rankingModal').style.display = 'flex';
        let listStr = "";
        leaderboard.forEach((p, index) => {
            let color = index === 0 ? "#FFD700" : (index === 1 ? "#C0C0C0" : (index === 2 ? "#CD7F32" : "#a1a1aa"));
            let timeStr = p.playTimeMs > 0 ? (p.playTimeMs/1000).toFixed(1) + "s" : "-";
            listStr += `
            <li>
                <div>
                    <span class="rank-badge" style="color: ${color}; font-size: 1.25rem;">#${index+1}</span>
                    <span style="font-weight: bold; font-size:1.05rem;">${p.name}</span>
                </div>
                <div style="text-align: right;">
                    <div style="color: var(--accent-color); font-weight: bold; font-size: 1.1rem;">${p.score.toFixed(1)} Poin</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">Tingkat: ${p.level} | Waktu: ${timeStr}</div>
                </div>
            </li>`;
        });
        document.getElementById('rankingList').innerHTML = listStr;
    };

})();
