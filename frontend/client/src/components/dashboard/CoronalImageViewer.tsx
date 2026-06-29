import React, { useState } from 'react';
import { Camera, Layers, Zap, Search, Activity, ChevronRight, X } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

export function CoronalImageViewer() {
  const { data } = useDashboard();
  const velc = data?.instruments?.velc || {};
  const [activeTab, setActiveTab] = useState('Original');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const tabs = [
    { id: 'Original', icon: Camera },
    { id: 'Segmentation', icon: Layers },
    { id: 'Anomaly', icon: Zap },
    { id: 'Similarity', icon: Search },
    { id: 'Difference', icon: Activity },
  ];

  return (
    <div className="flex flex-col p-4 bg-cosmic-navy/50 border border-border/50 rounded-lg h-[400px] relative overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold tracking-wide uppercase text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>VELC Coronal Viewer</h3>
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
                className={`px-3 py-1 text-xs rounded border flex items-center space-x-1 transition-colors ${
                  activeTab === tab.id 
                    ? 'border-supernova-gold bg-supernova-gold/20 text-supernova-gold' 
                    : 'border-border text-muted-foreground hover:bg-white/5'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{tab.id}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="flex-1 w-full relative bg-black/50 rounded overflow-hidden flex items-center justify-center border border-white/10">
        {/* Placeholder for the VELC Image */}
        <div className="absolute inset-0 opacity-30 flex items-center justify-center" style={{ 
          backgroundImage: 'radial-gradient(circle at center, #fbbf24 0%, transparent 70%)',
          filter: activeTab === 'Anomaly' ? 'hue-rotate(300deg) brightness(1.5)' : 'none'
        }}>
           {/* Solar Disk Mock */}
           <div className="w-32 h-32 rounded-full bg-black border border-supernova-gold/50 shadow-[0_0_50px_rgba(251,191,36,0.3)]"></div>
        </div>

        {activeTab === 'Segmentation' && (
          <div className="absolute inset-0 border-2 border-dashed border-electric-blue/50 rounded-lg m-12 flex items-start p-2">
            <span className="bg-electric-blue/20 text-electric-blue text-[10px] px-1 rounded">Coronal Loop Detected</span>
          </div>
        )}

        {/* Real-time telemetry overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs font-mono text-starlight-white/70 bg-black/50 p-2 rounded backdrop-blur">
           <span>FRM: 48992</span>
           <span>EXP: 12ms</span>
           <span>FLT: Fe XIV</span>
           <span className="text-supernova-gold">NOV: 84</span>
        </div>
      </div>

      {/* Similarity Search Side Drawer */}
      <div className={`absolute top-0 right-0 bottom-0 w-64 bg-cosmic-navy/95 border-l border-border/50 shadow-2xl backdrop-blur-xl transform transition-transform duration-300 z-20 ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-border/30 flex justify-between items-center bg-black/20">
          <h4 className="font-bold text-sm text-starlight-white flex items-center"><Search className="w-4 h-4 mr-2 text-electric-blue" /> Similar Events</h4>
          <button onClick={() => { setIsDrawerOpen(false); setActiveTab('Original'); }} className="text-muted-foreground hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 space-y-2 overflow-y-auto h-[calc(100%-53px)]">
          {(velc.similarity_events || []).map((event: any) => (
            <div key={event.id} className="bg-black/30 border border-white/5 rounded p-2 hover:border-electric-blue/50 cursor-pointer transition-colors group">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-electric-blue">{event.id}</span>
                <span className="text-xs bg-green-500/20 text-green-400 px-1 rounded">{event.similarity}% match</span>
              </div>
              <div className="h-16 bg-white/5 rounded mb-2 border border-white/10 flex items-center justify-center overflow-hidden relative">
                {/* Mock thumbnail */}
                 <div className="absolute inset-0 bg-gradient-to-br from-supernova-gold/20 to-transparent"></div>
                 <Camera className="w-4 h-4 text-white/20" />
              </div>
              <div className="flex flex-col text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outcome:</span>
                  <span className="text-white font-bold">{event.outcome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time Diff:</span>
                  <span className="text-yellow-500">{event.timeDiff}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
