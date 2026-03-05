from fpdf import FPDF
import os

class WaveUpPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 16)
        self.cell(0, 10, 'Dokumentasi Langkah Pembuatan Aplikasi WAVE UP', 0, 1, 'C')
        self.ln(5)

    def chapter_title(self, title):
        self.set_font('Arial', 'B', 14)
        self.set_fill_color(200, 220, 255)
        self.cell(0, 10, title, 0, 1, 'L', True)
        self.ln(4)

    def step_text(self, step_num, title, description):
        self.set_font('Arial', 'B', 12)
        self.multi_cell(0, 7, f"{step_num}. {title}")
        self.set_font('Arial', '', 11)
        self.multi_cell(0, 6, description)
        self.ln(2)

    def add_screenshot(self, img_path):
        # Membersihkan path dari prefix 'file:///' jika ada
        clean_path = img_path.replace('file:///', '').replace('%20', ' ')
        
        if os.path.exists(clean_path):
            # Menghitung lebar gambar agar proporsional (max width 170mm)
            self.image(clean_path, x=20, w=150)
            self.ln(10)
        else:
            self.set_text_color(255, 0, 0)
            self.cell(0, 10, f"[Gambar tidak ditemukan di: {clean_path}]", 0, 1)
            self.set_text_color(0, 0, 0)
            self.ln(5)

# Inisialisasi PDF
pdf = WaveUpPDF()
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_page()

# Data Konten
content = [
    {
        "fase": "Fase 1: Mode Dasar (Single Player)",
        "steps": [
            (1, "Tampilan Awal Aplikasi", "Berisi judul sederhana 'Welcome to WAVE UP' untuk menyambut pemain.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 013837.png"),
            (2, "Tampilan Form Input Soal", "Tampilan untuk memasukkan 10 pertanyaan beserta jawaban, dilengkapi tombol 'Isi Cepat'.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 013856.png"),
            (3, "Tampilan Pengaturan Kamera dan Kontrol", "Halaman untuk menyesuaikan 'Jarak Kamera' dan 'Sensitivitas Gerakan'.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 014401.png"),
            (4, "Tampilan Gameplay Labirin (Single Player)", "Tampilan utama permainan berisi area labirin dan Legenda Jawaban.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 014430.png"),
        ]
    },
    {
        "fase": "Fase 2: Pengembangan Mode Multiplayer (Host)",
        "steps": [
            (5, "Tampilan Awal Pemilihan Peran", "Layar awal memisahkan pengguna menjadi Host atau Pemain.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 014515.png"),
            (6, "Tampilan Lobi Host (Persiapan)", "Sistem Generate Kode Room untuk Host dan pengaturan waktu.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 014616.png"),
            (7, "Tampilan Lobi Host (Pemain Bergabung)", "Sistem sinkronisasi saat pemain masuk ke room (1/4).", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 014925.png"),
        ]
    },
    {
        "fase": "Fase 3: Detil Header dan Komponen Permainan (Web)",
        "steps": [
            (8, "Tampilan Header Status", "Komponen informasi Waktu dan Skor yang berjalan real-time.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 015015.png"),
            (9, "Detail Area Labirin", "Implementasi grid labirin padat dan titik tujuan berwarna.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 015030.png"),
            (10, "Detail Legenda Jawaban UI", "Daftar pilihan ganda berupa tombol warna dengan label jawaban.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot 2026-03-06 015036.png"),
        ]
    },
    {
        "fase": "Fase 4: Tahap Multiplayer (Antarmuka Pemain & Mobile)",
        "steps": [
            (11, "Tampilan Form Gabung Permainan", "Antarmuka responsif bagi Pemain untuk input Nama dan Kode Room.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot_2026-03-06-01-53-10-94.jpg"),
            (12, "Tampilan Ruang Tunggu Pemain", "Logika status pemain: Menunggu Host memulai permainan.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot_2026-03-06-01-51-26-45.jpg"),
            (13, "Tampilan Pengaturan Permainan (Mobile)", "Tampilan responsif mencakup pengaturan kamera dan layar soal.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot_2026-03-06-01-52-15-97.jpg"),
            (14, "Tampilan Gameplay Labirin (Mobile View)", "Tampilan navigasi layar penuh saat menjalankan karakter.", "d:/Qhiran/Projek/WEB/labirin_multiplayer_version/dokumentasi/Screenshot_2026-03-06-01-52-12-95.jpg"),
        ]
    }
]

# Proses pembuatan isi PDF
for section in content:
    pdf.chapter_title(section["fase"])
    for num, title, desc, img in section["steps"]:
        # Cek jika sisa ruang di halaman tidak cukup untuk gambar, tambah halaman baru
        if pdf.get_y() > 200: 
            pdf.add_page()
        pdf.step_text(num, title, desc)
        pdf.add_screenshot(img)

# Simpan File
output_name = "Dokumentasi_WAVE_UP.pdf"
pdf.output(output_name)
print(f"Berhasil! File {output_name} telah dibuat.")