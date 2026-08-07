import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { audioEngine } from '@/lib/audio-engine';

interface PrologueSceneProps {
  onComplete: () => void;
}

const BIG_BANG_VIDEO_MP4 = '/videos/big-bang.mp4';
const BIG_BANG_VIDEO_WEBM = '/videos/big-bang.webm';
const SUN_MODEL_PATH = '/models/sun.glb';

const VIDEO_FALLBACK_HOLD_MS = 6000;
const VIDEO_FADE_MS = 600;
const CHAR_TYPE_MS = 20;
const NARRATION_MS = 9500;

const PROLOGUE_LINES = [
  'From the birth of the universe, intelligence emerges.',
  'Billions of galaxies and trillions of stars coalesced from cosmic dust, giving rise to one uniquely remarkable star:',
  'The Sun.',
];

export default function PrologueScene({ onComplete }: PrologueSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [showSkip, setShowSkip] = useState(true);
  const [videoFading, setVideoFading] = useState(false);
  const [videoVisible, setVideoVisible] = useState(true);

  // Store active line index in ref for Three.js render loop access
  const lineIndexRef = useRef(0);
  useEffect(() => {
    lineIndexRef.current = lineIndex;
  }, [lineIndex]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Sequential Neon Typewriter Effect
  useEffect(() => {
    let charIndex = 0;
    const currentLine = PROLOGUE_LINES[lineIndex];
    setDisplayedText('');

    const typeInterval = setInterval(() => {
      charIndex++;
      setDisplayedText(currentLine.slice(0, charIndex));

      if (charIndex >= currentLine.length) {
        clearInterval(typeInterval);

        if (lineIndex < PROLOGUE_LINES.length - 1) {
          setTimeout(() => {
            setLineIndex((prev) => prev + 1);
          }, 800);
        }
      }
    }, CHAR_TYPE_MS);

    return () => clearInterval(typeInterval);
  }, [lineIndex]);

  // Audio & Voice Narration
  useEffect(() => {
    audioEngine.playDeepBassRumble?.(4);
    audioEngine.playAmbientHum?.(5);

    const fullNarration = PROLOGUE_LINES.join(' ');
    const speakTimer = setTimeout(() => {
      audioEngine.speak?.(fullNarration);
    }, 200);

    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, NARRATION_MS);

    return () => {
      clearTimeout(speakTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  // Video Autoplay & Crossfade
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let fallbackTimer: NodeJS.Timeout | null = null;
    let fadeTimer: NodeJS.Timeout | null = null;

    const startCrossfade = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setVideoFading(true);
      fadeTimer = setTimeout(() => {
        setVideoVisible(false);
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }, VIDEO_FADE_MS);
    };

    const handleEnded = () => startCrossfade();

    const handleLoadedMetadata = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (isFinite(video.duration) && video.duration > 0) {
        fallbackTimer = setTimeout(startCrossfade, video.duration * 1000 + 300);
      }
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    video.play().catch(() => {
      setVideoFading(true);
      setVideoVisible(false);
    });

    fallbackTimer = setTimeout(startCrossfade, VIDEO_FALLBACK_HOLD_MS);

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, []);

  // Background Starfield & Sun GLB Loader
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030308);

    const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(0, 0, 120); // Start far away for zoom transition

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffaa00, 4, 150);
    pointLight.position.set(0, 0, 15);
    scene.add(pointLight);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      });
    } catch {
      onCompleteRef.current();
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    container.appendChild(renderer.domElement);

    // Background Starfield
    const bgCount = 500;
    const bgGeo = new THREE.BufferGeometry();
    const bgPos = new Float32Array(bgCount * 3);
    for (let i = 0; i < bgCount * 3; i += 3) {
      bgPos[i] = (Math.random() - 0.5) * 300;
      bgPos[i + 1] = (Math.random() - 0.5) * 300;
      bgPos[i + 2] = (Math.random() - 0.5) * 300;
    }
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    const bgMat = new THREE.PointsMaterial({ color: 0x00f3ff, size: 0.2, transparent: true, opacity: 0.5 });
    const bgField = new THREE.Points(bgGeo, bgMat);
    scene.add(bgField);

    // Procedural Fallback Sun Sphere (ensures zero lag if GLB loading stalls)
    const fallbackSunGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const fallbackSunMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const fallbackSun = new THREE.Mesh(fallbackSunGeo, fallbackSunMat);
    fallbackSun.visible = false;
    scene.add(fallbackSun);

    // Load Sun GLB Model
    let sunMesh: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    const loader = new GLTFLoader();

    loader.load(
      SUN_MODEL_PATH,
      (gltf) => {
        sunMesh = gltf.scene;
        sunMesh.scale.set(0.001, 0.001, 0.001); // Initial scale setup
        sunMesh.position.set(0, 0, 0);
        sunMesh.visible = false; // Stay hidden until text trigger

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(sunMesh);
          gltf.animations.forEach((clip) => {
            mixer?.clipAction(clip).play();
          });
        }

        scene.remove(fallbackSun);
        scene.add(sunMesh);
      },
      undefined,
      (error) => {
        console.warn('Error loading Sun GLB model, using procedural sun fallback:', error);
        sunMesh = fallbackSun;
      }
    );

    let animId: number;
    const clock = new THREE.Clock();
    let zoomTime = 0;
    let targetCameraZ = 120;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (mixer) mixer.update(delta);

      const activeSun = sunMesh || fallbackSun;

      if (activeSun) {
        activeSun.rotation.y += delta * 0.25;

        // Trigger transition when line 3 ("The Sun.") appears
        if (lineIndexRef.current === 2) {
          activeSun.visible = true;
          zoomTime += delta;

          // Smooth scale up effect
          activeSun.scale.lerp(new THREE.Vector3(8, 8, 8), 0.04);

          // Camera zoom-in then smooth zoom-out sequence
          if (zoomTime < 2.5) {
            targetCameraZ = 22; // Rapid dramatic zoom-in
          } else {
            targetCameraZ = 35; // Gentle zoom-out back to holding frame
          }
        }
      }

      // Camera Position Interpolation (Zoom transition effect)
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraZ, 0.03);
      camera.position.x = Math.sin(elapsed * 0.05) * 3;
      camera.position.y = Math.cos(elapsed * 0.04) * 2;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      bgGeo.dispose();
      bgMat.dispose();
      fallbackSunGeo.dispose();
      fallbackSunMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-mono">
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-0" />

      {videoVisible && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          style={{
            opacity: videoFading ? 0 : 1,
            transition: `opacity ${VIDEO_FADE_MS}ms ease-in-out`,
          }}
          autoPlay
          muted
          playsInline
          preload="auto"
        >
          <source src={BIG_BANG_VIDEO_WEBM} type="video/webm" />
          <source src={BIG_BANG_VIDEO_MP4} type="video/mp4" />
        </video>
      )}

      <div className="absolute inset-0 bg-black/40 pointer-events-none z-20" />

      {/*
        Note: the "SCENE N OF 5 / <name>" corner indicator that used to
        live here (top-6 right-6, hardcoded to "SCENE 3 OF 5 /
        SPACESHIP TAKEOFF") has been removed. It was a leftover/copy-paste
        label — wrong scene number and wrong name for the Prologue — and
        it rendered on top of the correct, dynamic scene indicator that
        the parent StoryboardSequence already provides in that same
        corner, which is what caused the overlapping "SCENE 3 OF 5" /
        "SCENE 1 OF 5" text in the top right. Don't re-add a scene
        indicator here; if this scene ever needs one, it should come from
        the parent so there's a single source of truth for scene number
        and name.
      */}

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-8 z-30">
        <div className="text-center max-w-4xl tracking-wide leading-relaxed min-h-[120px] flex items-center justify-center">
          <p
            className={lineIndex === 2 ? 'text-4xl md:text-6xl font-black' : 'text-2xl md:text-4xl font-bold'}
            style={{
              color: lineIndex === 2 ? '#E8C468' : '#00F3FF',
              textShadow:
                lineIndex === 2
                  ? '0 0 15px #E8C468, 0 0 30px #E8C468, 0 0 60px #FF9D00'
                  : '0 0 10px #00F3FF, 0 0 20px #00F3FF, 0 0 40px #00A3FF, 0 0 80px #00A3FF',
              fontFamily: lineIndex === 2 ? "'Fraunces', serif" : "'JetBrains Mono', 'Courier New', monospace",
              letterSpacing: '0.05em',
              transition: 'color 0.5s ease',
            }}
          >
            {displayedText}
            <span className="animate-pulse" style={{ color: lineIndex === 2 ? '#E8C468' : '#00F3FF' }}>
              |
            </span>
          </p>
        </div>
      </div>

      {showSkip && (
        <button
          onClick={onComplete}
          className="absolute bottom-8 right-8 z-40 px-4 py-2 text-[11px] uppercase tracking-wider font-bold text-[#00F3FF] hover:text-white border border-[#00F3FF]/40 hover:border-[#00F3FF] rounded-lg transition-all shadow-[0_0_10px_rgba(0,243,255,0.3)] hover:shadow-[0_0_20px_rgba(0,243,255,0.7)] cursor-pointer bg-black/50 backdrop-blur-sm"
        >
          Skip Prologue →
        </button>
      )}
    </div>
  );
}