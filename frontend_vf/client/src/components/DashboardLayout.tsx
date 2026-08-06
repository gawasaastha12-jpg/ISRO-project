import React, { useEffect, useState } from 'react';
import MissionStatusBar from './dashboard/MissionStatusBar';
import { LiveFlareGauge, ForecastTimeline, FusionDecisionCard } from './dashboard/MissionOverview';
import { CrossInstrumentTimeline } from './dashboard/CrossInstrumentTimeline';
import { CoronalImageViewer } from './dashboard/CoronalImageViewer';
import { ExplainableAIPanel, HeliosActivityPanel } from './dashboard/AIContextPanels';
import { BackendHealth, InstrumentHealthHeatmap, CorrelationEngineWidget } from './dashboard/HealthPanels';
import { AlertPanel } from './dashboard/AlertPanel';
import { PredictionHistoryPanel } from './dashboard/PredictionHistoryPanel';
import { DualInstrumentChart } from './dashboard/DualInstrumentChart';
import { HealthStrip } from './dashboard/HealthStrip';
import { AlertLogsPanel } from './dashboard/AlertLogsPanel';
import { TrajectorySummaryPanel } from './dashboard/TrajectorySummaryPanel';
import { ArchiveModule } from './dashboard/ArchiveModule';
import gsap from 'gsap';

interface DashboardLayoutProps {
  children?: React.ReactNode;
  alertState?: string;
  initialTab?: 'operations' | 'analysis' | 'catalogue' | 'archive';
}

