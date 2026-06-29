export const MOCK_MISSION_DATA = {
  missionName: 'ADITYA-L1 SOLAR INTELLIGENCE PLATFORM',
  missionTime: 'T+ 243:18:42:09',
  apiLatency: 42,
  gpuUsage: 68,
  cpuUsage: 45,
  orbitPhase: 'L1 Halo Orbit',
  dataFreshness: '0.8s',
  status: {
    API: 'ONLINE',
    SOLEXS: 'ONLINE',
    HEL1OS: 'DEGRADED',
    VELC: 'ONLINE',
    Fusion: 'ONLINE',
    DB: 'ONLINE'
  }
};

export const MOCK_FLARE_PREDICTION = {
  probability: 68,
  forecast: 'B-Class',
  confidence: 67.9,
  alertLevel: 'LOW',
  recommendation: 'Monitor VELC streams. Maintain normal operations.',
  trajectory: 'Rising'
};

export const MOCK_ALERTS = [
  { id: 1, level: 'WATCH', timestamp: '2026-06-29T18:45:00Z', reason: 'SOLEXS Flux > C-class threshold', status: 'Active', operatorNotes: 'Investigating VELC correlation.' },
  { id: 2, level: 'ALL CLEAR', timestamp: '2026-06-29T14:20:00Z', reason: 'Flux returned to baseline', status: 'Resolved', operatorNotes: 'False alarm triggered by calibration.' }
];

export const MOCK_PAST_EVENTS = [
  { id: 'E-4892', similarity: 94, outcome: 'C-class Flare', actualGoes: 'C3.2', timeDiff: '+18 mins' },
  { id: 'E-4811', similarity: 89, outcome: 'B-class Flare', actualGoes: 'B8.9', timeDiff: '+24 mins' },
  { id: 'E-4203', similarity: 84, outcome: 'No Flare', actualGoes: 'A2.1', timeDiff: 'N/A' },
];

export const MOCK_BACKEND_HEALTH = {
  inferenceTime: 124,
  dataAge: '1.2s',
  pipelineStatus: 'Nominal',
  queueLength: 0,
  memory: '4.2GB / 16GB',
  gpu: '11.8GB / 24GB'
};

export const MOCK_INSTRUMENT_HEALTH = {
  solexs: { completeness: '99.9%', noise: 'Low', missingPackets: 12, frameDrops: 0, corrupted: 0 },
  hel1os: { completeness: '94.2%', noise: 'Medium', missingPackets: 450, frameDrops: 2, corrupted: 1 },
  velc: { completeness: '98.5%', noise: 'Low', missingPackets: 89, frameDrops: 1, corrupted: 0 }
};

export const MOCK_FUSION_REASONING = [
  { id: 1, component: 'SOLEXS', confidence: 68, reason: 'Increasing X-ray flux' },
  { id: 2, component: 'HEL1OS', confidence: 84, reason: 'Hard X-ray burst detected' },
  { id: 3, component: 'VELC', confidence: 92, reason: 'High coronal activity & loop expansion' },
];

export const MOCK_AI_FEATURES = [
  { name: 'Peak Count', value: '+0.031', raw: 14, impact: 85 },
  { name: 'Energy', value: '+0.024', raw: '24.5 keV', impact: 72 },
  { name: 'Trend', value: '+0.018', raw: 'Rising', impact: 65 },
  { name: 'HEL Activity', value: '+0.015', raw: 'Medium', impact: 45 },
  { name: 'VELC Novelty', value: '+0.042', raw: 89, impact: 92 }
];

// Generate 60 points of lightcurve data
export const generateLightcurveData = () => {
  const data = [];
  let base = 500;
  for (let i = 60; i >= 0; i--) {
    // Add a synthetic spike towards the end
    if (i < 15 && i > 5) {
      base += Math.random() * 2000;
    } else if (i <= 5) {
      base -= Math.random() * 1000;
    } else {
      base += (Math.random() - 0.5) * 200;
    }
    base = Math.max(100, base); // Floor at 100
    
    data.push({
      time: `-${i}m`,
      flux: Math.floor(base),
      prediction: i === 0 ? base + 1500 : null,
      isThreshold: base > 2000
    });
  }
  return data;
};
