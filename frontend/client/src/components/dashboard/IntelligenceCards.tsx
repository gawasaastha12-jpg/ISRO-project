import React from 'react';
import { Waves, Flame, Scan, BrainCircuit } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { useDashboard } from '../../contexts/DashboardContext';

// Small sparkline component for trends
const Sparkline = ({ data, color }: { data: any[], color: string }) => (
  <div className="h-10 w-full mt-2">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Line type="monotone" dataKey="flux" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export function IntelligenceCards() {
  const { data } = useDashboard();
  
  const solexs = data?.instruments?.solexs || {};
  const hel1os = data?.instruments?.hel1os || {};
  const velc = data?.instruments?.velc || {};
  const fusion = data?.analytics?.fusion || {};

  // For sparklines we use the scalar current value just to render a flat line since history isn't fetched
  const rawSolexsProb = solexs.forecast_confidence ?? solexs.confidence ?? solexs.probability ?? 0;
  const solexsProbPct = rawSolexsProb <= 1.0 ? rawSolexsProb * 100 : rawSolexsProb;
  const solexsData = [{ flux: solexsProbPct }, { flux: solexsProbPct }];
  const hel1osData = [{ flux: hel1os.activity_score || 0 }, { flux: hel1os.activity_score || 0 }];
  const velcData = [{ flux: velc.novelty_score || 0 }, { flux: velc.novelty_score || 0 }];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
      {/* SOLEXS Card */}
      <div className="bg-cosmic-navy/50 border border-electric-blue/30 rounded-lg p-4 relative overflow-hidden group hover:border-electric-blue transition-colors">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2 text-electric-blue">
            <Waves className="w-5 h-5" />
            <h3 className="font-bold tracking-wide uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>SOLEXS</h3>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase">Solar X-ray Monitor</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Forecast</span>
            <span className="text-xl font-bold text-yellow-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{solexs.forecast || '--'}</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Trend</span>
            <span className="text-sm font-bold text-green-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{solexs.trajectory || '--'}</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Forecast Probability</span>
            <span className="text-sm font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{((solexs.forecast_confidence ?? solexs.confidence ?? 0) <= 1.0 ? (solexs.forecast_confidence ?? solexs.confidence ?? 0) * 100 : (solexs.forecast_confidence ?? solexs.confidence ?? 0)).toFixed(1)}%</span>
          </div>
        </div>
        
        <Sparkline data={solexsData} color="#00d9ff" />
      </div>

      {/* HEL1OS Card */}
      <div className="bg-cosmic-navy/50 border border-deep-purple/30 rounded-lg p-4 relative overflow-hidden group hover:border-deep-purple transition-colors">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2 text-deep-purple">
            <Flame className="w-5 h-5" />
            <h3 className="font-bold tracking-wide uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>HEL1OS</h3>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase">High Energy Monitor</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Activity</span>
            <span className="text-xl font-bold text-orange-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{hel1os.activity_score?.toFixed(1) || '0.0'}</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">State</span>
            <span className="text-sm font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{hel1os.activity_state || '--'}</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Recent Bursts</span>
            <span className="text-sm font-bold text-red-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{hel1os.recent_bursts || 0}</span>
          </div>
        </div>

        <Sparkline data={hel1osData} color="#7c3aed" />
      </div>

      {/* VELC Card */}
      <div className="bg-cosmic-navy/50 border border-supernova-gold/30 rounded-lg p-4 relative overflow-hidden group hover:border-supernova-gold transition-colors">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2 text-supernova-gold">
            <Scan className="w-5 h-5" />
            <h3 className="font-bold tracking-wide uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>VELC</h3>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase">Coronal Intelligence</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="text-xl font-bold text-yellow-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{velc.status || '--'}</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Novelty Score</span>
            <span className="text-sm font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{velc.novelty_score || '0'}</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Anomalies</span>
            <span className="text-sm font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{velc.anomaly_boxes || 0} detected</span>
          </div>
        </div>

        <Sparkline data={velcData} color="#fbbf24" />
      </div>

      {/* Mission AI Card */}
      <div className="bg-cosmic-navy/50 border border-starlight-white/30 rounded-lg p-4 relative overflow-hidden group hover:border-starlight-white transition-colors">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2 text-starlight-white">
            <BrainCircuit className="w-5 h-5" />
            <h3 className="font-bold tracking-wide uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>Mission AI</h3>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase">Decision Engine</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Fusion Confidence</span>
            <span className="text-xl font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{(((fusion.forecast_confidence ?? fusion.confidence ?? 0) <= 1.0 ? (fusion.forecast_confidence ?? fusion.confidence ?? 0) * 100 : (fusion.forecast_confidence ?? fusion.confidence ?? 0))).toFixed(1)}%</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Risk</span>
            <span className="text-sm font-bold text-yellow-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fusion.alert_level || 'NORMAL'}</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Forecast</span>
            <span className="text-sm font-bold text-green-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fusion.forecast ?? fusion.prediction ?? '--'}</span>
          </div>
        </div>

        {/* Confidence Meter */}
        <div className="w-full h-2 bg-black rounded-full mt-6 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" style={{ width: `${((fusion.forecast_confidence ?? fusion.confidence ?? 0) <= 1.0 ? (fusion.forecast_confidence ?? fusion.confidence ?? 0) * 100 : (fusion.forecast_confidence ?? fusion.confidence ?? 0))}%` }} />
        </div>
      </div>
    </div>
  );
}
