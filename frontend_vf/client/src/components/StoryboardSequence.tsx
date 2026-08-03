import React, { useState, useEffect } from 'react';
import CockpitScene from './CockpitScene';
import VelcPlanetScene from './VelcPlanetScene';
import SolexsStarScene from './SolexsStarScene';
import WormholeTransition from './WormholeTransition';
import FusionOracleScene from './FusionOracleScene';

/**
 * Storyboard Sequence - Interstellar Style Narrative
 * 
 * Orchestrates five cinematic scenes:
 * 1. Cockpit intro (spaceship dashboard, starfield)
 * 2. VELC planet (coronal storm, black hole anomalies)
 * 3. SOLEXS star system (flare bursts, orbital timelines)
 * 4. Wormhole transition (radial distortion, particle swirl)
 * 5. Fusion hologram finale (AI oracle narration)
 */

type SceneType = 'cockpit' | 'velc' | 'solexs' | 'wormhole' | 'oracle' | 'complete';

interface StoryboardSequenceProps {
  onComplete?: () => void;
}

export default function StoryboardSequence({ onComplete }: StoryboardSequenceProps) {
  const [currentScene, setCurrentScene] = useState<SceneType>('cockpit');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSceneComplete = async () => {
    setIsTransitioning(true);

    // Sequence of scenes
    const sceneSequence: SceneType[] = ['cockpit', 'velc', 'solexs', 'wormhole', 'oracle', 'complete'];
    const currentIndex = sceneSequence.indexOf(currentScene);

    if (currentIndex < sceneSequence.length - 1) {
      const nextScene = sceneSequence[currentIndex + 1];

      // Add wormhole transition before oracle
      if (nextScene === 'oracle') {
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

      {/* Scene 1: Cockpit */}
      {currentScene === 'cockpit' && (
        <CockpitScene onComplete={handleSceneComplete} />
      )}

      {/* Scene 2: VELC Planet */}
      {currentScene === 'velc' && (
        <VelcPlanetScene onComplete={handleSceneComplete} />
      )}

      {/* Scene 3: SOLEXS Star System */}
      {currentScene === 'solexs' && (
        <SolexsStarScene onComplete={handleSceneComplete} />
      )}

      {/* Scene 5: Fusion Oracle */}
      {currentScene === 'oracle' && (
        <FusionOracleScene onComplete={handleSceneComplete} />
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
    </div>
  );
}
