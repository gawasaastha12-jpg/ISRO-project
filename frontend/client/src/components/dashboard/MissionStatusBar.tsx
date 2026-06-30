import React, { useState, useEffect } from 'react';
import { Clock3, Timer, Orbit, Activity, Cpu, Database } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

export default function MissionStatusBar() {
  const { data, loading, error, lastUpdated } = useDashboard();
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

  // Derive mission status parameters
  const lastUpdateDate = lastUpdated ? new Date(lastUpdated) : null;
  const now = new Date();
  const secondsElapsed = lastUpdateDate ? Math.floor((now.getTime() - lastUpdateDate.getTime()) / 1000) : null;

  let derivedStatus = "ACTIVE MONITORING";
  let statusText = "LIVE";
  
  if (error) {
    derivedStatus = "SYSTEM DISCONNECTED";
    statusText = "OFFLINE";
  } else if (loading && !data) {
    derivedStatus = "INITIALIZING SYSTEM";
    statusText = "SYNCING";
  } else if (secondsElapsed !== null && secondsElapsed > 60) {
    derivedStatus = "STALE TELEMETRY DETECTED";
    statusText = "STALE DATA";
  } else {
    derivedStatus = "ACTIVE MONITORING";
    statusText = "LIVE";
  }

  // Instrument checks
  const apiStatus = error ? 'OFFLINE' : (loading ? 'DEGRADED' : 'ONLINE');
  const solexsStatus = data?.status?.SOLEXS || 'ONLINE';
  const hel1osStatus = data?.status?.HEL1OS || 'ONLINE';
  const velcStatus = data?.status?.VELC || 'ONLINE';
  const fusionStatus = data?.status?.Fusion || 'ONLINE';

  let onlineCount = 0;
  if (solexsStatus !== 'OFFLINE') onlineCount++;
  if (hel1osStatus !== 'OFFLINE') onlineCount++;
  if (velcStatus !== 'OFFLINE') onlineCount++;
  const instrumentsOnlineStr = `${onlineCount} / 3`;

  const relativeObsTime = secondsElapsed !== null 
    ? (secondsElapsed < 5 ? 'Just now' : `${secondsElapsed}s ago`) 
    : '12s ago';

  return (
    <div className="flex flex-col w-full bg-cosmic-navy/80 border-b border-border/50 backdrop-blur-md sticky top-0 z-50">
      {/* Top Brand Bar */}
      <div className="flex justify-center items-center py-2 border-b border-border/30">
        <h1 className="text-xl text-starlight-white font-black tracking-widest uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          ADITYA-L1 SOLAR INTELLIGENCE PLATFORM
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
            <span>T+ 452:12:08</span>
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Orbit className="w-4 h-4 text-deep-purple" />
            <span>HALO-ORBIT L1</span>
          </div>
        </div>

        {/* Center: System Status */}
        <div className="flex items-center space-x-4">
          {[
            { key: 'API', label: 'API Gateway', status: apiStatus },
            { key: 'SOLEXS', label: 'SOLEXS Payload', status: solexsStatus },
            { key: 'HEL1OS', label: 'HEL1OS Payload', status: hel1osStatus },
            { key: 'VELC', label: 'VELC Payload', status: velcStatus },
            { key: 'Fusion', label: 'Physics-Guided Fusion Engine (Fusion Oracle)', status: fusionStatus }
          ].map((sys) => (
            <div key={sys.key} className="flex items-center space-x-1.5" title={`${sys.label}: ${sys.status}`}>
              <span className="text-muted-foreground">{sys.key === 'Fusion' ? 'Fusion Oracle' : sys.key}</span>
              <div className={`w-2 h-2 rounded-full ${getStatusColor(sys.status)} ${sys.status === 'ONLINE' ? 'animate-pulse' : ''}`} />
            </div>
          ))}
        </div>

        {/* Right: Telemetry & Alert */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 text-muted-foreground">
             <div className="flex items-center space-x-1" title="Model inference completed in <1 second after observation data becomes available.">
                <Activity className="w-3.5 h-3.5 text-electric-blue" />
                <span>{data?.mission_status?.api_latency_ms || '--'}ms</span>
             </div>
             <div className="flex items-center space-x-1" title="Last Ingested Telemetry Sync">
                <Database className="w-3.5 h-3.5" />
                <span>{lastUpdated ? lastUpdated.substring(11, 19) + ' UTC' : 'Syncing...'}</span>
             </div>
          </div>

          <div className="flex items-center space-x-2 border-l border-border/50 pl-4">
            <div className={`px-2 py-0.5 rounded text-xs font-bold transition-opacity duration-300 flex items-center space-x-1.5 ${pulse ? 'opacity-100' : 'opacity-70'} ${loading ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : (error ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30')}`}>
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : (error ? 'bg-red-500' : 'bg-green-500')}`}></div>
              <span>{statusText}</span>
            </div>
            <div className={`px-3 py-0.5 rounded-full text-xs font-bold ${getAlertColor(data?.alerts?.current_alert || 'NORMAL')}`}>
              ALERT: {data?.alerts?.current_alert || 'NORMAL'}
            </div>
          </div>
        </div>

      </div>

      {/* Operations Mode & Mission Status Sub-Bar */}
      <div className="flex flex-row items-center justify-between px-4 py-1.5 bg-black/40 border-t border-border/20 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className="text-muted-foreground">Mode:</span>
            <span className="text-[#00d9ff] font-bold bg-[#00d9ff]/10 px-1.5 py-0.5 rounded border border-[#00d9ff]/20">NOWCASTING</span>
          </span>
          <span className="text-muted-foreground/30">|</span>
          <span className="flex items-center space-x-1.5">
            <span className="text-muted-foreground">Forecast Horizons:</span>
            <span className="text-starlight-white font-bold">5m • 15m • 30m • 60m • 180m</span>
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1">
            <span className="text-muted-foreground">Mission Status:</span>
            <span className={`font-bold ${error ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>{derivedStatus}</span>
          </span>
          <span className="text-muted-foreground/30">|</span>
          <span className="flex items-center space-x-1">
            <span className="text-muted-foreground">Instruments Online:</span>
            <span className="text-starlight-white font-bold">{instrumentsOnlineStr}</span>
          </span>
          <span className="text-muted-foreground/30">|</span>
          <span className="flex items-center space-x-1">
            <span className="text-muted-foreground">Observation Coverage:</span>
            <span className="text-starlight-white font-bold">Feb 2024 – Jun 2026</span>
          </span>
          <span className="text-muted-foreground/30">|</span>
          <span className="flex items-center space-x-1">
            <span className="text-orange-400 font-bold">Latest Observation:</span>
            <span className="text-orange-400 font-bold">{relativeObsTime}</span>
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className="text-muted-foreground">AI Engine:</span>
            <span className="text-green-400 font-bold bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">RUNNING</span>
          </span>
          <span className="text-muted-foreground/30">|</span>
          <span className="flex items-center space-x-1.5">
            <span className="text-muted-foreground">Master Catalogue:</span>
            <span className="text-electric-blue font-bold">UPDATING</span>
          </span>
        </div>
      </div>
    </div>
  );
}
