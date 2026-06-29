import React from 'react';

const TIMELINE_TRACKS = [
  { id: 'solexs', name: 'SOLEXS', color: 'bg-electric-blue' },
  { id: 'hel1os', name: 'HEL1OS', color: 'bg-deep-purple' },
  { id: 'velc', name: 'VELC', color: 'bg-supernova-gold' },
  { id: 'goes', name: 'GOES (Ref)', color: 'bg-gray-400' },
  { id: 'fusion', name: 'Fusion Engine', color: 'bg-starlight-white' },
  { id: 'alerts', name: 'Alerts', color: 'bg-red-500' },
];

export function CrossInstrumentTimeline() {
  // Generate mock events for each track
  const generateEvents = (count: number, isAlert = false) => {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      // Random position between 10% and 90%
      position: 10 + Math.random() * 80,
      active: isAlert ? Math.random() > 0.8 : false
    }));
  };

  return (
    <div className="flex flex-col p-4 bg-cosmic-navy/50 border border-border/50 rounded-lg w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold tracking-wide uppercase text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>Cross-Instrument Event Timeline</h3>
        <div className="flex space-x-2">
          {['1h', '6h', '24h'].map(t => (
            <button key={t} className={`px-2 py-1 text-xs rounded border ${t === '1h' ? 'border-electric-blue bg-electric-blue/20 text-electric-blue' : 'border-border text-muted-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full py-2">
        {/* Vertical NOW Line */}
        <div className="absolute left-[85%] top-0 bottom-0 w-px bg-electric-blue border-r border-dashed border-electric-blue/50 z-10" />
        <div className="absolute left-[85%] -top-2 px-1 bg-cosmic-navy text-[10px] text-electric-blue font-bold -translate-x-1/2">NOW</div>
        
        {/* Vertical correlation highlight */}
        <div className="absolute left-[65%] top-0 bottom-0 w-8 bg-red-500/10 border-x border-red-500/30 z-0 -translate-x-1/2 rounded" />

        {TIMELINE_TRACKS.map((track) => (
          <div key={track.id} className="relative h-8 flex items-center group">
            {/* Track Label */}
            <div className="w-24 text-[10px] font-bold text-muted-foreground uppercase" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {track.name}
            </div>
            
            {/* Track Line */}
            <div className="flex-1 h-px bg-border relative">
              {/* Events */}
              {generateEvents(track.id === 'alerts' ? 2 : 5, track.id === 'alerts').map(event => (
                <div
                  key={event.id}
                  className={`absolute w-3 h-3 rounded-full -mt-1.5 -ml-1.5 cursor-pointer hover:scale-150 transition-transform z-20 ${track.color} ${event.active ? 'animate-ping' : ''}`}
                  style={{ left: `${event.position}%` }}
                  title="Click for event details"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
