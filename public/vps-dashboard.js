/**
 * HERMES VPS - Real-time Infrastructure & System Metrics Dashboard Controller
 */

// Sound FX Synthesizer
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
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  },
  playBeep() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }
};

// Real-time Canvas Graph Engine
const TimelineChart = {
  canvas: null,
  ctx: null,
  maxPoints: 30,
  cpuData: [],
  ramData: [],

  init() {
    this.canvas = document.getElementById('vps-timeline-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Pre-populate with initial zeros
    for (let i = 0; i < this.maxPoints; i++) {
      this.cpuData.push(5);
      this.ramData.push(29);
    }
    this.draw();
  },

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.draw();
  },

  addDataPoint(cpu, ram) {
    this.cpuData.push(Math.max(0, Math.min(100, cpu)));
    this.ramData.push(Math.max(0, Math.min(100, ram)));
    if (this.cpuData.length > this.maxPoints) this.cpuData.shift();
    if (this.ramData.length > this.maxPoints) this.ramData.shift();
    this.draw();
  },

  draw() {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.ctx.clearRect(0, 0, w, h);

    // 1. Draw Grid Lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    for (let y = 0; y <= h; y += h / 4) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }

    // Grid labels
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.font = '10px JetBrains Mono, monospace';
    this.ctx.fillText('100%', 8, 14);
    this.ctx.fillText('50%', 8, h / 2 + 3);
    this.ctx.fillText('0%', 8, h - 6);

    // 2. Draw RAM Series (Violet)
    this.drawLineSeries(this.ramData, w, h, '#a855f7', 'rgba(168, 85, 247, 0.15)');

    // 3. Draw CPU Series (Cyan)
    this.drawLineSeries(this.cpuData, w, h, '#00f0ff', 'rgba(0, 240, 255, 0.2)');
  },

  drawLineSeries(data, w, h, strokeColor, fillColor) {
    if (data.length < 2) return;
    const stepX = w / (this.maxPoints - 1);

    this.ctx.beginPath();
    data.forEach((val, i) => {
      const x = i * stepX;
      const y = h - (val / 100) * (h - 16) - 8;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    });

    // Stroke
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = strokeColor;
    this.ctx.shadowBlur = 8;
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Fill under curve
    this.ctx.lineTo((data.length - 1) * stepX, h);
    this.ctx.lineTo(0, h);
    this.ctx.closePath();
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();
  }
};

