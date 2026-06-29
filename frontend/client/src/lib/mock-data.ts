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

export const MOCK_MULTI_HORIZON_FORECAST = [
  { horizon: 'NOW', class: 'Quiet', prediction: 'Quiet', forecast: 'Quiet', prob: { quiet: 0.85, B: 0.10, C: 0.04, M: 0.009, X: 0.001 }, probabilities: { Quiet: 0.85, 'B-like': 0.10, 'C-like': 0.04, 'M-like': 0.009, 'X-like': 0.001 }, confidence: 0.95, forecast_confidence: 0.95, forecast_severity_index: 0.12, entropy: 0.35, uncertainty: 0.05, prediction_id: 'mock-uuid-now', probability_vector: [0.85, 0.10, 0.04, 0.009, 0.001], model_sha: 'c92d13aef1bc' },
  { horizon: '5m', class: 'B', prediction: 'B-like', forecast: 'B-like', prob: { quiet: 0.40, B: 0.47, C: 0.10, M: 0.02, X: 0.01 }, probabilities: { Quiet: 0.40, 'B-like': 0.47, 'C-like': 0.10, 'M-like': 0.02, 'X-like': 0.01 }, confidence: 0.88, forecast_confidence: 0.88, forecast_severity_index: 0.77, entropy: 1.12, uncertainty: 0.12, prediction_id: 'mock-uuid-5m', probability_vector: [0.40, 0.47, 0.10, 0.02, 0.01], model_sha: 'c92d13aef1bc' },
  { horizon: '10m', class: 'B', prediction: 'B-like', forecast: 'B-like', prob: { quiet: 0.30, B: 0.42, C: 0.20, M: 0.06, X: 0.02 }, probabilities: { Quiet: 0.30, 'B-like': 0.42, 'C-like': 0.20, 'M-like': 0.06, 'X-like': 0.02 }, confidence: 0.85, forecast_confidence: 0.85, forecast_severity_index: 1.08, entropy: 1.25, uncertainty: 0.15, prediction_id: 'mock-uuid-10m', probability_vector: [0.30, 0.42, 0.20, 0.06, 0.02], model_sha: 'c92d13aef1bc' },
  { horizon: '15m', class: 'C', prediction: 'C-like', forecast: 'C-like', prob: { quiet: 0.20, B: 0.30, C: 0.45, M: 0.04, X: 0.01 }, probabilities: { Quiet: 0.20, 'B-like': 0.30, 'C-like': 0.45, 'M-like': 0.04, 'X-like': 0.01 }, confidence: 0.82, forecast_confidence: 0.82, forecast_severity_index: 1.36, entropy: 1.28, uncertainty: 0.18, prediction_id: 'mock-uuid-15m', probability_vector: [0.20, 0.30, 0.45, 0.04, 0.01], model_sha: 'c92d13aef1bc' },
  { horizon: '30m', class: 'C', prediction: 'C-like', forecast: 'C-like', prob: { quiet: 0.15, B: 0.25, C: 0.50, M: 0.08, X: 0.02 }, probabilities: { Quiet: 0.15, 'B-like': 0.25, 'C-like': 0.50, 'M-like': 0.08, 'X-like': 0.02 }, confidence: 0.76, forecast_confidence: 0.76, forecast_severity_index: 1.57, entropy: 1.35, uncertainty: 0.24, prediction_id: 'mock-uuid-30m', probability_vector: [0.15, 0.25, 0.50, 0.08, 0.02], model_sha: 'c92d13aef1bc' },
  { horizon: '60m', class: 'M', prediction: 'M-like', forecast: 'M-like', prob: { quiet: 0.10, B: 0.20, C: 0.35, M: 0.30, X: 0.05 }, probabilities: { Quiet: 0.10, 'B-like': 0.20, 'C-like': 0.35, 'M-like': 0.30, 'X-like': 0.05 }, confidence: 0.65, forecast_confidence: 0.65, forecast_severity_index: 2.00, entropy: 1.58, uncertainty: 0.35, prediction_id: 'mock-uuid-60m', probability_vector: [0.10, 0.20, 0.35, 0.30, 0.05], model_sha: 'c92d13aef1bc' },
  { horizon: '120m', class: 'M', prediction: 'M-like', forecast: 'M-like', prob: { quiet: 0.15, B: 0.25, C: 0.30, M: 0.25, X: 0.05 }, probabilities: { Quiet: 0.15, 'B-like': 0.25, 'C-like': 0.30, 'M-like': 0.25, 'X-like': 0.05 }, confidence: 0.58, forecast_confidence: 0.58, forecast_severity_index: 1.80, entropy: 1.62, uncertainty: 0.42, prediction_id: 'mock-uuid-120m', probability_vector: [0.15, 0.25, 0.30, 0.25, 0.05], model_sha: 'c92d13aef1bc' },
  { horizon: '180m', class: 'Quiet', prediction: 'Quiet', forecast: 'Quiet', prob: { quiet: 0.45, B: 0.30, C: 0.15, M: 0.08, X: 0.02 }, probabilities: { Quiet: 0.45, 'B-like': 0.30, 'C-like': 0.15, 'M-like': 0.08, 'X-like': 0.02 }, confidence: 0.50, forecast_confidence: 0.50, forecast_severity_index: 0.92, entropy: 1.38, uncertainty: 0.50, prediction_id: 'mock-uuid-180m', probability_vector: [0.45, 0.30, 0.15, 0.08, 0.02], model_sha: 'c92d13aef1bc' },
];

