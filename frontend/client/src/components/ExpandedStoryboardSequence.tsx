import React, { useState, useEffect } from 'react';
import EnhancedCockpitHUD from './EnhancedCockpitHUD';
import AsteroidBeltScene from './AsteroidBeltScene';
import EnhancedSolarFlareScene from './EnhancedSolarFlareScene';
import WormholeTransition from './WormholeTransition';
import BlackHoleScene from './BlackHoleScene';
import NebulaDataCloud from './NebulaDataCloud';

/**
 * Expanded Storyboard Sequence - Ultra-Realistic Space Cinema
 * 
 * Six Cinematic Scenes:
 * 1. Cockpit Introduction (Mission Control HUD)
 * 2. Asteroid Belt Flythrough (VELC Entry)
 * 3. Solar Flare Star System (SOLEXS Entry)
 * 4. Wormhole Transition (Correlation Engine)
 * 5. Black Hole Accretion Disk (Scientific Gravitas)
 * 6. Nebula Data Cloud (Fusion Insights)
 */

type SceneType = 'cockpit' | 'asteroids' | 'star' | 'wormhole' | 'blackhole' | 'nebula' | 'complete';

interface ExpandedStoryboardSequenceProps {
  onComplete?: () => void;
}

export default function ExpandedStoryboardSequence({ onComplete }: ExpandedStoryboardSequenceProps) {
  const [currentScene, setCurrentScene] = useState<SceneType>('cockpit');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSceneComplete = async () => {
    setIsTransitioning(true);

    // Sequence of scenes
    const sceneSequence: SceneType[] = [
      'cockpit',
      'asteroids',
      'star',
      'wormhole',
      'blackhole',
      'nebula',
      'complete',
    ];
    const currentIndex = sceneSequence.indexOf(currentScene);

    if (currentIndex < sceneSequence.length - 1) {
      const nextScene = sceneSequence[currentIndex + 1];

      // Add wormhole transition before black hole
      if (nextScene === 'blackhole') {
        setCurrentScene('wormhole');
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      setCurrentScene(nextScene);
      setIsTransitioning(false);
    } else {
      // Sequence complete
      onComplete?.();
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Wormhole transition overlay */}
      {currentScene === 'wormhole' && (
        <WormholeTransition
          isActive={true}
          duration={1.2}
          onComplete={() => handleSceneComplete()}
        />
      )}

      {/* Scene 1: Cockpit Introduction */}
      {currentScene === 'cockpit' && (
        <EnhancedCockpitHUD onComplete={handleSceneComplete} />
      )}

      {/* Scene 2: Asteroid Belt */}
      {currentScene === 'asteroids' && (
        <AsteroidBeltScene onComplete={handleSceneComplete} />
      )}

      {/* Scene 3: Solar Flare Star System */}
      {currentScene === 'star' && (
        <EnhancedSolarFlareScene onComplete={handleSceneComplete} />
      )}

      {/* Scene 5: Black Hole */}
      {currentScene === 'blackhole' && (
        <BlackHoleScene onComplete={handleSceneComplete} />
      )}

      {/* Scene 6: Nebula Data Cloud */}
      {currentScene === 'nebula' && (
        <NebulaDataCloud onComplete={handleSceneComplete} />
      )}

      {/* Scene complete - return to dashboard */}
      {currentScene === 'complete' && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center space-y-8">
            <h2
              className="text-6xl font-black"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                color: '#00d9ff',
                textShadow: '0 0 30px rgba(0, 217, 255, 0.8)',
              }}
            >
              Mission Complete
            </h2>
            <p className="text-muted-foreground text-lg">
              Return to the dashboard to explore the modules.
            </p>
          </div>
        </div>
      )}

      {/* Scene indicator */}
      <div className="absolute top-8 right-8 text-xs font-mono text-muted-foreground z-20">
        <div>SCENE: {currentScene.toUpperCase()}</div>
        <div>STATUS: {isTransitioning ? 'TRANSITIONING' : 'ACTIVE'}</div>
      </div>

      {/* Mission progress bar */}
      <div className="absolute bottom-8 left-8 right-8 z-20">
        <div className="text-xs font-mono text-muted-foreground mb-2">MISSION PROGRESS</div>
        <div className="w-full h-1 bg-black/60 border border-electric-blue/30 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-electric-blue to-deep-purple transition-all duration-500"
            style={{
              width: `${((sceneSequence.indexOf(currentScene) + 1) / 7) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

const sceneSequence: SceneType[] = [
  'cockpit',
  'asteroids',
  'star',
  'wormhole',
  'blackhole',
  'nebula',
  'complete',
];
