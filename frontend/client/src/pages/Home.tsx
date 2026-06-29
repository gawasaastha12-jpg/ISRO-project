import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CinematicIntro from '@/components/CinematicIntro';
import ExpandedStoryboardSequence from '@/components/ExpandedStoryboardSequence';
import { CosmicScene } from '@/lib/three-scene';
import { audioEngine } from '@/lib/audio-engine';

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [scene, setScene] = useState<CosmicScene | null>(null);
  const [alertState, setAlertState] = useState<'NORMAL' | 'WARNING' | 'SEVERE'>('NORMAL');
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize audio and solar wind when alert state changes
  useEffect(() => {
    if (scene) {
      if (alertState === 'WARNING') {
        scene.setSolarWindState('M');
        audioEngine.playCollisionImpact();
        // Voice alert
        const utterance = new SpeechSynthesisUtterance("Warning. Solar flare onset probability has exceeded 35 percent at the 5-minute horizon.");
        window.speechSynthesis.speak(utterance);
      } else if (alertState === 'SEVERE') {
        scene.setSolarWindState('X');
        audioEngine.playCollisionImpact();
      } else {
        scene.setSolarWindState('Quiet');
      }
    }
  }, [alertState, scene]);

  // Simulate an alert trigger after 10 seconds for demo purposes
  useEffect(() => {
    const timer = setTimeout(() => {
      setAlertState('WARNING');
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    try {
      const cosmicScene = new CosmicScene({
        container: containerRef.current,
        width,
        height,
        backgroundColor: 0x0a0e27,
      });

      // We'll update the solar wind effect in three-scene.ts directly,
      // but we instantiate the scene here.
      cosmicScene.startRenderLoop();
      setScene(cosmicScene);

      // Handle window resize
      const handleResize = () => {
        if (containerRef.current) {
          const newWidth = containerRef.current.clientWidth;
          const newHeight = containerRef.current.clientHeight;
          cosmicScene.camera.aspect = newWidth / newHeight;
          cosmicScene.camera.updateProjectionMatrix();
          cosmicScene.renderer.setSize(newWidth, newHeight);
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        cosmicScene.dispose();
      };
    } catch (error) {
      console.error('Failed to initialize Three.js scene:', error);
    }
  }, []);

  if (showIntro) {
    return <CinematicIntro onComplete={() => setShowIntro(false)} />;
  }

  // A small button to let the user re-trigger the storyboard if they want
  // since the new dashboard is immediate. (Optional but good UX)
  if (showStoryboard) {
    return <ExpandedStoryboardSequence onComplete={() => setShowStoryboard(false)} />;
  }

  return (
    <>
      <DashboardLayout alertState={alertState}>
        {/* Three.js Canvas Container goes in the background slot of DashboardLayout */}
        <div
          ref={containerRef}
          id="three-canvas-container"
          className="w-full h-full"
        />
      </DashboardLayout>
      
      {/* Floating button to watch storyboard since we removed the Overview module */}
      <button 
        onClick={() => setShowStoryboard(true)}
        className="fixed bottom-4 right-4 z-50 px-3 py-1.5 bg-cosmic-navy/80 border border-electric-blue/30 rounded text-[10px] text-electric-blue uppercase tracking-widest hover:bg-electric-blue/20 backdrop-blur"
      >
        Watch Storyboard
      </button>
    </>
  );
}
