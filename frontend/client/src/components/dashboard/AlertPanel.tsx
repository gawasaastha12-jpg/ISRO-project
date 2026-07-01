import React, { useState } from 'react';
import { AlertTriangle, Info, CheckCircle2, AlertCircle, ShieldAlert, History, User, ChevronRight } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

export function AlertPanel() {
  const { data } = useDashboard();
  const alerts = data?.alerts?.history || [];
  const [activeTab, setActiveTab] = useState('Current');

  const tabs = ['Current', 'History', 'Acknowledged', 'Resolved'];

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'ALL CLEAR': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'WATCH': return <Info className="w-5 h-5 text-blue-500" />;
      case 'WARNING': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'ALERT': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'SEVERE': return <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />;
      default: return null;
    }
  };

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'ALL CLEAR': return 'text-green-500 border-green-500/30 bg-green-500/10';
      case 'WATCH': return 'text-blue-500 border-blue-500/30 bg-blue-500/10';
      case 'WARNING': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      case 'ALERT': return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
      case 'SEVERE': return 'text-red-500 border-red-500/50 bg-red-500/20';
      default: return 'text-gray-500 border-gray-500/30 bg-gray-500/10';
    }
  };

  return (
    <div className="flex flex-col p-4 bg-cosmic-navy/50 border border-border/50 rounded-lg h-full relative overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold tracking-wide uppercase text-sm flex items-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <AlertTriangle className="w-4 h-4 mr-2 text-muted-foreground" />
          Alert System
        </h3>
        <div className="flex space-x-1">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-1 text-[10px] uppercase rounded border transition-colors ${
                activeTab === tab 
                  ? 'border-electric-blue bg-electric-blue/20 text-electric-blue' 
                  : 'border-border text-muted-foreground hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {alerts.filter((a: any) => a.level === 'SEVERE').length > 0 && (
          <div className="flex items-center space-x-2 bg-red-500/20 border border-red-500/30 p-2 rounded text-xs text-red-400 mb-4 animate-pulse">
            <ShieldAlert className="w-4 h-4" />
            <span>CRITICAL ALERT ACTIVE. SYSTEM OVERRIDE DISABLED.</span>
          </div>
        )}

        {alerts.map((alert: any, idx: number) => (
          <div key={idx} className="flex flex-col space-y-1 p-2 bg-black/30 border border-white/5 rounded">
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-bold ${getAlertColor(alert.level).split(' ')[0]}`}>{alert.level}</span>
              <span className="text-[10px] text-muted-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{alert.timestamp}</span>
            </div>
            <p className="text-xs text-starlight-white">{alert.reason === 'Nominal' ? 'Operational Assessment: Nominal' : alert.reason}</p>
            {alert.operatorNotes && (
              <div className="flex flex-col space-y-0.5 mt-1 pt-1 border-t border-border/30">
                <div className="flex items-center space-x-1 mb-0.5">
                  <User className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Evidence Breakdown:</span>
                </div>
                {alert.operatorNotes === "System fusion output" ? (
                  <ul className="list-disc list-inside text-[9px] text-muted-foreground pl-1 space-y-0.5 mt-0.5 leading-tight">
                    <li>Low X-ray variability</li>
                    <li>No recent hard X-ray bursts</li>
                    <li>Quiet corona</li>
                    <li>Prediction confidence 93%</li>
                  </ul>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic pl-4">{alert.operatorNotes}</span>
                )}
              </div>
            )}
            <button className="self-end text-[10px] text-electric-blue hover:underline mt-1">EXPLAIN</button>
          </div>
        ))}
        {activeTab !== 'History' && (
           <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
              No {activeTab.toLowerCase()} alerts to display.
           </div>
        )}
      </div>
    </div>
  );
}
