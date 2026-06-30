import React, { useEffect, useState } from 'react';
import MissionStatusBar from './dashboard/MissionStatusBar';
import { LiveFlareGauge, ForecastTimeline, FusionDecisionCard } from './dashboard/MissionOverview';
import { CrossInstrumentTimeline } from './dashboard/CrossInstrumentTimeline';
import { LightCurvePanel } from './dashboard/LightCurvePanel';
import { CoronalImageViewer } from './dashboard/CoronalImageViewer';
import { ExplainableAIPanel, HeliosActivityPanel } from './dashboard/AIContextPanels';
import { BackendHealth, InstrumentHealthHeatmap, CorrelationEngineWidget } from './dashboard/HealthPanels';
import { AlertPanel } from './dashboard/AlertPanel';
import { PredictionHistoryPanel } from './dashboard/PredictionHistoryPanel';
import gsap from 'gsap';

interface DashboardLayoutProps {
  children?: React.ReactNode;
  alertState?: 'NORMAL' | 'WARNING' | 'SEVERE';
}

export default function DashboardLayout({ children, alertState = 'NORMAL' }: DashboardLayoutProps) {

  useEffect(() => {
    // GSAP sequential entrance animation
    const delays = [0, 150, 250, 350, 500, 700, 900, 1100];
    
    delays.forEach(delay => {
      gsap.fromTo(`.gsap-delay-${delay}`, 
        { opacity: 0, y: 30 }, 
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: delay / 1000, clearProps: 'all' }
      );
    });
  }, []);

  return (
    <div className={`flex flex-col h-screen bg-cosmic-black text-foreground overflow-hidden relative`}>
      
      {/* Border Pulse Overlay */}
      <div className={`absolute inset-0 z-50 pointer-events-none transition-all duration-1000 ${
        (alertState === 'SEVERE' || alertState === 'ALERT') ? 'border-[4px] border-red-500 animate-pulse shadow-[inset_0_0_50px_rgba(239,68,68,0.5)]' : 'border-0'
      }`} />

      {/* Global Status Bar (Delay 0ms) */}
      <div className="gsap-delay-0 z-20">
        <MissionStatusBar />
      </div>

      {/* Background layer for Three.js */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {children}
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 overflow-y-auto p-4 z-10 custom-scrollbar">
        <div className="max-w-[1920px] mx-auto flex flex-col space-y-4">
          
          {/* Row 1: Mission Overview (Gauge, Timeline, Fusion) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[280px]">
             <div className="lg:col-span-1 gsap-delay-150">
                <LiveFlareGauge />
             </div>
             <div className="lg:col-span-2 gsap-delay-250">
                <ForecastTimeline />
             </div>
             <div className="lg:col-span-1 gsap-delay-350">
                <FusionDecisionCard />
             </div>
          </div>

          {/* Row 2: Main Analysis (SOLEXS 40%, VELC 60%) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-96">
            <div className="lg:col-span-2 gsap-delay-500">
              <LightCurvePanel />
            </div>
            <div className="lg:col-span-3 gsap-delay-500">
              <CoronalImageViewer />
            </div>
          </div>

          {/* Row 3: Activity & AI (HEL1OS, Explainable AI) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[310px]">
            <div className="lg:col-span-1 gsap-delay-700">
               <HeliosActivityPanel />
            </div>
            <div className="lg:col-span-2 gsap-delay-700">
               <ExplainableAIPanel />
            </div>
          </div>

          {/* Row 4: Timeline */}
          <div className="gsap-delay-900">
            <CrossInstrumentTimeline />
          </div>

          {/* Row 5: Systems (Correlation, Alerts, Backend, Instrument Health) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-64">
             <div className="lg:col-span-1 gsap-delay-1100">
                <CorrelationEngineWidget />
             </div>
             <div className="lg:col-span-1 gsap-delay-1100">
                <AlertPanel />
             </div>
             <div className="lg:col-span-1 gsap-delay-1100">
                <BackendHealth />
             </div>
             <div className="lg:col-span-1 gsap-delay-1100">
                <InstrumentHealthHeatmap />
             </div>
          </div>

          {/* Row 6: Past Events */}
          <div className="gsap-delay-1100">
             <PredictionHistoryPanel />
          </div>


          {/* Footer: Data Provenance */}
          <div className="gsap-delay-1100 flex flex-col md:flex-row justify-between items-center bg-black/40 border border-border/30 rounded p-3 text-[10px] font-mono text-muted-foreground uppercase tracking-wider gap-4 pb-12">
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
                <span className="text-starlight-white font-bold">100 FITS images | 74 extracted features/frame</span>
              </span>
            </div>
            <div className="flex items-center space-x-1.5 border-t md:border-t-0 md:border-l border-border/30 pt-2 md:pt-0 md:pl-4">
              <span className="text-muted-foreground">Observation Window:</span>
              <span className="text-orange-400 font-bold">Feb 2024 – Jun 2026</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
