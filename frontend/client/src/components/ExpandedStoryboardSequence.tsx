import React, { useState, useEffect, useRef, useCallback } from 'react';
import BigBangPrologue from './BigBangPrologue';
import EnhancedCockpitHUD from './EnhancedCockpitHUD';
import EnhancedAsteroidBelt from './EnhancedAsteroidBelt';
import EnhancedSolarFlareScene from './EnhancedSolarFlareScene';
import WormholeTransition from './WormholeTransition';
import BlackHoleScene from './BlackHoleScene';
import NebulaDataCloud from './NebulaDataCloud';
import { audioEngine } from '@/lib/audio-engine';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * Expanded Storyboard Sequence with Audio - Ultra-Realistic Space Cinema
 * 
 * SCENE PROGRESSION:
 * 0. Big Bang Prologue (silence → explosion → narration)
 * 1. Cockpit Introduction (ambient hum)
 * 2. Asteroid Belt (turbulence + collision sounds)
 * 3. Solar Flare (heat distortion + flare crackles)
 * 4. Wormhole Transition (Doppler whoosh)
 * 5. Black Hole (deep bass rumble + tension)
 * 6. Nebula Data Cloud (ambient choir + serenity)
 */

type SceneType = 'bigbang' | 'cockpit' | 'asteroids' | 'star' | 'wormhole' | 'blackhole' | 'nebula' | 'complete';

const SCENE_ORDER: SceneType[] = [
  'bigbang',
  'cockpit',
  'asteroids',
  'star',
  'wormhole',
  'blackhole',
  'nebula',
  'complete',
];

interface ExpandedStoryboardSequenceProps {
  onComplete?: () => void;
}

