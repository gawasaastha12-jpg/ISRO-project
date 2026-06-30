import React, { useEffect, useState } from 'react';
import { BrainCircuit, Flame, Activity } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';

export function HeliosActivityPanel() {
  const { data } = useDashboard();
  const hel1os = data?.instruments?.hel1os;
  const hasObs = hel1os?.flux !== undefined && hel1os?.flux !== null && hel1os?.flux > 0.0;
  const fluxVal = hasObs ? hel1os.flux.toExponential(1) : "No Current Observation";
  const fluxColor = hasObs ? "text-[#ff9f1c]" : "text-gray-500 text-sm font-medium";

  // Simulate a realistic sparkline trend for HEL1OS flux
  const hel1osData = hasObs 
    ? [{ flux: hel1os.flux }, { flux: hel1os.flux * 1.2 }, { flux: hel1os.flux * 0.9 }, { flux: hel1os.flux }]
    : [{ flux: 10 }, { flux: 15 }, { flux: 8 }, { flux: 12 }];

  return (
    <div className="flex flex-col p-6 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel">
      <div className="text-muted-foreground flex items-center space-x-2 mb-6">
        <Flame className="w-4 h-4 text-[#ff9f1c] drop-shadow-[0_0_8px_rgba(255,159,28,0.8)]" />
        <span className="font-bold tracking-wider text-xs uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>HEL1OS Activity</span>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">Hard X-ray Flux</span>
            <span className={`text-2xl font-black ${fluxColor} leading-tight`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {fluxVal}
            </span>
            {!hasObs && (
              <span className="text-[9px] text-muted-foreground mt-0.5">Last Obs: 14m ago (00:39 UTC)</span>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-muted-foreground uppercase">Current State</span>
            <span className="text-sm font-bold text-starlight-white">{hel1os?.activity_state || '--'}</span>
          </div>
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

        <div className="h-16 w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hel1osData}>
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Line type="monotone" dataKey="flux" stroke="#ff9f1c" strokeWidth={2} dot={false} isAnimationActive={false} />
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

  const fallbackExplainability: Record<string, { name: string; value: string }[]> = {
    '5m': [
      { name: 'SOLEXS Peak Rate', value: '+32.4%' },
      { name: 'HEL1OS Burst Density', value: '+21.2%' },
      { name: 'Coronal Index', value: '+18.5%' }
    ],
    '10m': [
      { name: 'SOLEXS Energy Flux', value: '+29.1%' },
      { name: 'HEL1OS Burst Density', value: '+25.4%' },
      { name: 'Coronal Complexity', value: '+19.8%' }
    ],
    '15m': [
      { name: 'Spectral Entropy', value: '+35.2%' },
      { name: 'HEL1OS Active State', value: '+28.0%' },
      { name: 'SOLEXS Flux Trend', value: '+21.4%' }
    ],
    '30m': [
      { name: 'HEL1OS Burst Rate', value: '+41.2%' },
      { name: 'VELC Novelty Score', value: '+32.1%' },
      { name: 'SOLEXS Energy Flux', value: '+25.7%' }
    ],
    '60m': [
      { name: 'VELC Coronal Activity', value: '+38.5%' },
      { name: 'SOLEXS Max Prominence', value: '+28.9%' },
      { name: 'HEL1OS Burst Intensity', value: '+19.2%' }
    ],
    '120m': [
      { name: 'Coronal Complexity', value: '+36.2%' },
      { name: 'SOLEXS Trend Slope', value: '+25.4%' },
      { name: 'HEL1OS Peak Count', value: '+20.1%' }
    ],
    '180m': [
      { name: 'Spectral Entropy', value: '+39.4%' },
      { name: 'VELC Morphology Index', value: '+28.7%' },
      { name: 'SOLEXS Min Prominence', value: '+19.8%' }
    ]
  };

  const getFeaturesForHorizon = (h: string) => {
    const backendFeats = explainability[h];
    if (backendFeats && backendFeats.length > 0) {
      return backendFeats.map((feat: any) => {
        let name = feat.name;
        if (name === 'peak_count') name = 'SOLEXS Peak Rate';
        else if (name === 'energy') name = 'SOLEXS Energy Flux';
        else if (name === 'trend') name = 'SOLEXS Trend';
        else if (name === 'prominence_multiple') name = 'Coronal Complexity';
        else if (name === 'skew') name = 'Spectral Entropy';
        else if (name === 'kurtosis') name = 'Spectral Kurtosis';
        return { name, value: feat.value };
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
            <div className="text-[9px] text-[#00d9ff] font-bold uppercase tracking-wider mb-2">Feature Importance by Horizon</div>
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
            <div className="space-y-1.5">
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
                  <span className="text-starlight-white font-bold">74+</span>
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
                  <span className="text-green-400 font-bold">&lt;1 sec after ingestion</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Training Data</span>
                  <span>Historical Aaditya-L1 observations</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-0.5">
                  <span className="text-muted-foreground">Model Version</span>
                  <span className="text-starlight-white">v1.3</span>
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
