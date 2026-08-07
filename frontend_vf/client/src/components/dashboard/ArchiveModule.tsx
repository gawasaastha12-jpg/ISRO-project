import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, 
  ReferenceLine, CartesianGrid, Legend 
} from 'recharts';
import { 
  Clock, Zap, AlertTriangle, ShieldCheck, Activity, 
  RefreshCw, Flame, Eye, Layers, Compass, Cpu 
} from 'lucide-react';

interface NowcastData {
  timestamp: string;
  timestamp_utc_display?: string;
  phase: string;
  flare_class: string;
  flux_cps: number;
  hel1os_activity_score: number;
  spectral_hardness: number;
  severity_index: number;
}

interface HorizonForecast {
  horizon: string;
  horizon_minutes: number;
  target_time: string;
  target_time_utc?: string;
  forecast: string;
  confidence: number;
  probabilities: Record<string, number>;
  risk_level: string;
  flare_onset_prob: number;
}

interface LightcurvePoint {
  timestamp: string;
  time_display: string;
  time_offset_min: number;
  solexs_cps: number;
  hel1os_cps: number;
  phase: string;
  flare_class: string;
  is_inference_instant: boolean;
  is_future: boolean;
}

interface ArchivePayload {
  status: string;
  query_timestamp: string;
  query_timestamp_utc?: string;
  inference_instant_index: number;
  nowcast: NowcastData;
  multi_horizon: HorizonForecast[];
  lightcurves: LightcurvePoint[];
}

const PRESET_EVENTS = [
  { label: '⚡ X1.2 Flare Peak (2024-02-12 05:34 UTC)', utc: '2024-02-12T05:34:00Z', desc: 'Solar Max Event' },
  { label: '📈 Impulsive Phase (2024-02-12 05:15 UTC)', utc: '2024-02-12T05:15:00Z', desc: 'Rapid Flux Rise' },
  { label: '🛡️ Pre-Flare Baseline (2024-02-12 04:00 UTC)', utc: '2024-02-12T04:00:00Z', desc: 'Background Quiet' },
  { label: '📉 Decay Phase (2024-02-12 06:45 UTC)', utc: '2024-02-12T06:45:00Z', desc: 'Post-Peak Cooling' },
  { label: '🔴 M-Class Flare (2024-03-23 11:20 UTC)', utc: '2024-03-23T11:20:00Z', desc: 'Moderate Eruption' },
  { label: '🟢 Nominal Sun (2024-04-10 14:00 UTC)', utc: '2024-04-10T14:00:00Z', desc: 'Quiet State' },
];

