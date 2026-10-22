/**
 * PUBG BATTLEGROUNDS Steam Squad Tracker & Discord Bot Dashboard
 * Frontend Application Controller
 */

let appState = {
  players: [],
  leaderboard: [],
  totals: {},
  banter: {},
  discord: {},
  config: {},
  isRefreshing: false
};

// Tactical Web Audio SFX Synthesizer
const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
  },
  playClick() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  },
  playChicken() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.08);
        osc.stop(this.ctx.currentTime + i * 0.08 + 0.2);
      });
    } catch (e) {}
  }
};

// DOM Content Loaded Handler
document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  setupEventListeners();
  loadData();
  loadConfig();
  HermesHub.init();
  if (window.TokenAnalyticsController) {
    window.TokenAnalyticsController.init();
  }

  // Polling every 30 seconds for background updates
  setInterval(loadData, 30000);
});

/**
 * Live Clock for WIB (UTC+7)
 */
function initLiveClock() {
  const clockEl = document.getElementById('clock-time');
  const heroDateEl = document.getElementById('hero-date-display');

  function update() {
    const now = new Date();
    // Jakarta format
    const timeOptions = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const dateOptions = { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    
    if (clockEl) {
      clockEl.textContent = `${now.toLocaleTimeString('id-ID', timeOptions)} WIB`;
    }
    if (heroDateEl) {
      heroDateEl.textContent = now.toLocaleDateString('id-ID', dateOptions);
    }
  }

  update();
  setInterval(update, 1000);
}

/**
 * Load stats from server
 */
async function loadData() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();

    appState.players = data.players || [];
    appState.leaderboard = data.leaderboard || [];
    appState.totals = data.totals || {};
    appState.banter = data.banter || {};
    appState.discord = data.discord || {};

    renderDashboard();
  } catch (err) {
    console.error('Error loading data:', err);
    showToast('Gagal terhubung ke backend stats', 'error');
  }
}

/**
 * Load config from server
 */
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const config = await res.json();
    appState.config = config;

    // Populate settings form
    const tokenInput = document.getElementById('input-discord-token');
    const channelInput = document.getElementById('input-channel-id');
    const cronInput = document.getElementById('input-cron');
    const pubgKeyInput = document.getElementById('input-pubg-key');

    if (tokenInput && config.discordToken) tokenInput.value = config.discordToken;
    if (channelInput && config.discordChannelId) channelInput.value = config.discordChannelId;
    if (cronInput && config.cronSchedule) cronInput.value = config.cronSchedule;
    if (pubgKeyInput && config.pubgApiKey) pubgKeyInput.value = config.pubgApiKey;

    updateDiscordStatusUI(config.discordStatus || appState.discord);

    // Sync toggle button state with server service status
    try {
      const srvRes = await fetch('/api/service/status');
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        const pubgToggleBtn = document.getElementById('btn-toggle-pubg-service');
        const pubgToggleText = document.getElementById('pubg-service-toggle-text');
        if (pubgToggleBtn && pubgToggleText && srvData.success) {
          if (!srvData.pubg.botActive) {
            pubgToggleText.textContent = 'START BOT';
            pubgToggleBtn.className = 'btn-tactical btn-start-success';
          } else {
            pubgToggleText.textContent = 'STOP BOT (HEMAT RAM)';
            pubgToggleBtn.className = 'btn-tactical btn-danger-soft';
          }
        }
      }
    } catch (e) {}
  } catch (err) {
    console.warn('Could not load config:', err);
  }
}

/**
 * Update Discord status chip in header
 */
function updateDiscordStatusUI(discord) {
  const chip = document.getElementById('discord-indicator');
  const text = document.getElementById('discord-status-text');
  if (!chip || !text) return;

  if (discord.isConnected) {
    chip.className = 'discord-chip online';
    text.textContent = `BOT ONLINE (${discord.username || 'Discord'})`;
  } else if (discord.status === 'no_token') {
    chip.className = 'discord-chip offline';
    text.textContent = 'DISCORD BELUM DISIAPKAN';
  } else {
    chip.className = 'discord-chip offline';
    text.textContent = 'DISCORD DISCONNECTED';
  }
}

/**
 * Render all dashboard sections
 */
function renderDashboard() {
  renderKpis();
  renderBanter();
  renderLeaderboard();
  renderPlayerCards();
  updateDiscordStatusUI(appState.discord);
}

/**
 * Render KPI Cards
 */
function renderKpis() {
  const winsEl = document.getElementById('kpi-total-wins');
  const matchesEl = document.getElementById('kpi-total-matches');
  const killsEl = document.getElementById('kpi-total-kills');
  const mvpNameEl = document.getElementById('kpi-mvp-name');
  const mvpStatEl = document.getElementById('kpi-mvp-stat');
  const lossesSubEl = document.getElementById('kpi-losses-sub');
  const dmgSubEl = document.getElementById('kpi-damage-sub');
  const countBadgeEl = document.getElementById('player-count-badge');

  const totals = appState.totals;
  if (winsEl) winsEl.textContent = totals.wins || 0;
  if (matchesEl) matchesEl.textContent = totals.matches || 0;
  if (killsEl) killsEl.textContent = totals.kills || 0;
  if (lossesSubEl) lossesSubEl.textContent = `${totals.losses || 0} Kalah toosoon`;
  if (dmgSubEl) dmgSubEl.textContent = `${totals.damage || 0} Total Damage`;

  if (countBadgeEl) {
    countBadgeEl.textContent = `${appState.players.length} Players Monitored`;
  }

  // MVP
  const best = appState.banter.bestPlayer;
  if (best && mvpNameEl) {
    mvpNameEl.textContent = best.name;
    if (mvpStatEl) {
      mvpStatEl.textContent = `${best.today?.wins || 0} Chicken • K/D ${best.today?.kd || 0}`;
    }
  } else if (mvpNameEl) {
    mvpNameEl.textContent = '-';
  }
}

/**
 * Render Discord Banter Preview
 */
function renderBanter() {
  const praiseEl = document.getElementById('preview-praise-text');
  const roastEl = document.getElementById('preview-roast-text');

  if (praiseEl) {
    praiseEl.innerHTML = formatMarkdownToHtml(appState.banter.praise || 'Menunggu data...');
  }
  if (roastEl) {
    roastEl.innerHTML = formatMarkdownToHtml(appState.banter.roast || 'Menunggu data...');
  }
}

/**
 * Format markdown bold & em to HTML
 */
