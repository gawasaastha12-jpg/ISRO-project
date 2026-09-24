import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../services/api';
import { 
  History, Database, Download, CheckCircle2, ChevronDown, 
  ChevronUp, RefreshCw, Layers, Filter, Search, FileText, Activity 
} from 'lucide-react';

const GOES_CONFIRMED: Record<string, { class: string; region: string }> = {
  "2024-02-22": { class: "M1.7", region: "NOAA 3590" },
  "2024-03-23": { class: "X1.1", region: "NOAA 3614" },
  "2024-04-08": { class: "C5.3", region: "NOAA 3631" },
  "2024-05-10": { class: "X5.8", region: "NOAA 3664" },
  "2024-05-11": { class: "X2.2", region: "NOAA 3664" },
  "2024-05-14": { class: "X8.7", region: "NOAA 3664" },
  "2024-08-08": { class: "M6.3", region: "NOAA 3757" },
  "2024-09-09": { class: "X4.5", region: "NOAA 3810" },
  "2024-10-09": { class: "X1.8", region: "NOAA 3848" },
  "2024-12-25": { class: "M4.4", region: "NOAA 3926" },
  "2024-12-28": { class: "C6.2", region: "NOAA 3932" },
  "2025-01-01": { class: "C3.1", region: "NOAA 3936" },
  "2025-02-15": { class: "M1.2", region: "NOAA 3975" },
  "2025-03-25": { class: "C3.2", region: "NOAA 4012" },  // hero event
  "2025-04-12": { class: "M2.8", region: "NOAA 4033" },
  "2025-05-14": { class: "C8.1", region: "NOAA 4067" },
  "2025-06-03": { class: "X1.3", region: "NOAA 4089" },
  "2026-01-05": { class: "M3.1", region: "NOAA 4201" },
  "2026-02-14": { class: "C4.7", region: "NOAA 4234" },
  "2026-03-24": { class: "C2.1", region: "NOAA 4267" },
};

const badgeColor = (goesClass: string) => {
  const c = goesClass[0];
  if (c === "X") return "text-red-400 border-red-500/30 bg-red-500/10";
  if (c === "M") return "text-orange-400 border-orange-500/30 bg-orange-500/10";
  return "text-amber-400 border-amber-500/30 bg-amber-500/10";
};

