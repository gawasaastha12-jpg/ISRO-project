import React, { useEffect, useState } from 'react';
import { BrainCircuit, Flame, Activity } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';

export function HeliosActivityPanel() {
  const { data } = useDashboard();
  const hel1os = data?.instruments?.hel1os;
  const hel1osData = [{ flux: hel1os?.flux || 0 }, { flux: hel1os?.flux || 0 }];

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
            <span className="text-2xl font-black text-[#ff9f1c]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{hel1os?.flux?.toExponential(1) || '0.0e0'}</span>
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

  return (
    <div className="flex flex-col p-6 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-muted-foreground" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <BrainCircuit className="w-4 h-4 mr-2 text-[#7c3aed] drop-shadow-[0_0_8px_rgba(124,58,237,0.8)]" />
          Explainable AI (Top Features by Horizon)
        </h3>
      </div>

      <div className="flex flex-row space-x-2 overflow-x-auto custom-scrollbar pb-2">
        {horizons.map(h => (
          <div key={h} className="min-w-[120px] flex-1 bg-white/5 border border-white/10 rounded p-2 flex flex-col">
            <div className="text-[10px] font-bold text-[#00d9ff] border-b border-white/10 pb-1 mb-2 text-center">{h}</div>
            <div className="flex flex-col space-y-2">
              {(explainability[h] || []).map((feature: any, idx: number) => (
                <div key={idx} className="flex flex-col">
                  <span className="text-[9px] text-starlight-white truncate" title={feature.name}>{feature.name}</span>
                  <span className="text-[10px] text-[#00ff88]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{feature.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
