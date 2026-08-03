import React, { useState } from 'react';
import { ChevronRight, Zap } from 'lucide-react';

/**
 * VELC Module - Coronal Image Intelligence
 * 
 * Design Philosophy:
 * - Anomalies visualized as black holes bending light
 * - Similarity search as galaxy clusters
 * - Glowing data points with hover interactions
 * - Floating panels for data exploration
 */

interface Anomaly {
  id: string;
  name: string;
  intensity: number;
  type: 'black-hole' | 'coronal-storm' | 'magnetic-loop';
  confidence: number;
}

const SAMPLE_ANOMALIES: Anomaly[] = [
  {
    id: 'anom-001',
    name: 'Coronal Black Hole',
    intensity: 0.95,
    type: 'black-hole',
    confidence: 0.98,
  },
  {
    id: 'anom-002',
    name: 'Magnetic Storm',
    intensity: 0.87,
    type: 'coronal-storm',
    confidence: 0.92,
  },
  {
    id: 'anom-003',
    name: 'Loop Distortion',
    intensity: 0.72,
    type: 'magnetic-loop',
    confidence: 0.85,
  },
];

interface VelcModuleProps {
  onAnomalySelect?: (anomaly: Anomaly) => void;
}

export default function VelcModule({ onAnomalySelect }: VelcModuleProps) {
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [hoveredAnomaly, setHoveredAnomaly] = useState<string | null>(null);

  const handleAnomalyClick = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    onAnomalySelect?.(anomaly);
  };

  const getAnomalyColor = (type: string) => {
    switch (type) {
      case 'black-hole':
        return 'from-electric-blue to-deep-purple';
      case 'coronal-storm':
        return 'from-supernova-gold to-electric-blue';
      case 'magnetic-loop':
        return 'from-nebula-violet to-deep-purple';
      default:
        return 'from-electric-blue to-nebula-violet';
    }
  };

  const getAnomalyBorder = (type: string) => {
    switch (type) {
      case 'black-hole':
        return 'border-electric-blue';
      case 'coronal-storm':
        return 'border-supernova-gold';
      case 'magnetic-loop':
        return 'border-nebula-violet';
      default:
        return 'border-electric-blue';
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <h2
          className="text-3xl font-bold text-electric-blue mb-2"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          Anomaly Explorer
        </h2>
        <p className="text-muted-foreground text-sm">
          Anomalies bend light like gravity wells. Explore coronal structures.
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-8 pb-8 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SAMPLE_ANOMALIES.map((anomaly) => (
            <button
              key={anomaly.id}
              onClick={() => handleAnomalyClick(anomaly)}
              onMouseEnter={() => setHoveredAnomaly(anomaly.id)}
              onMouseLeave={() => setHoveredAnomaly(null)}
              className="group relative"
            >
              {/* Card */}
              <div
                className={`relative bg-cosmic-navy border-2 ${getAnomalyBorder(
                  anomaly.type
                )} rounded-lg p-6 transition-all duration-300 ${
                  selectedAnomaly?.id === anomaly.id
                    ? 'cosmic-glow-strong scale-105'
                    : 'hover:cosmic-glow'
                }`}
              >
                {/* Gradient accent */}
                <div
                  className={`absolute top-0 left-0 w-full h-1 rounded-t-lg bg-gradient-to-r ${getAnomalyColor(
                    anomaly.type
                  )}`}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Title */}
                  <h3 className="text-lg font-semibold text-starlight-white mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-electric-blue" />
                    {anomaly.name}
                  </h3>

                  {/* Metrics */}
                  <div className="space-y-3 text-sm">
                    {/* Intensity */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Intensity</span>
                        <span className="text-electric-blue font-semibold">
                          {(anomaly.intensity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-cosmic-black rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-electric-blue to-deep-purple"
                          style={{ width: `${anomaly.intensity * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Confidence */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className="text-supernova-gold font-semibold">
                          {(anomaly.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-cosmic-black rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-supernova-gold to-nebula-violet"
                          style={{ width: `${anomaly.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Type badge */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-cosmic-black border border-electric-blue text-electric-blue">
                      {anomaly.type.replace('-', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Hover indicator */}
                {hoveredAnomaly === anomaly.id && (
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 text-electric-blue animate-pulse">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Anomaly Details Panel */}
      {selectedAnomaly && (
        <div className="absolute bottom-8 right-8 bg-cosmic-navy border-2 border-electric-blue rounded-lg p-6 w-80 cosmic-glow-strong animate-fade-in">
          <h3 className="text-xl font-bold text-electric-blue mb-4">
            {selectedAnomaly.name}
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="text-starlight-white font-semibold">Type:</span>{' '}
              {selectedAnomaly.type.replace('-', ' ')}
            </p>
            <p>
              <span className="text-starlight-white font-semibold">Intensity:</span>{' '}
              {(selectedAnomaly.intensity * 100).toFixed(1)}%
            </p>
            <p>
              <span className="text-starlight-white font-semibold">Confidence:</span>{' '}
              {(selectedAnomaly.confidence * 100).toFixed(1)}%
            </p>
            <p className="pt-2 border-t border-border">
              This anomaly represents a significant coronal structure. The high
              intensity and confidence values suggest a stable, observable
              phenomenon worthy of further investigation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
