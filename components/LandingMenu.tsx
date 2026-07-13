"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type MenuState = "main" | "setup" | "store" | "about" | "help";
type DifficultyMode = "easy" | "normal" | "hard";
type MapTheme = "background";
type ControlMode = "keyboard_classic" | "treadmill";

export default function LandingMenu() {
  const router = useRouter();
  const [menuState, setMenuState] = useState<MenuState>("main");
  const [selectedMode, setSelectedMode] = useState<DifficultyMode>("normal");
  const [selectedMap, setSelectedMap] = useState<MapTheme>("background");
  const [selectedControl, setSelectedControl] = useState<ControlMode>("keyboard_classic");
  const [lifetimeCoins, setLifetimeCoins] = useState<number>(0);
  const [hoveredMap, setHoveredMap] = useState<MapTheme | null>(null);
  const [hoveredStoreItem, setHoveredStoreItem] = useState<any | null>(null);
  const [highScore, setHighScore] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const playHoverSfx = () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.warn(e);
    }
  };

  const playClickSfx = () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn(e);
    }
  };

  const [focusIndex, setFocusIndex] = useState<number>(0);
  const [choiceActive, setChoiceActive] = useState<boolean>(false);
  const [choiceSubIndex, setChoiceSubIndex] = useState<number>(0);

  useEffect(() => {
    setFocusIndex(0);
    setChoiceActive(false);
    setChoiceSubIndex(0);
    setHoveredStoreItem(null);
  }, [menuState]);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown" &&
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight" &&
        e.key !== "Enter" &&
        e.key !== "Escape"
      ) {
        return;
      }

      e.preventDefault();

      if (menuState === "main") {
        const maxIndex = 4; // START GAME, BAZAAR, SETTINGS, ABOUT, EXIT GAME
        if (e.key === "ArrowDown") {
          setFocusIndex((prev) => {
            const next = prev < maxIndex ? prev + 1 : 0;
            playHoverSfx();
            return next;
          });
        } else if (e.key === "ArrowUp") {
          setFocusIndex((prev) => {
            const next = prev > 0 ? prev - 1 : maxIndex;
            playHoverSfx();
            return next;
          });
        } else if (e.key === "Enter") {
          playClickSfx();
          if (focusIndex === 0) {
            setMenuState("setup");
          } else if (focusIndex === 1) {
            setMenuState("store");
          } else if (focusIndex === 2) {
            alert("Settings coming soon!");
          } else if (focusIndex === 3) {
            setMenuState("about");
          } else if (focusIndex === 4) {
            handleExit();
          }
        }
      } else if (menuState === "setup") {
        const maxIndex = 4; // DIFFICULTY (0), CONTROL MODE (1), ACTIVE MAP (2), START RUN (3), BACK (4)

        if (choiceActive) {
          if (focusIndex === 0) {
            // Cycle Difficulty
            const optionsCount = 3;
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
              setChoiceSubIndex((prev) => (prev < optionsCount - 1 ? prev + 1 : 0));
              playHoverSfx();
            } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
              setChoiceSubIndex((prev) => (prev > 0 ? prev - 1 : optionsCount - 1));
              playHoverSfx();
            } else if (e.key === "Enter") {
              const diffs: DifficultyMode[] = ["easy", "normal", "hard"];
              setSelectedMode(diffs[choiceSubIndex]);
              setChoiceActive(false);
              playClickSfx();
              setFocusIndex(1); // Auto move to Control
            } else if (e.key === "Escape") {
              setChoiceActive(false);
              playClickSfx();
            }
          } else if (focusIndex === 1) {
            // Cycle Control
            const optionsCount = 2;
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
              setChoiceSubIndex((prev) => (prev < optionsCount - 1 ? prev + 1 : 0));
              playHoverSfx();
            } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
              setChoiceSubIndex((prev) => (prev > 0 ? prev - 1 : optionsCount - 1));
              playHoverSfx();
            } else if (e.key === "Enter") {
              const ctrls: ControlMode[] = ["keyboard_classic", "treadmill"];
              setSelectedControl(ctrls[choiceSubIndex]);
              setChoiceActive(false);
              playClickSfx();
              setFocusIndex(2); // Auto move to Map
              setHoveredMap("background"); // Show preview when auto-advancing to Map
            } else if (e.key === "Escape") {
              setChoiceActive(false);
              playClickSfx();
            }
          }
        } else {
          // Row navigation
          if (e.key === "ArrowDown") {
            setFocusIndex((prev) => {
              const next = prev < maxIndex ? prev + 1 : 0;
              playHoverSfx();
              setHoveredMap(next === 2 ? "background" : null);
              return next;
            });
          } else if (e.key === "ArrowUp") {
            setFocusIndex((prev) => {
              const next = prev > 0 ? prev - 1 : maxIndex;
              playHoverSfx();
              setHoveredMap(next === 2 ? "background" : null);
              return next;
            });
          } else if (e.key === "Enter") {
            if (focusIndex === 0) {
              const diffs: DifficultyMode[] = ["easy", "normal", "hard"];
              setChoiceSubIndex(diffs.indexOf(selectedMode));
              setChoiceActive(true);
              playClickSfx();
            } else if (focusIndex === 1) {
              const ctrls: ControlMode[] = ["keyboard_classic", "treadmill"];
              setChoiceSubIndex(ctrls.indexOf(selectedControl));
              setChoiceActive(true);
              playClickSfx();
            } else if (focusIndex === 2) {
              setSelectedMap("background");
              playClickSfx();
              setFocusIndex(3); // Confirm map instantly and jump to START RUN
              setHoveredMap(null); // Hide preview when leaving map row
            } else if (focusIndex === 3) {
              playClickSfx();
              handleLaunch();
            } else if (focusIndex === 4) {
              playClickSfx();
              setMenuState("main");
            }
          } else if (e.key === "Escape") {
            playClickSfx();
            setMenuState("main");
          }
        }
      } else if (menuState === "store") {
        const maxIndex = 3; // Item 0, Item 1, Item 2, RETURN
        const storeItems = [
          { name: "Royal Rampant Armour", price: 100, desc: "Immune to the obstacles", key: "royalrampant" },
          { name: "Forest Ghat Map", price: 250, desc: "Unlock deep jungle biome", key: "forestghat" },
          { name: "Magnet", price: 150, desc: "Autocollect near coins", key: "magnet" }
        ];

        if (e.key === "ArrowDown") {
          setFocusIndex((prev) => {
            const next = prev < maxIndex ? prev + 1 : 0;
            playHoverSfx();
            // Set hover item accordingly
            if (next >= 0 && next <= 2) {
              setHoveredStoreItem(storeItems[next]);
            } else {
              setHoveredStoreItem(null);
            }
            return next;
          });
        } else if (e.key === "ArrowUp") {
          setFocusIndex((prev) => {
            const next = prev > 0 ? prev - 1 : maxIndex;
            playHoverSfx();
            if (next >= 0 && next <= 2) {
              setHoveredStoreItem(storeItems[next]);
            } else {
              setHoveredStoreItem(null);
            }
            return next;
          });
        } else if (e.key === "Enter") {
          playClickSfx();
          if (focusIndex === 3) {
            setMenuState("main");
          } else {
            alert(`Purchasing ${storeItems[focusIndex].name} is coming soon!`);
          }
        } else if (e.key === "Escape") {
          playClickSfx();
          setMenuState("main");
        }
      } else if (menuState === "about" || menuState === "help") {
        if (e.key === "Enter" || e.key === "Escape") {
          playClickSfx();
          setMenuState("main");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuState, focusIndex, choiceActive, choiceSubIndex, selectedMode, selectedControl, selectedMap]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lifetimeCoins");
      if (saved) {
        setLifetimeCoins(parseInt(saved, 10));
      }
      const savedBest = localStorage.getItem("highScore");
      if (savedBest) {
        setHighScore(parseInt(savedBest, 10));
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const activeCanvas = canvas;
    const ctx = activeCanvas.getContext("2d");
    if (!ctx) return;
    const activeCtx = ctx;

    let raf = 0;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number; speedMultiplier: number }> = [];

    function resize() {
      activeCanvas.width = window.innerWidth;
      activeCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Initialize floating debris particles
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * activeCanvas.width,
        y: Math.random() * activeCanvas.height,
        vx: (Math.random() - 0.5) * 0.4 - 0.15, // slight drift to the left
        vy: -Math.random() * 0.8 - 0.3, // upward movement
        size: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.5 + 0.25,
        speedMultiplier: Math.random() * 0.5 + 0.8,
      });
    }

    function loop() {
      activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);

      for (const p of particles) {
        p.x += p.vx * p.speedMultiplier;
        p.y += p.vy * p.speedMultiplier;

        // Draw glowing ember debris
        activeCtx.beginPath();
        const grad = activeCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        grad.addColorStop(0, `rgba(225, 175, 55, ${p.alpha})`);
        grad.addColorStop(0.4, `rgba(180, 50, 20, ${p.alpha * 0.5})`);
        grad.addColorStop(1, "rgba(8, 12, 18, 0)");
        activeCtx.fillStyle = grad;
        activeCtx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        activeCtx.fill();

        // Recycle particle if it drifts off the screen edges
        if (p.y < -30 || p.x < -30 || p.x > activeCanvas.width + 30) {
          p.y = activeCanvas.height + 30;
          p.x = Math.random() * activeCanvas.width;
          p.alpha = Math.random() * 0.5 + 0.25;
        }
      }

      raf = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleExit = () => {
    window.close();
    setTimeout(() => {
      window.location.href = "about:blank";
    }, 100);
  };

  const handleLaunch = () => {
    router.push(`/run?mode=${selectedMode}&map=${selectedMap}&control=${selectedControl}`);
  };

  return (
    <main
      style={{
        width: "100vw",
        height: "100dvh",
        display: "flex",
        position: "relative",
        background: "#080c10",
        color: "#fff7e6",
        fontFamily: "'MedievalSharp', cursive, 'Segoe UI', sans-serif",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@500;700;800&family=MedievalSharp&display=swap');

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-46%) scale(0.96); }
          to { opacity: 1; transform: translateY(-50%) scale(1); }
        }

        .menu-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          background: rgba(212, 175, 55, 0.05);
          border: 1px solid rgba(212, 175, 55, 0.25);
          color: #f5ebcf;
          font-family: 'MedievalSharp', cursive, sans-serif;
        }
        .menu-btn:hover {
          background: rgba(212, 175, 55, 0.12);
          border-color: #d4af37;
          color: #fff;
          transform: translateX(4px);
          box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
        }
        .menu-btn-primary {
          background: linear-gradient(90deg, rgba(139, 30, 15, 0.85) 0%, rgba(161, 44, 30, 0.85) 100%);
          border: 1px solid rgba(212, 175, 55, 0.4);
          color: #fff;
        }
        .menu-btn-primary:hover {
          background: linear-gradient(90deg, #8b1e0f 0%, #a12c1e 100%);
          border-color: #e5c158;
          transform: translateX(4px);
          box-shadow: 0 6px 20px rgba(139, 30, 15, 0.5);
        }
        .option-card {
          transition: all 0.2s ease;
          cursor: pointer;
          border: 1px solid rgba(212, 175, 55, 0.15);
          background: rgba(0, 0, 0, 0.65);
          outline: none;
          color: #f5ebcf;
          font-family: 'MedievalSharp', cursive, sans-serif;
        }
        .option-card:hover {
          transform: translateY(-2px);
          border-color: rgba(212, 175, 55, 0.45);
          background: rgba(212, 175, 55, 0.06);
        }
        .option-card.selected-mode {
          border-color: #d4af37 !important;
          background: rgba(139, 30, 15, 0.25) !important;
          box-shadow: 0 0 12px rgba(212, 175, 55, 0.3);
          color: #ffffff;
        }
        .option-card.selected-map-background {
          border-color: #d4af37 !important;
          background: rgba(139, 30, 15, 0.25) !important;
          box-shadow: 0 0 12px rgba(212, 175, 55, 0.3);
          color: #ffffff;
        }
        .option-card.selected-map-background2 {
          border-color: #d4af37 !important;
          background: rgba(139, 30, 15, 0.25) !important;
          box-shadow: 0 0 12px rgba(212, 175, 55, 0.3);
          color: #ffffff;
        }
      ` }} />



      {/* Floating High Score & Coins Indicators in Top-Right Corner */}
      <div style={{
        position: "absolute",
        top: "24px",
        right: "24px",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        alignItems: "flex-end",
        fontFamily: "'Cinzel', serif",
        fontSize: "13px",
        fontWeight: 800,
        color: "#ffd700",
        letterSpacing: "1px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}>
          <span>COINS:</span>
          <span>{lifetimeCoins.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", textShadow: "none" }}>
          <span>BEST SCORE: {highScore.toLocaleString()}</span>
        </div>
      </div>

      {/* Fullscreen Wallpaper Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "url('/Wallpaper.jpg') center center/cover no-repeat",
          zIndex: 1,
        }}
      />

      {/* Elegant Left-to-Right Shadow Gradient Overlay for Contrast */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, rgba(8, 12, 18, 0.92) 0%, rgba(8, 12, 18, 0.6) 40%, rgba(8, 12, 18, 0.15) 100%)",
          zIndex: 2,
        }}
      />

      {/* Left Sidebar Menu overlaying the wallpaper */}
      <div
        style={{
          width: "min(460px, 100vw)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "130px 40px 60px",
          zIndex: 10,
          position: "relative",
        }}
      >
        <div>
          {/* Header Title with customized font family and metallic gold gradient style */}
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "2.5px",
              textAlign: "left",
              fontFamily: "'Cinzel', serif",
              color: "#d4af37",
              lineHeight: "1.25",
              textTransform: "uppercase",
            }}
          >
            Pragjyotishpur<br />Tale
          </h1>

          {/* Elegant Left-Aligned Divider Line */}
          <div style={{
            width: "240px",
            height: "1px",
            background: "rgba(212, 175, 55, 0.6)",
            margin: "14px 0 28px 0",
          }} />

          {menuState === "main" ? (
            /* Main Menu Options */
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
              {[
                { label: "START GAME", action: () => setMenuState("setup") },
                { label: "HOW TO PLAY", action: () => setMenuState("help") },
                { label: "BAZAAR", action: () => setMenuState("store") },
                { label: "ABOUT", action: () => setMenuState("about") },
                { label: "EXIT GAME", action: handleExit }
              ].map((item, idx) => {
                const isFocused = focusIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      item.action();
                      playClickSfx();
                    }}
                    onMouseEnter={() => {
                      setFocusIndex(idx);
                      playHoverSfx();
                    }}
                    style={{
                      background: idx === 0
                        ? "linear-gradient(90deg, rgba(139,30,15,0.92) 0%, rgba(161,44,30,0.92) 100%)"
                        : "rgba(0,0,0,0.45)",
                      border: isFocused
                        ? "2px solid #d4af37"
                        : idx === 0
                          ? "1px solid rgba(212,175,55,0.45)"
                          : "1px solid rgba(212,175,55,0.22)",
                      boxShadow: isFocused ? "0 0 12px rgba(212, 175, 55, 0.5)" : "none",
                      transform: isFocused ? "scale(1.05) translateX(4px)" : "scale(1) translateX(0px)",
                      padding: "14px 28px",
                      margin: 0,
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: 700,
                      textAlign: "left",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      fontFamily: "'Cinzel', serif",
                      transition: "all 0.2s ease",
                      width: "260px",
                      display: "block",
                      borderRadius: "6px",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : menuState === "setup" ? (
            /* Setup Configuration options inside Sidebar */
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
              {/* Difficulty Selection */}
              <div style={{ textAlign: "left", width: "100%" }}>
                <span style={{ fontSize: 12, color: focusIndex === 0 && choiceActive ? "#ffd700" : "rgba(212,175,55,0.7)", fontWeight: 700, letterSpacing: "2px", fontFamily: "'Cinzel', serif" }}>
                  DIFFICULTY {focusIndex === 0 && choiceActive && " ✦ SELECTING"}
                </span>
                <div style={{ width: "200px", height: "1px", background: "rgba(212,175,55,0.35)", margin: "4px 0 8px 0" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                  {(["easy", "normal", "hard"] as DifficultyMode[]).map((mode, subIdx) => {
                    const isRowFocused = focusIndex === 0;
                    const isSelected = selectedMode === mode;
                    const isSubChoiceHighlighted = choiceActive && isRowFocused && choiceSubIndex === subIdx;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setSelectedMode(mode);
                          playClickSfx();
                        }}
                        onMouseEnter={() => {
                          setFocusIndex(0);
                        }}
                        style={{
                          background: isSelected ? "rgba(139,30,15,0.22)" : "rgba(0,0,0,0.35)",
                          border: isSubChoiceHighlighted
                            ? "2px solid #ffd700"
                            : isSelected
                              ? "1px solid #d4af37"
                              : (isRowFocused ? "1px dashed rgba(212,175,55,0.5)" : "1px solid rgba(212,175,55,0.22)"),
                          boxShadow: (isSubChoiceHighlighted || (isRowFocused && isSelected)) ? "0 0 8px rgba(212, 175, 55, 0.35)" : "none",
                          padding: "10px 22px",
                          color: isSelected ? "#d4af37" : "#ffffff",
                          fontSize: "15px",
                          fontWeight: 700,
                          fontFamily: "'Cinzel', serif",
                          letterSpacing: "1.5px",
                          cursor: "pointer",
                          textTransform: "uppercase",
                          transition: "all 0.2s ease",
                          width: "240px",
                          textAlign: "left",
                          transform: isRowFocused ? "translateX(4px)" : "none",
                          borderRadius: "4px",
                        }}
                      >
                        {mode} {isSelected && "✦"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Control Mode Selection */}
              <div style={{ textAlign: "left", width: "100%", marginTop: 2 }}>
                <span style={{ fontSize: 12, color: focusIndex === 1 && choiceActive ? "#ffd700" : "rgba(212,175,55,0.7)", fontWeight: 700, letterSpacing: "2px", fontFamily: "'Cinzel', serif" }}>
                  CONTROL MODE {focusIndex === 1 && choiceActive && " ✦ SELECTING"}
                </span>
                <div style={{ width: "200px", height: "1px", background: "rgba(212,175,55,0.35)", margin: "4px 0 8px 0" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                  {(["keyboard_classic", "treadmill"] as ControlMode[]).map((ctrl, subIdx) => {
                    const isRowFocused = focusIndex === 1;
                    const isSelected = selectedControl === ctrl;
                    const isSubChoiceHighlighted = choiceActive && isRowFocused && choiceSubIndex === subIdx;
                    return (
                      <button
                        key={ctrl}
                        type="button"
                        onClick={() => {
                          setSelectedControl(ctrl);
                          playClickSfx();
                        }}
                        onMouseEnter={() => {
                          setFocusIndex(1);
                        }}
                        style={{
                          background: isSelected ? "rgba(139,30,15,0.22)" : "rgba(0,0,0,0.35)",
                          border: isSubChoiceHighlighted
                            ? "2px solid #ffd700"
                            : isSelected
                              ? "1px solid #d4af37"
                              : (isRowFocused ? "1px dashed rgba(212,175,55,0.5)" : "1px solid rgba(212,175,55,0.22)"),
                          boxShadow: (isSubChoiceHighlighted || (isRowFocused && isSelected)) ? "0 0 8px rgba(212, 175, 55, 0.35)" : "none",
                          padding: "10px 22px",
                          color: isSelected ? "#d4af37" : "#ffffff",
                          fontSize: "15px",
                          fontWeight: 700,
                          fontFamily: "'Cinzel', serif",
                          letterSpacing: "1.5px",
                          cursor: "pointer",
                          textTransform: "uppercase",
                          transition: "all 0.2s ease",
                          width: "240px",
                          textAlign: "left",
                          transform: isRowFocused ? "translateX(4px)" : "none",
                          borderRadius: "4px",
                        }}
                      >
                        {ctrl === "keyboard_classic" ? "Keyboard" : "Treadmill"} {isSelected && "✦"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Map Selection */}
              <div style={{ textAlign: "left", width: "100%", marginTop: 2 }}>
                <span style={{ fontSize: 12, color: "rgba(212,175,55,0.7)", fontWeight: 700, letterSpacing: "2px", fontFamily: "'Cinzel', serif" }}>
                  ACTIVE MAP
                </span>
                <div style={{ width: "200px", height: "1px", background: "rgba(212,175,55,0.35)", margin: "4px 0 8px 0" }} />
              {/* Single Journey Map — Pragjyotishpur */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                  <div
                    style={{
                      background: "rgba(139,30,15,0.22)",
                      border: "1px solid #d4af37",
                      padding: "10px 22px",
                      color: "#d4af37",
                      fontSize: "15px",
                      fontWeight: 700,
                      fontFamily: "'Cinzel', serif",
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      width: "240px",
                      textAlign: "left",
                      borderRadius: "4px",
                    }}
                  >
                    Pragjyotishpur ✦
                  </div>
                  <span style={{ fontSize: 11, color: "rgba(212,175,55,0.55)", fontFamily: "'Cinzel', serif", letterSpacing: "1px", paddingLeft: 4 }}>
                    AEC → Lachit Ghat → Forest → Sumato → Khanapara
                  </span>
                </div>
              </div>

              {/* Action row at bottom of setup */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, width: "100%", alignItems: "flex-start" }}>
                {[
                  { label: "START RUN", action: handleLaunch, isPrimary: true },
                  { label: "BACK", action: () => setMenuState("main"), isPrimary: false }
                ].map((btn, idx) => {
                  const targetFocusIdx = idx + 3; // maps to 3 or 4
                  const isFocused = focusIndex === targetFocusIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        btn.action();
                        playClickSfx();
                      }}
                      onMouseEnter={() => {
                        setFocusIndex(targetFocusIdx);
                        playHoverSfx();
                      }}
                      style={{
                        background: btn.isPrimary
                          ? "linear-gradient(90deg, rgba(139,30,15,0.92) 0%, rgba(161,44,30,0.92) 100%)"
                          : "rgba(0,0,0,0.45)",
                        border: isFocused
                          ? "2px solid #d4af37"
                          : btn.isPrimary
                            ? "1px solid rgba(212,175,55,0.45)"
                            : "1px solid rgba(212,175,55,0.22)",
                        boxShadow: isFocused ? "0 0 12px rgba(212, 175, 55, 0.4)" : "none",
                        transform: isFocused ? "scale(1.05) translateX(4px)" : "scale(1) translateX(0px)",
                        padding: "13px 26px",
                        color: "#ffffff",
                        fontSize: "14px",
                        fontWeight: 700,
                        fontFamily: "'Cinzel', serif",
                        letterSpacing: "2px",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        transition: "all 0.2s ease",
                        width: "260px",
                        textAlign: "left",
                        borderRadius: "6px",
                      }}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : menuState === "store" ? (
            /* Store page inside Sidebar */
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, color: "rgba(212,175,55,0.7)", fontWeight: 700, letterSpacing: "2px", fontFamily: "'Cinzel', serif" }}>THE BAZAAR</span>
                <div style={{ width: "200px", height: "1px", background: "rgba(212,175,55,0.35)", margin: "4px 0 10px 0" }} />
              </div>

              {/* List of Store items — rectangular bordered cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                {[
                  { name: "Royal Rampant Armour", price: 100, desc: "Immune to the obstacles", key: "royalrampant" },
                  { name: "Forest Ghat Map", price: 250, desc: "Unlock deep jungle biome", key: "forestghat" },
                  { name: "Magnet", price: 150, desc: "Autocollect near coins", key: "magnet" }
                ].map((item, idx) => {
                  const isFocused = focusIndex === idx;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        width: "260px",
                        padding: "12px 20px",
                        background: isFocused ? "rgba(212,175,55,0.08)" : "rgba(0,0,0,0.45)",
                        border: isFocused ? "2px solid #d4af37" : "1px solid rgba(212,175,55,0.22)",
                        boxShadow: isFocused ? "0 0 12px rgba(212, 175, 55, 0.4)" : "none",
                        transform: isFocused ? "scale(1.05) translateX(4px)" : "scale(1) translateX(0px)",
                        transition: "all 0.2s ease",
                        boxSizing: "border-box",
                        borderRadius: "6px",
                      }}
                      onMouseEnter={() => {
                        setFocusIndex(idx);
                        setHoveredStoreItem(item);
                        playHoverSfx();
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                        <span className="item-title" style={{ fontSize: 12.5, fontWeight: 700, color: isFocused ? "#d4af37" : "#fff", fontFamily: "'Cinzel', serif", letterSpacing: "1px", textTransform: "uppercase", transition: "color 0.2s ease" }}>{item.name}</span>
                        <span style={{ fontSize: 9.5, color: "rgba(255, 255, 255, 0.5)", fontFamily: "'Segoe UI', sans-serif", letterSpacing: "0.5px" }}>{item.desc}</span>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#d4af37", fontFamily: "'Cinzel', serif", marginLeft: 8, flexShrink: 0 }}>
                        {item.price}₹
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Return to main menu */}
              <button
                type="button"
                onClick={() => {
                  setMenuState("main");
                  playClickSfx();
                }}
                onMouseEnter={() => {
                  setFocusIndex(3);
                  setHoveredStoreItem(null);
                  playHoverSfx();
                }}
                style={{
                  background: "rgba(0,0,0,0.45)",
                  border: focusIndex === 3 ? "2px solid #d4af37" : "1px solid rgba(212,175,55,0.22)",
                  boxShadow: focusIndex === 3 ? "0 0 12px rgba(212, 175, 55, 0.4)" : "none",
                  transform: focusIndex === 3 ? "scale(1.05) translateX(4px)" : "scale(1) translateX(0px)",
                  padding: "13px 26px",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: "2px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "all 0.2s ease",
                  width: "260px",
                  textAlign: "left",
                  marginTop: 8,
                  borderRadius: "6px",
                }}
              >
                RETURN
              </button>
            </div>
          ) : menuState === "about" ? (
            /* About page inside Sidebar */
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, color: "rgba(212,175,55,0.7)", fontWeight: 700, letterSpacing: "2px", fontFamily: "'Cinzel', serif" }}>ABOUT THE GAME</span>
                <div style={{ width: "200px", height: "1px", background: "rgba(212,175,55,0.35)", margin: "4px 0 10px 0" }} />
              </div>
              <div style={{
                width: "260px",
                padding: "16px",
                background: "rgba(0,0,0,0.55)",
                border: "1px solid rgba(212,175,55,0.22)",
                borderRadius: "8px",
                color: "#f5ebcf",
                fontSize: "12px",
                lineHeight: "1.6",
                fontFamily: "'Segoe UI', sans-serif",
                textAlign: "justify",
              }}>
                Pragjyotishpur Tale is developed by a small group of 4 interns at Sumato Globaltech, it is an endless running simulation which supports keyboard control as well as treadmill, so step on your treadmill, run for a healthy life while living as The prince of Pragjyotishpura and get to the end to save your Princess from the Asuras.
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuState("main");
                  playClickSfx();
                }}
                onMouseEnter={() => {
                  playHoverSfx();
                }}
                style={{
                  background: "rgba(0,0,0,0.45)",
                  border: "2px solid #d4af37",
                  boxShadow: "0 0 12px rgba(212, 175, 55, 0.4)",
                  transform: "scale(1.05) translateX(4px)",
                  padding: "13px 26px",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: "2px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "all 0.2s ease",
                  width: "260px",
                  textAlign: "left",
                  marginTop: 8,
                  borderRadius: "6px",
                }}
              >
                RETURN
              </button>
            </div>
          ) : menuState === "help" ? (
            /* How to Play / Help Screen */
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", width: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, color: "rgba(212,175,55,0.7)", fontWeight: 700, letterSpacing: "2px", fontFamily: "'Cinzel', serif" }}>HOW TO PLAY</span>
                <div style={{ width: "200px", height: "1px", background: "rgba(212,175,55,0.35)", margin: "4px 0 10px 0" }} />
              </div>
              <div style={{
                width: "280px",
                padding: "14px",
                background: "rgba(0,0,0,0.65)",
                border: "1px solid rgba(212,175,55,0.22)",
                borderRadius: "8px",
                color: "#f5ebcf",
                fontSize: "11px",
                lineHeight: "1.5",
                fontFamily: "'Segoe UI', sans-serif",
                textAlign: "left",
                maxHeight: "360px",
                overflowY: "auto",
              }}>
                <div style={{ fontWeight: 800, color: "#ffd700", marginBottom: "4px" }}>CONTROLS</div>
                • <b>Spacebar</b>: Jump over spikes, fences, and rocks.<br />
                • <b>Control</b>: Slide under flying arrows.<br />
                • <b>Treadmill</b>: Step on the treadmill to run. Use the controller buttons to Jump & Slide.<br />
                
                <div style={{ fontWeight: 800, color: "#ffd700", marginTop: "10px", marginBottom: "4px" }}>COMBAT & RUNNING</div>
                • <b>Shatter Archers</b>: Slide directly through archers on the ground to dash them into the air!<br />
                • <b>Dodge Arrows</b>: Slide to duck under flying arrows at head/shoulder level.<br />
                
                <div style={{ fontWeight: 800, color: "#ffd700", marginTop: "10px", marginBottom: "4px" }}>POWER-UPS</div>
                • 🛡️ <b>Armour</b>: Protects you from one obstacle collision.<br />
                • 🧲 <b>Magnet</b>: Automatically attracts all nearby gold coins.
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuState("main");
                  playClickSfx();
                }}
                onMouseEnter={() => {
                  playHoverSfx();
                }}
                style={{
                  background: "rgba(0,0,0,0.45)",
                  border: "2px solid #d4af37",
                  boxShadow: "0 0 12px rgba(212, 175, 55, 0.4)",
                  transform: "scale(1.05) translateX(4px)",
                  padding: "13px 26px",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: "2px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "all 0.2s ease",
                  width: "260px",
                  textAlign: "left",
                  marginTop: 4,
                  borderRadius: "6px",
                }}
              >
                RETURN
              </button>
            </div>
          ) : null}
        </div>

        {/* Footer Credit Tagline */}
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "left", letterSpacing: 0.5, fontFamily: "'Cinzel', serif" }}>
          [v1.0.9-Alpha] | © 2026 XYZ STUDIO , All Rights Reserved.
        </div>
      </div>

      {/* Floating Map Preview Card — Pragjyotishpur */}
      {menuState === "setup" && hoveredMap === "background" && (
        <div
          className="map-preview-card"
          style={{
            position: "absolute",
            top: "50%",
            left: "min(470px, 94vw)",
            transform: "translateY(-50%)",
            zIndex: 99,
            background: "rgba(8, 12, 18, 0.95)",
            border: "2px solid #d4af37",
            borderRadius: "12px",
            padding: "16px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.7)",
            width: "min(360px, 90vw)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            pointerEvents: "none",
            animation: "fadeIn 0.25s ease-out forwards",
          }}
        >
          <h4 style={{
            margin: 0,
            fontSize: 14,
            fontFamily: "'Cinzel', serif",
            color: "#d4af37",
            letterSpacing: "1px",
            textTransform: "uppercase",
            borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
            paddingBottom: "6px"
          }}>
            Pragjyotishpur — Full Journey
          </h4>
          <div style={{
            width: "100%",
            height: "180px",
            borderRadius: "6px",
            background: "url(/background_overcast.jpeg) center center / cover no-repeat",
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }} />
          <p style={{
            margin: 0,
            fontSize: 11,
            color: "#f5ebcf",
            fontFamily: "'Segoe UI', sans-serif",
            lineHeight: "1.4",
            textAlign: "left"
          }}>
            A single epic journey through all of Pragjyotishpura — from AEC and Kamakhya to Lachit Ghat, through the Forest, past Sumato Campus, and finally to the hills of Khanapara.
          </p>
        </div>
      )}

      {/* Floating Store Item Preview Card */}
      {menuState === "store" && hoveredStoreItem && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "min(470px, 94vw)",
          transform: "translateY(-50%)",
          zIndex: 99,
          background: "rgba(8, 12, 18, 0.95)",
          border: "2px solid #d4af37",
          borderRadius: "12px",
          padding: "16px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.7)",
          width: "min(360px, 90vw)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          pointerEvents: "none",
          animation: "fadeIn 0.25s ease-out forwards",
        }}>
          <h4 style={{
            margin: 0,
            fontSize: 14,
            fontFamily: "'Cinzel', serif",
            color: "#d4af37",
            letterSpacing: "1px",
            textTransform: "uppercase",
            borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
            paddingBottom: "6px",
            textAlign: "left"
          }}>
            {hoveredStoreItem.name} {hoveredStoreItem.key === "royalrampant" && "(Coming Soon)"}
          </h4>
          <div style={{
            width: "100%",
            height: "180px",
            borderRadius: "6px",
            background: `rgba(0, 0, 0, 0.4) url(${hoveredStoreItem.key === "royalrampant"
              ? "/sprites/Powerups/royalrampant_armour.png"
              : hoveredStoreItem.key === "magnet"
                ? "/sprites/Powerups/magnet_pwup.png"
                : "/Wallpaper.jpg"
              }) center center / contain no-repeat`,
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }} />
          <p style={{
            margin: 0,
            fontSize: 11,
            color: "#f5ebcf",
            fontFamily: "'Segoe UI', sans-serif",
            lineHeight: "1.4",
            textAlign: "left"
          }}>
            {hoveredStoreItem.desc}
          </p>
        </div>
      )}

      {/* Canvas overlay for floating debris sparks */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          pointerEvents: "none",
        }}
      />

    </main>
  );
}
