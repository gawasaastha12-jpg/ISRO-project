import React, { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { Activity, RefreshCw, AlertTriangle } from "lucide-react";

interface PredRow {
  timestamp: string;
  phase: string;
  prob_C: number;
  prob_M: number;
  prob_X: number;
}

const POLL_MS = 10_000; // poll every 10 s — matches write_predictions.py cadence

function fmtTime(ts: string) {
  // ISO → HH:MM:SS UTC display
  try {
    const d = new Date(ts + "Z"); // treat as UTC
    return d.toISOString().slice(11, 19);
  } catch {
    return ts.slice(11, 19) || ts;
  }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0b1022] border border-[#00d9ff]/30 rounded p-2 text-[10px] font-mono">
      <p className="text-[#6b7590] mb-1">{label} UTC</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-bold">
          {p.name}: {Number(p.value).toFixed(2)}%
        </p>
      ))}
    </div>
  );
};

export function TrajectorySummaryPanel() {
  const [rows, setRows] = useState<PredRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState("--:--:--");

  const load = useCallback(async () => {
    try {
      const resp = await fetch("/api/v1/predictions/history?n=60");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (json.error) { setError(json.error); setRows([]); return; }
      setRows(json.rows ?? []);
      setError(null);
      const now = new Date();
      setLastRefresh(
        `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`
      );
    } catch (e: any) {
      setError(e.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Derived: last phase + dominant class
  const latestRow = rows[rows.length - 1];
  const latestPhase = latestRow?.phase ?? "—";
  const maxC = latestRow?.prob_C ?? 0;
  const maxM = latestRow?.prob_M ?? 0;
  const maxX = latestRow?.prob_X ?? 0;

  // Chart data: format timestamps for x-axis
  const chartData = rows.map((r) => ({
    t: fmtTime(r.timestamp),
    "C-class": r.prob_C,
    "M-class": r.prob_M,
    "X-class": r.prob_X,
    phase: r.phase,
  }));

  // Tick decimation: only show every Nth label to avoid overlap
  const tickInterval = Math.max(1, Math.floor(rows.length / 8));

  return (
    <div className="flex flex-col p-5 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#00d9ff]" />
          <span
            className="font-bold tracking-wider text-xs uppercase text-[#e8ecf5]"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            Live Nowcast Probability Timeline
          </span>
          <span className="text-[8px] font-mono text-[#6b7590] border border-[#1e2740] rounded px-1.5 py-0.5 uppercase">
            XGBoost 5-min · Real-time
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-[9px] font-mono text-[#6b7590] uppercase">
            Last: <span className="text-[#22d3ee]">{lastRefresh}</span>
          </span>
          <button
            onClick={load}
            title="Refresh"
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#6b7590] hover:text-[#22d3ee] ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 mb-3 shrink-0">
        <div className="flex flex-col bg-black/30 border border-[#1e2740] rounded px-3 py-1.5">
          <span className="text-[8px] text-[#6b7590] uppercase tracking-wider font-mono">Phase</span>
          <span className="text-[11px] font-bold text-[#22d3ee] font-mono">{latestPhase}</span>
        </div>
        <div className="flex flex-col bg-black/30 border border-[#ff9f1c]/30 rounded px-3 py-1.5">
          <span className="text-[8px] text-[#6b7590] uppercase tracking-wider font-mono">C-class</span>
          <span className="text-[11px] font-bold text-[#ff9f1c] font-mono">{maxC.toFixed(2)}%</span>
        </div>
        <div className="flex flex-col bg-black/30 border border-[#ff3b5c]/30 rounded px-3 py-1.5">
          <span className="text-[8px] text-[#6b7590] uppercase tracking-wider font-mono">M-class</span>
          <span className="text-[11px] font-bold text-[#ff3b5c] font-mono">{maxM.toFixed(2)}%</span>
        </div>
        <div className="flex flex-col bg-black/30 border border-[#7c3aed]/30 rounded px-3 py-1.5">
          <span className="text-[8px] text-[#6b7590] uppercase tracking-wider font-mono">X-class</span>
          <span className="text-[11px] font-bold text-[#7c3aed] font-mono">{maxX.toFixed(2)}%</span>
        </div>
        <div className="flex flex-col bg-black/30 border border-[#1e2740] rounded px-3 py-1.5">
          <span className="text-[8px] text-[#6b7590] uppercase tracking-wider font-mono">Data Points</span>
          <span className="text-[11px] font-bold text-[#e8ecf5] font-mono">{rows.length} rows</span>
        </div>
        <div className="flex flex-col bg-black/30 border border-[#1e2740] rounded px-3 py-1.5">
          <span className="text-[8px] text-[#6b7590] uppercase tracking-wider font-mono">Poll Rate</span>
          <span className="text-[11px] font-bold text-[#10b981] font-mono">10 s</span>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-[280px] relative">
        {loading && rows.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 text-[#6b7590]">
            <div className="w-8 h-8 border-2 border-[#00d9ff]/30 border-t-[#00d9ff] rounded-full animate-spin" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Loading live data…</span>
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 text-center px-8">
            <AlertTriangle className="w-8 h-8 text-[#f59e0b]" />
            <p className="text-[10px] font-mono text-[#6b7590] leading-relaxed">{error}</p>
            <code className="text-[9px] bg-black/40 text-[#22d3ee] px-3 py-1 rounded font-mono border border-[#1e2740]">
              python logs/write_predictions.py
            </code>
          </div>
        )}

        {rows.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff9f1c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ff9f1c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff3b5c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ff3b5c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradX" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" vertical={false} />

              <XAxis
                dataKey="t"
                tick={{ fill: "#6b7590", fontSize: 9, fontFamily: "monospace" }}
                interval={tickInterval}
                axisLine={{ stroke: "#1e2740" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "#6b7590", fontSize: 9, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                width={38}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Threshold reference lines */}
              <ReferenceLine y={10} stroke="#ff9f1c" strokeDasharray="4 2" strokeOpacity={0.4}
                label={{ value: "C Watch", position: "insideTopLeft", fill: "#ff9f1c", fontSize: 8 }} />
              <ReferenceLine y={5} stroke="#ff3b5c" strokeDasharray="4 2" strokeOpacity={0.4}
                label={{ value: "M Warn", position: "insideTopLeft", fill: "#ff3b5c", fontSize: 8 }} />
              <ReferenceLine y={2} stroke="#7c3aed" strokeDasharray="4 2" strokeOpacity={0.4}
                label={{ value: "X Alert", position: "insideTopLeft", fill: "#7c3aed", fontSize: 8 }} />

              <Area type="monotone" dataKey="C-class" stroke="#ff9f1c" strokeWidth={2}
                fill="url(#gradC)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              <Area type="monotone" dataKey="M-class" stroke="#ff3b5c" strokeWidth={2}
                fill="url(#gradM)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
              <Area type="monotone" dataKey="X-class" stroke="#7c3aed" strokeWidth={2}
                fill="url(#gradX)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />

              <Legend
                wrapperStyle={{ paddingTop: 8, fontSize: 9, fontFamily: "monospace" }}
                iconType="square"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[#1e2740] shrink-0 flex items-center justify-between">
        <p className="text-[9px] font-mono text-[#6b7590]">
          Sourced from <span className="text-[#22d3ee]">logs/team_predictions.csv</span> · Model: XGBoost 5-min · Validation TSS +0.365
        </p>
        <span className="text-[9px] font-mono text-[#6b7590]">Last {rows.length} pts · polling {POLL_MS / 1000}s</span>
      </div>
    </div>
  );
}
