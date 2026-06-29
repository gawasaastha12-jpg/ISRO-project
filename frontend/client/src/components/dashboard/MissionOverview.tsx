import React from 'react';
import { Shield, BrainCircuit } from 'lucide-react';
import { MOCK_FLARE_PREDICTION } from '../../lib/mock-data';

export function LiveFlareGauge() {
  const probability = MOCK_FLARE_PREDICTION.probability;
  
  // Calculate stroke dasharray for the gauge
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  // It's a semi-circle (or 270 degree arc). Let's do a 270 degree arc.
  const arcLength = circumference * 0.75; 
  const dashoffset = arcLength - (probability / 100) * arcLength;

  // Determine color
  const getColor = (prob: number) => {
    if (prob < 20) return 'text-green-500';
    if (prob < 50) return 'text-blue-500';
    if (prob < 75) return 'text-yellow-500';
    if (prob < 90) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-cosmic-navy/50 border border-border/50 rounded-lg h-full relative overflow-hidden">
      <div className="absolute top-4 left-4 text-muted-foreground flex items-center space-x-2">
        <Shield className="w-4 h-4" />
        <span className="font-bold tracking-wider text-xs uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>Live Flare Gauge</span>
      </div>
      
      <div className="relative mt-4 flex items-center justify-center">
        {/* SVG Arc Gauge */}
        <svg className="w-48 h-48 transform -rotate-135" viewBox="0 0 160 160">
          {/* Background track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-gray-800"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Active track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className={`${getColor(probability)} transition-all duration-1000 ease-out`}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
          />
        </svg>
        
        {/* Center Readout */}
        <div className="absolute flex flex-col items-center justify-center mt-2">
          <span className={`text-5xl font-black ${getColor(probability)}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {probability}%
          </span>
          <span className="text-sm text-muted-foreground uppercase tracking-widest mt-1">Probability</span>
        </div>
      </div>
    </div>
  );
}

export function MissionSummary() {
  return (
    <div className="flex flex-col p-6 bg-cosmic-navy/50 border border-border/50 rounded-lg h-full relative">
      <div className="absolute top-4 left-4 text-muted-foreground flex items-center space-x-2">
        <BrainCircuit className="w-4 h-4" />
        <span className="font-bold tracking-wider text-xs uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>Mission Summary</span>
      </div>
      
      <div className="mt-8 flex flex-col space-y-4">
        <div className="flex justify-between items-center border-b border-border/30 pb-2">
          <span className="text-muted-foreground">Forecast</span>
          <span className="text-xl font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{MOCK_FLARE_PREDICTION.forecast}</span>
        </div>
        
        <div className="flex justify-between items-center border-b border-border/30 pb-2">
          <span className="text-muted-foreground">Confidence</span>
          <span className="text-lg font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{MOCK_FLARE_PREDICTION.confidence}%</span>
        </div>
        
        <div className="flex justify-between items-center border-b border-border/30 pb-2">
          <span className="text-muted-foreground">Active Alert</span>
          <span className="text-lg font-bold text-yellow-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{MOCK_FLARE_PREDICTION.alertLevel}</span>
        </div>
        
        <div className="flex flex-col space-y-1 pt-2">
          <span className="text-muted-foreground text-sm uppercase tracking-wider">Recommendation</span>
          <p className="text-sm text-electric-blue border-l-2 border-electric-blue pl-3 py-1 bg-electric-blue/5">
            {MOCK_FLARE_PREDICTION.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}
