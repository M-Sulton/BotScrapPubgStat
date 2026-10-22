const os = require('os');
const { exec } = require('child_process');

let lastCpuTimes = getCpuTimes();

function getCpuTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function calculateCpuPercent() {
  const current = getCpuTimes();
  const idleDiff = current.idle - lastCpuTimes.idle;
  const totalDiff = current.total - lastCpuTimes.total;
  lastCpuTimes = current;

  if (totalDiff <= 0) return 0;
  const usage = 100 - Math.floor((idleDiff / totalDiff) * 100);
  return Math.max(0, Math.min(100, usage));
}

function getDiskUsage() {
  return new Promise((resolve) => {
    exec('df -h /', (err, stdout) => {
      if (err || !stdout) {
        return resolve({ total: '60G', used: '12G', free: '48G', percent: 20 });
      }
      try {
        const lines = stdout.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].trim().split(/\s+/);
          // Format: Filesystem Size Used Avail Use% Mounted on
          return resolve({
            filesystem: parts[0] || '/dev/vda2',
            total: parts[1] || '60G',
            used: parts[2] || '12G',
            free: parts[3] || '48G',
            percent: parseInt(parts[4] || '20', 10)
          });
        }
      } catch (e) {}
      resolve({ total: '60G', used: '12G', free: '48G', percent: 20 });
    });
  });
}

function getPm2Processes() {
  return new Promise((resolve) => {
    exec('pm2 jlist', (err, stdout) => {
      if (err || !stdout) {
        return resolve([]);
      }
      try {
        const list = JSON.parse(stdout);
        const processes = list.map(p => {
          const memBytes = p.monit?.memory || 0;
          const memMb = (memBytes / (1024 * 1024)).toFixed(1);
          const cpu = p.monit?.cpu || 0;
          const uptimeMs = p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0;
          const uptimeSec = Math.floor(uptimeMs / 1000);

          return {
            id: p.pm_id,
            name: p.name,
            pid: p.pid,
            status: p.pm2_env?.status || 'unknown',
            cpu,
            memoryMb: parseFloat(memMb),
            uptimeSeconds: uptimeSec,
            restarts: p.pm2_env?.restart_time || 0
          };
        });
        return resolve(processes);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

async function getFullSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  const cpuPercent = calculateCpuPercent();
  const [disk, pm2Processes] = await Promise.all([
    getDiskUsage(),
    getPm2Processes()
  ]);

  const loadAvg = os.loadavg();
  const cpus = os.cpus();

  return {
    success: true,
    server: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.floor(os.uptime()),
      ip: '43.156.17.135',
      location: 'Singapore / Asia (Tencent Cloud)',
      osName: 'Ubuntu 24.04 LTS (Noble Numbat)',
      timestamp: new Date().toISOString()
    },
    cpu: {
      model: cpus[0]?.model || 'Virtual CPU',
      cores: cpus.length,
      usagePercent: cpuPercent,
      loadAverage: {
        '1m': parseFloat(loadAvg[0].toFixed(2)),
        '5m': parseFloat(loadAvg[1].toFixed(2)),
        '15m': parseFloat(loadAvg[2].toFixed(2))
      }
    },
    memory: {
      totalMb: Math.round(totalMem / (1024 * 1024)),
      usedMb: Math.round(usedMem / (1024 * 1024)),
      freeMb: Math.round(freeMem / (1024 * 1024)),
      usagePercent: memPercent
    },
    disk,
    pm2: pm2Processes
  };
}

function executePm2Action(processName, action) {
  return new Promise((resolve) => {
    const allowedProcesses = ['hermes-ai-bot', 'pubg-tracker-bot'];
    const allowedActions = ['stop', 'start', 'restart'];

    if (!allowedProcesses.includes(processName) || !allowedActions.includes(action)) {
      return resolve({ success: false, message: 'Parameter proses atau aksi tidak valid.' });
    }

    const cmd = `pm2 ${action} ${processName}`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        return resolve({ success: false, message: `Gagal menjalankan pm2 ${action}: ${err.message}`, stderr });
      }
      resolve({
        success: true,
        message: `Service ${processName} berhasil di-${action}!`,
        output: stdout
      });
    });
  });
}

module.exports = {
  getFullSystemMetrics,
  executePm2Action
};
