import React from 'react';
import { Server, Activity, Database, HardDrive, Wifi, ShieldAlert, Cpu } from 'lucide-react';
import { MOCK_BACKEND_HEALTH, MOCK_INSTRUMENT_HEALTH } from '../../lib/mock-data';

export function BackendHealth() {
  return (
    <div className="flex flex-col p-4 bg-cosmic-navy/50 border border-border/50 rounded-lg h-full">
      <div className="flex justify-between items-center mb-4 border-b border-border/30 pb-2">
        <h3 className="font-bold tracking-wide uppercase text-sm flex items-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <Server className="w-4 h-4 mr-2 text-muted-foreground" />
          Backend Health
        </h3>
        <button className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-muted-foreground border border-white/10 transition-colors">
          RUN DIAGNOSTICS
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground flex items-center"><Activity className="w-3 h-3 mr-1" /> Inference Time</span>
            <span className="text-xs font-bold text-electric-blue" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{MOCK_BACKEND_HEALTH.inferenceTime}ms</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground flex items-center"><Wifi className="w-3 h-3 mr-1" /> Data Age</span>
            <span className="text-xs font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{MOCK_BACKEND_HEALTH.dataAge}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground flex items-center"><Database className="w-3 h-3 mr-1" /> Queue Length</span>
            <span className="text-xs font-bold text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{MOCK_BACKEND_HEALTH.queueLength}</span>
          </div>
        </div>
        
        <div className="flex flex-col space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground flex items-center"><Server className="w-3 h-3 mr-1" /> Pipeline</span>
            <span className="text-xs font-bold text-green-400">{MOCK_BACKEND_HEALTH.pipelineStatus}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground flex items-center"><HardDrive className="w-3 h-3 mr-1" /> Memory</span>
            <span className="text-[10px] text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{MOCK_BACKEND_HEALTH.memory}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground flex items-center"><Cpu className="w-3 h-3 mr-1" /> GPU VRAM</span>
            <span className="text-[10px] text-starlight-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{MOCK_BACKEND_HEALTH.gpu}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstrumentHealth() {
  const instruments = [
    { name: 'SOLEXS', key: 'solexs', color: 'text-electric-blue' },
    { name: 'HEL1OS', key: 'hel1os', color: 'text-deep-purple' },
    { name: 'VELC', key: 'velc', color: 'text-supernova-gold' },
  ];

  return (
    <div className="flex flex-col p-4 bg-cosmic-navy/50 border border-border/50 rounded-lg h-full">
      <div className="flex justify-between items-center mb-4 border-b border-border/30 pb-2">
        <h3 className="font-bold tracking-wide uppercase text-sm flex items-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <ShieldAlert className="w-4 h-4 mr-2 text-muted-foreground" />
          Instrument Health
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border/30">
              <th className="pb-2 font-normal">Instrument</th>
              <th className="pb-2 font-normal">Completeness</th>
              <th className="pb-2 font-normal">Noise</th>
              <th className="pb-2 font-normal">Drops</th>
              <th className="pb-2 font-normal">Corrupted</th>
            </tr>
          </thead>
          <tbody>
            {instruments.map(inst => {
              const data = MOCK_INSTRUMENT_HEALTH[inst.key as keyof typeof MOCK_INSTRUMENT_HEALTH];
              return (
                <tr key={inst.key} className="border-b border-border/10 last:border-0">
                  <td className={`py-2 font-bold ${inst.color}`} style={{ fontFamily: 'Orbitron, sans-serif' }}>{inst.name}</td>
                  <td className="py-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{data.completeness}</td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded ${data.noise === 'Low' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                      {data.noise}
                    </span>
                  </td>
                  <td className="py-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{data.frameDrops}</td>
                  <td className="py-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    <span className={data.corrupted > 0 ? 'text-red-400 font-bold' : ''}>{data.corrupted}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
