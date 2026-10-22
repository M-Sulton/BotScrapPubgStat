const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const storage = require('./storage');
const pubgScraper = require('./pubgScraper');

let client = null;
let scheduledTask = null;
let isConnected = false;
let botInfo = {
  username: null,
  tag: null,
  guilds: 0,
  status: 'offline',
  lastError: null
};

// Indonesian gaming banter collections
const PRAISE_QUOTES = [
  '🔥 **GOKIL ABIEZ!** {name} hari ini beneran kerasukan arwah pro player PGC! Panen **{wins}x CHICKEN DINNER** 🍗🍗🍗! Gendong tim sampe punggung mau copot! Sungkem dulu bosku! 🙇‍♂️👑',
  '🌟 **MVP HARI INI: {name}!** Dengan total **{kills} kills** dan damage **{damage}**, musuh auto uninstall begitu liat nickname doi di killfeed! Gacor parah ga ada obat! 🎯🔥',
  '🍗 **SULTAN AYAM!** {name} hari ini resmi buka warung geprek di Pochinki! Berhasil secure **{wins} kemenangan**. Pertahankan besok auto naik ranking Master! GGWP! 🏆✨',
  '⚡ **AIMLOCK LEVEL DEWA!** Aiming {name} lurus banget kayak jalan tol cipali! Headshot bertebaran, recoil Beryl serasa VSS! Lawan ga sempet kedip langsung balik ke lobby! 💀🔫',
  '👑 **PENGUASA ERANGEL!** Kalo ada piala bergilir squad kita, hari ini mutlak hak milik {name}! K/D **{kd}** hari ini bener-bener ngerusak mental musuh! 🥇🚀'
];

const ROAST_QUOTES = [
  '😭 **YA AMPUN {name}...** lu main PUBG apa simulasi lari marathon di Erangel? Main **{matches} match**, **0 CHICKEN DINNER**, mati terus tanpa perlawanan! Mending lu jadi supir UAZ aja daripada megang senjata bang! 🚗💥',
  '💀 **BEBAN INTERNASIONAL: {name}!** Tas level 3 isinya medkit sama peluru 500 biji tapi pas ketemu musuh malah panik lempar smoke ke kaki sendiri! K/D **{kd}** doang tobat bang, kasian teammate lu! 🪦💨',
  '🐔 **AYAM TETANGGA KETAWA NGAKAK!** Rekor {name} hari ini: **{matches} game = 0 AYAM**, **{losses}x toosoon!** Musuh lagi AFK aja kayaknya lu miss shot! Mending besok main Pou atau Subway Surfer dulu ya biar tenang! 🤡📉',
  '🤹 **TUKANG LOOT KELILING!** {name} turun cuma buat nganterin loot ke musuh! Capek-capek nyari AWM + Scope 8x, eh 2 menit kemudian mati ditembak pistol dari belakang! Donatur loot terbaik se-Asia Tenggara! 🎁🥲',
  '🪵 **REKOR MEMBAGONGKAN!** Hari ini {name} resmi dinobatkan sebagai "Pohon Berjalan". Damage cuma **{damage}** dari **{matches} match**! Nyamuk gigit aja lebih berasa damagenya bang daripada tembakan lu! 🪵🪓'
];

const MEDIOCRE_QUOTES = [
  '⚖️ Lumayan lah ya **{name}**, masih dapet **{wins} Chicken Dinner**. Tapi jangan cepet bangga dulu, besok naikin lagi kill-nya biar ga kena ceng-cengan squad!',
  '🎯 Not bad buat **{name}**, damage **{damage}** tergolong stabil meski tadi sempet beberapa kali toosoon konyol. Besok push lagi!'
];

/**
 * Generate human-like praise or roast based on player performance
 */
