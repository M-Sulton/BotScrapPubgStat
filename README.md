# 🍗 PUBG BATTLEGROUNDS - Steam Squad Stats & Discord Banter Bot

Dashboard pelacak statistik harian PUBG Steam squad dengan integrasi **Bot Discord** otomatis yang mengirim rekap performa setiap jam **18:00 WIB (6 Sore)**, lengkap dengan **pujian bagi Sultan Chicken Dinner** dan **ejekan pedas bagi beban tim yang losestreak**!

---

## 🎯 FITUR UTAMA

1. **Scrap & Track PUBG Steam Harian:**
   - Rekor **Chicken Dinner (Menang)** vs **Losses (Kalah toosoon)** hari ini & kemarin.
   - Perhitungan otomatis **Win Rate %**, **K/D Ratio**, **Total Kills**, dan **Total Damage**.
   - Riwayat match terakhir hari ini (Placement, Kills, Mode).
   
2. **Leaderboard Antar Player (Input Manual & Live Track):**
   - Daftar player bawaan: **`Petiru`** dan **`Mugen-K`**.
   - Tambah player baru atau hapus player kapan saja lewat antarmuka Web UI.
   - Edit atau simulasi skor statistik manual untuk pengujian langsung.
   - Peringkat otomatis dari Juara 1 (🥇), Juara 2 (🥈), Juara 3 (🥉) berdasarkan jumlah Chicken Dinner & K/D.

3. **Web Dashboard PUBG Tactical (Steam Theme):**
   - Desain premium layaknya lobi game PUBG Steam di PC (Dark military carbon, amber gold highlights, cyber cyan HUD, radar scanning, dan SFX interaktif).
   - Tombol **"REFRESH STATS"** dengan animasi radar berputar.
   - Jam WIB digital real-time dengan countdown laporan 18:00 WIB.

4. **Bot Discord Laporan Jam 18:00 WIB & Banter Bahasa Manusia:**
   - Otomatis mem-posting Embed rekap skor harian ke channel Discord pilihan kamu setiap jam **18:00 WIB**.
   - **Pujian Sultan Ayam (MVP)**: Memuji player dengan rekor win dan kill tertinggi dengan gaya bahasa gamer seru.
   - **Ejekan Beban Squad (Loser)**: Me-roast player yang 0 chicken dinner / toosoon / losestreak dengan kata-kata kocak dan sarkastik layaknya tongkrongan Discord.
   - Tombol **"KIRIM KE DISCORD SEKARANG (TEST)"** di Web UI untuk mencoba bot secara instan.
   - Perintah interaktif di chat Discord: `!pubg`, `!stat`, `!roast`, `!praise`, `!refresh`, `!help`.

---

## 🚀 CARA MENJALANKAN DI KOMPUTER LOKAL

1. Masuk ke folder project:
   ```powershell
   cd d:\Hermes\BotScrapPubgStat
   ```

2. Jalankan server:
   ```powershell
   npm start
   ```

3. Buka browser:
   👉 **http://localhost:3000**

---

## 🤖 PANDUAN LENGKAP MEMASUKKAN BOT KE SERVER DISCORD

Ikuti langkah mudah berikut untuk membuat bot dan mengundangnya ke grup Discord kamu:

