import React, { useState } from 'react';
import { Link2, Sparkles } from 'lucide-react';

/**
 * Correlation Engine - Fusion Layer
 * 
 * Design Philosophy:
 * - Wormhole transition visualization
 * - Dual-axis holographic chart
 * - Event matching system
 * - AI oracle insights
 */

interface CorrelationEvent {
  id: string;
  velcEvent: string;
  solexsEvent: string;
  correlation: number;
  timestamp: string;
  insight: string;
}

const SAMPLE_CORRELATIONS: CorrelationEvent[] = [
  {
    id: 'corr-001',
    velcEvent: 'Coronal Black Hole',
    solexsEvent: 'Solar Flare Alpha',
    correlation: 0.96,
    timestamp: '2026-06-24 08:15:00',
    insight:
      'The coronal structure shift preceded the flare burst by 2 minutes, suggesting magnetic field reconfiguration.',
  },
  {
    id: 'corr-002',
    velcEvent: 'Magnetic Storm',
    solexsEvent: 'Microflare Beta',
    correlation: 0.87,
    timestamp: '2026-06-24 07:30:00',
    insight:
      'Spectral anomalies align with coronal intensity variations, indicating coupled plasma dynamics.',
  },
  {
    id: 'corr-003',
    velcEvent: 'Loop Distortion',
    solexsEvent: 'Quiet Sun Period',
    correlation: 0.65,
    timestamp: '2026-06-24 06:00:00',
    insight:
      'Minor structural changes observed during stable periods, suggesting baseline oscillations.',
  },
];

interface CorrelationEngineProps {
  onCorrelationSelect?: (correlation: CorrelationEvent) => void;
}

export default function CorrelationEngine({
  onCorrelationSelect,
}: CorrelationEngineProps) {
  const [selectedCorrelation, setSelectedCorrelation] =
    useState<CorrelationEvent | null>(null);
  const [hoveredCorrelation, setHoveredCorrelation] = useState<string | null>(
      null
    );

  const handleCorrelationClick = (correlation: CorrelationEvent) => {
    setSelectedCorrelation(correlation);
    onCorrelationSelect?.(correlation);
  };

  const getCorrelationColor = (correlation: number) => {
    if (correlation > 0.9) return 'from-electric-blue to-supernova-gold';
    if (correlation > 0.75) return 'from-deep-purple to-electric-blue';
    return 'from-nebula-violet to-deep-purple';
  };

  const getCorrelationBorder = (correlation: number) => {
    if (correlation > 0.9) return 'border-electric-blue';
    if (correlation > 0.75) return 'border-deep-purple';
    return 'border-nebula-violet';
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <h2
          className="text-3xl font-bold text-supernova-gold mb-2"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          Correlation Engine
        </h2>
        <p className="text-muted-foreground text-sm">
          When corona changes match spectral spikes, scientific truth emerges.
        </p>
      </div>

      {/* Wormhole Transition Indicator */}
      <div className="px-8 py-4 border-b border-border">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-electric-blue animate-pulse" />
            <span className="text-muted-foreground">Wormhole Synchronized</span>
          </div>
          <div className="flex-1 h-1 bg-gradient-to-r from-electric-blue via-deep-purple to-supernova-gold rounded-full" />
          <span className="text-electric-blue font-semibold">
            {SAMPLE_CORRELATIONS.length} Correlations Detected
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-8 pb-8 overflow-auto">
        <div className="space-y-4">
          {SAMPLE_CORRELATIONS.map((correlation) => (
            <button
              key={correlation.id}
              onClick={() => handleCorrelationClick(correlation)}
              onMouseEnter={() => setHoveredCorrelation(correlation.id)}
              onMouseLeave={() => setHoveredCorrelation(null)}
              className="group relative w-full"
            >
              {/* Correlation Card */}
              <div
                className={`relative bg-cosmic-navy border-2 ${getCorrelationBorder(
                  correlation.correlation
                )} rounded-lg p-6 transition-all duration-300 ${
                  selectedCorrelation?.id === correlation.id
                    ? 'cosmic-glow-strong'
                    : 'hover:cosmic-glow'
                }`}
              >
                {/* Gradient accent */}
                <div
                  className={`absolute top-0 left-0 w-full h-1 rounded-t-lg bg-gradient-to-r ${getCorrelationColor(
                    correlation.correlation
                  )}`}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-supernova-gold" />
                      <h3 className="text-lg font-semibold text-starlight-white">
                        Event Correlation
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-electric-blue">
                        {(correlation.correlation * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Correlation
                      </div>
                    </div>
                  </div>

                  {/* Events Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* VELC Event */}
                    <div className="bg-cosmic-black rounded-lg p-4 border border-electric-blue/30">
                      <div className="text-xs text-muted-foreground mb-1">
                        VELC Module
                      </div>
                      <div className="text-sm font-semibold text-electric-blue">
                        {correlation.velcEvent}
                      </div>
                    </div>

                    {/* SOLEXS Event */}
                    <div className="bg-cosmic-black rounded-lg p-4 border border-deep-purple/30">
                      <div className="text-xs text-muted-foreground mb-1">
                        SOLEXS Module
                      </div>
                      <div className="text-sm font-semibold text-deep-purple">
                        {correlation.solexsEvent}
                      </div>
                    </div>
                  </div>

                  {/* Correlation Strength Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        Correlation Strength
                      </span>
                      <span className="text-xs text-supernova-gold font-semibold">
                        {(correlation.correlation * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-cosmic-black rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getCorrelationColor(
                          correlation.correlation
                        )}`}
                        style={{
                          width: `${correlation.correlation * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-muted-foreground border-t border-border pt-3">
                    {correlation.timestamp}
                  </div>
                </div>

                {/* Hover indicator */}
                {hoveredCorrelation === correlation.id && (
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 text-supernova-gold animate-pulse">
                    <Sparkles className="w-6 h-6" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* AI Oracle Insights Panel */}
      {selectedCorrelation && (
        <div className="absolute bottom-8 right-8 bg-cosmic-navy border-2 border-supernova-gold rounded-lg p-6 w-96 cosmic-glow-strong animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-supernova-gold" />
            <h3 className="text-lg font-bold text-supernova-gold">
              AI Oracle Insight
            </h3>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="text-starlight-white font-semibold">
                Correlation Strength:
              </span>{' '}
              {(selectedCorrelation.correlation * 100).toFixed(1)}%
            </p>
            <p>
              <span className="text-starlight-white font-semibold">
                VELC Event:
              </span>{' '}
              {selectedCorrelation.velcEvent}
            </p>
            <p>
              <span className="text-starlight-white font-semibold">
                SOLEXS Event:
              </span>{' '}
              {selectedCorrelation.solexsEvent}
            </p>
            <p className="pt-2 border-t border-border italic text-nebula-violet">
              "{selectedCorrelation.insight}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
