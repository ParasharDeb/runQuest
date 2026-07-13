"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "running" | "paused" | "caught";

const GAP_MAX = 100;
const GAP_START = 62;
const CATCH_GAP = 0;

// --- BLE treadmill telemetry ---
const BLE_SERVICE_UUID = "12345678-0000-1000-8000-00805f9b34fb";
const BLE_CHARACTERISTIC_UUID = "12345678-0001-1000-8000-00805f9b34fb";
// km/h that counts as "full sprint" for gameplay purposes
const BLE_MAX_SPEED_KMH = 8;

interface MapStyle {
  skyFallback: string;
  grassColors: [string, string, string];
  dirtColors: [string, string, string];
  pathLines: string;
  bladeColor: string;
  dustColor: string;
  filter?: string;
}

const mapStyles: Record<string, MapStyle> = {
  background: {
    skyFallback: "#18222d",
    grassColors: ["#223a2f", "#182b22", "#0f1c16"],
    dirtColors: ["#4a443a", "#37322b", "#27241e"],
    pathLines: "rgba(80,95,110,0.3)",
    bladeColor: "#2c4f3d",
    dustColor: "#a0b5c5",
  },
  overcast: {
    skyFallback: "#18222d",
    grassColors: ["#223a2f", "#182b22", "#0f1c16"],
    dirtColors: ["#4a443a", "#37322b", "#27241e"],
    pathLines: "rgba(80,95,110,0.3)",
    bladeColor: "#2c4f3d",
    dustColor: "#a0b5c5",
  },
  fog: {
    skyFallback: "#0b0e14",
    grassColors: ["#1b271d", "#141e16", "#0b110c"],
    dirtColors: ["#2d2c29", "#22211e", "#171614"],
    pathLines: "rgba(130,130,130,0.2)",
    bladeColor: "#253528",
    dustColor: "#4b5563",
  },
  snow: {
    skyFallback: "#2c3539",
    grassColors: ["#d2e5f0", "#a4c2d6", "#608ba6"],
    dirtColors: ["#e8f1f5", "#bcd0db", "#7fa1b3"],
    pathLines: "rgba(100,140,180,0.3)",
    bladeColor: "#ffffff",
    dustColor: "#ffffff",
  },
  background2night: {
    skyFallback: "#060a12",
    grassColors: ["#2d354a", "#21293c", "#181e2b"],
    dirtColors: ["#5b627a", "#444a5e", "#343a4c"],
    pathLines: "rgba(100,110,130,0.3)",
    bladeColor: "#414e6e",
    dustColor: "#a3b2cc",
  },
  background2day: {
    skyFallback: "#70a1ff",
    grassColors: ["#7bed9f", "#2ed573", "#26af5f"],
    dirtColors: ["#eccc68", "#ffa502", "#ff7f50"],
    pathLines: "rgba(200,150,100,0.4)",
    bladeColor: "#2ed573",
    dustColor: "#eccc68",
  },
  background3: {
    skyFallback: "#0d0a1a",
    grassColors: ["#1f1430", "#140c20", "#0a0510"],
    dirtColors: ["#3b2d4b", "#271d33", "#191221"],
    pathLines: "rgba(225,95,202,0.25)",
    bladeColor: "#3e245a",
    dustColor: "#d9a1e0",
  },
  bg_sumato: {
    skyFallback: "#1a2340",
    grassColors: ["#2a3a30", "#1e2c24", "#141e18"],
    dirtColors: ["#3a4050", "#2c3340", "#202530"],
    pathLines: "rgba(80,110,140,0.28)",
    bladeColor: "#243830",
    dustColor: "#8ab0c0",
  },
  khanaparaday: {
    skyFallback: "#4a7aaa",
    grassColors: ["#3a6a30", "#2c5225", "#1e3c18"],
    dirtColors: ["#8a7050", "#706040", "#504830"],
    pathLines: "rgba(120,100,60,0.35)",
    bladeColor: "#3a6028",
    dustColor: "#a09060",
  },
  khanaparaovercast: {
    skyFallback: "#3a5068",
    grassColors: ["#344e2a", "#263c20", "#1a2c16"],
    dirtColors: ["#706050", "#5a4e3c", "#3e3828"],
    pathLines: "rgba(100,85,50,0.35)",
    bladeColor: "#304824",
    dustColor: "#909aaa",
  },
};

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "rock" | "fence" | "spike" | "arrow" | "archer";
  passed: boolean;
  spriteUrl?: string;
  isFlying?: boolean;
  vx?: number;
  vy?: number;
  rot?: number;
}

const obstacleSpriteData = [
  { src: "/sprites/Obstacles/obstacle1.png", w: 130, h: 85 },
  { src: "/sprites/Obstacles/obstacle2.png", w: 136, h: 78 },
  { src: "/sprites/Obstacles/obstacle3.png", w: 143, h: 65 },
  { src: "/sprites/Obstacles/obstacle4.png", w: 136, h: 80 },
  { src: "/sprites/Obstacles/obstacle6.png", w: 130, h: 88 },
];

interface ChaseRunnerProps {
  autoStart?: boolean;
  mode?: "easy" | "normal" | "hard";
  map?: "background"; // Single Pragjyotishpur journey — map prop kept for compatibility
  control?: "keyboard_classic" | "treadmill";
}

