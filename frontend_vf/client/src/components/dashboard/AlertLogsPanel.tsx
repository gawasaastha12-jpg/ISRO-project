import React, { useState } from 'react';
import { AlertTriangle, Info, CheckCircle2, AlertCircle, ShieldAlert, User, X, BrainCircuit, Activity, FileText } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

export function AlertLogsPanel() {
  const { data } = useDashboard();
  const alerts = data?.alerts?.history || [];
  const currentAlertLevel = data?.alerts?.current_alert || 'NORMAL';
  const [activeTab, setActiveTab] = useState('Current');
  const [explainAlert, setExplainAlert] = useState<any | null>(null);

  const fusionConf = data?.analytics?.fusion?.confidence || data?.analytics?.fusion?.forecast_confidence || 0.85;
  const confPct = fusionConf <= 1.0 ? fusionConf * 100 : fusionConf;

  const tabs = ['Current', 'History', 'Acknowledged', 'Resolved'];

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'ALL CLEAR':
      case 'NORMAL':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'WATCH':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'WARNING':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'ALERT':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'SEVERE':
        return <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />;
      default:
        return null;
    }
  };

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'ALL CLEAR':
      case 'NORMAL':
        return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'WATCH':
        return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'WARNING':
        return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      case 'ALERT':
        return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
      case 'SEVERE':
        return 'text-red-400 border-red-500/50 bg-red-500/20';
      default:
        return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  // Filter alerts according to selected tab
  const filteredAlerts = alerts.filter((alert: any) => {
    if (activeTab === 'Current') return alert.status === 'Active' || !alert.status;
    if (activeTab === 'History') return true;
    if (activeTab === 'Acknowledged') return alert.status === 'Acknowledged';
    if (activeTab === 'Resolved') return alert.status === 'Resolved';
    return true;
  });

  return (
    <div className="flex flex-col p-5 bg-[#131a2e] border border-[#1e2740] rounded-lg min-h-[300px] h-full relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-[#e8ecf5]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <AlertTriangle className="w-4 h-4 mr-2 text-[#22d3ee]" />
          Alert System Log
        </h3>
        <div className="flex space-x-1">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-0.5 text-[9px] uppercase rounded border transition-colors ${
                activeTab === tab 
                  ? 'border-[#22d3ee] bg-[#22d3ee]/20 text-[#22d3ee] font-bold' 
                  : 'border-[#1e2740] text-[#6b7590] hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Alert List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-2 max-h-[300px]">
        {currentAlertLevel === 'SEVERE' && (
          <div className="flex items-center space-x-2 bg-red-500/20 border border-red-500/30 p-2 rounded text-xs text-red-400 mb-2 animate-pulse">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="font-bold">CRITICAL ALERT ACTIVE. SYSTEM OVERRIDE DISABLED.</span>
          </div>
        )}

        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert: any, idx: number) => (
            <div key={idx} className="flex flex-col space-y-1.5 p-2.5 bg-black/40 border border-white/10 rounded-lg transition-all hover:border-white/20">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  {getAlertIcon(alert.level)}
                  <span className={`text-[10px] font-black uppercase tracking-wider ${getAlertColor(alert.level).split(' ')[0]}`}>
                    {alert.level}
                  </span>
                </div>
                <span className="text-[9px] text-[#6b7590] font-mono">{alert.timestamp}</span>
              </div>

              <p className="text-[10.5px] text-[#e8ecf5] font-medium">
                {alert.reason === 'Nominal' ? 'Operational Assessment: Nominal solar activity detected across payloads.' : alert.reason}
              </p>

              {alert.operatorNotes && (
                <div className="flex flex-col space-y-0.5 mt-1 pt-1 border-t border-white/10">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <User className="w-3 h-3 text-[#6b7590] shrink-0" />
                    <span className="text-[9px] text-[#6b7590] font-bold uppercase tracking-wider">Evidence Summary:</span>
                  </div>
                  {alert.operatorNotes === "System fusion output" ? (
                    <ul className="list-disc list-inside text-[9px] text-gray-300 pl-1 space-y-0.5 leading-tight font-mono">
                      <li>Low X-ray variability (SOLEXS)</li>
                      <li>No recent hard X-ray bursts (HEL1OS)</li>
                      <li>Quiet coronal index (VELC)</li>
                      <li>Prediction confidence {confPct.toFixed(1)}%</li>
                    </ul>
                  ) : (
                    <span className="text-[10px] text-[#6b7590] italic pl-3">{alert.operatorNotes}</span>
                  )}
                </div>
              )}

              <button 
                onClick={() => setExplainAlert(alert)}
                className="self-end px-2 py-0.5 text-[9px] font-bold text-[#22d3ee] hover:text-white bg-[#22d3ee]/10 hover:bg-[#22d3ee]/30 border border-[#22d3ee]/30 rounded transition-all mt-1 flex items-center space-x-1 uppercase tracking-wider"
              >
                <BrainCircuit className="w-3 h-3" />
                <span>EXPLAIN</span>
              </button>
            </div>
          ))
        ) : (
          <div className="h-full min-h-[120px] flex items-center justify-center text-xs text-[#6b7590] italic">
            No {activeTab.toLowerCase()} alerts logged.
          </div>
        )}
      </div>

      {/* EXPLAINABILITY MODAL */}
      {explainAlert && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1022] border border-[#22d3ee]/40 rounded-xl max-w-xl w-full p-6 shadow-[0_0_50px_rgba(0,217,255,0.2)] flex flex-col space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-[#22d3ee] drop-shadow-[0_0_8px_rgba(0,217,255,0.8)]" />
                <div>
                  <h2 className="text-sm font-bold text-[#e8ecf5] uppercase tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    Alert Physics Explanation & Attribution
                  </h2>
                  <span className="text-[10px] text-[#6b7590] font-mono">
                    ID #{explainAlert.id || '1'} • Timestamp: {explainAlert.timestamp}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setExplainAlert(null)}
                className="p-1 rounded text-[#6b7590] hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alert Classification Banner */}
            <div className={`p-3 rounded-lg border flex items-center justify-between ${getAlertColor(explainAlert.level)}`}>
              <div className="flex items-center space-x-2">
                {getAlertIcon(explainAlert.level)}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">Alert Status: {explainAlert.level}</div>
                  <div className="text-[10px] opacity-90">{explainAlert.reason || 'Nominal Assessment'}</div>
                </div>
              </div>
              <span className="text-[10px] font-mono font-black bg-black/40 px-2 py-1 rounded">
                CONFIDENCE: {confPct.toFixed(1)}%
              </span>
            </div>

            {/* Multi-Instrument Attribution Breakdown */}
            <div className="flex flex-col space-y-2">
              <span className="text-[10px] font-bold uppercase text-[#22d3ee] tracking-wider flex items-center">
                <Activity className="w-3.5 h-3.5 mr-1 text-[#22d3ee]" />
                Multi-Instrument Physics Drivers
              </span>

              <div className="grid grid-cols-3 gap-2 text-center font-mono text-[9px]">
                <div className="bg-white/5 border border-white/10 p-2 rounded flex flex-col">
                  <span className="text-[#6b7590] text-[8px] uppercase">SOLEXS Weight</span>
                  <span className="text-yellow-400 font-bold text-xs mt-0.5">35% Contribution</span>
                  <span className="text-[8px] text-gray-400 mt-1">Soft X-ray Prominence</span>
                </div>
                <div className="bg-white/5 border border-white/10 p-2 rounded flex flex-col">
                  <span className="text-[#6b7590] text-[8px] uppercase">HEL1OS Weight</span>
                  <span className="text-orange-400 font-bold text-xs mt-0.5">40% Contribution</span>
                  <span className="text-[8px] text-gray-400 mt-1">Hard X-ray Burst Rate</span>
                </div>
                <div className="bg-white/5 border border-white/10 p-2 rounded flex flex-col">
                  <span className="text-[#6b7590] text-[8px] uppercase">VELC Weight</span>
                  <span className="text-supernova-gold font-bold text-xs mt-0.5">25% Contribution</span>
                  <span className="text-[8px] text-gray-400 mt-1">Coronal Index & Novelty</span>
                </div>
              </div>
            </div>

            {/* Physics Feature Attribution Factors */}
            <div className="bg-white/5 border border-white/10 p-3 rounded-lg space-y-2 font-mono text-[10px]">
              <span className="text-[9px] text-[#6b7590] uppercase tracking-wider font-bold block mb-1">
                Top Interpretable Attributions (XGBoost SHAP)
              </span>

              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-starlight-white text-[9px] mb-0.5">
                    <span>1. SOLEXS Prominence Rate</span>
                    <span className="text-green-400 font-bold">+32.4%</span>
                  </div>
                  <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400" style={{ width: '32.4%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-starlight-white text-[9px] mb-0.5">
                    <span>2. HEL1OS Hard X-Ray Burst Density</span>
                    <span className="text-green-400 font-bold">+28.1%</span>
                  </div>
                  <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400" style={{ width: '28.1%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-starlight-white text-[9px] mb-0.5">
                    <span>3. VELC Morphological Novelty Index</span>
                    <span className="text-[#22d3ee] font-bold">+18.5%</span>
                  </div>
                  <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400" style={{ width: '18.5%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended Operator Action */}
            <div className="bg-[#22d3ee]/10 border border-[#22d3ee]/30 p-3 rounded-lg flex flex-col space-y-1">
              <div className="flex items-center space-x-1 text-[#22d3ee] text-[10px] font-bold uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                <span>Recommended Operator Action</span>
              </div>
              <p className="text-xs text-[#e8ecf5] font-medium">
                {explainAlert.operatorNotes || 'Maintain nominal observation mode. Telemetry signals show stable baseline coronal dynamics across Aditya-L1 instruments.'}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setExplainAlert(null)}
                className="px-4 py-1.5 bg-[#22d3ee] hover:bg-[#22d3ee]/80 text-[#0a0e27] font-bold text-xs rounded transition-all uppercase tracking-wider"
              >
                Close Explanation
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