// System Metrics Fetcher & DOM Updater
const MetricsController = {
  isPolling: true,

  init() {
    this.fetchMetrics();
    setInterval(() => {
      if (this.isPolling) this.fetchMetrics();
    }, 2000);
  },

  async fetchMetrics() {
    try {
      const res = await fetch('/api/system/metrics');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        this.updateUI(data);
      }
    } catch (e) {
      console.warn('Gagal memuat metrik sistem:', e.message);
    }
  },

  updateUI(data) {
    const { server, cpu, memory, disk, pm2 } = data;

    // Server Uptime
    const uptimeEl = document.getElementById('uptime-display');
    if (uptimeEl && server.uptimeSeconds) {
      uptimeEl.textContent = `UPTIME: ${this.formatUptime(server.uptimeSeconds)}`;
    }

    // CPU Specs & Load
    const cpuPercentEl = document.getElementById('cpu-percent');
    const cpuFill = document.getElementById('cpu-progress-fill');
    const cpuLoadBadge = document.getElementById('cpu-load-badge');
    const cpuModelText = document.getElementById('cpu-model-text');
    const cpuLoadDetail = document.getElementById('cpu-load-detail');
    const specCores = document.getElementById('spec-cpu-cores');

    if (cpuPercentEl) cpuPercentEl.textContent = `${cpu.usagePercent}%`;
    if (cpuFill) cpuFill.style.width = `${Math.max(4, cpu.usagePercent)}%`;
    if (cpuLoadBadge && cpu.loadAverage) {
      cpuLoadBadge.textContent = `Load: ${cpu.loadAverage['1m']}`;
    }
    if (cpuModelText) cpuModelText.textContent = `${cpu.model} (${cpu.cores} Cores)`;
    if (cpuLoadDetail && cpu.loadAverage) {
      cpuLoadDetail.textContent = `1m: ${cpu.loadAverage['1m']} | 5m: ${cpu.loadAverage['5m']} | 15m: ${cpu.loadAverage['15m']}`;
    }
    if (specCores) specCores.textContent = `${cpu.cores} vCPUs`;

    // RAM (Memory)
    const ramPercentEl = document.getElementById('ram-percent');
    const ramFill = document.getElementById('ram-progress-fill');
    const ramUsedBadge = document.getElementById('ram-used-badge');
    const ramFreeText = document.getElementById('ram-free-text');
    const specRamTotal = document.getElementById('spec-ram-total');

    const usedGb = (memory.usedMb / 1024).toFixed(1);
    const totalGb = (memory.totalMb / 1024).toFixed(1);
    const freeGb = (memory.freeMb / 1024).toFixed(1);

    if (ramPercentEl) ramPercentEl.textContent = `${memory.usagePercent}%`;
    if (ramFill) ramFill.style.width = `${Math.max(4, memory.usagePercent)}%`;
    if (ramUsedBadge) ramUsedBadge.textContent = `${usedGb} / ${totalGb} GB`;
    if (ramFreeText) ramFreeText.textContent = `Tersedia: ${freeGb} GB`;
    if (specRamTotal) specRamTotal.textContent = `${totalGb} GB`;

    // Storage (Disk)
    if (disk) {
      const diskPercentEl = document.getElementById('disk-percent');
      const diskFill = document.getElementById('disk-progress-fill');
      const diskUsedBadge = document.getElementById('disk-used-badge');
      const diskFreeText = document.getElementById('disk-free-text');
      const specDiskTotal = document.getElementById('spec-disk-total');

      if (diskPercentEl) diskPercentEl.textContent = `${disk.percent}%`;
      if (diskFill) diskFill.style.width = `${disk.percent}%`;
      if (diskUsedBadge) diskUsedBadge.textContent = `${disk.used} / ${disk.total}`;
      if (diskFreeText) diskFreeText.textContent = `Sisa: ${disk.free} Bebas`;
      if (specDiskTotal) specDiskTotal.textContent = disk.total;
    }

    // PM2 Processes
    const pm2Tbody = document.getElementById('pm2-process-tbody');
    const pm2OnlineNum = document.getElementById('pm2-online-num');
    const pm2CountBadge = document.getElementById('pm2-count-badge');
    const pm2TableSummary = document.getElementById('pm2-table-summary');

    if (Array.isArray(pm2) && pm2.length > 0) {
      const onlineCount = pm2.filter(p => p.status === 'online').length;
      if (pm2OnlineNum) pm2OnlineNum.textContent = `${onlineCount} / ${pm2.length}`;
      if (pm2CountBadge) pm2CountBadge.textContent = `${onlineCount} Online`;
      if (pm2TableSummary) pm2TableSummary.textContent = `${pm2.length} Process Aktif (PM2)`;

      if (pm2Tbody) {
        pm2Tbody.innerHTML = pm2.map(p => {
          const isOnline = p.status === 'online';
          const badgeClass = isOnline ? 'badge-on' : 'badge-off';
          const isPubg = p.name === 'pubg-tracker-bot';

          let actionButtons = '';
          if (isPubg) {
            actionButtons = `
              <div style="display:flex; gap:6px;">
                <a href="/pubg-scrap" class="btn-table-action btn-amber-sm" title="Buka Dashboard PUBG"><i class="fa-solid fa-arrow-up-right-from-square"></i> /pubg-scrap</a>
                <button type="button" class="btn-table-action btn-stop-danger" onclick="ServiceController.sendAction('pubg-bot', 'stop')" title="Matikan bot Discord & scraper otomatis (hemat RAM/CPU)"><i class="fa-solid fa-stop"></i> Stop Bot</button>
              </div>
            `;
          } else if (p.name === 'hermes-ai-bot') {
            if (isOnline) {
              actionButtons = `
                <div style="display:flex; gap:6px;">
                  <button type="button" class="btn-table-action btn-stop-danger" onclick="ServiceController.sendAction('hermes-ai-bot', 'stop')" title="Matikan Hermes via PM2 (hemat ~99MB RAM)"><i class="fa-solid fa-stop"></i> Stop</button>
                  <button type="button" class="btn-table-action btn-violet-sm" onclick="document.getElementById('btn-open-hermes').click()"><i class="fa-solid fa-sliders"></i> Hub</button>
                </div>
              `;
            } else {
              actionButtons = `
                <div style="display:flex; gap:6px;">
                  <button type="button" class="btn-table-action btn-start-success" onclick="ServiceController.sendAction('hermes-ai-bot', 'start')" title="Nyalakan Hermes via PM2"><i class="fa-solid fa-play"></i> Start</button>
                  <button type="button" class="btn-table-action btn-violet-sm" onclick="document.getElementById('btn-open-hermes').click()"><i class="fa-solid fa-sliders"></i> Hub</button>
                </div>
              `;
            }
          }

          return `
            <tr>
              <td><code>${p.id}</code></td>
              <td><strong>${p.name}</strong></td>
              <td><span class="badge-pid">${p.pid || '--'}</span></td>
              <td><span class="indicator-badge ${badgeClass}">${(p.status || 'unknown').toUpperCase()}</span></td>
              <td><code>${p.cpu || 0}%</code></td>
              <td><code>${p.memoryMb || 0} MB</code></td>
              <td>${this.formatUptime(p.uptimeSeconds || 0)}</td>
              <td><code>${p.restarts || 0}</code></td>
              <td>${actionButtons}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Add point to canvas timeline chart
    TimelineChart.addDataPoint(cpu.usagePercent, memory.usagePercent);
  },

  formatUptime(seconds) {
    if (!seconds || seconds <= 0) return '0m';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  }
};

// Live Clock for WIB (UTC+7)
function initLiveClock() {
  const clockEl = document.getElementById('clock-time');
  function update() {
    const now = new Date();
    const timeOptions = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    if (clockEl) {
      clockEl.textContent = `${now.toLocaleTimeString('id-ID', timeOptions)} WIB`;
    }
  }
  update();
  setInterval(update, 1000);
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
    // Open Hermes Hub button (header & card)
    const openBtns = [
      document.getElementById('btn-open-hermes'),
      document.getElementById('btn-card-open-hermes')
    ];
    openBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          SoundFX.playClick();
          openModal('modal-hermes');
          this.loadConfigAndStatus();
          if (window.TokenAnalyticsController) {
            window.TokenAnalyticsController.fetchAndRender();
          }
        });
      }
    });

    const openTokensBtn = document.getElementById('btn-card-open-tokens');
    if (openTokensBtn) {
      openTokensBtn.addEventListener('click', () => {
        SoundFX.playClick();
        openModal('modal-hermes');
        const tabBtn = document.getElementById('tab-btn-tokens');
        if (tabBtn) tabBtn.click();
      });
    }

    // Refresh metrics button
    const refreshBtn = document.getElementById('btn-refresh-metrics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        SoundFX.playClick();
        const icon = document.getElementById('refresh-metrics-icon');
        if (icon) icon.classList.add('spin-fast');
        MetricsController.fetchMetrics();
        setTimeout(() => {
          if (icon) icon.classList.remove('spin-fast');
        }, 800);
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

    // Close Modals
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-close');
        closeModal(targetId);
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
    const cardModel = document.getElementById('card-hermes-model');
    if (!label) return;

    let selected = modelSelect.value;
    if (selected === 'custom' && customInput?.value.trim()) {
      selected = customInput.value.trim();
    }
    label.textContent = `Model: ${selected}`;
    if (cardModel) cardModel.textContent = selected.replace('nousresearch/', '');
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
    const cardTokens = document.getElementById('card-hermes-tokens');

    if (tokenSlider && or.maxTokens) {
      tokenSlider.value = or.maxTokens;
      if (tokenDisplay) tokenDisplay.textContent = `${or.maxTokens} tokens`;
      if (cardTokens) cardTokens.textContent = `${or.maxTokens} tokens`;
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
      telegram: { enabled: tgEnabled },
      discord: { enabled: dcEnabled }
    };

    if (keyInput) payload.openrouter.apiKey = keyInput;
    if (tgToken) payload.telegram.botToken = tgToken;
    if (dcToken) payload.discord.botToken = dcToken;

    try {
      const res = await fetch('/api/hermes/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        SoundFX.playBeep();
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

    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble bubble-user';
    userBubble.innerHTML = `
      <div class="bubble-sender"><i class="fa-solid fa-user"></i> Anda</div>
      <div class="bubble-text">${escapeHtml(message)}</div>
    `;
    container.appendChild(userBubble);

    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-bubble bubble-hermes';
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
        body: JSON.stringify({ message, sessionKey: 'vps_dashboard_console' })
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

        const tokenBar = document.getElementById('chat-tokens-info');
        const latencyBar = document.getElementById('chat-latency-info');
        if (tokenBar && data.usage) {
          tokenBar.innerHTML = `<i class="fa-solid fa-coins"></i> Token: ${data.usage.promptTokens} prompt + ${data.usage.completionTokens} reply = <strong>${data.usage.totalTokens} total</strong>`;
        }
        if (latencyBar && data.latencyMs) {
          latencyBar.innerHTML = `<i class="fa-solid fa-stopwatch"></i> Latency: ${data.latencyMs} ms`;
        }

        this.loadConfigAndStatus();
        if (window.TokenAnalyticsController) {
          window.TokenAnalyticsController.fetchAndRender();
        }
      } else {
        aiBubble.innerHTML = `
          <div class="bubble-sender text-red"><i class="fa-solid fa-triangle-exclamation"></i> Hermes AI Error</div>
          <div class="bubble-text text-red">${escapeHtml(data.error || 'Terjadi kesalahan')}</div>
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
        body: JSON.stringify({ sessionKey: 'vps_dashboard_console' })
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

// Modal Helper
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

// Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;

  let icon = '<i class="fa-solid fa-circle-info text-cyan"></i>';
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function formatMarkdownToHtml(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Service Power Controller (Stop / Start / Sleep Mode)
const ServiceController = {
  status: null,

  init() {
    this.setupListeners();
    this.fetchServiceStatus();
    setInterval(() => this.fetchServiceStatus(), 3000);
  },

  setupListeners() {
    // Hermes Actions
    const btnHermesStop = document.getElementById('btn-hermes-stop');
    const btnHermesStart = document.getElementById('btn-hermes-start');
    const btnHermesRestart = document.getElementById('btn-hermes-restart');

    if (btnHermesStop) {
      btnHermesStop.addEventListener('click', () => this.sendAction('hermes-ai-bot', 'stop'));
    }
    if (btnHermesStart) {
      btnHermesStart.addEventListener('click', () => this.sendAction('hermes-ai-bot', 'start'));
    }
    if (btnHermesRestart) {
      btnHermesRestart.addEventListener('click', () => this.sendAction('hermes-ai-bot', 'restart'));
    }

    // PUBG Actions
    const btnPubgStop = document.getElementById('btn-pubg-stop');
    const btnPubgStart = document.getElementById('btn-pubg-start');
    const btnPubgRestart = document.getElementById('btn-pubg-restart');

    if (btnPubgStop) {
      btnPubgStop.addEventListener('click', () => this.sendAction('pubg-bot', 'stop'));
    }
    if (btnPubgStart) {
      btnPubgStart.addEventListener('click', () => this.sendAction('pubg-bot', 'start'));
    }
    if (btnPubgRestart) {
      btnPubgRestart.addEventListener('click', () => this.sendAction('pubg-bot', 'restart'));
    }

    // Master Sleep Mode
    const btnSleep = document.getElementById('btn-toggle-sleep-mode');
    if (btnSleep) {
      btnSleep.addEventListener('click', () => {
        const isSleep = this.status?.sleepMode;
        if (isSleep) {
          this.sendAction('all', 'wake');
        } else {
          this.sendAction('all', 'sleep');
        }
      });
    }
  },

  async fetchServiceStatus() {
    try {
      const res = await fetch('/api/service/status');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        this.status = data;
        this.updateUI(data);
      }
    } catch (e) {}
  },

  updateUI(data) {
    const { hermes, pubg, sleepMode } = data;

    // 1. Hermes AI UI
    const hBadge = document.getElementById('ctrl-hermes-status-badge');
    const hRam = document.getElementById('ctrl-hermes-ram');
    const hCpu = document.getElementById('ctrl-hermes-cpu');
    const btnHStop = document.getElementById('btn-hermes-stop');
    const btnHStart = document.getElementById('btn-hermes-start');

    if (hermes.online) {
      if (hBadge) {
        hBadge.className = 'indicator-badge badge-on';
        hBadge.textContent = 'ONLINE';
      }
      if (btnHStop) btnHStop.style.display = 'inline-flex';
      if (btnHStart) btnHStart.style.display = 'none';
      if (hRam) hRam.textContent = `${hermes.memoryMb || 0} MB`;
      if (hCpu) hCpu.textContent = `${hermes.cpu || 0}%`;
    } else {
      if (hBadge) {
        hBadge.className = 'indicator-badge badge-off';
        hBadge.textContent = 'STOPPED (0% USAGE)';
      }
      if (btnHStop) btnHStop.style.display = 'none';
      if (btnHStart) btnHStart.style.display = 'inline-flex';
      if (hRam) hRam.textContent = '0 MB (Free)';
      if (hCpu) hCpu.textContent = '0%';
    }

    // 2. PUBG Bot UI
    const pBadge = document.getElementById('ctrl-pubg-status-badge');
    const pBotStat = document.getElementById('ctrl-pubg-bot-status');
    const btnPStop = document.getElementById('btn-pubg-stop');
    const btnPStart = document.getElementById('btn-pubg-start');

    if (pubg.botActive) {
      if (pBadge) {
        pBadge.className = 'indicator-badge badge-on';
        pBadge.textContent = pubg.discordConnected ? 'DISCORD & CRON ON' : 'ACTIVE';
      }
      if (pBotStat) pBotStat.textContent = 'Aktif & Terhubung';
      if (btnPStop) btnPStop.style.display = 'inline-flex';
      if (btnPStart) btnPStart.style.display = 'none';
    } else {
      if (pBadge) {
        pBadge.className = 'indicator-badge badge-off';
        pBadge.textContent = 'STOPPED (RAM HEMAT)';
      }
      if (pBotStat) pBotStat.textContent = 'Nonaktif (Tidur)';
      if (btnPStop) btnPStop.style.display = 'none';
      if (btnPStart) btnPStart.style.display = 'inline-flex';
    }

    // 3. Sleep Mode Master Button
    const sleepBtn = document.getElementById('btn-toggle-sleep-mode');
    const sleepText = document.getElementById('sleep-mode-btn-text');
    const sleepIcon = document.getElementById('sleep-mode-icon');

    if (sleepBtn && sleepText) {
      if (sleepMode) {
        sleepBtn.classList.add('active-sleep');
        sleepText.textContent = 'WAKE UP (AKTIFKAN SEMUA BOT)';
        if (sleepIcon) sleepIcon.className = 'fa-solid fa-sun';
      } else {
        sleepBtn.classList.remove('active-sleep');
        sleepText.textContent = 'MODE HEMAT DAYA (STOP SEMUA BOT)';
        if (sleepIcon) sleepIcon.className = 'fa-solid fa-moon';
      }
    }
  },

  async sendAction(serviceName, action) {
    SoundFX.playClick();
    showToast(`Mengirim perintah ${action} untuk ${serviceName}...`, 'info');

    try {
      const res = await fetch(`/api/service/${serviceName}/${action}`, {
        method: 'POST'
      });
      const data = await res.json();

      if (data.success) {
        SoundFX.playBeep();
        showToast(data.message, 'success');
        this.fetchServiceStatus();
        MetricsController.fetchMetrics();
      } else {
        showToast(data.message || 'Gagal memproses aksi', 'error');
      }
    } catch (e) {
      showToast('Koneksi terputus saat mengirim perintah', 'error');
    }
  }
};

// Token Analytics & Quota Visualizer
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

    // Main VPS Dashboard Project Card
    const cardUsed = document.getElementById('card-tok-used');
    if (cardUsed) cardUsed.textContent = `${totalTokens} Tok`;

    const cardCredit = document.getElementById('card-tok-credit');
    if (cardCredit) cardCredit.textContent = `$${limitRemaining.toFixed(2)}`;

    const cardFree = document.getElementById('card-tok-free');
    if (cardFree) cardFree.textContent = `${freeRemaining}/${freeLimit}`;

    const cardBar = document.getElementById('card-tok-bar');
    if (cardBar) cardBar.style.width = `${creditPercent}%`;

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
      // Draw grid
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

    // Build series
    const points = history.slice(-20);
    const series = points.length === 1 
      ? [{ time: '', promptTokens: 0, completionTokens: 0, totalTokens: 0 }, points[0]]
      : points;

    let maxVal = Math.max(...series.map(p => Math.max(p.promptTokens || 0, p.completionTokens || 0, p.totalTokens || 0)));
    maxVal = Math.max(maxVal, 100);
    maxVal = Math.ceil(maxVal / 50) * 50;

    // Draw Grid Lines & Y-axis labels
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

    // 1. Draw Prompt Tokens Area & Line (Cyan)
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

    // 2. Draw Completion Tokens Area & Line (Violet)
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

    // 3. Draw X-axis timestamps
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

    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    ctx.lineTo(paddingLeft + (values.length - 1) * stepX, paddingTop + chartH);
    ctx.lineTo(paddingLeft, paddingTop + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Data points dots
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
      // Empty Ring
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

    // 1. Draw Prompt Arc (Cyan)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + pAngle);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. Draw Reply Arc (Violet)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2 + pAngle, -Math.PI / 2 + Math.PI * 2);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center Text
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

// DOM Init
document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  TimelineChart.init();
  MetricsController.init();
  ServiceController.init();
  HermesHub.init();
  TokenAnalyticsController.init();
});
