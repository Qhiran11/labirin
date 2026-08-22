(() => {
    // ====== Tab Router (SPA Navigation) ======
    window.switchTab = function(tabId) {
        // Deactivate all tabs
        const tabs = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => btn.classList.remove('active'));
        
        // Activate target tab
        const targetTab = document.getElementById(`tab-${tabId}`);
        if (targetTab) targetTab.classList.add('active');
        
        const targetBtn = document.getElementById(`btn-tab-${tabId}`);
        if (targetBtn) targetBtn.classList.add('active');
        
        // Special actions on tab switch
        if (tabId === 'riwayat') {
            window.updateHistoryTable();
        }
    };

    // ====== Interactive Learning Cards (Materi) ======
    let materiIndex = 0;
    const materiCards = [
        {
            title: "1. Pengertian & Konsep Dasar Gelombang",
            category: "Konsep Dasar",
            content: `
                <p>Konsep gelombang merupakan salah satu dasar utama dalam ilmu fisika. Perannya sangat penting dalam kehidupan sehari-hari, bahkan dalam dunia musik modern. Setiap jenis suara dan musik bergantung pada gelombang yang dihasilkan oleh sumber dan diterima oleh indera pendengaran <em>(Halliday dkk, 2010)</em>.</p>
                
                <div class="materi-highlight-box">
                    <p><strong>Definisi Gelombang:</strong> Gelombang merupakan bentuk <strong>getaran yang merambat</strong> melalui suatu medium tanpa menyebabkan perpindahan permanen pada bagian-bagian medium tersebut <em>(Abdullah, 2017)</em>.</p>
                </div>
                
                <p><strong>Prinsip Utama Perambatan Gelombang:</strong></p>
                <ul>
                    <li><strong>Medium Tetap:</strong> Partikel medium perantara (udara, air, tali, atau slinki) hanya berosilasi di sekitar titik kesetimbangannya dan tidak ikut berpindah secara permanen.</li>
                    <li><strong>Transfer Energi:</strong> Yang berpindah dan merambat dari satu tempat ke tempat lain adalah <strong>energi getaran</strong>.</li>
                </ul>
            `
        },
        {
            title: "2. Besaran-Besaran Fisika Gelombang",
            category: "Besaran & Rumus",
            content: `
                <p>Untuk memahami karakteristik gelombang, mari kita pelajari besaran-besaran fisika utama gelombang <em>(Abdullah, 2017)</em>:</p>

                <div class="materi-grid-2">
                    <div class="materi-subcard">
                        <h4><i class='bx bx-move-vertical'></i> Simpangan (y) & Amplitudo (A)</h4>
                        <p><strong>Simpangan (y):</strong> Jarak suatu titik pada medium dari posisi kesetimbangannya seiring berjalannya waktu (bisa bernilai positif/negatif).</p>
                        <p><strong>Amplitudo (A):</strong> Simpangan maksimum/terjauh dari titik kesetimbangan.</p>
                    </div>
                    <div class="materi-subcard">
                        <h4><i class='bx bx-time-five'></i> Periode (T) & Frekuensi (f)</h4>
                        <p><strong>Periode (T):</strong> Waktu yang dibutuhkan suatu titik untuk melakukan 1 kali getaran penuh.</p>
                        <p><strong>Frekuensi (f):</strong> Banyaknya getaran penuh yang terjadi dalam waktu satu detik (Hz).</p>
                    </div>
                </div>

                <div class="formula-box">
                    <div class="formula-title"><i class='bx bx-calculator'></i> Persamaan Periode, Frekuensi, & Cepat Rambat</div>
                    <div class="formula-grid">
                        <div class="formula-item">
                            <span class="formula-label">Periode (T):</span>
                            <span class="formula-eq">T = t / n</span>
                            <span class="formula-desc">t = waktu total (s), n = jumlah gelombang</span>
                        </div>
                        <div class="formula-item">
                            <span class="formula-label">Frekuensi (f):</span>
                            <span class="formula-eq">f = n / t = 1 / T</span>
                            <span class="formula-desc">Satuan: Hertz (Hz)</span>
                        </div>
                        <div class="formula-item">
                            <span class="formula-label">Cepat Rambat (v):</span>
                            <span class="formula-eq">v = λ · f = λ / T</span>
                            <span class="formula-desc">v = cepat rambat (m/s), λ = panjang gelombang (m)</span>
                        </div>
                    </div>
                </div>
            `
        },
        {
            title: "3. Klasifikasi & Jenis-Jenis Gelombang",
            category: "Jenis Gelombang",
            content: `
                <p>Gelombang diklasifikasikan berdasarkan medium perantara dan arah getarnya <em>(Halliday dkk, 2010; Abdullah, 2017)</em>:</p>

                <h3>A. Berdasarkan Medium Perambatan</h3>
                <ul>
                    <li><strong>Gelombang Elektromagnetik:</strong> Gelombang yang dapat merambat <em>tanpa memerlukan medium perantara</em> (contoh: gelombang radio, cahaya, sinar-X).</li>
                    <li><strong>Gelombang Mekanik:</strong> Gelombang yang <em>memerlukan medium perantara</em> untuk merambat (contoh: gelombang tali, air, bunyi).</li>
                </ul>

                <h3>B. Berdasarkan Arah Getar dan Arah Rambat</h3>
                
                <div class="materi-diagram-card">
                    <h4>1. Gelombang Transversal</h4>
                    <p>Gelombang yang arah getarannya <strong>tegak lurus</strong> terhadap arah rambatnya. Terdiri atas <strong>Bukit (Crest)</strong> dan <strong>Lembah (Trough)</strong>. Satu panjang gelombang (λ) didefinisikan sebagai jarak 2 puncak berturut-turut atau 1 bukit + 1 lembah.</p>
                    <div class="materi-img-box">
                        <img src="assets/materi_images/page_5_img_1.jpeg" alt="Gelombang Transversal" class="materi-img">
                        <span class="img-caption">Gambar 2.2: Ilustrasi Gelombang Transversal (Bukit, Lembah, Amplitudo & Puncak)</span>
                    </div>
                </div>

                <div class="materi-diagram-card" style="margin-top: 1.5rem;">
                    <h4>2. Gelombang Longitudinal</h4>
                    <p>Gelombang yang arah getarannya <strong>sejajar / searah</strong> dengan arah rambatnya. Terdiri dari bagian <strong>Rapatan (Compression)</strong> dan <strong>Renggangan (Rarefaction)</strong>. Satu panjang gelombang (λ) adalah jarak antara dua pusat rapatan atau dua pusat renggangan yang berurutan.</p>
                    <div class="materi-img-box">
                        <img src="assets/materi_images/page_4_img_1.jpeg" alt="Gelombang Longitudinal" class="materi-img">
                        <span class="img-caption">Gambar 2.1: Ilustrasi Gelombang Longitudinal pada Slinki (Rapatan & Renggangan)</span>
                    </div>
                </div>
            `
        },
        {
            title: "4. Persamaan Gelombang Berjalan",
            category: "Gelombang Berjalan",
            content: `
                <p><strong>Gelombang Berjalan</strong> merupakan getaran yang merambat dari satu titik ke titik lainnya di mana setiap titik yang dilewati mengalami getaran dengan <strong>amplitudo (A) dan frekuensi (f) yang sama</strong> <em>(Abdullah, 2017)</em>.</p>

                <div class="formula-box highlight-border">
                    <div class="formula-title"><i class='bx bx-math'></i> Persamaan Simpangan Gelombang Berjalan</div>
                    <div class="formula-eq-large">y(x, t) = A sin(ωt ∓ kx)</div>
                    <p style="text-align: center; font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem;">
                        Tanda <strong>(-)</strong> jika gelombang merambat ke arah positif (kanan sumbu X).<br>
                        Tanda <strong>(+)</strong> jika gelombang merambat ke arah negatif (kiri sumbu X).
                    </p>
                </div>

                <h3>Konstanta & Parameter Gelombang Berjalan:</h3>
                <div class="formula-grid">
                    <div class="formula-item">
                        <span class="formula-label">Bilangan Gelombang (k):</span>
                        <span class="formula-eq">k = 2π / λ</span>
                        <span class="formula-desc">Tetapan gelombang (rad/m)</span>
                    </div>
                    <div class="formula-item">
                        <span class="formula-label">Frekuensi Sudut (ω):</span>
                        <span class="formula-eq">ω = 2π / T = 2π f</span>
                        <span class="formula-desc">Kecepatan sudut (rad/s)</span>
                    </div>
                </div>

                <div class="materi-notes">
                    <p><strong>Keterangan:</strong><br>
                    • <strong>y</strong> = Simpangan pada posisi x dan waktu t (m)<br>
                    • <strong>A</strong> = Amplitudo simpangan maksimum (m)<br>
                    • <strong>t</strong> = Waktu tempuh gelombang (s)<br>
                    • <strong>x</strong> = Posisi titik dari sumber getar (m)</p>
                </div>
            `
        },
        {
            title: "5. Gelombang Stasioner (Gelombang Berdiri)",
            category: "Gelombang Stasioner",
            content: `
                <p><strong>Gelombang Stasioner (Berdiri)</strong> terjadi ketika dua gelombang dengan frekuensi dan amplitudo sama bergerak dengan arah berlawanan dan saling berinterferensi <em>(Abdullah, 2017)</em>.</p>

                <div class="materi-diagram-card">
                    <h3>1. Gelombang Stasioner Ujung Bebas</h3>
                    <p>Pada ujung bebas, gelombang pantul <strong>tidak mengalami perubahan fase</strong> (fase gelombang datang dan pantul identik, Δφ = 0).</p>
                    
                    <div class="formula-box">
                        <div class="formula-eq">y = 2A cos(kx) sin(ωt)</div>
                        <div class="formula-desc">Amplitudo Stasioner Ujung Bebas: <strong>A_s = 2A cos(kx)</strong></div>
                    </div>

                    <div class="materi-img-box">
                        <img src="assets/materi_images/page_7_img_1.jpeg" alt="Stasioner Ujung Bebas" class="materi-img">
                        <span class="img-caption">Gambar 2.3: Bentuk Gelombang Stasioner Ujung Bebas</span>
                    </div>
                </div>

                <div class="materi-diagram-card" style="margin-top: 1.5rem;">
                    <h3>2. Gelombang Stasioner Ujung Terikat</h3>
                    <p>Pada ujung terikat, gelombang pantul <strong>mengalami pembalikan fase</strong> sebesar Δφ = 1/2 π.</p>
                    
                    <div class="formula-box">
                        <div class="formula-eq">y = 2A sin(kx) cos(ωt)</div>
                        <div class="formula-desc">Amplitudo Stasioner Ujung Terikat: <strong>A_s = 2A sin(kx)</strong></div>
                    </div>

                    <div class="materi-img-box">
                        <img src="assets/materi_images/page_8_img_1.jpeg" alt="Stasioner Ujung Terikat" class="materi-img">
                        <span class="img-caption">Gambar 2.4: Bentuk Gelombang Stasioner Ujung Terikat</span>
                    </div>
                </div>
            `
        },
        {
            title: "6. Sifat-Sifat Utama Gelombang",
            category: "Sifat Gelombang",
            content: `
                <p> Gelombang memiliki empat sifat fisik khas ketika merambat melalui medium perantara <em>(Giancoli, 2001; Halliday dkk, 2010)</em>:</p>

                <div class="materi-grid-2">
                    <div class="materi-subcard">
                        <h4><i class='bx bx-git-merge'></i> a) Interferensi</h4>
                        <p>Perpaduan dua gelombang. Jika sefase akan <strong>menguatkan (konstruktif)</strong>, jika berlawanan fase akan <strong>meniadakan (destruktif)</strong>.</p>
                    </div>

                    <div class="materi-subcard">
                        <h4><i class='bx bx-reflect-left'></i> b) Pemantulan (Refleksi)</h4>
                        <p>Sebagian energi gelombang dipantulkan saat menumbuk penghalang/batas medium. Contoh: gema suara dan pantulan air.</p>
                    </div>
                </div>

                <div class="materi-diagram-card" style="margin-top: 1rem;">
                    <div class="materi-img-box">
                        <img src="assets/materi_images/page_9_img_1.jpeg" alt="Pemantulan Gelombang" class="materi-img">
                        <span class="img-caption">Gambar 2.5: Pemantulan Gelombang / Cahaya pada Batas Medium</span>
                    </div>
                </div>

                <div class="materi-grid-2" style="margin-top: 1.5rem;">
                    <div class="materi-subcard">
                        <h4><i class='bx bx-git-commit'></i> c) Pembiasan (Refraksi)</h4>
                        <p>Perubahan arah rambat gelombang ketika memasuki medium dengan kecepatan rambat berbeda. Contoh: gelombang air laut melengkung mendekati pantai di perairan dangkal.</p>
                    </div>

                    <div class="materi-subcard">
                        <h4><i class='bx bx-wifi'></i> d) Difraksi</h4>
                        <p>Penyebaran atau pelengkuran gelombang ketika melewati celah sempit atau rintangan. Besarnya difraksi ditentukan oleh ukuran celah dan panjang gelombang (λ).</p>
                    </div>
                </div>

                <div class="materi-diagram-card" style="margin-top: 1rem;">
                    <div class="materi-img-box">
                        <img src="assets/materi_images/page_10_img_1.jpeg" alt="Refraksi Gelombang" class="materi-img">
                        <span class="img-caption">Gambar 2.6: Refraksi (Pembiasan) Gelombang Air Laut Secara Bertahap</span>
                    </div>
                </div>
            `
        },
        {
            title: "7. Rangkuman Formula & Panduan Aplikasi",
            category: "Rangkuman & Game",
            content: `
                <h3><i class='bx bx-list-check'></i> Rangkuman Formula Kunci Gelombang Mekanik</h3>
                
                <table class="materi-summary-table">
                    <thead>
                        <tr>
                            <th>Besaran / Konsep</th>
                            <th>Persamaan Matematika</th>
                            <th>Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Frekuensi & Periode</td>
                            <td><code>f = n / t</code> , <code>T = t / n</code></td>
                            <td><code>f = 1 / T</code></td>
                        </tr>
                        <tr>
                            <td>Cepat Rambat</td>
                            <td><code>v = λ · f</code></td>
                            <td>Laju rambat gelombang (m/s)</td>
                        </tr>
                        <tr>
                            <td>Gelombang Berjalan</td>
                            <td><code>y = A sin(ωt ∓ kx)</code></td>
                            <td><code>k = 2π/λ</code>, <code>ω = 2πf</code></td>
                        </tr>
                        <tr>
                            <td>Stasioner Ujung Bebas</td>
                            <td><code>A_s = 2A cos(kx)</code></td>
                            <td>Fase datang & pantul identik</td>
                        </tr>
                        <tr>
                            <td>Stasioner Ujung Terikat</td>
                            <td><code>A_s = 2A sin(kx)</code></td>
                            <td>Beda fase Δφ = 1/2 π</td>
                        </tr>
                    </tbody>
                </table>

                <div class="materi-highlight-box" style="margin-top: 1.5rem;">
                    <h4><i class='bx bx-rocket'></i> Implementasi pada Aplikasi WAVE UP:</h4>
                    <p><strong>1. Menu Simulasi:</strong> Eksperimen dengan variasi Frekuensi (f), Tegangan Tali (T), dan Redaman secara real-time. Amati perubahan panjang gelombang (λ) sesuai rumus <code>v = λ · f</code>!</p>
                    <p><strong>2. Menu Game Labirin:</strong> Uji pemahaman Anda! Jelajahi labirin dan arahkan karakter ke ruangan bertanda huruf jawaban fisika yang benar.</p>
                </div>
            `
        }
    ];

    function renderMateriCard() {
        const cardContent = document.getElementById('materi-card-content');
        const prevBtn = document.getElementById('materi-prev-btn');
        const nextBtn = document.getElementById('materi-next-btn');
        const progressBar = document.getElementById('materi-progress-bar');
        const pageText = document.getElementById('materi-page-text');

        if (!cardContent) return;

        const currentCard = materiCards[materiIndex];
        cardContent.innerHTML = `
            <h2>${currentCard.title}</h2>
            <div class="materi-body">
                ${currentCard.content}
            </div>
        `;

        // Update button states
        prevBtn.disabled = materiIndex === 0;
        
        if (materiIndex === materiCards.length - 1) {
            nextBtn.innerHTML = "Mulai Bermain! <i class='bx bx-game'></i>";
            nextBtn.onclick = () => window.switchTab('game');
        } else {
            nextBtn.innerHTML = "Berikutnya <i class='bx bx-right-arrow-alt'></i>";
            nextBtn.onclick = () => window.nextMateriCard();
        }

        // Update progress bar and page count
        const progressPercent = ((materiIndex + 1) / materiCards.length) * 100;
        if (progressBar) progressBar.style.width = `${progressPercent}%`;
        if (pageText) pageText.innerText = `Kartu ${materiIndex + 1} dari ${materiCards.length}`;

        // Sync Topic Chips active state
        const topicChips = document.querySelectorAll('.topic-chip');
        topicChips.forEach((chip, index) => {
            if (index === materiIndex) {
                chip.classList.add('active');
                chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                chip.classList.remove('active');
            }
        });
    }

    window.jumpToMateriCategory = function(index) {
        if (index >= 0 && index < materiCards.length) {
            materiIndex = index;
            renderMateriCard();
        }
    };

    window.nextMateriCard = function() {
        if (materiIndex < materiCards.length - 1) {
            materiIndex++;
            renderMateriCard();
        }
    };

    window.prevMateriCard = function() {
        if (materiIndex > 0) {
            materiIndex--;
            renderMateriCard();
        }
    };

    // Fullscreen toggle for reading cards
    window.toggleMateriFullscreen = function() {
        const container = document.getElementById('materi-fullscreen-container');
        const icon = document.getElementById('fs-icon');
        
        if (container.classList.contains('fullscreen')) {
            container.classList.remove('fullscreen');
            icon.className = 'bx bx-fullscreen';
        } else {
            container.classList.add('fullscreen');
            icon.className = 'bx bx-exit-fullscreen';
        }
    };

    // Keyboard navigation for materi cards (ArrowLeft / ArrowRight)
    window.addEventListener('keydown', (e) => {
        const materiTab = document.getElementById('tab-materi');
        if (materiTab && materiTab.classList.contains('active')) {
            if (e.key === 'ArrowLeft') {
                window.prevMateriCard();
            } else if (e.key === 'ArrowRight') {
                window.nextMateriCard();
            }
        }
    });


    // ====== Local Score History Manager (LocalStorage) ======
    window.updateHistoryTable = function() {
        const tableBody = document.getElementById('riwayat-table-body');
        if (!tableBody) return;

        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('wave_up_score_history')) || [];
        } catch(e) {}

        if (history.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem 0;">
                        Belum ada riwayat skor. Mainkan game Latihan Mandiri untuk mencatatkan hasil!
                    </td>
                </tr>
            `;
            return;
        }

        // Render rows in reverse order (newest first)
        let rowsHtml = "";
        history.slice().reverse().forEach((item, index) => {
            // Reconstruct index for deletion matching
            const realIndex = history.length - 1 - index;
            rowsHtml += `
                <tr>
                    <td>${item.date}</td>
                    <td><strong>${item.name}</strong></td>
                    <td><span class="badge" style="background-color: var(--accent-glow); padding:3px 8px; border-radius:4px; font-size:0.75rem; color:#fff;">${item.mode}</span></td>
                    <td style="color: var(--accent-secondary); font-weight: bold;">${item.questions}</td>
                    <td style="color: var(--success-color); font-weight: 800;">${item.score} Poin</td>
                    <td>${item.time}</td>
                    <td style="text-align: center;">
                        <button class="delete-hist-btn" onclick="deleteHistoryItem(${realIndex})" title="Hapus baris ini">
                            <i class='bx bx-trash'></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = rowsHtml;
    };

    window.deleteHistoryItem = function(index) {
        if (!confirm("Hapus baris riwayat skor ini?")) return;
        
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('wave_up_score_history')) || [];
        } catch(e) {}
        
        history.splice(index, 1);
        localStorage.setItem('wave_up_score_history', JSON.stringify(history));
        window.updateHistoryTable();
    };

    window.clearScoreHistory = function() {
        if (confirm("Apakah Anda yakin ingin menghapus seluruh riwayat skor dari browser ini? Tindakan ini tidak dapat dibatalkan.")) {
            localStorage.removeItem('wave_up_score_history');
            window.updateHistoryTable();
        }
    };


    // ====== App Initialization ======
    window.addEventListener('DOMContentLoaded', () => {
        // Init Materi
        renderMateriCard();
        
        // Init History Table
        window.updateHistoryTable();
    });

})();