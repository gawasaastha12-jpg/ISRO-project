import React, { useState, useEffect, useRef, useCallback } from 'react';
import BigBangPrologue from './BigBangPrologue';
import SpaceshipTakeoffScene from './SpaceshipTakeoffScene';
import BrunoSpaceExperience from './BrunoSpaceExperience';
import SolarFlareSatelliteImpactScene from './SolarFlareSatelliteImpactScene';
import { audioEngine } from '@/lib/audio-engine';

/**
 * Storyboard Sequence
 *
 * SCENE PROGRESSION:
 * 0. Big Bang Prologue (silence → explosion → "birth of the universe" narration)
 * 1. Solar Flare Satellite Impact (cinematic story: corona builds, flare erupts,
 *    electrons/protons travel out and hit the satellite — shield and signal HUD react)
 * 2. Spaceship Takeoff (procedural rocket launchpad sequence)
 * 3. Bruno Simon 3D Pilot Mode (free flight after the story)
 *
 * Performance fixes applied here:
 * - Black fade overlay (300 ms out + 300 ms in) hides the WebGL cold-start lag
 *   between scenes instead of showing a hard white/black flash.
 * - audioEngine.stopAll() is called BEFORE the fade starts so audio from the
 *   dying scene doesn't bleed into the next one.
 * - The next scene is only mounted AFTER the fade-to-black completes, giving
 *   the browser a full 300 ms to GC the old WebGL context before creating a new one.
 * - A 100 ms yield (requestAnimationFrame) after mounting the next scene before
 *   fading back in prevents a single-frame black flash on fast machines.
 */

type SceneType = 'bigbang' | 'flareimpact' | 'takeoff' | 'brunospace' | 'complete';

const SCENE_ORDER: SceneType[] = ['bigbang', 'flareimpact', 'takeoff', 'brunospace', 'complete'];

// How long the cross-fade black overlay takes each way (ms)
const FADE_DURATION = 300;

interface ExpandedStoryboardSequenceProps {
  onComplete?: () => void;
}

