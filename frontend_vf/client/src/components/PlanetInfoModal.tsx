import React from 'react';
import { X, ExternalLink, Activity, Radio, ShieldAlert, Sparkles, Cpu } from 'lucide-react';

export interface PlanetData {
  id: string;
  name: string;
  category: string;
  color: string;
  description: string;
  stats: { label: string; value: string }[];
  features: string[];
}

interface PlanetInfoModalProps {
  planet: PlanetData | null;
  onClose: () => void;
  onOpenDashboard?: () => void;
}

export default function PlanetInfoModal({ planet, onClose, onOpenDashboard }: PlanetInfoModalProps) {
  if (!planet) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-xl bg-cosmic-black/90 border border-electric-blue/50 rounded-xl p-6 shadow-[0_0_50px_rgba(0,217,255,0.3)] text-foreground font-mono overflow-hidden"
        style={{
          boxShadow: `0 0 40px ${planet.color}40, inset 0 0 20px ${planet.color}20`
        }}
      >
        {/* Top Glowing Edge Bar */}
        <div 
          className="absolute top-0 left-0 right-0 h-1" 
          style={{ backgroundColor: planet.color }} 
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Section */}
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center border"
            style={{ 
              borderColor: `${planet.color}80`, 
              backgroundColor: `${planet.color}20` 
            }}
          >
            {planet.id === 'sun' && <Sparkles className="w-6 h-6" style={{ color: planet.color }} />}
            {planet.id === 'solexs' && <Activity className="w-6 h-6" style={{ color: planet.color }} />}
            {planet.id === 'velc' && <Radio className="w-6 h-6" style={{ color: planet.color }} />}
            {planet.id === 'blackhole' && <ShieldAlert className="w-6 h-6" style={{ color: planet.color }} />}
            {planet.id === 'helios' && <Cpu className="w-6 h-6" style={{ color: planet.color }} />}
          </div>
          <div>
            <div className="text-[10px] tracking-widest uppercase text-muted-foreground">{planet.category}</div>
            <h2 className="text-xl font-bold text-white tracking-wide" style={{ textShadow: `0 0 10px ${planet.color}` }}>
              {planet.name}
            </h2>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-300 leading-relaxed mb-6 border-b border-border/40 pb-4 font-sans">
          {planet.description}
        </p>

        {/* Key Telemetry Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {planet.stats.map((stat, idx) => (
            <div key={idx} className="bg-black/50 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] text-muted-foreground uppercase">{stat.label}</div>
              <div className="text-sm font-bold text-electric-blue">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Highlight Features */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-wider text-supernova-gold mb-2 font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Project Capabilities
          </div>
          <ul className="space-y-1.5 text-xs text-gray-300 font-sans">
            {planet.features.map((feat, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: planet.color }} />
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-white/20 rounded text-xs text-gray-300 hover:bg-white/10 transition-colors uppercase tracking-wider"
          >
            Resume Flight
          </button>
          
          {onOpenDashboard && (
            <button
              onClick={onOpenDashboard}
              className="flex items-center gap-2 px-5 py-2 rounded text-xs font-bold text-black uppercase tracking-wider transition-all hover:scale-105 shadow-lg"
              style={{ 
                backgroundColor: planet.color,
                boxShadow: `0 0 20px ${planet.color}80`
              }}
            >
              <span>Inspect Telemetry</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
