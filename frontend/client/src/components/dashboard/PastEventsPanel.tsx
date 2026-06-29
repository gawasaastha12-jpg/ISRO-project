import React, { useState } from 'react';
import { History, ArrowRight } from 'lucide-react';

const MOCK_SIMILAR_EVENTS = [
  { id: 'EVT-2023-11A', date: '2023-11-14T08:22:00Z', class: 'X1.2', similarity: 94, outcome: 'Geomagnetic Storm G3' },
  { id: 'EVT-2022-04C', date: '2022-04-19T14:10:00Z', class: 'M9.8', similarity: 88, outcome: 'Radio Blackout R2' },
  { id: 'EVT-2024-02B', date: '2024-02-09T22:45:00Z', class: 'X2.0', similarity: 85, outcome: 'No Earth Impact' },
];

export function PastEventsPanel() {
  return (
    <div className="flex flex-col p-6 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-muted-foreground" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <History className="w-4 h-4 mr-2 text-[#00d9ff]" />
          Similar Historical Events
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MOCK_SIMILAR_EVENTS.map(evt => (
          <div key={evt.id} className="bg-white/5 border border-white/10 rounded p-4 flex flex-col group relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-[#00d9ff] opacity-50 group-hover:opacity-100 transition-opacity" />
             <div className="flex justify-between items-center mb-2 pl-2">
                <span className="text-xs font-bold text-starlight-white">{evt.id}</span>
                <span className="text-xs font-bold text-[#00ff88]">{evt.similarity}% Match</span>
             </div>
             <div className="pl-2 flex flex-col space-y-1">
                <span className="text-[10px] text-muted-foreground">{new Date(evt.date).toLocaleString()}</span>
                <div className="flex justify-between items-center mt-2">
                   <span className="text-xs font-bold text-[#ff3b5c]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{evt.class}</span>
                   <span className="text-[10px] text-starlight-white truncate ml-2">{evt.outcome}</span>
                </div>
                <button className="mt-3 flex items-center text-[10px] text-[#00d9ff] uppercase tracking-wider group-hover:text-white transition-colors">
                  Open Event <ArrowRight className="w-3 h-3 ml-1" />
                </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
