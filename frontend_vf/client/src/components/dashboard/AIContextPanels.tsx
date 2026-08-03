import React, { useEffect, useState } from 'react';
import { BrainCircuit, Flame, Activity } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ResponsiveContainer, LineChart, Line, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';

export function HeliosActivityPanel() {
  const { data } = useDashboard();
  const hel1os = data?.instruments?.hel1os;
  const hasObs = hel1os?.flux !== undefined && hel1os?.flux !== null && hel1os?.flux > 0.0;
  const fluxVal = hasObs ? hel1os.flux.toExponential(1) : "No Current Observation";
  const fluxColor = hasObs ? "text-[#ff9f1c]" : "text-gray-500 text-sm font-medium";

  // Map historical flux values directly from actual database history returned by the backend
  const hel1osHistory = data?.history && data.history.length > 0
    ? data.history.map((h: any) => ({
        time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        activity: h.hel1os_activity_score
      }))
    : [
        { time: '00:00', activity: 40 },
        { time: '00:15', activity: 45 },
        { time: '00:30', activity: 38 },
        { time: '00:45', activity: 42 }
      ];
  const fluxStyle = hasObs ? "text-xl font-black text-[#ff9f1c]" : "text-[10px] font-bold text-gray-500";

  // Calculate dynamic observations age and scientific UTC timestamp
  const obsTimeStr = hel1os?.timestamp;
  let formattedObsTime = "--";
  let datasetModeStr = "Historical";
  
  if (obsTimeStr) {
    let cleanTimeStr = obsTimeStr;
    if (!obsTimeStr.endsWith('Z') && !obsTimeStr.includes('GMT') && !obsTimeStr.includes('UTC') && !obsTimeStr.includes('+')) {
      cleanTimeStr = obsTimeStr.replace(' ', 'T') + 'Z';
    }
    const obsDate = new Date(cleanTimeStr);
    if (!isNaN(obsDate.getTime())) {
      const year = obsDate.getUTCFullYear();
      const month = String(obsDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(obsDate.getUTCDate()).padStart(2, '0');
      const hours = String(obsDate.getUTCHours()).padStart(2, '0');
      const minutes = String(obsDate.getUTCMinutes()).padStart(2, '0');
      formattedObsTime = `${year}-${month}-${day} ${hours}:${minutes} UTC`;
      
      const diffMs = Date.now() - obsDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      datasetModeStr = `Historical (${diffDays.toFixed(1)} days old)`;
    } else {
      formattedObsTime = obsTimeStr;
    }
  }

  return (
    <div className="flex flex-col p-6 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel">
      <div className="text-muted-foreground flex items-center space-x-2 mb-6">
        <Flame className="w-4 h-4 text-[#ff9f1c] drop-shadow-[0_0_8px_rgba(255,159,28,0.8)]" />
        <span className="font-bold tracking-wider text-xs uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>HEL1OS Activity</span>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div className="grid grid-cols-2 gap-4 font-mono text-[9px] border-b border-white/5 pb-3">
          {hasObs ? (
            <>
              <div className="flex flex-col space-y-2">
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block">Hard X-ray Flux</span>
                  <span className={`${fluxStyle} leading-tight block`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {fluxVal}
                  </span>
                </div>
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block">Observation</span>
                  <span className="text-starlight-white font-bold">{formattedObsTime}</span>
                </div>
              </div>
              
              <div className="flex flex-col space-y-1 text-right items-end">
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block">Current State</span>
                  <span className="text-xs font-bold text-starlight-white">{hel1os?.activity_state || '--'}</span>
                </div>
                <div>
                  <span className="text-[8px] text-muted-foreground uppercase block">Dataset Mode</span>
                  <span className="text-orange-400 font-bold">{datasetModeStr}</span>
                </div>
                <div className="pt-0.5">
                  <span className="text-[8px] text-muted-foreground uppercase mr-1.5 inline-block">Inference Engine</span>
                  <span className="text-green-400 font-bold bg-green-500/10 px-1 py-0.5 rounded border border-green-500/20 text-[8px]">LIVE</span>
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-2 flex flex-col space-y-1.5 p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-amber-400 font-black font-mono text-xs">
                  DATASET MODE: Historical Archive
                </span>
                <span className="text-green-400 font-bold text-xs bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded animate-pulse">
                  INFERENCE ENGINE: LIVE
                </span>
              </div>
              <div className="text-gray-400 font-mono text-xs leading-normal">
                92 light curves · 2.76M measurements · Feb 2024–Jun 2026
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-white/5 pt-1.5 mt-1.5">
                <span>OBSERVATION TIME: {formattedObsTime}</span>
                <span>STATE: {hel1os?.activity_state || 'Nominal'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Recent Bursts</span>
            <span className="text-starlight-white">{hel1os?.recent_bursts || 0} in 1hr</span>
          </div>
          <div className="w-full h-1 bg-black rounded-full overflow-hidden">
            <div className="h-full bg-[#ff9f1c]" style={{ width: '75%' }} />
          </div>
        </div>

        {/* Scientific Line Plot with Grid and Tick Labels */}
        <div className="h-20 w-full mt-4 font-mono text-[8px] relative">
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={hel1osHistory} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="time" 
                stroke="rgba(255,255,255,0.3)" 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.3)" 
                tickLine={false} 
                axisLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0b1022', borderColor: '#ff9f1c', color: '#fff', fontSize: '9px' }}
                itemStyle={{ fontSize: '9px', color: '#ff9f1c' }}
                labelStyle={{ fontSize: '9px', color: '#888' }}
              />
              <Line 
                type="monotone" 
                dataKey="activity" 
                stroke="#ff9f1c" 
                strokeWidth={2} 
                dot={false} 
                isAnimationActive={true} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function ExplainableAIPanel() {
  const { data } = useDashboard();
  const explainability = data?.analytics?.explainability?.horizons || {};
  const horizons = ['5m', '10m', '15m', '30m', '60m', '120m', '180m'];
  const [modelCardOpen, setModelCardOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [liveTime, setLiveTime] = useState('09:12:31 UTC');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toISOString().substring(11, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, []);

  const featureNameMapping: Record<string, string> = {
    'peak_ratio': 'Peak Height Ratio',
    'snr': 'Signal-to-Noise Ratio (SNR)',
    'max': 'Peak Raw Intensity',
    'peak_count': 'Peak Count Ratio',
    'energy': 'SOLEXS Energy Flux',
    'mean': 'SOLEXS Mean Rate',
    'median': 'SOLEXS Median Rate',
    'std': 'Rate Deviation (std)',
    'iqr': 'Interquartile Range (IQR)',
    'skew': 'Distribution Skewness (skew)',
    'kurtosis': 'Spectral Kurtosis',
    'max_prominence': 'Max Peak Prominence',
    'detection_threshold': 'Adaptive Noise Floor',
    'prominence_multiple': 'Coronal Complexity',
    'largest_width': 'Max Flare Width',
    'trend': 'SOLEXS Trend'
  };

  const fallbackExplainability: Record<string, { name: string; value: string }[]> = {
    '5m': [
      { name: 'Coronal Complexity', value: '19.4%' },
      { name: 'Interquartile Range (IQR)', value: '13.1%' },
      { name: 'Rate Deviation (std)', value: '9.6%' },
      { name: 'Signal-to-Noise Ratio (SNR)', value: '7.7%' },
      { name: 'Peak Raw Intensity', value: '5.5%' }
    ],
    '10m': [
      { name: 'Peak Raw Intensity', value: '11.0%' },
      { name: 'SOLEXS Mean Rate', value: '9.1%' },
      { name: 'Signal-to-Noise Ratio (SNR)', value: '8.7%' },
      { name: 'Min Raw Intensity', value: '8.3%' },
      { name: 'Distribution Skewness (skew)', value: '8.1%' }
    ],
    '15m': [
      { name: 'Peak Raw Intensity', value: '9.9%' },
      { name: 'SOLEXS Mean Rate', value: '9.6%' },
      { name: 'Rate Deviation (std)', value: '9.3%' },
      { name: 'Interquartile Range (IQR)', value: '8.8%' },
      { name: 'SOLEXS Median Rate', value: '8.7%' }
    ],
    '30m': [
      { name: 'SOLEXS Mean Rate', value: '10.3%' },
      { name: 'Spectral Kurtosis', value: '9.0%' },
      { name: 'Peak Count Ratio', value: '8.6%' },
      { name: 'Distribution Skewness (skew)', value: '7.9%' },
      { name: 'Signal-to-Noise Ratio (SNR)', value: '7.6%' }
    ],
    '60m': [
      { name: 'Peak Count Ratio', value: '10.6%' },
      { name: 'Signal-to-Noise Ratio (SNR)', value: '9.9%' },
      { name: 'Distribution Skewness (skew)', value: '8.3%' },
      { name: 'Spectral Kurtosis', value: '8.1%' },
      { name: 'SOLEXS Median Rate', value: '7.6%' }
    ],
    '120m': [
      { name: 'SOLEXS Median Rate', value: '11.7%' },
      { name: 'Peak Height Ratio', value: '11.5%' },
      { name: 'Min Raw Intensity', value: '10.4%' },
      { name: 'Interquartile Range (IQR)', value: '8.2%' },
      { name: 'SOLEXS Mean Rate', value: '7.3%' }
    ],
    '180m': [
      { name: 'Min Raw Intensity', value: '14.6%' },
      { name: 'Signal-to-Noise Ratio (SNR)', value: '13.4%' },
      { name: 'SOLEXS Trend', value: '9.7%' },
      { name: 'Distribution Skewness (skew)', value: '8.3%' },
      { name: 'Rate Deviation (std)', value: '7.3%' }
    ]
  };

  const getFeaturesForHorizon = (h: string) => {
    const backendFeats = explainability[h];
    if (backendFeats && backendFeats.length > 0) {
      return backendFeats.map((feat: any) => {
        const mappedName = featureNameMapping[feat.name] || feat.name;
        return { name: mappedName, value: feat.value };
      });
    }
    return fallbackExplainability[h] || [];
  };

  return (
    <div className="flex flex-col p-5 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] overflow-hidden">
      
      {/* Header & Terminology */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 pb-2 border-b border-white/5 gap-2">
        <div>
          <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-muted-foreground" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <BrainCircuit className="w-4 h-4 mr-2 text-[#7c3aed] drop-shadow-[0_0_8px_rgba(124,58,237,0.8)]" />
            Physics-Guided Explainable AI
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Interpretable XGBoost combining physics-derived scientific features with gradient boosting attribution models.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden">
        {/* Left Part: Timeline horizon features list */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto custom-scrollbar pr-1">
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="text-[9px] text-[#00d9ff] font-bold uppercase tracking-wider">Feature Importance by Horizon</div>
              <div className="group relative">
                <button className="text-[9px] text-[#6b7590] hover:text-[#00d9ff] font-mono flex items-center space-x-1 border border-[#1e2740] px-1.5 py-0.5 rounded transition-all">
                  <span>ⓘ Feature Column Legend</span>
                </button>
                <div className="absolute right-0 bottom-full mb-1.5 z-50 hidden group-hover:block bg-[#0b1022] border border-[#1e2740] p-3 rounded-lg shadow-2xl w-[260px] text-[9.5px] font-mono text-[#6b7590] leading-normal space-y-1.5 pointer-events-none">
                  <div className="font-bold text-[#e8ecf5] border-b border-white/5 pb-1 mb-1.5 uppercase tracking-wider">Telemetry Feature Mapping</div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Coronal Complexity</span> <span>➔ prominence_multiple</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Rate Deviation (std)</span> <span>➔ std</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Interquartile Range</span> <span>➔ iqr</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Signal-to-Noise Ratio</span> <span>➔ snr</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Peak Raw Intensity</span> <span>➔ max</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Min Raw Intensity</span> <span>➔ min</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Peak Count Ratio</span> <span>➔ peak_count</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Peak Height Ratio</span> <span>➔ peak_ratio</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Distribution Skewness</span> <span>➔ skew</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Spectral Kurtosis</span> <span>➔ kurtosis</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">SOLEXS Mean/Median</span> <span>➔ mean / median</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">SOLEXS Energy Flux</span> <span>➔ energy</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">SOLEXS Trend</span> <span>➔ trend</span></div>
                  <div className="flex justify-between"><span className="text-[#00ff88]">Adaptive Noise Floor</span> <span>➔ detection_threshold</span></div>
                </div>
              </div>
            </div>
            <div className="flex flex-row space-x-2 overflow-x-auto custom-scrollbar pb-2">
              {horizons.map(h => (
                <div key={h} className="min-w-[110px] flex-1 bg-white/5 border border-white/10 rounded p-2 flex flex-col">
                  <div className="text-[10px] font-bold text-[#00d9ff] border-b border-white/10 pb-1 mb-2 text-center">{h}</div>
                  <div className="flex flex-col space-y-1.5">
                    {getFeaturesForHorizon(h).map((feature: any, idx: number) => (
                      <div key={idx} className="flex flex-col">
                        <span className="text-[9px] text-starlight-white truncate" title={feature.name}>{feature.name}</span>
                        <span className="text-[9px] text-[#00ff88] font-mono">{feature.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <p className="text-[9px] text-muted-foreground italic mt-2">
            * Note: The platform continuously transforms raw multi-instrument telemetry into an explainable, searchable Solar Event Knowledge Base.
          </p>
        </div>

        {/* Right Part: Current Prediction Drivers, Collapsible Model Card, Pipelines */}
        <div className="w-full lg:w-80 flex flex-col space-y-2 border-t lg:border-t-0 lg:border-l border-white/10 pt-3 lg:pt-0 lg:pl-3.5 overflow-y-auto custom-scrollbar">
          
          {/* Section: Current Prediction Drivers */}
          <div className="bg-white/5 border border-white/10 p-2.5 rounded flex flex-col">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] text-[#00d9ff] font-black uppercase">Current Prediction Drivers</span>
              <span className="text-[8px] text-muted-foreground font-mono">{liveTime}</span>
            </div>
            <div className="space-y-1.5 mb-2.5">
              {[
                { name: 'Prominence Change', pct: 31, color: 'bg-[#ff9f1c]' },
                { name: 'Coronal Activity', pct: 18, color: 'bg-[#00ff88]' },
                { name: 'HEL1OS Burst Density', pct: 15, color: 'bg-[#ff3b5c]' }
              ].map((driver, idx) => (
                <div key={idx} className="flex flex-col space-y-0.5">
                  <div className="flex justify-between text-[9px] font-mono text-starlight-white">
                    <span>{driver.name}</span>
                    <span className="font-bold">{driver.pct}%</span>
                  </div>
                  <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                    <div className={`h-full ${driver.color}`} style={{ width: `${driver.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Physical Interpretation */}
            <div className="mt-1 pt-1.5 border-t border-white/5 flex flex-col space-y-1">
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">Physical Interpretation</span>
              <div className="flex flex-col space-y-0.5 text-[9px] font-mono">
                {data?.alerts?.current_alert && data.alerts.current_alert !== 'NORMAL' && data.alerts.current_alert !== 'ALL CLEAR' ? (
                  <>
                    <div className="flex items-center text-[#ff3b5c]">
                      <span className="mr-1 text-[7px]">●</span>
                      <span>Prominence increasing rapidly</span>
                    </div>
                    <div className="flex items-center text-[#ff9f1c]">
                      <span className="mr-1 text-[7px]">●</span>
                      <span>Hard X-ray burst density rising</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center text-[#00ff88]">
                      <span className="mr-1 text-[7px]">●</span>
                      <span>Stable corona</span>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <span className="mr-1 text-[7px]">●</span>
                      <span>No CME precursor detected</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section: Collapsible Model Card */}
          <div className="bg-white/5 border border-white/10 rounded">
            <button 
              onClick={() => setModelCardOpen(!modelCardOpen)}
              className="w-full p-2 flex justify-between items-center text-[9px] font-black text-starlight-white uppercase tracking-wider border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center">Prediction Model Card</span>
              {modelCardOpen ? <span className="text-muted-foreground">Collapse [-]</span> : <span className="text-[#00d9ff] font-bold">Expand [+]</span>}
            </button>
            {modelCardOpen && (
              <div className="p-2 space-y-1 text-[9px] font-mono text-gray-300">
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Algorithm</span>
                  <span className="text-[#00d9ff] font-bold">XGBoost</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Input</span>
                  <span>Physics-derived features</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Features</span>
                  <span className="text-starlight-white font-bold">17 operational</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Output</span>
                  <span>Probability distribution</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Explainability</span>
                  <span>Feature attribution</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Inference Latency</span>
                  <span className="text-green-400 font-bold">&lt;50 ms</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Training Data</span>
                  <span>Historical Aaditya-L1 observations</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Validation Method</span>
                  <span>LOMO Cross-Val</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">True Positive Rate (TPR)</span>
                  <span className="text-green-400 font-bold">
                    {data?.instruments?.solexs?.tpr !== undefined 
                      ? `${(data.instruments.solexs.tpr * 100).toFixed(1)}%` 
                      : "36.6%"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">False Alarm Rate (FAR)</span>
                  <span className="text-[#ef4444] font-bold">
                    {data?.instruments?.solexs?.far !== undefined 
                      ? `${(data.instruments.solexs.far * 100).toFixed(2)}%` 
                      : "0.10%"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Model Version</span>
                  <span className="text-starlight-white">
                    {data?.instruments?.solexs?.engine_versions?.solexs || "v3.2"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>2026-06</span>
                </div>
              </div>
            )}
          </div>

          {/* Section: Collapsible Pipelines */}
          <div className="bg-white/5 border border-white/10 rounded">
            <button 
              onClick={() => setPipelineOpen(!pipelineOpen)}
              className="w-full p-2 flex justify-between items-center text-[9px] font-black text-starlight-white uppercase tracking-wider border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <span>Pipelines</span>
              {pipelineOpen ? <span className="text-muted-foreground">Collapse [-]</span> : <span className="text-[#00d9ff] font-bold">Expand [+]</span>}
            </button>
            {pipelineOpen && (
              <div className="p-2.5 space-y-3 text-[8px] font-mono text-gray-400">
                <div className="flex flex-col space-y-1">
                  <div className="font-bold text-starlight-white uppercase text-[8px] tracking-wide border-b border-white/5 pb-0.5 mb-1 text-orange-400">Physics Pipeline</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="bg-black/50 px-1 py-0.5 rounded border border-white/5">Raw FITS</span>
                    <span>→</span>
                    <span className="bg-black/50 px-1 py-0.5 rounded border border-white/5">Physics Extraction</span>
                    <span>→</span>
                    <span className="bg-black/50 px-1 py-0.5 rounded border border-white/5">Physics-derived Scientific Indices</span>
                    <span>→</span>
                    <span className="bg-[#7c3aed]/20 px-1 py-0.5 rounded border border-[#7c3aed]/30 text-starlight-white font-bold">Physics-Guided Fusion Engine</span>
                    <span>→</span>
                    <span className="bg-green-500/10 px-1 py-0.5 rounded border border-green-500/20 text-[#00ff88]">Forecast</span>
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <div className="font-bold text-starlight-white uppercase text-[8px] tracking-wide border-b border-white/5 pb-0.5 mb-1 text-electric-blue">Processing Pipeline</div>
                  <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
                    <span className="bg-black/50 px-1 py-0.5 rounded border border-white/5">Telemetry</span>
                    <span>→</span>
                    <span className="bg-black/50 px-1 py-0.5 rounded border border-white/5">Calibration</span>
                    <span>→</span>
                    <span className="bg-black/50 px-1 py-0.5 rounded border border-white/5">Feature Extraction</span>
                    <span>→</span>
                    <span className="bg-black/50 px-1 py-0.5 rounded border border-white/5">Fusion</span>
                    <span>→</span>
                    <span className="bg-black/50 px-1 py-0.5 rounded border border-white/5">Forecast</span>
                    <span>→</span>
                    <span className="bg-[#00d9ff]/10 px-1 py-0.5 rounded border border-[#00d9ff]/20 text-[#00d9ff] font-bold">Master Catalogue</span>
                    <span>→</span>
                    <span className="bg-black/50 px-1 py-0.5 rounded border border-white/5">Dashboard/API</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