function formatMarkdownToHtml(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

/**
 * Render Leaderboard Table
 */
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;

  if (appState.leaderboard.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--text-muted);">Belum ada player terdaftar. Klik "Tambah Player" di atas.</td></tr>`;
    return;
  }

  let html = '';
  appState.leaderboard.forEach((player, index) => {
    const today = player.today || {};
    const yest = player.yesterday || {};
    
    // Rank medal
    let rankBadge = `<span class="rank-cell">${index + 1}</span>`;
    if (index === 0) rankBadge = `<span class="rank-cell" title="Juara 1">🥇</span>`;
    else if (index === 1) rankBadge = `<span class="rank-cell" title="Juara 2">🥈</span>`;
    else if (index === 2) rankBadge = `<span class="rank-cell" title="Juara 3">🥉</span>`;

    // Trend calculation
    const winDiff = (today.wins || 0) - (yest.wins || 0);
    let trendHtml = '<span class="trend-same"><i class="fa-solid fa-minus"></i> 0</span>';
    if (winDiff > 0) {
      trendHtml = `<span class="trend-up"><i class="fa-solid fa-caret-up"></i> +${winDiff} 🍗</span>`;
    } else if (winDiff < 0) {
      trendHtml = `<span class="trend-down"><i class="fa-solid fa-caret-down"></i> ${winDiff} 🍗</span>`;
    }

    const avatarUrl = player.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.name)}`;
    const steamUrl = player.steamUrl || `https://steamcommunity.com/id/${encodeURIComponent(player.name.replace(/\s+/g, ''))}`;
    const trackerUrl = player.trackerUrl || `https://tracker.gg/pubg/profile/steam/${encodeURIComponent(player.name)}/overview`;

    html += `
      <tr>
        <td>${rankBadge}</td>
        <td>
          <div class="player-info-cell">
            <a href="${steamUrl}" target="_blank" rel="noopener noreferrer" class="player-avatar-link" title="Buka Profil Steam ${escapeHtml(player.name)} ↗">
              <img src="${avatarUrl}" alt="${player.name}" class="player-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.name)}'">
              <span class="steam-icon-tag"><i class="fa-brands fa-steam"></i></span>
            </a>
            <div class="player-name-wrap">
              <a href="${steamUrl}" target="_blank" rel="noopener noreferrer" class="player-name-link" title="Buka Profil Steam ${escapeHtml(player.name)} ↗">
                <span class="player-name">${escapeHtml(player.name)}</span>
                <i class="fa-solid fa-arrow-up-right-from-square ext-icon"></i>
              </a>
              <div class="player-sub-links">
                <a href="${steamUrl}" target="_blank" rel="noopener noreferrer" class="player-platform-link" title="Buka Steam">
                  <i class="fa-brands fa-steam text-cyan"></i> Steam
                </a>
                <span class="dot-sep">•</span>
                <a href="${trackerUrl}" target="_blank" rel="noopener noreferrer" class="player-tracker-link" title="Buka Tracker.gg Overview">
                  <i class="fa-solid fa-bullseye text-amber"></i> Tracker.gg
                </a>
              </div>
            </div>
          </div>
        </td>
        <td><span class="score-badge badge-win">🍗 ${today.wins || 0}</span></td>
        <td><span class="score-badge badge-lose">❌ ${today.losses || 0}</span></td>
        <td><strong class="gold-text">${today.kd || 0}</strong></td>
        <td>${today.kills || 0}</td>
        <td>${today.damage || 0}</td>
        <td>${trendHtml}</td>
        <td>
          <div class="table-action-btns">
            <a href="${trackerUrl}" target="_blank" rel="noopener noreferrer" class="btn-mini btn-tracker-mini" title="Buka Tracker.gg ${escapeHtml(player.name)} ↗">
              <i class="fa-solid fa-bullseye"></i>
            </a>
            <a href="${steamUrl}" target="_blank" rel="noopener noreferrer" class="btn-mini btn-steam-mini" title="Buka Profil Steam ${escapeHtml(player.name)} ↗">
              <i class="fa-brands fa-steam"></i>
            </a>
            <button class="btn-mini" onclick="openEditStatsModal('${escapeHtml(player.name)}')" title="Edit Stats & URL Tracker">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-mini delete-btn" onclick="deletePlayer('${escapeHtml(player.name)}')" title="Hapus Player">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/**
 * Render Player Tactical Cards
 */
function renderPlayerCards() {
  const container = document.getElementById('players-cards-grid');
  if (!container) return;

  if (appState.players.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-muted);">Tidak ada player.</div>`;
    return;
  }

  let html = '';
  appState.players.forEach(player => {
    const today = player.today || {};
    const matches = today.matches || 0;
    const wins = today.wins || 0;
    const losses = today.losses || 0;
    const winRate = today.winRate || (matches > 0 ? ((wins / matches) * 100).toFixed(1) : 0);

    const isMVP = appState.banter.bestPlayer?.name === player.name && wins > 0;
    const isLoser = appState.banter.worstPlayer?.name === player.name && wins === 0;

    let roleTag = '<span class="card-role-tag role-neutral">SQUAD MEMBER</span>';
    let cardClass = 'player-tactical-card';

    if (isMVP) {
      roleTag = '<span class="card-role-tag role-mvp">👑 SULTAN AYAM (MVP)</span>';
      cardClass += ' is-first';
    } else if (isLoser) {
      roleTag = '<span class="card-role-tag role-loser">💀 BEBAN SQUAD (0 AYAM)</span>';
      cardClass += ' is-loser';
    }

    const avatarUrl = player.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.name)}`;
    const steamUrl = player.steamUrl || `https://steamcommunity.com/id/${encodeURIComponent(player.name.replace(/\s+/g, ''))}`;
    const trackerUrl = player.trackerUrl || `https://tracker.gg/pubg/profile/steam/${encodeURIComponent(player.name)}/overview`;

    // Recent match chips
    const recentMatches = Array.isArray(today.recentMatches) ? today.recentMatches : [];
    let matchChipsHtml = '';
    recentMatches.slice(0, 5).forEach((m, idx) => {
      const chipClass = m.win ? 'chip-win' : 'chip-lose';
      const icon = m.win ? '🍗 #1' : `#${m.place}`;
      matchChipsHtml += `
        <span class="match-chip ${chipClass}" title="Match ${m.mode || 'Squad'}: ${m.kills} Kills, ${m.damage} Dmg">
          ${icon} (${m.kills}K)
        </span>
      `;
    });

    html += `
      <div class="${cardClass}">
        <div class="card-top">
          <div class="card-user">
            <a href="${steamUrl}" target="_blank" rel="noopener noreferrer" class="card-avatar-link" title="Buka Profil Steam ${escapeHtml(player.name)} ↗">
              <img src="${avatarUrl}" alt="${player.name}" class="card-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.name)}'">
              <span class="card-steam-badge"><i class="fa-brands fa-steam"></i></span>
            </a>
            <div class="card-title">
              <a href="${steamUrl}" target="_blank" rel="noopener noreferrer" class="card-name-link" title="Buka Profil Steam ${escapeHtml(player.name)} ↗">
                <h3>${escapeHtml(player.name)}</h3>
                <i class="fa-solid fa-arrow-up-right-from-square ext-icon"></i>
              </a>
              ${roleTag}
              <div class="card-tracker-indicator">
                <i class="fa-solid fa-bullseye text-amber"></i> Sumber: <a href="${trackerUrl}" target="_blank" rel="noopener noreferrer" class="tracker-source-url">${escapeHtml(trackerUrl)}</a>
              </div>
            </div>
          </div>
          <div class="card-action-group">
            <a href="${trackerUrl}" target="_blank" rel="noopener noreferrer" class="btn-mini btn-tracker" title="Buka Tracker.gg ${escapeHtml(player.name)} di tab baru">
              <i class="fa-solid fa-bullseye"></i> TRACKER.GG ↗
            </a>
            <a href="${steamUrl}" target="_blank" rel="noopener noreferrer" class="btn-mini btn-steam" title="Buka Profil Steam ${escapeHtml(player.name)} di tab baru">
              <i class="fa-brands fa-steam"></i> STEAM ↗
            </a>
            <button class="btn-mini" onclick="openEditStatsModal('${escapeHtml(player.name)}')" title="Edit Stats & URL Tracker">
              <i class="fa-solid fa-sliders"></i> Edit
            </button>
          </div>
        </div>

        <div class="card-scores-row">
          <div class="score-col">
            <span>CHICKEN DINNER</span>
            <span class="gold-text">${wins}</span>
          </div>
          <div class="score-col">
            <span>LOSSES</span>
            <span class="red-text">${losses}</span>
          </div>
          <div class="score-col">
            <span>K/D RATIO</span>
            <span class="cyan-text">${today.kd || 0}</span>
          </div>
          <div class="score-col">
            <span>TOTAL DAMAGE</span>
            <span class="purple-text">${today.damage || 0}</span>
          </div>
        </div>

        <div class="winrate-meter">
          <div class="meter-header">
            <span>WIN RATE: ${winRate}%</span>
            <span>TOTAL: ${matches} MATCHES</span>
          </div>
          <div class="meter-bar">
            <div class="meter-fill-win" style="width: ${Math.min(winRate, 100)}%;"></div>
          </div>
        </div>

        ${matchChipsHtml ? `
          <div style="margin-top: 12px;">
            <div style="font-family: var(--font-tech); font-size: 10px; color: var(--text-muted); margin-bottom: 6px; letter-spacing: 0.8px;">MATCH TERAKHIR HARI INI:</div>
            <div class="recent-matches-wrap">${matchChipsHtml}</div>
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Setup UI Event Listeners
 */