export default function ExpandedStoryboardSequence({ onComplete }: ExpandedStoryboardSequenceProps) {
  const [currentScene, setCurrentScene] = useState<SceneType>('bigbang');
  const [audioState, setAudioState] = useState<string>('unknown');

  useEffect(() => {
    const checkState = () => {
      if (audioEngine.audioContext) {
        setAudioState(audioEngine.audioContext.state);
      }
    };
    checkState();
    const interval = setInterval(checkState, 1000);
    return () => clearInterval(interval);
  }, []);



  const sceneIndex = SCENE_ORDER.indexOf(currentScene);
  const progress = ((sceneIndex + 1) / SCENE_ORDER.length) * 100;

  const lastTransitionTime = useRef<number>(0);

  const handleSceneComplete = useCallback(() => {
    const now = Date.now();
    if (now - lastTransitionTime.current < 500) {
      console.warn('ExpandedStoryboardSequence: Ignored duplicate transition call');
      return;
    }
    lastTransitionTime.current = now;

    const nextIndex = sceneIndex + 1;
    if (nextIndex < SCENE_ORDER.length) {
      const nextScene = SCENE_ORDER[nextIndex];
      setCurrentScene(nextScene);
    } else {
      setCurrentScene('complete');
    }
  }, [sceneIndex]);

  useEffect(() => {
    // Avoid double speaking on mount if it's bigbang (let BigBangPrologue handle its own)
    if (currentScene === 'bigbang') {
      return;
    }

    // Stop previous sounds and narration
    audioEngine.stopAll();

    // Trigger scene-specific audio and narration
    let cleanUpFn: (() => void) | undefined;

    if (currentScene === 'cockpit') {
      audioEngine.playAmbientHum(12);
      audioEngine.speak("Welcome to Mission Control. Aditya-L1 observatory is online. Preparing for exploration.");
    } else if (currentScene === 'asteroids') {
      audioEngine.playAmbientHum(12);
      audioEngine.speak("Navigating through asteroid belt. Evasion maneuvers active. Scanning for coronal anomalies.");
    } else if (currentScene === 'star') {
      audioEngine.playAmbientHum(12);
      audioEngine.playFlareCrackle();
      const interval = setInterval(() => {
        audioEngine.playFlareCrackle();
      }, 1000);
      audioEngine.speak("Approaching solar flare system. Warning: high heat intensity and stellar bursts detected.");
      cleanUpFn = () => clearInterval(interval);
    } else if (currentScene === 'wormhole') {
      audioEngine.playWormholeWhoosh(3);
      audioEngine.speak("Entering wormhole transition. Preparing for space-time warp.");
    } else if (currentScene === 'blackhole') {
      audioEngine.playDeepBassRumble(12);
      audioEngine.speak("Warning. Gravitational time dilation active near the black hole event horizon.");
    } else if (currentScene === 'nebula') {
      audioEngine.playAmbientChoir(15);
      audioEngine.speak("Entering nebula data cloud. Space-time normalization complete. All modules synchronized.");
    }

    return () => {
      if (cleanUpFn) cleanUpFn();
    };
  }, [currentScene]);

  useEffect(() => {
    return () => {
      audioEngine.stopAll();
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      {/* Scene Container */}
      <div className="absolute inset-0">
        {/* Scene 0: Big Bang Prologue */}
        {currentScene === 'bigbang' && (
          <BigBangPrologue onComplete={handleSceneComplete} />
        )}

        {/* Scene 1: Cockpit Introduction */}
        {currentScene === 'cockpit' && (
          <EnhancedCockpitHUD onComplete={handleSceneComplete} />
        )}

        {/* Scene 2: Asteroid Belt */}
        {currentScene === 'asteroids' && (
          <EnhancedAsteroidBelt onComplete={handleSceneComplete} />
        )}

        {/* Scene 3: Solar Flare Star System */}
        {currentScene === 'star' && (
          <EnhancedSolarFlareScene onComplete={handleSceneComplete} />
        )}

        {/* Scene 4: Wormhole Transition */}
        {currentScene === 'wormhole' && (
          <WormholeTransition onComplete={handleSceneComplete} isActive={true} />
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
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center">
            <div className="text-center space-y-8">
              <div
                className="text-5xl font-bold"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  color: '#00d9ff',
                  textShadow: '0 0 30px rgba(0, 217, 255, 0.8)',
                }}
              >
                MISSION COMPLETE
              </div>

              <p
                className="text-xl max-w-2xl"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  color: '#7c3aed',
                }}
              >
                You have journeyed through the cosmos, witnessed the birth of the universe, and unlocked the secrets of
                stellar phenomena. Your mission continues...
              </p>

              <button
                onClick={() => onComplete?.()}
                className="px-8 py-3 border-2 border-electric-blue text-electric-blue hover:bg-electric-blue hover:text-black transition-colors"
                style={{
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                RETURN TO DASHBOARD
              </button>
            </div>

            {/* Scan lines */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1), rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
                mixBlendMode: 'multiply',
              }}
            />
          </div>
        )}
      </div>

      {/* Floating Audio Control Panel */}
      <div className="absolute top-8 left-8 z-30 font-mono text-xs bg-black/80 border border-electric-blue/40 p-3 rounded backdrop-blur flex flex-col gap-2 shadow-[0_0_15px_rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          {audioState === 'running' ? (
            <Volume2 className="w-4 h-4 text-electric-blue animate-pulse" />
          ) : (
            <VolumeX className="w-4 h-4 text-orange-500" />
          )}
          <span className="text-muted-foreground">AUDIO:</span>
          <span className={audioState === 'running' ? 'text-electric-blue font-bold' : 'text-orange-500 font-bold'}>
            {audioState.toUpperCase()}
          </span>
        </div>
        
        {audioState !== 'running' && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                audioEngine.resumeContext();
              }}
              className="px-2 py-0.5 bg-electric-blue/20 hover:bg-electric-blue/40 border border-electric-blue/40 text-electric-blue rounded transition-colors text-[10px]"
            >
              ACTIVATE
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-deep-purple/30 z-20">
        <div
          className="h-full bg-gradient-to-r from-electric-blue to-supernova-gold transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Scene indicator */}
      <div className="absolute top-8 right-8 text-xs font-mono text-muted-foreground z-20">
        <div className="text-electric-blue">SCENE {sceneIndex + 1} OF {SCENE_ORDER.length}</div>
        <div className="text-deep-purple">
          {currentScene === 'bigbang' && 'BIG BANG PROLOGUE'}
          {currentScene === 'cockpit' && 'COCKPIT INTRODUCTION'}
          {currentScene === 'asteroids' && 'ASTEROID BELT'}
          {currentScene === 'star' && 'SOLAR FLARE SYSTEM'}
          {currentScene === 'wormhole' && 'WORMHOLE TRANSITION'}
          {currentScene === 'blackhole' && 'BLACK HOLE ENCOUNTER'}
          {currentScene === 'nebula' && 'NEBULA DATA CLOUD'}
          {currentScene === 'complete' && 'MISSION COMPLETE'}
        </div>
      </div>
    </div>
  );
}
