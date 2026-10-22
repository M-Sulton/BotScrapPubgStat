#!/usr/bin/env bash
# ========================================================
# Script Deployment Otomatis di Ubuntu VPS Hermes
# Jalankan ini di terminal VPS kamu
# ========================================================

set -e

echo "🚀 Memulai instalasi PUBG Steam Stats Bot di Ubuntu VPS..."

# 1. Update OS packages
sudo apt update -y

# 2. Pastikan Node.js 20 LTS terpasang
if ! command -v node &> /dev/null; then
    echo "📦 Menginstall Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# 3. Pastikan PM2 terpasang untuk 24/7 background process
if ! command -v pm2 &> /dev/null; then
    echo "⚙️ Menginstall PM2 Process Manager..."
    sudo npm install -g pm2
fi

echo "✅ Node.js: $(node -v)"
echo "✅ NPM: $(npm -v)"
echo "✅ PM2: $(pm2 -v)"

# 4. Install dependencies
echo "📦 Menginstall dependency project..."
npm install --production

# 5. Jalankan dengan PM2
echo "🔥 Menjalankan Bot & Web Dashboard..."
pm2 delete pubg-tracker-bot || true
pm2 start server.js --name "pubg-tracker-bot"
pm2 save
pm2 startup

echo "=========================================================="
echo "  🎉 BOT BERHASIL BERJALAN DI LATAR BELAKANG (24/7)!"
echo "  🌐 Buka browser: http://43.156.17.135:3000"
echo "  ⏰ Jadwal Laporan: Setiap 18:00 WIB"
echo "=========================================================="
