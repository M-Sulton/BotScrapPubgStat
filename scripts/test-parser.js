const { parseTrackerGgText } = require('../services/trackerParser');

const sample = `Match History
Today
2
0 W
1 Top 5
Kills
8
Assists
2
Damage
995
Cumulative Kills
11
2nd
15 hours ago
Squad (TPP)
Lobby K/D
1.01
Kills
6
Assists
2
Damage
717
BLUEEEEEEEEE12
0 Kills
MugenKi
0 Kills
Cjhon_2098
3 Kills
7th
16 hours ago
Squad (TPP)
Lobby K/D
1.21
Kills
2
Assists
0
Damage
278
BLUEEEEEEEEE12
0 Kills
MugenKi
0 Kills
Cjhon_2098
0 Kills
Oct 02
3
0 W
0 Top 5`;

const result = parseTrackerGgText(sample);
console.log(JSON.stringify(result, null, 2));
