import React, { useState } from 'react';
import { TrendingUp, Zap } from 'lucide-react';

/**
 * SOLEXS Module - Spectral & Time-Series Intelligence
 * 
 * Design Philosophy:
 * - Light curves rendered as orbital paths
 * - Flare bursts as supernovae
 * - Event classification as star systems
 * - Timeline explorer for temporal analysis
 */

interface FlareEvent {
  id: string;
  name: string;
  timestamp: string;
  intensity: number;
  duration: number;
  classification: 'quiet-sun' | 'microflare' | 'burst';
}

const SAMPLE_FLARES: FlareEvent[] = [
  {
    id: 'flare-001',
    name: 'Solar Flare Alpha',
    timestamp: '2026-06-24 08:15:00',
    intensity: 0.92,
    duration: 45,
    classification: 'burst',
  },
  {
    id: 'flare-002',
    name: 'Microflare Beta',
    timestamp: '2026-06-24 07:30:00',
    intensity: 0.54,
    duration: 12,
    classification: 'microflare',
  },
  {
    id: 'flare-003',
    name: 'Quiet Sun Period',
    timestamp: '2026-06-24 06:00:00',
    intensity: 0.15,
    duration: 90,
    classification: 'quiet-sun',
  },
];

interface SolexsModuleProps {
  onFlareSelect?: (flare: FlareEvent) => void;
}

export default function SolexsModule({ onFlareSelect }: SolexsModuleProps) {
  const [selectedFlare, setSelectedFlare] = useState<FlareEvent | null>(null);
  const [hoveredFlare, setHoveredFlare] = useState<string | null>(null);

  const handleFlareClick = (flare: FlareEvent) => {
    setSelectedFlare(flare);
    onFlareSelect?.(flare);
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'burst':
        return 'from-supernova-gold to-electric-blue';
      case 'microflare':
        return 'from-nebula-violet to-deep-purple';
      case 'quiet-sun':
        return 'from-electric-blue to-nebula-violet';
      default:
        return 'from-electric-blue to-deep-purple';
    }
  };

  const getClassificationBorder = (classification: string) => {
    switch (classification) {
      case 'burst':
        return 'border-supernova-gold';
      case 'microflare':
        return 'border-nebula-violet';
      case 'quiet-sun':
        return 'border-electric-blue';
      default:
        return 'border-electric-blue';
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <h2
          className="text-3xl font-bold text-deep-purple mb-2"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          Light Curve Analyzer
        </h2>
        <p className="text-muted-foreground text-sm">
          Flares ignite the cosmos. Explore temporal patterns and spectral signatures.
        </p>
      </div>

      {/* Timeline */}
      <div className="px-8 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-muted-foreground">Timeline:</span>
          <div className="flex-1 h-1 bg-cosmic-black rounded-full overflow-hidden">
            <div className="h-full w-3/4 bg-gradient-to-r from-deep-purple to-electric-blue" />
          </div>
          <span className="text-sm text-electric-blue font-semibold">75% Analyzed</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-8 pb-8 overflow-auto">
        <div className="space-y-4">
          {SAMPLE_FLARES.map((flare) => (
            <button
              key={flare.id}
              onClick={() => handleFlareClick(flare)}
              onMouseEnter={() => setHoveredFlare(flare.id)}
              onMouseLeave={() => setHoveredFlare(null)}
              className="group relative w-full"
            >
              {/* Timeline Event Card */}
              <div
                className={`relative bg-cosmic-navy border-2 ${getClassificationBorder(
                  flare.classification
                )} rounded-lg p-6 transition-all duration-300 ${
                  selectedFlare?.id === flare.id
                    ? 'cosmic-glow-strong'
                    : 'hover:cosmic-glow'
                }`}
              >
                {/* Gradient accent */}
                <div
                  className={`absolute top-0 left-0 w-full h-1 rounded-t-lg bg-gradient-to-r ${getClassificationColor(
                    flare.classification
                  )}`}
                />

                {/* Content */}
                <div className="relative z-10 flex items-start justify-between">
                  {/* Left side */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-starlight-white mb-2 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-deep-purple" />
                      {flare.name}
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {/* Timestamp */}
                      <div>
                        <span className="text-muted-foreground">Time</span>
                        <p className="text-electric-blue font-semibold">
                          {flare.timestamp.split(' ')[1]}
                        </p>
                      </div>

                      {/* Intensity */}
                      <div>
                        <span className="text-muted-foreground">Intensity</span>
                        <p className="text-supernova-gold font-semibold">
                          {(flare.intensity * 100).toFixed(0)}%
                        </p>
                      </div>

                      {/* Duration */}
                      <div>
                        <span className="text-muted-foreground">Duration</span>
                        <p className="text-nebula-violet font-semibold">
                          {flare.duration}m
                        </p>
                      </div>

                      {/* Classification */}
                      <div>
                        <span className="text-muted-foreground">Class</span>
                        <p className="text-electric-blue font-semibold">
                          {flare.classification.replace('-', ' ').toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right side - Intensity visualization */}
                  <div className="ml-6 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-electric-blue flex items-center justify-center relative">
                      <div
                        className="absolute inset-0 rounded-full bg-gradient-to-br from-electric-blue to-deep-purple opacity-30"
                        style={{
                          width: `${flare.intensity * 100}%`,
                          height: `${flare.intensity * 100}%`,
                          margin: 'auto',
                        }}
                      />
                      <span className="text-sm font-bold text-electric-blue z-10">
                        {(flare.intensity * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hover indicator */}
                {hoveredFlare === flare.id && (
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 text-deep-purple animate-pulse">
                    <Zap className="w-6 h-6" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Flare Details Panel */}
      {selectedFlare && (
        <div className="absolute bottom-8 right-8 bg-cosmic-navy border-2 border-deep-purple rounded-lg p-6 w-80 cosmic-glow-strong animate-fade-in">
          <h3 className="text-xl font-bold text-deep-purple mb-4">
            {selectedFlare.name}
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="text-starlight-white font-semibold">Timestamp:</span>{' '}
              {selectedFlare.timestamp}
            </p>
            <p>
              <span className="text-starlight-white font-semibold">Classification:</span>{' '}
              {selectedFlare.classification.replace('-', ' ')}
            </p>
            <p>
              <span className="text-starlight-white font-semibold">Peak Intensity:</span>{' '}
              {(selectedFlare.intensity * 100).toFixed(1)}%
            </p>
            <p>
              <span className="text-starlight-white font-semibold">Duration:</span>{' '}
              {selectedFlare.duration} minutes
            </p>
            <p className="pt-2 border-t border-border">
              This flare event represents a significant solar activity. The spectral
              signature and temporal characteristics suggest a {selectedFlare.classification.replace('-', ' ')}{' '}
              with observable impact on coronal structures.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
