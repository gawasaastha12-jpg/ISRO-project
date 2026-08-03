import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea, ReferenceLine } from 'recharts';
import { Activity } from 'lucide-react';

interface TelemetryPoint {
  time: string;
  timestamp: string;
  solexs: number;
  hel1os: number;
}

export function DualInstrumentChart() {
  const [dataPoints, setDataPoints] = useState<TelemetryPoint[]>([]);
  const [timeRange, setTimeRange] = useState<'30m' | '60m' | '120m' | '300m'>('30m');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/history');
        const json = await res.json();
        if (json.status === 'ONLINE' && json.predictions) {
          const formatted = json.predictions.map((p: any) => {
            const date = new Date(p.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // Clean values & floor to prevent log(0) errors
            const rawSolexs = parseFloat(p.solexs_peak) || 0;
            const solexsVal = Math.max(rawSolexs, 1e-11);
            
            const rawHel = parseFloat(p.hel_score) || 0;
            const helVal = Math.max(rawHel, 0.1);

            return {
              time: timeStr,
              timestamp: p.timestamp,
              solexs: solexsVal,
              hel1os: helVal
            };
          });
          setDataPoints(formatted);
        }
      } catch (e) {
        console.error("Failed to fetch telemetry series", e);
      } finally {
        setLoading(false);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  // Determine slice size based on mock ranges
  const getSlicedData = () => {
    if (dataPoints.length === 0) return [];
    let limit = 20;
    if (timeRange === '60m') limit = 40;
    if (timeRange === '120m') limit = 70;
    if (timeRange === '300m') limit = 100;
    return dataPoints.slice(-limit);
  };

  const slicedData = getSlicedData();

  // Find threshold crossings (hel_score > 55 cps) for shaded area highlights
  const thresholdAreas: { start: string; end: string }[] = [];
  let inCrossing = false;
  let crossingStart = "";

  slicedData.forEach((d, idx) => {
    const isCrossing = d.hel1os > 55;
    if (isCrossing && !inCrossing) {
      inCrossing = true;
      crossingStart = d.time;
    } else if (!isCrossing && inCrossing) {
      inCrossing = false;
      thresholdAreas.push({ start: crossingStart, end: d.time });
    }
    // If it's the last element and still crossing, close the window
    if (idx === slicedData.length - 1 && inCrossing) {
      thresholdAreas.push({ start: crossingStart, end: d.time });
    }
  });

  // Calculate specific visual lag indices for the timeline
  let hel1osCrossingTime = "";
  let solexsPeakTime = "";
  let lagLabel = "";

  if (slicedData.length > 0) {
    const crossIndex = slicedData.findIndex(d => d.hel1os > 55);
    if (crossIndex !== -1) {
      hel1osCrossingTime = slicedData[crossIndex].time;
      
      let maxSolexs = -1;
      let maxSolexsIndex = -1;
      const searchStart = Math.max(0, crossIndex - 2);
      const searchEnd = Math.min(slicedData.length, crossIndex + 8);
      
      for (let i = searchStart; i < searchEnd; i++) {
        if (slicedData[i].solexs > maxSolexs) {
          maxSolexs = slicedData[i].solexs;
          maxSolexsIndex = i;
        }
      }
      
      if (maxSolexsIndex !== -1) {
        solexsPeakTime = slicedData[maxSolexsIndex].time;
        // Calculate the actual lag using the real timestamps!
        const t1 = new Date(slicedData[crossIndex].timestamp).getTime();
        const t2 = new Date(slicedData[maxSolexsIndex].timestamp).getTime();
        const secondsLag = Math.round(Math.abs(t2 - t1) / 1000);
        lagLabel = `Lag: ${secondsLag}s`;
      }
    }
  }

  return (
    <div className="flex flex-col p-5 bg-[#131a2e] border border-[#1e2740] rounded-lg h-full relative transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-[#e8ecf5]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <Activity className="w-4 h-4 mr-2 text-[#22d3ee]" />
            Raw Telemetry Series — SOLEXS + HEL1OS
          </h3>
          <p className="text-[9px] text-[#6b7590] mt-0.5 font-mono">
            Synchronized scientific counts on logarithmic scale. Highlights show coincidence onset crossings.
          </p>
        </div>
        
        {/* Time range selector */}
        <div className="flex space-x-1">
          {(['30m', '60m', '120m', '300m'] as const).map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2 py-0.5 text-[9px] font-bold font-mono rounded border uppercase transition-all duration-200 ${timeRange === r ? 'border-[#22d3ee] bg-[#22d3ee]/20 text-[#22d3ee]' : 'border-[#1e2740] text-[#6b7590] hover:text-[#e8ecf5]'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex-1 flex items-center justify-center text-xs text-[#6b7590] font-mono">Loading dynamic telemetry graphs...</div>}
      
      {!loading && slicedData.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-[#6b7590] font-mono">Waiting for telemetry connection...</div>
      )}

      {!loading && slicedData.length > 0 && (
        <div className="flex-1 flex flex-col justify-between space-y-2 relative">
          {/* Floating Lag Info Badge absolute-centered bridging the subplots */}
          {lagLabel && (
            <div className="absolute top-[48.5%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-[#0b1022] border border-[#22d3ee] px-3 py-1 rounded shadow-2xl flex items-center space-x-2 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-ping" />
              <span className="text-[9px] text-[#22d3ee] font-bold tracking-widest font-mono">CROSS-CORRELATION DELAY: {lagLabel.replace('Lag: ', '').toUpperCase()} (T_hel1os ➔ T_solexs)</span>
            </div>
          )}

          {/* Subplot 1: SOLEXS */}
          <div className="h-[46%] relative">
            <div className="absolute top-1 right-2 text-[8px] font-mono font-bold text-[#22d3ee] z-20 bg-[#0a0e1a]/60 px-1 py-0.5 rounded">
              SOLEXS (Soft X-Ray) Peak Flux (W/m²)
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={slicedData} syncId="instrumentCharts" margin={{ top: 20, right: 5, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="solexsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 39, 64, 0.4)" />
                <XAxis dataKey="time" hide />
                <YAxis 
                  scale="log" 
                  domain={['auto', 'auto']} 
                  stroke="#6b7590" 
                  fontSize={8} 
                  fontFamily="monospace"
                  tickFormatter={(val) => val.toExponential(0)}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131a2e', borderColor: '#1e2740', fontSize: '9px', fontFamily: 'monospace' }}
                  labelStyle={{ color: '#e8ecf5', fontWeight: 'bold' }}
                />
                {thresholdAreas.map((area, index) => (
                  <ReferenceArea 
                    key={index} 
                    x1={area.start} 
                    x2={area.end} 
                    fill="rgba(239, 108, 108, 0.08)" 
                    stroke="rgba(239, 108, 108, 0.15)"
                    strokeDasharray="2 2"
                  />
                ))}
                {hel1osCrossingTime && solexsPeakTime && (
                  <ReferenceArea 
                    x1={hel1osCrossingTime < solexsPeakTime ? hel1osCrossingTime : solexsPeakTime} 
                    x2={hel1osCrossingTime < solexsPeakTime ? solexsPeakTime : hel1osCrossingTime} 
                    fill="rgba(34, 211, 238, 0.08)" 
                    stroke="rgba(34, 211, 238, 0.2)"
                    strokeDasharray="3 3"
                    label={{ value: `LAG: ${lagLabel.replace('Lag: ', '')}`, fill: '#22d3ee', fontSize: 8, position: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}
                  />
                )}
                {/* Visual marker for Shared Now */}
                <ReferenceLine x={slicedData[slicedData.length - 3]?.time} stroke="#22d3ee" strokeDasharray="3 3" />
                {hel1osCrossingTime && (
                  <ReferenceLine 
                    x={hel1osCrossingTime} 
                    stroke="#ef4444" 
                    strokeWidth={1} 
                    strokeDasharray="4 4" 
                    label={{ value: 'HEL1OS ONSET ALERT', fill: '#ef4444', fontSize: 7, position: 'insideTopLeft', fontFamily: 'monospace' }} 
                  />
                )}
                {solexsPeakTime && (
                  <ReferenceLine 
                    x={solexsPeakTime} 
                    stroke="#10b981" 
                    strokeWidth={1} 
                    strokeDasharray="4 4" 
                    label={{ value: `SOLEXS PEAK (${lagLabel})`, fill: '#10b981', fontSize: 7, position: 'insideTopRight', fontFamily: 'monospace' }} 
                  />
                )}
                <Area type="monotone" dataKey="solexs" stroke="#22d3ee" strokeWidth={1.5} fillOpacity={1} fill="url(#solexsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-[#1e2740] w-full" />

          {/* Subplot 2: HEL1OS */}
          <div className="h-[46%] relative">
            <div className="absolute top-1 right-2 text-[8px] font-mono font-bold text-[#ff9f1c] z-20 bg-[#0a0e1a]/60 px-1 py-0.5 rounded">
              HEL1OS (Hard X-Ray) Activity Rate (cps)
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={slicedData} syncId="instrumentCharts" margin={{ top: 20, right: 5, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="helGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff9f1c" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ff9f1c" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 39, 64, 0.4)" />
                <XAxis 
                  dataKey="time" 
                  stroke="#6b7590" 
                  fontSize={8} 
                  fontFamily="monospace"
                />
                <YAxis 
                  scale="log"
                  domain={[1, 'auto']} 
                  stroke="#6b7590" 
                  fontSize={8} 
                  fontFamily="monospace"
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#131a2e', borderColor: '#1e2740', fontSize: '9px', fontFamily: 'monospace' }}
                  labelStyle={{ color: '#e8ecf5', fontWeight: 'bold' }}
                />
                {thresholdAreas.map((area, index) => (
                  <ReferenceArea 
                    key={index} 
                    x1={area.start} 
                    x2={area.end} 
                    fill="rgba(239, 108, 108, 0.08)" 
                    stroke="rgba(239, 108, 108, 0.15)"
                    strokeDasharray="2 2"
                  />
                ))}
                {hel1osCrossingTime && solexsPeakTime && (
                  <ReferenceArea 
                    x1={hel1osCrossingTime < solexsPeakTime ? hel1osCrossingTime : solexsPeakTime} 
                    x2={hel1osCrossingTime < solexsPeakTime ? solexsPeakTime : hel1osCrossingTime} 
                    fill="rgba(34, 211, 238, 0.08)" 
                    stroke="rgba(34, 211, 238, 0.2)"
                    strokeDasharray="3 3"
                    label={{ value: `LAG: ${lagLabel.replace('Lag: ', '')}`, fill: '#22d3ee', fontSize: 8, position: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}
                  />
                )}
                {/* Visual marker for Shared Now */}
                <ReferenceLine x={slicedData[slicedData.length - 3]?.time} stroke="#22d3ee" strokeDasharray="3 3" label={{ value: 'NOW', fill: '#22d3ee', fontSize: 7, position: 'insideTopRight', fontFamily: 'monospace' }} />
                
                {/* Horizontal reference line for alert threshold (55 cps) */}
                <ReferenceLine y={55} stroke="rgba(239, 68, 68, 0.5)" strokeDasharray="2 2" label={{ value: 'ALERT THRESHOLD (55 cps)', fill: '#ef4444', fontSize: 6, position: 'insideBottomRight' }} />
                
                {hel1osCrossingTime && (
                  <ReferenceLine 
                    x={hel1osCrossingTime} 
                    stroke="#ef4444" 
                    strokeWidth={1} 
                    strokeDasharray="4 4" 
                    label={{ value: 'HEL1OS ONSET ALERT', fill: '#ef4444', fontSize: 7, position: 'insideBottomLeft', fontFamily: 'monospace' }} 
                  />
                )}
                {solexsPeakTime && (
                  <ReferenceLine 
                    x={solexsPeakTime} 
                    stroke="#10b981" 
                    strokeWidth={1} 
                    strokeDasharray="4 4" 
                    label={{ value: `SOLEXS PEAK (${lagLabel})`, fill: '#10b981', fontSize: 7, position: 'insideBottomRight', fontFamily: 'monospace' }} 
                  />
                )}
                <Area type="monotone" dataKey="hel1os" stroke="#ff9f1c" strokeWidth={1.5} fillOpacity={1} fill="url(#helGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