function generateBanter(players) {
  if (!players || players.length === 0) {
    return {
      praise: 'Belum ada data player yang dimonitor.',
      roast: 'Belum ada player untuk diejek.',
      summary: 'Data squad masih kosong.'
    };
  }

  // Sort players by Wins (descending), then KD, then Damage
  const sorted = [...players].sort((a, b) => {
    const aWins = a.today?.wins || 0;
    const bWins = b.today?.wins || 0;
    if (bWins !== aWins) return bWins - aWins;
    const aKd = a.today?.kd || 0;
    const bKd = b.today?.kd || 0;
    if (bKd !== aKd) return bKd - aKd;
    return (b.today?.damage || 0) - (a.today?.damage || 0);
  });

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  let praiseText = '';
  let roastText = '';

  // Praise evaluation
  if (best.today && best.today.wins > 0) {
    const randomPraise = PRAISE_QUOTES[Math.floor(Math.random() * PRAISE_QUOTES.length)];
    praiseText = randomPraise
      .replace(/{name}/g, best.name)
      .replace(/{wins}/g, best.today.wins)
      .replace(/{kills}/g, best.today.kills)
      .replace(/{damage}/g, best.today.damage)
      .replace(/{kd}/g, best.today.kd);
  } else {
    praiseText = `⚠️ **Hari yang suram buat squad!** Bahkan player terbaik kita **${best.name}** hari ini cuma mentok di ${best.today?.matches || 0} match tanpa chicken dinner sama sekali. Besok wajib mandi kembang sebelum login! 🥀🚿`;
  }

  // Roast evaluation
  if (worst.today && worst.today.wins === 0 && (worst.today.matches || 0) > 0) {
    const randomRoast = ROAST_QUOTES[Math.floor(Math.random() * ROAST_QUOTES.length)];
    roastText = randomRoast
      .replace(/{name}/g, worst.name)
      .replace(/{matches}/g, worst.today.matches)
      .replace(/{losses}/g, worst.today.losses)
      .replace(/{damage}/g, worst.today.damage)
      .replace(/{kd}/g, worst.today.kd);
  } else if (worst.today && worst.today.wins > 0 && worst.today.wins < (best.today?.wins || 0)) {
    roastText = `😂 **${worst.name}** selamat dari kategori beban karena dapet ${worst.today.wins} Chicken Dinner, tapi tetep aja kalah jauh dari ${best.name}! Besok lu yang bayarin gorengan squad! 🍟💸`;
  } else {
    roastText = `👀 **${worst.name}** hari ini pasif banget, ga ada aksi mencolok. Jangan cuma numpang lewat di leaderboard bang!`;
  }

  return {
    bestPlayer: best,
    worstPlayer: worst,
    praise: praiseText,
    roast: roastText
  };
}

/**
 * Build rich Discord embed for daily report
 */
function createDailyReportEmbed(players) {
  const banter = generateBanter(players);
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const totalWins = players.reduce((sum, p) => sum + (p.today?.wins || 0), 0);
  const totalMatches = players.reduce((sum, p) => sum + (p.today?.matches || 0), 0);
  const totalKills = players.reduce((sum, p) => sum + (p.today?.kills || 0), 0);

  const embed = new EmbedBuilder()
    .setTitle(`🍗 LAPORAN HARIAN PUBG STEAM SQUAD (18:00 WIB)`)
    .setDescription(
      `📅 **${dateStr}**\n` +
      `🔥 **Statistik Hari Ini:** \`${totalMatches}\` Match • \`${totalWins}\` Chicken Dinners • \`${totalKills}\` Kills Squad\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setColor(totalWins > 0 ? 0xF2A900 : 0xEE4444)
    .setThumbnail('https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/578080/7e0a4f5c0a37ff5a229c693425f3c9597ffc3a50.jpg')
    .setFooter({
      text: 'PUBG Steam Stats Bot • Hermes Server • Auto Report Setiap 18:00 WIB',
      iconURL: 'https://images.squarespace-cdn.com/content/v1/58b09337b8a79b767223e7e8/1504285908234-P5L8C9M66B408B1F3DCH/PUBG+Icon.png'
    })
    .setTimestamp();

  // Leaderboard field
  const sortedPlayers = [...players].sort((a, b) => (b.today?.wins || 0) - (a.today?.wins || 0) || (b.today?.kd || 0) - (a.today?.kd || 0));
  
  let leaderboardText = '';
  sortedPlayers.forEach((p, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';
    const wins = p.today?.wins || 0;
    const losses = p.today?.losses || 0;
    const kd = p.today?.kd || 0;
    const kills = p.today?.kills || 0;
    const dmg = p.today?.damage || 0;
    
    // Trend compared to yesterday
    const yWins = p.yesterday?.wins || 0;
    const winDiff = wins - yWins;
    const trendIcon = winDiff > 0 ? `🟢 (+${winDiff} 🍗)` : winDiff < 0 ? `🔴 (${winDiff} 🍗)` : `⚪ (Sama)`;

    leaderboardText += `${medal} **${p.name}**\n` +
      `> 🍗 **${wins} Win** / **${losses} Lose** | K/D: \`${kd}\` | 🎯 \`${kills} Kills\` | 💥 \`${dmg} Dmg\`\n` +
      `> Kemarin: ${p.yesterday?.wins || 0}W/${p.yesterday?.losses || 0}L • Trend: ${trendIcon}\n\n`;
  });

  embed.addFields(
    { name: '📊 LEADERBOARD HARI INI', value: leaderboardText || 'Tidak ada data player aktif.' },
    { name: '👑 PUJIAN SULTAN AYAM (MVP)', value: banter.praise },
    { name: '💀 EJEKAN BEBAN SQUAD (LOSER)', value: banter.roast }
  );

  return embed;
}

/**
 * Send daily report to configured Discord channel
 */
