import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { audioEngine } from '@/lib/audio-engine';
import { Rocket, Sparkles, Play, AlertTriangle } from 'lucide-react';

interface SpaceshipTakeoffSceneProps {
  onTakeoffComplete: () => void;
}

export default function SpaceshipTakeoffScene({ onTakeoffComplete }: SpaceshipTakeoffSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | string>('LAUNCH');
  const [launching, setLaunching] = useState<boolean>(false);
  const [launchProgress, setLaunchProgress] = useState<number>(0);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  const isAscendingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Three.js Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050814);
    scene.fog = new THREE.FogExp2(0x050814, 0.005);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 12);

    let renderer: THREE.WebGLRenderer | undefined;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false
      });
    } catch (e1) {
      try {
        renderer = new THREE.WebGLRenderer({ precision: 'mediump', alpha: true });
      } catch (e2) {
        console.warn("SpaceshipTakeoffScene: WebGL context creation failed:", e2);
        setTimeout(() => {
          onTakeoffComplete();
        }, 1500);
        return;
      }
    }

    if (!renderer) {
      setTimeout(() => {
        onTakeoffComplete();
      }, 1500);
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    // --- LIGHTING ---
    // Neutral white key light so the rocket's real hull/fin colors show,
    // with cyan kept strictly as a low-intensity rim/accent light.
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Neutral white key light — this is what reveals the model's real colors
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.6);
    keyLight.position.set(10, 20, 10);
    scene.add(keyLight);

    // Cyan rim light — subtle accent only, not the dominant color source
    const rimLight = new THREE.DirectionalLight(0x00d9ff, 0.35);
    rimLight.position.set(-8, 5, -10);
    scene.add(rimLight);

    const engineLight = new THREE.PointLight(0xffaa00, 0, 30);
    engineLight.position.set(0, -1, 0);
    scene.add(engineLight);

    // Launchpad platform grid
    const padGeo = new THREE.CylinderGeometry(8, 10, 1, 32);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f38,
      metalness: 0.8,
      roughness: 0.2,
      wireframe: false,
    });
    const launchpad = new THREE.Mesh(padGeo, padMat);
    launchpad.position.y = -2;
    scene.add(launchpad);
    const padTopY = -1.5; // top surface of the launchpad, where the rocket base should sit

    // Rocket Spaceship Group
    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(0, 0, 0);
    scene.add(rocketGroup);

    // Enable PBR tone mapping for cinematic rendering
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    // Generate procedural environment map for realistic reflections.
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x050814);
    const envL1 = new THREE.PointLight(0xffffff, 8, 50);
    envL1.position.set(10, 15, 10);
    envScene.add(envL1);
    const envL2 = new THREE.PointLight(0xffaa00, 4, 50);
    envL2.position.set(-10, -5, 5);
    envScene.add(envL2);
    const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture;
    pmremGenerator.dispose();

    // Placeholder while rocket model loads — tall/thin cylinder stand-in so
    // the pad doesn't sit empty, roughly matching where the rocket will end up.
    const placeholderGeo = new THREE.CylinderGeometry(0.6, 0.9, 8, 12);
    const placeholderMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.5 });
    const rocketPlaceholder = new THREE.Mesh(placeholderGeo, placeholderMat);
    rocketPlaceholder.position.y = padTopY + 4; // half of the 8-unit placeholder height, base on the pad
    rocketGroup.add(rocketPlaceholder);

    // Load the rocket model
    const MODEL_PATH = '/models/rocket.glb';
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      MODEL_PATH,
      (gltf) => {
        const rocketModel = gltf.scene;

        // --- SCALE + PLACEMENT ---
        // Unlike the old satellite model, this rocket doesn't have a single
        // outlier axis distorting its proportions — it's genuinely tall and
        // thin (fins/body ~6.7 wide, ~26.9 tall in its own units), which is
        // exactly what a rocket should look like. So scale directly off its
        // height rather than the median dimension trick used for the satellite.
        const box = new THREE.Box3().setFromObject(rocketModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const targetHeight = 9.0; // reads well against the pad (radius 8-10) and starting camera
        const scaleFactor = targetHeight / size.y;

        rocketModel.scale.setScalar(scaleFactor);

        // Center on X/Z, but anchor the BASE (not the geometric center) on
        // the launchpad surface — a rocket stands on its engines, it doesn't
        // float centered in space the way the satellite did.
        rocketModel.position.set(
          -center.x * scaleFactor,
          -box.min.y * scaleFactor + padTopY,
          -center.z * scaleFactor
        );

        // Enhance materials while preserving the model's real look
        rocketModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((mat) => {
                if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                  const stdMat = mat as THREE.MeshStandardMaterial;
                  // Light touch of reflection only — keeps the rocket's own
                  // hull/fin/rubber colors reading through clearly.
                  stdMat.envMap = envTexture;
                  stdMat.envMapIntensity = 0.25;
                  stdMat.needsUpdate = true;
                }
              });
            }
          }
        });

        rocketGroup.remove(rocketPlaceholder);
        rocketGroup.add(rocketModel);
        setModelLoadError(null);
        console.log('[SpaceshipTakeoffScene] Rocket GLB loaded. Scale:', scaleFactor.toFixed(3), 'height (Y):', size.y.toFixed(2));
      },
      undefined,
      (error) => {
        // Surface the failure on screen instead of only logging it — a 404 here
        // silently leaves the cyan placeholder on screen with no visible cue.
        console.error(`[SpaceshipTakeoffScene] Failed to load "${MODEL_PATH}". Make sure the file exists at "public${MODEL_PATH}" in your project root.`, error);
        setModelLoadError(`Could not load ${MODEL_PATH} — check that the file exists at public${MODEL_PATH}`);
      }
    );

    // Rocket Plume Particles (Fire & Smoke)
    const plumeCount = 600;
    const plumeGeo = new THREE.BufferGeometry();
    const plumePositions = new Float32Array(plumeCount * 3);
    const plumeColors = new Float32Array(plumeCount * 3);

    for (let i = 0; i < plumeCount * 3; i += 3) {
      plumePositions[i] = (Math.random() - 0.5) * 0.8;
      plumePositions[i + 1] = -Math.random() * 3;
      plumePositions[i + 2] = (Math.random() - 0.5) * 0.8;

      plumeColors[i] = 1.0;
      plumeColors[i + 1] = Math.random() * 0.6 + 0.2;
      plumeColors[i + 2] = 0.0;
    }

    plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePositions, 3));
    plumeGeo.setAttribute('color', new THREE.BufferAttribute(plumeColors, 3));

    const plumeMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });

    const plume = new THREE.Points(plumeGeo, plumeMat);
    rocketGroup.add(plume);

    // Space Stars background
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 200;
      starPos[i + 1] = Math.random() * 200;
      starPos[i + 2] = (Math.random() - 0.5) * 200;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, transparent: true, opacity: 0.7 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();
    let currentY = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (isAscendingRef.current) {
        currentY += delta * (currentY + 5) * 3;
        rocketGroup.position.y = currentY;

        // Camera chase upward
        camera.position.y = currentY * 0.6 + 3;
        camera.position.z = Math.max(4, 12 - currentY * 0.2);
        camera.lookAt(0, currentY + 3, 0);

        // Shake camera during high thrust
        if (currentY < 25) {
          camera.position.x = (Math.random() - 0.5) * 0.15;
        } else {
          camera.position.x = 0;
        }

        // Particle plume animation
        plumeMat.opacity = 1;
        engineLight.intensity = 5;
        const posAttr = plumeGeo.getAttribute('position') as THREE.BufferAttribute;
        const pos = posAttr.array as Float32Array;
        for (let i = 0; i < pos.length; i += 3) {
          pos[i + 1] -= delta * 15;
          if (pos[i + 1] < -10) {
            pos[i + 1] = 0;
            pos[i] = (Math.random() - 0.5) * 1.2;
            pos[i + 2] = (Math.random() - 0.5) * 1.2;
          }
        }
        posAttr.needsUpdate = true;

        // Progress check
        const progress = Math.min(100, Math.round((currentY / 50) * 100));
        setLaunchProgress(progress);

        if (currentY >= 50) {
          isAscendingRef.current = false;
          onTakeoffComplete();
        }
      } else {
        // Slow idle rocket hover before launch
        rocketGroup.rotation.y += delta * 0.3;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const handleIgnitionEvent = () => {
      isAscendingRef.current = true;
    };
    window.addEventListener('rocket-ignition', handleIgnitionEvent);

    // Clean up
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('rocket-ignition', handleIgnitionEvent);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onTakeoffComplete]);

  const handleStartLaunch = () => {
    if (launching) return;
    setLaunching(true);

    audioEngine.speak("Initiating ADITYA-L1 spacecraft takeoff sequence.");
    audioEngine.playAmbientHum(10);
    audioEngine.playWormholeWhoosh(2);
    audioEngine.playDeepBassRumble(8);

    setCountdown('LIFTOFF');
    isAscendingRef.current = true;
    window.dispatchEvent(new CustomEvent('rocket-ignition'));
  };

  return (
    <div className="relative w-full h-full bg-cosmic-black overflow-hidden font-mono">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Model load error banner — only shows if the GLB failed to fetch */}
      {modelLoadError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-red-950/90 border border-red-500/60 rounded-lg text-red-300 text-[11px] font-mono backdrop-blur">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{modelLoadError}</span>
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-20">

        {/* Header HUD */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-electric-blue/20 border border-electric-blue rounded-lg">
              <Rocket className="w-6 h-6 text-electric-blue animate-pulse" />
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground uppercase">MISSION LAUNCHPAD</div>
              <h1 className="text-lg font-bold text-white tracking-wider">ADITYA-L1 PROCEDURAL TAKEOFF</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            {launching && (
              <div className="px-4 py-2 bg-black/80 border border-electric-blue/50 rounded-lg text-right">
                <span className="text-[10px] text-muted-foreground block">ALTITUDE ASCENT</span>
                <span className="text-xl font-bold text-supernova-gold">{launchProgress}%</span>
              </div>
            )}
            <button
              onClick={onTakeoffComplete}
              className="px-4 py-2 bg-electric-blue/20 hover:bg-electric-blue border border-electric-blue text-electric-blue hover:text-black font-bold text-xs uppercase tracking-wider rounded-lg transition-all"
            >
              Skip to 3D Space Flight →
            </button>
          </div>
        </div>

        {/* Central Launch Countdown / Start Button */}
        <div className="self-center text-center pointer-events-auto">
          {!launching ? (
            <div className="space-y-4">
              <div className="text-xs text-electric-blue uppercase tracking-widest mb-2">
                SYSTEMS NOMINAL • FUEL PRESSURE 100%
              </div>
              <button
                onClick={handleStartLaunch}
                className="group relative px-8 py-4 bg-gradient-to-r from-electric-blue via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-bold text-base uppercase tracking-widest rounded-xl transition-all shadow-[0_0_40px_rgba(0,217,255,0.6)] hover:scale-105 flex items-center gap-3"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>INITIATE SATELLITE TAKEOFF</span>
                <Sparkles className="w-5 h-5 animate-spin" />
              </button>
            </div>
          ) : (
            <div className="animate-in zoom-in duration-300">
              <div
                className="text-6xl font-extrabold tracking-widest mb-2"
                style={{
                  color: '#00d9ff',
                  textShadow: '0 0 40px rgba(0, 217, 255, 0.9)',
                  fontFamily: "'Orbitron', sans-serif"
                }}
              >
                {countdown}
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Exiting atmosphere • Transitioning to Deep Space Flight Map
              </p>
            </div>
          )}
        </div>

        {/* Bottom Specs Footer */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-white/10 pt-4 bg-black/40 backdrop-blur px-4 py-2 rounded-lg">
          <div>VEHICLE: ADITYA-L1 EXPLORER</div>
          <div>THRUST: 4,500 kN</div>
          <div>DESTINATION: LAGRANGE POINT 1</div>
        </div>

      </div>
    </div>
  );
}