import React, { useState } from 'react';
import { Sun, Zap, Link as LinkIcon, BarChart3 } from 'lucide-react';

/**
 * DashboardLayout Component
 * 
 * Design Philosophy:
 * - Asymmetric layout with fixed left sidebar
 * - Cosmic glyphs for module navigation
 * - Glowing active indicators
 * - Full-width main canvas for Three.js scenes
 * - Visual feedback during transitions
 */

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'velc',
    label: 'VELC',
    icon: <Sun className="w-6 h-6" />,
    description: 'Coronal Image Intelligence',
  },
  {
    id: 'solexs',
    label: 'SOLEXS',
    icon: <Zap className="w-6 h-6" />,
    description: 'Spectral & Time-Series',
  },
  {
    id: 'correlation',
    label: 'Correlation',
    icon: <LinkIcon className="w-6 h-6" />,
    description: 'Fusion Engine',
  },
  {
    id: 'overview',
    label: 'Overview',
    icon: <BarChart3 className="w-6 h-6" />,
    description: 'System Dashboard',
  },
];

interface DashboardLayoutProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
  children: React.ReactNode;
  isTransitioning?: boolean;
}

export default function DashboardLayout({
  activeModule,
  onModuleChange,
  children,
  isTransitioning = false,
}: DashboardLayoutProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-24 bg-cosmic-navy border-r border-border flex flex-col items-center py-8 px-4 space-y-8">
        {/* Logo/Brand */}
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-electric-blue to-deep-purple flex items-center justify-center transition-all duration-300 ${
          isTransitioning ? 'cosmic-glow-strong scale-110' : 'cosmic-glow-strong'
        }`}>
          <div className="w-10 h-10 rounded-full bg-cosmic-black flex items-center justify-center">
            <div className={`w-6 h-6 border-2 border-electric-blue rounded-full ${
              isTransitioning ? 'animate-spin' : 'animate-spin'
            }`} />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col space-y-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              className="relative group"
              title={item.description}
              disabled={isTransitioning}
            >
              {/* Glowing background for active state */}
              {activeModule === item.id && (
                <div className="absolute inset-0 rounded-lg bg-electric-blue opacity-20 blur-md" />
              )}

              {/* Icon button */}
              <div
                className={`relative w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  activeModule === item.id
                    ? 'bg-electric-blue text-cosmic-black cosmic-glow-strong'
                    : 'bg-cosmic-black text-electric-blue hover:bg-cosmic-navy'
                } ${isTransitioning && activeModule === item.id ? 'scale-110' : ''}`}
              >
                {item.icon}
              </div>

              {/* Tooltip on hover */}
              {hoveredItem === item.id && (
                <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-cosmic-navy border border-electric-blue rounded-lg px-3 py-2 whitespace-nowrap text-xs z-50 cosmic-glow">
                  <div className="font-semibold text-electric-blue">{item.label}</div>
                  <div className="text-muted-foreground text-xs">{item.description}</div>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Mission Control Badge */}
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-supernova-gold to-nebula-violet flex items-center justify-center cosmic-glow text-cosmic-black font-bold text-sm">
          MC
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* Starfield background */}
        <div className="absolute inset-0 starfield" />

        {/* Three.js Canvas Container */}
        <div className="absolute inset-0 z-0" id="three-canvas-container" />

        {/* Content Layer */}
        <div className={`relative z-10 h-full overflow-auto transition-opacity duration-300 ${
          isTransitioning ? 'opacity-50' : 'opacity-100'
        }`}>
          {children}
        </div>

        {/* Cockpit Overlay (Mission Control References) */}
        <div className="absolute top-4 right-4 z-20 space-y-2">
          {/* Aditya-L1 Data Stream */}
          <div className={`bg-cosmic-navy border border-electric-blue rounded-lg px-3 py-2 text-xs cosmic-glow transition-all duration-300 ${
            isTransitioning ? 'scale-110 cosmic-glow-strong' : ''
          }`}>
            <div className="text-electric-blue font-semibold">Aditya-L1</div>
            <div className="text-muted-foreground">Solar data stream active</div>
          </div>

          {/* AI Co-pilot */}
          <div className={`bg-cosmic-navy border border-deep-purple rounded-lg px-3 py-2 text-xs cosmic-glow transition-all duration-300 ${
            isTransitioning ? 'scale-110 cosmic-glow-strong' : ''
          }`}>
            <div className="text-deep-purple font-semibold">AI Co-pilot</div>
            <div className="text-muted-foreground">Anomaly forecasting ready</div>
          </div>

          {/* Crew Collaboration */}
          <div className={`bg-cosmic-navy border border-supernova-gold rounded-lg px-3 py-2 text-xs cosmic-glow transition-all duration-300 ${
            isTransitioning ? 'scale-110 cosmic-glow-strong' : ''
          }`}>
            <div className="text-supernova-gold font-semibold">Crew Terminal</div>
            <div className="text-muted-foreground">Collaboration active</div>
          </div>
        </div>

        {/* Transition Indicator */}
        {isTransitioning && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-4">
              <div className="text-2xl font-bold text-electric-blue animate-pulse">
                ENTERING WORMHOLE
              </div>
              <div className="text-sm text-muted-foreground">
                Dimensional shift in progress...
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
