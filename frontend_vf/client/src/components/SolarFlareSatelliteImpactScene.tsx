import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { audioEngine } from '@/lib/audio-engine';
import { AlertTriangle, Radio, ShieldAlert } from 'lucide-react';

interface SolarFlareSatelliteImpactSceneProps {
  onComplete: () => void;
}

type StoryPhase = 'intro' | 'establish' | 'buildup' | 'wave' | 'impact' | 'aftermath';

// Story beats: each drives the caption, narration, and (for buildup/wave/
// impact) a visual state change in the Three.js scene below. Timings are in
// ms from scene mount and were tuned to leave room for audioEngine.speak()
// to actually finish each line before the next one starts.
const STORY_BEATS: { phase: StoryPhase; line: string; delay: number }[] = [
  { phase: 'intro', line: 'How do solar flares affect satellites?', delay: 500 },
  { phase: 'establish', line: 'Aditya-L1 monitors the Sun from a stable vantage point at Lagrange 1.', delay: 5500 },
  { phase: 'buildup', line: 'A magnetic instability builds in the solar corona.', delay: 11000 },
  { phase: 'wave', line: 'An X-class flare erupts, hurling energetic electrons and solar flare protons outward at near-light speed.', delay: 16000 },
  { phase: 'impact', line: 'Electrons degrade onboard electronics, while protons trigger radiation effects on communications.', delay: 22500 },
  { phase: 'aftermath', line: 'Shielding and redundant systems absorb the storm. Early detection is what keeps satellites safe.', delay: 28500 },
];

const TOTAL_DURATION = 34000; // ms before auto-advancing to the next scene

const SUN_POSITION = new THREE.Vector3(-45, 4, -20);
const SATELLITE_POSITION = new THREE.Vector3(12, 0, 22);
// Direction the flare wave travels, computed once — reused for the
// shockwave ring's orientation/translation and for both particle streams.
const PATH_DIR = SATELLITE_POSITION.clone().sub(SUN_POSITION).normalize();