export default function DashboardLayout({ children, alertState = 'NORMAL', initialTab = 'analysis' }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<'operations' | 'analysis' | 'catalogue' | 'archive'>(initialTab);

  useEffect(() => {
    // GSAP sequential entrance animation
    const delays = [0, 150, 250, 350, 500];
    
    delays.forEach(delay => {
      gsap.fromTo(`.gsap-delay-${delay}`, 
        { opacity: 0, y: 30 }, 
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: delay / 1000, clearProps: 'all' }
      );
    });
  }, [activeTab]); // trigger animations on tab switch for smooth transition!

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-[#e8ecf5] overflow-hidden relative">
      
      {/* Border Pulse Overlay for Severe Alerts */}
      <div className={`absolute inset-0 z-50 pointer-events-none transition-all duration-1000 ${
        (alertState === 'SEVERE' || alertState === 'ALERT') 
          ? 'border-[4px] border-[#ef4444] animate-pulse shadow-[inset_0_0_50px_rgba(239,68,68,0.5)]' 
          : 'border-0'
      }`} />

      {/* Sticky Header Wrapper */}
      <div className="sticky top-0 z-50 bg-[#0a0e1a] border-b border-[#1e2740] flex flex-col shrink-0">
        <MissionStatusBar />
        
        {/* Tab Navigation */}
        <div className="flex bg-[#131a2e]/90 backdrop-blur px-6 py-2 items-center justify-between border-t border-white/5">
          <div className="flex items-center space-x-3">
            <span className="text-[10px] font-bold text-[#6b7590] uppercase tracking-widest font-mono">Control Desk:</span>
            {(['analysis', 'operations', 'catalogue', 'archive'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded border transition-all duration-200 ${
                  activeTab === tab 
                    ? 'bg-[#22d3ee]/20 text-[#22d3ee] border-[#22d3ee]/40 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                    : 'text-[#6b7590] border-transparent hover:text-[#e8ecf5] hover:bg-white/5'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="text-[9px] font-mono text-[#6b7590] tracking-wider uppercase hidden md:block">
            ISRO Aditya-L1 Space Weather Operations
          </div>
        </div>
      </div>

      {/* Background layer for Three.js */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {children}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 relative custom-scrollbar">
        <div className="max-w-[1920px] mx-auto min-h-full flex flex-col justify-between">
          
          {activeTab === 'operations' && (
            <div className="flex flex-col space-y-4">
              {/* Row 1: Dual Instrument Chart and Alert Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[480px] lg:h-[65vh]">
                <div className="lg:col-span-2 gsap-delay-150 h-full">
                  <DualInstrumentChart />
                </div>
                <div className="lg:col-span-1 gsap-delay-250 h-full">
                  <AlertPanel />
                </div>
              </div>

              {/* Bottom Row 2: XGBoost Full-Day Trajectory Chart */}
              <div className="gsap-delay-250 w-full" style={{ minHeight: '480px' }}>
                <TrajectorySummaryPanel />
              </div>

              {/* Bottom Row: Condensed Health Strip */}
              <div className="gsap-delay-350 w-full shrink-0">
                <HealthStrip />
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="flex flex-col space-y-8 pb-12">
              {/* Row 1: Live Monitor & Forecast Timeline side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 gsap-delay-150">
                  <LiveFlareGauge />
                </div>
                <div className="lg:col-span-2 gsap-delay-250">
                  <ForecastTimeline />
                </div>
              </div>

              {/* Row 2: Fusion Decision Card & Explainability Panels (40/60 split) */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 gsap-delay-150">
                  <FusionDecisionCard />
                </div>
                <div className="lg:col-span-3 gsap-delay-250">
                  <ExplainableAIPanel />
                </div>
              </div>

              {/* Row 3: Coronal Viewer & Correlation/Calibration widgets */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* VELC Coronal Viewer - height locked to 420px to prevent clipping */}
                <div className="lg:col-span-2 h-[420px] gsap-delay-150">
                  <CoronalImageViewer />
                </div>
                
                {/* Correlation and Calibration Widgets stacked */}
                <div className="lg:col-span-1 flex flex-col space-y-4 justify-between gsap-delay-250">
                  <div className="flex-1 min-h-[200px]">
                    <CorrelationEngineWidget />
                  </div>
                  
                  {/* Calibration Standard Reference */}
                  <div className="bg-[#131a2e] border border-[#1e2740] rounded-lg p-5 flex flex-col justify-between flex-1 min-h-[200px]">
                    <div>
                      <h4 className="text-xs font-bold text-[#e8ecf5] uppercase font-mono mb-2">Calibration & Coverage</h4>
                      <p className="text-[10px] text-[#6b7590] leading-relaxed mb-3">
                        Model calibration maps raw decision logits to physical probability forecasts through Isotonic Regression, validated against daily GOES references.
                      </p>
                    </div>
                    <div className="text-[10px] font-mono text-[#6b7590] space-y-2 border-t border-white/5 pt-2">
                      <div className="flex justify-between">
                        <span>GOES Match verified</span>
                        <span className="text-[#22d3ee] font-bold">20 Indicator tags</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Calibration standard</span>
                        <span className="text-[#10b981] font-bold">Isotonic</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Coverage Range</span>
                        <span>Feb 2024 - Jun 2026</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Alert System Log & Helios Activity side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="gsap-delay-250">
                  <AlertLogsPanel />
                </div>
                <div className="gsap-delay-350">
                  <HeliosActivityPanel />
                </div>
              </div>

              {/* Row 5: Cross Instrument Timeline */}
              <div className="gsap-delay-350 w-full">
                <CrossInstrumentTimeline />
              </div>
            </div>
          )}

          {activeTab === 'catalogue' && (
            <div className="flex flex-col space-y-6 pb-12 h-auto gsap-delay-150">
              <PredictionHistoryPanel />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                <BackendHealth />
                <InstrumentHealthHeatmap />
              </div>
            </div>
          )}

          {activeTab === 'archive' && (
            <div className="flex flex-col space-y-6 pb-12 h-auto gsap-delay-150">
              <ArchiveModule />
            </div>
          )}

          {/* Footer: Data Provenance (rendered on every page) */}
          <div className="gsap-delay-350 flex flex-col md:flex-row justify-between items-center bg-black/40 border border-white/10 rounded p-3 text-[10px] font-mono text-muted-foreground uppercase tracking-wider gap-4 mt-6 shrink-0">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-bold text-starlight-white">Data Provenance:</span>
              <span className="flex items-center space-x-1">
                <span className="text-[#00d9ff]">SOLEXS:</span>
                <span className="text-starlight-white font-bold">600 observation days | 51.8M measurements</span>
              </span>
              <span className="text-muted-foreground/30">|</span>
              <span className="flex items-center space-x-1">
                <span className="text-[#7c3aed]">HEL1OS:</span>
                <span className="text-starlight-white font-bold">92 light curves | 2.76M measurements</span>
              </span>
              <span className="text-muted-foreground/30">|</span>
              <span className="flex items-center space-x-1">
                <span className="text-supernova-gold">VELC:</span>
                <span className="text-starlight-white font-bold">100 Processed Observation Sessions | 74 extracted features/frame</span>
              </span>
            </div>
            <div className="flex items-center space-x-1.5 border-t md:border-t-0 md:border-l border-white/10 pt-2 md:pt-0 md:pl-4">
              <span className="text-muted-foreground">Observation Window:</span>
              <span className="text-orange-400 font-bold">Feb 2024 – Jun 2026</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
