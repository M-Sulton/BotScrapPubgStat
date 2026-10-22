/**
 * Parser for raw text copied from Tracker.gg PUBG Match History section
 */
function parseTrackerGgText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, message: 'Teks Tracker.gg tidak boleh kosong' };
  }

  const clean = rawText.replace(/\r\n/g, '\n');
  const todayStr = new Date().toISOString().split('T')[0];

  let matches = 0;
  let wins = 0;
  let top5 = 0;
  let kills = 0;
  let assists = 0;
  let damage = 0;

  // 1. Match Today overview block
  // Pattern: "Today\n2\n0 W\n1 Top 5\nKills\n8\nAssists\n2\nDamage\n995"
  const todayBlockMatch = clean.match(/Today\s*\n\s*(\d+)\s*\n\s*(\d+)\s*W(?:\s*\n\s*(\d+)\s*Top\s*5)?/i);
  if (todayBlockMatch) {
    matches = parseInt(todayBlockMatch[1], 10) || 0;
    wins = parseInt(todayBlockMatch[2], 10) || 0;
    top5 = parseInt(todayBlockMatch[3] || 0, 10);
  } else {
    // Alternate loose matching
    const looseMatches = clean.match(/Today[\s\S]*?(\d+)\s*(?:Matches|Games)?\s*\n\s*(\d+)\s*W/i);
    if (looseMatches) {
      matches = parseInt(looseMatches[1], 10) || 0;
      wins = parseInt(looseMatches[2], 10) || 0;
    }
  }

  // Extract total Kills for Today
  const killsMatch = clean.match(/Kills\s*\n\s*(\d+)/i);
  if (killsMatch) {
    kills = parseInt(killsMatch[1], 10) || 0;
  }

  // Extract total Assists for Today
  const assistsMatch = clean.match(/Assists\s*\n\s*(\d+)/i);
  if (assistsMatch) {
    assists = parseInt(assistsMatch[1], 10) || 0;
  }

  // Extract total Damage for Today
  const damageMatch = clean.match(/Damage\s*\n\s*([\d,]+)/i);
  if (damageMatch) {
    damage = parseInt(damageMatch[1].replace(/,/g, ''), 10) || 0;
  }

  // 2. Extract Individual Matches
  // Example pattern:
  // 2nd\n15 hours ago\nSquad (TPP)\nLobby K/D\n1.01\nKills\n6\nAssists\n2\nDamage\n717
  const matchRegex = /(\d+)(?:st|nd|rd|th)\s*\n\s*([^\n]+(?:ago|yesterday|today|[0-9:]+))\s*\n\s*([^\n]+)\s*\n\s*(?:Lobby\s*K\/D\s*\n\s*[\d.]+\s*\n\s*)?Kills\s*\n\s*(\d+)\s*\n\s*Assists\s*\n\s*(\d+)\s*\n\s*Damage\s*\n\s*([\d,]+)/gi;
  
  const recentMatches = [];
  let mMatch;
  while ((mMatch = matchRegex.exec(clean)) !== null) {
    const place = parseInt(mMatch[1], 10);
    const time = mMatch[2].trim();
    const mode = mMatch[3].trim().replace(/\s+/g, '-');
    const mKills = parseInt(mMatch[4], 10) || 0;
    const mAssists = parseInt(mMatch[5], 10) || 0;
    const mDamage = parseInt(mMatch[6].replace(/,/g, ''), 10) || 0;
    const isWin = place === 1;

    recentMatches.push({
      id: 'm' + Math.abs(hashCode(time + place + mKills)).toString(36),
      place,
      mode,
      kills: mKills,
      assists: mAssists,
      damage: mDamage,
      time,
      win: isWin
    });
  }

  // If matches count was not parsed from "Today\n2", count parsed matches
  if (matches === 0 && recentMatches.length > 0) {
    matches = recentMatches.length;
    wins = recentMatches.filter(m => m.win).length;
    kills = recentMatches.reduce((s, m) => s + m.kills, 0);
    damage = recentMatches.reduce((s, m) => s + m.damage, 0);
  }

  const losses = Math.max(0, matches - wins);
  const kd = losses > 0 ? parseFloat((kills / losses).toFixed(2)) : kills;
  const winRate = matches > 0 ? parseFloat(((wins / matches) * 100).toFixed(1)) : 0;
  const top10 = recentMatches.filter(m => m.place <= 10).length || top5;

  // 3. Extract Yesterday data if present (e.g. "Oct 02\n3\n0 W\n0 Top 5")
  let yesterdayData = null;
  const yestMatch = clean.match(/([A-Z][a-z]{2}\s+\d{1,2})\s*\n\s*(\d+)\s*\n\s*(\d+)\s*W(?:\s*\n\s*(\d+)\s*Top\s*5)?/i);
  if (yestMatch) {
    const yMatches = parseInt(yestMatch[2], 10) || 0;
    const yWins = parseInt(yestMatch[3], 10) || 0;
    const yLosses = Math.max(0, yMatches - yWins);
    yesterdayData = {
      date: yestMatch[1],
      matches: yMatches,
      wins: yWins,
      losses: yLosses,
      kd: yLosses > 0 ? 0.0 : 0,
      winRate: yMatches > 0 ? parseFloat(((yWins / yMatches) * 100).toFixed(1)) : 0
    };
  }

  return {
    success: true,
    today: {
      date: todayStr,
      matches,
      wins,
      losses,
      kills,
      damage,
      kd,
      winRate,
      top10,
      assists,
      recentMatches: recentMatches.length > 0 ? recentMatches : undefined
    },
    yesterday: yesterdayData
  };
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

module.exports = {
  parseTrackerGgText
};