export default function SolarFlareSatelliteImpactScene({ onComplete }: SolarFlareSatelliteImpactSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayedLine, setDisplayedLine] = useState('');
  const [phase, setPhase] = useState<StoryPhase>('intro');
  const [shieldLevel, setShieldLevel] = useState(100);
  const [signalIntegrity, setSignalIntegrity] = useState(100);
  const [showSkip, setShowSkip] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [sunLoadError, setSunLoadError] = useState<string | null>(null);

  // Mirrors `phase` into a ref so the render loop (which only runs its setup
  // effect once) can always read the latest phase without re-subscribing.
  const phaseRef = useRef<StoryPhase>('intro');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Drive captions, narration, sound cues, and shield/signal numbers off a
  // single timeline so everything stays in sync regardless of frame rate.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STORY_BEATS.forEach((beat) => {
      timers.push(
        setTimeout(() => {
          setPhase(beat.phase);
          setDisplayedLine(beat.line);
          audioEngine.speak(beat.line);
        }, beat.delay)
      );
    });

    audioEngine.playAmbientHum(TOTAL_DURATION / 1000);
    timers.push(setTimeout(() => audioEngine.playFlareCrackle(), 16200));
    timers.push(setTimeout(() => audioEngine.playCollisionImpact(), 22500));

    // Shield/signal take a few staggered hits right as the wave lands...
    timers.push(
      setTimeout(() => {
        let hits = 0;
        const degrade = setInterval(() => {
          hits++;
          setShieldLevel((v) => Math.max(35, v - 12));
          setSignalIntegrity((v) => Math.max(20, v - 18));
          if (hits >= 4) clearInterval(degrade);
        }, 350);
        timers.push(setTimeout(() => clearInterval(degrade), 2000));
      }, 22500)
    );
    // ...then partially recover during the aftermath beat, so the story
    // lands on "systems held" rather than "satellite destroyed".
    timers.push(
      setTimeout(() => {
        const recover = setInterval(() => {
          setShieldLevel((v) => Math.min(100, v + 6));
          setSignalIntegrity((v) => Math.min(100, v + 8));
        }, 400);
        timers.push(setTimeout(() => clearInterval(recover), 5000));
      }, 28500)
    );

    timers.push(setTimeout(() => setShowSkip(true), 1200));
    timers.push(setTimeout(() => onComplete(), TOTAL_DURATION));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03040c);
    scene.fog = new THREE.FogExp2(0x03040c, 0.004);

    // Pulled well back from both bodies for a wide, third-person
    // establishing shot — the sun and satellite read as small objects in
    // open space rather than filling the frame.
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(-8, 12, 65);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer | undefined;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      });
    } catch (e1) {
      try {
        renderer = new THREE.WebGLRenderer({ precision: 'mediump', alpha: true });
      } catch (e2) {
        console.warn('SolarFlareSatelliteImpactScene: WebGL context creation failed:', e2);
        setTimeout(() => onComplete(), 1500);
        return;
      }
    }
    if (!renderer) {
      setTimeout(() => onComplete(), 1500);
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // --- Lighting & backdrop ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sunLight = new THREE.PointLight(0xffaa33, 4, 300);
    sunLight.position.copy(SUN_POSITION);
    scene.add(sunLight);

    const starCount = 1500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 400;
      starPos[i + 1] = (Math.random() - 0.5) * 400;
      starPos[i + 2] = (Math.random() - 0.5) * 400;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, transparent: true, opacity: 0.7 })
      )
    );

    // --- Sun group ---
    const sunGroup = new THREE.Group();
    sunGroup.position.copy(SUN_POSITION);
    scene.add(sunGroup);

    const makeGlowSpriteTexture = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,244,210,0.95)');
      grad.addColorStop(0.25, 'rgba(255,190,90,0.55)');
      grad.addColorStop(0.55, 'rgba(255,120,40,0.2)');
      grad.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(canvas);
    };

    const buildFallbackSunCore = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, '#fff4c2');
      grad.addColorStop(0.35, '#ffd257');
      grad.addColorStop(0.7, '#ff9d2e');
      grad.addColorStop(1, '#ff6a00');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 1.5 + Math.random() * 5;
        const bright = Math.random() > 0.5;
        ctx.beginPath();
        ctx.fillStyle = bright
          ? `rgba(255,255,220,${0.05 + Math.random() * 0.12})`
          : `rgba(200,60,0,${0.06 + Math.random() * 0.14})`;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(14, 48, 48), mat);
      sunGroup.add(mesh);
    };

    const SUN_MODEL_PATH = '/models/sun.glb';
    const sunLoader = new GLTFLoader();
    sunLoader.load(
      SUN_MODEL_PATH,
      (gltf) => {
        const sunModel = gltf.scene;
        const box = new THREE.Box3().setFromObject(sunModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const targetDiameter = 28;
        const scaleFactor = targetDiameter / maxDim;
        sunModel.scale.setScalar(scaleFactor);

        const center = box.getCenter(new THREE.Vector3());
        sunModel.position.sub(center.multiplyScalar(scaleFactor));

        sunModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).castShadow = false;
            (child as THREE.Mesh).receiveShadow = false;
          }
        });

        sunGroup.add(sunModel);
        setSunLoadError(null);
      },
      undefined,
      (error) => {
        console.error(`[SolarFlareSatelliteImpactScene] Failed to load "${SUN_MODEL_PATH}".`, error);
        setSunLoadError(`Could not load ${SUN_MODEL_PATH} — check that the file exists at public${SUN_MODEL_PATH}`);
        buildFallbackSunCore();
      }
    );

    // Corona shell
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffcc55,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
    });
    const coronaMesh = new THREE.Mesh(new THREE.SphereGeometry(17, 32, 32), coronaMat);
    sunGroup.add(coronaMesh);

    // Glow halo
    const glowTexture = makeGlowSpriteTexture();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(42, 42, 1);
    sunGroup.add(glowSprite);

    // --- Satellite group ---
    const satelliteGroup = new THREE.Group();
    satelliteGroup.position.copy(SATELLITE_POSITION);
    scene.add(satelliteGroup);

    const satelliteFillLight = new THREE.PointLight(0xbfe8ff, 8, 60);
    satelliteFillLight.position.set(2, 2, 2);
    satelliteGroup.add(satelliteFillLight);

    const satelliteRimLight = new THREE.PointLight(0xffffff, 5, 50);
    satelliteRimLight.position.set(-3, -1, -3);
    satelliteGroup.add(satelliteRimLight);

    const cameraKeyLight = new THREE.PointLight(0xffffff, 6, 200);
    camera.add(cameraKeyLight);
    scene.add(camera);

    const placeholderMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0.6 });
    const placeholder = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), placeholderMat);
    satelliteGroup.add(placeholder);

    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      wireframe: true,
    });
    const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 24), shieldMat);
    satelliteGroup.add(shieldMesh);

    const MODEL_PATH = '/models/simple_satellite_low_poly_free.glb';
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      MODEL_PATH,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
        const referenceDim = dims[1];
        const scaleFactor = 5 / referenceDim;
        model.scale.setScalar(scaleFactor);

        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(scaleFactor));

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              const mat = m as THREE.MeshStandardMaterial;
              if ('emissive' in mat) {
                mat.emissive = new THREE.Color(0x1a2a33);
                mat.emissiveIntensity = 0.6;
              }
            });
          }
        });

        satelliteGroup.remove(placeholder);
        satelliteGroup.add(model);
        setModelLoadError(null);
      },
      undefined,
      (error) => {
        console.error(`[SolarFlareSatelliteImpactScene] Failed to load "${MODEL_PATH}".`, error);
        setModelLoadError(`Could not load ${MODEL_PATH} — check that the file exists at public${MODEL_PATH}`);
      }
    );

    // --- Radiation wave ---
    const waveGeo = new THREE.TorusGeometry(2.2, 0.2, 10, 40);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0xff6a3d,
      transparent: true,
      opacity: 0,
      wireframe: true,
      blending: THREE.AdditiveBlending,
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), PATH_DIR);
    waveMesh.position.copy(SUN_POSITION);
    scene.add(waveMesh);

    // --- Particle Streams ---
    const buildParticleStream = (count: number, color: number, size: number) => {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);

      const stagger = new Float32Array(count);
      const perp = new Float32Array(count * 3);
      const arbitrary = Math.abs(PATH_DIR.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const perpAxis = new THREE.Vector3().crossVectors(PATH_DIR, arbitrary).normalize();
      for (let i = 0; i < count; i++) {
        stagger[i] = (Math.random() - 0.5) * 0.35;
        const spread = (Math.random() - 0.5) * 3.5;
        const off = perpAxis.clone().multiplyScalar(spread);
        perp[i * 3] = off.x;
        perp[i * 3 + 1] = off.y + (Math.random() - 0.5) * 2;
        perp[i * 3 + 2] = off.z;
      }

      return { points, geo, mat, stagger, perp, count };
    };

    const electronStream = buildParticleStream(70, 0x00d9ff, 0.5);
    const protonStream = buildParticleStream(45, 0xff8a3d, 0.7);

    const updateParticleStream = (
      stream: ReturnType<typeof buildParticleStream>,
      progress: number,
      targetOpacity: number
    ) => {
      const posAttr = stream.geo.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < stream.count; i++) {
        const t = Math.min(1, Math.max(0, progress + stream.stagger[i]));
        const bulge = Math.sin(t * Math.PI);
        arr[i * 3] = SUN_POSITION.x + (SATELLITE_POSITION.x - SUN_POSITION.x) * t + stream.perp[i * 3] * bulge;
        arr[i * 3 + 1] = SUN_POSITION.y + (SATELLITE_POSITION.y - SUN_POSITION.y) * t + stream.perp[i * 3 + 1] * bulge;
        arr[i * 3 + 2] = SUN_POSITION.z + (SATELLITE_POSITION.z - SUN_POSITION.z) * t + stream.perp[i * 3 + 2] * bulge;
      }
      posAttr.needsUpdate = true;
      stream.mat.opacity += (targetOpacity - stream.mat.opacity) * 0.15;
    };

    const distToSatellite = SUN_POSITION.distanceTo(SATELLITE_POSITION);
    const WAVE_SPEED = 14;
    let waveActive = false;
    let waveProgress = 0;
    let impactTriggered = false;
    let impactFlashLife = 0;

    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const currentPhase = phaseRef.current;

      const targetCoronaOpacity = currentPhase === 'buildup' || currentPhase === 'wave' ? 0.32 : 0.14;
      coronaMat.opacity += (targetCoronaOpacity - coronaMat.opacity) * 0.02;
      const targetGlowScale = currentPhase === 'buildup' ? 52 : currentPhase === 'wave' ? 58 : 42;
      const newGlowScale = glowSprite.scale.x + (targetGlowScale - glowSprite.scale.x) * 0.02;
      glowSprite.scale.set(newGlowScale, newGlowScale, 1);
      const targetLightIntensity = currentPhase === 'buildup' ? 7 : currentPhase === 'wave' ? 6 : 4;
      sunLight.intensity += (targetLightIntensity - sunLight.intensity) * 0.02;

      if (currentPhase === 'wave' && !waveActive && !impactTriggered) {
        waveActive = true;
        waveProgress = 0;
        waveMat.opacity = 0.85;
      }
      if (waveActive && !impactTriggered) {
        waveProgress += (delta * WAVE_SPEED) / distToSatellite;
        const clamped = Math.min(1, waveProgress);
        waveMesh.position.copy(SUN_POSITION).addScaledVector(PATH_DIR, clamped * distToSatellite);
        const ringScale = 1 + clamped * 0.6;
        waveMesh.scale.setScalar(ringScale);
        waveMat.opacity = Math.max(0, 0.85 - clamped * 0.3);
        updateParticleStream(electronStream, clamped, 0.9);
        updateParticleStream(protonStream, clamped, 0.85);
        if (waveProgress >= 1) {
          impactTriggered = true;
          impactFlashLife = 1;
          waveActive = false;
          waveMat.opacity = 0;
        }
      } else if (impactTriggered) {
        updateParticleStream(electronStream, 1, 0);
        updateParticleStream(protonStream, 1, 0);
      }

      if (impactFlashLife > 0) {
        impactFlashLife -= delta * 0.6;
        const life = Math.max(0, impactFlashLife);
        shieldMat.opacity = life * 0.9;
        shieldMesh.scale.setScalar(1 + (1 - life) * 0.6);
        camera.position.x += (Math.random() - 0.5) * 0.3 * life;
        camera.position.y += (Math.random() - 0.5) * 0.3 * life;
      }

      sunGroup.rotation.y += delta * 0.04;
      satelliteGroup.rotation.y += delta * 0.15;

      const t = clock.elapsedTime;
      camera.position.x = -8 + Math.sin(t * 0.03) * 6;
      camera.position.y = 12 + Math.sin(t * 0.05) * 2;
      camera.lookAt(SATELLITE_POSITION.clone().lerp(SUN_POSITION, 0.5));

      renderer!.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer!.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      electronStream.geo.dispose();
      electronStream.mat.dispose();
      protonStream.geo.dispose();
      protonStream.mat.dispose();
      waveGeo.dispose();
      waveMat.dispose();
      renderer!.dispose();
      if (container.contains(renderer!.domElement)) {
        container.removeChild(renderer!.domElement);
      }
    };
  }, [onComplete]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-mono select-none">
      <div ref={containerRef} className="w-full h-full" />

      {sunLoadError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-red-950/90 border border-red-500/60 rounded-lg text-red-300 text-[11px] font-mono backdrop-blur">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{sunLoadError}</span>
        </div>
      )}
      {modelLoadError && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-red-950/90 border border-red-500/60 rounded-lg text-red-300 text-[11px] font-mono backdrop-blur">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{modelLoadError}</span>
        </div>
      )}

      {/* FIXED: Top right status block flex column with explicit gap and line-heights to prevent overlap */}
      <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-1 px-3 py-2 bg-black/60 border border-white/10 rounded-lg backdrop-blur">
        <span className="text-xs font-bold tracking-wider leading-none" style={{ color: '#E8C468' }}>
          SOLAR FLARE IMPACT
        </span>
        <span className="text-[10px] text-muted-foreground/80 tracking-widest leading-none">
          {phase.toUpperCase()}
        </span>
      </div>

      {/* Pathway legend */}
      {(phase === 'wave' || phase === 'impact' || phase === 'aftermath') && (
        <div className="absolute bottom-40 left-8 z-30 bg-black/80 border border-white/10 p-3 rounded-lg backdrop-blur text-[10px] space-y-2 max-w-[240px]">
          <div className="text-muted-foreground uppercase tracking-wider font-bold mb-1">Impact Pathway</div>
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: '#00d9ff' }} />
            <span className="text-gray-300">
              <span className="text-white font-bold">Energetic Electrons</span> — damage to spacecraft electronics
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: '#ff8a3d' }} />
            <span className="text-gray-300">
              <span className="text-white font-bold">Solar Flare Protons</span> — radiation effects on comms &amp; avionics
            </span>
          </div>
        </div>
      )}

      {/* Shield / signal HUD */}
      {(phase === 'impact' || phase === 'aftermath') && (
        <div className="absolute top-8 left-8 z-30 flex items-center gap-4 bg-black/80 border border-electric-blue/40 p-3 rounded-xl backdrop-blur">
          <div className="flex items-center gap-2">
            <ShieldAlert className={`w-4 h-4 ${shieldLevel > 50 ? 'text-emerald-400' : 'text-red-500'}`} />
            <div>
              <div className="text-[9px] text-muted-foreground uppercase">Shield</div>
              <div className="text-sm font-bold text-white">{shieldLevel}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${signalIntegrity > 50 ? 'text-emerald-400' : 'text-red-500'}`} />
            <div>
              <div className="text-[9px] text-muted-foreground uppercase">Signal</div>
              <div className="text-sm font-bold text-white">{signalIntegrity}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Title / Intro Overlay */}
      {phase === 'intro' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-1000 px-6 text-center">
          <h1
            className="text-3xl md:text-5xl font-bold tracking-wider uppercase animate-pulse"
            style={{
              color: '#E8C468',
              textShadow: '0 0 30px rgba(232, 196, 104, 0.5)',
              fontFamily: "'Fraunces', serif",
            }}
          >
            How do solar flares affect satellites?
          </h1>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none px-8 pb-24">
          <p
            className="text-lg md:text-xl text-center max-w-2xl tracking-wide"
            style={{
              color: '#E8F4FF',
              textShadow: '0 0 24px rgba(0,217,255,0.35)',
              fontFamily: "'Fraunces', serif",
              fontWeight: 500,
            }}
          >
            {displayedLine}
          </p>
        </div>
      )}

      {showSkip && (
        <button
          onClick={onComplete}
          className="absolute bottom-8 right-8 z-30 px-4 py-2 text-[11px] uppercase tracking-wider font-bold text-muted-foreground hover:text-white border border-white/10 hover:border-[#E8C468]/40 rounded-lg transition-all"
        >
          Skip →
        </button>
      )}
    </div>
  );
}