export default function ChaseRunner({
  autoStart = false,
  mode = "normal",
  map = "background",
  control = "keyboard_classic",
}: ChaseRunnerProps) {
  const router = useRouter();
  const playCoinSfx = () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = new AudioContextClass();
      const playClink = (delay: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };
      playClink(0.0, 1975.53, 0.18); // B6 frequency
      playClink(0.04, 2637.02, 0.25); // E7 frequency
    } catch (e) {
      console.warn(e);
    }
  };

  const playShieldSfx = () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = new AudioContextClass();
      const playTone = (delay: number, startFreq: number, endFreq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(startFreq, ctx.currentTime + delay);
        osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + delay + duration);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };
      playTone(0.0, 300, 900, 0.4);
      playTone(0.1, 1200, 1800, 0.5);
    } catch (e) {
      console.warn(e);
    }
  };

  const playShieldBlockSfx = () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn(e);
    }
  };

  const playMagnetSfx = () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = new AudioContextClass();
      const playHum = (delay: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        osc.frequency.linearRampToValueAtTime(freq * 1.5, ctx.currentTime + delay + duration);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };
      playHum(0.0, 180, 0.4);
      playHum(0.1, 270, 0.5);
    } catch (e) {
      console.warn(e);
    }
  };

  const playArcherScreamSfx = () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = new AudioContextClass();
      const duration = 0.8;
      const freqs = [85, 170, 255, 340];
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);
        
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(450, ctx.currentTime);
        filter.Q.setValueAtTime(4.0, ctx.currentTime);
        
        // Connect ring modulator for throat raspiness
        const raspOsc = ctx.createOscillator();
        const raspGain = ctx.createGain();
        raspOsc.frequency.setValueAtTime(75, ctx.currentTime);
        raspGain.gain.setValueAtTime(freq * 0.45, ctx.currentTime);
        
        raspOsc.connect(raspGain);
        raspGain.connect(osc.frequency);
        
        gain.gain.setValueAtTime(0.0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        raspOsc.start();
        osc.stop(ctx.currentTime + duration);
        raspOsc.stop(ctx.currentTime + duration);
      });
    } catch (e) {
      console.warn(e);
    }
  };

  const playPrinceScreamSfx = () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = new AudioContextClass();
      const duration = 0.8;
      const freqs = [150, 300, 450];
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(freq * 0.7, ctx.currentTime + duration);
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(550, ctx.currentTime);
        filter.Q.setValueAtTime(2.5, ctx.currentTime);
        gain.gain.setValueAtTime(0.0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      });
    } catch (e) {
      console.warn(e);
    }
  };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<Phase>("running");
  const [phase, setPhase] = useState<Phase>("running");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [deathReason, setDeathReason] = useState<"asura" | "obstacle" | "archer" | "arrow">("asura");
  const deathReasonRef = useRef<"asura" | "obstacle" | "archer" | "arrow">("asura");
  const [gapDisplay, setGapDisplay] = useState(GAP_START);

  const modeRef = useRef(mode);
  const mapRef = useRef(map);
  const controlRef = useRef(control);
  // Journey stage ref: 0=bg1, 1=bg2night, 2=bg3, 3=bg_sumato, 4=khanapara
  const journeyStageRef = useRef(0);
  const startingBgKeyRef = useRef<string>("standard");
  const isFirstRunRef = useRef(true);
  const heroSlowdownTimerRef = useRef(0);

  const asuraDashTimerRef = useRef(0);
  const asuraDashCooldownRef = useRef(3);
  const asuraYOffsetRef = useRef(0);
  const asuraYVelocityRef = useRef(0);
  const asuraJumpCooldownRef = useRef(4);
  const asuraIsJumpingRef = useRef(false);
  const asuraIsDashingRef = useRef(false);

  // Hero jump physics refs
  const heroYOffsetRef = useRef(0);
  const heroYVelocityRef = useRef(0);
  const arrowRunningRef = useRef(false);
  const heroIsSlidingRef = useRef(false);
  const slideTimerRef = useRef(0);
  const idleTimerRef = useRef(0);
  const asuraJumpedToHeroRef = useRef(false);
  const isIdleCatchupRef = useRef(false);
  const archerImgRef = useRef<HTMLImageElement | null>(null);

  // Obstacle refs
  const activeObstaclesRef = useRef<Obstacle[]>([]);
  const obstacleTimerRef = useRef(0);
  const coinTimerRef = useRef(0);
  const [coins, setCoins] = useState(0);
  const coinsCountRef = useRef(0);
  const currentSpeedRef = useRef(0);
  const [lifetimeCoins, setLifetimeCoins] = useState(0);

  const [overlaySelection, setOverlaySelection] = useState<"left" | "right">("left");
  const overlaySelectionRef = useRef<"left" | "right">("left");
  const updateOverlaySelection = (val: "left" | "right") => {
    overlaySelectionRef.current = val;
    setOverlaySelection(val);
  };

  useEffect(() => {
    if (phase === "paused" || phase === "caught") {
      updateOverlaySelection("left");
    }
  }, [phase]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lifetimeCoins");
      if (saved) {
        setLifetimeCoins(parseInt(saved, 10));
      }
      const savedBest = localStorage.getItem("highScore");
      if (savedBest) {
        setBest(parseInt(savedBest, 10));
      }
    }
  }, []);

  const saveHighScore = (newScore: number) => {
    const currentBest = parseInt(localStorage.getItem("highScore") || "0", 10);
    if (newScore > currentBest) {
      localStorage.setItem("highScore", newScore.toString());
      setBest(newScore);
    }
  };

  const saveLifetimeCoins = (newCoins: number) => {
    if (typeof window !== "undefined" && newCoins > 0) {
      const currentLifetime = parseInt(localStorage.getItem("lifetimeCoins") || "0", 10);
      const updated = currentLifetime + newCoins;
      localStorage.setItem("lifetimeCoins", updated.toString());
      setLifetimeCoins(updated);
    }
  };

  const currentWeatherRef = useRef<string>("standard");
  const weatherStoppingRef = useRef(false);
  const precipitationStrengthRef = useRef(1.0);
  const lastWeatherScoreRef = useRef(0);
  const weatherTimerRef = useRef(0);
  const weatherDurationRef = useRef(0);

  // Power Up state structures
  const nextPowerUpScoreRef = useRef(150);
  const activePowerUpsRef = useRef<Array<{ x: number; y: number; radius: number; pulsePhase: number; collected: boolean; type?: "coin" | "armour" | "magnet" }>>([]);
  const floatingTextsRef = useRef<Array<{ x: number; y: number; text: string; alpha: number; vy: number }>>([]);
  const goldSparksRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; alpha: number; size: number; color?: [number, number, number] }>>([]);
  const scoreBonusRef = useRef(0);
  const [armourTime, setArmourTime] = useState(0);
  const armourTimerRef = useRef(0);
  const armourSpawnTimerRef = useRef(0);
  const [magnetTime, setMagnetTime] = useState(0);
  const magnetTimerRef = useRef(0);
  const magnetSpawnTimerRef = useRef(0);

  useEffect(() => {
    modeRef.current = mode;
    mapRef.current = map;
    controlRef.current = control;
  }, [mode, map, control]);

  const holdingRef = useRef(false);
  const gapRef = useRef(GAP_START);
  const scoreRef = useRef(0);
  const elapsedRef = useRef(0);
  const runCycleRef = useRef(0);
  const difficultyRef = useRef(1);
  const groundOffsetRef = useRef(0);
  const treeOffsetRef = useRef(0);
  const farOffsetRef = useRef(0);
  const skyOffsetRef = useRef(0);
  const shakeRef = useRef(0);
  const starTimeRef = useRef(0);

  const heroNodeRef = useRef<HTMLImageElement | null>(null);
  const villainNodeRef = useRef<HTMLImageElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const currentBgRef = useRef<HTMLImageElement | null>(null);
  const targetBgRef = useRef<HTMLImageElement | null>(null);
  const bgFadeOpacityRef = useRef(0);
  const moonImgRef = useRef<HTMLImageElement | null>(null);
  const preloadedImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bloodStainsRef = useRef<{ x: number; y: number; size: number; opacity: number }[]>([]);
  const heroDustRef = useRef<{ x: number; y: number; life: number; size: number; opacity: number }[]>([]);
  const weatherParticlesRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number }[]>([]);
  const heroFrames = [
    "/sprites/Prince/prince1.png",
    "/sprites/Prince/prince2.png",
    "/sprites/Prince/prince3.png",
    "/sprites/Prince/prince4.png",
  ];
  // Portal smoke transition refs
  const portalStateRef = useRef<"none" | "in" | "out">("none");
  const portalProgressRef = useRef(0); // 0→1 for "in", 1→0 for "out"
  const pendingNextStageRef = useRef(-1); // stage to switch to at smoke peak
  const heroStandingFrame = "/sprites/Prince/Prince_standing.png";
  const tiredHeroFrame = "/sprites/Prince/Prince_tired.png";
  const heroSlidingFrame = "/sprites/Prince/prince_sliding.png";
  const villainFrames = [
    "/sprites/Asura/asur1.png",
    "/sprites/Asura/asur2.png",
    "/sprites/Asura/asur3.png",
    "/sprites/Asura/asur4.png",
  ];
  const frameDelayMs = 60;
  const frameTimerRef = useRef(0);
  const idleApproachRate = 8;
  const heroTiredRef = useRef(false);
  const previousThrottleRef = useRef(0);

  // --- BLE treadmill state ---
  const bleDeviceRef = useRef<BluetoothDevice | null>(null);
  const bleCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const bleVelocityRef = useRef(0); // km/h from treadmill
  const bleDistanceRef = useRef(0); // meters from treadmill
  const bleDistanceBaseRef = useRef(0); // baseline for the current run
  const bleConnectedRef = useRef(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleStatus, setBleStatus] = useState("Not connected");
  const [bleSpeed, setBleSpeed] = useState(0);
  const [bleDistance, setBleDistance] = useState(0);
  const [lastBleRaw, setLastBleRaw] = useState<string | null>(null);
  const [lastBleAt, setLastBleAt] = useState<number | null>(null);
  // Pending BLE button action to be consumed by the game loop
  const bleActionRef = useRef<"jump" | "slide" | "none">("none");

  // Load background once or reload when map changes
  useEffect(() => {
    const urls = {
      standard: "/background_overcast.jpeg",
      overcast: "/background_overcast.jpeg",
      fog: "/background_fog.jpeg",
      bg2night: "/background_2night.png",
      bg3: "/background_3.png",
      bg_sumato: "/background_sumato.png",
      khanaparaday: "/background_khanaparaday.jpeg",
      khanaparaovercast: "/background_khanaparacast.jpeg",
    };

    Object.entries(urls).forEach(([key, url]) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        preloadedImagesRef.current[key] = img;
        // set initial background image on load
        // set initial background image on load if it matches the randomly selected starting theme
        if (key === startingBgKeyRef.current) {
          bgImgRef.current = img;
          currentBgRef.current = img;
          targetBgRef.current = img;
        }
      };
    });

    const moon = new Image();
    moon.src = "/moon.png";
    moon.onload = () => {
      moonImgRef.current = moon;
    };

    const archer = new Image();
    archer.src = "/sprites/Asura/Archer_asur.png";
    archer.onload = () => {
      archerImgRef.current = archer;
    };

    // Preload Prince and Asura frames
    const characterFrames = [
      "/sprites/Prince/prince1.png",
      "/sprites/Prince/prince2.png",
      "/sprites/Prince/prince3.png",
      "/sprites/Prince/prince4.png",
      "/sprites/Prince/Prince_standing.png",
      "/sprites/Prince/Prince_tired.png",
      "/sprites/Prince/prince_sliding.png",
      "/sprites/Asura/asur1.png",
      "/sprites/Asura/asur2.png",
      "/sprites/Asura/asur3.png",
      "/sprites/Asura/asur4.png",
    ];
    characterFrames.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    const obstacleFrames = [
      "/sprites/Obstacles/obstacle1.png",
      "/sprites/Obstacles/obstacle2.png",
      "/sprites/Obstacles/obstacle3.png",
      "/sprites/Obstacles/obstacle4.png",
      "/sprites/Obstacles/obstacle6.png",
    ];
    obstacleFrames.forEach((src) => {
      const img = new Image();
      img.src = src;
      preloadedImagesRef.current[src] = img;
    });

    const powerupFrames = [
      "/sprites/Powerups/armour_pwup.png",
      "/sprites/Powerups/magnet_pwup.png",
    ];
    powerupFrames.forEach((src) => {
      const img = new Image();
      img.src = src;
      preloadedImagesRef.current[src] = img;
    });
  }, [map]);

  // Load audio once on mount with clean release
  useEffect(() => {
    const audio = new Audio("/sprites/Music/Game_score.mpeg");
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  function playMusic() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    }
  }

  function startRun() {
    gapRef.current = GAP_START;
    scoreRef.current = 0;
    elapsedRef.current = 0;
    difficultyRef.current = 1;
    heroDustRef.current = [];
    bloodStainsRef.current = [];
    bleDistanceBaseRef.current = bleDistanceRef.current;
    groundOffsetRef.current = 0;

    // Reset Asura actions
    asuraDashTimerRef.current = 0;
    asuraDashCooldownRef.current = 3;
    asuraYOffsetRef.current = 0;
    asuraYVelocityRef.current = 0;
    asuraJumpCooldownRef.current = 4;
    asuraIsJumpingRef.current = false;
    asuraIsDashingRef.current = false;
    idleTimerRef.current = 0;
    asuraJumpedToHeroRef.current = false;
    isIdleCatchupRef.current = false;

    // Reset Hero jump, obstacles & coins
    heroYOffsetRef.current = 0;
    heroYVelocityRef.current = 0;
    arrowRunningRef.current = false;
    heroIsSlidingRef.current = false;
    activeObstaclesRef.current = [];
    obstacleTimerRef.current = 0;
    coinTimerRef.current = 0;
    coinsCountRef.current = 0;
    setCoins(0);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lifetimeCoins");
      if (saved) {
        setLifetimeCoins(parseInt(saved, 10));
      }
    }

    // Reset background transition parameters
    bgFadeOpacityRef.current = 0;
    currentWeatherRef.current = "standard";
    weatherStoppingRef.current = false;
    precipitationStrengthRef.current = 1.0;
    lastWeatherScoreRef.current = 0;
    weatherTimerRef.current = 0;
    weatherDurationRef.current = 0;

    // Reset power-up structures
    armourTimerRef.current = 0;
    setArmourTime(0);
    magnetTimerRef.current = 0;
    setMagnetTime(0);
    nextPowerUpScoreRef.current = 150;
    activePowerUpsRef.current = [];
    floatingTextsRef.current = [];
    goldSparksRef.current = [];
    scoreBonusRef.current = 0;
    // Always start from stage 0 of the journey
    journeyStageRef.current = 0;
    const initialKey = "standard";
    startingBgKeyRef.current = initialKey;
    currentWeatherRef.current = initialKey;
    isFirstRunRef.current = false;
    const initialImg = preloadedImagesRef.current[initialKey] || null;
    currentBgRef.current = initialImg;
    targetBgRef.current = initialImg;
    if (initialImg) bgImgRef.current = initialImg;

    setScore(0);
    setGapDisplay(GAP_START);
    setBleDistance(0);
    phaseRef.current = "running";
    setPhase("running");
    playMusic();
  }

  function pauseGame() {
    if (phaseRef.current !== "running") return;
    phaseRef.current = "paused";
    setPhase("paused");
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }

  function resumeGame() {
    if (phaseRef.current !== "paused") return;
    phaseRef.current = "running";
    setPhase("running");
    playMusic();
  }

  useEffect(() => {
    if (phase === "paused") {
      audioRef.current?.pause();
    }
  }, [phase]);

  function exitGame() {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Attempt to close the tab completely
    window.close();

    // Fallback just in case the browser blocks window.close()
    setTimeout(() => {
      router.push("/");
    }, 100);
  }

  useEffect(() => {
    startRun();
  }, []);

  // Parse JSON telemetry packets emitted by the ESP32 treadmill firmware
  function processIncomingTelemetry(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const decoder = new TextDecoder("utf-8");
    let raw = decoder.decode(target.value);
    // Strip stray control bytes so JSON.parse doesn't choke
    raw = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    // Preserve raw packet for debugging
    try {
      setLastBleRaw(raw);
      setLastBleAt(Date.now());
    } catch (e) {
      /* ignore in non-browser or SSR contexts */
    }

    try {
      const packet = JSON.parse(raw);
      const speed = parseFloat(packet.speed);
      const distance = parseFloat(packet.distance);
      if (!Number.isNaN(speed)) {
        bleVelocityRef.current = speed;
        setBleSpeed(speed);
      }
      if (!Number.isNaN(distance)) {
        bleDistanceRef.current = distance;
        const displayedDistance = Math.max(0, distance - bleDistanceBaseRef.current);
        setBleDistance(displayedDistance);
      }

      // Real-world running drives the sprint input: any meaningful pace
      // counts as "holding" the sprint key, proportional to speed.
      holdingRef.current = speed > 0.5;

      if (phaseRef.current !== "running" && speed > 0.5) {
        startRun();
      }

      // Handle physical push-button actions (jump / slide)
      const action = packet.action;
      if (action === "jump" || action === "slide") {
        bleActionRef.current = action;
      }
    } catch (e) {
      console.warn("BLE telemetry parse error:", raw);
    }
  }

  function cleanDisconnectState() {
    bleConnectedRef.current = false;
    setBleConnected(false);
    bleVelocityRef.current = 0;
    holdingRef.current = false;
    setBleSpeed(0);
    setBleDistance(0);
    bleDistanceRef.current = 0;
    bleDistanceBaseRef.current = 0;
    setBleStatus((prev) =>
      prev.startsWith("Failed") ? prev : "Disconnected from treadmill"
    );
  }

  async function connectTreadmill() {
    if (!window.isSecureContext) {
      setBleStatus("Web Bluetooth needs a secure context. Open this app from localhost or HTTPS in Chrome/Edge.");
      return;
    }

    if (!navigator.bluetooth) {
      setBleStatus("Web Bluetooth unavailable — use Chrome/Edge over HTTPS or localhost");
      return;
    }

    if (bleDeviceRef.current?.gatt?.connected) {
      bleDeviceRef.current.gatt.disconnect();
      return;
    }

    try {
      const bluetoothApi = navigator.bluetooth as Bluetooth & {
        getAvailability?: () => Promise<boolean>;
      };
      const available = bluetoothApi.getAvailability
        ? await bluetoothApi.getAvailability()
        : true;
      if (available === false) {
        setBleStatus("Bluetooth adapter unavailable or blocked. Turn on Bluetooth and allow the site to access it.");
        return;
      }

      setBleStatus("Opening device chooser...");
      console.log("BLE: requesting device chooser (acceptAllDevices)");
      // Try a permissive chooser first so devices that don't advertise the service still appear
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BLE_SERVICE_UUID],
      });
      bleDeviceRef.current = device;

      setBleStatus("Connecting to GATT server...");
      const server = await device.gatt!.connect();

      setBleStatus("Looking up treadmill service...");
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);

      setBleStatus("Subscribing to speed/distance notifications...");
      const characteristic = await service.getCharacteristic(
        BLE_CHARACTERISTIC_UUID
      );
      bleCharRef.current = characteristic;

      await characteristic.startNotifications();
      characteristic.addEventListener(
        "characteristicvaluechanged",
        processIncomingTelemetry
      );

      device.addEventListener("gattserverdisconnected", cleanDisconnectState);

      // Reset baseline so displayed distance starts from zero for this connection
      bleDistanceBaseRef.current = bleDistanceRef.current;
      setBleDistance(0);
      console.log("BLE: connected", device.name, "baseline", bleDistanceBaseRef.current);

      bleConnectedRef.current = true;
      setBleConnected(true);
      setBleStatus(`Connected: ${device.name || "ESP32 Treadmill"}`);
    } catch (error) {
      console.error(error);
      setBleStatus(
        "Connection failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      cleanDisconnectState();
    }
  }

  // Input handling
  useEffect(() => {
    const press = (e: KeyboardEvent) => {
      const phaseNow = phaseRef.current;
      
      // Override overlay menu navigation when paused or caught (dead)
      if (phaseNow === "paused" || phaseNow === "caught") {
        if (e.code === "ArrowLeft") {
          e.preventDefault?.();
          updateOverlaySelection("left");
        } else if (e.code === "ArrowRight") {
          e.preventDefault?.();
          updateOverlaySelection("right");
        } else if (e.code === "Enter") {
          e.preventDefault?.();
          if (phaseNow === "paused") {
            if (overlaySelectionRef.current === "left") {
              resumeGame();
            } else {
              exitGame();
            }
          } else {
            if (overlaySelectionRef.current === "left") {
              startRun();
            } else {
              exitGame();
            }
          }
        }
        return;
      }

      if (e.code === "Escape") {
        e.preventDefault?.();
        if (phaseNow === "running") {
          pauseGame();
        }
        return;
      }

      if (phaseNow !== "running") {
        if (control === "keyboard_classic") {
          if (e.code === "Space" || e.code === "ArrowUp") {
            startRun();
          }
        } else {
          if (e.code === "ArrowRight" || e.code === "ArrowUp") {
            startRun();
            if (e.code === "ArrowRight") {
              arrowRunningRef.current = true;
            }
          }
        }
        return;
      }      if (control === "keyboard_classic") {
        if (e.code === "Space") {
          // Jump only if the hero is on the ground and not sliding
          if (heroYOffsetRef.current === 0 && heroYVelocityRef.current === 0 && !heroIsSlidingRef.current) {
            heroYVelocityRef.current = 550;
            heroYOffsetRef.current = 1;
          }
        } else if (e.code === "ControlLeft" || e.code === "ControlRight") {
          if (heroYOffsetRef.current > 0) {
            // Fast fall
            heroYVelocityRef.current = Math.min(heroYVelocityRef.current, -600);
          } else {
            heroIsSlidingRef.current = true;
            slideTimerRef.current = 1.0; // Slide for 1 second max
          }
        }
      } else {
        if (e.code === "ArrowUp") {
          holdingRef.current = true;
        }
      }
    };
 
    const release = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") {
        arrowRunningRef.current = false;
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        heroIsSlidingRef.current = false;
      } else if ((e.code === "ControlLeft" || e.code === "ControlRight") && control === "keyboard_classic") {
        heroIsSlidingRef.current = false;
      } else if (e.code === "ArrowUp" && control !== "keyboard_classic") {
        holdingRef.current = false;
      }
    };

    window.addEventListener("keydown", press);
    window.addEventListener("keyup", release);
    return () => {
      window.removeEventListener("keydown", press);
      window.removeEventListener("keyup", release);
    };
  }, [control]);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function blendHexColors(color1: string, color2: string, ratio: number): string {
      const parseHex = (c: string) => {
        const hex = c.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { r, g, b };
      };
      
      try {
        const c1 = parseHex(color1);
        const c2 = parseHex(color2);
        
        const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
        const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
        const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
        
        const toHex = (val: number) => {
          const hex = val.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      } catch (e) {
        return color2;
      }
    }

    function getBlendedMapStyle(): MapStyle {
      // Use journey stage to determine ground/grass style
      const stage = journeyStageRef.current;
      const stageStyleMap: MapStyle[] = [
        mapStyles.background,       // stage 0: bg1 (overcast/standard/fog cycle)
        mapStyles.background2night, // stage 1: bg2night
        mapStyles.background3,      // stage 2: bg3
        mapStyles.bg_sumato,        // stage 3: sumato
        mapStyles.khanaparaday,     // stage 4: khanapara
      ];
      let targetStyle = stageStyleMap[stage] || mapStyles.background;

      // For stage 0 (bg1 weather cycle) override with weather-specific style
      if (stage === 0) {
        const weatherMap: Record<string, MapStyle> = {
          standard: mapStyles.background,
          overcast: mapStyles.overcast,
          fog: mapStyles.fog,
        };
        targetStyle = weatherMap[currentWeatherRef.current] || mapStyles.background;
      }
      // For khanapara stage: also apply overcast variant
      if (stage === 4 && currentWeatherRef.current === "khanaparaovercast") {
        targetStyle = mapStyles.khanaparaovercast;
      }

      const currentStyleKey = currentBgRef.current;
      const bgStyleMap: Record<string, MapStyle> = {
        [String(preloadedImagesRef.current.standard)]: mapStyles.background,
        [String(preloadedImagesRef.current.overcast)]: mapStyles.overcast,
        [String(preloadedImagesRef.current.fog)]: mapStyles.fog,
        [String(preloadedImagesRef.current.bg2night)]: mapStyles.background2night,
        [String(preloadedImagesRef.current.bg3)]: mapStyles.background3,
        [String(preloadedImagesRef.current.bg_sumato)]: mapStyles.bg_sumato,
        [String(preloadedImagesRef.current.khanaparaday)]: mapStyles.khanaparaday,
        [String(preloadedImagesRef.current.khanaparaovercast)]: mapStyles.khanaparaovercast,
      };
      const currentStyle = bgStyleMap[String(currentStyleKey)] || targetStyle;

      const ratio = bgFadeOpacityRef.current;
      if (currentStyle === targetStyle || ratio <= 0) {
        return currentStyle;
      }
      return {
        skyFallback: blendHexColors(currentStyle.skyFallback, targetStyle.skyFallback, ratio),
        grassColors: [
          blendHexColors(currentStyle.grassColors[0], targetStyle.grassColors[0], ratio),
          blendHexColors(currentStyle.grassColors[1], targetStyle.grassColors[1], ratio),
          blendHexColors(currentStyle.grassColors[2], targetStyle.grassColors[2], ratio),
        ],
        dirtColors: [
          blendHexColors(currentStyle.dirtColors[0], targetStyle.dirtColors[0], ratio),
          blendHexColors(currentStyle.dirtColors[1], targetStyle.dirtColors[1], ratio),
          blendHexColors(currentStyle.dirtColors[2], targetStyle.dirtColors[2], ratio),
        ],
        pathLines: targetStyle.pathLines,
        bladeColor: blendHexColors(currentStyle.bladeColor, targetStyle.bladeColor, ratio),
        dustColor: blendHexColors(currentStyle.dustColor, targetStyle.dustColor, ratio),
      };
    }

    // Rain and snow canvas animation drawers
    function updateAndDrawWeather(w: number, h: number, dt: number) {
      const currentWeather = currentWeatherRef.current;

      if (weatherParticlesRef.current.length === 0) {
        for (let i = 0; i < 150; i++) {
          weatherParticlesRef.current.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: 0,
            vy: 0,
            size: 0,
          });
        }
      }

      const isTargetOvercast = targetBgRef.current === preloadedImagesRef.current.overcast || targetBgRef.current === preloadedImagesRef.current.khanaparaovercast;
      const isCurrentOvercast = currentBgRef.current === preloadedImagesRef.current.overcast || currentBgRef.current === preloadedImagesRef.current.khanaparaovercast;
      const isTargetSnow = false;
      const isCurrentSnow = false;

      // Rain is active during stage 0 overcast, or khanapara overcast (stage 4)
      const rainActive = (currentWeatherRef.current === "overcast" || currentWeatherRef.current === "khanaparaovercast" ||
        (isTargetOvercast && bgFadeOpacityRef.current > 0) || (isCurrentOvercast && bgFadeOpacityRef.current > 0));
      const snowActive = false;

      if (rainActive) {
        let blendFactor = 1.0;
        if (currentWeather !== "overcast" && currentWeather !== "khanaparaovercast") {
          blendFactor = 1.0 - bgFadeOpacityRef.current;
        } else if (isTargetOvercast && bgFadeOpacityRef.current > 0) {
          blendFactor = bgFadeOpacityRef.current;
        }
        const strength = precipitationStrengthRef.current;
        ctx!.strokeStyle = `rgba(174, 194, 224, ${0.45 * blendFactor * strength})`;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();

        for (const p of weatherParticlesRef.current) {
          p.vy = 850 + Math.random() * 200;
          p.vx = -140;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          if (p.y > h || p.x < 0) {
            p.y = -20;
            p.x = Math.random() * w;
          }

          // All journey stages draw rain particles fullscreen
          ctx!.moveTo(p.x, p.y);
          ctx!.lineTo(p.x - 2, p.y + 16);
        }
        ctx!.stroke();
      }

      if (snowActive) {
        let blendFactor = 1.0;
        if (currentWeather !== "snow") {
          blendFactor = 1.0 - bgFadeOpacityRef.current;
        } else if (isTargetSnow && bgFadeOpacityRef.current > 0) {
          blendFactor = bgFadeOpacityRef.current;
        }
        const strength = precipitationStrengthRef.current;
        ctx!.fillStyle = `rgba(255, 255, 255, ${0.8 * blendFactor * strength})`;


        for (const p of weatherParticlesRef.current) {
          p.vy = 80 + Math.random() * 50;
          p.vx = -30 + Math.sin(starTimeRef.current + p.y * 0.01) * 15;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          if (p.y > h) {
            p.y = -10;
            p.x = Math.random() * w;
          }

          ctx!.beginPath();
          ctx!.arc(p.x, p.y, 2 + Math.random() * 2.5, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
    }

    function drawBgImage(img: HTMLImageElement, w: number, h: number, offset: number) {
      if (!img.complete || img.naturalWidth === 0) return;
      // Draw background image twice to support wrapping parallax scrolling
      const bgW = w * 1.5;
      const bgOffset = (groundOffsetRef.current * 0.11) % bgW;
      ctx!.drawImage(img, -bgOffset, 0, bgW, h);
      ctx!.drawImage(img, bgW - bgOffset, 0, bgW, h);
    }

    function drawSky(w: number, h: number, offset: number) {
      const style = getBlendedMapStyle();

      ctx!.save();
      if (style.filter) {
        ctx!.filter = style.filter;
      }

      if (false) {
        // Legacy dual-panel parallax (unused in single Pragjyotishpur journey mode)
        const imgNight = preloadedImagesRef.current["bg2night"];

        // The left map is Map 1 (Aec and Kamakhya) which supports active weather progression
        const drawMap1Bg = (x: number, width: number) => {
          const currentBg = currentBgRef.current;
          const targetBg = targetBgRef.current;

          if (currentBg) {
            if (currentBg.complete && currentBg.naturalWidth > 0) {
              ctx!.drawImage(currentBg, x, 0, width, h);
            }
          } else {
            ctx!.fillStyle = style.skyFallback;
            ctx!.fillRect(x, 0, width, h);
          }

          if (targetBg && targetBg !== currentBg && bgFadeOpacityRef.current > 0) {
            ctx!.save();
            ctx!.globalAlpha = bgFadeOpacityRef.current;
            if (targetBg.complete && targetBg.naturalWidth > 0) {
              ctx!.drawImage(targetBg, x, 0, width, h);
            }
            ctx!.restore();
          }
        };

        if (imgNight) {
          // Stretched width for each map segment
          const bgW = w * 1.5;
          // Short transition width for the black tunnel segment
          const transW = w * 0.35;
          // Total cycle width = bgW + transW + bgW + transW = 2 * bgW + 2 * transW
          const cycleW = 2 * bgW + 2 * transW;
          const bgOffset = (groundOffsetRef.current * 0.11) % cycleW;

          const x1 = -bgOffset; // Map 1
          const x2 = bgW - bgOffset; // Transition 1 (Black + Portal Smoke)
          const x3 = bgW + transW - bgOffset; // Map 2
          const x4 = 2 * bgW + transW - bgOffset; // Transition 2 (Black + Portal Smoke)
          const x5 = 2 * bgW + 2 * transW - bgOffset; // Map 1 (wrap)
          const x6 = 3 * bgW + 2 * transW - bgOffset; // Transition 1 (wrap)
          const x7 = 3 * bgW + 3 * transW - bgOffset; // Map 2 (wrap)
          const x8 = 4 * bgW + 3 * transW - bgOffset; // Transition 2 (wrap)

          // Helper to draw swirling smoke tunnel over a black backdrop
          const drawSmokeTunnel = (x: number, width: number) => {
            if (x + width + 150 <= 0 || x - 150 >= w) return;
            
            // Draw pure black middle backdrop
            ctx!.fillStyle = "#000000";
            ctx!.fillRect(x, 0, width, h);

            // Wavy black backdrop left edge (no sharp borders, moving organically)
            for (let y = -50; y < h + 50; y += 18) {
              const leftWave = Math.sin(starTimeRef.current * 2.8 + y * 0.02) * 30;
              ctx!.beginPath();
              ctx!.arc(x + leftWave, y, 95, 0, Math.PI * 2);
              ctx!.fill();
            }

            // Wavy black backdrop right edge (no sharp borders, moving organically)
            for (let y = -50; y < h + 50; y += 18) {
              const rightWave = Math.sin(starTimeRef.current * 2.8 + y * 0.02 + 1.5) * 30;
              ctx!.beginPath();
              ctx!.arc(x + width + rightWave, y, 95, 0, Math.PI * 2);
              ctx!.fill();
            }

            // Dense swirling white/grey smoke cloud puffs (no gaps)
            ctx!.save();
            const smokeStep = 18; // dense vertical step
            const xStep = 35; // dense horizontal step
            const fadeZone = 120;

            for (let curX = x - fadeZone; curX <= x + width + fadeZone; curX += xStep) {
              const divIdx = Math.floor((curX - (x - fadeZone)) / xStep);

              // Smooth opacity fade at transition margins (fade out to 0 on both left & right edges)
              let edgeAlpha = 1.0;
              if (curX < x) {
                edgeAlpha = Math.max(0, 1 - (x - curX) / fadeZone);
              } else if (curX > x + width) {
                edgeAlpha = Math.max(0, 1 - (curX - (x + width)) / fadeZone);
              }

              for (let y = -50; y < h + 50; y += smokeStep) {
                // Wind wave drift
                const waveOffset = Math.sin(starTimeRef.current * 3.2 + y * 0.02 + divIdx * 0.5) * 22;
                const puffX = curX + waveOffset;

                // Alternate grey scales
                const index = Math.floor(y / smokeStep) + divIdx + 100;
                let color = `rgba(190, 190, 190, ${0.96 * edgeAlpha})`; // medium grey
                if (index % 3 === 1) {
                  color = `rgba(225, 225, 225, ${0.96 * edgeAlpha})`; // light grey
                } else if (index % 3 === 2) {
                  color = `rgba(250, 250, 250, ${1.0 * edgeAlpha})`; // white core
                }

                // Breathing size pulse
                const baseRadius = 85 + Math.sin(starTimeRef.current * 2.5 + y) * 15;

                ctx!.beginPath();
                const pGrad = ctx!.createRadialGradient(puffX, y, 0, puffX, y, baseRadius);
                pGrad.addColorStop(0, color);
                pGrad.addColorStop(0.4, color);
                pGrad.addColorStop(0.75, color.replace(/[\d\.]+\)$/, `${0.15 * edgeAlpha})`));
                pGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

                ctx!.fillStyle = pGrad;
                ctx!.arc(puffX, y, baseRadius, 0, Math.PI * 2);
                ctx!.fill();
              }
            }
            ctx!.restore();

            // Cosmic spark particles
            ctx!.fillStyle = "rgba(255, 255, 255, 0.95)";
            for (let i = 0; i < 15; i++) {
              const sy = ((starTimeRef.current * 85) + i * (h / 15)) % h;
              const sx = x + (i * (width / 15)) + Math.sin(starTimeRef.current * 4 + i) * 25;
              ctx!.beginPath();
              ctx!.arc(sx, sy, 1.8 + Math.random() * 3, 0, Math.PI * 2);
              ctx!.fill();
            }
          };

          // Draw Segment 1 & 5 (Map 1, width: bgW)
          if (x1 + bgW > 0 && x1 < w) drawMap1Bg(x1, bgW);
          if (x5 + bgW > 0 && x5 < w) drawMap1Bg(x5, bgW);

          // Draw Segment 3 & 7 (Map 2, width: bgW)
          if (x3 + bgW > 0 && x3 < w) ctx!.drawImage(imgNight, x3, 0, bgW, h);
          if (x7 + bgW > 0 && x7 < w) ctx!.drawImage(imgNight, x7, 0, bgW, h);

          // Draw Segment 2, 4, 6 & 8 (Transition: Black Background + Smoke, width: transW) on top of maps
          drawSmokeTunnel(x2, transW);
          drawSmokeTunnel(x4, transW);
          drawSmokeTunnel(x6, transW);
          drawSmokeTunnel(x8, transW);
        } else {
          // Fallback color
          ctx!.fillStyle = style.skyFallback;
          ctx!.fillRect(0, 0, w, h);
        }
      } else {
        const currentBg = currentBgRef.current;
        const targetBg = targetBgRef.current;

        if (currentBg) {
          drawBgImage(currentBg, w, h, offset);
        } else {
          // Fallback color
          ctx!.fillStyle = style.skyFallback;
          ctx!.fillRect(0, 0, w, h);
        }

        // Draw cross-fade blend
        if (targetBg && targetBg !== currentBg && bgFadeOpacityRef.current > 0) {
          ctx!.globalAlpha = bgFadeOpacityRef.current;
          drawBgImage(targetBg, w, h, offset);
          ctx!.globalAlpha = 1.0;
        }
      }

      ctx!.restore();
    }

    function drawFarShops(w: number, h: number, offset: number) {
      return;
    }

    function drawMidShops(w: number, h: number, offset: number) {
      return;
    }

    function drawGround(w: number, h: number, offset: number) {
      const groundY = h * 0.8;
      const style = getBlendedMapStyle();

      // ---------- Grass gradient ----------
      const grassGrad = ctx!.createLinearGradient(0, groundY, 0, h);
      grassGrad.addColorStop(0, style.grassColors[0]);
      grassGrad.addColorStop(0.4, style.grassColors[1]);
      grassGrad.addColorStop(1, style.grassColors[2]);

      ctx!.fillStyle = grassGrad;
      ctx!.fillRect(0, groundY, w, h - groundY);

      // Dark shadow at horizon
      const shadowGrad = ctx!.createLinearGradient(
        0,
        groundY,
        0,
        groundY + 50
      );
      shadowGrad.addColorStop(0, "rgba(0,0,0,0.35)");
      shadowGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx!.fillStyle = shadowGrad;
      ctx!.fillRect(0, groundY, w, 60);

      // ---------- Dirt path ----------
      const pathY = groundY + (h - groundY) * 0.33;

      ctx!.beginPath();
      ctx!.moveTo(0, pathY);

      ctx!.quadraticCurveTo(
        w * 0.25,
        pathY - 8,
        w * 0.5,
        pathY + 6
      );

      ctx!.quadraticCurveTo(
        w * 0.75,
        pathY + 18,
        w,
        pathY + 5
      );

      ctx!.lineTo(w, h);
      ctx!.lineTo(0, h);
      ctx!.closePath();

      const dirtGrad = ctx!.createLinearGradient(0, pathY, 0, h);
      dirtGrad.addColorStop(0, style.dirtColors[0]);
      dirtGrad.addColorStop(0.6, style.dirtColors[1]);
      dirtGrad.addColorStop(1, style.dirtColors[2]);

      ctx!.fillStyle = dirtGrad;
      ctx!.fill();

      // ---------- Moving texture ----------
      ctx!.strokeStyle = style.pathLines;
      ctx!.lineWidth = 2;

      const spacing = 130;
      const count = Math.ceil(w / spacing) + 2;

      for (let i = -1; i < count; i++) {
        const x =
          ((i * spacing - (offset % spacing)) + w) %
            (w + spacing) -
          spacing / 2;

        ctx!.beginPath();
        ctx!.moveTo(x, pathY + 4);
        ctx!.lineTo(x + 18, h);
        ctx!.stroke();
      }

      // ---------- Grass blades ----------
      ctx!.strokeStyle = style.bladeColor;
      ctx!.lineWidth = 1;

      const bladeSpacing = 55;

      for (let i = -1; i < w / bladeSpacing + 2; i++) {
        const x =
          ((i * bladeSpacing - (offset * 0.45 % bladeSpacing)) + w) %
          (w + bladeSpacing);

        const height = 5 + (i % 4);

        ctx!.beginPath();
        ctx!.moveTo(x, groundY + 1);
        ctx!.lineTo(x - 1, groundY - height);
        ctx!.stroke();
      }
    }

    function drawDust(w: number, h: number) {
      const style = getBlendedMapStyle();

      for (const d of heroDustRef.current) {
        const remaining = Math.max(d.life, 0);
        ctx!.globalAlpha = remaining * d.opacity;
        ctx!.fillStyle = style.dustColor;
        ctx!.beginPath();
        ctx!.ellipse(d.x, d.y, d.size * remaining * 0.9, d.size * remaining * 0.5, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "rgba(255,255,255,0.18)";
        ctx!.beginPath();
        ctx!.ellipse(d.x + d.size * 0.18, d.y - d.size * 0.1, d.size * remaining * 0.24, d.size * remaining * 0.12, 0, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function drawActorShadow(x: number, groundY: number, scale: number, jumpHeight = 0) {
      const drawH = 160 * scale;
      const drawW = drawH * 0.65;
      
      // Fade and shrink shadow based on jump height
      const factor = Math.max(0.18, 1 - jumpHeight / 280);
      ctx!.globalAlpha = 0.28 * factor;
      ctx!.fillStyle = "#1a1a14";
      ctx!.beginPath();
      ctx!.ellipse(x, groundY + 2, drawW * 0.32 * factor, 7 * scale * factor, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalAlpha = 1;
    }

    function drawObstacles(w: number, h: number) {
      const activeObstacles = activeObstaclesRef.current;
      const groundY = h * 0.8;
      for (const obs of activeObstacles) {
        ctx!.save();

        if (obs.spriteUrl) {
          const img = preloadedImagesRef.current[obs.spriteUrl];
          if (img && img.complete) {
            // Draw ground shadow
            ctx!.globalAlpha = 0.22;
            ctx!.fillStyle = "#000000";
            ctx!.beginPath();
            ctx!.ellipse(obs.x, obs.y + 13, obs.width * 0.45, 6, 0, 0, Math.PI * 2);
            ctx!.fill();
            ctx!.globalAlpha = 1.0;

            ctx!.drawImage(img, obs.x - obs.width / 2, obs.y - obs.height + 12, obs.width, obs.height);
          } else {
            // Fallback block if image is not preloaded yet
            ctx!.fillStyle = "#475569";
            ctx!.fillRect(obs.x - obs.width / 2, obs.y - obs.height, obs.width, obs.height);
          }
          ctx!.restore();
          continue;
        }
        
        if (obs.type === "rock") {
          // Draw a polished stone rock
          const rockGrad = ctx!.createLinearGradient(obs.x - obs.width/2, obs.y - obs.height, obs.x + obs.width/2, obs.y);
          rockGrad.addColorStop(0, "#9ca3af"); // highlighted top-left
          rockGrad.addColorStop(0.5, "#6b7280");
          rockGrad.addColorStop(1, "#374151"); // shadowed bottom-right
          ctx!.fillStyle = rockGrad;
          ctx!.strokeStyle = "#1f2937";
          ctx!.lineWidth = 2;
          
          // Draw rock geometry with multiple shaded facets
          ctx!.beginPath();
          ctx!.moveTo(obs.x - obs.width / 2, obs.y);
          ctx!.lineTo(obs.x - obs.width * 0.4, obs.y - obs.height * 0.6);
          ctx!.lineTo(obs.x - obs.width * 0.15, obs.y - obs.height * 0.95);
          ctx!.lineTo(obs.x + obs.width * 0.2, obs.y - obs.height);
          ctx!.lineTo(obs.x + obs.width * 0.45, obs.y - obs.height * 0.5);
          ctx!.lineTo(obs.x + obs.width / 2, obs.y);
          ctx!.closePath();
          ctx!.fill();
          ctx!.stroke();

          // Draw interior shadow facets to give it a 3D gemstone/low-poly look
          ctx!.fillStyle = "rgba(0, 0, 0, 0.15)";
          ctx!.beginPath();
          ctx!.moveTo(obs.x - obs.width * 0.15, obs.y - obs.height * 0.95);
          ctx!.lineTo(obs.x + obs.width * 0.2, obs.y - obs.height);
          ctx!.lineTo(obs.x + obs.width * 0.1, obs.y);
          ctx!.lineTo(obs.x - obs.width * 0.1, obs.y);
          ctx!.closePath();
          ctx!.fill();

          ctx!.fillStyle = "rgba(255, 255, 255, 0.2)";
          ctx!.beginPath();
          ctx!.moveTo(obs.x - obs.width / 2, obs.y);
          ctx!.lineTo(obs.x - obs.width * 0.4, obs.y - obs.height * 0.6);
          ctx!.lineTo(obs.x - obs.width * 0.1, obs.y);
          ctx!.closePath();
          ctx!.fill();

          // Draw crack lines
          ctx!.strokeStyle = "rgba(31, 41, 55, 0.4)";
          ctx!.lineWidth = 1.5;
          ctx!.beginPath();
          ctx!.moveTo(obs.x - obs.width * 0.15, obs.y - obs.height * 0.95);
          ctx!.lineTo(obs.x - obs.width * 0.05, obs.y - obs.height * 0.5);
          ctx!.lineTo(obs.x - obs.width * 0.2, obs.y - obs.height * 0.3);
          ctx!.stroke();
        } else if (obs.type === "fence") {
          // Draw a rustic detailed wooden fence
          const woodDark = "#451a03";
          const woodMedium = "#78350f";
          const woodLight = "#b45309";
          
          // Draw two thick posts with grain and beveling
          const postWidth = obs.width * 0.15;
          const postOffsets = [-obs.width * 0.35, obs.width * 0.35];
          
          postOffsets.forEach(offset => {
            const px = obs.x + offset;
            // Post gradient
            const postGrad = ctx!.createLinearGradient(px - postWidth, obs.y - obs.height, px + postWidth, obs.y);
            postGrad.addColorStop(0, woodLight);
            postGrad.addColorStop(0.5, woodMedium);
            postGrad.addColorStop(1, woodDark);
            
            ctx!.fillStyle = postGrad;
            ctx!.strokeStyle = "#270e00";
            ctx!.lineWidth = 2;
            ctx!.beginPath();
            ctx!.rect(px - postWidth/2, obs.y - obs.height, postWidth, obs.height);
            ctx!.fill();
            ctx!.stroke();
            
            // Post cap (pointed top)
            ctx!.fillStyle = woodLight;
            ctx!.beginPath();
            ctx!.moveTo(px - postWidth/2, obs.y - obs.height);
            ctx!.lineTo(px, obs.y - obs.height - 8);
            ctx!.lineTo(px + postWidth/2, obs.y - obs.height);
            ctx!.closePath();
            ctx!.fill();
            ctx!.stroke();
          });
          
          // Draw two horizontal planks with wood grain textures
          const plankHeight = obs.height * 0.2;
          const plankYOffsets = [obs.y - obs.height * 0.75, obs.y - obs.height * 0.35];
          
          plankYOffsets.forEach(py => {
            const plankGrad = ctx!.createLinearGradient(obs.x - obs.width/2, py - plankHeight/2, obs.x + obs.width/2, py + plankHeight/2);
            plankGrad.addColorStop(0, woodLight);
            plankGrad.addColorStop(0.7, woodMedium);
            plankGrad.addColorStop(1, woodDark);
            
            ctx!.fillStyle = plankGrad;
            ctx!.strokeStyle = "#270e00";
            ctx!.lineWidth = 2;
            ctx!.beginPath();
            ctx!.rect(obs.x - obs.width/2, py - plankHeight/2, obs.width, plankHeight);
            ctx!.fill();
            ctx!.stroke();
            
            // Wood grain lines
            ctx!.strokeStyle = "rgba(0, 0, 0, 0.18)";
            ctx!.lineWidth = 1.5;
            ctx!.beginPath();
            ctx!.moveTo(obs.x - obs.width/2 + 5, py - 2);
            ctx!.lineTo(obs.x + obs.width/2 - 5, py - 2);
            ctx!.moveTo(obs.x - obs.width/2 + 10, py + 3);
            ctx!.lineTo(obs.x + obs.width/2 - 10, py + 3);
            ctx!.stroke();
            
            // Nail details
            postOffsets.forEach(offset => {
              ctx!.fillStyle = "#9ca3af"; // silver nail heads
              ctx!.beginPath();
              ctx!.arc(obs.x + offset, py - 2, 2.5, 0, Math.PI * 2);
              ctx!.arc(obs.x + offset, py + 2, 2.5, 0, Math.PI * 2);
              ctx!.fill();
            });
          });
        } else if (obs.type === "spike") {
          // Draw pointed steel spikes with shiny highlights and a blood-tipped danger look
          const spikeCount = 4;
          const spikeWidth = obs.width / spikeCount;
          
          for (let k = 0; k < spikeCount; k++) {
            const sx = obs.x - obs.width / 2 + k * spikeWidth + spikeWidth / 2;
            const syBottom = obs.y;
            const syTop = obs.y - obs.height;
            
            // Gradient for metallic look
            const spikeGrad = ctx!.createLinearGradient(sx - spikeWidth/2, syBottom, sx + spikeWidth/2, syBottom);
            spikeGrad.addColorStop(0, "#475569"); // Slate grey
            spikeGrad.addColorStop(0.3, "#94a3b8"); // Light highlight
            spikeGrad.addColorStop(0.7, "#64748b"); // Medium
            spikeGrad.addColorStop(1, "#1e293b"); // Dark edge
            
            ctx!.fillStyle = spikeGrad;
            ctx!.strokeStyle = "#0f172a";
            ctx!.lineWidth = 1.5;
            ctx!.beginPath();
            ctx!.moveTo(sx - spikeWidth / 2, syBottom);
            ctx!.lineTo(sx, syTop);
            ctx!.lineTo(sx + spikeWidth / 2, syBottom);
            ctx!.closePath();
            ctx!.fill();
            ctx!.stroke();
            
            // Shiny metallic edge highlight
            ctx!.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(sx - spikeWidth / 4, syBottom);
            ctx!.lineTo(sx, syTop);
            ctx!.stroke();

            // Crimson blood-stained tip
            const bloodGrad = ctx!.createLinearGradient(sx - spikeWidth/4, syTop + obs.height * 0.3, sx + spikeWidth/4, syTop);
            bloodGrad.addColorStop(0, "rgba(153, 27, 27, 0)"); // Fading out
            bloodGrad.addColorStop(1, "rgba(185, 28, 28, 0.95)"); // Solid crimson tip
            ctx!.fillStyle = bloodGrad;
            ctx!.beginPath();
            ctx!.moveTo(sx - spikeWidth * 0.15, syTop + obs.height * 0.3);
            ctx!.lineTo(sx, syTop);
            ctx!.lineTo(sx + spikeWidth * 0.15, syTop + obs.height * 0.3);
            ctx!.closePath();
            ctx!.fill();
          }
        } else if (obs.type === "archer") {
          ctx!.save();
          
          // Draw ground shadow (only if not flying high)
          if (!obs.isFlying) {
            ctx!.globalAlpha = 0.25;
            ctx!.fillStyle = "#000000";
            ctx!.beginPath();
            ctx!.ellipse(obs.x, obs.y + 2, obs.width * 0.6, 5, 0, 0, Math.PI * 2);
            ctx!.fill();
            ctx!.globalAlpha = 1.0;
          }

          const archerImg = archerImgRef.current;
          if (archerImg && archerImg.complete) {
            if (obs.isFlying) {
              ctx!.translate(obs.x, obs.y);
              ctx!.rotate(obs.rot || 0);
              const drawW = 135;
              const drawH = 210;
              // Center the rotation pivot around the archer middle
              ctx!.drawImage(archerImg, -drawW / 2, -drawH / 2, drawW, drawH);
            } else {
              ctx!.translate(obs.x, obs.y);
              const drawW = 135;
              const drawH = 210;
              ctx!.drawImage(archerImg, -drawW / 2, -drawH, drawW, drawH);
            }
          } else {
            // Fallback drawing if image not loaded yet
            ctx!.fillStyle = "#ef4444";
            ctx!.fillRect(obs.x - obs.width / 2, obs.y - obs.height, obs.width, obs.height);
          }
          ctx!.restore();
        } else if (obs.type === "arrow") {
          // Draw a swift flying arrow with motion trails
          ctx!.save();
          ctx!.translate(obs.x, obs.y);

          // Draw wind motion trail particles behind the arrow
          ctx!.strokeStyle = "rgba(226, 232, 240, 0.3)";
          ctx!.lineWidth = 2.5;
          ctx!.beginPath();
          ctx!.moveTo(obs.width / 2 + 10, 0);
          ctx!.lineTo(obs.width / 2 + 45, 0);
          ctx!.moveTo(obs.width / 2 + 15, -4);
          ctx!.lineTo(obs.width / 2 + 35, -4);
          ctx!.moveTo(obs.width / 2 + 15, 4);
          ctx!.lineTo(obs.width / 2 + 35, 4);
          ctx!.stroke();

          // Arrow shaft
          ctx!.strokeStyle = "#d97706"; // Wood shaft
          ctx!.lineWidth = 4;
          ctx!.beginPath();
          ctx!.moveTo(-obs.width / 2, 0);
          ctx!.lineTo(obs.width / 2, 0);
          ctx!.stroke();

          // Steel Arrow Tip (pointing left)
          ctx!.fillStyle = "#94a3b8"; // Slate steel
          ctx!.strokeStyle = "#475569";
          ctx!.lineWidth = 2.0;
          ctx!.beginPath();
          ctx!.moveTo(-obs.width / 2 - 8, 0);
          ctx!.lineTo(-obs.width / 2 + 10, -7);
          ctx!.lineTo(-obs.width / 2 + 10, 7);
          ctx!.closePath();
          ctx!.fill();
          ctx!.stroke();

          // Red Fletching feathers (feathers at back of arrow on the right)
          ctx!.fillStyle = "#ef4444"; // Red feathers
          ctx!.beginPath();
          ctx!.moveTo(obs.width / 2, 0);
          ctx!.lineTo(obs.width / 2 + 10, -8);
          ctx!.lineTo(obs.width / 2 - 4, 0);
          ctx!.lineTo(obs.width / 2 + 10, 8);
          ctx!.closePath();
          ctx!.fill();

          ctx!.restore();
        }
        ctx!.restore();
      }
    }

    function drawBloodStains(w: number, h: number) {
      // Disabled as requested
    }

    function updateSpritePosition(
      img: HTMLImageElement | null,
      x: number,
      groundY: number,
      drawH: number,
      runPhase: number,
      visible: boolean,
      frames: string[],
      animate: boolean,
      verticalShift: number,
      restedFrame?: string,
      frameScale = 1,
      isSliding = false
    ) {
      if (!img) return;
      
      if (img === heroNodeRef.current) {
        if (armourTimerRef.current > 0) {
          img.style.filter = "drop-shadow(0 0 12px rgba(0, 191, 255, 0.95)) drop-shadow(0 0 4px rgba(255, 255, 255, 0.8))";
        } else if (magnetTimerRef.current > 0) {
          img.style.filter = "drop-shadow(0 0 12px rgba(225, 95, 202, 0.95)) drop-shadow(0 0 4px rgba(255, 255, 255, 0.8))";
        } else {
          img.style.filter = "none";
        }
      }
      const bob = animate ? Math.sin(runPhase) * 4 : 0;
      const footOffset = 24;
      const isRestingFrame = !!restedFrame && (restedFrame.includes("standing") || restedFrame.includes("tired"));
      const restingVerticalOffset = isRestingFrame ? -8 : 0;
      const currentFrame = img.getAttribute("data-frame");
      const nextFrame = animate
        ? frames[Math.floor((frameTimerRef.current / frameDelayMs) % frames.length)]
        : restedFrame ||
          (currentFrame && frames.includes(currentFrame)
            ? currentFrame
            : frames[0]);
      if (img.getAttribute("data-frame") !== nextFrame) {
        img.setAttribute("data-frame", nextFrame);
        img.src = nextFrame;
      }
      img.style.left = `${x}px`;
      img.style.height = `${drawH}px`;
      
      let finalTop = groundY - drawH + footOffset + bob + verticalShift + restingVerticalOffset;
      if (isSliding) {
        // Shift down dynamically to align the scaled-down sliding character with the ground
        finalTop += (drawH * (1 - frameScale)) / 2 - 25;
      }
      img.style.top = `${finalTop}px`;
      img.style.visibility = visible ? "visible" : "hidden";
      
      if (isSliding) {
        img.style.transform = `translateX(-50%) scale(${frameScale})`;
      } else {
        img.style.transform = `translateX(-50%) scale(${frameScale})`;
      }
    }

    function spawnCoinGroup(w: number, groundY: number) {
      const isArc = Math.random() < 0.55;
      const baseAir = Math.random() < 0.4;
      
      if (isArc) {
        // Spawn 5 coins in a parabolic jump arc matching the hero jump height curve (all require jumping)
        for (let i = 0; i < 5; i++) {
          const coinX = w + 50 + i * 70;
          const peakOffset = [0, 35, 70, 35, 0][i];
          const coinY = groundY - 190 - peakOffset;
          
          activePowerUpsRef.current.push({
            x: coinX,
            y: coinY,
            radius: 20,
            pulsePhase: Math.random() * Math.PI,
            collected: false,
          });
        }
      } else {
        // Spawn a horizontal line of 4 coins (all require jumping: lower line or upper line)
        const coinY = baseAir ? groundY - 220 : groundY - 70;
        for (let i = 0; i < 4; i++) {
          const coinX = w + 50 + i * 70;
          activePowerUpsRef.current.push({
            x: coinX,
            y: coinY,
            radius: 20,
            pulsePhase: Math.random() * Math.PI,
            collected: false,
          });
        }
      }
    }

    function loop(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      frameTimerRef.current += dt * 1000;
      starTimeRef.current += dt * 1.5;
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;

      const heroDrawH = 210;
      const villainDrawH = 300;

      const phaseNow = phaseRef.current;
      let hasMovement = false;
      const groundY = h * 0.8;
      const heroX = w * 0.34;
      const gapPx = (gapRef.current / GAP_MAX) * w * 0.26 + 26;
      const villainX = asuraJumpedToHeroRef.current
        ? heroX
        : (phaseNow === "caught" ? heroX - 30 : heroX - gapPx);

      if (phaseNow === "running") {
        // --- Journey background progression ---
        const score = scoreRef.current;
        const thresholds = [0, 150, 350, 600, 900];
        const stages = ["standard", "bg2night", "bg3", "bg_sumato", "khanaparaday"] as const;
        let targetStage = 0;
        for (let s = thresholds.length - 1; s >= 0; s--) {
          if (score >= thresholds[s]) { targetStage = s; break; }
        }
        // Trigger portal smoke transition when a new stage is reached
        if (targetStage > journeyStageRef.current && portalStateRef.current === "none" && pendingNextStageRef.current === -1) {
          portalStateRef.current = "in";
          portalProgressRef.current = 0;
          pendingNextStageRef.current = targetStage;
        }

        // Advance portal smoke animation
        if (portalStateRef.current === "in") {
          portalProgressRef.current = Math.min(1, portalProgressRef.current + dt * 1.8); // ~0.55s to full
          if (portalProgressRef.current >= 1) {
            // Swap to new stage at smoke peak
            const nextStage = pendingNextStageRef.current;
            journeyStageRef.current = nextStage;
            pendingNextStageRef.current = -1;
            if (nextStage < stages.length - 1) {
              currentWeatherRef.current = stages[nextStage];
            } else {
              currentWeatherRef.current = Math.random() < 0.4 ? "khanaparaovercast" : "khanaparaday";
            }
            weatherTimerRef.current = 0;
            weatherDurationRef.current = 0;
            // Instantly swap BG image (smoke covers the swap)
            const newImg = preloadedImagesRef.current[currentWeatherRef.current] || null;
            if (newImg) {
              currentBgRef.current = newImg;
              targetBgRef.current = newImg;
              bgImgRef.current = newImg;
              bgFadeOpacityRef.current = 0;
            }
            portalStateRef.current = "out";
          }
        } else if (portalStateRef.current === "out") {
          portalProgressRef.current = Math.max(0, portalProgressRef.current - dt * 1.2); // ~0.83s to clear
          if (portalProgressRef.current <= 0) {
            portalStateRef.current = "none";
          }
        }

        let selectedImg: HTMLImageElement | null = null;
        const currentStage = journeyStageRef.current;
        const isKhanaparaStage = currentStage === 4;
        const isBg1Stage = currentStage === 0;

        if (isKhanaparaStage) {
          // Khanapara: day/overcast weather cycles with rain
          if (weatherDurationRef.current === 0) {
            weatherDurationRef.current = 20 + Math.random() * 25;
            weatherTimerRef.current = 0;
          }
          weatherTimerRef.current += dt;
          if (weatherTimerRef.current >= weatherDurationRef.current && !weatherStoppingRef.current) {
            const current = currentWeatherRef.current;
            if (current === "khanaparaovercast") {
              weatherStoppingRef.current = true;
            } else {
              currentWeatherRef.current = Math.random() < 0.4 ? "khanaparaovercast" : "khanaparaday";
              weatherTimerRef.current = 0;
              weatherDurationRef.current = 20 + Math.random() * 25;
            }
          }
          if (weatherStoppingRef.current) {
            precipitationStrengthRef.current -= dt / 1.5;
            if (precipitationStrengthRef.current <= 0) {
              precipitationStrengthRef.current = 1.0;
              weatherStoppingRef.current = false;
              currentWeatherRef.current = Math.random() < 0.35 ? "khanaparaovercast" : "khanaparaday";
              weatherTimerRef.current = 0;
              weatherDurationRef.current = 20 + Math.random() * 25;
            }
          }
          selectedImg = preloadedImagesRef.current[currentWeatherRef.current] || preloadedImagesRef.current["khanaparaday"] || null;
        } else if (isBg1Stage) {
          // BG1: weather cycles standard/overcast/fog with rain on overcast
          if (weatherDurationRef.current === 0) {
            weatherDurationRef.current = 15 + Math.random() * 20;
            weatherTimerRef.current = 0;
          }
          weatherTimerRef.current += dt;
          if (weatherTimerRef.current >= weatherDurationRef.current && !weatherStoppingRef.current) {
            const current = currentWeatherRef.current;
            if (current === "overcast") {
              weatherStoppingRef.current = true;
            } else {
              const opts = ["standard", "overcast", "fog"].filter(o => o !== current);
              currentWeatherRef.current = opts[Math.floor(Math.random() * opts.length)];
              weatherTimerRef.current = 0;
              weatherDurationRef.current = 15 + Math.random() * 20;
            }
          }
          if (weatherStoppingRef.current) {
            precipitationStrengthRef.current -= dt / 1.5;
            if (precipitationStrengthRef.current <= 0) {
              precipitationStrengthRef.current = 1.0;
              weatherStoppingRef.current = false;
              const opts = ["standard", "overcast", "fog"].filter(o => o !== currentWeatherRef.current);
              currentWeatherRef.current = opts[Math.floor(Math.random() * opts.length)];
              weatherTimerRef.current = 0;
              weatherDurationRef.current = 15 + Math.random() * 20;
            }
          }
          selectedImg = preloadedImagesRef.current[currentWeatherRef.current] || preloadedImagesRef.current["standard"] || null;
        } else {
          // Fixed stages: bg2night, bg3, bg_sumato — no mid-stage weather change
          selectedImg = preloadedImagesRef.current[stages[currentStage]] || null;
        }

        // Apply selected image (only weather crossfades within a zone, no mid-zone BG swaps during portal)
        if (selectedImg && portalStateRef.current === "none") {
          if (!currentBgRef.current) {
            currentBgRef.current = selectedImg;
            targetBgRef.current = selectedImg;
            bgFadeOpacityRef.current = 0;
            bgImgRef.current = selectedImg;
          } else if (selectedImg !== targetBgRef.current) {
            targetBgRef.current = selectedImg;
            bgFadeOpacityRef.current = 0;
          }
        }

        // Advance weather crossfade (only within same zone)
        if (targetBgRef.current && targetBgRef.current !== currentBgRef.current && portalStateRef.current === "none") {
          bgFadeOpacityRef.current += dt * 0.5;
          if (bgFadeOpacityRef.current >= 1.0) {
            currentBgRef.current = targetBgRef.current;
            bgImgRef.current = targetBgRef.current;
            bgFadeOpacityRef.current = 0;
          }
        }

        difficultyRef.current += dt * 0.012;

        let throttle = 0;
        if (control === "keyboard_classic") {
          throttle = 1;
        } else {
          throttle = bleConnectedRef.current
            ? Math.max(0, Math.min(1, bleVelocityRef.current / BLE_MAX_SPEED_KMH))
            : holdingRef.current
            ? 1
            : 0;
        }

        hasMovement = throttle > 0.01;
        const speedFactor = hasMovement ? 0.9 + throttle * 0.7 : 0;

        if (previousThrottleRef.current > 0.01 && throttle <= 0.01) {
          heroTiredRef.current = true;
        }
        if (throttle > 0.01) {
          heroTiredRef.current = false;
        }
        previousThrottleRef.current = throttle;

        // --- Hero jump / slide physics (both keyboard and treadmill) ---
        // Apply gravity to hero jump
        if (heroYOffsetRef.current > 0 || heroYVelocityRef.current > 0) {
          heroYOffsetRef.current += heroYVelocityRef.current * dt;
          heroYVelocityRef.current -= 1000 * dt; // gravity
          if (heroYOffsetRef.current <= 0) {
            heroYOffsetRef.current = 0;
            heroYVelocityRef.current = 0;
          }
        }

        // Update sliding timer
        if (heroIsSlidingRef.current) {
          slideTimerRef.current -= dt;
          if (slideTimerRef.current <= 0) {
            heroIsSlidingRef.current = false;
          }
        }

        if (control === "keyboard_classic") {
          // Keyboard-specific: no extra action processing here — handled by keydown listener
        } else {
          // Treadmill: consume the BLE button action queued by processIncomingTelemetry
          const pendingAction = bleActionRef.current;
          if (pendingAction !== "none") {
            bleActionRef.current = "none"; // consume
            if (pendingAction === "jump") {
              if (heroYOffsetRef.current === 0 && heroYVelocityRef.current === 0 && !heroIsSlidingRef.current) {
                heroYVelocityRef.current = 550;
                heroYOffsetRef.current = 1;
              }
            } else if (pendingAction === "slide") {
              if (heroYOffsetRef.current > 0) {
                // Fast-fall when in the air
                heroYVelocityRef.current = Math.min(heroYVelocityRef.current, -600);
              } else {
                heroIsSlidingRef.current = true;
                slideTimerRef.current = 1.0;
              }
            }
          }
        }

        // --- Obstacle / Coin / Powerup Spawning (both keyboard and treadmill) ---
        // Gate: keyboard needs ArrowRight held; treadmill needs the user to be running
        const isActivelyRunning = hasMovement;
        if (isActivelyRunning) {
          obstacleTimerRef.current += dt;
          const spawnInterval = Math.max(1.8, 3.2 - (difficultyRef.current - 1.0) * 0.4);
          const coinsNearSpawn = activePowerUpsRef.current.some((p) => p.x > w - 650);
          if (obstacleTimerRef.current >= spawnInterval && !coinsNearSpawn) {
            obstacleTimerRef.current = 0;
            const types: Array<"rock" | "fence" | "spike" | "arrow"> =
              modeRef.current === "easy"
                ? ["rock", "fence", "spike"]
                : ["rock", "fence", "spike", "arrow"];
            const selectedType = types[Math.floor(Math.random() * types.length)];
            let width = 60;
            let height = 65;
            if (selectedType === "fence") {
              width = 68;
              height = 75;
            } else if (selectedType === "spike") {
              width = 82;
              height = 48;
            }

            if (selectedType === "arrow") {
              // Spawn both an archer on the ground and an arrow at head level
              activeObstaclesRef.current.push({
                x: w + 150,
                y: groundY,
                width: 80,
                height: 180,
                type: "archer",
                passed: false,
              });
              activeObstaclesRef.current.push({
                x: w + 80,
                y: groundY - 80,
                width: 65,
                height: 24,
                type: "arrow",
                passed: false,
              });
            } else {
              const spriteData = obstacleSpriteData[Math.floor(Math.random() * obstacleSpriteData.length)];
              let wObs = spriteData.w;
              let hObs = spriteData.h;
              if (modeRef.current === "easy") {
                wObs = Math.round(wObs * 0.65);
                hObs = Math.round(hObs * 0.65);
              }
              activeObstaclesRef.current.push({
                x: w + 50,
                y: groundY,
                width: wObs,
                height: hObs,
                type: selectedType,
                passed: false,
                spriteUrl: spriteData.src,
              });
            }
          }

          // Spawn coins periodically only when running
          coinTimerRef.current += dt;
          const coinInterval = Math.max(2.2, 4.0 - (difficultyRef.current - 1.0) * 0.5);
          const obstaclesNearSpawn = activeObstaclesRef.current.some((o) => o.x > w - 650);
          if (coinTimerRef.current >= coinInterval && !obstaclesNearSpawn) {
            coinTimerRef.current = 0;
            spawnCoinGroup(w, groundY);
          }

          // Spawn armour powerups periodically (less frequent)
          armourSpawnTimerRef.current += dt;
          const armourInterval = 35.0;
          if (armourSpawnTimerRef.current >= armourInterval && !obstaclesNearSpawn) {
            armourSpawnTimerRef.current = 0;
            const hasArmourInMap = activePowerUpsRef.current.some((p) => p.type === "armour");
            if (!hasArmourInMap) {
              const armourX = w + 50;
              const armourY = Math.random() < 0.5 ? groundY - 70 : groundY - 220;
              activePowerUpsRef.current.push({
                x: armourX,
                y: armourY,
                radius: 38,
                pulsePhase: Math.random() * Math.PI,
                collected: false,
                type: "armour",
              });
            }
          }

          // Spawn magnet powerups periodically
          magnetSpawnTimerRef.current += dt;
          const magnetInterval = 26.0;
          if (magnetSpawnTimerRef.current >= magnetInterval && !obstaclesNearSpawn) {
            magnetSpawnTimerRef.current = 0;
            const hasMagnetInMap = activePowerUpsRef.current.some((p) => p.type === "magnet");
            if (!hasMagnetInMap) {
              const magnetX = w + 50;
              const magnetY = Math.random() < 0.5 ? groundY - 70 : groundY - 220;
              activePowerUpsRef.current.push({
                x: magnetX,
                y: magnetY,
                radius: 38,
                pulsePhase: Math.random() * Math.PI,
                collected: false,
                type: "magnet",
              });
            }
          }
        }

        // Decrement Asura action timers
        if (asuraDashCooldownRef.current > 0) asuraDashCooldownRef.current -= dt;
        if (asuraJumpCooldownRef.current > 0) asuraJumpCooldownRef.current -= dt;

        // Decrement active armour timer
        if (armourTimerRef.current > 0) {
          armourTimerRef.current = Math.max(0, armourTimerRef.current - dt);
          setArmourTime(Math.ceil(armourTimerRef.current * 10) / 10);
        } else if (armourTime > 0) {
          setArmourTime(0);
        }

        // Decrement active magnet timer
        if (magnetTimerRef.current > 0) {
          magnetTimerRef.current = Math.max(0, magnetTimerRef.current - dt);
          setMagnetTime(Math.ceil(magnetTimerRef.current * 10) / 10);
        } else if (magnetTime > 0) {
          setMagnetTime(0);
        }

        // 1. Dash trigger (Normal and Hard mode)
        if (modeRef.current === "normal" || modeRef.current === "hard") {
          if (!asuraIsDashingRef.current && asuraDashCooldownRef.current <= 0) {
            // Random chance to dash (dt scaled)
            if (Math.random() < 0.28 * dt) {
              asuraIsDashingRef.current = true;
              asuraDashTimerRef.current = 1.2 + Math.random() * 0.8; // 1.2s - 2s
              asuraDashCooldownRef.current = 7 + Math.random() * 5; // 7s - 12s cooldown
            }
          }
        }

        if (asuraIsDashingRef.current) {
          asuraDashTimerRef.current -= dt;
          if (asuraDashTimerRef.current <= 0) {
            asuraIsDashingRef.current = false;
          }
        }

        // 2. Jump trigger (Hard mode only)
        if (modeRef.current === "hard") {
          if (!asuraIsJumpingRef.current && asuraJumpCooldownRef.current <= 0) {
            // Random chance to jump (dt scaled)
            if (Math.random() < 0.35 * dt) {
              asuraIsJumpingRef.current = true;
              asuraYVelocityRef.current = 630; // higher upward leap force!
              asuraJumpCooldownRef.current = 5 + Math.random() * 4; // 5s - 9s cooldown
            }
          }
        }

        // Villain jump over ground obstacles in all modes (triggered earlier to clear obstacle visually)
        if (!asuraIsJumpingRef.current && phaseNow === "running") {
          const incomingObstacle = activeObstaclesRef.current.find(
            (obs) =>
              (obs.type === "rock" || obs.type === "fence" || obs.type === "spike") &&
              obs.x > villainX + 80 &&
              obs.x < villainX + 220
          );
          if (incomingObstacle) {
            asuraIsJumpingRef.current = true;
            asuraYVelocityRef.current = 600; // slightly higher than hero's 550 force
          }
        }

        if (asuraIsJumpingRef.current) {
          asuraYOffsetRef.current += asuraYVelocityRef.current * dt;
          asuraYVelocityRef.current -= 1000 * dt; // matching hero's snappy gravity
          if (asuraYOffsetRef.current <= 0) {
            asuraYOffsetRef.current = 0;
            asuraYVelocityRef.current = 0;
            asuraIsJumpingRef.current = false;
            // Shake screen on landing
            shakeRef.current = 15;
            // heroSlowdownTimer removed — no penalty on villain jump
          }
        }

        let villainSpeedMultiplier = 1.0;
        if (modeRef.current === "easy") {
          villainSpeedMultiplier = 0.75;
        } else if (modeRef.current === "hard") {
          villainSpeedMultiplier = 1.4;
        }

        // Apply stronger physical speed boosts during action moves (Hard mode is now very challenging!)
        if (asuraIsDashingRef.current) {
          villainSpeedMultiplier += 1.0;
        }
        // No extra speed boost while villain is jumping — keeps the game fair

        if (!hasMovement && !isIdleCatchupRef.current) {
          idleTimerRef.current += dt;
        } else if (hasMovement) {
          idleTimerRef.current = 0;
        }

        let maxIdleTime = 6;
        if (modeRef.current === "easy") {
          maxIdleTime = 10;
        } else if (modeRef.current === "hard") {
          maxIdleTime = 4;
        }

        if (idleTimerRef.current >= maxIdleTime) {
          isIdleCatchupRef.current = true;
        }

        let drain = 0;
        if (isIdleCatchupRef.current) {
          drain = 500;
          asuraIsDashingRef.current = true; // force sprinting animation speed
        } else {
          const sprintGain = 26 * difficultyRef.current;
          const baseDrain = 16 * difficultyRef.current * villainSpeedMultiplier;
          drain =
            throttle > 0
              ? -sprintGain * throttle + baseDrain * 0.4
              : baseDrain;
        }


        if (hasMovement) {
          gapRef.current = Math.max(0, Math.min(GAP_MAX, gapRef.current - drain * dt));
          elapsedRef.current += dt;
          scoreRef.current = Math.floor(elapsedRef.current * 12 * difficultyRef.current) + scoreBonusRef.current;
        } else {
          const idleDrain = isIdleCatchupRef.current ? drain : idleApproachRate * villainSpeedMultiplier;
          gapRef.current = Math.max(0, gapRef.current - idleDrain * dt);
          scoreRef.current = Math.floor(elapsedRef.current * 12 * difficultyRef.current) + scoreBonusRef.current;
        }
        setScore(scoreRef.current);
        setGapDisplay(gapRef.current);

        let baseObstacleSpeed = 260;
        if (modeRef.current === "easy") {
          baseObstacleSpeed = 190;
        } else if (modeRef.current === "hard") {
          baseObstacleSpeed = 340;
        }
        let scoreSpeedMultiplier = 1.0 + (scoreRef.current / 1000) * 0.15;
        if (control === "keyboard_classic") {
          const distance = scoreRef.current * 0.2;
          const intervalsOf350m = Math.floor(distance / 350);
          scoreSpeedMultiplier *= (1.0 + intervalsOf350m * 0.12);
        }
        const currentSpeed = baseObstacleSpeed * scoreSpeedMultiplier * speedFactor;
        currentSpeedRef.current = currentSpeed;

        groundOffsetRef.current += currentSpeed * dt;
        treeOffsetRef.current += 0;
        farOffsetRef.current += 0;
        skyOffsetRef.current += 0;
        // Speed up animation cycle if villain is sprinting/dashing
        const animationSpeed = asuraIsDashingRef.current ? 22 : (hasMovement ? (control === "keyboard_classic" ? 11 : 8 + throttle * 6) * difficultyRef.current : 0);
        runCycleRef.current += dt * animationSpeed;

        // Obstacles updates & collisions
        if (control === "keyboard_classic" || control === "treadmill") {
          const activeObstacles = activeObstaclesRef.current;
          for (let i = activeObstacles.length - 1; i >= 0; i--) {
            const obs = activeObstacles[i];

            if (obs.isFlying) {
              if (obs.vy === undefined) obs.vy = -650;
              if (obs.vx === undefined) obs.vx = 450;
              if (obs.rot === undefined) obs.rot = 0;

              obs.vy += 850 * dt;
              obs.x += obs.vx * dt;
              obs.y += obs.vy * dt;
              obs.rot += 8 * dt;

              if (obs.x < -100 || obs.x > canvasWidth + 200 || obs.y > groundY + 250) {
                activeObstacles.splice(i, 1);
              }
              continue;
            }
            
            // Arrows fly faster towards the player (slower in normal, extremely fast in hard)
            if (obs.type === "arrow") {
              const arrowSpeedBoost = modeRef.current === "hard" ? 380 : 180;
              obs.x -= (currentSpeed + arrowSpeedBoost) * dt;
            } else {
              obs.x -= currentSpeed * dt;
            }

            // The archer itself does not collide with the player, only the arrows do!
            if (obs.type === "archer") {
              // Archer flew away trigger when hit by sliding hero
              if (heroIsSlidingRef.current && !obs.isFlying) {
                const heroLeft = heroX - 28;
                const heroRight = heroX + 28;
                const obsLeft = obs.x - obs.width / 2;
                const obsRight = obs.x + obs.width / 2;
                if (heroRight >= obsLeft && heroLeft <= obsRight) {
                  obs.isFlying = true;
                  obs.vx = 450;
                  obs.vy = -650;
                  obs.rot = 0;
                  playArcherScreamSfx();

                  // Spawn brown dirt impact particles
                  for (let j = 0; j < 8; j++) {
                    const angle = Math.random() * Math.PI * 2;
                    const sp = 60 + Math.random() * 85;
                    goldSparksRef.current.push({
                      x: obs.x,
                      y: groundY - 20,
                      vx: Math.cos(angle) * sp,
                      vy: Math.sin(angle) * sp - 20,
                      alpha: 1.0,
                      size: Math.random() * 3 + 1.5,
                      color: [210, 180, 140],
                    });
                  }
                }
              } else if (!obs.isFlying && !obs.passed) {
                // If not sliding, contact with archer triggers crash!
                const heroLeft = heroX - 28;
                const heroRight = heroX + 28;
                const collisionWidth = obs.width * 0.6;
                const collisionHeight = obs.height * 0.85;
                const obsLeft = obs.x - collisionWidth / 2;
                const obsRight = obs.x + collisionWidth / 2;
                
                const heroBottom = groundY - heroYOffsetRef.current;
                const heroTop = heroBottom - 90;
                const obsBottom = obs.y;
                const obsTop = obsBottom - collisionHeight;

                const xOverlap = heroRight >= obsLeft && heroLeft <= obsRight;
                const yOverlap = heroBottom >= obsTop && heroTop <= obsBottom;

                if (xOverlap && yOverlap) {
                  if (armourTimerRef.current > 0) {
                    obs.passed = true;
                    playShieldBlockSfx();

                    floatingTextsRef.current.push({
                      x: obs.x,
                      y: obs.y - 45,
                      text: "BLOCKED!",
                      alpha: 1.0,
                      vy: -60,
                    });

                    // Spawn blue deflected sparks
                    for (let j = 0; j < 12; j++) {
                      const angle = Math.random() * Math.PI * 2;
                      const sp = 85 + Math.random() * 115;
                      goldSparksRef.current.push({
                        x: obs.x,
                        y: obs.y - 20,
                        vx: Math.cos(angle) * sp,
                        vy: Math.sin(angle) * sp - 20,
                        alpha: 1.0,
                        size: Math.random() * 3 + 2,
                        color: [0, 220, 255],
                      });
                    }
                  } else {
                    // Obstacle hit -> lose instantly!
                    deathReasonRef.current = "archer";
                    setDeathReason("archer");
                    phaseRef.current = "caught";
                    setPhase("caught");
                    playPrinceScreamSfx();
                    saveHighScore(scoreRef.current);
                    saveLifetimeCoins(coinsCountRef.current);

                    floatingTextsRef.current.push({
                      x: heroX,
                      y: groundY - 140,
                      text: "CRASH!",
                      alpha: 1.0,
                      vy: -60,
                    });

                    // Red sparks
                    for (let j = 0; j < 16; j++) {
                      const angle = Math.random() * Math.PI * 2;
                      const sp = 90 + Math.random() * 110;
                      goldSparksRef.current.push({
                        x: heroX,
                        y: groundY - 30,
                        vx: Math.cos(angle) * sp,
                        vy: Math.sin(angle) * sp - 20,
                        alpha: 1.0,
                        size: Math.random() * 4 + 2.5,
                        color: [255, 60, 60],
                      });
                    }

                    if (audioRef.current) {
                      audioRef.current.pause();
                    }
                    break;
                  }
                }
              }

              if (obs.x < heroX && !obs.passed) {
                obs.passed = true;
              }
              if (obs.x < -100) {
                activeObstacles.splice(i, 1);
              }
              continue;
            }

            // Hero bounding check
            const heroLeft = heroX - (heroIsSlidingRef.current ? 28 : 22);
            const heroRight = heroX + (heroIsSlidingRef.current ? 28 : 22);
            const heroBottom = groundY - heroYOffsetRef.current;
            const heroHeight = heroIsSlidingRef.current ? 35 : 90;
            const heroTop = groundY - heroYOffsetRef.current - heroHeight;

            // Shrink obstacle collision box to avoid ghost hits on transparent edges
            const collisionWidth = obs.type === "arrow" ? obs.width : obs.width * 0.65;
            const collisionHeight = obs.type === "arrow" ? obs.height : obs.height * 0.85;
            const obsLeft = obs.x - collisionWidth / 2;
            const obsRight = obs.x + collisionWidth / 2;
            const obsBottom = obs.y;
            const obsTop = obs.y - collisionHeight;

            const xOverlap = heroRight >= obsLeft && heroLeft <= obsRight;
            const yOverlap = heroBottom >= obsTop && heroTop <= obsBottom;

            if (xOverlap && yOverlap) {
              if (armourTimerRef.current > 0) {
                obs.passed = true;
                playShieldBlockSfx();

                floatingTextsRef.current.push({
                  x: obs.x,
                  y: obs.y - 45,
                  text: "BLOCKED!",
                  alpha: 1.0,
                  vy: -60,
                });

                // Spawn blue deflected sparks
                for (let j = 0; j < 12; j++) {
                  const angle = Math.random() * Math.PI * 2;
                  const sp = 85 + Math.random() * 115;
                  goldSparksRef.current.push({
                    x: obs.x,
                    y: obs.y - 20,
                    vx: Math.cos(angle) * sp,
                    vy: Math.sin(angle) * sp - 20,
                    alpha: 1.0,
                    size: Math.random() * 3 + 2,
                    color: [0, 220, 255],
                  });
                }
              } else {
                // Obstacle hit -> lose instantly!
                if (obs.type === "arrow") {
                  deathReasonRef.current = "arrow";
                  setDeathReason("arrow");
                } else {
                  deathReasonRef.current = "obstacle";
                  setDeathReason("obstacle");
                }
                phaseRef.current = "caught";
                setPhase("caught");
                saveHighScore(scoreRef.current);
                saveLifetimeCoins(coinsCountRef.current);

                floatingTextsRef.current.push({
                  x: heroX,
                  y: groundY - 140,
                  text: "CRASH!",
                  alpha: 1.0,
                  vy: -60,
                });

                // Red stumble/crash sparks
                for (let j = 0; j < 16; j++) {
                  const angle = Math.random() * Math.PI * 2;
                  const sp = 90 + Math.random() * 110;
                  goldSparksRef.current.push({
                    x: heroX,
                    y: groundY - 30,
                    vx: Math.cos(angle) * sp,
                    vy: Math.sin(angle) * sp - 20,
                    alpha: 1.0,
                    size: Math.random() * 4 + 2.5,
                    color: [255, 60, 60],
                  });
                }

                if (audioRef.current) {
                  audioRef.current.pause();
                }
                break;
              }
            }

            // Check if passed successfully
            if (obs.x < heroX && !obs.passed) {
              obs.passed = true;
            }

            if (obs.x < -60) {
              activeObstacles.splice(i, 1);
            }
          }
        }

        // Hero running dust puffs commented out!
        /*
        if (throttle > 0.15) {
          const puffs = Math.random() < 0.4 ? 3 : 2;
          for (let i = 0; i < puffs; i++) {
            heroDustRef.current.push({
              x: heroX + (Math.random() - 0.5) * 32,
              y: groundY - 6 + Math.random() * 4,
              life: 1,
              size: 18 + Math.random() * 20,
              opacity: 0.6 + Math.random() * 0.25,
            });
          }
        }
        */
        for (const d of heroDustRef.current) d.life -= dt * 1.6;
        heroDustRef.current = heroDustRef.current.filter((d) => d.life > 0);

        // Old milestone powerups removed

        const activePowerUps = activePowerUpsRef.current;
        for (let i = activePowerUps.length - 1; i >= 0; i--) {
          const p = activePowerUps[i];
          
          // Skip ground level coin collection when sliding (unless magnet is active)
          if (heroIsSlidingRef.current && (!p.type || p.type === "coin") && p.y >= groundY - 100 && magnetTimerRef.current <= 0) {
            p.x -= currentSpeed * dt;
            p.pulsePhase += dt * 5;
            continue;
          }

          p.x -= currentSpeed * dt;
          p.pulsePhase += dt * 5;

          // Pull coin towards hero if magnet is active and coin is within threshold distance
          if (magnetTimerRef.current > 0 && (!p.type || p.type === "coin")) {
            const heroCenterY = groundY - heroYOffsetRef.current - 50;
            const dx = heroX - p.x;
            const dy = heroCenterY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 400) {
              if (dist > 5) {
                // Compensate for screen scrolling speed if coin is behind hero
                const scrollComp = (dx > 0) ? currentSpeed : 0;
                const pullSpeed = 500 + scrollComp;
                p.x += (dx / dist) * pullSpeed * dt;
                p.y += (dy / dist) * pullSpeed * dt;
              }
            }
          }

          // Bounding box collision checks supporting height checks for jump collection
          const heroCenterY = groundY - heroYOffsetRef.current - 50;
          const isColliding =
            Math.abs(p.x - heroX) < 52 &&
            Math.abs(p.y - heroCenterY) < 62;

          if (isColliding && !p.collected) {
            p.collected = true;
            if (p.type === "armour") {
              armourTimerRef.current = 15.0;
              setArmourTime(15.0);
              playShieldSfx();

              floatingTextsRef.current.push({
                x: p.x,
                y: p.y - 15,
                text: "SHIELD ACTIVE!",
                alpha: 1.0,
                vy: -70,
              });

              // Spawn blue/cyan collect particles
              for (let j = 0; j < 16; j++) {
                const angle = Math.random() * Math.PI * 2;
                const sp = 70 + Math.random() * 95;
                goldSparksRef.current.push({
                  x: p.x,
                  y: p.y,
                  vx: Math.cos(angle) * sp,
                  vy: Math.sin(angle) * sp - 25,
                  alpha: 1.0,
                  size: Math.random() * 3 + 2,
                  color: [0, 191, 255],
                });
              }
            } else if (p.type === "magnet") {
              magnetTimerRef.current = 10.0;
              setMagnetTime(10.0);
              playMagnetSfx();

              floatingTextsRef.current.push({
                x: p.x,
                y: p.y - 15,
                text: "MAGNET ACTIVE!",
                alpha: 1.0,
                vy: -70,
              });

              // Spawn magnet collect sparks (magenta/pink)
              for (let j = 0; j < 16; j++) {
                const angle = Math.random() * Math.PI * 2;
                const sp = 70 + Math.random() * 95;
                goldSparksRef.current.push({
                  x: p.x,
                  y: p.y,
                  vx: Math.cos(angle) * sp,
                  vy: Math.sin(angle) * sp - 25,
                  alpha: 1.0,
                  size: Math.random() * 3 + 2,
                  color: [225, 95, 202],
                });
              }
            } else {
              coinsCountRef.current += 1;
              setCoins(coinsCountRef.current);
              playCoinSfx();
              // Recover some gap distance
              gapRef.current = Math.min(GAP_MAX, gapRef.current + 1.2);
              setGapDisplay(gapRef.current);

              // Spawn floating text +1 ₹
              floatingTextsRef.current.push({
                x: p.x,
                y: p.y - 15,
                text: "+1 ₹",
                alpha: 1.0,
                vy: -70,
              });

              // Spawn golden collect particles
              for (let j = 0; j < 12; j++) {
                const angle = Math.random() * Math.PI * 2;
                const sp = 60 + Math.random() * 80;
                goldSparksRef.current.push({
                  x: p.x,
                  y: p.y,
                  vx: Math.cos(angle) * sp,
                  vy: Math.sin(angle) * sp - 30,
                  alpha: 1.0,
                  size: Math.random() * 2 + 1.5,
                });
              }
            }
          }

          if (p.x < -30 || p.collected) {
            activePowerUps.splice(i, 1);
          }
        }

        if (gapRef.current <= CATCH_GAP) {
          deathReasonRef.current = "asura";
          setDeathReason("asura");
          phaseRef.current = "caught";
          setPhase("caught");
          if (isIdleCatchupRef.current) {
            asuraJumpedToHeroRef.current = true;
          }
          isIdleCatchupRef.current = false;
          saveHighScore(scoreRef.current);
          saveLifetimeCoins(coinsCountRef.current);
        }
      } else if (phaseNow === "caught") {
        runCycleRef.current += dt * 10;
        groundOffsetRef.current += 40 * dt;
        treeOffsetRef.current += 14 * dt;
        shakeRef.current = Math.max(0, shakeRef.current - dt * 1.5);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        // Add blood stains on caught - Disabled as requested
      } else if (phaseNow === "paused") {
        runCycleRef.current += dt * 0.5;
        treeOffsetRef.current += 2 * dt;
        if (audioRef.current) {
          audioRef.current.pause();
        }
      } else {
        runCycleRef.current += dt * 4;
        treeOffsetRef.current += 10 * dt;
      }

      ctx!.save();
      // Apply screen shake if active (snappy exponential decay)
      if (shakeRef.current > 0.05) {
        const dx = (Math.random() - 0.5) * shakeRef.current;
        const dy = (Math.random() - 0.5) * shakeRef.current;
        ctx!.translate(dx, dy);
        shakeRef.current *= 0.88;
      } else {
        shakeRef.current = 0;
      }
 
      drawSky(w, h, 0);
      drawFarShops(w, h, 0);
      drawMidShops(w, h, 0);
      drawGround(w, h, groundOffsetRef.current);
      drawObstacles(w, h);
      drawDust(w, h);
      drawBloodStains(w, h);

      const heroVerticalShift = 8;
      const villainVerticalShift = 30;
      const villainScale = 1.35;

      drawActorShadow(villainX, groundY, 1.3, asuraYOffsetRef.current);
      drawActorShadow(heroX, groundY, 1, heroYOffsetRef.current);
      updateSpritePosition(
        villainNodeRef.current,
        villainX,
        groundY,
        villainDrawH,
        runCycleRef.current + 0.4,
        phaseNow === "running",
        villainFrames,
        true,
        villainVerticalShift - asuraYOffsetRef.current,
        undefined,
        villainScale,
        false
      );
      updateSpritePosition(
        heroNodeRef.current,
        heroX,
        groundY,
        heroDrawH,
        runCycleRef.current,
        phaseNow === "running",
        heroFrames,
        heroIsSlidingRef.current ? false : hasMovement,
        heroVerticalShift - heroYOffsetRef.current,
        heroIsSlidingRef.current ? heroSlidingFrame : (heroTiredRef.current ? tiredHeroFrame : heroStandingFrame),
        heroIsSlidingRef.current ? 0.60 : (heroTiredRef.current ? 0.92 : hasMovement ? 1.12 : 0.95),
        heroIsSlidingRef.current
      );

      // Update floating texts
      const floatingTexts = floatingTextsRef.current;
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const t = floatingTexts[i];
        t.y += t.vy * dt;
        t.alpha -= dt * 1.6;
        if (t.alpha <= 0) {
          floatingTexts.splice(i, 1);
        }
      }

      // Update gold sparks
      const goldSparks = goldSparksRef.current;
      for (let i = goldSparks.length - 1; i >= 0; i--) {
        const s = goldSparks[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 250 * dt; // gravity pull
        s.alpha -= dt * 1.8;
        if (s.alpha <= 0) {
          goldSparks.splice(i, 1);
        }
      }

      // Draw active coins
      for (const p of activePowerUpsRef.current) {
        if (p.type === "armour") {
          ctx!.save();
          const pulse = Math.sin(p.pulsePhase) * 1.5;
          const r = p.radius + pulse;
          const img = preloadedImagesRef.current["/sprites/Powerups/armour_pwup.png"];
          if (img) {
            ctx!.shadowColor = "rgba(0, 191, 255, 0.85)";
            ctx!.shadowBlur = 12;
            ctx!.drawImage(img, p.x - r, p.y - r, r * 2, r * 2);
          } else {
            // Draw a glowing shield container fallback
            ctx!.beginPath();
            ctx!.shadowColor = "rgba(0, 191, 255, 0.85)";
            ctx!.shadowBlur = 12;
            ctx!.moveTo(p.x, p.y - r);
            ctx!.quadraticCurveTo(p.x + r, p.y - r, p.x + r, p.y - r * 0.2);
            ctx!.quadraticCurveTo(p.x + r, p.y + r * 0.5, p.x, p.y + r * 1.1);
            ctx!.quadraticCurveTo(p.x - r, p.y + r * 0.5, p.x - r, p.y - r * 0.2);
            ctx!.quadraticCurveTo(p.x - r, p.y - r, p.x, p.y - r);
            ctx!.closePath();
            ctx!.fillStyle = "rgba(0, 191, 255, 0.4)";
            ctx!.fill();
            ctx!.shadowBlur = 0;
            ctx!.strokeStyle = "#00bfff";
            ctx!.lineWidth = 3;
            ctx!.stroke();
          }
          ctx!.restore();
        } else if (p.type === "magnet") {
          ctx!.save();
          const pulse = Math.sin(p.pulsePhase) * 1.5;
          const r = p.radius + pulse;
          const img = preloadedImagesRef.current["/sprites/Powerups/magnet_pwup.png"];
          if (img) {
            ctx!.shadowColor = "rgba(225, 95, 202, 0.85)";
            ctx!.shadowBlur = 12;
            ctx!.drawImage(img, p.x - r, p.y - r, r * 2, r * 2);
          } else {
            // Fallback vector magnet drawing
            ctx!.strokeStyle = "#ff0000";
            ctx!.lineWidth = 5;
            ctx!.beginPath();
            ctx!.arc(p.x, p.y, r * 0.7, Math.PI, 0);
            ctx!.stroke();
          }
          ctx!.restore();
        } else {
          ctx!.save();
          const pulse = Math.sin(p.pulsePhase) * 1.5;
          const r = p.radius + pulse;

          // Draw outer gold coin face
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx!.fillStyle = "#ffd700";
          ctx!.shadowColor = "rgba(184, 134, 11, 0.45)";
          ctx!.shadowBlur = 6;
          ctx!.fill();
          ctx!.shadowBlur = 0;

          // Dark gold rim border
          ctx!.strokeStyle = "#b8860b";
          ctx!.lineWidth = 2.5;
          ctx!.stroke();

          // Inner rim circle
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, r * 0.72, 0, Math.PI * 2);
          ctx!.strokeStyle = "#d4af37";
          ctx!.lineWidth = 1.2;
          ctx!.stroke();

          // Embossed Rupee symbol in center
          ctx!.fillStyle = "#b8860b";
          ctx!.font = `bold ${Math.floor(r * 1.05)}px 'Cinzel', sans-serif`;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText("₹", p.x, p.y + 0.5);

          ctx!.restore();
        }
      }

      // Draw gold sparks
      for (const s of goldSparksRef.current) {
        ctx!.save();
        ctx!.beginPath();
        const c = s.color ? `rgba(${s.color[0]}, ${s.color[1]}, ${s.color[2]}, ${s.alpha})` : `rgba(255, 220, 100, ${s.alpha})`;
        ctx!.fillStyle = c;
        ctx!.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      // Draw magnet pull aura if active on canvas
      if (magnetTimerRef.current > 0) {
        ctx!.save();
        const centerX = heroX;
        const centerY = groundY - heroYOffsetRef.current - (heroIsSlidingRef.current ? 20 : 60);
        const radius = heroIsSlidingRef.current ? 50 : 75;

        ctx!.strokeStyle = "rgba(225, 95, 202, 0.45)";
        ctx!.lineWidth = 2;
        ctx!.setLineDash([4, 8]);
        
        ctx!.beginPath();
        ctx!.arc(centerX, centerY, radius + Math.sin(starTimeRef.current * 4) * 5, 0, Math.PI * 2);
        ctx!.stroke();

        ctx!.strokeStyle = "rgba(225, 95, 202, 0.25)";
        ctx!.lineWidth = 3;
        ctx!.setLineDash([]);
        ctx!.beginPath();
        ctx!.arc(centerX, centerY, radius - 15, 0, Math.PI * 2);
        ctx!.stroke();

        ctx!.restore();
      }

      // Draw active shield bubble around the hero on canvas
      if (armourTimerRef.current > 0) {
        ctx!.save();
        const bubbleX = heroX;
        const bubbleY = groundY - heroYOffsetRef.current - (heroIsSlidingRef.current ? 20 : 60);
        const bubbleRadius = heroIsSlidingRef.current ? 45 : 70;

        ctx!.shadowColor = "rgba(0, 191, 255, 0.85)";
        ctx!.shadowBlur = 20;

        ctx!.beginPath();
        ctx!.arc(bubbleX, bubbleY, bubbleRadius, 0, Math.PI * 2);
        
        const gradient = ctx!.createRadialGradient(bubbleX, bubbleY, bubbleRadius * 0.5, bubbleX, bubbleY, bubbleRadius);
        gradient.addColorStop(0, "rgba(0, 191, 255, 0.05)");
        gradient.addColorStop(0.7, "rgba(0, 191, 255, 0.18)");
        gradient.addColorStop(1, "rgba(0, 191, 255, 0.65)");
        ctx!.fillStyle = gradient;
        ctx!.fill();
        ctx!.shadowBlur = 0;

        ctx!.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx!.lineWidth = 2.5;
        ctx!.stroke();

        ctx!.strokeStyle = "rgba(0, 255, 255, 0.4)";
        ctx!.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          const angleStart = starTimeRef.current * 2 + k * (Math.PI * 2 / 3);
          ctx!.beginPath();
          ctx!.arc(bubbleX, bubbleY, bubbleRadius - 6, angleStart, angleStart + 0.6);
          ctx!.stroke();
        }

        ctx!.restore();
      }

      // Draw floating texts
      for (const t of floatingTextsRef.current) {
        ctx!.save();
        ctx!.fillStyle = `rgba(255, 215, 0, ${t.alpha})`;
        ctx!.font = "bold 16px 'Cinzel', serif";
        ctx!.textAlign = "center";
        ctx!.fillText(t.text, t.x, t.y);
        ctx!.restore();
      }

      updateAndDrawWeather(w, h, dt);

      // --- Portal smoke overlay (drawn last, above everything, ignores shake) ---
      if (portalStateRef.current !== "none") {
        const prog = portalProgressRef.current;
        // Ease in-out curve for smooth smoke
        const eased = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
        const alpha = portalStateRef.current === "in" ? eased : eased;

        // Thick smoke overlay using multiple radial gradient puffs
        const smokeCanvas = ctx!;
        smokeCanvas.save();
        smokeCanvas.globalAlpha = alpha;

        // Base blackout at peak
        smokeCanvas.fillStyle = `rgba(12, 10, 18, ${alpha * 0.55})`;
        smokeCanvas.fillRect(0, 0, w, h);
        smokeCanvas.globalAlpha = 1;

        // Swirling smoke puff columns
        const puffStep = 38;
        const rowStep = 40;
        for (let px = -60; px < w + 60; px += puffStep) {
          for (let py = -60; py < h + 60; py += rowStep) {
            const waveX = Math.sin(starTimeRef.current * 3.5 + py * 0.018 + px * 0.01) * 28;
            const waveY = Math.cos(starTimeRef.current * 2.8 + px * 0.015) * 18;
            const cx2 = px + waveX;
            const cy2 = py + waveY;
            const idx = Math.floor(px / puffStep) + Math.floor(py / rowStep);
            const baseR = 65 + Math.sin(starTimeRef.current * 2 + idx) * 18;

            // Alternate between misty grey and white smoke
            const lightness = idx % 3 === 0 ? "240,240,245" : idx % 3 === 1 ? "200,205,215" : "170,175,185";
            const puffAlpha = alpha * (0.55 + Math.sin(starTimeRef.current * 2.2 + idx * 0.7) * 0.2);

            const grad = smokeCanvas.createRadialGradient(cx2, cy2, 0, cx2, cy2, baseR);
            grad.addColorStop(0, `rgba(${lightness}, ${puffAlpha})`);
            grad.addColorStop(0.5, `rgba(${lightness}, ${puffAlpha * 0.6})`);
            grad.addColorStop(1, `rgba(${lightness}, 0)`);

            smokeCanvas.beginPath();
            smokeCanvas.fillStyle = grad;
            smokeCanvas.arc(cx2, cy2, baseR, 0, Math.PI * 2);
            smokeCanvas.fill();
          }
        }

        // Bright energy sparks at portal peak
        if (prog > 0.6 && portalStateRef.current === "in") {
          const sparkAlpha = (prog - 0.6) / 0.4;
          smokeCanvas.globalAlpha = sparkAlpha;
          smokeCanvas.fillStyle = `rgba(255, 240, 200, ${sparkAlpha})`;
          for (let i = 0; i < 20; i++) {
            const sx = (Math.sin(starTimeRef.current * 5 + i * 1.3) * 0.5 + 0.5) * w;
            const sy = (Math.cos(starTimeRef.current * 4.5 + i * 0.9) * 0.5 + 0.5) * h;
            smokeCanvas.beginPath();
            smokeCanvas.arc(sx, sy, 1.5 + Math.random() * 3, 0, Math.PI * 2);
            smokeCanvas.fill();
          }
          smokeCanvas.globalAlpha = 1;
        }

        smokeCanvas.restore();
      }

      ctx!.restore();

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const canvasEl = canvasRef.current;
  const canvasWidth = canvasEl ? canvasEl.width : (typeof window !== "undefined" ? window.innerWidth : 1200);
  const heroX = canvasWidth * 0.34;

  const gapPct = Math.max(0, Math.min(100, gapDisplay));
  const danger = (gapPct < 28);

  return (
    <div style={styles.wrap}>
      <canvas ref={canvasRef} style={styles.canvas} />

      {/* Premium Top-Right Score & Coins HUD */}
      {phase === "running" && (
        <div style={{
          position: "absolute",
          top: 20,
          right: control === "keyboard_classic" ? 25 : 165,
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          pointerEvents: "none",
        }}>
          {/* Coins Row */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Custom Gold Coin Icon */}
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ffe066 0%, #d4af37 100%)",
              border: "1.8px solid #b89010",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
              color: "#7a5c00",
              fontSize: "14px",
              fontWeight: 900,
              fontFamily: "'Segoe UI', sans-serif",
            }}>
              ₹
            </div>
            {/* Coins Count */}
            <span style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "'Segoe UI', sans-serif",
              letterSpacing: "0.5px",
              textShadow: "0 2px 6px rgba(0, 0, 0, 0.7)",
              lineHeight: 1,
            }}>
              {coins}
            </span>
          </div>

          {/* Best Score Row */}
          {best > 0 && (
            <div style={{
              fontSize: "16px",
              color: "rgba(255, 255, 255, 0.85)",
              fontWeight: 700,
              fontFamily: "'Segoe UI', sans-serif",
              letterSpacing: "0.5px",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.7)",
              marginTop: "6px",
            }}>
              Best: {best}
            </div>
          )}
        </div>
      )}

      <img
        ref={villainNodeRef}
        src="/sprites/Asura/asur1.png"
        alt="Villain"
        style={{ ...styles.sprite, ...styles.villainSprite }}
      />
      <img
        ref={heroNodeRef}
        src="/sprites/Prince/Prince_standing.png"
        alt="Hero"
        style={styles.sprite}
      />

      {/* Active Shield UI Indicator */}
      {armourTime > 0 && phase !== "caught" && (
        <div style={{
          position: "absolute",
          top: 148,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(8, 24, 38, 0.85)",
          border: "1.5px solid #00bfff",
          borderRadius: "10px",
          padding: "8px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          boxShadow: "0 0 15px rgba(0, 191, 255, 0.45)",
          zIndex: 300,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#00bfff", fontSize: 16 }}>🛡️</span>
            <span style={{
              color: "#ffffff",
              fontFamily: "'Cinzel', serif",
              fontSize: 13,
              fontWeight: "bold",
              letterSpacing: "1px",
            }}>
              SHIELD ACTIVE
            </span>
          </div>
          <div style={{
            width: "100px",
            height: "4px",
            background: "rgba(255, 255, 255, 0.15)",
            borderRadius: "2px",
            overflow: "hidden",
          }}>
            <div style={{
              width: `${(armourTime / 15.0) * 100}%`,
              height: "100%",
              background: "#00bfff",
              transition: "width 0.1s linear",
            }} />
          </div>
        </div>
      )}

      {/* Active Magnet UI Indicator */}
      {magnetTime > 0 && phase !== "caught" && (
        <div style={{
          position: "absolute",
          top: armourTime > 0 ? 212 : 148,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(38, 8, 30, 0.85)",
          border: "1.5px solid #e15fca",
          borderRadius: "10px",
          padding: "8px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          boxShadow: "0 0 15px rgba(225, 95, 202, 0.45)",
          zIndex: 300,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#e15fca", fontSize: 16 }}>🧲</span>
            <span style={{
              color: "#ffffff",
              fontFamily: "'Cinzel', serif",
              fontSize: 13,
              fontWeight: "bold",
              letterSpacing: "1px",
            }}>
              MAGNET ACTIVE
            </span>
          </div>
          <div style={{
            width: "100px",
            height: "4px",
            background: "rgba(255, 255, 255, 0.15)",
            borderRadius: "2px",
            overflow: "hidden",
          }}>
            <div style={{
              width: `${(magnetTime / 10.0) * 100}%`,
              height: "100%",
              background: "#e15fca",
              transition: "width 0.1s linear",
            }} />
          </div>
        </div>
      )}



      {phase === "paused" && (
        <div style={styles.overlay}>
          <div style={styles.panel}>
            <h1 style={styles.title}>Paused</h1>
            <p style={styles.copy}>Take a breath and resume when you’re ready.</p>
            <div style={styles.buttonRow}>
              <button type="button" onClick={resumeGame} style={styles.restartButton}>
                RESUME
              </button>
              <button type="button" onClick={exitGame} style={styles.exitButton}>
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "caught" && (
        <div style={styles.overlay}>
          <div style={styles.panel}>
            <h1 style={styles.title}>
              {deathReason === "asura"
                ? "Caught by Asura!"
                : deathReason === "obstacle"
                  ? "Crashed!"
                  : deathReason === "archer"
                    ? "Caught by Archer Asura!"
                    : "Wounded by Arrow!"}
            </h1>
            <p style={styles.copy}>
              {deathReason === "asura"
                ? `You made it ${score} before the Asura caught you.`
                : deathReason === "obstacle"
                  ? `You crashed into an obstacle after ${score}.`
                  : deathReason === "archer"
                    ? `You collided with the Archer Asura after ${score}.`
                    : `You got wounded by an arrow after ${score}.`}
            </p>
            <p style={{ color: "#ffd700", fontWeight: 700, margin: "6px 0 12px", fontFamily: "'MedievalSharp', cursive, sans-serif", fontSize: 18 }}>
              Coins: {coins} ₹  (Total: {lifetimeCoins} ₹)
            </p>
            <p style={styles.hint}>Best: {best}</p>
            <div style={styles.buttonRow}>
              <button
                type="button"
                onClick={() => startRun()}
                style={styles.restartButton}
              >
                RESTART
              </button>
              <button
                type="button"
                onClick={exitGame} 
                style={styles.exitButton}
              >
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {phase !== "idle" && (
        <div style={styles.hud}>
          {/* Circular styled Pause Button */}
          <button
            type="button"
            onClick={phase === "paused" ? resumeGame : pauseGame}
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              zIndex: 200,
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#4d3319", // dark wood brown
              border: "2px solid #e0cfab", // beige/gold border
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 3px 6px rgba(0,0,0,0.5)",
              pointerEvents: "auto",
              padding: 0,
            }}
            aria-label={phase === "paused" ? "Resume game" : "Pause game"}
          >
            <div style={{ display: "flex", gap: "3.5px", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "3px", height: "12px", backgroundColor: "#f5ebcf", borderRadius: "1.5px" }} />
              <div style={{ width: "3px", height: "12px", backgroundColor: "#f5ebcf", borderRadius: "1.5px" }} />
            </div>
          </button>

          {/* Connect Treadmill Pill matching screenshot */}
          {control !== "keyboard_classic" && (
            <button
              type="button"
              onClick={connectTreadmill}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                zIndex: 200,
                background: "rgba(10, 15, 25, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "16px",
                padding: "5px 12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                boxShadow: "0 2px 5px rgba(0, 0, 0, 0.4)",
                pointerEvents: "auto",
              }}
            >
              <span style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: bleConnected ? "#2ecc71" : "#e74c3c",
                boxShadow: bleConnected ? "0 0 6px #2ecc71" : "none",
              }} />
              <span style={{
                color: "#ffffff",
                fontSize: "9px",
                fontWeight: 700,
                fontFamily: "'Segoe UI', sans-serif",
                letterSpacing: "0.2px",
              }}>
                {bleConnected ? "Connected" : "Connect Treadmill"}
              </span>
            </button>
          )}

          {/* 3-Column Premium Scoreboard Dashboard */}
          <div style={{
            position: "absolute",
            left: "50%",
            bottom: 18,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            pointerEvents: "auto",
            zIndex: 200,
          }}>
            {/* Three Separate Floating Scoreboard Cards matching screenshot */}
            <div style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}>
              {/* Box 1: SCORE */}
              <div style={{
                width: "115px",
                height: "64px",
                background: "rgba(10, 15, 25, 0.95)",
                border: "1.5px solid rgba(212, 175, 55, 0.45)",
                borderRadius: "6px",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(212, 175, 55, 0.08)",
                padding: "8px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                textAlign: "left",
              }}>
                <span style={{ fontSize: 11, color: "#ffd700", fontWeight: 800, letterSpacing: "1.5px", fontFamily: "'Cinzel', serif" }}>SCORE</span>
                <span style={{ fontSize: 20, color: "#ffffff", fontWeight: 800, fontFamily: "'Cinzel', serif", marginTop: 2 }}>{score}</span>
              </div>

              {/* Box 2: SPEED */}
              {control !== "keyboard_classic" && (
                <div style={{
                  width: "115px",
                  height: "64px",
                  background: "rgba(10, 15, 25, 0.95)",
                  border: "1.5px solid rgba(212, 175, 55, 0.45)",
                  borderRadius: "6px",
                  boxShadow: "0 4px 15px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(212, 175, 55, 0.08)",
                  padding: "8px 14px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  textAlign: "left",
                }}>
                  <span style={{ fontSize: 11, color: "#ffd700", fontWeight: 800, letterSpacing: "1.5px", fontFamily: "'Cinzel', serif" }}>SPEED</span>
                  <span style={{ fontSize: 18, color: "#ffd700", fontWeight: 800, fontFamily: "'Cinzel', serif", marginTop: 2 }}>
                    {(bleConnected ? bleSpeed : (phase === "running" ? currentSpeedRef.current / 20.0 : 0.0)).toFixed(1)} <span style={{ fontSize: 11, color: "#ffd700", fontWeight: 500 }}>km/h</span>
                  </span>
                </div>
              )}

              {/* Box 3: DIST */}
              <div style={{
                width: "115px",
                height: "64px",
                background: "rgba(10, 15, 25, 0.95)",
                border: "1.5px solid rgba(212, 175, 55, 0.45)",
                borderRadius: "6px",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(212, 175, 55, 0.08)",
                padding: "8px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                textAlign: "left",
              }}>
                <span style={{ fontSize: 11, color: "#ffd700", fontWeight: 800, letterSpacing: "1.5px", fontFamily: "'Cinzel', serif" }}>DIST</span>
                <span style={{ fontSize: 18, color: "#ffffff", fontWeight: 800, fontFamily: "'Cinzel', serif", marginTop: 2 }}>
                  {(bleConnected ? bleDistance : (score * 0.2)).toFixed(1)} <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>m</span>
                </span>
              </div>
            </div>

            {lastBleRaw && (
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", marginTop: 2, textAlign: "left", width: "100%" }}>
                pkt: {lastBleRaw.length > 50 ? lastBleRaw.slice(0, 50) + '…' : lastBleRaw}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "relative",
    width: "100vw",
    height: "100dvh",
    overflow: "hidden",
    background: "#0e1410",
    touchAction: "none",
    userSelect: "none",
  },
  canvas: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  hud: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 200,
  },
  scoreboard: {
    position: "absolute",
    left: "50%",
    bottom: 18,
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    pointerEvents: "auto",
    padding: "10px 14px",
  },
  statGroup: {
    display: "flex",
    gap: 20,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  statBox: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    background: "rgba(8, 12, 18, 0.88)",
    border: "1px solid rgba(212, 175, 55, 0.35)",
    borderRadius: 12,
    padding: "8px 16px",
    minWidth: 115,
    minHeight: 62,
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.5)",
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: "#d4af37",
    fontFamily: "'Cinzel', serif",
    fontWeight: 700,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "'Cinzel', serif",
    color: "#ffffff",
    textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
  },
  statUnit: {
    fontSize: 11,
    fontWeight: 500,
    color: "#f2ead8aa",
  },
  gapOuter: {
    width: "min(280px, 60vw)",
    height: 10,
    borderRadius: 6,
    background: "rgba(20,20,15,0.45)",
    border: "1px solid rgba(212, 175, 55, 0.25)",
    overflow: "hidden",
  },
  gapInner: {
    height: "100%",
    borderRadius: 6,
    transition: "width 0.08s linear",
  },
  pauseButton: {
    position: "absolute",
    top: 14,
    left: 18,
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    background: "rgba(139, 30, 15, 0.8)",
    border: "1px solid rgba(212, 175, 55, 0.35)",
    borderRadius: "50%",
    padding: 0,
    cursor: "pointer",
  },
  pauseIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 14,
    borderRadius: 2,
    background: "#fff7e6",
  },
  playIcon: {
    width: 0,
    height: 0,
    borderTop: "7px solid transparent",
    borderBottom: "7px solid transparent",
    borderLeft: "12px solid #fff7e6",
    marginLeft: 2,
  },
  bleButton: {
    position: "absolute",
    top: 14,
    right: 18,
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.4,
    color: "#f5ebcf",
    background: "rgba(8, 12, 18, 0.8)",
    border: "1px solid rgba(212, 175, 55, 0.25)",
    borderRadius: 20,
    padding: "6px 12px",
    cursor: "pointer",
  },
  bleButtonConnected: {
    background: "rgba(77, 125, 66, 0.55)",
    border: "1px solid rgba(212, 175, 55, 0.45)",
  },
  bleDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#e74c3c",
    boxShadow: "0 0 6px #e74c3c",
    flexShrink: 0,
  },
  bleDotConnected: {
    background: "#7fb35a",
    boxShadow: "0 0 6px #7fb35a",
  },
  bleStatusText: {
    fontSize: 12,
    color: "#f2ead899",
    textAlign: "center",
    fontWeight: 600,
  },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.72)",
    zIndex: 100,
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    background: "rgba(8, 12, 18, 0.95)",
    border: "2px solid rgba(212, 175, 55, 0.35)",
    borderRadius: 20,
    padding: "32px 48px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.85)",
    textAlign: "center",
  },
  title: {
    margin: 0,
    color: "#ffd166",
    fontSize: 30,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontFamily: "'Cinzel', serif",
  },
  copy: {
    margin: 0,
    color: "#ccc",
    fontSize: 16,
  },
  hint: {
    margin: 0,
    color: "#888",
    fontSize: 14,
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 8,
  },
  restartButton: {
    background: "linear-gradient(90deg, #8b1e0f 0%, #a12c1e 100%)",
    color: "#ffffff",
    border: "1px solid rgba(212, 175, 55, 0.4)",
    borderRadius: 8,
    padding: "12px 24px",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  exitButton: {
    background: "rgba(212, 175, 55, 0.05)",
    color: "#f5ebcf",
    border: "1px solid rgba(212, 175, 55, 0.25)",
    borderRadius: 8,
    padding: "12px 24px",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  sprite: {
    position: "absolute",
    transformOrigin: "bottom center",
    imageRendering: "pixelated",
    pointerEvents: "none",
  },
  villainSprite: {
    zIndex: 10,
  }
};