function setupEventListeners() {
  // Refresh button
  const refreshBtn = document.getElementById('btn-refresh-stats');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefreshClick);
  }

  // Toggle PUBG Bot & Scraper service button
  const pubgToggleBtn = document.getElementById('btn-toggle-pubg-service');
  const pubgToggleText = document.getElementById('pubg-service-toggle-text');
  if (pubgToggleBtn && pubgToggleText) {
    pubgToggleBtn.addEventListener('click', async () => {
      SoundFX.playClick();
      const isCurrentlyActive = pubgToggleText.textContent.includes('STOP');
      const action = isCurrentlyActive ? 'stop' : 'start';
      showToast(`Mengirim perintah ${action} untuk Bot PUBG...`, 'info');

      try {
        const res = await fetch(`/api/service/pubg-bot/${action}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          SoundFX.playChicken();
          showToast(data.message, 'success');
          if (action === 'stop') {
            pubgToggleText.textContent = 'START BOT';
            pubgToggleBtn.className = 'btn-tactical btn-start-success';
          } else {
            pubgToggleText.textContent = 'STOP BOT (HEMAT RAM)';
            pubgToggleBtn.className = 'btn-tactical btn-danger-soft';
          }
          loadConfig();
        } else {
          showToast(data.message || 'Gagal mengubah status bot', 'error');
        }
      } catch (e) {
        showToast('Koneksi terputus', 'error');
      }
    });
  }

  // Add player modal open
  const addPlayerBtn = document.getElementById('btn-add-player');
  if (addPlayerBtn) {
    addPlayerBtn.addEventListener('click', () => {
      SoundFX.playClick();
      openModal('modal-add-player');
    });
  }

  // Quick Paste Tracker.gg modal open
  const pasteTrackerBtn = document.getElementById('btn-open-paste-tracker');
  if (pasteTrackerBtn) {
    pasteTrackerBtn.addEventListener('click', () => {
      SoundFX.playClick();
      openPasteTrackerModal();
    });
  }

  // Parse button in Edit Stats Modal
  const btnParseEditPaste = document.getElementById('btn-parse-edit-paste');
  if (btnParseEditPaste) {
    btnParseEditPaste.addEventListener('click', handleParseEditPaste);
  }

  // Live input preview on paste textarea
  const pasteRawTextarea = document.getElementById('paste-tracker-raw');
  if (pasteRawTextarea) {
    pasteRawTextarea.addEventListener('input', handlePasteLivePreview);
  }

  // Quick Paste Tracker Form Submit
  const formPasteTracker = document.getElementById('form-paste-tracker');
  if (formPasteTracker) {
    formPasteTracker.addEventListener('submit', handlePasteTrackerSubmit);
  }

  // Settings modal open
  const settingsBtn = document.getElementById('btn-open-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      SoundFX.playClick();
      openModal('modal-settings');
    });
  }

  // Guide modal open
  const guideBtn = document.getElementById('btn-open-guide');
  if (guideBtn) {
    guideBtn.addEventListener('click', () => {
      SoundFX.playClick();
      openModal('modal-guide');
    });
  }

  // Close modals
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      closeModal(targetId);
    });
  });

  // Close modal when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
      }
    });
  });

  // Add Player Form Submit
  const formAddPlayer = document.getElementById('form-add-player');
  if (formAddPlayer) {
    formAddPlayer.addEventListener('submit', handleAddPlayerSubmit);
  }

  // Edit Stats Form Submit
  const formEditStats = document.getElementById('form-edit-stats');
  if (formEditStats) {
    formEditStats.addEventListener('submit', handleEditStatsSubmit);
  }

  // Settings Form Submit
  const formSettings = document.getElementById('form-settings');
  if (formSettings) {
    formSettings.addEventListener('submit', handleSettingsSubmit);
  }

  // Test Discord Button
  const testDiscordBtn = document.getElementById('btn-test-discord');
  if (testDiscordBtn) {
    testDiscordBtn.addEventListener('click', handleTestDiscord);
  }

  // Reroll Banter Button
  const rerollBtn = document.getElementById('btn-reroll-banter');
  if (rerollBtn) {
    rerollBtn.addEventListener('click', () => {
      SoundFX.playClick();
      loadData();
      showToast('Kata-kata pujian & ejekan diacak kembali!', 'success');
    });
  }

  // Toggle Discord Token visibility
  const toggleTokenBtn = document.getElementById('btn-toggle-token');
  if (toggleTokenBtn) {
    toggleTokenBtn.addEventListener('click', () => {
      const input = document.getElementById('input-discord-token');
      if (input.type === 'password') {
        input.type = 'text';
        toggleTokenBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
      } else {
        input.type = 'password';
        toggleTokenBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      }
    });
  }

  // Guide Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SoundFX.playClick();
      const targetTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = document.getElementById(targetTab);
      if (pane) pane.classList.add('active');
    });
  });
}

/**
 * Handle Refresh Stats click
 */
async function handleRefreshClick() {
  if (appState.isRefreshing) return;
  appState.isRefreshing = true;
  SoundFX.playClick();

  const icon = document.getElementById('refresh-icon');
  if (icon) icon.classList.add('spin-fast');

  showToast('Memperbarui data PUBG Steam dari scraper...', 'info');

  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      SoundFX.playChicken();
      showToast('Statistik PUBG Steam berhasil di-refresh!', 'success');
      await loadData();
    } else {
      showToast(data.error || 'Gagal merefresh statistik', 'error');
    }
  } catch (err) {
    showToast('Koneksi terputus saat refresh', 'error');
  } finally {
    appState.isRefreshing = false;
    if (icon) icon.classList.remove('spin-fast');
  }
}

/**
 * Handle Add Player
 */
async function handleAddPlayerSubmit(e) {
  e.preventDefault();
  SoundFX.playClick();

  const nameInput = document.getElementById('input-player-name');
  const steamInput = document.getElementById('input-steam-id');
  const trackerInput = document.getElementById('input-tracker-url');
  const platformSelect = document.getElementById('select-platform');
  
  const name = nameInput.value.trim();
  const steamId = steamInput ? steamInput.value.trim() : '';
  const trackerUrl = trackerInput ? trackerInput.value.trim() : '';
  const platform = platformSelect.value;

  if (!name && !steamId && !trackerUrl) {
    showToast('Masukkan Nickname PUBG, Steam ID, atau URL Tracker.gg!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, platform, steamId, steamUrl: steamId, trackerUrl })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Player ${data.player?.name || name} berhasil ditambahkan!`, 'success');
      nameInput.value = '';
      if (steamInput) steamInput.value = '';
      if (trackerInput) trackerInput.value = '';
      closeModal('modal-add-player');
      loadData();
    } else {
      showToast(data.message || 'Gagal menambahkan player', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan sistem', 'error');
  }
}

/**
 * Open Edit Stats Modal
 */
window.openEditStatsModal = function(playerName) {
  SoundFX.playClick();
  const player = appState.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (!player) return;

  document.getElementById('edit-player-id').value = player.name;
  document.getElementById('edit-player-name').textContent = player.name;
  
  const trackerUrl = player.trackerUrl || `https://tracker.gg/pubg/profile/steam/${encodeURIComponent(player.name)}/overview`;
  const trackerInput = document.getElementById('edit-tracker-url');
  const trackerLink = document.getElementById('link-open-tracker');

  if (trackerInput) trackerInput.value = trackerUrl;
  if (trackerLink) trackerLink.href = trackerUrl;

  const steamUrlInput = document.getElementById('edit-steam-url');
  if (steamUrlInput) {
    steamUrlInput.value = player.steamUrl || player.steamId || '';
  }

  document.getElementById('edit-wins').value = player.today?.wins || 0;
  document.getElementById('edit-losses').value = player.today?.losses || 0;
  document.getElementById('edit-kills').value = player.today?.kills || 0;
  document.getElementById('edit-damage').value = player.today?.damage || 0;

  openModal('modal-edit-stats');
};

/**
 * Handle Edit Stats Submit
 */
async function handleEditStatsSubmit(e) {
  e.preventDefault();
  SoundFX.playClick();

  const playerName = document.getElementById('edit-player-id').value;
  const trackerUrlInput = document.getElementById('edit-tracker-url');
  const steamUrlInput = document.getElementById('edit-steam-url');
  
  const trackerUrl = trackerUrlInput ? trackerUrlInput.value.trim() : '';
  const steamUrlRaw = steamUrlInput ? steamUrlInput.value.trim() : '';

  const wins = parseInt(document.getElementById('edit-wins').value, 10);
  const losses = parseInt(document.getElementById('edit-losses').value, 10);
  const kills = parseInt(document.getElementById('edit-kills').value, 10);
  const damage = parseInt(document.getElementById('edit-damage').value, 10);

  const matches = wins + losses;
  const kd = losses > 0 ? parseFloat((kills / losses).toFixed(2)) : kills;
  const winRate = matches > 0 ? parseFloat(((wins / matches) * 100).toFixed(1)) : 0;

  const updateBody = {
    today: { wins, losses, matches, kills, damage, kd, winRate }
  };

  if (trackerUrl) {
    updateBody.trackerUrl = trackerUrl;
  }

  if (steamUrlRaw) {
    updateBody.steamId = steamUrlRaw;
    updateBody.steamUrl = steamUrlRaw.startsWith('http') ? steamUrlRaw : (
      /^\d{17}$/.test(steamUrlRaw) 
        ? `https://steamcommunity.com/profiles/${steamUrlRaw}` 
        : `https://steamcommunity.com/id/${encodeURIComponent(steamUrlRaw)}`
    );
  }

  try {
    const res = await fetch(`/api/players/${encodeURIComponent(playerName)}/stats`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody)
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Stats & tracker URL untuk ${playerName} diperbarui!`, 'success');
      closeModal('modal-edit-stats');
      loadData();
    } else {
      showToast(data.message || 'Gagal mengupdate stats', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan sistem', 'error');
  }
}

/**
 * Delete player
 */
window.deletePlayer = async function(playerName) {
  SoundFX.playClick();
  if (!confirm(`Yakin ingin menghapus player "${playerName}" dari daftar pantauan?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/players/${encodeURIComponent(playerName)}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Player ${playerName} dihapus`, 'info');
      loadData();
    } else {
      showToast(data.message || 'Gagal menghapus player', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat menghapus', 'error');
  }
};

/**
 * Handle Settings Form Submit
 */
async function handleSettingsSubmit(e) {
  e.preventDefault();
  SoundFX.playClick();

  const discordToken = document.getElementById('input-discord-token').value.trim();
  const discordChannelId = document.getElementById('input-channel-id').value.trim();
  const cronSchedule = document.getElementById('input-cron').value.trim();
  const pubgApiKey = document.getElementById('input-pubg-key').value.trim();

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordToken, discordChannelId, cronSchedule, pubgApiKey })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Pengaturan bot berhasil disimpan!', 'success');
      closeModal('modal-settings');
      loadConfig();
      loadData();
    } else {
      showToast(data.message || 'Gagal menyimpan pengaturan', 'error');
    }
  } catch (err) {
    showToast('Koneksi terputus saat menyimpan pengaturan', 'error');
  }
}

/**
 * Handle Test Discord Report Send
 */
async function handleTestDiscord() {
  SoundFX.playClick();
  showToast('Mengirim laporan uji coba ke Discord...', 'info');

  try {
    const res = await fetch('/api/discord/test', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      SoundFX.playChicken();
      showToast('Laporan skor & ejekan berhasil terkirim ke Discord! Cek channel grup kamu!', 'success');
    } else {
      showToast(data.message || 'Gagal mengirim ke Discord. Cek Token & Channel ID!', 'error');
    }
  } catch (err) {
    showToast('Gagal menghubungi Discord bot API', 'error');
  }
}

/**
 * Modal open / close helpers
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

/**
 * Toast Notification System
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;

  let icon = '<i class="fa-solid fa-circle-info text-amber"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check text-green"></i>';
  if (type === 'error') icon = '<i class="fa-solid fa-triangle-exclamation text-red"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Client-side Tracker.gg Text Parser
 */
function parseClientTrackerText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const clean = rawText.replace(/\r\n/g, '\n');

  let matches = 0, wins = 0, top5 = 0, kills = 0, assists = 0, damage = 0;

  const todayBlockMatch = clean.match(/Today\s*\n\s*(\d+)\s*\n\s*(\d+)\s*W(?:\s*\n\s*(\d+)\s*Top\s*5)?/i);
  if (todayBlockMatch) {
    matches = parseInt(todayBlockMatch[1], 10) || 0;
    wins = parseInt(todayBlockMatch[2], 10) || 0;
    top5 = parseInt(todayBlockMatch[3] || 0, 10);
  } else {
    const looseMatches = clean.match(/Today[\s\S]*?(\d+)\s*(?:Matches|Games)?\s*\n\s*(\d+)\s*W/i);
    if (looseMatches) {
      matches = parseInt(looseMatches[1], 10) || 0;
      wins = parseInt(looseMatches[2], 10) || 0;
    }
  }

  const killsMatch = clean.match(/Kills\s*\n\s*(\d+)/i);
  if (killsMatch) kills = parseInt(killsMatch[1], 10) || 0;

  const assistsMatch = clean.match(/Assists\s*\n\s*(\d+)/i);
  if (assistsMatch) assists = parseInt(assistsMatch[1], 10) || 0;

  const damageMatch = clean.match(/Damage\s*\n\s*([\d,]+)/i);
  if (damageMatch) damage = parseInt(damageMatch[1].replace(/,/g, ''), 10) || 0;

  const matchRegex = /(\d+)(?:st|nd|rd|th)\s*\n\s*([^\n]+(?:ago|yesterday|today|[0-9:]+))\s*\n\s*([^\n]+)\s*\n\s*(?:Lobby\s*K\/D\s*\n\s*[\d.]+\s*\n\s*)?Kills\s*\n\s*(\d+)\s*\n\s*Assists\s*\n\s*(\d+)\s*\n\s*Damage\s*\n\s*([\d,]+)/gi;
  const recentMatches = [];
  let mMatch;
  while ((mMatch = matchRegex.exec(clean)) !== null) {
    const place = parseInt(mMatch[1], 10);
    const time = mMatch[2].trim();
    const mode = mMatch[3].trim().replace(/\s+/g, '-');
    const mKills = parseInt(mMatch[4], 10) || 0;
    const mDamage = parseInt(mMatch[6].replace(/,/g, ''), 10) || 0;
    recentMatches.push({ place, mode, kills: mKills, damage: mDamage, time, win: place === 1 });
  }

  if (matches === 0 && recentMatches.length > 0) {
    matches = recentMatches.length;
    wins = recentMatches.filter(m => m.win).length;
    kills = recentMatches.reduce((s, m) => s + m.kills, 0);
    damage = recentMatches.reduce((s, m) => s + m.damage, 0);
  }

  const losses = Math.max(0, matches - wins);
  const kd = losses > 0 ? parseFloat((kills / losses).toFixed(2)) : kills;
  const winRate = matches > 0 ? parseFloat(((wins / matches) * 100).toFixed(1)) : 0;

  return { matches, wins, losses, kills, damage, kd, winRate, top5, assists, recentMatches };
}

/**
 * Open Quick Paste Tracker Modal
 */
function openPasteTrackerModal(preselectedPlayer = '') {
  const select = document.getElementById('select-paste-player');
  const linkExt = document.getElementById('link-direct-tracker');
  const previewBox = document.getElementById('paste-preview-box');
  const textarea = document.getElementById('paste-tracker-raw');

  if (textarea) textarea.value = '';
  if (previewBox) previewBox.style.display = 'none';

  if (select) {
    select.innerHTML = '';
    appState.players.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = `${p.name} (Steam: ${p.steamId || p.name})`;
      if (preselectedPlayer && p.name.toLowerCase() === preselectedPlayer.toLowerCase()) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    const updateLink = () => {
      const selected = appState.players.find(p => p.name === select.value);
      if (selected && linkExt) {
        linkExt.href = selected.trackerUrl || `https://tracker.gg/pubg/profile/steam/${encodeURIComponent(selected.name)}/overview`;
      }
    };
    select.onchange = updateLink;
    updateLink();
  }

  openModal('modal-paste-tracker');
}

/**
 * Live preview when typing/pasting into textarea
 */
function handlePasteLivePreview(e) {
  const text = e.target.value;
  const previewBox = document.getElementById('paste-preview-box');
  if (!previewBox) return;

  const parsed = parseClientTrackerText(text);
  if (parsed && (parsed.matches > 0 || parsed.kills > 0 || parsed.damage > 0)) {
    document.getElementById('prev-matches').textContent = parsed.matches;
    document.getElementById('prev-wins').textContent = parsed.wins + ' 🍗';
    document.getElementById('prev-losses').textContent = parsed.losses;
    document.getElementById('prev-kills').textContent = parsed.kills;
    document.getElementById('prev-damage').textContent = parsed.damage;
    document.getElementById('prev-kd').textContent = parsed.kd;
    previewBox.style.display = 'block';
  } else {
    previewBox.style.display = 'none';
  }
}

/**
 * Handle Parse Button inside Edit Stats Modal
 */
function handleParseEditPaste() {
  const textarea = document.getElementById('edit-tracker-paste-area');
  if (!textarea || !textarea.value.trim()) {
    showToast('Silakan tempel (paste) teks dari Tracker.gg terlebih dahulu!', 'error');
    return;
  }

  const parsed = parseClientTrackerText(textarea.value);
  if (!parsed || (parsed.matches === 0 && parsed.kills === 0 && parsed.damage === 0)) {
    showToast('Format teks Tracker.gg tidak dikenali. Pastikan menyalin bagian Match History!', 'error');
    return;
  }

  document.getElementById('edit-wins').value = parsed.wins;
  document.getElementById('edit-losses').value = parsed.losses;
  document.getElementById('edit-kills').value = parsed.kills;
  document.getElementById('edit-damage').value = parsed.damage;

  SoundFX.playChicken();
  showToast(`✅ Data Tracker.gg terdeteksi! Matches: ${parsed.matches}, Wins: ${parsed.wins}, Kills: ${parsed.kills}, Dmg: ${parsed.damage}`, 'success');
}

/**
 * Handle Paste Tracker Submit (saves to backend)
 */
async function handlePasteTrackerSubmit(e) {
  e.preventDefault();
  SoundFX.playClick();

  const select = document.getElementById('select-paste-player');
  const textarea = document.getElementById('paste-tracker-raw');
  const playerName = select.value;
  const rawText = textarea.value.trim();

  if (!playerName || !rawText) {
    showToast('Pilih player dan tempel teks dari Tracker.gg!', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/players/${encodeURIComponent(playerName)}/sync-tracker-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText })
    });
    const data = await res.json();

    if (data.success) {
      SoundFX.playChicken();
      showToast(data.message, 'success');
      closeModal('modal-paste-tracker');
      await loadData();
    } else {
      showToast(data.message || 'Gagal menyinkronkan data Tracker.gg', 'error');
    }
  } catch (err) {
    showToast('Koneksi terputus saat sinkronisasi', 'error');
  }
}

