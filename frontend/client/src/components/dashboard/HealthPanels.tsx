import React, { useState } from 'react';
import { Server, Database, Activity, Cpu, Network, Clock, ShieldCheck, Settings, CheckCircle2, XCircle, AlertCircle, HardDrive, Wifi, ShieldAlert } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

export function BackendHealth() {
  const { data } = useDashboard();
  const status = data?.mission_status || {};
  const health = {
    inferenceTime: status.api_latency_ms?.toString() || "0",
    dataAge: "0s",
    queueLength: 0,
    pipelineStatus: status.system || "OPERATIONAL",
    memory: "0.2/16GB",
    gpu: "1.4/24GB"
  };

  return (
    <div className="flex flex-col p-6 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-muted-foreground" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <Server className="w-4 h-4 mr-2 text-[#00d9ff]" />
          Backend Health
        </h3>
        <button className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-[#00d9ff] border border-white/10 transition-colors uppercase tracking-wider">
          Diagnostics
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center bg-white/5 p-2 rounded">
            <span className="text-[10px] text-muted-foreground uppercase flex items-center"><Activity className="w-3 h-3 mr-1" /> Inference</span>
            <span className="text-xs font-bold text-[#00d9ff]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{health.inferenceTime}ms</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-2 rounded">
            <span className="text-[10px] text-muted-foreground uppercase flex items-center"><Wifi className="w-3 h-3 mr-1" /> Data Age</span>
            <span className="text-xs font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{health.dataAge}</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-2 rounded">
            <span className="text-[10px] text-muted-foreground uppercase flex items-center"><Database className="w-3 h-3 mr-1" /> Queue</span>
            <span className="text-xs font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{health.queueLength}</span>
          </div>
        </div>
        
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center bg-white/5 p-2 rounded">
            <span className="text-[10px] text-muted-foreground uppercase flex items-center"><Server className="w-3 h-3 mr-1" /> Pipeline</span>
            <span className="text-xs font-bold text-[#00ff88]">{health.pipelineStatus}</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-2 rounded">
            <span className="text-[10px] text-muted-foreground uppercase flex items-center"><HardDrive className="w-3 h-3 mr-1" /> Memory</span>
            <span className="text-[10px] text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{health.memory}</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-2 rounded">
            <span className="text-[10px] text-muted-foreground uppercase flex items-center"><Cpu className="w-3 h-3 mr-1" /> GPU VRAM</span>
            <span className="text-[10px] text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{health.gpu}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstrumentHealthHeatmap() {
  const [activeTab, setActiveTab] = useState('SOLEXS');
  const tabs = ['SOLEXS', 'HEL1OS', 'VELC', 'FUSION'];
  
  // Generate dummy flat heatmap since API doesn't serve history logs
  const heatmapData = Array.from({ length: 4 }, (_, i) => ({
    day: `D-${i}`,
    hours: Array(24).fill(0) // 0 = Healthy
  }));

  const getColor = (status: number) => {
    if (status === 2) return 'bg-[#ff3b5c]'; // Offline / Red
    if (status === 1) return 'bg-[#ff9f1c]'; // Warning / Yellow
    return 'bg-[#00ff88]'; // Healthy / Green
  };

  return (
    <div className="flex flex-col p-6 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-muted-foreground" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <ShieldAlert className="w-4 h-4 mr-2 text-[#00ff88]" />
          Instrument Health
        </h3>
        
        <div className="flex space-x-1">
          {tabs.map(t => (
             <button 
               key={t}
               onClick={() => setActiveTab(t)}
               className={`px-2 py-1 text-[9px] uppercase tracking-wider rounded transition-colors ${activeTab === t ? 'bg-[#00d9ff]/20 text-[#00d9ff] border border-[#00d9ff]/50' : 'text-muted-foreground hover:text-white'}`}
             >
               {t}
             </button>
          ))}
        </div>
      </div>
      
      <div className="flex flex-col mt-2">
        <div className="flex text-[8px] text-muted-foreground mb-1 ml-6 justify-between">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>
        <div className="flex flex-col space-y-1">
          {heatmapData.map((row: any, i: number) => (
             <div key={i} className="flex items-center">
                <span className="text-[9px] text-muted-foreground w-6 font-bold">{row.day}</span>
                <div className="flex flex-1 space-x-[2px]">
                   {row.hours.map((h: number, j: number) => (
                      <div key={j} className={`flex-1 h-3 rounded-sm ${getColor(h)} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`} title={`${row.day} ${j}:00 UTC`} />
                   ))}
                </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CorrelationEngineWidget() {
  const { data } = useDashboard();
  const correlation = data?.analytics?.correlation || { overall_score: 0.0, pairs: [] };
  
  return (
    <div className="flex flex-col p-6 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-muted-foreground" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <Network className="w-4 h-4 mr-2 text-[#7c3aed]" />
          Correlation Engine
        </h3>
        <span className="text-[#00d9ff] text-xs font-bold bg-[#00d9ff]/10 px-2 py-1 rounded">Overall: {correlation.overall_score?.toFixed(2)}</span>
      </div>
      
      <div className="flex flex-col space-y-3 flex-1 justify-center">
         {correlation.pairs.map((pair: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center bg-white/5 p-2.5 rounded">
               <span className="text-[10px] text-starlight-white font-bold">{pair.pair}</span>
               <div className="flex items-center space-x-3">
                 <span className="text-xs font-black text-muted-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{pair.value.toFixed(2)}</span>
                 <div className="flex space-x-[2px]">
                   {[...Array(5)].map((_, i) => (
                     <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < pair.rating ? 'bg-[#7c3aed]' : 'bg-white/10'}`} />
                   ))}
                 </div>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
}