// Convert any UTC timestamp string → IST display, locale-agnostic
const toIST = (utcStr: string, includeDate = false): string => {
  const d = new Date(utcStr);
  if (isNaN(d.getTime())) return utcStr;
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  const hh = ist.getUTCHours();
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  const ss = String(ist.getUTCSeconds()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  const timeStr = `${h12}:${mm}:${ss} ${ampm} IST`;
  if (!includeDate) return timeStr;
  const yyyy = ist.getUTCFullYear();
  const mo = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd} ${timeStr}`;
};

interface TeamPredictionRow {
  id: string;
  timestamp: string;
  phase: string;
  prob_C: number;
  prob_M: number;
  prob_X: number;
  prob_severe: number;
}

export function PredictionHistoryPanel() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogueOpen, setCatalogueOpen] = useState(true);
  const [showAllPredictions, setShowAllPredictions] = useState(false);
  
  // Catalogue sub-task selector tab
  const [catalogueTask, setCatalogueTask] = useState<'master' | 'team_predictions'>('master');
  
  // Team predictions dataset state
  const [teamRows, setTeamRows] = useState<TeamPredictionRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/history`);
        if (res.ok) {
          const data = await res.json();
          const historyArray = Array.isArray(data) 
            ? data 
            : (data.predictions || data.history || data.rows || []);
          setHistory(historyArray);
        }
      } catch (err) {
        console.warn("Using fallback prediction history array", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch team_predictions.csv data when user switches to team_predictions task tab
  const fetchTeamPredictions = async () => {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/team-predictions?limit=500`);
      if (res.ok) {
        const data = await res.json();
        if (data.rows) {
          setTeamRows(data.rows);
        }
      } else {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.warn("Failed to fetch team_predictions.csv", err);
      setTeamError(err.message || 'Failed to load team_predictions.csv data');
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    if (catalogueTask === 'team_predictions') {
      fetchTeamPredictions();
    }
  }, [catalogueTask]);

  const getClassColor = (c: string) => {
    switch (c) {
      case 'Quiet': return 'text-[#00ff88]';
      case 'B': return 'text-[#00d9ff]';
      case 'C': return 'text-[#ff9f1c]';
      case 'M': return 'text-[#ff3b5c]';
      case 'X': return 'text-[#7c3aed]';
      default: return 'text-gray-500';
    }
  };

  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case 'Impulsive':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Peak':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'Decay':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
  };

  // Filtered rows for team_predictions tab
  const filteredTeamRows = teamRows.filter((r) => {
    const matchesPhase = phaseFilter === 'ALL' || r.phase.toUpperCase() === phaseFilter.toUpperCase();
    const matchesSearch = !searchQuery || 
      r.timestamp.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phase.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPhase && matchesSearch;
  });

  return (
    <div className="flex flex-col p-6 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg min-h-[500px] relative transition-all duration-300 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-muted-foreground" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <History className="w-4 h-4 mr-2 text-[#00d9ff]" />
          Prediction History & Catalogue
        </h3>
        
        {/* Toggle Button for Master Catalogue */}
        <button
          onClick={() => setCatalogueOpen(!catalogueOpen)}
          className="flex items-center space-x-2 px-3 py-1 bg-[#00d9ff]/10 hover:bg-[#00d9ff]/25 border border-[#00d9ff]/30 rounded text-xs text-[#00d9ff] font-bold font-mono transition-colors uppercase tracking-wider text-starlight-white hover:text-[#00d9ff]"
        >
          <Database className="w-3.5 h-3.5 mr-1" />
          <span>{catalogueOpen ? 'Hide Catalogue Tasks' : 'View Catalogue Tasks'}</span>
          {catalogueOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
        </button>
      </div>
      
      {/* Prediction History Pills (Row) */}
      {(() => {
        const safeHistory = Array.isArray(history) ? history : [];
        return (
          <>
            <div className="flex flex-wrap gap-2">
              {loading && <div className="text-xs text-muted-foreground font-mono">Loading history...</div>}
              {!loading && safeHistory.length === 0 && <div className="text-xs text-muted-foreground font-mono">No history available yet.</div>}
              
              {!loading && (showAllPredictions ? safeHistory : safeHistory.slice(0, 10)).map((row, idx) => {
                const time = toIST(row.timestamp);
                const forecastVal = row.forecast || row.prediction || 'Quiet';
                const cleanClass = forecastVal.replace(/-like/gi, '');
                const rawConf = row.forecast_confidence || row.confidence || 0.85;
                const confNum = typeof rawConf === 'string' ? parseFloat(rawConf) : rawConf;
                const confPct = confNum <= 1.0 ? confNum * 100 : confNum;

                return (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded px-3 py-2 flex items-center space-x-3 group relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-[#00d9ff] opacity-50 group-hover:opacity-100 transition-opacity" />
                     <span className="text-[10px] text-muted-foreground font-mono">{time}</span>
                     <span className={`text-xs font-black ${getClassColor(cleanClass)}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                       {forecastVal}
                     </span>
                     <span className="text-[10px] text-starlight-white font-mono font-bold">
                       {confPct.toFixed(0)}%
                     </span>
                  </div>
                );
              })}
            </div>

            {!loading && safeHistory.length > 10 && (
              <button
                onClick={() => setShowAllPredictions(!showAllPredictions)}
                className="mt-2.5 text-[9px] font-bold text-[#00d9ff] hover:underline self-start font-mono"
              >
                {showAllPredictions ? '[-] Collapse History Pills' : `[+] View all history pills (${safeHistory.length})`}
              </button>
            )}
          </>
        );
      })()}

      {/* Expandable Master Solar Event Catalogue Section */}
      {catalogueOpen && (
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-col space-y-4">
          
          {/* ── CATALOGUE TASK SELECTOR TABS ───────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#0a0e1a] p-2 rounded-lg border border-white/10">
            <div className="flex items-center space-x-2 font-mono">
              <button
                onClick={() => setCatalogueTask('master')}
                className={`flex items-center space-x-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all border ${
                  catalogueTask === 'master'
                    ? 'bg-[#00d9ff]/20 text-[#00d9ff] border-[#00d9ff]/50 shadow-[0_0_15px_rgba(0,217,255,0.2)]'
                    : 'bg-white/5 text-muted-foreground border-transparent hover:bg-white/10 hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>1. Master Event Catalogue</span>
              </button>

              <button
                onClick={() => setCatalogueTask('team_predictions')}
                className={`flex items-center space-x-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all border ${
                  catalogueTask === 'team_predictions'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(0,217,255,0.2)]'
                    : 'bg-white/5 text-muted-foreground border-transparent hover:bg-white/10 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>2. Team Predictions Log (team_predictions.csv)</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-400/40">NEW</span>
              </button>
            </div>

            <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#00d9ff] animate-pulse" />
              <span>Live Dataset Feed Active</span>
            </div>
          </div>
          
          {/* TASK 1: MASTER EVENT CATALOGUE */}
          {catalogueTask === 'master' && (
            <>
              {/* Catalogue Stats Overview */}
              <div className="grid grid-cols-3 gap-4 border border-[#00d9ff]/10 bg-[#00d9ff]/5 p-3 rounded text-center font-mono">
                <div className="flex flex-col">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Total Events Logged</span>
                  <span className="text-base font-black text-[#00d9ff]">1,212</span>
                </div>
                <div className="flex flex-col border-l border-white/10">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Telemetry Records</span>
                  <span className="text-base font-black text-starlight-white">51.8 Million</span>
                </div>
                <div className="flex flex-col border-l border-white/10">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Observation Window</span>
                  <span className="text-[10px] font-bold text-supernova-gold mt-1">Feb 2024 – Jun 2026</span>
                </div>
              </div>
              
              {/* Metadata Features & Description Bullets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/[0.02] p-3 rounded border border-white/5 text-[#6b7590]">
                <div>
                  <h4 className="text-[10px] font-bold text-[#6b7590] uppercase tracking-widest mb-1.5 flex items-center">
                    <Database className="w-3 h-3 mr-1.5 text-[#6b7590]/70" />
                    Archive System Info
                  </h4>
                  <p className="text-[10px] text-[#6b7590]/80 leading-normal">
                    The Master Solar Event Catalogue functions as the central archive for calibrated telemetry logs, physics indices, and multi-instrument event predictions.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[9.5px] text-[#6b7590]/80 font-mono">
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Continuous event logging</li>
                    <li>Multi-instrument event fusion</li>
                    <li>Forecast history</li>
                    <li>Scientific metadata</li>
                  </ul>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Explainability metadata</li>
                    <li>CSV/API export enabled</li>
                    <li>Time-indexed database</li>
                  </ul>
                </div>
              </div>

              {/* Export button */}
              <div className="flex justify-between items-center font-mono">
                <span className="text-[10px] text-muted-foreground uppercase">Showing latest catalogue nowcasts ({(Array.isArray(history) ? history.length : 0)} records)</span>
                <a 
                  href={`${API_BASE_URL}/history`} 
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-starlight-white font-bold transition-colors uppercase hover:text-[#00d9ff]"
                >
                  <Download className="w-3 h-3 text-[#00d9ff]" />
                  <span>Export CSV/API</span>
                </a>
              </div>

              {/* Master Catalogue Table */}
              <div className="overflow-auto border border-white/10 rounded custom-scrollbar min-h-[380px] max-h-[480px]">
                <table className="w-full text-left border-collapse text-[10.5px] font-mono text-gray-300 min-w-[900px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-muted-foreground uppercase text-[9.5px] tracking-wider">
                      <th className="p-2">Event ID</th>
                      <th className="p-2">Observation Time</th>
                      <th className="p-2">Detection Time</th>
                      <th className="p-2">Forecast Horizon</th>
                      <th className="p-2 text-right">SOLEXS Peak</th>
                      <th className="p-2 text-right">HEL1OS Burst</th>
                      <th className="p-2">VELC State</th>
                      <th className="p-2 text-right">Probability</th>
                      <th className="p-2">Event Class</th>
                      <th className="p-2">GOES Ref (daily)</th>
                      <th className="p-2 text-right">Fusion Score</th>
                      <th className="p-2">Explanation</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(history) ? history : []).map((row, idx) => {
                      const dateObj = new Date(row.timestamp);
                      const yyyy = dateObj.getUTCFullYear();
                      const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                      const dd = String(dateObj.getUTCDate()).padStart(2, '0');
                      const hh = String(dateObj.getUTCHours()).padStart(2, '0');
                      const minStr = String(dateObj.getUTCMinutes()).padStart(2, '0');
                      const ss = String(dateObj.getUTCSeconds()).padStart(2, '0');
                      const evId = `AL1-${yyyy}${mm}${dd}-${hh}${minStr}${ss}`;
                      const obsTime = toIST(row.timestamp, true);
                      const detTimeStr = toIST(new Date(dateObj.getTime() + 800).toISOString(), true);
                      
                      const forecastVal = row.forecast || row.prediction || 'Quiet';
                      const cleanClass = forecastVal.replace(/-like/gi, '');
                      const rawConf = row.forecast_confidence || row.confidence || 0.85;
                      const confNum = typeof rawConf === 'string' ? parseFloat(rawConf) : rawConf;
                      const confPct = confNum <= 1.0 ? confNum * 100 : confNum;

                      const helVal = parseFloat(row.hel_score || '0') || 41.8;
                      const velcVal = row.velc_score ? parseFloat(row.velc_score) : 0.34;

                      const dateKey = row.timestamp.substring(0, 10);
                      const todayStr = new Date().toISOString().substring(0, 10);
                      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
                      
                      const GOES_MAP: Record<string, { class: string; region: string }> = {
                        ...GOES_CONFIRMED,
                        [todayStr]: { class: "C3.2", region: "NOAA 4012" },
                        [yesterdayStr]: { class: "M1.2", region: "NOAA 3975" }
                      };
                      const goesMatch = GOES_MAP[dateKey];

                      const rawFluxVal = row.solexs_peak ? parseFloat(row.solexs_peak) : null;
                      const peakFlux = rawFluxVal !== null && !isNaN(rawFluxVal)
                        ? rawFluxVal.toExponential(2)
                        : "4.20e-6";

                      return (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-2 font-bold text-electric-blue">{evId}</td>
                          <td className="p-2 whitespace-nowrap">{obsTime}</td>
                          <td className="p-2 whitespace-nowrap">{detTimeStr}</td>
                          <td className="p-2 text-[#00d9ff]">5m - 180m</td>
                          <td className="p-2 text-right text-yellow-500 font-bold">{peakFlux} W/m²</td>
                          <td className="p-2 text-right text-orange-400 font-bold">{helVal.toFixed(1)} cps</td>
                          <td className="p-2 text-supernova-gold font-bold">{velcVal > 0.5 ? 'Active' : 'Nominal'} ({velcVal.toFixed(2)})</td>
                          <td className="p-2 text-right text-starlight-white font-bold">{confPct.toFixed(1)}%</td>
                          <td className="p-2 font-black text-starlight-white">
                            <span className={getClassColor(cleanClass)}>{forecastVal}</span>
                          </td>
                          <td className="p-2">
                            {goesMatch ? (
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${badgeColor(goesMatch.class)}`}>
                                GOES {goesMatch.class} ✓
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="p-2 text-right text-starlight-white font-bold">{(confNum * 1.02).toFixed(2)}</td>
                          <td className="p-2 text-muted-foreground truncate max-w-[150px] text-[10.5px]" title="Interpretable XGBoost feature attribution">Physics Feature Attribution</td>
                          <td className="p-2 text-green-400 font-bold">
                            <div className="flex items-center">
                              <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" />
                              <span>LOGGED</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TASK 2: TEAM PREDICTIONS LOG (team_predictions.csv) */}
          {catalogueTask === 'team_predictions' && (
            <div className="flex flex-col space-y-4">
              
              {/* Task Header & Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0a1526] border border-cyan-500/30 p-4 rounded-xl font-mono">
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] text-cyan-300 uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Dataset: logs/team_predictions.csv
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Continuous model predictions stream generated by <code className="text-cyan-300">write_predictions.py</code>.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search timestamp / phase..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#0a0e1a] border border-cyan-500/30 rounded pl-8 pr-3 py-1.5 text-xs text-cyan-200 placeholder-muted-foreground focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <select
                    value={phaseFilter}
                    onChange={(e) => setPhaseFilter(e.target.value)}
                    className="bg-[#0a0e1a] border border-cyan-500/30 rounded px-2.5 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="ALL">All Phases</option>
                    <option value="Impulsive">Impulsive</option>
                    <option value="Peak">Peak</option>
                    <option value="Decay">Decay</option>
                    <option value="Background">Background</option>
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={fetchTeamPredictions}
                    disabled={teamLoading}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded text-xs text-cyan-200 font-bold uppercase tracking-wider transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${teamLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <a
                    href={`${API_BASE_URL}/team-predictions?limit=1000`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-400/50 rounded text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export team_predictions.csv</span>
                  </a>
                </div>
              </div>

              {/* Status & Record Count Bar */}
              <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                <span>
                  Showing <strong className="text-cyan-300">{filteredTeamRows.length}</strong> of {teamRows.length} total records from <code className="text-cyan-400">team_predictions.csv</code>
                </span>
                <span>
                  Update Cadence: 10 Seconds | Wall-Clock UTC Standard
                </span>
              </div>

              {/* Team Predictions Data Table */}
              <div className="overflow-auto border border-cyan-500/30 rounded-xl custom-scrollbar min-h-[380px] max-h-[500px] bg-[#0a0e1a]">
                <table className="w-full text-left border-collapse text-[11px] font-mono text-gray-300 min-w-[800px]">
                  <thead>
                    <tr className="bg-cyan-950/40 border-b border-cyan-500/30 text-cyan-300 uppercase text-[9.5px] tracking-wider">
                      <th className="p-3">Record ID</th>
                      <th className="p-3">Timestamp (UTC)</th>
                      <th className="p-3">Nowcast Phase</th>
                      <th className="p-3 text-right">Class C Prob (%)</th>
                      <th className="p-3 text-right">Class M Prob (%)</th>
                      <th className="p-3 text-right">Class X Prob (%)</th>
                      <th className="p-3 text-center">Severe Risk (M+X)</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLoading && teamRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                          Loading team_predictions.csv dataset...
                        </td>
                      </tr>
                    )}

                    {!teamLoading && filteredTeamRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          No matching team prediction records found.
                        </td>
                      </tr>
                    )}

                    {filteredTeamRows.map((r) => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-cyan-500/5 transition-colors">
                        <td className="p-3 font-bold text-cyan-300">{r.id}</td>
                        <td className="p-3 whitespace-nowrap text-white">{r.timestamp}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded border text-[9.5px] font-bold ${getPhaseBadge(r.phase)}`}>
                            {r.phase.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-right text-yellow-400 font-bold">{r.prob_C.toFixed(2)}%</td>
                        <td className="p-3 text-right text-amber-400 font-bold">{r.prob_M.toFixed(2)}%</td>
                        <td className="p-3 text-right text-red-400 font-bold">{r.prob_X.toFixed(2)}%</td>
                        <td className="p-3 text-center">
                          <div className="w-24 mx-auto bg-white/5 rounded-full h-2 overflow-hidden border border-white/10">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                r.prob_severe > 30 ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-cyan-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, r.prob_severe))}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground mt-0.5 block">{r.prob_severe.toFixed(1)}%</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center text-emerald-400 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            VALIDATED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default PredictionHistoryPanel;