export const MOCK_CORRELATION_DATA = {
  overall: 0.82,
  pairs: [
    { pair: 'SOLEXS ↔ HEL1OS', value: 0.91, rating: 5 },
    { pair: 'SOLEXS ↔ VELC', value: 0.74, rating: 4 },
    { pair: 'HEL1OS ↔ VELC', value: 0.69, rating: 3 },
  ]
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

export const MOCK_AI_FEATURES_MULTI = {
  '5m': [
    { name: 'Peak Count', value: '+0.031' },
    { name: 'Energy', value: '+0.024' },
    { name: 'Trend', value: '+0.018' }
  ],
  '10m': [
    { name: 'Trend', value: '+0.029' },
    { name: 'Peak Count', value: '+0.025' },
    { name: 'Energy', value: '+0.019' }
  ],
  '15m': [
    { name: 'Energy', value: '+0.035' },
    { name: 'HEL Activity', value: '+0.028' },
    { name: 'Trend', value: '+0.021' }
  ],
  '30m': [
    { name: 'HEL Activity', value: '+0.041' },
    { name: 'VELC Novelty', value: '+0.032' },
    { name: 'Energy', value: '+0.025' }
  ],
  '60m': [
    { name: 'VELC Novelty', value: '+0.055' },
    { name: 'HEL Activity', value: '+0.038' },
    { name: 'Structure', value: '+0.030' }
  ],
  '120m': [
    { name: 'Structure', value: '+0.048' },
    { name: 'VELC Novelty', value: '+0.042' },
    { name: 'Trend', value: '+0.035' }
  ],
  '180m': [
    { name: 'Baseline Flux', value: '+0.052' },
    { name: 'Structure', value: '+0.040' },
    { name: 'Day/Night', value: '+0.031' }
  ]
};

// Generate 24x7 heatmap data
export const generateHeatmapData = () => {
  const data = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let d = 0; d < 7; d++) {
    const row = { day: days[d], hours: [] as number[] };
    for (let h = 0; h < 24; h++) {
      // 0 = Healthy (Green), 1 = Warning (Yellow), 2 = Offline (Red)
      const rand = Math.random();
      let status = 0;
      if (rand > 0.95) status = 2;
      else if (rand > 0.85) status = 1;
      row.hours.push(status);
    }
    data.push(row);
  }
  return data;
};

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
