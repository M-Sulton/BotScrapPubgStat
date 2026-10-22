const axios = require('axios');
const storage = require('./storage');

/**
 * Fetch stats using official PUBG Developer API (free from developer.pubg.com)
 */
async function fetchFromOfficialApi(playerName, apiKey) {
  try {
    const playerRes = await axios.get(
      `https://api.pubg.com/shards/steam/players?filter[playerNames]=${encodeURIComponent(playerName)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/vnd.api+json'
        },
        timeout: 10000
      }
    );

    const playerData = playerRes.data.data?.[0];
    if (!playerData) {
      throw new Error(`Player ${playerName} not found in PUBG Steam database`);
    }

    const matchIds = (playerData.relationships?.matches?.data || []).slice(0, 10).map(m => m.id);
    const todayStr = new Date().toISOString().split('T')[0];
    
    let matchesToday = [];
    let wins = 0;
    let losses = 0;
    let totalKills = 0;
    let totalDamage = 0;
    let top10Count = 0;

    // Fetch match details
    for (const matchId of matchIds) {
      try {
        const matchRes = await axios.get(`https://api.pubg.com/shards/steam/matches/${matchId}`, {
          headers: { 'Accept': 'application/vnd.api+json' },
          timeout: 6000
        });

        const match = matchRes.data;
        const matchDate = match.data.attributes.createdAt.split('T')[0];
        
        // Filter today's matches
        if (matchDate === todayStr) {
          const participant = match.included.find(
            item => item.type === 'participant' && item.attributes.stats.playerId === playerData.id
          );

          if (participant) {
            const stats = participant.attributes.stats;
            const isWin = stats.winPlace === 1;
            if (isWin) wins++;
            else losses++;
            
            totalKills += stats.kills || 0;
            totalDamage += Math.round(stats.damageDealt || 0);
            if (stats.winPlace <= 10) top10Count++;

            matchesToday.push({
              id: matchId.slice(0, 8),
              mode: match.data.attributes.gameMode || 'Squad',
              place: stats.winPlace,
              kills: stats.kills,
              damage: Math.round(stats.damageDealt),
              time: match.data.attributes.createdAt.substring(11, 16),
              win: isWin
            });
          }
        }
      } catch (mErr) {
        console.warn(`[PUBG API] Could not fetch match ${matchId}:`, mErr.message);
      }
    }

    const totalMatches = wins + losses;
    const kd = losses > 0 ? parseFloat((totalKills / losses).toFixed(2)) : totalKills;
    const winRate = totalMatches > 0 ? parseFloat(((wins / totalMatches) * 100).toFixed(1)) : 0;

    return {
      success: true,
      source: 'PUBG Official API',
      today: {
        date: todayStr,
        matches: totalMatches,
        wins,
        losses,
        kills: totalKills,
        damage: totalDamage,
        kd,
        winRate,
        top10: top10Count,
        recentMatches: matchesToday
      }
    };
  } catch (err) {
    console.error(`[PUBG API] Error fetching for ${playerName}:`, err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Primary Web Scraper directly targeting Tracker.gg:
 * https://tracker.gg/pubg/profile/steam/{playerName}/overview
 * or player.trackerUrl configured manually via UI
 */
async function scrapeTrackerGg(player) {
  const trackerUrl = player.trackerUrl || `https://tracker.gg/pubg/profile/steam/${encodeURIComponent(player.name)}/overview`;
  console.log(`[Tracker.gg] Scraping from source URL: ${trackerUrl}`);

  try {
    const res = await axios.get(trackerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://tracker.gg/'
      },
      timeout: 10000
    });

    const html = res.data;
    if (html.includes('Just a moment...') || html.includes('Cloudflare')) {
      console.warn(`[Tracker.gg] Cloudflare Turnstile active on ${trackerUrl}`);
      return { success: false, error: 'Cloudflare protection active on tracker.gg', isBlocked: true };
    }

    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    // Look for Next.js hydration data
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const segments = nextData.props?.pageProps?.segments || [];
        const overview = segments.find(s => s.type === 'overview') || segments[0];
        if (overview?.stats) {
          const stats = overview.stats;
          const wins = stats.wins?.value || 0;
          const matches = stats.matchesPlayed?.value || 0;
          const losses = Math.max(0, matches - wins);
          const kills = stats.kills?.value || 0;
          const damage = Math.round(stats.damageDealt?.value || 0);
          const kd = stats.kd?.value || (losses > 0 ? parseFloat((kills / losses).toFixed(2)) : kills);
          const winRate = stats.winRatio?.value || (matches > 0 ? parseFloat(((wins / matches) * 100).toFixed(1)) : 0);

          return {
            success: true,
            source: trackerUrl,
            today: {
              date: new Date().toISOString().split('T')[0],
              matches,
              wins,
              losses,
              kills,
              damage,
              kd,
              winRate
            }
          };
        }
      } catch (jsonErr) {
        console.warn('[Tracker.gg] Error parsing NextData:', jsonErr.message);
      }
    }

    return { success: false, error: 'Could not extract stats from tracker.gg HTML' };
  } catch (err) {
    if (err.response?.status === 403) {
      console.warn(`[Tracker.gg] 403 Cloudflare protection active on ${trackerUrl}. Using synced/saved manual stats.`);
      return { success: false, error: 'Cloudflare protection (403)', isBlocked: true };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Fallback Web Scraper via dak.gg
 */
async function scrapeWebStats(playerName) {
  try {
    const url = `https://dak.gg/pubg/profile/${encodeURIComponent(playerName)}`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const html = res.data;
    if (html.includes('No search results') || html.includes('User Not Found')) {
      return { success: false, error: 'User not found on web tracker' };
    }

    return { success: false, error: 'Web tracker returned incomplete client-rendered data' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Smart Simulation Generator for players when offline/no API key,
 * ensuring UI and Discord banters are lively and immediately functional.
 */
function generateDynamicStats(player) {
  const currentToday = player.today || {};
  const isWinnerType = player.name.toLowerCase().includes('petiru');
  const todayStr = new Date().toISOString().split('T')[0];

  let matches = currentToday.matches || 0;
  let wins = currentToday.wins || 0;
  let losses = currentToday.losses || 0;
  let kills = currentToday.kills || 0;
  let damage = currentToday.damage || 0;
  let recentMatches = Array.isArray(currentToday.recentMatches) ? [...currentToday.recentMatches] : [];

  // Add 1 fresh game upon manual refresh
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  if (isWinnerType) {
    const isWin = Math.random() > 0.45;
    const matchKills = isWin ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 3) + 1;
    const matchDmg = matchKills * 120 + Math.floor(Math.random() * 180);
    const place = isWin ? 1 : Math.floor(Math.random() * 10) + 2;

    matches += 1;
    if (isWin) wins += 1;
    else losses += 1;
    kills += matchKills;
    damage += matchDmg;

    recentMatches.unshift({
      id: 'm' + Date.now().toString().slice(-4),
      mode: 'Squad-FPP',
      place,
      kills: matchKills,
      damage: matchDmg,
      time: timeStr,
      win: isWin
    });
  } else {
    const isWin = Math.random() > 0.95;
    const matchKills = isWin ? 2 : (Math.random() > 0.6 ? 1 : 0);
    const matchDmg = matchKills * 80 + Math.floor(Math.random() * 90);
    const place = isWin ? 1 : Math.floor(Math.random() * 25) + 10;

    matches += 1;
    if (isWin) wins += 1;
    else losses += 1;
    kills += matchKills;
    damage += matchDmg;

    recentMatches.unshift({
      id: 'm' + Date.now().toString().slice(-4),
      mode: 'Squad-FPP',
      place,
      kills: matchKills,
      damage: matchDmg,
      time: timeStr,
      win: isWin
    });
  }

  recentMatches = recentMatches.slice(0, 6);

  const kd = losses > 0 ? parseFloat((kills / losses).toFixed(2)) : kills;
  const winRate = matches > 0 ? parseFloat(((wins / matches) * 100).toFixed(1)) : 0;
  const top10 = recentMatches.filter(m => m.place <= 10).length;

  return {
    date: todayStr,
    matches,
    wins,
    losses,
    kills,
    damage,
    kd,
    winRate,
    top10,
    headshots: Math.round(kills * 0.35),
    longestKill: isWinnerType ? 280 + Math.floor(Math.random() * 100) : 35 + Math.floor(Math.random() * 40),
    recentMatches
  };
}

/**
 * Refresh stats for all or single player
 * Prioritizes player.trackerUrl (https://tracker.gg/pubg/profile/steam/...)
 */
async function refreshPlayer(player) {
  const config = storage.getConfig();
  let updatedStats = null;

  // 1. Primary: Scrape from tracker.gg URL
  const trackerResult = await scrapeTrackerGg(player);
  if (trackerResult.success && trackerResult.today) {
    console.log(`[Scraper] Successfully pulled stats from Tracker.gg for ${player.name}`);
    updatedStats = { ...player.today, ...trackerResult.today };
  }

  // 2. Secondary: Official PUBG API if key is present
  if (!updatedStats && config.pubgApiKey && config.pubgApiKey.trim().length > 10) {
    const apiResult = await fetchFromOfficialApi(player.name, config.pubgApiKey);
    if (apiResult.success) {
      updatedStats = apiResult.today;
    }
  }

  // 3. Fallback: Strictly PRESERVE user's manual/verified stats from database!
  // NEVER fabricate fake chicken dinners or randomize matches!
  if (!updatedStats) {
    console.log(`[Scraper] Preserving exact verified stats for ${player.name} (no fake chicken dinners generated).`);
    updatedStats = player.today || {
      date: new Date().toISOString().split('T')[0],
      matches: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      damage: 0,
      kd: 0,
      winRate: 0,
      top10: 0,
      recentMatches: []
    };
  }

  // Save to storage
  storage.updatePlayerStats(player.name, { today: updatedStats });
  return updatedStats;
}

async function refreshAllPlayers() {
  const players = storage.getPlayers();
  const results = [];
  for (const player of players) {
    if (player.active !== false) {
      const stats = await refreshPlayer(player);
      results.push({ name: player.name, stats });
    }
  }
  return results;
}

module.exports = {
  refreshPlayer,
  refreshAllPlayers,
  scrapeTrackerGg,
  fetchFromOfficialApi,
  generateDynamicStats
};
