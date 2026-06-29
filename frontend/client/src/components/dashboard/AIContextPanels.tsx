import React, { useEffect, useState } from 'react';
import { BrainCircuit, GitCommit, GitBranch } from 'lucide-react';
import { MOCK_AI_FEATURES } from '../../lib/mock-data';

export function ExplainableAIPanel() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col p-4 bg-cosmic-navy/50 border border-border/50 rounded-lg h-full relative overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold tracking-wide uppercase text-sm flex items-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <BrainCircuit className="w-4 h-4 mr-2 text-starlight-white" />
          Explainable AI (SHAP)
        </h3>
      </div>
      
      <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="text-xs text-muted-foreground uppercase mb-2 border-b border-border/30 pb-1">Top Contributing Features</div>
        
        {MOCK_AI_FEATURES.map((feature, i) => (
          <div key={feature.name} className="flex flex-col space-y-1 group">
            <div className="flex justify-between text-xs">
              <span className="text-starlight-white font-medium">{feature.name}</span>
              <span className="text-electric-blue" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{feature.value}</span>
            </div>
            <div className="flex items-center space-x-2">
              {/* Waterfall bar */}
              <div className="flex-1 h-1.5 bg-black rounded-full overflow-hidden flex justify-end">
                <div 
                  className="h-full bg-electric-blue transition-all duration-1000 ease-out origin-right" 
                  style={{ 
                    width: mounted ? `${feature.impact}%` : '0%',
                    transform: mounted ? 'scaleX(1)' : 'scaleX(0)'
                  }} 
                />
              </div>
              <span className="text-[9px] text-muted-foreground w-12 text-right">{feature.raw}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { MOCK_FUSION_REASONING } from '../../lib/mock-data';

export function FusionReasoningPanel() {
  return (
    <div className="flex flex-col p-4 bg-cosmic-navy/50 border border-border/50 rounded-lg h-full relative overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold tracking-wide uppercase text-sm flex items-center text-starlight-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <GitCommit className="w-4 h-4 mr-2" />
          Fusion Reasoning
        </h3>
      </div>
      
      <div className="flex flex-col h-full relative">
        {/* Connection Line */}
        <div className="absolute left-4 top-4 bottom-12 w-px bg-border z-0"></div>

        <div className="space-y-6 z-10 flex-1">
          {MOCK_FUSION_REASONING.map((node, i) => (
            <div key={node.id} className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-cosmic-navy border border-border flex items-center justify-center shrink-0 shadow-lg">
                <span className="text-[10px] font-bold text-muted-foreground">{node.confidence}%</span>
              </div>
              <div className="flex flex-col pt-1">
                <span className="text-xs font-bold text-starlight-white">{node.component}</span>
                <span className="text-xs text-muted-foreground">{node.reason}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/30 flex items-center space-x-3 z-10">
           <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
             <GitBranch className="w-4 h-4 text-green-400" />
           </div>
           <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase">Final Confidence</span>
              <span className="text-sm font-bold text-green-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>67.9% (Converged)</span>
           </div>
        </div>
      </div>
    </div>
  );
}