export default function ExpandedStoryboardSequence({ onComplete }: ExpandedStoryboardSequenceProps) {
  const [currentScene, setCurrentScene] = useState<SceneType>('bigbang');
  // 0 = fully transparent (scene visible), 1 = fully opaque black (scene hidden)
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const sceneIndex = SCENE_ORDER.indexOf(currentScene);
  const progress = ((sceneIndex + 1) / SCENE_ORDER.length) * 100;

  const lastTransitionTime = useRef<number>(0);
  const pendingNextScene = useRef<SceneType | null>(null);

  const handleSceneComplete = useCallback(() => {
    const now = Date.now();
    // Debounce: ignore if already in transition or called twice within 500 ms
    if (isTransitioning || now - lastTransitionTime.current < 500) {
      console.warn('ExpandedStoryboardSequence: Ignored duplicate transition call');
      return;
    }
    lastTransitionTime.current = now;

    const nextIndex = sceneIndex + 1;
    const next = nextIndex < SCENE_ORDER.length ? SCENE_ORDER[nextIndex] : 'complete';
    pendingNextScene.current = next;

    // 1. Stop audio immediately so dying scene's sound doesn't bleed in
    audioEngine.stopAll();

    // 2. Fade to black
    setIsTransitioning(true);
    setFadeOpacity(1);
  }, [sceneIndex, isTransitioning]);

  // When fade-to-black completes, swap the scene, then fade back in
  useEffect(() => {
    if (!isTransitioning || fadeOpacity !== 1) return;

    // Wait for CSS transition to actually finish (FADE_DURATION ms)
    const swapTimer = setTimeout(() => {
      const next = pendingNextScene.current;
      if (next) {
        setCurrentScene(next);
        pendingNextScene.current = null;
      }

      // Give the browser one rAF to mount + paint the new scene before
      // fading back in — avoids a single-frame black flash on fast GPUs
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFadeOpacity(0);
          // Mark transition done after fade-in completes
          setTimeout(() => setIsTransitioning(false), FADE_DURATION);
        });
      });
    }, FADE_DURATION);

    return () => clearTimeout(swapTimer);
  }, [isTransitioning, fadeOpacity]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isTransitioning) return;
    const val = parseInt(e.target.value);
    if (val >= 0 && val < SCENE_ORDER.length - 1) {
      audioEngine.stopAll();
      setCurrentScene(SCENE_ORDER[val]);
    }
  };

  // Cleanup on full unmount
  useEffect(() => {
    return () => {
      audioEngine.stopAll();
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-black overflow-hidden select-none font-mono">
      {/* Scene Container */}
      <div className="absolute inset-0">
        {/* Scene 0: Big Bang Prologue */}
        {currentScene === 'bigbang' && (
          <BigBangPrologue onComplete={handleSceneComplete} />
        )}

        {/* Scene 1: Solar Flare Satellite Impact */}
        {currentScene === 'flareimpact' && (
          <SolarFlareSatelliteImpactScene onComplete={handleSceneComplete} />
        )}

        {/* Scene 2: Rocket Launch Takeoff */}
        {currentScene === 'takeoff' && (
          <SpaceshipTakeoffScene onTakeoffComplete={handleSceneComplete} />
        )}

        {/* Scene 3: Bruno Simon 3D Pilot Mode */}
        {currentScene === 'brunospace' && (
          <BrunoSpaceExperience
            onOpenDashboard={() => onComplete?.()}
            onRestartTakeoff={() => {
              audioEngine.stopAll();
              setCurrentScene('takeoff');
            }}
          />
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
                You have journeyed through the cosmos, witnessed the birth of the universe, and launched into deep
                space. Your mission continues...
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
          </div>
        )}
      </div>

      {/* ── Black fade overlay — sits above scenes, below HUD chrome ── */}
      <div
        className="absolute inset-0 bg-black pointer-events-none z-20"
        style={{
          opacity: fadeOpacity,
          transition: `opacity ${FADE_DURATION}ms ease-in-out`,
        }}
      />

      {/* Video Control Panel at the bottom */}
      {currentScene !== 'complete' && currentScene !== 'brunospace' && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30 font-mono text-xs bg-black/85 border border-electric-blue/40 px-6 py-3 rounded-full backdrop-blur flex items-center gap-6 shadow-[0_0_20px_rgba(0,217,255,0.25)] min-w-[500px]">
          <div className="text-electric-blue flex items-center justify-center">
            <span className="text-[10px] tracking-widest uppercase font-bold animate-pulse text-electric-blue mr-2">
              {isTransitioning ? 'LOADING' : 'STORYBOARD'}
            </span>
            <div className={`w-2 h-2 rounded-full bg-electric-blue ${isTransitioning ? 'animate-pulse' : 'animate-ping'}`} />
          </div>

          <div className="flex-1 flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">START</span>
            <input
              type="range"
              min={0}
              max={SCENE_ORDER.length - 2}
              value={sceneIndex}
              onChange={handleSliderChange}
              disabled={isTransitioning}
              className="flex-1 h-1 bg-deep-purple/30 rounded-lg appearance-none cursor-pointer accent-electric-blue focus:outline-none focus:ring-1 focus:ring-electric-blue/50 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(to right, #00d9ff 0%, #00d9ff ${((sceneIndex) / (SCENE_ORDER.length - 2)) * 100}%, rgba(42, 47, 74, 0.5) ${((sceneIndex) / (SCENE_ORDER.length - 2)) * 100}%, rgba(42, 47, 74, 0.5) 100%)`
              }}
            />
            <span className="text-[10px] text-muted-foreground">END</span>
          </div>

          <div className="text-right text-[10px] tracking-wider text-supernova-gold min-w-[120px]">
            {currentScene === 'bigbang' && 'PROLOGUE'}
            {currentScene === 'flareimpact' && 'FLARE STORY'}
            {currentScene === 'takeoff' && 'TAKEOFF'}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-deep-purple/30 z-30">
        <div
          className="h-full bg-gradient-to-r from-electric-blue to-supernova-gold transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}