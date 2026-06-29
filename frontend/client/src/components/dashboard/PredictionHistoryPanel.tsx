import React, { useState, useEffect } from 'react';
import { History, ArrowRight } from 'lucide-react';
import { fetchDashboard } from '../../services/api'; // Or just fetch directly

export function PredictionHistoryPanel() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/history');
        const data = await res.json();
        if (data.status === 'ONLINE' && data.predictions) {
          // reverse so newest is first or keep chronological? 
          // The mock was: 08:11 Quiet, 08:16 Quiet... this is chronological. 
          // If there are 100, we probably want them scrolling or reversed. Let's just use the last 20 reversed.
          setHistory(data.predictions.reverse().slice(0, 20));
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000); // Polling history every 10s
    return () => clearInterval(interval);
  }, []);

  const getClassColor = (c: string) => {
    switch(c) {
      case 'Quiet': return 'text-[#00ff88]';
      case 'B': return 'text-[#00d9ff]';
      case 'C': return 'text-[#ff9f1c]';
      case 'M': return 'text-[#ff3b5c]';
      case 'X': return 'text-[#7c3aed]';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="flex flex-col p-6 bg-[#0b1022] border border-[#00d9ff]/20 rounded-lg h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-muted-foreground" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <History className="w-4 h-4 mr-2 text-[#00d9ff]" />
          Prediction History
        </h3>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {loading && <div className="text-xs text-muted-foreground">Loading history...</div>}
        {!loading && history.length === 0 && <div className="text-xs text-muted-foreground">No history available yet.</div>}
        
        {!loading && history.map((row, idx) => {
          const time = new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={idx} className="bg-white/5 border border-white/10 rounded px-3 py-2 flex items-center space-x-3 group relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-[#00d9ff] opacity-50 group-hover:opacity-100 transition-opacity" />
               <span className="text-[10px] text-muted-foreground font-mono">{time}</span>
               <span className={`text-sm font-black ${getClassColor(row.prediction)}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                 {row.prediction || 'Quiet'}
               </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
