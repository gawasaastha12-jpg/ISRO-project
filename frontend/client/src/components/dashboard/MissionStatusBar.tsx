import React, { useState, useEffect } from 'react';
import { Clock3, Timer, Orbit, Activity, Cpu, Database } from 'lucide-react';
import { MOCK_MISSION_DATA } from '../../lib/mock-data';

export default function MissionStatusBar() {
  const [utcTime, setUtcTime] = useState<string>('');
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().substring(11, 19) + ' UTC');
    };
    
    updateTime();
    const timer = setInterval(updateTime, 1000);
    
    const pulseTimer = setInterval(() => {
      setPulse(p => !p);
    }, 2000);
    
    return () => {
      clearInterval(timer);
      clearInterval(pulseTimer);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ONLINE': return 'bg-green-500';
      case 'DEGRADED': return 'bg-yellow-500';
      case 'OFFLINE': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAlertColor = (level: string) => {
    switch(level) {
      case 'ALL CLEAR': return 'bg-green-500 text-black';
      case 'WATCH': return 'bg-blue-500 text-white';
      case 'WARNING': return 'bg-yellow-500 text-black';
      case 'ALERT': return 'bg-orange-500 text-white';
      case 'SEVERE': return 'bg-red-600 text-white animate-pulse';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="flex flex-col w-full bg-cosmic-navy/80 border-b border-border/50 backdrop-blur-md sticky top-0 z-50">
      {/* Top Brand Bar */}
      <div className="flex justify-center items-center py-2 border-b border-border/30">
        <h1 className="text-xl text-starlight-white font-black tracking-widest uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          {MOCK_MISSION_DATA.missionName}
        </h1>
      </div>
      
      {/* Main Status Bar */}
      <div className="flex flex-row items-center justify-between px-4 py-2 text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        
        {/* Left: Time & Location */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-starlight-white font-bold">
            <Clock3 className="w-4 h-4 text-electric-blue" />
            <span>{utcTime}</span>
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Timer className="w-4 h-4" />
            <span>{MOCK_MISSION_DATA.missionTime}</span>
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Orbit className="w-4 h-4 text-deep-purple" />
            <span>{MOCK_MISSION_DATA.orbitPhase}</span>
          </div>
        </div>

        {/* Center: System Status */}
        <div className="flex items-center space-x-4">
          {Object.entries(MOCK_MISSION_DATA.status).map(([sys, status]) => (
            <div key={sys} className="flex items-center space-x-1.5">
              <span className="text-muted-foreground">{sys}</span>
              <div className={`w-2 h-2 rounded-full ${getStatusColor(status)} ${status !== 'OFFLINE' ? 'animate-pulse' : ''}`} />
            </div>
          ))}
        </div>

        {/* Right: Telemetry & Alert */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 text-muted-foreground">
             <div className="flex items-center space-x-1" title="API Latency">
                <Activity className="w-3.5 h-3.5" />
                <span>{MOCK_MISSION_DATA.apiLatency}ms</span>
             </div>
             <div className="flex items-center space-x-1" title="GPU Usage">
                <Cpu className="w-3.5 h-3.5" />
                <span>{MOCK_MISSION_DATA.gpuUsage}%</span>
             </div>
             <div className="flex items-center space-x-1" title="Data Freshness">
                <Database className="w-3.5 h-3.5" />
                <span>{MOCK_MISSION_DATA.dataFreshness}</span>
             </div>
          </div>

          <div className="flex items-center space-x-2 border-l border-border/50 pl-4">
            <div className={`px-2 py-0.5 rounded text-xs font-bold transition-opacity duration-300 ${pulse ? 'opacity-100' : 'opacity-70'} bg-red-500/20 text-red-400 border border-red-500/30`}>
              LIVE
            </div>
            <div className={`px-3 py-0.5 rounded-full text-xs font-bold ${getAlertColor('LOW')}`}>
              ALERT: LOW
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