export function ArchiveModule() {
  // ISO string in UTC
  const [selectedUtcIso, setSelectedUtcIso] = useState<string>('2024-02-12T05:34:00Z');
  // UTC datetime string for input field
  const [utcInputVal, setUtcInputVal] = useState<string>('2024-02-12T05:34');
  const [useLogScale, setUseLogScale] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveData, setArchiveData] = useState<ArchivePayload | null>(null);

  // Fetch telemetry from backend
  const fetchArchiveData = async (utcIso: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/archive?timestamp=${encodeURIComponent(utcIso)}`);
      if (!res.ok) {
        throw new Error(`Archive API responded with status ${res.status}`);
      }
      const data: ArchivePayload = await res.json();
      setArchiveData(data);
    } catch (err: any) {
      console.error('Failed to fetch archive data:', err);
      setError(err.message || 'Failed to query historical telemetry slice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchiveData(selectedUtcIso);
  }, [selectedUtcIso]);

  // Handle UTC datetime picker change
  const handleUtcPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUtcInputVal(val);
    if (!val) return;
    
    // Parse as UTC ISO string directly
    const formattedIso = `${val}:00Z`;
    setSelectedUtcIso(formattedIso);
  };

  // Handle Preset Button Click
  const handlePresetSelect = (utcIso: string) => {
    setSelectedUtcIso(utcIso);
    setUtcInputVal(utcIso.slice(0, 16));
  };

  // Format Helper for UTC Timestamps
  const formatUtcString = (isoStr: string) => {
    const dt = new Date(isoStr);
    return isNaN(dt.getTime()) ? isoStr : dt.toUTCString().replace('GMT', 'UTC');
  };

  // Trajectory Phase Color Helpers
  const getPhaseBadgeStyle = (phase: string) => {
    switch (phase) {
      case 'Impulsive':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse';
      case 'Peak':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.4)]';
      case 'Decay':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]';
      default:
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
    }
  };

  const getFlareClassStyle = (flareClass: string) => {
    switch (flareClass) {
      case 'X-Class':
        return 'bg-gradient-to-r from-red-600 to-rose-500 text-white font-black shadow-[0_0_25px_rgba(225,29,72,0.6)] border-red-400/80';
      case 'M-Class':
        return 'bg-gradient-to-r from-amber-600 to-orange-500 text-white font-bold shadow-[0_0_15px_rgba(245,158,11,0.5)] border-amber-400';
      case 'C-Class':
        return 'bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-bold border-yellow-300';
      case 'B-Class':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-slate-900 text-slate-400 border-slate-700';
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/50 font-bold';
      case 'ELEVATED':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50 font-semibold';
      case 'MODERATE':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 w-full text-starlight-white font-sans">
      
      {/* ── HEADER & TIME-TRAVEL CONTROL DESK ───────────────────────────────────── */}
      <div className="bg-[#131a2e]/90 border border-[#1e2740] rounded-xl p-6 shadow-2xl backdrop-blur relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Compass className="w-5 h-5 animate-spin-slow" />
              </span>
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                  Historical Telemetry & Time-Travel Archive (UTC Standard)
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono">
                    Real Aditya-L1 Telemetry
                  </span>
                </h1>
                <p className="text-xs text-[#6b7590]">
                  Query SoLEXS & HEL1OS observation lightcurves from raw Aditya-L1 payloads at any historical UTC instant.
                </p>
              </div>
            </div>
          </div>

          {/* Time Picker Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-[#0a0e1a]/80 p-3 rounded-lg border border-white/10">
            <div className="flex flex-col">
              <label className="text-[10px] font-mono text-[#6b7590] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Select Instant (UTC):
              </label>
              <input
                type="datetime-local"
                value={utcInputVal}
                onChange={handleUtcPickerChange}
                className="bg-[#131a2e] border border-cyan-500/40 rounded px-3 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-400 shadow-inner"
              />
            </div>

            <button
              onClick={() => fetchArchiveData(selectedUtcIso)}
              disabled={loading}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded border border-cyan-300/40 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Querying...' : 'Query Instant'}</span>
            </button>
          </div>
        </div>

        {/* Formatted UTC Datetime Badges */}
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[#6b7590] uppercase tracking-wider text-[10px]">Active Observation Target:</span>
            <span className="px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
              {archiveData?.query_timestamp_utc || formatUtcString(selectedUtcIso)}
            </span>
          </div>

          <div className="text-[10px] text-[#6b7590] flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Strict Data Leakage Prevention ([T-60m, T=0] Model Ingestion Only)</span>
          </div>
        </div>

        {/* Quick Select Event Chips */}
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="text-[10px] font-mono text-[#6b7590] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Historical Flare Benchmark Presets (UTC):
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_EVENTS.map(preset => (
              <button
                key={preset.utc}
                onClick={() => handlePresetSelect(preset.utc)}
                className={`px-3 py-1 text-[11px] rounded font-medium border transition-all duration-200 ${
                  selectedUtcIso === preset.utc
                    ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'bg-[#0a0e1a]/60 text-[#8c9bbd] border-white/10 hover:border-cyan-500/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-xl text-red-300 text-xs font-mono flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── NOWCASTING ENGINE INSTANT STATE PANEL (T=0 UTC) ──────────────────────────── */}
      {archiveData && archiveData.nowcast && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Trajectory Phase */}
          <div className="bg-[#131a2e] border border-[#1e2740] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-mono text-[#6b7590] uppercase tracking-wider">Nowcast Phase (T=0 UTC)</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-1">
              <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-sm font-bold tracking-wider ${getPhaseBadgeStyle(archiveData.nowcast.phase)}`}>
                <Zap className="w-4 h-4" />
                <span>{archiveData.nowcast.phase.toUpperCase()} PHASE</span>
              </div>
              <p className="text-[11px] text-[#6b7590] mt-2">
                {archiveData.nowcast.phase === 'Impulsive' && 'Flux rising rapidly (>0.15 cps/s). High flare risk.'}
                {archiveData.nowcast.phase === 'Peak' && 'Peak emission reached. Maximum energy flux.'}
                {archiveData.nowcast.phase === 'Decay' && 'Cooling phase. Flux decreasing steadily.'}
                {archiveData.nowcast.phase === 'Background' && 'Quiet baseline solar activity.'}
              </p>
            </div>
          </div>

          {/* Card 2: Immediate Energy Level */}
          <div className="bg-[#131a2e] border border-[#1e2740] rounded-xl p-5 relative overflow-hidden flex flex-col justify-between shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-mono text-[#6b7590] uppercase tracking-wider">Energy Classification</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-1">
              <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-black tracking-widest ${getFlareClassStyle(archiveData.nowcast.flare_class)}`}>
                {archiveData.nowcast.flare_class}
              </div>
              <p className="text-[11px] text-[#6b7590] mt-2 font-mono">
                Severity Index: <span className="text-white font-bold">{(archiveData.nowcast.severity_index * 100).toFixed(1)}%</span>
              </p>
            </div>
          </div>

          {/* Card 3: SoLEXS Flux */}
          <div className="bg-[#131a2e] border border-[#1e2740] rounded-xl p-5 flex flex-col justify-between shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-mono text-[#6b7590] uppercase tracking-wider">SoLEXS Soft X-Ray (T=0 UTC)</span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-1">
              <div className="text-2xl font-black font-mono text-cyan-300 tracking-tight">
                {archiveData.nowcast.flux_cps.toLocaleString()} <span className="text-xs font-normal text-[#6b7590]">cps</span>
              </div>
              <p className="text-[10px] text-[#6b7590] mt-1 font-mono">2 – 22 keV Energy Channel</p>
            </div>
          </div>

          {/* Card 4: HEL1OS Hard X-Ray */}
          <div className="bg-[#131a2e] border border-[#1e2740] rounded-xl p-5 flex flex-col justify-between shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-mono text-[#6b7590] uppercase tracking-wider">HEL1OS Hard X-Ray (T=0 UTC)</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-1">
              <div className="text-2xl font-black font-mono text-purple-300 tracking-tight">
                {archiveData.nowcast.hel1os_activity_score.toFixed(1)} <span className="text-xs font-normal text-[#6b7590]">cps</span>
              </div>
              <p className="text-[10px] text-[#6b7590] mt-1 font-mono">
                Hardness Ratio: <span className="text-purple-300 font-bold">{archiveData.nowcast.spectral_hardness}</span>
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ── SYNCHRONIZED DUAL-PANEL LIGHTCURVES WITH INFERENCE INSTANT LINE ─── */}
      {archiveData && archiveData.lightcurves && (
        <div className="bg-[#131a2e] border border-[#1e2740] rounded-xl p-6 shadow-2xl relative">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                Real Aditya-L1 SoLEXS & HEL1OS Telemetry Trajectory (-60m to +60m UTC)
              </h2>
              <p className="text-[11px] text-[#6b7590]">
                Vertical red glowing line marks the exact <span className="text-red-400 font-bold">Inference Instant (T=0 UTC)</span>.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs font-mono">
              <button
                onClick={() => setUseLogScale(!useLogScale)}
                className="px-3 py-1 rounded bg-[#0a0e1a] border border-cyan-500/30 text-cyan-300 hover:border-cyan-400 text-[10px] uppercase tracking-wider font-bold transition-all"
              >
                Scale: {useLogScale ? 'Logarithmic (Log10)' : 'Linear'}
              </button>
            </div>
          </div>

          <div className="h-[380px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={archiveData.lightcurves} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" opacity={0.6} />
                <XAxis 
                  dataKey="time_display" 
                  stroke="#6b7590"
                  tick={{ fill: '#6b7590', fontSize: 10, fontFamily: 'monospace' }}
                  interval={10}
                />
                <YAxis 
                  scale={useLogScale ? 'log' : 'auto'}
                  domain={useLogScale ? [1, 'auto'] : [0, 'auto']}
                  allowDataOverflow
                  stroke="#6b7590"
                  tick={{ fill: '#6b7590', fontSize: 10, fontFamily: 'monospace' }}
                  unit=" cps"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                />

                {/* Vertical Reference Line at Inference Instant T=0 UTC */}
                <ReferenceLine 
                  x={archiveData.lightcurves[archiveData.inference_instant_index]?.time_display} 
                  stroke="#ef4444" 
                  strokeWidth={2.5} 
                  strokeDasharray="4 4"
                  label={{ 
                    value: "⚡ INFERENCE INSTANT (T=0 UTC)", 
                    position: "top", 
                    fill: "#ef4444", 
                    fontSize: 10, 
                    fontWeight: "bold",
                    fontFamily: "monospace"
                  }} 
                />

                {/* SoLEXS Soft X-Ray Line */}
                <Line 
                  type="monotone" 
                  dataKey="solexs_cps" 
                  name="SoLEXS Soft X-Ray (2-22 keV)" 
                  stroke="#06b6d4" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 5, fill: '#06b6d4', stroke: '#fff' }}
                />

                {/* HEL1OS Hard X-Ray Line */}
                <Line 
                  type="monotone" 
                  dataKey="hel1os_cps" 
                  name="HEL1OS Hard X-Ray (8-150 keV)" 
                  stroke="#a855f7" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 5, fill: '#a855f7', stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-[#6b7590]">
            <div className="flex items-center space-x-6">
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-cyan-500/20 border border-cyan-400 inline-block" />
                <span>Historical Telemetry Ingested ([T-60m, T=0])</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-500/20 border border-purple-400 inline-block" />
                <span>Future Context Slice ((T=0, T+60m])</span>
              </span>
            </div>
            <span>1-Minute Cadence | Real Aditya-L1 Mission Payload Datasets</span>
          </div>
        </div>
      )}

      {/* ── MULTI-HORIZON FORECAST HORIZON PANEL (5m, 10m, 15m, 30m, 60m UTC) ─────────── */}
      {archiveData && archiveData.multi_horizon && (
        <div className="bg-[#131a2e] border border-[#1e2740] rounded-xl p-6 shadow-2xl flex flex-col space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              Multi-Horizon Forecast Suite (Evaluated from T=0 UTC)
            </h2>
            <p className="text-[11px] text-[#6b7590]">
              Calculated probabilities across 5 forward horizons evaluated strictly using [T-60m, T=0] telemetry.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {archiveData.multi_horizon.map((h, idx) => (
              <div 
                key={h.horizon}
                className="bg-[#0a0e1a] border border-[#1e2740] hover:border-cyan-500/40 rounded-xl p-4 flex flex-col justify-between transition-all duration-200 shadow-md group"
              >
                <div>
                  {/* Horizon Header */}
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/5">
                    <span className="text-sm font-black font-mono text-cyan-300">
                      +{h.horizon}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded border ${getRiskBadge(h.risk_level)}`}>
                      {h.risk_level}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-[#6b7590] mb-3">
                    Target: <span className="text-slate-300">{h.target_time_utc || h.target_time.slice(11, 19) + ' UTC'}</span>
                  </div>

                  {/* Primary Forecast Badge */}
                  <div className="mb-4">
                    <span className="text-[9px] text-[#6b7590] uppercase tracking-wider block mb-1">Predicted Class</span>
                    <div className="text-lg font-black font-mono text-white flex items-center space-x-2">
                      <span>{h.forecast}</span>
                      <span className="text-xs text-cyan-400 font-normal">({(h.confidence * 100).toFixed(1)}%)</span>
                    </div>
                  </div>

                  {/* Flare Onset Risk Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-[#6b7590]">Flare Onset Risk (C/M/X):</span>
                      <span className="text-amber-400 font-bold">{(h.flare_onset_prob * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-amber-500 to-red-500 h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, h.flare_onset_prob * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Probability Breakdown Stack */}
                  <div className="space-y-1 pt-2 border-t border-white/5 text-[10px] font-mono">
                    <div className="flex justify-between text-[#6b7590]">
                      <span>Quiet:</span>
                      <span className="text-slate-300">{(h.probabilities['Quiet'] * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-[#6b7590]">
                      <span>B-like:</span>
                      <span className="text-cyan-300">{(h.probabilities['B-like'] * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-[#6b7590]">
                      <span>C-like:</span>
                      <span className="text-yellow-300">{(h.probabilities['C-like'] * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-[#6b7590]">
                      <span>M-like:</span>
                      <span className="text-amber-400 font-bold">{(h.probabilities['M-like'] * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-[#6b7590]">
                      <span>X-like:</span>
                      <span className="text-red-400 font-bold">{(h.probabilities['X-like'] * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-[#6b7590]">
                  <span>Horizon Model:</span>
                  <span className="text-cyan-400 font-bold">LGBM/XGB +{h.horizon}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// Custom Tooltip for Recharts Lightcurve (100% UTC)
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data: LightcurvePoint = payload[0].payload;
    return (
      <div className="bg-[#0a0e1a]/95 border border-cyan-500/40 p-3 rounded-lg shadow-2xl text-xs font-mono text-white space-y-1 min-w-[200px] backdrop-blur">
        <div className="font-bold text-cyan-300 pb-1 border-b border-white/10 flex justify-between">
          <span>{data.time_display}</span>
          <span className="text-[#6b7590]">Offset: {data.time_offset_min}m</span>
        </div>

        {data.is_inference_instant && (
          <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider py-0.5">
            ⚡ INFERENCE INSTANT (T=0 UTC)
          </div>
        )}

        <div className="flex justify-between pt-1">
          <span className="text-[#6b7590]">SoLEXS Soft X-Ray:</span>
          <span className="text-cyan-300 font-bold">{data.solexs_cps} cps</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7590]">HEL1OS Hard X-Ray:</span>
          <span className="text-purple-300 font-bold">{data.hel1os_cps} cps</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-white/5">
          <span className="text-[#6b7590]">Phase / Class:</span>
          <span className="text-amber-300 font-bold">{data.phase} ({data.flare_class})</span>
        </div>
      </div>
    );
  }
  return null;
}

export default ArchiveModule;
