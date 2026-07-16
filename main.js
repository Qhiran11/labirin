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
            title: "1. Pengantar Gelombang Mekanik",
            content: `
                <p><strong>Gelombang mekanik</strong> adalah getaran yang merambat melalui suatu medium perantara (seperti udara, air, tali, atau slinki) untuk memindahkan energi dari satu titik ke titik lainnya.</p>
                <p>Hal terpenting dalam konsep gelombang adalah: <strong>Medium perantara tidak ikut berpindah secara permanen</strong> bersama gelombang. Yang merambat hanyalah energi getaran tersebut.</p>
                <p>Berdasarkan arah getar dan arah rambatnya, gelombang mekanik diklasifikasikan menjadi dua jenis utama:</p>
                <ul>
                    <li><strong>Gelombang Transversal</strong> (perpendicular)</li>
                    <li><strong>Gelombang Longitudinal</strong> (parallel)</li>
                </ul>
            `
        },
        {
            title: "2. Gelombang Transversal",
            content: `
                <p><strong>Gelombang transversal</strong> adalah gelombang yang arah getaran partikel mediumnya **tegak lurus** terhadap arah rambat gelombang.</p>
                <p>Contoh klasik dari gelombang transversal adalah gelombang pada tali yang dihentakkan, gelombang permukaan air, dan gelombang cahaya (meski cahaya adalah gelombang elektromagnetik).</p>
                <p>Karakteristik Gelombang Transversal:</p>
                <ul>
                    <li><strong>Bukit Gelombang (Crest)</strong>: Titik-titik tertinggi dari garis kesetimbangan.</li>
                    <li><strong>Lembah Gelombang (Trough)</strong>: Titik-titik terendah dari garis kesetimbangan.</li>
                    <li><strong>Amplitudo (A)</strong>: Simpangan terjauh dari garis kesetimbangan.</li>
                    <li><strong>Panjang Gelombang (λ)</strong>: Jarak antara dua puncak berturut-turut atau dua lembah berturut-turut.</li>
                </ul>
            `
        },
        {
            title: "3. Gelombang Longitudinal",
            content: `
                <p><strong>Gelombang longitudinal</strong> adalah gelombang yang arah getaran partikel mediumnya **sejajar/searah** dengan arah rambat gelombang.</p>
                <p>Contoh paling umum dari gelombang longitudinal adalah **gelombang bunyi** di udara dan getaran pada pegas (slinki) yang ditarik lalu dilepaskan searah panjangnya.</p>
                <p>Karakteristik Gelombang Longitudinal:</p>
                <ul>
                    <li><strong>Rapatan (Compression)</strong>: Daerah di mana partikel-partikel medium merapat karena tekanan tinggi.</li>
                    <li><strong>Renggangan (Rarefaction)</strong>: Daerah di mana partikel-partikel medium merenggang karena tekanan rendah.</li>
                    <li><strong>Panjang Gelombang (λ)</strong>: Jarak antara pusat rapatan ke rapatan berikutnya yang berdekatan, atau pusat renggangan ke renggangan berikutnya.</li>
                </ul>
            `
        },
        {
            title: "4. Parameter Fisika Gelombang",
            content: `
                <p>Mari pahami besaran dan parameter fisika yang memengaruhi sifat gelombang mekanik:</p>
                <ol>
                    <li><strong>Frekuensi, f (Hz)</strong>: Banyaknya gelombang penuh yang terbentuk dalam waktu satu sekon.</li>
                    <li><strong>Tegangan Tali, T (N)</strong>: Gaya tarik pada medium tali. Semakin kencang tali ditarik (tegangan tinggi), semakin cepat energi getaran menjalar.</li>
                    <li><strong>Cepat Rambat, v (m/s)</strong>: Kelajuan gelombang merambat. Dirumuskan secara matematis dengan tegangan medium tali sebagai: <br><strong>v = √(T / μ)</strong> (cepat rambat sebanding dengan akar tegangan tali).</li>
                    <li><strong>Hubungan Dasar</strong>: Cepat rambat, frekuensi, dan panjang gelombang dihubungkan dengan persamaan konsisten: <br><strong>v = f * λ</strong>  atau  <strong>λ = v / f</strong>.</li>
                </ol>
                <p><em>Konsekuensi Fisik:</em> Pada medium yang sama (v konstan), meningkatkan frekuensi (f) akan **memperpendek panjang gelombang (λ)**.</p>
            `
        },
        {
            title: "5. Eksperimen Sensor & Game",
            content: `
                <p>Aplikasi ini menyediakan dua cara seru untuk mempraktikkan gelombang:</p>
                <p><strong>1. Simulasi Gelombang (Menu Simulasi):</strong></p>
                <ul>
                    <li>Ubah nilai Frekuensi, Tegangan, dan Redaman lewat slider atau **miringkan ponsel Anda**.</li>
                    <li>Goyangkan ponsel untuk melontarkan pulsa gelombang amplitudo tinggi.</li>
                    <li>Gunakan mode *Slow-Motion* atau *Step-by-Step* untuk mengamati perambatan rapatan longitudinal secara saksama.</li>
                </ul>
                <p><strong>2. Game Labirin (Menu Game Labirin):</strong></p>
                <ul>
                    <li>Navigasikan karakter di labirin menuju ruangan dengan label huruf (**A, B, C, D**) yang mewakili jawaban benar dari pertanyaan fisika.</li>
                    <li>Gunakan sensor orientasi ponsel untuk berputar arah, dan tahan tombol jalan untuk maju!</li>
                </ul>
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
        progressBar.style.width = `${progressPercent}%`;
        pageText.innerText = `Kartu ${materiIndex + 1} dari ${materiCards.length}`;
    }

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