### Langkah 1: Buat Bot di Discord Developer Portal
1. Buka [Discord Developer Portal](https://discord.com/developers/applications) dan login.
2. Klik tombol biru **"New Application"** di pojok kanan atas.
3. Beri nama aplikasi, misalnya: `PUBG Steam Squad Bot`, lalu centang persetujuan dan klik **Create**.

### Langkah 2: Ambil Bot Token & Aktifkan Intents
1. Di bilah menu sebelah kiri, klik menu **"Bot"**.
2. Klik tombol **"Reset Token"** (konfirmasi jika diminta password / 2FA).
3. Klik **"Copy"** untuk menyalin token rahasia tersebut. *(Simpan baik-baik!)*
4. Scroll ke bawah pada halaman yang sama, temukan bagian **"Privileged Gateway Intents"**.
5. **WAJIB AKTIFKAN:**
   - Centang ✅ **PRESENCE INTENT**
   - Centang ✅ **SERVER MEMBERS INTENT**
   - Centang ✅ **MESSAGE CONTENT INTENT** *(Sangat penting agar bot bisa merespons chat command!)*
6. Klik tombol hijau **"Save Changes"** di bagian bawah.

### Langkah 3: Undang Bot ke Server Discord Kamu
1. Di menu sebelah kiri, klik **OAuth2** &rarr; lalu klik **URL Generator**.
2. Pada kotak **SCOPES**, centang:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Pada kotak **BOT PERMISSIONS** yang muncul di bawahnya, centang:
   - ✅ `Send Messages`
   - ✅ `Embed Links`
   - ✅ `Attach Files`
   - ✅ `Read Message History`
   - ✅ `View Channels`
4. Di bagian paling bawah, **Copy** URL yang terbuat (contoh: `https://discord.com/oauth2/authorize?client_id=...`).
5. Buka tab baru di browser dan paste URL tersebut.
6. Pilih server Discord grup kamu, lalu klik **Continue** dan **Authorize**. Bot sekarang sudah masuk ke server!

### Langkah 4: Ambil Channel ID & Sambungkan ke Web Dashboard
1. Di aplikasi Discord kamu, buka **User Settings** (ikon gear di samping nama kamu) &rarr; pilih tab **Advanced** &rarr; aktifkan **Developer Mode**.
2. Buka server Discord kamu, cari text channel tempat kamu ingin laporan jam 6 sore dikirim (misalnya `#pubg-rekap` atau `#general`).
3. **Klik kanan** nama channel tersebut &rarr; pilih **"Copy Channel ID"**.
4. Buka Web Dashboard kamu di `http://localhost:3000` (atau IP VPS kamu).
5. Klik ikon **Pengaturan (Gear ⚙️)** di pojok kanan atas.
6. Masukkan:
   - **Discord Bot Token**: *(Token yang kamu copy di Langkah 2)*
   - **Target Discord Channel ID**: *(ID yang kamu copy di Langkah 4)*
   - Klik **Simpan Pengaturan**.
7. Status di header akan otomatis berubah menjadi: **🟢 BOT ONLINE**.
8. Klik tombol **"KIRIM KE DISCORD SEKARANG (TEST)"** untuk mencoba pengiriman pertama!

---

## 🎮 DAFTAR PERINTAH CHAT DI DISCORD

| Command | Fungsi |
|---|---|
| `!pubg` atau `!stat` | Menampilkan laporan lengkap skor squad, Chicken Dinners, K/D, dan Leaderboard hari ini |
| `!roast` | Meminta bot mengejek player yang paling terbeban / 0 Chicken Dinner hari ini dengan bahasa sarkastik |
| `!praise` | Meminta bot memuji player sultan yang menjadi MVP hari ini |
| `!refresh` | Menyuruh bot men-scrape data statistik PUBG Steam terbaru |
| `!help` | Menampilkan panduan bantuan perintah bot |

> ⏰ **Laporan Otomatis:** Setiap hari tepat pukul **18:00 WIB**, bot akan otomatis mengeposkan laporan tanpa perlu diketik manual!

---

## ☁️ DEPLOY KE VPS HERMES (43.156.17.135) 24/7

Bot ini dapat berjalan non-stop di VPS Ubuntu yang sudah kamu sediakan:

### Opsi 1: Otomatis 1-Klik dari Komputer (Deploy Script)
Jalankan perintah ini dari folder `d:\Hermes\BotScrapPubgStat`:
```powershell
npm run deploy:vps
```
Script ini akan otomatis terhubung via SSH ke `43.156.17.135`, mengunggah seluruh file project, memasang Node.js & PM2 di VPS, dan menjalankan bot 24 jam non-stop!

### Opsi 2: Manual via SSH Terminal
1. Buka terminal (PowerShell atau Command Prompt) dan masuk ke VPS:
   ```bash
   ssh ubuntu@43.156.17.135
   # Masukkan password: tiger-96@-desert
   ```

2. Jalankan update dan install Node.js + PM2:
   ```bash
   sudo apt update -y
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```

3. Jalankan bot dengan PM2 agar aktif terus menerus walau terminal ditutup:
   ```bash
   cd /home/ubuntu/BotScrapPubgStat
   npm install --production
   pm2 start server.js --name "pubg-bot"
   pm2 save
   pm2 startup
   ```

4. Akses Web Dashboard kamu dari mana saja melalui:
   👉 **http://43.156.17.135:3000**

---

## 🔑 PUBG OFFICIAL DEVELOPER API (OPSIONAL)

Bot ini sudah dilengkapi dual engine:
1. **Engine Simulasi & Web Scraper**: Langsung aktif tanpa konfigurasi tambahan agar kamu bisa langsung mencoba dan melihat rekap serta leaderboard.
2. **PUBG Official Developer API**:
   - Dapatkan API Key gratis di [developer.pubg.com](https://developer.pubg.com) (kuota gratis 10 request/menit).
   - Masukkan API Key kamu pada menu Pengaturan (⚙️) di Web Dashboard untuk membaca data match resmi Steam secara live!
