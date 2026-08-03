import React from 'react';
import { AlertTriangle, Info, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

export function AlertPanel() {
  const { data } = useDashboard();
  const currentAlertLevel = data?.alerts?.current_alert || 'NORMAL';

  // Get alert colors and details based on threat level
  const getThreatDetails = (level: string) => {
    switch (level) {
      case 'ALL CLEAR':
      case 'NORMAL':
        return {
          label: 'LOW THREAT',
          color: 'text-[#10b981]',
          bg: 'bg-[#10b981]/10',
          border: 'border-[#10b981]/20',
          icon: <CheckCircle2 className="w-8 h-8 text-[#10b981] animate-pulse" />
        };
      case 'WATCH':
        return {
          label: 'WATCH ACTIVE',
          color: 'text-[#22d3ee]',
          bg: 'bg-[#22d3ee]/10',
          border: 'border-[#22d3ee]/20',
          icon: <Info className="w-8 h-8 text-[#22d3ee] animate-pulse" />
        };
      case 'WARNING':
        return {
          label: 'WARNING ACTIVE',
          color: 'text-[#f59e0b]',
          bg: 'bg-[#f59e0b]/10',
          border: 'border-[#f59e0b]/20',
          icon: <AlertCircle className="w-8 h-8 text-[#f59e0b] animate-pulse" />
        };
      case 'ALERT':
      case 'SEVERE':
        return {
          label: 'CRITICAL ALERT',
          color: 'text-[#ef4444]',
          bg: 'bg-[#ef4444]/20',
          border: 'border-[#ef4444]/50',
          icon: <ShieldAlert className="w-8 h-8 text-[#ef4444] animate-pulse" />
        };
      default:
        return {
          label: 'LOW THREAT',
          color: 'text-[#10b981]',
          bg: 'bg-[#10b981]/10',
          border: 'border-[#10b981]/20',
          icon: <CheckCircle2 className="w-8 h-8 text-[#10b981]" />
        };
    }
  };

  const threat = getThreatDetails(currentAlertLevel);

  // Retrieve current nowcast class probabilities
  const solexs = data?.instruments?.solexs;
  const probs = solexs?.probabilities || { 'Quiet': 0.941, 'B-like': 0.055, 'C-like': 0.003, 'M-like': 0.0008, 'X-like': 0.0002 };
  
  // Normalization logic if probabilities are sum-scaled differently
  const cProb = ((probs['C-like'] ?? probs['C'] ?? 0.0) * 100);
  const mProb = ((probs['M-like'] ?? probs['M'] ?? 0.0) * 100);
  const xProb = ((probs['X-like'] ?? probs['X'] ?? 0.0) * 100);

  // Forecast horizons TSS performance metadata
  const horizonsList = [
    { name: '5m Nowcast', tss: 0.365, status: 'validated', label: 'Primary Nowcast (TSS +0.365)' },
    { name: '10m Forecast', tss: 0.016, status: 'low', label: 'Exploratory (TSS < 0.05)' },
    { name: '15m Forecast', tss: -0.002, status: 'unreliable', label: 'Unreliable (Negative Skill)' },
    { name: '30m Forecast', tss: -0.006, status: 'unreliable', label: 'Unreliable (Negative Skill)' },
    { name: '60m Forecast', tss: 0.021, status: 'low', label: 'Exploratory (TSS < 0.05)' },
    { name: '120m Forecast', tss: 0.011, status: 'low', label: 'Exploratory (TSS < 0.05)' },
    { name: '180m Forecast', tss: 0.003, status: 'unreliable', label: 'Unreliable (Negative Skill)' }
  ];

  return (
    <div className="flex flex-col p-5 bg-[#131a2e] border border-[#1e2740] rounded-lg h-full justify-between relative overflow-hidden">
      
      {/* Header */}
      <div>
        <h3 className="font-bold tracking-wide uppercase text-xs flex items-center text-[#e8ecf5] mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <AlertTriangle className="w-4 h-4 mr-2 text-[#22d3ee]" />
          Operations Threat Assessment
        </h3>

        {/* Big Threat Level Badge */}
        <div className={`flex items-center justify-between p-4 rounded border ${threat.bg} ${threat.border} mb-4`}>
          <div className="flex flex-col">
            <span className="text-[8px] text-[#6b7590] font-mono uppercase tracking-wider">Mission Threat Status</span>
            <span className={`text-base font-black ${threat.color} tracking-widest mt-0.5`}>
              {threat.label}
            </span>
          </div>
          {threat.icon}
        </div>

        {/* Progress Bars for Flare Classes */}
        <div className="space-y-2 mb-4 font-mono text-[9px]">
          <span className="text-[8px] text-[#6b7590] uppercase tracking-wider font-bold block mb-1">
            Nowcast Class Probabilities (5m)
          </span>

          {/* C-Class progress bar */}
          <div>
            <div className="flex justify-between text-[#e8ecf5] mb-0.5">
              <span>C-Class Flare</span>
              <span className="font-bold">{cProb.toFixed(2)}%</span>
            </div>
            <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-[#f59e0b]" style={{ width: `${Math.min(cProb, 100)}%` }} />
            </div>
          </div>

          {/* M-Class progress bar */}
          <div>
            <div className="flex justify-between text-[#e8ecf5] mb-0.5">
              <span>M-Class Flare</span>
              <span className="font-bold text-[#f59e0b]">{mProb.toFixed(3)}%</span>
            </div>
            <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-[#ff3b5c]" style={{ width: `${Math.min(mProb, 100)}%` }} />
            </div>
          </div>

          {/* X-Class progress bar */}
          <div>
            <div className="flex justify-between text-[#e8ecf5] mb-0.5">
              <span>X-Class Flare</span>
              <span className="font-bold text-[#ff3b5c]">{xProb.toFixed(4)}%</span>
            </div>
            <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-[#ef4444]" style={{ width: `${Math.min(xProb, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Lead Time & Horizon Skill Assessment */}
      <div className="pt-3 border-t border-dashed border-[#1e2740] font-mono text-[11px]">
        <span className="text-[10px] text-[#6b7590] uppercase tracking-wider font-bold block mb-1.5">
          Validation & Horizon Skill
        </span>

        {/* Lead time display */}
        <div className="flex justify-between items-baseline bg-black/30 p-2.5 rounded border border-[#1e2740] mb-2">
          <span className="text-[#6b7590] uppercase text-[10px]">Primary Lead Time</span>
          <div className="text-right">
            <span className="text-sm font-black text-[#10b981]">~5 min</span>
            <span className="text-[9px] text-[#6b7590] block mt-0.5">TSS +0.365 — VALIDATED NOWCAST</span>
          </div>
        </div>

        {/* Tiered other horizons */}
        <div className="space-y-1">
          {horizonsList.slice(1).map((hz, idx) => {
            const isLow = hz.status === 'low';
            return (
              <div key={idx} className="flex justify-between items-center text-[10px] leading-tight">
                <span className="text-[#6b7590]">{hz.name}</span>
                <span className={isLow ? 'text-gray-300 font-bold' : 'text-[#6b7590] italic'}>
                  {hz.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