/**
 * Safe HTML escape
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ========================================================
// HERMES AI ASSISTANT HUB CONTROLLER
// ========================================================

const HermesHub = {
  config: null,
  status: null,

  init() {
    this.setupListeners();
    this.checkStatusPeriodically();
  },

  setupListeners() {
    // Open Hermes Hub button
    const openBtn = document.getElementById('btn-open-hermes');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        SoundFX.playClick();
        openModal('modal-hermes');
        this.loadConfigAndStatus();
        if (window.TokenAnalyticsController) {
          window.TokenAnalyticsController.fetchAndRender();
        }
      });
    }

    // Modal Tabs
    document.querySelectorAll('[data-hermestab]').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundFX.playClick();
        const targetId = btn.getAttribute('data-hermestab');
        document.querySelectorAll('[data-hermestab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.hermes-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');

        if (targetId === 'htab-tokens' && window.TokenAnalyticsController) {
          window.TokenAnalyticsController.fetchAndRender();
        }
      });
    });

    // Toggle API Key eye button
    const toggleKeyBtn = document.getElementById('btn-toggle-hermes-key');
    if (toggleKeyBtn) {
      toggleKeyBtn.addEventListener('click', () => {
        const input = document.getElementById('hermes-api-key');
        if (input.type === 'password') {
          input.type = 'text';
          toggleKeyBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
          input.type = 'password';
          toggleKeyBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
      });
    }

    // Model select change (show/hide custom)
    const modelSelect = document.getElementById('hermes-model-select');
    const customGroup = document.getElementById('custom-model-group');
    if (modelSelect && customGroup) {
      modelSelect.addEventListener('change', () => {
        if (modelSelect.value === 'custom') {
          customGroup.style.display = 'block';
        } else {
          customGroup.style.display = 'none';
        }
        this.updateActiveModelLabel();
      });
    }

    // Max tokens slider
    const tokenSlider = document.getElementById('hermes-max-tokens-slider');
    const tokenDisplay = document.getElementById('token-val-display');
    if (tokenSlider && tokenDisplay) {
      tokenSlider.addEventListener('input', () => {
        tokenDisplay.textContent = `${tokenSlider.value} tokens`;
      });
    }

    // Temperature slider
    const tempSlider = document.getElementById('hermes-temp-slider');
    const tempDisplay = document.getElementById('temp-val-display');
    if (tempSlider && tempDisplay) {
      tempSlider.addEventListener('input', () => {
        tempDisplay.textContent = tempSlider.value;
      });
    }

    // Telegram toggle switch
    const tgSwitch = document.getElementById('hermes-tg-enabled');
    const tgLabel = document.getElementById('hermes-tg-toggle-label');
    if (tgSwitch && tgLabel) {
      tgSwitch.addEventListener('change', () => {
        tgLabel.textContent = tgSwitch.checked ? 'Aktif' : 'Nonaktif';
        tgLabel.style.color = tgSwitch.checked ? '#4ade80' : 'var(--text-muted)';
      });
    }

    // Discord toggle switch
    const dcSwitch = document.getElementById('hermes-dc-enabled');
    const dcLabel = document.getElementById('hermes-dc-toggle-label');
    if (dcSwitch && dcLabel) {
      dcSwitch.addEventListener('change', () => {
        dcLabel.textContent = dcSwitch.checked ? 'Aktif' : 'Nonaktif';
        dcLabel.style.color = dcSwitch.checked ? '#4ade80' : 'var(--text-muted)';
      });
    }

    // Save configuration button
    const saveBtn = document.getElementById('btn-save-hermes-config');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveConfiguration());
    }

    // Send Live Chat button
    const sendBtn = document.getElementById('btn-send-hermes-chat');
    const chatInput = document.getElementById('hermes-chat-input');
    if (sendBtn && chatInput) {
      sendBtn.addEventListener('click', () => this.sendChatMessage());
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.sendChatMessage();
        }
      });
    }

    // Reset Chat Memory button
    const resetMemBtn = document.getElementById('btn-reset-chat-mem');
    if (resetMemBtn) {
      resetMemBtn.addEventListener('click', () => this.resetChatMemory());
    }
  },

  updateActiveModelLabel() {
    const modelSelect = document.getElementById('hermes-model-select');
    const customInput = document.getElementById('hermes-custom-model');
    const label = document.getElementById('chat-active-model-display');
    if (!label) return;

    let selected = modelSelect.value;
    if (selected === 'custom' && customInput?.value.trim()) {
      selected = customInput.value.trim();
    }
    label.textContent = `Model: ${selected}`;
  },

  async loadConfigAndStatus() {
    try {
      const [configRes, statusRes] = await Promise.all([
        fetch('/api/hermes/config').then(r => r.json()).catch(() => null),
        fetch('/api/hermes/status').then(r => r.json()).catch(() => null)
      ]);

      if (configRes && configRes.config) {
        this.config = configRes.config;
        this.populateForm(configRes.config);
      }

      if (statusRes) {
        this.status = statusRes;
        this.updateStatusBadges(statusRes);
      }
    } catch (e) {
      console.warn('[HermesHub] Error loading config/status:', e);
    }
  },

  populateForm(cfg) {
    const or = cfg.openrouter || {};
    const tg = cfg.telegram || {};
    const dc = cfg.discord || {};

    const keyInput = document.getElementById('hermes-api-key');
    if (keyInput && or.apiKeyMasked) {
      keyInput.placeholder = or.apiKeyMasked;
    }

    const modelSelect = document.getElementById('hermes-model-select');
    const customGroup = document.getElementById('custom-model-group');
    const customInput = document.getElementById('hermes-custom-model');

    const knownModels = [
      'nousresearch/hermes-3-llama-3.1-70b',
      'nousresearch/hermes-3-llama-3.1-405b',
      'nousresearch/hermes-2-pro-llama-3-8b',
      'meta-llama/llama-3.3-70b-instruct',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o-mini'
    ];

    if (modelSelect) {
      if (knownModels.includes(or.model)) {
        modelSelect.value = or.model;
        if (customGroup) customGroup.style.display = 'none';
      } else if (or.model) {
        modelSelect.value = 'custom';
        if (customGroup) customGroup.style.display = 'block';
        if (customInput) customInput.value = or.model;
      }
    }

    const tokenSlider = document.getElementById('hermes-max-tokens-slider');
    const tokenDisplay = document.getElementById('token-val-display');
    if (tokenSlider && or.maxTokens) {
      tokenSlider.value = or.maxTokens;
      if (tokenDisplay) tokenDisplay.textContent = `${or.maxTokens} tokens`;
    }

    const tempSlider = document.getElementById('hermes-temp-slider');
    const tempDisplay = document.getElementById('temp-val-display');
    if (tempSlider && or.temperature !== undefined) {
      tempSlider.value = or.temperature;
      if (tempDisplay) tempDisplay.textContent = or.temperature;
    }

    const promptText = document.getElementById('hermes-system-prompt');
    if (promptText && or.systemPrompt) {
      promptText.value = or.systemPrompt;
    }

    // Telegram
    const tgSwitch = document.getElementById('hermes-tg-enabled');
    const tgLabel = document.getElementById('hermes-tg-toggle-label');
    const tgInput = document.getElementById('hermes-tg-token');
    if (tgSwitch) {
      tgSwitch.checked = Boolean(tg.enabled);
      if (tgLabel) {
        tgLabel.textContent = tgSwitch.checked ? 'Aktif' : 'Nonaktif';
        tgLabel.style.color = tgSwitch.checked ? '#4ade80' : 'var(--text-muted)';
      }
    }
    if (tgInput && tg.botTokenMasked) {
      tgInput.placeholder = tg.botTokenMasked;
    }

    // Discord
    const dcSwitch = document.getElementById('hermes-dc-enabled');
    const dcLabel = document.getElementById('hermes-dc-toggle-label');
    const dcInput = document.getElementById('hermes-dc-token');
    if (dcSwitch) {
      dcSwitch.checked = Boolean(dc.enabled);
      if (dcLabel) {
        dcLabel.textContent = dcSwitch.checked ? 'Aktif' : 'Nonaktif';
        dcLabel.style.color = dcSwitch.checked ? '#4ade80' : 'var(--text-muted)';
      }
    }
    if (dcInput && dc.botTokenMasked) {
      dcInput.placeholder = dc.botTokenMasked;
    }

    this.updateActiveModelLabel();
  },

  updateStatusBadges(stat) {
    const orBadge = document.getElementById('badge-or-status');
    const tgBadge = document.getElementById('badge-tg-status');
    const dcBadge = document.getElementById('badge-dc-status');
    const tokenBadge = document.getElementById('badge-total-tokens');

    const tgCardBadge = document.getElementById('tg-card-badge');
    const tgCardDesc = document.getElementById('tg-card-desc');
    const dcCardBadge = document.getElementById('dc-card-badge');
    const dcCardDesc = document.getElementById('dc-card-desc');

    // OpenRouter
    if (orBadge) {
      if (stat.openrouter?.configured) {
        orBadge.className = 'indicator-badge badge-on';
        orBadge.textContent = '🟢 Terhubung';
      } else {
        orBadge.className = 'indicator-badge badge-off';
        orBadge.textContent = '🔴 Belum Diatur';
      }
    }

    // Telegram
    if (tgBadge && stat.telegram) {
      if (stat.telegram.online) {
        tgBadge.className = 'indicator-badge badge-on';
        tgBadge.textContent = `🟢 @${stat.telegram.username || 'Online'}`;
        if (tgCardBadge) {
          tgCardBadge.className = 'indicator-badge badge-on';
          tgCardBadge.textContent = 'ONLINE';
        }
        if (tgCardDesc) {
          tgCardDesc.textContent = `✅ Bot Telegram aktif sebagai @${stat.telegram.username}. Siap menerima pesan!`;
        }
      } else {
        tgBadge.className = 'indicator-badge badge-off';
        tgBadge.textContent = '🔴 Offline';
        if (tgCardBadge) {
          tgCardBadge.className = 'indicator-badge badge-off';
          tgCardBadge.textContent = 'OFFLINE';
        }
        if (tgCardDesc) {
          tgCardDesc.textContent = stat.telegram.lastError || 'Bot Telegram belum aktif atau token belum diisi.';
        }
      }
    }

    // Discord
    if (dcBadge && stat.discord) {
      if (stat.discord.online) {
        dcBadge.className = 'indicator-badge badge-on';
        dcBadge.textContent = `🟢 ${stat.discord.tag || 'Online'}`;
        if (dcCardBadge) {
          dcCardBadge.className = 'indicator-badge badge-on';
          dcCardBadge.textContent = 'ONLINE';
        }
        if (dcCardDesc) {
          dcCardDesc.textContent = `✅ Bot Discord aktif sebagai ${stat.discord.tag} di ${stat.discord.guilds || 0} server. Siap menerima obrolan!`;
        }
      } else {
        dcBadge.className = 'indicator-badge badge-off';
        dcBadge.textContent = '🔴 Offline';
        if (dcCardBadge) {
          dcCardBadge.className = 'indicator-badge badge-off';
          dcCardBadge.textContent = 'OFFLINE';
        }
        if (dcCardDesc) {
          dcCardDesc.textContent = stat.discord.lastError || 'Bot Discord belum aktif atau token belum diisi.';
        }
      }
    }

    // Total tokens
    if (tokenBadge && stat.openrouter?.usage) {
      tokenBadge.textContent = (stat.openrouter.usage.totalTokens || 0).toLocaleString();
    }
  },

  async saveConfiguration() {
    SoundFX.playClick();
    const saveBtn = document.getElementById('btn-save-hermes-config');
    const indicator = document.getElementById('hermes-save-status-indicator');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    }
    if (indicator) {
      indicator.innerHTML = '<span class="text-cyan"><i class="fa-solid fa-spinner fa-spin"></i> Menyimpan ke VPS...</span>';
    }

    // Read form values
    const keyInput = document.getElementById('hermes-api-key').value.trim();
    const modelSelect = document.getElementById('hermes-model-select').value;
    const customModel = document.getElementById('hermes-custom-model')?.value.trim();
    const effectiveModel = modelSelect === 'custom' && customModel ? customModel : modelSelect;

    const maxTokens = parseInt(document.getElementById('hermes-max-tokens-slider').value, 10) || 1000;
    const temperature = parseFloat(document.getElementById('hermes-temp-slider').value) || 0.7;
    const systemPrompt = document.getElementById('hermes-system-prompt').value.trim();

    const tgEnabled = document.getElementById('hermes-tg-enabled').checked;
    const tgToken = document.getElementById('hermes-tg-token').value.trim();

    const dcEnabled = document.getElementById('hermes-dc-enabled').checked;
    const dcToken = document.getElementById('hermes-dc-token').value.trim();

    const payload = {
      openrouter: {
        model: effectiveModel,
        maxTokens,
        temperature,
        systemPrompt
      },
      telegram: {
        enabled: tgEnabled
      },
      discord: {
        enabled: dcEnabled
      }
    };

    // Only send apiKey if user entered new one
    if (keyInput) {
      payload.openrouter.apiKey = keyInput;
    }
    if (tgToken) {
      payload.telegram.botToken = tgToken;
    }
    if (dcToken) {
      payload.discord.botToken = dcToken;
    }

    try {
      const res = await fetch('/api/hermes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        SoundFX.playChicken();
        showToast('Konfigurasi Hermes AI berhasil disimpan & konektor diperbarui!', 'success');
        if (indicator) {
          indicator.innerHTML = '<span class="text-green"><i class="fa-solid fa-check"></i> Tersimpan!</span>';
        }
        await this.loadConfigAndStatus();
      } else {
        showToast(data.message || 'Gagal menyimpan konfigurasi', 'error');
        if (indicator) {
          indicator.innerHTML = `<span class="text-red"><i class="fa-solid fa-xmark"></i> ${data.message}</span>`;
        }
      }
    } catch (err) {
      showToast('Terjadi kesalahan saat menghubungi server', 'error');
      if (indicator) {
        indicator.innerHTML = `<span class="text-red"><i class="fa-solid fa-xmark"></i> Koneksi gagal</span>`;
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>SIMPAN SEMUA PENGATURAN</span>';
      }
      setTimeout(() => {
        if (indicator) indicator.innerHTML = '';
      }, 4000);
    }
  },

  async sendChatMessage() {
    const input = document.getElementById('hermes-chat-input');
    const container = document.getElementById('hermes-chat-messages');
    const sendBtn = document.getElementById('btn-send-hermes-chat');
    const message = input.value.trim();
    if (!message) return;

    SoundFX.playClick();
    input.value = '';

    // Append user bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble bubble-user';
    userBubble.innerHTML = `
      <div class="bubble-sender"><i class="fa-solid fa-user"></i> Anda</div>
      <div class="bubble-text">${escapeHtml(message)}</div>
    `;
    container.appendChild(userBubble);

    // Append typing indicator bubble
    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-bubble bubble-hermes';
    typingBubble.id = 'hermes-typing-bubble';
    typingBubble.innerHTML = `
      <div class="bubble-sender"><i class="fa-solid fa-brain text-violet"></i> Hermes AI</div>
      <div class="bubble-text"><i class="fa-solid fa-ellipsis fa-fade"></i> Sedang berpikir...</div>
    `;
    container.appendChild(typingBubble);
    container.scrollTop = container.scrollHeight;

    if (sendBtn) sendBtn.disabled = true;

    try {
      const res = await fetch('/api/hermes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionKey: 'web_dashboard' })
      });
      const data = await res.json();

      typingBubble.remove();

      const aiBubble = document.createElement('div');
      aiBubble.className = 'chat-bubble bubble-hermes';

      if (data.success) {
        aiBubble.innerHTML = `
          <div class="bubble-sender"><i class="fa-solid fa-brain text-violet"></i> Hermes AI (${data.model || 'Hermes 3'})</div>
          <div class="bubble-text">${formatMarkdownToHtml(data.reply)}</div>
        `;
        container.appendChild(aiBubble);

        // Update token bar
        const tokenBar = document.getElementById('chat-tokens-info');
        const latencyBar = document.getElementById('chat-latency-info');
        if (tokenBar && data.usage) {
          tokenBar.innerHTML = `<i class="fa-solid fa-coins"></i> Token: ${data.usage.promptTokens} prompt + ${data.usage.completionTokens} reply = <strong>${data.usage.totalTokens} total</strong>`;
        }
        if (latencyBar && data.latencyMs) {
          latencyBar.innerHTML = `<i class="fa-solid fa-stopwatch"></i> Latency: ${data.latencyMs} ms`;
        }

        // Refresh usage badges
        this.loadConfigAndStatus();
        if (window.TokenAnalyticsController) {
          window.TokenAnalyticsController.fetchAndRender();
        }
      } else {
        aiBubble.innerHTML = `
          <div class="bubble-sender text-red"><i class="fa-solid fa-triangle-exclamation"></i> Hermes AI Error</div>
          <div class="bubble-text text-red">${escapeHtml(data.error || 'Terjadi kesalahan sistem')}</div>
        `;
        container.appendChild(aiBubble);
      }
    } catch (err) {
      typingBubble.remove();
      const errBubble = document.createElement('div');
      errBubble.className = 'chat-bubble bubble-hermes';
      errBubble.innerHTML = `
        <div class="bubble-sender text-red"><i class="fa-solid fa-triangle-exclamation"></i> Error</div>
        <div class="bubble-text text-red">Koneksi terputus ke Hermes AI Service (${err.message}).</div>
      `;
      container.appendChild(errBubble);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      container.scrollTop = container.scrollHeight;
    }
  },

  async resetChatMemory() {
    SoundFX.playClick();
    try {
      await fetch('/api/hermes/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey: 'web_dashboard' })
      });
      const container = document.getElementById('hermes-chat-messages');
      if (container) {
        container.innerHTML = `
          <div class="chat-bubble bubble-hermes">
            <div class="bubble-sender"><i class="fa-solid fa-brain text-violet"></i> Hermes AI</div>
            <div class="bubble-text">Memori percakapan sesi ini telah di-reset! Silakan mulai percakapan baru.</div>
          </div>
        `;
      }
      showToast('Memori obrolan web telah di-reset.', 'info');
    } catch (e) {
      showToast('Gagal me-reset sesi chat', 'error');
    }
  },

  checkStatusPeriodically() {
    setInterval(() => {
      fetch('/api/hermes/status')
        .then(r => r.json())
        .then(data => {
          if (data && data.success) {
            this.updateStatusBadges(data);
          }
        })
        .catch(() => {});
    }, 15000);
  }
};

// Token Analytics & Quota Visualizer for PUBG Tracker Page
if (!window.TokenAnalyticsController) {
  const TokenAnalyticsController = {
    data: null,
    isFetching: false,

    init() {
      this.setupListeners();
      this.fetchData();
      setInterval(() => {
        const modal = document.getElementById('modal-hermes');
        if (modal && modal.classList.contains('open')) {
          this.fetchData(false);
        }
      }, 12000);
    },

    setupListeners() {
      const refreshBtn = document.getElementById('btn-refresh-token-metrics');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          SoundFX.playClick();
          const icon = document.getElementById('token-refresh-icon');
          if (icon) icon.classList.add('spin-fast');
          this.fetchAndRender(true);
          setTimeout(() => {
            if (icon) icon.classList.remove('spin-fast');
          }, 1000);
        });
      }

      window.addEventListener('resize', () => {
        if (this.data) {
          this.renderCharts(this.data);
        }
      });
    },

    async fetchAndRender(showToastMsg = false) {
      if (showToastMsg) {
        showToast('Memperbarui data kuota token OpenRouter...', 'info');
      }
      const data = await this.fetchData();
      if (data && showToastMsg) {
        showToast('Data kuota token berhasil diperbarui!', 'success');
      }
    },

    async fetchData() {
      if (this.isFetching) return this.data;
      this.isFetching = true;

      try {
        const res = await fetch('/api/hermes/tokens');
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.success) {
          this.data = data;
          this.updateUI(data);
          return data;
        }
      } catch (e) {
        console.warn('[TokenAnalytics] Gagal mengambil data token:', e.message);
      } finally {
        this.isFetching = false;
      }
      return null;
    },

    updateUI(data) {
      const { usage, account, history, model, maxTokensSetting } = data;
      const totalTokens = usage?.totalTokens || 0;
      const promptTokens = usage?.promptTokens || 0;
      const replyTokens = usage?.completionTokens || 0;
      const callsCount = usage?.callsCount || 0;

      const limit = account?.limit ?? 100;
      const limitRemaining = account?.limitRemaining ?? limit;
      const creditPercent = limit > 0 ? Math.max(0, Math.min(100, (limitRemaining / limit) * 100)) : 100;

      const freeLimit = account?.freeDailyRequests?.limit ?? 50;
      const freeRemaining = account?.freeDailyRequests?.remaining ?? 50;
      const freePercent = freeLimit > 0 ? (freeRemaining / freeLimit) * 100 : 100;

      // Header badges
      const badgeTotal = document.getElementById('badge-total-tokens');
      if (badgeTotal) badgeTotal.textContent = totalTokens.toLocaleString();

      const badgeCredit = document.getElementById('badge-remaining-credits');
      if (badgeCredit) {
        badgeCredit.textContent = `$${limitRemaining.toFixed(2)}`;
      }

      // Modal KPI Cards
      const statTotal = document.getElementById('tok-stat-total');
      if (statTotal) statTotal.textContent = totalTokens.toLocaleString();

      const statPrompt = document.getElementById('tok-stat-prompt');
      if (statPrompt) statPrompt.textContent = promptTokens.toLocaleString();

      const statReply = document.getElementById('tok-stat-reply');
      if (statReply) statReply.textContent = replyTokens.toLocaleString();

      const statCalls = document.getElementById('tok-stat-calls');
      if (statCalls) statCalls.textContent = `${callsCount} Panggilan Percakapan`;

      const statCreditRem = document.getElementById('tok-stat-credits-remaining');
      if (statCreditRem) statCreditRem.textContent = `$${limitRemaining.toFixed(2)}`;

      const statCreditTotal = document.getElementById('tok-stat-credits-total');
      if (statCreditTotal) statCreditTotal.textContent = `$${limit.toFixed(2)}`;

      const statCreditPct = document.getElementById('tok-stat-credits-percent');
      if (statCreditPct) statCreditPct.textContent = `${creditPercent.toFixed(1)}%`;

      const fillCredit = document.getElementById('tok-fill-credit');
      if (fillCredit) fillCredit.style.width = `${creditPercent}%`;

      const statFreeReq = document.getElementById('tok-stat-free-req');
      if (statFreeReq) statFreeReq.textContent = `${freeRemaining} / ${freeLimit}`;

      const fillFree = document.getElementById('tok-fill-free');
      if (fillFree) fillFree.style.width = `${freePercent}%`;

      const statMaxSetting = document.getElementById('tok-stat-max-setting');
      if (statMaxSetting) statMaxSetting.textContent = (maxTokensSetting || 1000).toLocaleString();

      const statModel = document.getElementById('tok-stat-model');
      if (statModel) statModel.textContent = (model || 'Hermes 3 70B').replace('nousresearch/', '');

      // Render Canvas Charts & Table
      this.renderCharts(data);
      this.renderHistoryTable(history || []);
    },

    renderCharts(data) {
      const { history, usage } = data;
      this.renderTimelineChart(history || []);
      this.renderDonutChart(usage?.promptTokens || 0, usage?.completionTokens || 0);
    },

    renderTimelineChart(history) {
      const canvas = document.getElementById('canvas-token-timeline');
      if (!canvas) return;

      const parent = canvas.parentElement;
      const w = parent.clientWidth || 400;
      const h = 170;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const paddingLeft = 45;
      const paddingRight = 15;
      const paddingTop = 20;
      const paddingBottom = 25;
      const chartW = w - paddingLeft - paddingRight;
      const chartH = h - paddingTop - paddingBottom;

      if (!history || history.length === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.setLineDash([4, 4]);
        for (let i = 0; i <= 3; i++) {
          const y = paddingTop + (chartH / 3) * i;
          ctx.beginPath();
          ctx.moveTo(paddingLeft, y);
          ctx.lineTo(w - paddingRight, y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Belum ada riwayat obrolan. Kirim pesan di tab Live Chat untuk melihat grafik live!', w / 2, h / 2);
        return;
      }

      const points = history.slice(-20);
      const series = points.length === 1 
        ? [{ time: '', promptTokens: 0, completionTokens: 0, totalTokens: 0 }, points[0]]
        : points;

      let maxVal = Math.max(...series.map(p => Math.max(p.promptTokens || 0, p.completionTokens || 0, p.totalTokens || 0)));
      maxVal = Math.max(maxVal, 100);
      maxVal = Math.ceil(maxVal / 50) * 50;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.setLineDash([3, 3]);

      const gridSteps = 4;
      for (let i = 0; i <= gridSteps; i++) {
        const val = Math.round(maxVal - (maxVal / gridSteps) * i);
        const y = paddingTop + (chartH / gridSteps) * i;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(w - paddingRight, y);
        ctx.stroke();
        ctx.fillText(val.toString(), paddingLeft - 8, y + 3);
      }
      ctx.setLineDash([]);

      const stepX = chartW / (series.length - 1);

      this.drawLineArea(
        ctx,
        series.map(p => p.promptTokens || 0),
        stepX,
        paddingLeft,
        paddingTop,
        chartH,
        maxVal,
        '#00f0ff',
        'rgba(0, 240, 255, 0.2)'
      );

      this.drawLineArea(
        ctx,
        series.map(p => p.completionTokens || 0),
        stepX,
        paddingLeft,
        paddingTop,
        chartH,
        maxVal,
        '#a855f7',
        'rgba(168, 85, 247, 0.25)'
      );

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'center';
      ctx.font = '9px JetBrains Mono, monospace';

      const interval = Math.max(1, Math.floor(series.length / 5));
      series.forEach((p, idx) => {
        if (idx % interval === 0 || idx === series.length - 1) {
          const x = paddingLeft + idx * stepX;
          ctx.fillText(p.time || '', x, h - 6);
        }
      });
    },

    drawLineArea(ctx, values, stepX, paddingLeft, paddingTop, chartH, maxVal, color, fillColor) {
      if (values.length < 2) return;

      ctx.beginPath();
      values.forEach((v, i) => {
        const x = paddingLeft + i * stepX;
        const y = paddingTop + chartH - (v / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.lineTo(paddingLeft + (values.length - 1) * stepX, paddingTop + chartH);
      ctx.lineTo(paddingLeft, paddingTop + chartH);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      values.forEach((v, i) => {
        const x = paddingLeft + i * stepX;
        const y = paddingTop + chartH - (v / maxVal) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0d13';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    },

    renderDonutChart(promptTokens, completionTokens) {
      const canvas = document.getElementById('canvas-token-donut');
      if (!canvas) return;

      const w = 170;
      const h = 170;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const radius = 56;
      const lineWidth = 16;
      const total = promptTokens + completionTokens;

      const pctPromptEl = document.getElementById('donut-pct-prompt');
      const pctReplyEl = document.getElementById('donut-pct-reply');

      if (total === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 20px Bebas Neue, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('0', cx, cy - 6);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '10px Rajdhani, sans-serif';
        ctx.fillText('TOKENS', cx, cy + 12);

        if (pctPromptEl) pctPromptEl.textContent = '0%';
        if (pctReplyEl) pctReplyEl.textContent = '0%';
        return;
      }

      const pRatio = promptTokens / total;
      const rRatio = completionTokens / total;
      const pAngle = pRatio * 2 * Math.PI;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + pAngle);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2 + pAngle, -Math.PI / 2 + Math.PI * 2);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 22px Bebas Neue, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(total.toLocaleString(), cx, cy - 6);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '600 10px Rajdhani, sans-serif';
      ctx.fillText('TOTAL TOKENS', cx, cy + 12);

      if (pctPromptEl) pctPromptEl.textContent = `${(pRatio * 100).toFixed(1)}%`;
      if (pctReplyEl) pctReplyEl.textContent = `${(rRatio * 100).toFixed(1)}%`;
    },

    renderHistoryTable(history) {
      const tbody = document.getElementById('tok-history-tbody');
      if (!tbody) return;

      if (!history || history.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-muted text-center" style="text-align: center; padding: 18px;">Belum ada riwayat percakapan yang tercatat.</td>
          </tr>
        `;
        return;
      }

      const rows = [...history].reverse().slice(0, 10);
      tbody.innerHTML = rows.map(item => `
        <tr>
          <td><code>${item.time || '--:--:--'}</code></td>
          <td><span class="badge-pid">${(item.model || 'hermes-3').replace('nousresearch/', '')}</span></td>
          <td><span style="color: #00f0ff; font-weight: 600;">${(item.promptTokens || 0).toLocaleString()}</span></td>
          <td><span style="color: #c084fc; font-weight: 600;">${(item.completionTokens || 0).toLocaleString()}</span></td>
          <td><strong style="color: #fff;">${(item.totalTokens || 0).toLocaleString()}</strong></td>
          <td><code>${item.latencyMs ? item.latencyMs + ' ms' : '--'}</code></td>
        </tr>
      `).join('');
    }
  };
  window.TokenAnalyticsController = TokenAnalyticsController;
}

