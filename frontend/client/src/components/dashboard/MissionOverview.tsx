import React, { useState } from 'react';
import { Shield, BrainCircuit, Activity, ChevronRight, Zap, Target, Combine } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ResponsiveContainer, LineChart, Line, YAxis, Tooltip, XAxis } from 'recharts';

export function LiveFlareGauge() {
  const { data } = useDashboard();
  const rawProb = data?.instruments?.solexs?.forecast_confidence ?? data?.instruments?.solexs?.confidence ?? data?.instruments?.solexs?.probability ?? 0;
  const probability = rawProb <= 1.0 ? rawProb * 100 : rawProb;
  const uncertainty = 100 - probability;

  const fusionRaw = data?.analytics?.fusion?.forecast_confidence ?? data?.analytics?.fusion?.confidence ?? data?.analytics?.fusion?.probability ?? 0;
  const fusionProb = fusionRaw <= 1.0 ? fusionRaw * 100 : fusionRaw;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const dashoffset = arcLength - (probability / 100) * arcLength;

  const getColor = (prob: number) => {
    if (prob < 40) return 'text-gray-400';
    if (prob < 60) return 'text-[#00d9ff]';
    if (prob < 80) return 'text-[#ff9f1c]';
    return 'text-[#ff3b5c]';
  };

  const getInterpretation = (prob: number) => {
    if (prob >= 80) return { label: 'High Confidence', color: 'bg-[#ff3b5c]/10 text-[#ff3b5c] border-[#ff3b5c]/30' };
    if (prob >= 60) return { label: 'Moderate Confidence', color: 'bg-[#ff9f1c]/10 text-[#ff9f1c] border-[#ff9f1c]/30' };
    if (prob >= 40) return { label: 'Low-Moderate', color: 'bg-[#00d9ff]/10 text-[#00d9ff] border-[#00d9ff]/30' };
    return { label: 'Low Confidence', color: 'bg-white/5 text-gray-400 border-white/10' };
  };

  const interp = getInterpretation(probability);

  // FSI Interpretation:
  const fsi = data?.instruments?.solexs?.forecast_severity_index ?? data?.instruments?.solexs?.expected_severity ?? 0;
  let fsiLabel = "Quiet expected activity";
  if (fsi >= 3.5) fsiLabel = "X-class expected activity";
  else if (fsi >= 2.5) fsiLabel = "M-class expected activity";
  else if (fsi >= 1.5) fsiLabel = "C-class expected activity";
  else if (fsi >= 0.5) fsiLabel = "B-class expected activity";

  // Evolution rate:
  const rate = data?.instruments?.solexs?.forecast_evolution_rate ?? data?.instruments?.solexs?.trend_slope ?? 0;
  const trajectory = data?.instruments?.solexs?.trajectory ?? "Stable";
  const trajSymbol = trajectory === "Escalating" ? "▲" : trajectory === "Decaying" ? "▼" : "→";
  const trajColor = trajectory === "Escalating" ? "text-[#ff3b5c]" : trajectory === "Decaying" ? "text-[#00ff88]" : "text-gray-400";

  return (
    <div className="flex flex-col p-5 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)]">
      <div className="absolute top-4 left-4 text-muted-foreground flex items-center space-x-2">
        <Shield className="w-4 h-4 text-[#00d9ff]" />
        <span className="font-bold tracking-wider text-xs uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>Live Flare Monitor</span>
      </div>

      {/* Confidence Interpretation Badge */}
      <div className="absolute top-4 right-4">
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${interp.color}`}>
          {interp.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center mt-6">
        {/* Gauge display */}
        <div className="relative flex items-center justify-center">
          <svg className="w-40 h-40 transform -rotate-135" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/5" strokeDasharray={`${arcLength} ${circumference}`} strokeLinecap="round" />
            <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className={`${getColor(probability)} transition-all duration-1000 ease-out`} strokeDasharray={`${arcLength} ${circumference}`} strokeDashoffset={dashoffset} strokeLinecap="round" />
          </svg>
          <div className="absolute flex flex-col items-center justify-center mt-2">
            <span className={`text-3xl font-black ${getColor(probability)}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {probability.toFixed(1)}%
            </span>
            <span className="text-[8px] text-muted-foreground uppercase tracking-widest mt-1 font-black">Forecast Prob</span>
          </div>
        </div>

        {/* Probability & Uncertainty & Fusion KPIs */}
        <div className="flex flex-col space-y-2 justify-center font-mono">
          <div className="bg-white/5 p-2 rounded border border-white/10 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[8px] text-muted-foreground uppercase">Forecast Prob</span>
              <span className={`text-xs font-black ${getColor(probability)}`}>{probability.toFixed(1)}%</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[8px] text-muted-foreground uppercase">Uncertainty</span>
              <span className="text-xs font-bold text-gray-400">{uncertainty.toFixed(1)}%</span>
            </div>
          </div>
          
          <div className="bg-[#00d9ff]/5 p-2 rounded border border-[#00d9ff]/20 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[8px] text-muted-foreground uppercase">Fusion Confidence</span>
              <span className="text-xs font-black text-[#00d9ff]">{fusionProb.toFixed(1)}%</span>
            </div>
            <div className="text-[9px] text-[#00d9ff] font-bold uppercase">Bayesian</div>
          </div>
        </div>
      </div>

      {/* FSI & Evolution Telemetry */}
      <div className="mt-4 w-full pt-3 border-t border-white/10 grid grid-cols-2 gap-4 text-xs font-mono">
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground uppercase">Forecast Severity Index</span>
          <div className="flex items-baseline space-x-1 mt-0.5">
            <span className="text-sm font-bold text-[#ff9f1c]">{fsi.toFixed(2)}</span>
            <span className="text-[9px] text-muted-foreground">/ 4.00</span>
          </div>
          <span className="text-[8px] text-muted-foreground mt-0.5 italic">{fsiLabel}</span>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="text-[8px] text-muted-foreground uppercase">Trajectory</span>
          <span className={`text-sm font-bold flex items-center space-x-1 ${trajColor}`}>
            <span>{trajectory}</span>
            <span className="ml-1 text-xs">{trajSymbol}</span>
          </span>
          <span className="text-[8px] text-muted-foreground mt-0.5">
            {rate >= 0 ? '+' : ''}{rate.toFixed(5)} FSI/min
          </span>
        </div>
      </div>
    </div>
  );
}

