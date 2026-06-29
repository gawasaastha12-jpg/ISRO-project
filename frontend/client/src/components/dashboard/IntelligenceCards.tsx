import React from 'react';
import { Waves, Flame, Scan, BrainCircuit } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { generateLightcurveData } from '../../lib/mock-data';

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
  // Generate some random data for sparklines
  const solexsData = generateLightcurveData().slice(-20);
  const hel1osData = generateLightcurveData().slice(-20);
  const velcData = generateLightcurveData().slice(-20);

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
            <span className="text-xl font-bold text-yellow-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>B-Class</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Trend</span>
            <span className="text-sm font-bold text-green-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rising ↑</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Peaks detected</span>
            <span className="text-sm font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>3 in last 1hr</span>
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
            <span className="text-xl font-bold text-orange-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>High</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Flux State</span>
            <span className="text-sm font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Hard</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Delta (5m)</span>
            <span className="text-sm font-bold text-red-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>+2.4σ</span>
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
            <span className="text-sm text-muted-foreground">Coronal State</span>
            <span className="text-xl font-bold text-yellow-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Active</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Novelty Score</span>
            <span className="text-sm font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>84/100</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Structures</span>
            <span className="text-sm font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>2 Loops detected</span>
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
            <span className="text-sm text-muted-foreground">Confidence</span>
            <span className="text-xl font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>67.9%</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Risk</span>
            <span className="text-sm font-bold text-yellow-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Elevated</span>
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-sm text-muted-foreground">Bayesian Fusion</span>
            <span className="text-sm font-bold text-green-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Converged</span>
          </div>
        </div>

        {/* Confidence Meter */}
        <div className="w-full h-2 bg-black rounded-full mt-6 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" style={{ width: '67.9%' }} />
        </div>
      </div>
    </div>
  );
}
