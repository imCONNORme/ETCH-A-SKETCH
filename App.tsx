import { useRef, useState, useCallback, useEffect } from "react";

const LINE_COLOR = "#3a3a3a";
const LINE_WIDTH = 1.5;
const SCREEN_BG = "#c0c0c0";
const STEP = 2;
const ASPECT_RATIO = 4 / 3; // width / height of the classic toy

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const [leftAngle, setLeftAngle] = useState(0);
  const [rightAngle, setRightAngle] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [screenOpacity, setScreenOpacity] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 400 });
  const [toySize, setToySize] = useState({ w: 800, h: 600 });
  const leftDragging = useRef(false);
  const rightDragging = useRef(false);
  const lastMouseAngle = useRef({ left: 0, right: 0 });
  const keysPressed = useRef(new Set<string>());
  const animFrameRef = useRef<number>(0);

  // Compute layout: fit the toy at fixed aspect ratio within viewport
  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let toyW: number, toyH: number;
      if (vw / vh > ASPECT_RATIO) {
        // Viewport is wider than toy — fit to height
        toyH = vh;
        toyW = vh * ASPECT_RATIO;
      } else {
        // Viewport is taller than toy — fit to width
        toyW = vw;
        toyH = vw / ASPECT_RATIO;
      }

      // Canvas takes ~72% of toy width and ~50% of toy height
      const cw = Math.floor(toyW * 0.72);
      const ch = Math.floor(toyH * 0.50);

      setToySize({ w: toyW, h: toyH });
      setCanvasSize({ w: Math.max(200, cw), h: Math.max(120, ch) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = SCREEN_BG;
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
    posRef.current = { x: canvasSize.w / 2, y: canvasSize.h / 2 };
    ctx.fillStyle = LINE_COLOR;
    ctx.beginPath();
    ctx.arc(posRef.current.x, posRef.current.y, 1, 0, Math.PI * 2);
    ctx.fill();
  }, [canvasSize]);

  const drawLine = useCallback((dx: number, dy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const prev = { ...posRef.current };
    posRef.current.x = Math.max(0, Math.min(canvas.width, posRef.current.x + dx));
    posRef.current.y = Math.max(0, Math.min(canvas.height, posRef.current.y + dy));
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(posRef.current.x, posRef.current.y);
    ctx.stroke();
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };

    const tick = () => {
      let dx = 0, dy = 0;
      if (keysPressed.current.has("ArrowLeft")) { dx -= STEP; setLeftAngle(a => a - 3); }
      if (keysPressed.current.has("ArrowRight")) { dx += STEP; setLeftAngle(a => a + 3); }
      if (keysPressed.current.has("ArrowUp")) { dy -= STEP; setRightAngle(a => a - 3); }
      if (keysPressed.current.has("ArrowDown")) { dy += STEP; setRightAngle(a => a + 3); }
      if (dx !== 0 || dy !== 0) drawLine(dx, dy);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawLine]);

  // Clear / Shake
  const clearScreen = useCallback(() => {
    if (isShaking) return;
    setIsShaking(true);

    let opacity = 1;
    const fadeInterval = setInterval(() => {
      opacity -= 0.05;
      setScreenOpacity(Math.max(0, opacity));
      if (opacity <= 0) {
        clearInterval(fadeInterval);
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = SCREEN_BG;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        posRef.current = { x: canvasSize.w / 2, y: canvasSize.h / 2 };
        setScreenOpacity(1);
        setTimeout(() => setIsShaking(false), 200);
      }
    }, 40);
  }, [isShaking, canvasSize]);

  // Dial interaction helpers
  const getAngleFromEvent = (e: React.MouseEvent | MouseEvent, dialElement: HTMLElement) => {
    const rect = dialElement.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
  };

  const handleLeftDialDown = (e: React.MouseEvent) => {
    leftDragging.current = true;
    const dial = e.currentTarget as HTMLElement;
    lastMouseAngle.current.left = getAngleFromEvent(e, dial);

    const onMove = (ev: MouseEvent) => {
      if (!leftDragging.current) return;
      const newAngle = getAngleFromEvent(ev, dial);
      let delta = newAngle - lastMouseAngle.current.left;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastMouseAngle.current.left = newAngle;
      setLeftAngle(a => a + delta);
      drawLine(delta * 0.3, 0);
    };
    const onUp = () => {
      leftDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleRightDialDown = (e: React.MouseEvent) => {
    rightDragging.current = true;
    const dial = e.currentTarget as HTMLElement;
    lastMouseAngle.current.right = getAngleFromEvent(e, dial);

    const onMove = (ev: MouseEvent) => {
      if (!rightDragging.current) return;
      const newAngle = getAngleFromEvent(ev, dial);
      let delta = newAngle - lastMouseAngle.current.right;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastMouseAngle.current.right = newAngle;
      setRightAngle(a => a + delta);
      drawLine(0, delta * 0.3);
    };
    const onUp = () => {
      rightDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Scale dial size relative to toy
  const dialSize = Math.max(40, toySize.w * 0.085);
  const screwSize = Math.max(10, toySize.w * 0.018);

  return (
    <div
      className="select-none overflow-hidden flex items-center justify-center"
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        background: "#1a1a1a",
      }}
    >
      <style>{`
        html, body, #root {
          margin: 0;
          padding: 0;
          overflow: hidden;
          width: 100%;
          height: 100%;
        }
        @keyframes shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-12px, -8px) rotate(-2deg); }
          20% { transform: translate(10px, 12px) rotate(1.5deg); }
          30% { transform: translate(-14px, 6px) rotate(-1.5deg); }
          40% { transform: translate(12px, -10px) rotate(2deg); }
          50% { transform: translate(-8px, 8px) rotate(-2.5deg); }
          60% { transform: translate(14px, -6px) rotate(1.5deg); }
          70% { transform: translate(-10px, 10px) rotate(-1deg); }
          80% { transform: translate(8px, -8px) rotate(2deg); }
          90% { transform: translate(-6px, 6px) rotate(-1.5deg); }
        }
        .animate-shake {
          animation: shake 0.8s ease-in-out;
        }
        .dial-knob {
          cursor: grab;
          touch-action: none;
        }
        .dial-knob:active {
          cursor: grabbing;
        }
      `}</style>

      {/* Etch A Sketch body — fixed aspect ratio, centered */}
      <div
        className={`relative flex flex-col ${isShaking ? "animate-shake" : ""}`}
        style={{
          width: `${toySize.w}px`,
          height: `${toySize.h}px`,
          background: "linear-gradient(160deg, #e03030 0%, #d42426 15%, #c41e20 40%, #b01a1c 70%, #9e1618 100%)",
          borderRadius: `${toySize.w * 0.025}px`,
          boxShadow: `
            inset 0 2px 8px rgba(255,255,255,0.15),
            inset 0 -4px 12px rgba(0,0,0,0.2),
            0 8px 40px rgba(0,0,0,0.6),
            0 2px 10px rgba(0,0,0,0.4)
          `,
          overflow: "hidden",
        }}
      >
        {/* Top shine */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{
            height: `${toySize.h * 0.01}px`,
            background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)",
            borderRadius: `${toySize.w * 0.025}px ${toySize.w * 0.025}px 0 0`,
          }}
        />

        {/* Corner screws — top */}
        <div
          className="absolute flex justify-between pointer-events-none"
          style={{ top: `${toySize.h * 0.025}px`, left: `${toySize.w * 0.025}px`, right: `${toySize.w * 0.025}px` }}
        >
          <Screw size={screwSize} />
          <Screw size={screwSize} />
        </div>

        {/* Corner screws — bottom */}
        <div
          className="absolute flex justify-between pointer-events-none"
          style={{ bottom: `${toySize.h * 0.025}px`, left: `${toySize.w * 0.025}px`, right: `${toySize.w * 0.025}px` }}
        >
          <Screw size={screwSize} />
          <Screw size={screwSize} />
        </div>

        {/* Logo area */}
        <div
          className="flex-shrink-0 flex flex-col items-center"
          style={{ paddingTop: `${toySize.h * 0.04}px`, paddingBottom: `${toySize.h * 0.015}px` }}
        >
          <h1
            className="font-bold"
            style={{
              fontSize: `${toySize.w * 0.035}px`,
              color: "#ffd700",
              textShadow: "0 2px 4px rgba(0,0,0,0.4), 0 0 20px rgba(255,215,0,0.2)",
              fontFamily: "'Georgia', serif",
              letterSpacing: `${toySize.w * 0.012}px`,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            ETCH A SKETCH
          </h1>
          <div
            style={{
              width: `${toySize.w * 0.24}px`,
              height: "2px",
              marginTop: `${toySize.h * 0.008}px`,
              background: "linear-gradient(90deg, transparent, #ffd700, transparent)",
            }}
          />
          <p
            style={{
              marginTop: `${toySize.h * 0.006}px`,
              color: "rgba(255,215,0,0.65)",
              fontSize: `${toySize.w * 0.013}px`,
              letterSpacing: `${toySize.w * 0.008}px`,
              fontFamily: "'Georgia', serif",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              whiteSpace: "nowrap",
            }}
          >
            MAGIC SCREEN
          </p>
        </div>

        {/* Screen section */}
        <div
          className="flex-1 flex items-center justify-center"
          style={{ padding: `0 ${toySize.w * 0.05}px` }}
        >
          {/* Screen frame (gray bezel) */}
          <div
            style={{
              width: `${canvasSize.w + toySize.w * 0.04}px`,
              height: `${canvasSize.h + toySize.w * 0.04}px`,
              background: "linear-gradient(155deg, #9a9a9a, #7a7a7a, #686868)",
              borderRadius: `${toySize.w * 0.012}px`,
              padding: `${toySize.w * 0.02}px`,
              boxShadow: `
                inset 0 3px 8px rgba(0,0,0,0.5),
                inset 0 -1px 4px rgba(255,255,255,0.1),
                0 2px 6px rgba(0,0,0,0.3)
              `,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Inner screen */}
            <div
              style={{
                width: `${canvasSize.w}px`,
                height: `${canvasSize.h}px`,
                borderRadius: `${toySize.w * 0.006}px`,
                overflow: "hidden",
                boxShadow: "inset 0 3px 12px rgba(0,0,0,0.35), inset 0 -2px 4px rgba(255,255,255,0.08)",
              }}
            >
              <canvas
                ref={canvasRef}
                width={canvasSize.w}
                height={canvasSize.h}
                style={{
                  display: "block",
                  width: `${canvasSize.w}px`,
                  height: `${canvasSize.h}px`,
                  opacity: screenOpacity,
                  background: SCREEN_BG,
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom control area */}
        <div
          className="flex-shrink-0 flex items-center justify-between"
          style={{
            padding: `${toySize.h * 0.03}px ${toySize.w * 0.08}px ${toySize.h * 0.045}px`,
          }}
        >
          {/* Left Dial */}
          <Dial angle={leftAngle} onMouseDown={handleLeftDialDown} size={dialSize} />

          {/* Center - Shake button */}
          <button
            onClick={clearScreen}
            className="transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(145deg, #ffd700, #daa520, #c8960e)",
              color: "#8b0000",
              border: "2px solid rgba(139,0,0,0.15)",
              borderRadius: `${toySize.w * 0.03}px`,
              padding: `${toySize.h * 0.015}px ${toySize.w * 0.04}px`,
              fontSize: `${toySize.w * 0.014}px`,
              fontWeight: "bold",
              letterSpacing: `${toySize.w * 0.003}px`,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.35), inset 0 1px 3px rgba(255,255,255,0.5), inset 0 -1px 2px rgba(0,0,0,0.2)",
              fontFamily: "'Georgia', serif",
              whiteSpace: "nowrap",
            }}
          >
            SHAKE TO CLEAR
          </button>

          {/* Right Dial */}
          <Dial angle={rightAngle} onMouseDown={handleRightDialDown} size={dialSize} />
        </div>

        {/* Bottom edge branding */}
        <div
          className="absolute bottom-0 left-0 right-0 text-center pointer-events-none"
          style={{ paddingBottom: `${toySize.h * 0.01}px` }}
        >
          <span
            style={{
              fontSize: `${toySize.w * 0.01}px`,
              color: "rgba(255,215,0,0.3)",
              fontFamily: "'Georgia', serif",
              letterSpacing: `${toySize.w * 0.004}px`,
            }}
          >
            OHIO ART
          </span>
        </div>
      </div>
    </div>
  );
}

function Dial({ angle, onMouseDown, size }: { angle: number; onMouseDown: (e: React.MouseEvent) => void; size: number }) {
  const gripCount = Math.max(8, Math.round(size / 7));

  return (
    <div
      className="dial-knob relative"
      onMouseDown={onMouseDown}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: `
          radial-gradient(circle at 35% 35%, #ffffff 0%, #f0f0f0 10%, #e0e0e0 25%, #c8c8c8 45%, #aaaaaa 70%, #888888 100%)
        `,
        boxShadow: `
          0 6px 18px rgba(0,0,0,0.45),
          0 2px 5px rgba(0,0,0,0.35),
          inset 0 2px 4px rgba(255,255,255,0.7),
          inset 0 -3px 6px rgba(0,0,0,0.25)
        `,
        transform: `rotate(${angle}deg)`,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {/* Grip lines */}
      {Array.from({ length: gripCount }).map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            width: `${Math.max(1.5, size * 0.025)}px`,
            height: `${size * 0.1}px`,
            background: "rgba(0,0,0,0.2)",
            borderRadius: "1px",
            top: `${size * 0.06}px`,
            left: "50%",
            transformOrigin: `center ${size * 0.44}px`,
            transform: `translateX(-50%) rotate(${i * (360 / gripCount)}deg)`,
          }}
        />
      ))}
      {/* Center cap */}
      <div
        className="absolute"
        style={{
          width: `${size * 0.18}px`,
          height: `${size * 0.18}px`,
          borderRadius: "50%",
          background: "radial-gradient(circle at 40% 40%, #e8e8e8, #aaa, #888)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.35), 0 1px 1px rgba(255,255,255,0.3)",
        }}
      />
      {/* Indicator notch */}
      <div
        className="absolute"
        style={{
          width: `${Math.max(2.5, size * 0.04)}px`,
          height: `${size * 0.16}px`,
          background: "linear-gradient(180deg, #555, #777)",
          borderRadius: "2px",
          top: `${size * 0.08}px`,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
}

function Screw({ size = 16 }: { size?: number }) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "radial-gradient(circle at 38% 38%, #e0e0e0, #999, #777)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(255,255,255,0.1)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: `${size * 0.55}px`,
          height: `${size * 0.1}px`,
          background: "#666",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(35deg)",
          borderRadius: "1px",
        }}
      />
    </div>
  );
}