export function ForecastTimeline() {
  const { data } = useDashboard();
  const [hoveredHorizon, setHoveredHorizon] = useState<string | null>(null);

  const forecastData = data?.instruments?.solexs?.multi_horizon || [];

  const getClassColor = (c: string) => {
    const clean = c.replace(/-like/gi, '');
    switch (clean) {
      case 'Quiet': return 'text-[#00ff88]';
      case 'B': return 'text-[#00d9ff]';
      case 'C': return 'text-[#ff9f1c]';
      case 'M': return 'text-[#ff3b5c]';
      case 'X': return 'text-[#7c3aed]';
      default: return 'text-gray-400';
    }
  };

  const getClassBorder = (c: string) => {
    const clean = c.replace(/-like/gi, '');
    switch (clean) {
      case 'Quiet': return 'border-[#00ff88]/20 bg-[#00ff88]/5 shadow-[0_0_15px_rgba(0,255,136,0.05)]';
      case 'B': return 'border-[#00d9ff]/20 bg-[#00d9ff]/5 shadow-[0_0_15px_rgba(0,217,255,0.05)]';
      case 'C': return 'border-[#ff9f1c]/20 bg-[#ff9f1c]/5 shadow-[0_0_15px_rgba(255,159,28,0.05)]';
      case 'M': return 'border-[#ff3b5c]/20 bg-[#ff3b5c]/5 shadow-[0_0_15px_rgba(255,59,92,0.05)]';
      case 'X': return 'border-[#7c3aed]/20 bg-[#7c3aed]/5 shadow-[0_0_15px_rgba(124,58,237,0.05)]';
      default: return 'border-white/10 bg-white/5';
    }
  };

  const getBarColor = (key: string) => {
    switch (key) {
      case 'quiet': return 'bg-[#00ff88]';
      case 'B': return 'bg-[#00d9ff]';
      case 'C': return 'bg-[#ff9f1c]';
      case 'M': return 'bg-[#ff3b5c]';
      case 'X': return 'bg-[#7c3aed]';
      default: return 'bg-gray-500';
    }
  };

  const getProbVal = (probObj: any, key: string) => {
    if (!probObj) return 0;
    const v = probObj[key] ?? probObj[`${key}-like`] ?? probObj[key.toLowerCase()] ?? 0;
    return v <= 1.0 ? v * 100 : v;
  };

  const evolutionData = forecastData.map((f: any) => {
    const probObj = f.probabilities ?? f.prob;
    return {
      name: f.horizon,
      Quiet: getProbVal(probObj, 'Quiet'),
      B: getProbVal(probObj, 'B'),
      C: getProbVal(probObj, 'C'),
      M: getProbVal(probObj, 'M'),
      X: getProbVal(probObj, 'X')
    };
  });

  return (
    <div className="flex flex-col p-4 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] overflow-visible">
      <div className="flex justify-between items-center mb-2">
        <div className="text-muted-foreground flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#00d9ff]" />
          <span className="font-bold tracking-wider text-xs uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>Forecast Evolution Timeline</span>
        </div>
      </div>

      {/* Forecast Evolution Graph */}
      <div className="h-28 w-full mt-2 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={evolutionData}>
            <YAxis domain={[0, 100]} hide />
            <XAxis dataKey="name" hide />
            <Tooltip
              contentStyle={{ backgroundColor: '#0b1022', borderColor: '#00d9ff', color: '#fff', fontSize: '10px' }}
              itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
            />
            <Line type="monotone" dataKey="Quiet" stroke="#00ff88" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={true} />
            <Line type="monotone" dataKey="B" stroke="#00d9ff" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={true} />
            <Line type="monotone" dataKey="C" stroke="#ff9f1c" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={true} />
            <Line type="monotone" dataKey="M" stroke="#ff3b5c" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={true} />
            <Line type="monotone" dataKey="X" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={true} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-row items-center justify-between mt-2 relative pb-2 w-full px-2">
        {/* Background Line */}
        <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-[#00d9ff]/10 -translate-y-1/2 z-0" />

        {forecastData.map((forecast: any, i: number) => {
          const currentClass = forecast.forecast || forecast.prediction || forecast.class || '';
          const cleanClass = currentClass.replace(/-like/gi, '');
          const displayClass = cleanClass === 'Quiet' ? 'Quiet' : `${cleanClass}-like`;
          
          const currentProb = forecast.forecast_confidence ?? forecast.confidence ?? forecast.probability ?? 0;
          const currentProbPct = currentProb <= 1.0 ? currentProb * 100 : currentProb;
          
          let trend = "→";
          let trendColor = "text-gray-400";
          if (i > 0) {
            const prevProb = forecastData[i - 1].forecast_confidence ?? forecastData[i - 1].confidence ?? forecastData[i - 1].probability ?? 0;
            const prevProbPct = prevProb <= 1.0 ? prevProb * 100 : prevProb;
            if (currentProbPct > prevProbPct + 5) { trend = "▲"; trendColor = "text-[#ff3b5c]"; }
            else if (currentProbPct < prevProbPct - 5) { trend = "▼"; trendColor = "text-[#00ff88]"; }
          } else {
            trend = "▲"; trendColor = "text-[#ff3b5c]";
          }

          const getProbColor = (prob: number) => {
            if (prob < 40) return 'text-gray-400';
            if (prob < 60) return 'text-[#eab308]'; // Yellow
            if (prob < 80) return 'text-[#f97316]'; // Orange
            return 'text-[#ef4444]'; // Red
          };

          const probObj = forecast.probabilities ?? forecast.prob;

          return (
            <React.Fragment key={forecast.horizon}>
              <div
                className={`flex flex-col items-center z-10 relative group px-3 py-2 rounded-lg border transition-all duration-300 ${getClassBorder(cleanClass)}`}
              >
                {/* Clean hover tooltip showing full probability distribution */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-[#0b1022] border border-[#00d9ff]/30 p-2 rounded shadow-2xl text-[9px] text-white font-mono space-y-0.5 z-50 w-28 text-left">
                  <div className="text-[8px] font-bold text-muted-foreground uppercase pb-0.5 border-b border-white/10 mb-1">
                    Distribution
                  </div>
                  <div className="flex justify-between">
                    <span>Quiet:</span>
                    <span className="font-bold text-[#00ff88]">{getProbVal(probObj, 'Quiet').toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>B-like:</span>
                    <span className="font-bold text-[#00d9ff]">{getProbVal(probObj, 'B').toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>C-like:</span>
                    <span className="font-bold text-[#ff9f1c]">{getProbVal(probObj, 'C').toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>M-like:</span>
                    <span className="font-bold text-[#ff3b5c]">{getProbVal(probObj, 'M').toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>X-like:</span>
                    <span className="font-bold text-[#7c3aed]">{getProbVal(probObj, 'X').toFixed(0)}%</span>
                  </div>
                </div>

                <div className="text-[9px] text-muted-foreground font-bold mb-1 uppercase tracking-wide">
                  {forecast.horizon === 'NOW' ? 'NOW' : forecast.horizon.replace('m', ' min')}
                </div>
                
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-muted-foreground uppercase font-medium">Forecast</span>
                  <span className={`text-[11px] font-black ${getClassColor(cleanClass)}`}>
                    {displayClass}
                  </span>
                </div>

                <div className="flex flex-col items-center mt-1">
                  <span className="text-[8px] text-muted-foreground uppercase font-medium">Probability</span>
                  <span className={`text-[10px] font-mono font-bold ${getProbColor(currentProbPct)}`}>
                    {currentProbPct.toFixed(1)}%
                  </span>
                </div>
                
                <div className={`text-[9px] mt-1 ${trendColor}`}>{trend}</div>
              </div>
              {i < forecastData.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 z-10 shrink-0" />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  );
}

export function FusionDecisionCard() {
  const { data } = useDashboard();
  const solexsPred = data?.instruments?.solexs?.forecast || '--';
  const hel1osAct = data?.instruments?.hel1os?.activity_state || '--';
  const velcAct = data?.instruments?.velc?.activity_index > 5 ? 'Active' : 'Nominal';
  const fusionRisk = data?.analytics?.fusion?.alert_level || 'UNKNOWN';
  const rawConf = data?.analytics?.fusion?.forecast_confidence ?? data?.analytics?.fusion?.confidence ?? 0;
  const fusionConf = rawConf <= 1.0 ? rawConf * 100 : rawConf;

  const solarState = fusionRisk === 'SEVERE' || fusionRisk === 'ALERT' || fusionRisk === 'WARNING' ? 'ACTIVE' : 'NOMINAL';
  const stateColor = solarState === 'ACTIVE' ? 'text-[#ff3b5c]' : 'text-[#00ff88]';

  return (
    <div className="flex flex-col p-4 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] overflow-hidden">
      <div className="text-muted-foreground flex items-center space-x-2 mb-3">
        <Combine className="w-4 h-4 text-[#7c3aed] drop-shadow-[0_0_8px_rgba(124,58,237,0.8)]" />
        <span className="font-bold tracking-wider text-xs uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>Fusion Oracle Summary</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 bg-white/5 p-2 rounded border border-white/5 text-center font-mono">
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground uppercase">Solar Situation</span>
          <span className={`text-xs font-black ${stateColor}`}>{solarState}</span>
        </div>
        <div className="flex flex-col border-l border-white/10">
          <span className="text-[8px] text-muted-foreground uppercase">Fusion Confidence</span>
          <span className="text-xs font-black text-starlight-white">{fusionConf.toFixed(0)}%</span>
        </div>
      </div>

      {/* Narrative Evidence & Forecast */}
      <div className="space-y-2 flex-1 text-[10px] overflow-y-auto custom-scrollbar pr-1">
        <div className="flex flex-col space-y-0.5">
          <span className="text-[8px] text-muted-foreground uppercase font-black">Fusion Evidence</span>
          <ul className="list-disc list-inside text-gray-300 space-y-0.5 pl-0.5">
            <li>SOLEXS: {solexsPred === 'Quiet' ? 'Background nominal' : 'Flare activity detected'}</li>
            <li>HEL1OS: {hel1osAct === 'Active' || hel1osAct === 'ACTIVE' ? 'Burst density confirmed' : 'Background energy levels'}</li>
            <li>VELC: {velcAct === 'Active' ? 'Coronal anomaly detected' : 'Quiet corona'}</li>
          </ul>
        </div>

        <div className="flex flex-col space-y-0.5">
          <span className="text-[8px] text-muted-foreground uppercase font-black">Forecast Statement</span>
          <p className="text-orange-400 font-bold leading-tight">
            {solarState === 'ACTIVE' 
              ? "Elevated flare probability within 30 minutes"
              : "Solar activity expected to remain quiet/low-risk"}
          </p>
        </div>

        {/* Dynamic Causal Story Timeline */}
        <div className="flex flex-col mt-2 pt-2 border-t border-white/5">
          <span className="text-[8px] text-muted-foreground uppercase font-black mb-1">Causal Sequence</span>
          <div className="flex flex-col space-y-1 font-mono text-[9px] text-gray-400 relative pl-3.5">
            <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-[#7c3aed]/30" />
            
            <div className="flex items-center space-x-1 relative">
              <div className="absolute -left-[14px] w-1.5 h-1.5 rounded-full bg-[#00d9ff] border border-[#0b1022]" />
              <span className="font-bold text-starlight-white">09:12</span>
              <span>SOLEXS spike</span>
            </div>
            <div className="flex items-center space-x-1 relative">
              <div className="absolute -left-[14px] w-1.5 h-1.5 rounded-full bg-[#ff9f1c] border border-[#0b1022]" />
              <span className="font-bold text-starlight-white">09:14</span>
              <span>HEL1OS burst</span>
            </div>
            <div className="flex items-center space-x-1 relative">
              <div className="absolute -left-[14px] w-1.5 h-1.5 rounded-full bg-[#00ff88] border border-[#0b1022]" />
              <span className="font-bold text-starlight-white">09:17</span>
              <span>VELC anomaly</span>
            </div>
            <div className="flex items-center space-x-1 relative">
              <div className="absolute -left-[14px] w-1.5 h-1.5 rounded-full bg-[#7c3aed] border border-[#0b1022]" />
              <span className="font-bold text-starlight-white">09:20</span>
              <span className="text-[#00ff88] font-bold">Fusion Alert</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
