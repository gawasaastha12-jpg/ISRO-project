import React from 'react';
import { AlertTriangle, Flame, Activity, ArrowRight } from 'lucide-react';

interface SolarFlareSignalHUDProps {
  intensity: 'M' | 'X' | 'EXTREME';
  onEngageDashboard: () => void;
  onDismiss: () => void;
}

export default function SolarFlareSignalHUD({ intensity, onEngageDashboard, onDismiss }: SolarFlareSignalHUDProps) {
  return (
    <div className="fixed top-12 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-in slide-in-from-top duration-500 font-mono">
      <div className="relative bg-black/90 border-2 border-red-500/80 rounded-xl p-5 shadow-[0_0_50px_rgba(239,68,68,0.6)] backdrop-blur-lg overflow-hidden">
        
        {/* Animated pulse background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-amber-500/20 to-red-600/20 animate-pulse pointer-events-none" />

        {/* Warning Badge Header */}
        <div className="flex items-center justify-between mb-3 border-b border-red-500/40 pb-2">
          <div className="flex items-center gap-2 text-red-400 font-bold tracking-widest text-xs uppercase animate-bounce">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span>SOLAR FLARE SIGNAL DETECTED</span>
          </div>
          <span className="px-2 py-0.5 bg-red-950 border border-red-500 text-red-400 text-[10px] font-bold rounded tracking-wider">
            FLARE CLASS: {intensity}-CLASS
          </span>
        </div>

        {/* Telemetry snippet */}
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-red-900/30 rounded-lg border border-red-500/40 flex-shrink-0">
            <Flame className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm tracking-wide">
              Coronal Mass Ejection Imminent
            </h3>
            <p className="text-xs text-gray-300 font-sans mt-1">
              High thermal radiation and X-ray emission spikes detected by ADITYA-L1 sensors. Immediate dashboard inspection recommended.
            </p>
          </div>
        </div>

        {/* Signal telemetry metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-[10px] bg-black/60 p-2 rounded border border-white/10">
          <div>
            <span className="text-muted-foreground block">X-RAY FLUX</span>
            <span className="text-amber-400 font-bold">1.4e-4 W/m²</span>
          </div>
          <div>
            <span className="text-muted-foreground block">MAGNETIC DRIFT</span>
            <span className="text-red-400 font-bold">+84.2 nT</span>
          </div>
          <div>
            <span className="text-muted-foreground block">SIGNAL STATUS</span>
            <span className="text-emerald-400 font-bold animate-pulse">LOCKED</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onDismiss}
            className="px-3 py-2 border border-white/20 text-gray-400 hover:text-white rounded text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
          >
            Ignore & Fly
          </button>

          <button
            onClick={onEngageDashboard}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-black font-bold rounded text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.8)] hover:scale-[1.02]"
          >
            <Activity className="w-4 h-4" />
            <span>OPEN MONITORING DASHBOARD</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
