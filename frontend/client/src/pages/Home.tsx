import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import VelcModuleEnhanced from '@/components/VelcModuleEnhanced';
import SolexsModuleEnhanced from '@/components/SolexsModuleEnhanced';
import CorrelationEngineEnhanced from '@/components/CorrelationEngineEnhanced';
import WormholeTransition from '@/components/WormholeTransition';
import HeroSection from '@/components/HeroSection';
import OverviewHero from '@/components/OverviewHero';
import CinematicIntro from '@/components/CinematicIntro';
import EnhancedStoryboardWithAudio from '@/components/EnhancedStoryboardWithAudio';
import { CosmicScene } from '@/lib/three-scene';

/**
 * Home Page - Cosmic Intelligence Platform
 * 
 * Design Philosophy:
 * - Cinematic storytelling through module transitions
 * - Realistic cosmic imagery and backgrounds
 * - Advanced particle systems and nebula effects
 * - Immersive narrative-driven experience
 * - Wormhole shader effects for transitions
 * - Interstellar-style storyboard sequence
 */

type ModuleType = 'velc' | 'solexs' | 'correlation' | 'overview';

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleType>('overview');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [scene, setScene] = useState<CosmicScene | null>(null);
  const [showOverviewHero, setShowOverviewHero] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

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

      // Create some initial cosmic elements
      cosmicScene.createGlowingSphere(
        { x: 0, y: 0, z: 0 } as any,
        2,
        0x00d9ff,
        0.8
      );

      cosmicScene.createGlowingTorus(
        { x: 0, y: 0, z: 0 } as any,
        4,
        0.3,
        0x7c3aed
      );

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

  // Handle module changes with wormhole transition
  const handleModuleChange = async (moduleId: string) => {
    const newModule = moduleId as ModuleType;

    // Start wormhole transition
    setIsTransitioning(true);

    // Wait for wormhole effect to complete
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Change module
    setActiveModule(newModule);

    if (scene) {
      // Trigger camera transition and particle burst after wormhole
      const targetPosition = { x: 0, y: 0, z: 8 } as any;
      const targetLookAt = { x: 0, y: 0, z: 0 } as any;

      try {
        await scene.cameraTransition(targetPosition, targetLookAt, 800);

        // Create particle burst effect
        scene.createParticleBurst(
          { x: 0, y: 0, z: 0 } as any,
          150,
          0xfbbf24,
          1
        );
      } catch (error) {
        console.error('Camera transition failed:', error);
      }
    }

    setIsTransitioning(false);
  };

  // Handle mouse movement for parallax
  const handleMouseMove = (e: React.MouseEvent) => {
    if (scene && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width;
      const mouseY = (e.clientY - rect.top) / rect.height;
      scene.animateParticles(mouseX * 100, mouseY * 100);
    }
  };

  if (showIntro) {
    return <CinematicIntro onComplete={() => setShowIntro(false)} />;
  }

  if (showStoryboard) {
    return <EnhancedStoryboardWithAudio onComplete={() => setShowStoryboard(false)} />;
  }

  return (
    <>
      {/* Wormhole Transition Effect */}
      <WormholeTransition
        isActive={isTransitioning}
        duration={1.2}
        onComplete={() => setIsTransitioning(false)}
      />

      <DashboardLayout
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        isTransitioning={isTransitioning}
      >
        {/* Three.js Canvas Container */}
        <div
          ref={containerRef}
          id="three-canvas-container"
          className="w-full h-full"
          onMouseMove={handleMouseMove}
        />

        {/* Module Content */}
        {activeModule === 'overview' && (
          <div className="absolute inset-0">
            {showOverviewHero && (
              <OverviewHero
                onComplete={() => setShowOverviewHero(false)}
              />
            )}
            {!showOverviewHero && (
              <div className="absolute inset-0 pointer-events-auto flex flex-col items-center justify-center">
                <div className="text-center z-10 space-y-6">
                  <h1
                    className="text-6xl font-black"
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      color: '#00d9ff',
                      textShadow:
                        '0 0 30px rgba(0, 217, 255, 0.8), 0 0 60px rgba(124, 58, 237, 0.4)',
                    }}
                  >
                    Cosmic Intelligence
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Navigate through the cosmos. Discover solar intelligence.
                  </p>
                  <p className="text-sm text-nebula-violet mb-8">
                    Select a module from the sidebar to begin your journey.
                  </p>
                  <button
                    onClick={() => setShowStoryboard(true)}
                    className="px-8 py-3 bg-electric-blue/20 border border-electric-blue rounded hover:bg-electric-blue/30 transition-colors"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    ▶ WATCH STORYBOARD
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeModule === 'velc' && (
          <div className="absolute inset-0 pointer-events-auto">
            <VelcModuleEnhanced />
          </div>
        )}

        {activeModule === 'solexs' && (
          <div className="absolute inset-0 pointer-events-auto">
            <SolexsModuleEnhanced />
          </div>
        )}

        {activeModule === 'correlation' && (
          <div className="absolute inset-0 pointer-events-auto">
            <CorrelationEngineEnhanced />
          </div>
        )}
      </DashboardLayout>
    </>
  );
}
