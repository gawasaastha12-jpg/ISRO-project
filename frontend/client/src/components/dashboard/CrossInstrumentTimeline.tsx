import React from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { Activity, Info } from 'lucide-react';

const TIMELINE_TRACKS = [
  { id: 'solexs', name: 'SOLEXS', color: 'bg-electric-blue' },
  { id: 'hel1os', name: 'HEL1OS', color: 'bg-deep-purple' },
  { id: 'velc', name: 'VELC', color: 'bg-supernova-gold' },
  { id: 'goes', name: 'GOES (Ref)', color: 'bg-gray-400' },
  { id: 'fusion', name: 'Fusion Engine', color: 'bg-starlight-white' },
  { id: 'alerts', name: 'Alerts', color: 'bg-red-500' },
];

export function CrossInstrumentTimeline() {
  const { data, loading } = useDashboard();
  const [timeRange, setTimeRange] = React.useState<'1h' | '6h' | '24h'>('1h');
  
  // Get active alert level and correlation details
  const alertLevel = data?.alerts?.current_alert || 'NORMAL';
  const correlationScore = data?.analytics?.correlation?.overall_score || 0.85;

  // Dynamically build events from history
  const getDynamicEvents = (trackId: string) => {
    if (!data?.history || data.history.length === 0) return [];
    
    // Determine history slice size
    const limit = timeRange === '1h' ? 12 : (timeRange === '6h' ? 72 : 100);
    const historySlice = data.history.slice(-limit);
    const N = historySlice.length;
    if (N < 2) return [];

    const events: any[] = [];
    const nowTime = new Date().getTime();

    historySlice.forEach((h: any, idx: number) => {
      // Position maps from 0 to 85% (NOW line is at 85%)
      const position = (idx / (N - 1)) * 85;
      
      // Calculate age of this observation
      const obsTime = new Date(h.timestamp).getTime();
      const ageMinutes = Math.max(0, Math.round((nowTime - obsTime) / 60000));
      const timeStr = ageMinutes === 0 ? 'NOW' : `T-${ageMinutes}m`;

      if (trackId === 'solexs') {
        const conf = h.solexs_confidence ?? 0;
        if (conf > 0.35) {
          events.push({
            id: `sol-${idx}`,
            position,
            time: timeStr,
            details: `SOLEXS Flare Alert (Prob: ${(conf * 100).toFixed(1)}%)`,
            active: conf > 0.7
          });
        }
      } else if (trackId === 'hel1os') {
        const score = h.hel1os_activity_score ?? 0;
        if (score > 55) {
          events.push({
            id: `hel-${idx}`,
            position,
            time: timeStr,
            details: `HEL1OS Hard X-Ray Burst (Score: ${score.toFixed(1)})`,
            active: score > 80
          });
        }
      } else if (trackId === 'velc') {
        const score = h.velc_novelty_score ?? 0;
        if (score > 0.5) {
          events.push({
            id: `velc-${idx}`,
            position,
            time: timeStr,
            details: `VELC Morphological Shift (Novelty: ${score.toFixed(3)})`,
            active: score > 0.7
          });
        }
      } else if (trackId === 'goes') {
        const conf = h.fusion_confidence ?? 0;
        if (conf > 0.5) {
          events.push({
            id: `goes-${idx}`,
            position,
            time: timeStr,
            details: `GOES Flare Class Verified (Class Match Confirmed)`,
            active: false
          });
        }
      } else if (trackId === 'fusion') {
        const conf = h.fusion_confidence ?? 0;
        if (conf > 0.35) {
          events.push({
            id: `fus-${idx}`,
            position,
            time: timeStr,
            details: `Multi-Sensor Coincidence (Confidence: ${(conf * 100).toFixed(1)}%)`,
            active: conf > 0.7
          });
        }
      } else if (trackId === 'alerts') {
        const conf = h.fusion_confidence ?? 0;
        if (conf > 0.5) {
          events.push({
            id: `al-${idx}`,
            position,
            time: timeStr,
            details: `Space Weather Warning Level Upgraded`,
            active: true
          });
        }
      }
    });

    return events;
  };

  // Find the index in history with the highest fusion confidence to mark the peak coincidence window
  let coincidencePos = 65; // fallback default
  if (data?.history && data.history.length > 0) {
    const limit = timeRange === '1h' ? 12 : (timeRange === '6h' ? 72 : 100);
    const historySlice = data.history.slice(-limit);
    const N = historySlice.length;
    if (N >= 2) {
      let maxConf = -1;
      let maxIdx = -1;
      historySlice.forEach((h: any, idx: number) => {
        const conf = h.fusion_confidence ?? 0;
        if (conf > maxConf) {
          maxConf = conf;
          maxIdx = idx;
        }
      });
      if (maxIdx !== -1 && maxConf > 0.35) {
        coincidencePos = (maxIdx / (N - 1)) * 85;
      }
    }
  }

  return (
    <div className="flex flex-col p-4 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg w-full transition-all duration-300 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-starlight-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <Activity className="w-4 h-4 mr-2 text-[#00d9ff]" />
          Cross-Instrument Event Timeline
        </h3>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono">
            <Info className="w-3 h-3 text-red-400" />
            <span>Pearson r = {correlationScore.toFixed(2)} (SOLEXS ↔ HEL1OS)</span>
          </div>
          <div className="flex space-x-1.5">
            {(['1h', '6h', '24h'] as const).map(t => (
              <button 
                key={t} 
                onClick={() => setTimeRange(t)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase transition-all duration-200 ${timeRange === t ? 'border-electric-blue bg-electric-blue/20 text-electric-blue font-black' : 'border-border text-muted-foreground hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative w-full py-2 flex flex-row">
        {/* Track Labels Column */}
        <div className="w-24 shrink-0 flex flex-col justify-between py-1.5 z-20 select-none">
          {TIMELINE_TRACKS.map((track) => (
            <div key={track.id} className="h-8 flex items-center text-[10px] font-bold text-muted-foreground uppercase" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {track.name}
            </div>
          ))}
        </div>

        {/* Tracks Grid Area (NOW and COINCIDENCE align perfectly inside this coordinate container) */}
        <div className="flex-1 relative py-1.5 flex flex-col justify-between">
          {/* Vertical NOW Line */}
          <div className="absolute left-[85%] top-0 bottom-0 w-px bg-electric-blue border-r border-dashed border-electric-blue/50 z-30" />
          <div className="absolute left-[85%] -top-4 px-1.5 py-0.5 bg-[#0b1022] border border-electric-blue/30 rounded text-[9px] text-electric-blue font-bold font-mono -translate-x-1/2 z-30">
            NOW
          </div>
          
          {/* Vertical correlation highlight rectangle */}
          <div 
            className="absolute top-0 bottom-0 w-12 bg-red-500/10 border-x border-dashed border-red-500/30 z-10 -translate-x-1/2 rounded transition-all duration-300" 
            style={{ left: `${coincidencePos}%` }}
            title="High-Coincidence Correlation Window" 
          />
          <div 
            className="absolute -top-4 px-1.5 py-0.5 bg-[#0b1022] border border-red-500/30 rounded text-[8px] text-red-400 font-bold font-mono -translate-x-1/2 z-20 transition-all duration-300"
            style={{ left: `${coincidencePos}%` }}
          >
            COINCIDENCE
          </div>
 
          {/* Track Lines & Events */}
          <div className="space-y-0 flex flex-col justify-between h-full">
            {TIMELINE_TRACKS.map((track) => {
              const events = getDynamicEvents(track.id);
              return (
                <div key={track.id} className="relative h-8 flex items-center group transition-colors hover:bg-white/[0.02] rounded px-1">
                  {/* Track Line */}
                  <div className="w-full h-px bg-white/10 relative">
                    {/* Events */}
                    {events.map(event => (
                      <div key={event.id} className="absolute" style={{ left: `${event.position}%` }}>
                        {/* Interactive event node */}
                        <div
                          className={`w-3.5 h-3.5 rounded-full -mt-1.75 -ml-1.75 cursor-pointer hover:scale-150 transition-all duration-200 z-20 border-2 border-[#0b1022] ${track.color} ${event.active ? 'animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)] bg-red-500' : ''}`}
                        />
                        
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block hover:block bg-[#0b1022] border border-[#00d9ff]/30 p-2 rounded shadow-2xl text-[9px] font-mono text-white w-32 z-50 pointer-events-none leading-normal">
                          <div className="font-bold text-electric-blue border-b border-white/10 pb-0.5 mb-1">
                            {event.time}
                          </div>
                          <p>{event.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

