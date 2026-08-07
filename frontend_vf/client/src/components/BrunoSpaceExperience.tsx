import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { audioEngine } from '@/lib/audio-engine';
import PlanetInfoModal, { PlanetData } from './PlanetInfoModal';
import SolarFlareSignalHUD from './SolarFlareSignalHUD';
import {
  Compass,
  Flame,
  Radio,
  ShieldAlert,
  Sparkles,
  Crosshair,
  Activity,
  Maximize2,
  HelpCircle,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';

interface BrunoSpaceExperienceProps {
  onOpenDashboard: () => void;
  onRestartTakeoff?: () => void;
}

// Project Planet Dataset for Exploration
const PLANET_DATASETS: Record<string, PlanetData> = {
  sun: {
    id: 'sun',
    name: 'Solexs Solar Corona (Sun)',
    category: 'Stellar Source',
    color: '#f59e0b',
    description: 'The primary power source and coronal mass ejection epicenter. Aditya-L1 monitors soft X-ray fluxes and magnetic field line reconnections.',
    stats: [
      { label: 'Surface Temp', value: '5,778 K' },
      { label: 'Corona Temp', value: '1.5M - 3M K' },
      { label: 'Observation Point', value: 'Halo Orbit L1' },
      { label: 'X-ray Channel', value: '2 - 22 keV' }
    ],
    features: [
      'Real-time Coronal Mass Ejection (CME) tracking',
      'Solar flare class prediction models (B, C, M, X class)',
      'High-velocity solar wind particle stream simulation'
    ]
  },
  velc: {
    id: 'velc',
    name: 'VELC Coronagraph Station',
    category: 'Payload Instrument',
    color: '#00d9ff',
    description: 'Visible Emission Line Coronagraph. Captures high-resolution green and red coronal emission spectra simultaneously with internal occulting disks.',
    stats: [
      { label: 'FOV Range', value: '1.05 - 3.0 R☉' },
      { label: 'Spectral Lines', value: '5303Å & 6374Å' },
      { label: 'Cadence', value: '1 frame / minute' },
      { label: 'Processed Datasets', value: '100 Sessions' }
    ],
    features: [
      'Extracted 74 coronal features per frame',
      'Internal occulting disk scatter reduction',
      'Direct coronal temperature gradient mapping'
    ]
  },
  solexs: {
    id: 'solexs',
    name: 'SOLEXS X-Ray Spectrometer',
    category: 'Payload Instrument',
    color: '#ec4899',
    description: 'Solar Low Energy X-ray Spectrometer. Delivers full-disk soft X-ray spectroscopy to detect precursor heating prior to solar flare eruptions.',
    stats: [
      { label: 'Energy Band', value: '2 - 22 keV' },
      { label: 'Spectral Res', value: '< 250 eV @ 5.9 keV' },
      { label: 'Measurements', value: '51.8M Data Points' },
      { label: 'Observation Days', value: '600+ Days' }
    ],
    features: [
      'Precursor flare micro-burst detection',
      'High cadence X-ray light curve telemetry',
      'Automated peak flux energy classification'
    ]
  },
  helios: {
    id: 'helios',
    name: 'HEL1OS High-Energy Payload',
    category: 'Payload Instrument',
    color: '#7c3aed',
    description: 'High Energy L1 Orbiting X-ray Spectrometer. Measures hard X-ray emissions from non-thermal solar flare electron accelerations.',
    stats: [
      { label: 'Energy Band', value: '8 - 150 keV' },
      { label: 'Light Curves', value: '92 Analyzed Curves' },
      { label: 'Telemetry', value: '2.76M Measurements' },
      { label: 'Time Res', value: '100 ms' }
    ],
    features: [
      'Non-thermal flare particle acceleration tracing',
      'Cross-correlation engine with SOLEXS & VELC data',
      'Deep learning flare energy forecast feeds'
    ]
  },
  blackhole: {
    id: 'blackhole',
    name: 'Cygnus X-1 Deep Space Anomaly',
    category: 'Gravitational Anomaly',
    color: '#3b82f6',
    description: 'A stellar-mass black hole accretion system used as a calibration target for space-time gravitational lensing and high-energy ray instruments.',
    stats: [
      { label: 'Mass', value: '21.2 M☉' },
      { label: 'Event Horizon', value: '60 km Radius' },
      { label: 'Spin Parameter', value: 'a* > 0.95' },
      { label: 'Distance', value: '7,200 ly' }
    ],
    features: [
      'Gravitational red-shift & light warping shaders',
      'Relativistic jet plasma emission model',
      'Deep space time dilation telemetry testing'
    ]
  }
};

// Which real body from solar_system_animation.glb stands in for each
// interactive entry above. Node names come from the GLB itself (see comments
// near the loader below). Saturn stands in for the "black hole" because its
// ring reads like an accretion disk.
const NODE_NAME_BY_PLANET_ID: Record<'sun' | 'velc' | 'solexs' | 'helios' | 'blackhole', string> = {
  sun: 'Object_56',       // Sun
  velc: 'Object_5',       // Mercury
  solexs: 'Object_11',    // Earth
  helios: 'Object_17',    // Jupiter
  blackhole: 'Object_20', // Saturn
};

// Fixed interaction radii (roughly matches the feel of the old procedural
// planet sizes * 4.5 proximity multiplier) since the GLB bodies aren't
// uniformly sized the way the old spheres were. Scaled up alongside
// ORBIT_SPREAD_FACTOR below so the "press to inspect" prompts still trigger
// at sensible distances now that the planets sit further apart.
const INTERACTION_RADIUS: Record<'velc' | 'solexs' | 'helios' | 'blackhole', number> = {
  velc: 9.9 * 1.8,
  solexs: 13.5 * 1.8,
  helios: 11.25 * 1.8,
  blackhole: 15.75 * 1.8,
};
const SUN_PROXIMITY_RADIUS = 16 * 1.8;

// Brings the model's own ~10-54 unit orbit radii in line with the old
// 25-90 unit play space the ship/meteoroid field were tuned for.
const SOLAR_SYSTEM_SCALE = 2.6;

// Pushes each planet node further out from the sun every frame, AFTER the
// GLB's own baked animation has set its position for that frame. The model's
// planets were bunched close together relative to their visual size, so
// scaling the whole GLB up (SOLAR_SYSTEM_SCALE) doesn't fix that — it grows
// planets and gaps together. This multiplies only the per-planet position
// vector (which is relative to the sun/origin), spreading them apart without
// changing how big any individual body looks.
const ORBIT_SPREAD_FACTOR = 3.5;

// Holding position used only for the brief window before the solar system
// GLB (and therefore the Sun's real position) has loaded. Comfortably
// outside the proximity radius above so nothing falsely triggers, and much
// closer/lower than before so there's no visible "parked way up high" flash
// before the ship snaps to its real spawn point next to the Sun.
const SHIP_HOLDING_POSITION = new THREE.Vector3(0, 2, 60);

type InteractiveBodies = {
  mode: 'loading' | 'glb' | 'fallback';
  sun: THREE.Object3D | null;
  velc: THREE.Object3D | null;
  solexs: THREE.Object3D | null;
  helios: THREE.Object3D | null;
  blackhole: THREE.Object3D | null;
};

type FallbackPlanetState = { mesh: THREE.Mesh; distance: number; angle: number; speed: number };

type MeteoroidState = { mesh: THREE.Mesh; radius: number; rotSpeed: THREE.Vector3 };

export default function BrunoSpaceExperience({ onOpenDashboard, onRestartTakeoff }: BrunoSpaceExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);
  const [solarSignalActive, setSolarSignalActive] = useState<boolean>(false);
  const [shipSpeed, setShipSpeed] = useState<number>(0);
  const [scoreHits, setScoreHits] = useState<number>(0);
  const [shieldLevel, setShieldLevel] = useState<number>(100);
  const [nearbyTarget, setNearbyTarget] = useState<string | null>(null);
  const [webglFailed, setWebglFailed] = useState<boolean>(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [solarSystemLoadError, setSolarSystemLoadError] = useState<string | null>(null);
  const [asteroidFieldLoadError, setAsteroidFieldLoadError] = useState<string | null>(null);

  // Key controls state
  const keysRef = useRef<Record<string, boolean>>({});

  // Physics & Three.js references
  const shipPosRef = useRef<THREE.Vector3>(SHIP_HOLDING_POSITION.clone());
  const shipRotRef = useRef<THREE.Euler>(new THREE.Euler(0, 0, 0));
  const shipVelRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Flips true the first time the ship gets repositioned to its real
  // Sun-relative spawn point. Until then it sits at SHIP_HOLDING_POSITION.
  const hasPositionedShipRef = useRef<boolean>(false);

  // Which Object3D (from the loaded GLB, or a fallback proxy) represents each
  // interactive body right now, so the existing proximity/HUD logic can just
  // ask these for their live world position every frame.
  const interactiveBodiesRef = useRef<InteractiveBodies>({
    mode: 'loading',
    sun: null,
    velc: null,
    solexs: null,
    helios: null,
    blackhole: null,
  });
  const fallbackStateRef = useRef<Record<string, FallbackPlanetState> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040612);
    scene.fog = new THREE.FogExp2(0x040612, 0.003);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    // Starts out near the holding position, not near the sun — snapped to
    // the real spawn point the first frame the Sun's position is known (see
    // the repositioning block inside animate()).
    camera.position.copy(SHIP_HOLDING_POSITION).add(new THREE.Vector3(0, 4, 10));

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
        renderer = new THREE.WebGLRenderer({
          precision: 'mediump',
          alpha: true
        });
      } catch (e2) {
        console.warn("BrunoSpaceExperience: WebGL context creation failed on all options:", e2);
        setWebglFailed(true);
        return;
      }
    }

    if (!renderer) {
      setWebglFailed(true);
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const sunPointLight = new THREE.PointLight(0xf59e0b, 3, 500);
    sunPointLight.position.set(0, 0, 0);
    scene.add(sunPointLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(20, 40, 20);
    scene.add(directionalLight);

    // 3. Meteoroid / Asteroid Field (Bruno Simon Collision Targets)
    // Rocks are loaded from wandering_asteroids_of_andromeda.glb below.
    // Kept as individual THREE.Mesh instances (not InstancedMesh) because
    // the collision logic further down mutates each rock's own
    // `.position` directly on impact — instancing would make that
    // per-object physics awkward.
    const meteoroidCount = 45;
    const meteoroids: MeteoroidState[] = [];

    const scatterMeteoroid = (mesh: THREE.Mesh, boundingRadius: number) => {
      const dist = Math.random() * 55 + 30;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 15;
      mesh.position.set(Math.cos(angle) * dist, height, Math.sin(angle) * dist);
      scene.add(mesh);
      meteoroids.push({
        mesh,
        radius: boundingRadius,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.03,
          (Math.random() - 0.5) * 0.03,
          (Math.random() - 0.5) * 0.03
        ),
      });
    };

    // Original procedural rocks — now only used as a fallback if the GLB
    // fails to load, same defensive pattern as the satellite/solar system
    // loaders below.
    const buildProceduralMeteoroidFallback = () => {
      for (let i = 0; i < meteoroidCount; i++) {
        const radius = Math.random() * 1.2 + 0.6;
        const mGeo = new THREE.DodecahedronGeometry(radius, 1);
        const mMat = new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.9,
          metalness: 0.2,
        });
        scatterMeteoroid(new THREE.Mesh(mGeo, mMat), radius);
      }
    };

    const ASTEROID_MODEL_PATH = '/models/wandering_asteroids_of_andromeda.glb';
    const asteroidLoader = new GLTFLoader();
    asteroidLoader.load(
      ASTEROID_MODEL_PATH,
      (gltf) => {
        const sourceMeshes: THREE.Mesh[] = [];
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) sourceMeshes.push(child as THREE.Mesh);
        });

        if (sourceMeshes.length === 0) {
          console.error(`[BrunoSpaceExperience] No meshes found in ${ASTEROID_MODEL_PATH}, using procedural fallback.`);
          buildProceduralMeteoroidFallback();
          return;
        }

        // Normalize each of the 3 source rocks off its own median box
        // dimension — same fix pattern as the satellite model's scale fix
        // above — so all rock types read at a comparable base size before
        // per-instance jitter is applied. Geometry + material are shared
        // (cloned once per source mesh, not per asteroid) since plain
        // THREE.Mesh instances can safely reference the same geometry.
        const targetSize = 1.4;
        const normalized = sourceMeshes.map((sourceMesh) => {
          const box = new THREE.Box3().setFromObject(sourceMesh);
          const size = box.getSize(new THREE.Vector3());
          const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
          const medianDim = dims[1] || 1;
          const scaleFactor = targetSize / medianDim;
          const center = box.getCenter(new THREE.Vector3());

          const geometry = sourceMesh.geometry.clone();
          geometry.translate(-center.x, -center.y, -center.z);
          geometry.computeBoundingSphere();

          const material = Array.isArray(sourceMesh.material)
            ? sourceMesh.material[0].clone()
            : sourceMesh.material.clone();

          return {
            geometry,
            material,
            scaleFactor,
            boundingRadiusAtTargetSize: (geometry.boundingSphere?.radius ?? 1) * scaleFactor,
          };
        });

        for (let i = 0; i < meteoroidCount; i++) {
          const src = normalized[i % normalized.length];
          const jitter = 0.6 + Math.random() * 0.9; // per-rock size variance
          const scale = src.scaleFactor * jitter;

          const mesh = new THREE.Mesh(src.geometry, src.material);
          mesh.scale.setScalar(scale);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          scatterMeteoroid(mesh, src.boundingRadiusAtTargetSize * jitter);
        }

        console.log(`[BrunoSpaceExperience] Asteroid field loaded from GLB: ${meteoroids.length} rocks across ${sourceMeshes.length} rock types.`);
      },
      undefined,
      (error) => {
        console.error(
          `[BrunoSpaceExperience] Failed to load "${ASTEROID_MODEL_PATH}" — falling back to procedural asteroids. Make sure the file exists at "public${ASTEROID_MODEL_PATH}".`,
          error
        );
        setAsteroidFieldLoadError(`Could not load ${ASTEROID_MODEL_PATH} — check that the file exists at public${ASTEROID_MODEL_PATH}`);
        buildProceduralMeteoroidFallback();
      }
    );

    // 4. Player Spaceship — Load realistic satellite.glb model
    const shipGroup = new THREE.Group();
    scene.add(shipGroup);

    // Placeholder glow while model loads
    const placeholderGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const placeholderMat = new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0.6,
    });
    const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
    shipGroup.add(placeholder);

    // Thruster trail removed — was always-on regardless of actual thrust,
    // showing up as a persistent blue blob stuck to the ship.

    // Generate procedural environment map for realistic PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x040818);
    // Add subtle colored lights to create interesting reflections
    const envLight1 = new THREE.PointLight(0x00d9ff, 8, 50);
    envLight1.position.set(10, 10, 10);
    envScene.add(envLight1);
    const envLight2 = new THREE.PointLight(0x7c3aed, 5, 50);
    envLight2.position.set(-10, -5, -10);
    envScene.add(envLight2);
    const envLight3 = new THREE.PointLight(0xf59e0b, 6, 50);
    envLight3.position.set(0, 15, -5);
    envScene.add(envLight3);
    const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture;
    pmremGenerator.dispose();

    // Load the realistic satellite GLB model — same file as the takeoff
    // scene, so the ship the player flies here matches what launched.
    const MODEL_PATH = '/models/simple_satellite_low_poly_free.glb';
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      MODEL_PATH,
      (gltf) => {
        const satelliteModel = gltf.scene;

        // --- SCALE FIX ---
        // This model has a long boom/panel piece that stretches far past the
        // rest of the hull on one axis. Using Math.max(x,y,z) picks up that
        // outlier and crushes the whole craft down to fit it, so the actual
        // body renders as a barely-visible sliver ("looks like a tiny fish").
        // The MEDIAN of the three box dimensions is robust to one long/flat
        // outlier axis and keeps the hull itself at a sensible on-screen size.
        const box = new THREE.Box3().setFromObject(satelliteModel);
        const size = box.getSize(new THREE.Vector3());
        const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
        const referenceDim = dims[1]; // median dimension
        const targetSize = 4.5;
        const scaleFactor = targetSize / referenceDim;
        satelliteModel.scale.setScalar(scaleFactor);

        // Center the model on its bounding box
        const center = box.getCenter(new THREE.Vector3());
        satelliteModel.position.sub(center.multiplyScalar(scaleFactor));

        // --- COLOR FIX ---
        // Keep this model's own authored gray/gold PBR materials showing
        // through as-is. envMap is intentionally NOT applied here — this
        // scene's env map is built from a strong cyan point light, and
        // applying it would wash the hull's real gray/gold colors into
        // blue, same issue as the takeoff scene had.
        satelliteModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((mat) => {
                if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                  const stdMat = mat as THREE.MeshStandardMaterial;
                  // envMap intentionally left unset — see comment above.
                  stdMat.needsUpdate = true;
                }
              });
            }
          }
        });

        // Remove placeholder, add real model
        shipGroup.remove(placeholder);
        shipGroup.add(satelliteModel);
        setModelLoadError(null);

        console.log('[BrunoSpaceExperience] Satellite GLB loaded successfully. Scale:', scaleFactor.toFixed(3), 'reference dim (median):', referenceDim.toFixed(2));
      },
      undefined,
      (error) => {
        // Surface the failure on screen instead of only logging it — a 404 here
        // silently leaves the cyan placeholder sphere on screen with no visible cue.
        console.error(`[BrunoSpaceExperience] Failed to load "${MODEL_PATH}". Make sure the file exists at "public${MODEL_PATH}" in your project root.`, error);
        setModelLoadError(`Could not load ${MODEL_PATH} — check that the file exists at public${MODEL_PATH}`);
      }
    );

    // 5. Interactive Solar System (uploaded realistic model)
    // Replaces the old procedurally-generated sun + 4 payload "planets" with
    // the real solar_system_animation.glb. The GLB ships with its own baked
    // orbit/rotation animation (played via AnimationMixer below), so we don't
    // hand-roll orbit angles anymore — each frame we just read back the live
    // world position of the named nodes we care about, and feed those into
    // the exact same proximity/HUD/modal logic as before.
    const solarSystemGroup = new THREE.Group();
    scene.add(solarSystemGroup);

    let solarSystemMixer: THREE.AnimationMixer | null = null;

    // Minimal fallback so the experience stays fully playable even if the
    // GLB fails to load — mirrors the old procedural sun/planets, but is
    // only ever built if the real model 404s.
    function buildFallbackSolarSystem() {
      const sunGeo = new THREE.SphereGeometry(6, 32, 32);
      const sunMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff4500,
        emissiveIntensity: 1.2,
        roughness: 0.1,
      });
      const sunMesh = new THREE.Mesh(sunGeo, sunMat);
      scene.add(sunMesh);

      const fallbackPlanets = [
        { id: 'velc', distance: 25, size: 2.2, color: 0x00d9ff, speed: 0.005, angle: 0 },
        { id: 'solexs', distance: 45, size: 3.0, color: 0xec4899, speed: 0.003, angle: 1.8 },
        { id: 'helios', distance: 65, size: 2.5, color: 0x7c3aed, speed: 0.002, angle: 3.5 },
        { id: 'blackhole', distance: 90, size: 3.5, color: 0x3b82f6, speed: 0.001, angle: 5.2 },
      ];

      const fallbackMeshes: Record<string, FallbackPlanetState> = {};
      fallbackPlanets.forEach((p) => {
        const geo = new THREE.SphereGeometry(p.size, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
          color: p.color,
          emissive: p.color,
          emissiveIntensity: 0.4,
          metalness: 0.6,
          roughness: 0.3,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(Math.cos(p.angle) * p.distance, 0, Math.sin(p.angle) * p.distance);
        scene.add(mesh);
        fallbackMeshes[p.id] = { mesh, distance: p.distance, angle: p.angle, speed: p.speed };
      });

      fallbackStateRef.current = fallbackMeshes;
      interactiveBodiesRef.current = {
        mode: 'fallback',
        sun: sunMesh,
        velc: fallbackMeshes.velc.mesh,
        solexs: fallbackMeshes.solexs.mesh,
        helios: fallbackMeshes.helios.mesh,
        blackhole: fallbackMeshes.blackhole.mesh,
      };
    }

    const SOLAR_MODEL_PATH = '/models/solar_system_animation.glb';
    const solarGltfLoader = new GLTFLoader();
    solarGltfLoader.load(
      SOLAR_MODEL_PATH,
      (gltf) => {
        const solarModel = gltf.scene;

        // Center the model on its own bounding box, then scale it into the
        // existing play space (ship/meteoroid field were tuned for a
        // ~25-90 unit range from the origin).
        const box = new THREE.Box3().setFromObject(solarModel);
        const center = box.getCenter(new THREE.Vector3());
        solarModel.position.sub(center);
        solarModel.scale.setScalar(SOLAR_SYSTEM_SCALE);

        solarModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = false;
          }
        });

        solarSystemGroup.add(solarModel);

        // The model ships with its own baked orbit/rotation animation.
        if (gltf.animations && gltf.animations.length > 0) {
          solarSystemMixer = new THREE.AnimationMixer(solarModel);
          gltf.animations.forEach((clip) => {
            solarSystemMixer!.clipAction(clip).play();
          });
        }

        scene.updateMatrixWorld(true);
        interactiveBodiesRef.current = {
          mode: 'glb',
          sun: solarModel.getObjectByName(NODE_NAME_BY_PLANET_ID.sun) ?? null,
          velc: solarModel.getObjectByName(NODE_NAME_BY_PLANET_ID.velc) ?? null,
          solexs: solarModel.getObjectByName(NODE_NAME_BY_PLANET_ID.solexs) ?? null,
          helios: solarModel.getObjectByName(NODE_NAME_BY_PLANET_ID.helios) ?? null,
          blackhole: solarModel.getObjectByName(NODE_NAME_BY_PLANET_ID.blackhole) ?? null,
        };

        console.log('[BrunoSpaceExperience] Solar system GLB loaded and wired up for interaction.');
      },
      undefined,
      (error) => {
        console.error(
          `[BrunoSpaceExperience] Failed to load "${SOLAR_MODEL_PATH}" — falling back to a simple procedural solar system. Make sure the file exists at "public${SOLAR_MODEL_PATH}".`,
          error
        );
        setSolarSystemLoadError(`Could not load ${SOLAR_MODEL_PATH} — check that the file exists at public${SOLAR_MODEL_PATH}`);
        buildFallbackSolarSystem();
      }
    );

    // 6. Background Starfield & Nebula
    const starCount = 2000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 600;
      starPos[i + 1] = (Math.random() - 0.5) * 600;
      starPos[i + 2] = (Math.random() - 0.5) * 600;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.8 });
    scene.add(new THREE.Points(starGeo, starMat));

    // Active Explosions Group
    const explosionGroup = new THREE.Group();
    scene.add(explosionGroup);

    // 7. Explosion Burst Spawner (Bruno Simon Physics Debris)
    const spawnExplosion = (pos: THREE.Vector3) => {
      const pCount = 120;
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(pCount * 3);
      const vels: THREE.Vector3[] = [];

      for (let i = 0; i < pCount; i++) {
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;

        vels.push(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8
          )
        );
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.PointsMaterial({
        color: 0xf59e0b,
        size: 0.4,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
      });

      const burstPoints = new THREE.Points(geo, mat);
      explosionGroup.add(burstPoints);

      let life = 1.0;
      const animateExplosion = () => {
        life -= 0.03;
        mat.opacity = Math.max(0, life);

        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
        const pArray = posAttr.array as Float32Array;

        for (let i = 0; i < pCount; i++) {
          pArray[i * 3] += vels[i].x;
          pArray[i * 3 + 1] += vels[i].y;
          pArray[i * 3 + 2] += vels[i].z;
        }
        posAttr.needsUpdate = true;

        if (life > 0) {
          requestAnimationFrame(animateExplosion);
        } else {
          explosionGroup.remove(burstPoints);
        }
      };
      animateExplosion();
    };

    // 8. Main Game Loop
    let animId: number;
    let clock = new THREE.Clock();
    const _sunWorldPos = new THREE.Vector3();
    const _bodyWorldPos = new THREE.Vector3();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);

      // Advance the interactive solar system: either the GLB's own baked
      // orbit/rotation animation, or the manual fallback orbit angles.
      const bodies = interactiveBodiesRef.current;
      if (bodies.mode === 'glb') {
        if (solarSystemMixer) solarSystemMixer.update(delta);
        scene.updateMatrixWorld(true);

        // Spread the planets further from the sun than the model's own
        // baked animation puts them. This runs AFTER the mixer sets each
        // frame's absolute position, so it's not cumulative — it just
        // scales that frame's already-relative-to-sun position vector.
        (['velc', 'solexs', 'helios', 'blackhole'] as const).forEach((id) => {
          const obj = bodies[id];
          if (obj) obj.position.multiplyScalar(ORBIT_SPREAD_FACTOR);
        });
        scene.updateMatrixWorld(true);
      } else if (bodies.mode === 'fallback' && fallbackStateRef.current) {
        Object.values(fallbackStateRef.current).forEach((p) => {
          p.angle += p.speed;
          p.mesh.position.x = Math.cos(p.angle) * p.distance;
          p.mesh.position.z = Math.sin(p.angle) * p.distance;
          p.mesh.rotation.y += 0.01;
        });
      }

      // One-time repositioning: spawn the ship near the Sun — the middle of
      // the solar system — once the Sun's real world position is known,
      // instead of leaving it at a hardcoded point far out near Earth's
      // orbit. This is what fixes "the satellite spawns way up high and
      // far away" — it now lands just outside the Sun's own proximity
      // radius, facing outward as if it just arrived in-system.
      if (!hasPositionedShipRef.current && bodies.mode !== 'loading' && bodies.sun) {
        bodies.sun.getWorldPosition(_sunWorldPos);

        const spawnDir = new THREE.Vector3(1, 0.12, 0.3).normalize();
        const spawnDistance = SUN_PROXIMITY_RADIUS * 1.6;
        const spawnPos = _sunWorldPos.clone().add(spawnDir.clone().multiplyScalar(spawnDistance));

        shipPosRef.current.copy(spawnPos);
        shipVelRef.current.set(0, 0, 0);

        // Face outward from the sun, as if just having arrived in-system
        const yaw = Math.atan2(spawnDir.x, spawnDir.z);
        shipRotRef.current.set(0, yaw, 0);

        // Snap the camera straight to the new spot instead of lerping in
        // from the far-away holding position, which would read as a
        // jarring cross-scene pan.
        const camOffset = new THREE.Vector3(0, 3.5, 12).applyEuler(shipRotRef.current);
        camera.position.copy(shipPosRef.current).add(camOffset);

        hasPositionedShipRef.current = true;
      }

      // Rotate Meteoroids
      meteoroids.forEach((m) => {
        m.mesh.rotation.x += m.rotSpeed.x;
        m.mesh.rotation.y += m.rotSpeed.y;
      });

      // User Keyboard Controls Processing
      const keys = keysRef.current;
      let forward = 0;
      let turn = 0;
      let pitch = 0;

      if (keys['KeyW'] || keys['ArrowUp']) forward += 1;
      if (keys['KeyS'] || keys['ArrowDown']) forward -= 0.5;
      if (keys['KeyA'] || keys['ArrowLeft']) turn += 1;
      if (keys['KeyD'] || keys['ArrowRight']) turn -= 1;
      if (keys['KeyQ']) pitch += 1;
      if (keys['KeyE']) pitch -= 1;

      // Acceleration & Steering
      const accel = 25 * delta;
      const speed = shipVelRef.current.length();
      setShipSpeed(Math.round(speed * 10));

      if (forward !== 0) {
        const moveDir = new THREE.Vector3(0, 0, -forward).applyEuler(shipRotRef.current);
        shipVelRef.current.addScaledVector(moveDir, accel);
      }
      // Inertia drag
      shipVelRef.current.multiplyScalar(0.96);

      // Yaw & Pitch Rotation
      shipRotRef.current.y += turn * 2.5 * delta;
      shipRotRef.current.x += pitch * 1.5 * delta;

      // Apply Roll Banking when turning
      const targetRoll = -turn * 0.4;
      shipRotRef.current.z += (targetRoll - shipRotRef.current.z) * 0.1;

      // Update Ship Position
      shipPosRef.current.addScaledVector(shipVelRef.current, delta);
      shipGroup.position.copy(shipPosRef.current);
      shipGroup.rotation.copy(shipRotRef.current);

      // Camera Chase Physics
      const cameraOffset = new THREE.Vector3(0, 3.5, 12).applyEuler(shipRotRef.current);
      const targetCamPos = shipPosRef.current.clone().add(cameraOffset);
      camera.position.lerp(targetCamPos, 0.1);

      const lookTarget = shipPosRef.current.clone().add(new THREE.Vector3(0, 0, -5).applyEuler(shipRotRef.current));
      camera.lookAt(lookTarget);

      // Collision Detection: Ship vs Meteoroids
      const shipSphere = new THREE.Sphere(shipPosRef.current, 1.2);

      meteoroids.forEach((m) => {
        const mSphere = new THREE.Sphere(m.mesh.position, m.radius);
        if (shipSphere.intersectsSphere(mSphere)) {
          // Trigger Collision Explosion!
          spawnExplosion(m.mesh.position.clone());
          audioEngine.playCollisionImpact();

          // Push meteoroid away & damage shield
          const bounceDir = m.mesh.position.clone().sub(shipPosRef.current).normalize();
          m.mesh.position.addScaledVector(bounceDir, 5);
          shipVelRef.current.multiplyScalar(-0.5);

          setScoreHits((prev) => prev + 1);
          setShieldLevel((prev) => Math.max(0, prev - 10));

          // Screen Shake
          camera.position.x += (Math.random() - 0.5) * 1.5;
          camera.position.y += (Math.random() - 0.5) * 1.5;
        }
      });

      // Proximity Trigger: Sun Solar Flare Signal
      if (bodies.mode !== 'loading' && bodies.sun) {
        bodies.sun.getWorldPosition(_sunWorldPos);
        const distToSun = shipPosRef.current.distanceTo(_sunWorldPos);
        setSolarSignalActive(distToSun < SUN_PROXIMITY_RADIUS);
      } else {
        setSolarSignalActive(false);
      }

      // Proximity Trigger: Planets Information Popups
      let closeTarget: string | null = null;
      if (bodies.mode !== 'loading') {
        (['velc', 'solexs', 'helios', 'blackhole'] as const).forEach((id) => {
          const obj = bodies[id];
          if (!obj) return;
          obj.getWorldPosition(_bodyWorldPos);
          const d = shipPosRef.current.distanceTo(_bodyWorldPos);
          if (d < INTERACTION_RADIUS[id]) {
            closeTarget = id;
          }
        });
      }
      setNearbyTarget(closeTarget);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleOpenPlanetModal = () => {
    if (nearbyTarget && PLANET_DATASETS[nearbyTarget]) {
      setSelectedPlanet(PLANET_DATASETS[nearbyTarget]);
    }
  };

  if (webglFailed) {
    return (
      <div className="relative w-full h-full bg-cosmic-black flex flex-col items-center justify-center p-8 text-center font-mono">
        <div className="max-w-md bg-black/90 border border-electric-blue/40 p-8 rounded-2xl shadow-[0_0_50px_rgba(0,217,255,0.3)] space-y-6">
          <div className="w-12 h-12 rounded-full bg-electric-blue/20 border border-electric-blue flex items-center justify-center mx-auto text-electric-blue font-bold text-xl">
            3D
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wider mb-2">3D Space Flight Mode</h2>
            <p className="text-xs text-muted-foreground font-sans">
              WebGL context is hardware constrained on this browser. You can proceed directly to the full analytics telemetry dashboard.
            </p>
          </div>
          <button
            onClick={onOpenDashboard}
            className="w-full py-3 bg-electric-blue hover:bg-cyan-400 text-black font-bold rounded-xl uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(0,217,255,0.6)] transition-all"
          >
            Launch Monitoring Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-cosmic-black overflow-hidden font-mono text-foreground select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Model load error banners — only show if a GLB failed to fetch */}
      {modelLoadError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-red-950/90 border border-red-500/60 rounded-lg text-red-300 text-[11px] font-mono backdrop-blur">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{modelLoadError}</span>
        </div>
      )}
      {solarSystemLoadError && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-red-950/90 border border-red-500/60 rounded-lg text-red-300 text-[11px] font-mono backdrop-blur">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{solarSystemLoadError}</span>
        </div>
      )}
      {asteroidFieldLoadError && (
        <div className="absolute top-44 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-red-950/90 border border-red-500/60 rounded-lg text-red-300 text-[11px] font-mono backdrop-blur">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{asteroidFieldLoadError}</span>
        </div>
      )}

      {/* Flight HUD Header Overlay */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-4 bg-black/80 border border-electric-blue/40 p-3 rounded-xl backdrop-blur shadow-[0_0_20px_rgba(0,217,255,0.2)]">
        <div className="flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-electric-blue animate-spin" style={{ animationDuration: '6s' }} />
          <div>
            <div className="text-[9px] text-muted-foreground uppercase">SPACECRAFT RADAR</div>
            <div className="text-xs font-bold text-white tracking-wider">ADITYA-L1 PILOT MODE</div>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10" />

        {/* Speedometer */}
        <div>
          <span className="text-[9px] text-muted-foreground block">VELOCITY</span>
          <span className="text-sm font-bold text-electric-blue">{shipSpeed} km/s</span>
        </div>

        {/* Shield Integrity */}
        <div>
          <span className="text-[9px] text-muted-foreground block">SHIELD</span>
          <span className={`text-sm font-bold ${shieldLevel > 40 ? 'text-emerald-400' : 'text-red-500'}`}>
            {shieldLevel}%
          </span>
        </div>

        {/* Asteroid Hits */}
        <div>
          <span className="text-[9px] text-muted-foreground block">METEOR HITS</span>
          <span className="text-sm font-bold text-supernova-gold">{scoreHits}</span>
        </div>
      </div>

      {/* Proximity Interaction Prompt */}
      {nearbyTarget && PLANET_DATASETS[nearbyTarget] && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-40 animate-in bounce-in duration-300">
          <button
            onClick={handleOpenPlanetModal}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-electric-blue to-purple-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-bold rounded-xl shadow-[0_0_30px_rgba(0,217,255,0.8)] text-xs uppercase tracking-widest transition-all hover:scale-105"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>PRESS TO INSPECT {PLANET_DATASETS[nearbyTarget].name}</span>
          </button>
        </div>
      )}

      {/* Solar Flare Proximity Signal Alert */}
      {solarSignalActive && (
        <SolarFlareSignalHUD
          intensity="X"
          onEngageDashboard={onOpenDashboard}
          onDismiss={() => setSolarSignalActive(false)}
        />
      )}

      {/* Planet Info Holographic Modal */}
      <PlanetInfoModal
        planet={selectedPlanet}
        onClose={() => setSelectedPlanet(null)}
        onOpenDashboard={onOpenDashboard}
      />

      {/* Controls Overlay Guide */}
      <div className="absolute bottom-4 left-4 z-30 bg-black/80 border border-white/10 p-3 rounded-lg backdrop-blur text-[10px] text-muted-foreground space-y-1">
        <div className="text-electric-blue font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
          <Compass className="w-3.5 h-3.5" /> Flight Navigation Controls
        </div>
        <div><kbd className="bg-white/10 px-1 rounded text-white font-mono">W / UP</kbd> Thrust Forward</div>
        <div><kbd className="bg-white/10 px-1 rounded text-white font-mono">A / D</kbd> Steer Left / Right</div>
        <div><kbd className="bg-white/10 px-1 rounded text-white font-mono">S / DOWN</kbd> Reverse Thrusters</div>
        <div className="text-supernova-gold pt-1">★ Fly into meteoroids to explode them!</div>
        <div className="text-amber-400">★ Approach Sun to trigger Solar Flare Signal</div>
      </div>

      {/* Quick Action Bar */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 font-mono text-xs">
        {onRestartTakeoff && (
          <button
            onClick={onRestartTakeoff}
            className="flex items-center gap-1.5 px-3 py-2 bg-black/80 border border-white/20 hover:border-electric-blue rounded-lg text-gray-300 hover:text-white backdrop-blur transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-electric-blue" />
            <span>Replay Takeoff</span>
          </button>
        )}

        <button
          onClick={onOpenDashboard}
          className="flex items-center gap-1.5 px-4 py-2 bg-electric-blue hover:bg-cyan-400 text-black font-bold rounded-lg shadow-[0_0_15px_rgba(0,217,255,0.6)] uppercase tracking-wider transition-all"
        >
          <Activity className="w-4 h-4" />
          <span>Launch Dashboard</span>
        </button>
      </div>
    </div>
  );
}