async function sendDailyReport() {
  if (!client || !isConnected) {
    console.warn('[Discord] Bot is not connected. Skipping daily report.');
    return { success: false, message: 'Discord bot tidak sedang online' };
  }

  const config = storage.getConfig();
  const channelId = config.discordChannelId;
  if (!channelId) {
    console.warn('[Discord] discordChannelId not configured.');
    return { success: false, message: 'Discord Channel ID belum disetting!' };
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      throw new Error(`Channel dengan ID ${channelId} tidak ditemukan.`);
    }

    // Refresh players first for up-to-the-minute accuracy
    await pubgScraper.refreshAllPlayers();
    const players = storage.getPlayers().filter(p => p.active !== false);

    const embed = createDailyReportEmbed(players);
    await channel.send({
      content: '🚨 **PANGGILAN DARURAT SQUAD!** Laporan Performa PUBG Steam Hari Ini Sudah Keluar! 👇',
      embeds: [embed]
    });

    console.log(`[Discord] Daily report successfully sent to channel ${channelId}`);
    return { success: true, message: 'Laporan berhasil dikirim ke Discord!' };
  } catch (err) {
    console.error('[Discord] Failed to send daily report:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Setup and start node-cron schedule (Default 18:00 WIB)
 */
function initScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  const config = storage.getConfig();
  const scheduleStr = config.cronSchedule || '0 18 * * *';
  const timezone = config.cronTimezone || 'Asia/Jakarta';

  console.log(`[Scheduler] Setting daily PUBG cron at '${scheduleStr}' (${timezone})`);

  scheduledTask = cron.schedule(
    scheduleStr,
    async () => {
      console.log(`[Scheduler] 18:00 WIB triggered! Sending daily PUBG report to Discord...`);
      await sendDailyReport();
    },
    {
      scheduled: true,
      timezone: timezone
    }
  );
}

/**
 * Initialize Discord Bot
 */
async function initBot() {
  const config = storage.getConfig();
  const token = config.discordToken;

  if (!token || token.trim() === '') {
    console.log('[Discord] No token found in config. Bot waiting for token via UI or settings.');
    botInfo.status = 'no_token';
    return;
  }

  try {
    if (client) {
      await client.destroy();
    }

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    client.once('ready', () => {
      isConnected = true;
      botInfo = {
        username: client.user.username,
        tag: client.user.tag,
        guilds: client.guilds.cache.size,
        status: 'online',
        lastError: null
      };
      console.log(`[Discord] Bot connected successfully as ${client.user.tag} in ${client.guilds.cache.size} server(s)!`);
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      const content = message.content.trim().toLowerCase();

      // Command !pubg or !stat
      if (content === '!pubg' || content === '!stat' || content === '!score') {
        const players = storage.getPlayers().filter(p => p.active !== false);
        const embed = createDailyReportEmbed(players);
        await message.reply({ embeds: [embed] });
      }

      // Command !refresh
      else if (content === '!refresh') {
        await message.reply('🔄 Sedang memperbarui statistik PUBG Steam dari server...');
        await pubgScraper.refreshAllPlayers();
        const players = storage.getPlayers().filter(p => p.active !== false);
        const embed = createDailyReportEmbed(players);
        await message.channel.send({ content: '✅ Statistik berhasil di-refresh!', embeds: [embed] });
      }

      // Command !roast
      else if (content === '!roast') {
        const players = storage.getPlayers().filter(p => p.active !== false);
        const banter = generateBanter(players);
        await message.reply(`🔥 **EJEKAN SPESIAL:**\n${banter.roast}`);
      }

      // Command !praise
      else if (content === '!praise') {
        const players = storage.getPlayers().filter(p => p.active !== false);
        const banter = generateBanter(players);
        await message.reply(`👑 **PUJIAN SPESIAL:**\n${banter.praise}`);
      }

      // Command !help
      else if (content === '!pubghelp' || content === '!help') {
        await message.reply(
          `🎮 **DAFTAR COMMAND PUBG BOT:**\n` +
          `• \`!pubg\` atau \`!stat\` : Lihat laporan skor & leaderboard hari ini\n` +
          `• \`!roast\` : Dengerin ejekan pedas buat player terbeban hari ini\n` +
          `• \`!praise\` : Dengerin pujian buat sultan chicken dinner hari ini\n` +
          `• \`!refresh\` : Refresh data statistik terbaru dari Steam\n` +
          `*Bot otomatis posting rangkuman setiap jam 18:00 WIB!*`
        );
      }
    });

    client.on('error', (err) => {
      console.error('[Discord] Client error:', err.message);
      botInfo.lastError = err.message;
      botInfo.status = 'error';
    });

    await client.login(token);
    initScheduler();
  } catch (err) {
    console.error('[Discord] Login failed:', err.message);
    botInfo.status = 'error';
    botInfo.lastError = err.message;
    isConnected = false;
  }
}

function getBotStatus() {
  return {
    isConnected,
    ...botInfo
  };
}

async function stopBot() {
  if (client) {
    try {
      await client.destroy();
    } catch (e) {}
    client = null;
  }
  if (scheduledTask) {
    try {
      scheduledTask.stop();
    } catch (e) {}
    scheduledTask = null;
  }
  isConnected = false;
  botInfo.status = 'stopped';
  botInfo.username = null;
  botInfo.tag = null;
  console.log('[Discord] Bot & Scheduler successfully stopped. Resources freed!');
  return { success: true, message: 'Bot Discord & Scheduler harian berhasil dimatikan.' };
}

module.exports = {
  initBot,
  initScheduler,
  sendDailyReport,
  generateBanter,
  createDailyReportEmbed,
  getBotStatus,
  stopBot
};
