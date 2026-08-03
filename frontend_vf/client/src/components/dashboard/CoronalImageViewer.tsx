import React, { useState } from 'react';
import { Camera, Layers, Zap, Search, Activity, X, Info, FileText } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

export function CoronalImageViewer() {
  const { data } = useDashboard();
  const velc = data?.instruments?.velc || {};
  const [activeTab, setActiveTab] = useState('Original');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const tabs = [
    { id: 'Original', icon: Camera, desc: 'Calibrated Fe XIV coronal emission' },
    { id: 'Segmentation', icon: Layers, desc: 'AI loop and filament segmentation' },
    { id: 'Anomaly', icon: Zap, desc: 'Isolation Forest anomaly localization' },
    { id: 'Similarity', icon: Search, desc: 'Matched historical occurrences' },
    { id: 'Difference', icon: Activity, desc: 'Subtracted contrast motion map' },
  ];

  // Fallback similarity events if backend is empty
  const similarityEvents = (velc.similarity_events && velc.similarity_events.length > 0)
    ? velc.similarity_events
    : [
        { id: 'EV-AL1-20250812', similarity: 94.2, outcome: 'C-class eruptive flare', timeDiff: '12 days prior' },
        { id: 'EV-AL1-20251104', similarity: 89.5, outcome: 'M1.5 moderate flare', timeDiff: '45 days prior' },
        { id: 'EV-AL1-20260218', similarity: 86.8, outcome: 'Quiet coronal loop shift', timeDiff: '110 days prior' }
      ];

  const getOverlayContent = () => {
    switch (activeTab) {
      case 'Segmentation':
        return (
          <>
            {/* Segmentation vectors */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100">
              {/* Coronal magnetic loop overlays */}
              <path d="M25,50 Q50,15 75,50" fill="none" stroke="#00ff88" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.9" />
              <path d="M30,45 Q50,10 70,45" fill="none" stroke="#00ff88" strokeWidth="0.6" opacity="0.7" />
              <path d="M20,55 Q50,85 80,55" fill="none" stroke="#00d9ff" strokeWidth="0.7" strokeDasharray="1,2" opacity="0.8" />
              <path d="M32,52 Q50,68 68,52" fill="none" stroke="#00d9ff" strokeWidth="0.5" opacity="0.6" />
              
              {/* Point highlights */}
              <circle cx="50" cy="12" r="1.5" fill="#00ff88" className="animate-ping" />
              <circle cx="50" cy="12" r="0.8" fill="#00ff88" />
              <text x="53" y="13" fill="#00ff88" fontSize="2.5" fontWeight="bold" fontFamily="monospace">Filament Apex</text>
            </svg>
            <div className="absolute top-4 left-4 bg-[#00ff88]/10 border border-[#00ff88]/30 px-2 py-0.5 rounded text-[10px] text-[#00ff88] z-20 flex items-center space-x-1 uppercase tracking-wider font-mono">
              <Layers className="w-3 h-3" />
              <span>AI Segmentation Mask Active</span>
            </div>
          </>
        );

      case 'Anomaly':
        return (
          <>
            {/* Blinking hotspot bounding boxes */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100">
              {/* Anomaly region 1 */}
              <rect x="36" y="28" width="15" height="15" fill="none" stroke="#ef4444" strokeWidth="0.8" className="animate-pulse" />
              <line x1="36" y1="28" x2="31" y2="23" stroke="#ef4444" strokeWidth="0.4" />
              <text x="22" y="21" fill="#ef4444" fontSize="3" fontWeight="bold" fontFamily="monospace">ANOMALY #01: CME PRECURSOR (92.4%)</text>
              
              {/* Anomaly region 2 */}
              <rect x="58" y="55" width="12" height="12" fill="none" stroke="#f97316" strokeWidth="0.8" opacity="0.8" />
              <line x1="70" y1="67" x2="74" y2="71" stroke="#f97316" strokeWidth="0.4" />
              <text x="68" y="75" fill="#f97316" fontSize="2.5" fontWeight="bold" fontFamily="monospace">REGION #49: Local Brightness (+18.4%)</text>
            </svg>
            <div className="absolute top-4 left-4 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded text-[10px] text-red-400 z-20 flex items-center space-x-1 uppercase tracking-wider font-mono animate-pulse">
              <Zap className="w-3 h-3" />
              <span>Anomaly Detection Active</span>
            </div>
          </>
        );

      case 'Difference':
        return (
          <>
            {/* Difference wave propagate */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100">
              {/* Outward propagating wave fronts */}
              <path d="M 64 50 C 72 35, 88 35, 92 50 C 88 65, 72 65, 64 50 Z" fill="rgba(255,255,255,0.06)" stroke="white" strokeWidth="0.6" strokeDasharray="3,1" className="animate-ping" style={{ animationDuration: '3s' }} />
              <path d="M 58 50 C 66 38, 80 38, 84 50 C 80 62, 66 62, 58 50 Z" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="0.4" strokeDasharray="2,2" />
              <text x="60" y="32" fill="white" fontSize="2.8" fontWeight="bold" fontFamily="monospace" opacity="0.9">MOTION DIFF: CORONAL MASS EJECTION WAVE</text>
            </svg>
            <div className="absolute top-4 left-4 bg-white/10 border border-white/30 px-2 py-0.5 rounded text-[10px] text-white z-20 flex items-center space-x-1 uppercase tracking-wider font-mono">
              <Activity className="w-3 h-3" />
              <span>Running Frame-Subtracted Difference</span>
            </div>
          </>
        );

      case 'Original':
      default:
        return (
          <div className="absolute top-4 left-4 bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] text-muted-foreground z-20 flex items-center space-x-1 uppercase tracking-wider font-mono">
            <Camera className="w-3 h-3" />
            <span>Fe XIV Coronal Bandpass (12ms Exposure)</span>
          </div>
        );
    }
  };

  const getVisualFilter = () => {
    switch (activeTab) {
      case 'Anomaly':
        return 'hue-rotate(280deg) brightness(1.6) contrast(1.1)';
      case 'Difference':
        return 'contrast(3) invert(0.9) grayscale(1) brightness(0.7)';
      case 'Segmentation':
        return 'contrast(1.2) saturate(1.5) brightness(0.9)';
      default:
        return 'none';
    }
  };

  return (
    <div className="flex flex-col p-4 bg-cosmic-navy/50 border border-border/50 rounded-lg h-full relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,217,255,0.2)] gsap-panel">
      {/* Header Panel */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="font-bold tracking-wide uppercase text-xs text-starlight-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            VELC Coronal Viewer
          </h3>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {tabs.find(t => t.id === activeTab)?.desc}
          </p>
        </div>
        
        <div className="flex space-x-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'Similarity') setIsDrawerOpen(true);
                  else setIsDrawerOpen(false);
                }}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded border flex items-center space-x-1 transition-colors ${
                  activeTab === tab.id 
                    ? 'border-supernova-gold bg-supernova-gold/20 text-supernova-gold' 
                    : 'border-border text-muted-foreground hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.id}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Main Image Viewport Area */}
      <div className="flex-1 w-full relative bg-black/60 rounded-xl overflow-hidden flex items-center justify-center border border-white/10 shadow-inner">
        {/* Underlay glow rings (Rotating coronal loops mockup) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
          <div className="absolute w-56 h-56 rounded-full border border-white/5 animate-pulse" />
          <div className="absolute w-44 h-44 rounded-full border border-white/5 animate-spin" style={{ animationDuration: '40s' }} />
        </div>

        {/* The Solar Corona Image layer */}
        <div 
          className="absolute inset-0 flex items-center justify-center transition-all duration-300" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at center, rgba(251,191,36,0.55) 0%, rgba(251,191,36,0.15) 35%, transparent 70%)',
            filter: getVisualFilter()
          }}
        >
          {/* Central Occulting Disk (Simulates VELC coronagraph) */}
          <div className="w-28 h-28 rounded-full bg-cosmic-black border border-supernova-gold/40 shadow-[0_0_60px_rgba(251,191,36,0.35)] flex items-center justify-center relative z-20">
            {/* Physical parameters within occulting disk */}
            <span className="text-[7px] font-mono text-supernova-gold/40 font-bold uppercase tracking-wider">Occulter</span>
          </div>
        </div>

        {/* Dynamic Vector & Bounding Box Overlays */}
        {getOverlayContent()}

        {/* Telemetry strip */}
        <div className="absolute bottom-3 left-3 right-3 flex justify-between text-[10px] font-mono text-starlight-white/80 bg-[#0b1022]/90 border border-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md z-20 shadow-lg">
           <span>
             FRM: {data?.mission_status?.last_updated 
               ? 48000 + (Math.floor(new Date(data.mission_status.last_updated).getTime() / 5000) % 1000) 
               : 48992}
           </span>
           <span>EXP: 12ms</span>
           <span>FLT: Fe XIV</span>
           <span className="text-supernova-gold font-bold">
             NOV: {((velc.novelty_score || 0.84) * 100).toFixed(1)}
           </span>
        </div>
      </div>

      {/* Similarity Search Side Drawer */}
      <div className={`absolute top-0 right-0 bottom-0 w-64 bg-[#0b1022]/95 border-l border-white/10 shadow-2xl backdrop-blur-xl transform transition-transform duration-300 z-30 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-3 border-b border-white/10 flex justify-between items-center bg-black/30">
          <h4 className="font-bold text-xs text-starlight-white flex items-center uppercase tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <Search className="w-4 h-4 mr-1.5 text-electric-blue" /> Similar Occurrences
          </h4>
          <button 
            onClick={() => { setIsDrawerOpen(false); setActiveTab('Original'); }} 
            className="p-1 rounded text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-3 space-y-2.5 overflow-y-auto h-[calc(100%-49px)] custom-scrollbar">
          <div className="text-[9px] text-muted-foreground font-mono leading-tight mb-2 border-b border-white/5 pb-2">
            AI matches from master solar event database based on spatial features, loop thickness, and exposure.
          </div>
          
          {similarityEvents.map((event: any) => (
            <div key={event.id} className="bg-black/40 border border-white/5 rounded-lg p-2.5 hover:border-electric-blue/50 cursor-pointer transition-colors group">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-black text-electric-blue font-mono">{event.id}</span>
                <span className="text-[9px] font-bold bg-green-500/10 border border-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{event.similarity}% match</span>
              </div>
              <div className="h-16 bg-black rounded border border-white/10 flex items-center justify-center overflow-hidden relative mb-2">
                {/* Mock thumbnail representation */}
                <div className="absolute inset-0 bg-gradient-to-br from-supernova-gold/10 via-transparent to-black" />
                <div className="w-8 h-8 rounded-full bg-black border border-supernova-gold/25" />
                <Camera className="w-3.5 h-3.5 text-white/10 absolute" />
              </div>
              <div className="flex flex-col text-[9px] space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Class Outcome:</span>
                  <span className="text-starlight-white font-bold">{event.outcome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Temporal Diff:</span>
                  <span className="text-yellow-500 font-bold">{event.timeDiff}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

