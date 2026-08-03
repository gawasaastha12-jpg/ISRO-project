import React from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { Database, Activity, Server, AlertCircle } from 'lucide-react';

export function HealthStrip() {
  const { data, loading, error, lastUpdated } = useDashboard();

  const latency = data?.mission_status?.api_latency_ms || 42;
  const bufferCurrent = data?.mission_status?.buffer_status?.current ?? 0;
  const bufferMax = data?.mission_status?.buffer_status?.max ?? 100;
  const bufferPct = bufferMax > 0 ? (bufferCurrent / bufferMax) * 100 : 0;
  
  // Calculate relative age of last sync
  const lastSyncStr = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Syncing...';

  // Determine pipeline health label
  const pipelineStatus = error ? 'DEGRADED' : 'NOMINAL';
  const pipelineColor = error ? 'text-[#ef4444]' : 'text-[#10b981]';

  // Buffer progress bar color selection (amber if >= 90%, else green)
  const bufferColor = bufferPct >= 90 ? 'bg-[#f59e0b]' : 'bg-[#10b981]';
  const bufferBorderColor = bufferPct >= 90 ? 'border-[#f59e0b]/40' : 'border-[#10b981]/20';

  return (
    <div className="flex flex-row items-center justify-between px-4 py-2.5 bg-[#131a2e] border border-[#1e2740] rounded-lg text-[10px] font-mono text-[#e8ecf5] uppercase tracking-wider w-full gap-4">
      {/* Live/Sim badge */}
      <div className="flex items-center space-x-2">
        <span className="flex items-center text-[#22d3ee]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-pulse mr-1.5" />
          LIVE TELEMETRY
        </span>
        <span className="text-[#6b7590]">|</span>
        <span className="text-[#e8ecf5] font-bold">Sync: {lastSyncStr}</span>
      </div>

      {/* Buffer status bar */}
      <div className="flex items-center space-x-3 flex-1 max-w-xs md:max-w-md">
        <span className="text-[#6b7590] flex items-center shrink-0">
          <Database className="w-3 h-3 mr-1" />
          Buffer Usage:
        </span>
        <div className={`flex-1 h-2.5 bg-black/40 rounded overflow-hidden border ${bufferBorderColor} flex p-[1px]`}>
          <div 
            className={`h-full ${bufferColor} rounded-sm transition-all duration-500`}
            style={{ width: `${bufferPct}%` }}
          />
        </div>
        <span className="text-[#e8ecf5] font-bold shrink-0">
          {bufferCurrent}/{bufferMax}
        </span>
      </div>

      {/* Latency & Pipeline status */}
      <div className="flex items-center space-x-4">
        <span className="flex items-center text-[#e8ecf5]">
          <Activity className="w-3.5 h-3.5 text-[#22d3ee] mr-1.5" />
          Inference: <span className="font-bold text-[#22d3ee] ml-1">{latency}ms</span>
        </span>
        <span className="text-[#6b7590]">|</span>
        <span className="flex items-center">
          <Server className="w-3.5 h-3.5 mr-1.5 text-[#6b7590]" />
          Pipeline: <span className={`font-black ml-1 ${pipelineColor}`}>{pipelineStatus}</span>
        </span>
      </div>
    </div>
  );
}
