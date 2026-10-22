const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
  host: '43.156.17.135',
  port: 22,
  username: 'ubuntu',
  password: 'tiger-96@-desert',
  readyTimeout: 30000
};

console.log('======================================================');
console.log('  🚀 DEPLOYING PUBG STAT BOT TO VPS HERMES             ');
console.log(`  🌐 Target: ${config.username}@${config.host}:${config.port}`);
console.log('======================================================');

const conn = new Client();

conn.on('ready', () => {
  console.log('✅ SSH Connection established successfully!');

  // Run deployment sequence on remote Ubuntu VPS
  const commands = [
    'echo "=== Updating packages and checking Node.js ==="',
    'sudo apt update -y',
    'which node || (curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs)',
    'which pm2 || sudo npm install -g pm2',
    'mkdir -p /home/ubuntu/BotScrapPubgStat/data /home/ubuntu/BotScrapPubgStat/services /home/ubuntu/BotScrapPubgStat/public',
    'echo "Node version: $(node -v)"',
    'echo "NPM version: $(npm -v)"'
  ].join(' && ');

  console.log('📦 Setting up environment on Ubuntu VPS...');
  conn.exec(commands, (err, stream) => {
    if (err) {
      console.error('❌ Remote setup error:', err.message);
      conn.end();
      return;
    }

    stream.on('close', (code, signal) => {
      console.log(`✅ VPS Environment ready (exit code: ${code})`);
      uploadFilesAndStart();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
});

conn.on('error', (err) => {
  console.error('❌ SSH Connection Error:', err.message);
  console.log('\n💡 TIPS JIKA KONEKSI GAGAL:');
  console.log('1. Pastikan Security Group / Firewall VPS membuka port 22 (SSH).');
  console.log('2. Kamu juga dapat menjalankan bot secara lokal di komputer dengan command:');
  console.log('   npm start');
  console.log('3. Dashboard akan langsung terbuka di http://localhost:3000');
});

function uploadFilesAndStart() {
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('❌ SFTP Error:', err.message);
      conn.end();
      return;
    }

    console.log('📂 Uploading project files to VPS...');

    const localBase = path.join(__dirname, '..');
    const remoteBase = '/home/ubuntu/BotScrapPubgStat';

    const filesToUpload = [
      { local: path.join(localBase, 'package.json'), remote: `${remoteBase}/package.json` },
      { local: path.join(localBase, 'server.js'), remote: `${remoteBase}/server.js` },
      { local: path.join(localBase, 'services', 'storage.js'), remote: `${remoteBase}/services/storage.js` },
      { local: path.join(localBase, 'services', 'pubgScraper.js'), remote: `${remoteBase}/services/pubgScraper.js` },
      { local: path.join(localBase, 'services', 'trackerParser.js'), remote: `${remoteBase}/services/trackerParser.js` },
      { local: path.join(localBase, 'services', 'discordBot.js'), remote: `${remoteBase}/services/discordBot.js` },
      { local: path.join(localBase, 'data', 'config.json'), remote: `${remoteBase}/data/config.json` },
      { local: path.join(localBase, 'data', 'players.json'), remote: `${remoteBase}/data/players.json` },
      { local: path.join(localBase, 'public', 'index.html'), remote: `${remoteBase}/public/index.html` },
      { local: path.join(localBase, 'public', 'styles.css'), remote: `${remoteBase}/public/styles.css` },
      { local: path.join(localBase, 'public', 'app.js'), remote: `${remoteBase}/public/app.js` }
    ];

    let completed = 0;
    filesToUpload.forEach(f => {
      sftp.fastPut(f.local, f.remote, (pErr) => {
        if (pErr) {
          console.warn(`⚠️ Failed to upload ${f.local} -> ${f.remote}:`, pErr.message);
        } else {
          console.log(`  Uploaded: ${path.basename(f.remote)}`);
        }

        completed++;
        if (completed === filesToUpload.length) {
          console.log('✅ All files uploaded successfully!');
          startRemoteApp();
        }
      });
    });
  });
}

function startRemoteApp() {
  const remoteBase = '/home/ubuntu/BotScrapPubgStat';
  const startCmd = [
    `cd ${remoteBase}`,
    'npm install --production',
    'pm2 delete pubg-tracker-bot || true',
    'pm2 start server.js --name "pubg-tracker-bot"',
    'pm2 save',
    'pm2 status'
  ].join(' && ');

  console.log('🚀 Installing dependencies and starting PM2 daemon...');
  conn.exec(startCmd, (err, stream) => {
    if (err) {
      console.error('❌ Failed to start application:', err.message);
      conn.end();
      return;
    }

    stream.on('close', () => {
      console.log('======================================================');
      console.log('  🎉 DEPLOYMENT COMPLETE! PUBG BOT IS LIVE ON VPS!   ');
      console.log('  🌐 Web Dashboard: http://43.156.17.135:3000         ');
      console.log('  ⏰ Bot Scheduled at 18:00 WIB daily                 ');
      console.log('======================================================');
      conn.end();
    }).on('data', (d) => process.stdout.write(d.toString()))
      .stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
}

// Connect
conn.connect(config);
