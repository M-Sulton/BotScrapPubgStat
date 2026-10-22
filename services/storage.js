const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getPlayers() {
  try {
    if (!fs.existsSync(PLAYERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(PLAYERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[Storage] Error reading players.json:', err.message);
    return [];
  }
}

function savePlayers(players) {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Storage] Error writing players.json:', err.message);
    return false;
  }
}

function resolveSteamUrl(steamInput, fallbackName) {
  if (!steamInput || !steamInput.trim()) {
    const clean = (fallbackName || '').trim().replace(/\s+/g, '');
    return `https://steamcommunity.com/id/${encodeURIComponent(clean)}`;
  }
  const input = steamInput.trim();
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
  // Check if numeric SteamID64 (17 digits)
  if (/^\d{17}$/.test(input)) {
    return `https://steamcommunity.com/profiles/${input}`;
  }
  // Otherwise custom URL id
  return `https://steamcommunity.com/id/${encodeURIComponent(input)}`;
}

function extractSteamId(steamInput, fallbackName) {
  if (!steamInput || !steamInput.trim()) return (fallbackName || '').trim();
  const input = steamInput.trim();
  const profileMatch = input.match(/\/profiles\/(\d+)/);
  if (profileMatch) return profileMatch[1];
  const idMatch = input.match(/\/id\/([^\/\?#]+)/);
  if (idMatch) return idMatch[1];
  return input;
}

function addPlayer(playerName, platform = 'steam', steamInput = '', trackerUrlInput = '') {
  let cleanName = (playerName || '').trim();
  const extractedId = extractSteamId(steamInput, cleanName);

  // If name was blank but steam ID/URL was supplied, use extracted ID as name
  if (!cleanName && extractedId) {
    cleanName = extractedId;
  }

  // If user passed a tracker.gg url in trackerUrlInput or steamInput, extract username if name empty
  if (!cleanName && trackerUrlInput) {
    const trMatch = trackerUrlInput.match(/\/profile\/(?:steam|kakao)\/([^\/\?#]+)/);
    if (trMatch) cleanName = decodeURIComponent(trMatch[1]);
  }

  if (!cleanName) return { success: false, message: 'Nama player atau Steam ID / Tracker URL tidak boleh kosong' };

  const players = getPlayers();
  const existing = players.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    return { success: false, message: `Player ${cleanName} sudah terdaftar!` };
  }

  const steamUrl = resolveSteamUrl(steamInput, cleanName);
  const steamId = extractedId || cleanName;
  const trackerUrl = trackerUrlInput && trackerUrlInput.trim() 
    ? trackerUrlInput.trim() 
    : `https://tracker.gg/pubg/profile/steam/${encodeURIComponent(cleanName)}/overview`;

  const todayStr = new Date().toISOString().split('T')[0];

  const newPlayer = {
    id: cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
    name: cleanName,
    platform: platform || 'steam',
    steamId: steamId,
    steamUrl: steamUrl,
    trackerUrl: trackerUrl,
    active: true,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
    addedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    today: {
      date: todayStr,
      matches: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      damage: 0,
      kd: 0,
      winRate: 0,
      top10: 0,
      headshots: 0,
      longestKill: 0,
      recentMatches: []
    },
    yesterday: {
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      matches: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      damage: 0,
      kd: 0,
      winRate: 0,
      top10: 0
    }
  };

  players.push(newPlayer);
  savePlayers(players);
  return { success: true, player: newPlayer };
}

function removePlayer(playerName) {
  const cleanName = playerName.trim().toLowerCase();
  const players = getPlayers();
  const filtered = players.filter(p => p.name.toLowerCase() !== cleanName && p.id !== cleanName);
  if (filtered.length === players.length) {
    return { success: false, message: 'Player tidak ditemukan' };
  }
  savePlayers(filtered);
  return { success: true, message: `Player ${playerName} berhasil dihapus` };
}

function updatePlayerStats(playerName, statsData) {
  const players = getPlayers();
  const index = players.findIndex(p => p.name.toLowerCase() === playerName.toLowerCase() || p.id === playerName.toLowerCase());
  if (index === -1) {
    return { success: false, message: 'Player tidak ditemukan' };
  }

  players[index].lastUpdated = new Date().toISOString();
  if (statsData.today) {
    players[index].today = { ...players[index].today, ...statsData.today };
  }
  if (statsData.yesterday) {
    players[index].yesterday = { ...players[index].yesterday, ...statsData.yesterday };
  }
  if (statsData.avatar) {
    players[index].avatar = statsData.avatar;
  }
  if (statsData.steamId !== undefined) {
    players[index].steamId = statsData.steamId;
  }
  if (statsData.steamUrl !== undefined) {
    players[index].steamUrl = statsData.steamUrl;
  }
  if (statsData.trackerUrl !== undefined) {
    players[index].trackerUrl = statsData.trackerUrl;
  }

  savePlayers(players);
  return { success: true, player: players[index] };
}

function getConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {
        discordToken: '',
        discordChannelId: '',
        cronSchedule: '0 18 * * *',
        cronTimezone: 'Asia/Jakarta',
        pubgApiKey: '',
        port: 3000
      };
    }
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[Storage] Error reading config.json:', err.message);
    return {};
  }
}

function saveConfig(newConfig) {
  try {
    const current = getConfig();
    const merged = { ...current, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return { success: true, config: merged };
  } catch (err) {
    console.error('[Storage] Error writing config.json:', err.message);
    return { success: false, message: err.message };
  }
}

module.exports = {
  getPlayers,
  savePlayers,
  addPlayer,
  removePlayer,
  updatePlayerStats,
  getConfig,
  saveConfig,
  resolveSteamUrl,
  extractSteamId
};
