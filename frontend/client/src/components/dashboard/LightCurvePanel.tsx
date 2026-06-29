import React from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea, Scatter, Tooltip } from 'recharts';
import { generateLightcurveData } from '../../lib/mock-data';

export function LightCurvePanel() {
  const data = generateLightcurveData();

  // Create predicted trajectory data by offsetting from the last point
  const lastPoint = data[data.length - 1];
  const predictedData = [
    { time: '0m', flux: lastPoint.flux },
    { time: '+5m', flux: lastPoint.flux + 200 },
    { time: '+10m', flux: lastPoint.flux + 800 },
    { time: '+15m', flux: lastPoint.flux + 1200 },
    { time: '+20m', flux: lastPoint.flux + 1100 },
    { time: '+25m', flux: lastPoint.flux + 500 },
    { time: '+30m', flux: lastPoint.flux + 100 },
  ];

  // Current point
  const currentPoint = [{ time: '0m', flux: lastPoint.flux }];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-cosmic-navy/90 border border-border p-2 rounded shadow-xl text-xs">
          <p className="text-starlight-white font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(0)} counts
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col p-4 bg-cosmic-navy/50 border border-border/50 rounded-lg h-[400px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold tracking-wide uppercase text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>SOLEXS Lightcurve</h3>
        <div className="flex space-x-2">
          {['30m', '60m', '120m', '300m'].map(t => (
            <button key={t} className={`px-2 py-1 text-xs rounded border ${t === '60m' ? 'border-electric-blue bg-electric-blue/20 text-electric-blue' : 'border-border text-muted-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={[...data, ...predictedData]} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
            {/* Threshold Bands */}
            <ReferenceArea y1={0} y2={1000} fill="rgba(34, 197, 94, 0.05)" />
            <ReferenceArea y1={1000} y2={2000} fill="rgba(59, 130, 246, 0.05)" />
            <ReferenceArea y1={2000} y2={3000} fill="rgba(234, 179, 8, 0.05)" />
            <ReferenceArea y1={3000} y2={4000} fill="rgba(249, 115, 22, 0.05)" />
            <ReferenceArea y1={4000} fill="rgba(239, 68, 68, 0.05)" />
            
            {/* Threshold Lines */}
            <ReferenceLine y={1000} stroke="#22c55e" strokeDasharray="3 3" opacity={0.3} label={{ position: 'insideTopLeft', value: 'Quiet', fill: '#22c55e', fontSize: 10 }} />
            <ReferenceLine y={2000} stroke="#3b82f6" strokeDasharray="3 3" opacity={0.3} label={{ position: 'insideTopLeft', value: 'B-Class', fill: '#3b82f6', fontSize: 10 }} />
            <ReferenceLine y={3000} stroke="#eab308" strokeDasharray="3 3" opacity={0.3} label={{ position: 'insideTopLeft', value: 'C-Class', fill: '#eab308', fontSize: 10 }} />
            <ReferenceLine y={4000} stroke="#f97316" strokeDasharray="3 3" opacity={0.3} label={{ position: 'insideTopLeft', value: 'M-Class', fill: '#f97316', fontSize: 10 }} />

            <XAxis dataKey="time" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[0, 'dataMax + 1000']} />
            <Tooltip content={<CustomTooltip />} />
            
            <ReferenceLine x="0m" stroke="#00d9ff" strokeDasharray="3 3" label={{ position: 'top', value: 'NOW', fill: '#00d9ff', fontSize: 10, fontWeight: 'bold' }} />
            
            <Line type="monotone" dataKey="flux" data={data} name="Observed" stroke="#00d9ff" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="flux" data={predictedData} name="Predicted" stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            
            <Scatter data={currentPoint} fill="#00d9ff" name="Current" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
