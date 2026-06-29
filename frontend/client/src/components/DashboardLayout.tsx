import React, { useEffect, useState } from 'react';
import MissionStatusBar from './dashboard/MissionStatusBar';
import { LiveFlareGauge, MissionSummary } from './dashboard/MissionOverview';
import { IntelligenceCards } from './dashboard/IntelligenceCards';
import { CrossInstrumentTimeline } from './dashboard/CrossInstrumentTimeline';
import { LightCurvePanel } from './dashboard/LightCurvePanel';
import { CoronalImageViewer } from './dashboard/CoronalImageViewer';
import { ExplainableAIPanel, FusionReasoningPanel } from './dashboard/AIContextPanels';
import { BackendHealth, InstrumentHealth } from './dashboard/HealthPanels';
import { AlertPanel } from './dashboard/AlertPanel';

interface DashboardLayoutProps {
  children?: React.ReactNode;
  alertState?: 'NORMAL' | 'WARNING' | 'SEVERE';
}

export default function DashboardLayout({ children, alertState = 'NORMAL' }: DashboardLayoutProps) {


  return (
    <div className={`flex flex-col h-screen bg-cosmic-black text-foreground overflow-hidden transition-colors duration-1000 ${
      alertState !== 'NORMAL' ? 'border-[3px] border-red-500 animate-pulse' : ''
    }`}>
      
      {/* Global Status Bar */}
      <MissionStatusBar />

      {/* Background layer for Three.js */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {children}
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 overflow-y-auto p-4 z-10 custom-scrollbar">
        <div className="max-w-[1920px] mx-auto space-y-4">
          
          {/* Row 1: Mission Overview (Gauge & Summary) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-64">
             <div className="md:col-span-1">
                <LiveFlareGauge />
             </div>
             <div className="md:col-span-2">
                <MissionSummary />
             </div>
          </div>

          {/* Row 2: Intelligence Cards */}
          <IntelligenceCards />

          {/* Row 3: Timeline */}
          <CrossInstrumentTimeline />

          {/* Row 4: Main Analysis (LightCurve & Coronal Viewer) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <LightCurvePanel />
            <CoronalImageViewer />
          </div>

          {/* Row 5: AI & Context */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-80">
            <div className="lg:col-span-1">
               <ExplainableAIPanel />
            </div>
            <div className="lg:col-span-1">
               <FusionReasoningPanel />
            </div>
            <div className="lg:col-span-1">
               <AlertPanel />
            </div>
          </div>

          {/* Row 6: Health & Infrastructure */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-12">
             <BackendHealth />
             <InstrumentHealth />
          </div>

        </div>
      </div>
    </div>
  );
}
