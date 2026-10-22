const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const storage = require('./services/storage');
const pubgScraper = require('./services/pubgScraper');
const discordBot = require('./services/discordBot');
const systemMetrics = require('./services/systemMetrics');

const app = express();
const config = storage.getConfig();
let PORT = parseInt(process.env.PORT || config.port || 3000, 10);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Explicit route for PUBG Squad Tracker & Banter Dashboard
app.get('/pubg-scrap', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pubg-scrap.html'));
});

// ---------------- API ENDPOINTS ---------------- //

/**
 * Get Real-time VPS System Metrics & PM2 Status
 */
app.get('/api/system/metrics', async (req, res) => {
  try {
    const metrics = await systemMetrics.getFullSystemMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get comprehensive stats, leaderboard, and dynamic banter
 */
app.get('/api/stats', (req, res) => {
  const players = storage.getPlayers();
  const banter = discordBot.generateBanter(players.filter(p => p.active !== false));
  
  // Calculate squad totals
  const totals = players.reduce(
    (acc, p) => {
      acc.matches += p.today?.matches || 0;
      acc.wins += p.today?.wins || 0;
      acc.losses += p.today?.losses || 0;
      acc.kills += p.today?.kills || 0;
      acc.damage += p.today?.damage || 0;
      return acc;
    },
    { matches: 0, wins: 0, losses: 0, kills: 0, damage: 0 }
  );

  const leaderboard = [...players].sort((a, b) => {
    const aWins = a.today?.wins || 0;
    const bWins = b.today?.wins || 0;
    if (bWins !== aWins) return bWins - aWins;
    const aKd = a.today?.kd || 0;
    const bKd = b.today?.kd || 0;
    if (bKd !== aKd) return bKd - aKd;
    return (b.today?.damage || 0) - (a.today?.damage || 0);
  });

  res.json({
    success: true,
    players,
    leaderboard,
    totals,
    banter,
    discord: discordBot.getBotStatus(),
    lastUpdated: new Date().toISOString()
  });
});

/**
 * Refresh stats from PUBG / Scraper
 */
app.post('/api/refresh', async (req, res) => {
  try {
    const results = await pubgScraper.refreshAllPlayers();
    const players = storage.getPlayers();
    const banter = discordBot.generateBanter(players.filter(p => p.active !== false));

    res.json({
      success: true,
      message: 'Statistik PUBG Steam berhasil di-refresh!',
      results,
      players,
      banter
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get players list
 */
app.get('/api/players', (req, res) => {
  res.json({ success: true, players: storage.getPlayers() });
});

/**
 * Add player
 */
app.post('/api/players', async (req, res) => {
  const { name, platform, steamId, steamUrl, trackerUrl } = req.body;
  const steamInput = steamUrl || steamId || '';
  if (!name && !steamInput && !trackerUrl) {
    return res.status(400).json({ success: false, message: 'Nama player atau Steam ID / Tracker URL wajib diisi!' });
  }

  const result = storage.addPlayer(name, platform || 'steam', steamInput, trackerUrl);
  if (!result.success) {
    return res.status(400).json(result);
  }

  // Initial fetch for the new player
  await pubgScraper.refreshPlayer(result.player);
  res.json({ success: true, message: `Player ${result.player.name} berhasil ditambahkan!`, player: result.player });
});

/**
 * Delete player
 */
app.delete('/api/players/:name', (req, res) => {
  const result = storage.removePlayer(req.params.name);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

/**
 * Update player stats manually
 */
app.put('/api/players/:name/stats', (req, res) => {
  const result = storage.updatePlayerStats(req.params.name, req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

/**
 * Sync player stats directly by parsing raw text copied from Tracker.gg
 */
app.post('/api/players/:name/sync-tracker-text', (req, res) => {
  const { rawText } = req.body;
  if (!rawText) {
    return res.status(400).json({ success: false, message: 'Teks dari Tracker.gg tidak boleh kosong!' });
  }

  const { parseTrackerGgText } = require('./services/trackerParser');
  const parsed = parseTrackerGgText(rawText);
  if (!parsed.success) {
    return res.status(400).json(parsed);
  }

  const updatePayload = {
    today: parsed.today
  };
  if (parsed.yesterday) {
    updatePayload.yesterday = parsed.yesterday;
  }

  const result = storage.updatePlayerStats(req.params.name, updatePayload);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({
    success: true,
    message: `Berhasil sinkron Tracker.gg! Match: ${parsed.today.matches}, Win: ${parsed.today.wins} (0 Fake Chickens), Kills: ${parsed.today.kills}, Damage: ${parsed.today.damage}`,
    parsed,
    player: result.player
  });
});

/**
 * Get configuration
 */
app.get('/api/config', (req, res) => {
  const cfg = storage.getConfig();
  // Mask discord token for security display
  const maskedToken = cfg.discordToken && cfg.discordToken.length > 8 
    ? cfg.discordToken.substring(0, 4) + '...' + cfg.discordToken.substring(cfg.discordToken.length - 4)
    : '';

  res.json({
    ...cfg,
    hasToken: Boolean(cfg.discordToken && cfg.discordToken.trim()),
    maskedToken,
    discordStatus: discordBot.getBotStatus()
  });
});

/**
 * Update configuration
 */
app.post('/api/config', async (req, res) => {
  const { discordToken, discordChannelId, cronSchedule, cronTimezone, pubgApiKey, port } = req.body;
  
  const updateData = {};
  if (discordToken !== undefined) updateData.discordToken = discordToken;
  if (discordChannelId !== undefined) updateData.discordChannelId = discordChannelId;
  if (cronSchedule !== undefined) updateData.cronSchedule = cronSchedule;
  if (cronTimezone !== undefined) updateData.cronTimezone = cronTimezone;
  if (pubgApiKey !== undefined) updateData.pubgApiKey = pubgApiKey;
  if (port !== undefined) updateData.port = parseInt(port, 10);

  const result = storage.saveConfig(updateData);
  if (!result.success) {
    return res.status(500).json(result);
  }

  // Re-initialize Discord bot & scheduler if token/channel changed
  if (discordToken !== undefined || discordChannelId !== undefined || cronSchedule !== undefined) {
    console.log('[Server] Re-initializing Discord bot with updated configuration...');
    discordBot.initScheduler();
    if (discordToken) {
      discordBot.initBot();
    }
  }

  res.json({
    success: true,
    message: 'Konfigurasi berhasil disimpan!',
    config: result.config,
    discordStatus: discordBot.getBotStatus()
  });
});

/**
 * Test send report to Discord
 */
app.post('/api/discord/test', async (req, res) => {
  const sendResult = await discordBot.sendDailyReport();
  if (!sendResult.success) {
    return res.status(400).json(sendResult);
  }
  res.json(sendResult);
});

/**
 * Get Discord bot status
 */
app.get('/api/discord/status', (req, res) => {
  res.json(discordBot.getBotStatus());
});

// ---------------- HERMES AI PROXY ENDPOINTS ---------------- //
const HERMES_API_BASE = process.env.HERMES_API_BASE || 'http://127.0.0.1:3001';

app.get('/api/hermes/status', async (req, res) => {
  try {
    const response = await axios.get(`${HERMES_API_BASE}/api/status`, { timeout: 3000 });
    res.json(response.data);
  } catch (err) {
    res.json({
      success: false,
      service: 'HermesAIBot',
      online: false,
      message: 'Hermes AI Service sedang offline di port 3001.',
      openrouter: { configured: false, model: 'nousresearch/hermes-3-llama-3.1-70b', maxTokens: 1000 },
      telegram: { online: false, lastError: 'Service offline' },
      discord: { online: false, lastError: 'Service offline' }
    });
  }
});

app.get('/api/hermes/tokens', async (req, res) => {
  try {
    const response = await axios.get(`${HERMES_API_BASE}/api/tokens`, { timeout: 8000 });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({
      success: false,
      message: 'Gagal mengambil data kuota token dari Hermes AI Service: ' + (err.response?.data?.error || err.message)
    });
  }
});

app.get('/api/hermes/config', async (req, res) => {
  try {
    const response = await axios.get(`${HERMES_API_BASE}/api/config`, { timeout: 3000 });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ success: false, message: 'Gagal menghubungi Hermes AI Service di port 3001.' });
  }
});

app.post('/api/hermes/config', async (req, res) => {
  try {
    const response = await axios.post(`${HERMES_API_BASE}/api/config`, req.body, { timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ success: false, message: 'Gagal mengirim konfigurasi ke Hermes AI Service: ' + err.message });
  }
});

app.post('/api/hermes/chat', async (req, res) => {
  try {
    const response = await axios.post(`${HERMES_API_BASE}/api/chat`, req.body, { timeout: 60000 });
    res.json(response.data);
  } catch (err) {
    const errData = err.response?.data || { success: false, error: err.message };
    res.status(err.response?.status || 502).json(errData);
  }
});

app.post('/api/hermes/reset', async (req, res) => {
  try {
    const response = await axios.post(`${HERMES_API_BASE}/api/reset`, req.body, { timeout: 3000 });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ success: false, message: 'Gagal me-reset memori Hermes: ' + err.message });
  }
});

// ---------------- SERVICE POWER & LIFECYCLE CONTROLS ---------------- //
let isPubgBotActive = true;

app.get('/api/service/status', async (req, res) => {
  try {
    const metrics = await systemMetrics.getFullSystemMetrics();
    const hermesProc = metrics.pm2.find(p => p.name === 'hermes-ai-bot');
    const pubgProc = metrics.pm2.find(p => p.name === 'pubg-tracker-bot');

    const hermesOnline = hermesProc ? hermesProc.status === 'online' : false;
    const discordStat = discordBot.getBotStatus();

    res.json({
      success: true,
      hermes: {
        status: hermesProc ? hermesProc.status : 'stopped',
        online: hermesOnline,
        memoryMb: hermesProc ? hermesProc.memoryMb : 0,
        cpu: hermesProc ? hermesProc.cpu : 0,
        pid: hermesProc ? hermesProc.pid : 0
      },
      pubg: {
        status: isPubgBotActive ? 'active' : 'stopped',
        botActive: isPubgBotActive,
        discordConnected: discordStat.isConnected,
        cronActive: isPubgBotActive,
        memoryMb: pubgProc ? pubgProc.memoryMb : 0,
        cpu: pubgProc ? pubgProc.cpu : 0,
        pid: pubgProc ? pubgProc.pid : 0
      },
      sleepMode: !hermesOnline && !isPubgBotActive
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/service/:name/:action', async (req, res) => {
  const { name, action } = req.params;

  try {
    // 1. Control Hermes AI Bot (via PM2)
    if (name === 'hermes-ai-bot') {
      if (!['stop', 'start', 'restart'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Aksi tidak valid untuk Hermes AI.' });
      }
      const pm2Result = await systemMetrics.executePm2Action('hermes-ai-bot', action);
      return res.json({
        ...pm2Result,
        service: 'hermes-ai-bot',
        action
      });
    }

    // 2. Control PUBG Scraper & Discord Bot (Internal pause/resume to save CPU/RAM)
    if (name === 'pubg-bot') {
      if (action === 'stop') {
        await discordBot.stopBot();
        isPubgBotActive = false;
        return res.json({
          success: true,
          message: '🛑 Bot Discord & Scraper PUBG berhasil dihentikan. Penggunaan RAM & CPU berkurang!',
          status: 'stopped'
        });
      }
      if (action === 'start' || action === 'restart') {
        discordBot.initBot();
        discordBot.initScheduler();
        isPubgBotActive = true;
        return res.json({
          success: true,
          message: '▶️ Bot Discord & Scraper PUBG berhasil dinyalakan kembali!',
          status: 'active'
        });
      }
      return res.status(400).json({ success: false, message: 'Aksi tidak valid untuk PUBG Bot.' });
    }

    // 3. Global Eco / Sleep Mode (Stops all background bots for 0% CPU & minimum RAM)
    if (name === 'all') {
      if (action === 'sleep') {
        await systemMetrics.executePm2Action('hermes-ai-bot', 'stop');
        await discordBot.stopBot();
        isPubgBotActive = false;
        return res.json({
          success: true,
          message: '🌙 Mode Hemat Daya Diaktifkan! Hermes Bot & PUBG Bot telah dihentikan (RAM & CPU VPS 0%).',
          sleepMode: true
        });
      }
      if (action === 'wake') {
        await systemMetrics.executePm2Action('hermes-ai-bot', 'start');
        discordBot.initBot();
        discordBot.initScheduler();
        isPubgBotActive = true;
        return res.json({
          success: true,
          message: '⚡ Semua Bot & Layanan Berhasil Dinyalakan Kembali!',
          sleepMode: false
        });
      }
      return res.status(400).json({ success: false, message: 'Aksi global tidak valid.' });
    }

    return res.status(404).json({ success: false, message: 'Nama layanan tidak dikenali.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    console.log(`====================================================`);
    console.log(`  🎮 PUBG STEAM STATS & DISCORD BOT RUNNING!        `);
    console.log(`  🌐 Web Dashboard: http://localhost:${portToTry}   `);
    console.log(`  ⏰ Daily Cron: 18:00 WIB (Asia/Jakarta)           `);
    console.log(`====================================================`);

    // Initialize Discord Bot on startup
    discordBot.initBot();
    discordBot.initScheduler();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${portToTry} is occupied. Trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('[Server] Failed to start:', err);
    }
  });
}

startServer(PORT);
