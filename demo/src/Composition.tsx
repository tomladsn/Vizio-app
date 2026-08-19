import React from "react";
import {
  AbsoluteFill,
  Composition,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
  staticFile,
} from "remotion";

// ============== COLORS ==============
const COLORS = {
  bg: "#0B0F1A",
  bgCard: "#121826",
  cyan: "#22D3EE",
  purple: "#A855F7",
  pink: "#EC4899",
  white: "#F8FAFC",
  muted: "#94A3B8",
  green: "#10B981",
  border: "#1E293B",
  terminalBg: "#0A0E17",
};

// ============== TYPEWRITER ==============
const useTypewriter = (text: string, startFrame: number, speed = 1.7) => {
  const frame = useCurrentFrame();
  const progress = Math.max(0, frame - startFrame);
  const chars = Math.floor(progress * speed);
  return text.slice(0, Math.min(chars, text.length));
};

// ============== MOUSE CURSOR ==============
const MouseCursor: React.FC<{
  x: number;
  y: number;
  clicking?: boolean;
  visible?: boolean;
}> = ({ x, y, clicking = false, visible = true }) => {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 40,
        height: 36,
        pointerEvents: "none",
        zIndex: 200,
        transform: clicking ? "scale(0.8)" : "scale(1)",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
      }}
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <path
          d="M5.5 3.21V20.8c0 .10.0.2.2.35l4.86-4.86 2.25 5.9c.10.0.0.1.47.24.13 0 .26-.05.35-.15l1.4-1.4c.1-.1.15-.23.15-.35 0-.08-.02-.16-.06-.23l-2.2-5.78h6.1c.25 0 .45-.2.45-.45 0-.13-.06-.25-.15-.33L6.2 2.85A.48.48 0 005.5 3.21z"
          fill="white"
          stroke="#111"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};

// ============== PART 1: CHAT + MOUSE CLICKS ==============
const ChatScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const fullText = "@[main demo.mp4] make a lossless remux of this video";
  const typed = useTypewriter(fullText, 20, 1.9);

  // ===== TIMELINE =====
  // 0-20      empty
  // 20-100    typing in input
  // 100-120   mouse → send button
  // 120-130   click send
  // 140       user bubble appears
  // 165       workflow card appears
  // 210-235   mouse → Allow button
  // 235-245   click Allow
  // 250+      ready for transition

  const mouseToSendStart = 100;
  const clickSend = 122;
  const messageAppear = 140;
  const workflowAppear = 165;
  const mouseToAllowStart = 210;
  const clickAllow = 238;

  // Mouse positions
  let mouseX = width * 0.5;
  let mouseY = height - 180;
  let isClicking = false;
  let mouseVisible = false;

  if (frame >= mouseToSendStart && frame < messageAppear + 20) {
    // Move to send button
    mouseVisible = true;
    mouseX = interpolate(
      frame,
      [mouseToSendStart, clickSend - 5],
      [width * 0.45, width - 105],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    mouseY = interpolate(
      frame,
      [mouseToSendStart, clickSend - 5],
      [height - 190, height - 100],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    isClicking = frame >= clickSend && frame < clickSend + 10;
  } else if (frame >= mouseToAllowStart) {
    // Move to Allow button
    mouseVisible = true;
    // Allow button is roughly left-center of the card
    mouseX = interpolate(
      frame,
      [mouseToAllowStart, clickAllow - 6],
      [width - 105, width * 0.28],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    mouseY = interpolate(
      frame,
      [mouseToAllowStart, clickAllow - 6],
      [height - 100, height * 0.3],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    isClicking = frame >= clickAllow && frame < clickAllow + 12;
  }

  const bubbleSpring = spring({
    frame: frame - messageAppear,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  const workflowSpring = spring({
    frame: frame - workflowAppear,
    fps,
    config: { damping: 14, stiffness: 110 },
  });

  // Highlight Allow button when mouse is near / clicking
  const allowHighlight =
    frame >= mouseToAllowStart && frame < clickAllow + 20;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: "rgba(11,15,26,0.95)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: COLORS.border,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              color: COLORS.muted,
            }}
          >
            ☰
          </div>
          <span
            style={{
              color: COLORS.white,
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            New chat
          </span>
        </div>
        <div
          style={{
            background: COLORS.border,
            padding: "14px 24px",
            borderRadius: 99,
            color: COLORS.muted,
            fontSize: 20,
            fontWeight: 500,
          }}
        >
          + New chat
        </div>
      </div>
      {/* Messages area */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 0,
          right: 0,
          bottom: 210,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "24px 36px",
          gap: 28,
        }}
      >
        {/* User bubble */}
        {frame >= messageAppear && (
          <div
            style={{
              alignSelf: "flex-end",
              maxWidth: "90%",
              background: "linear-gradient(135deg, #0E7490, #0891B2)",
              color: COLORS.white,
              padding: "24px 30px",
              borderRadius: "26px 26px 8px 26px",
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.45,
              boxShadow: "0 12px 40px rgba(8,145,178,0.4)",
              opacity: bubbleSpring,
              transform: `translateY(${interpolate(bubbleSpring, [0, 1], [36, 0])}px) scale(${interpolate(bubbleSpring, [0, 1], [0.95, 1])})`,
            }}
          >
            {fullText}
          </div>
        )}

        {/* Workflow Ready card */}
        {frame >= workflowAppear && (
          <div
            style={{
              alignSelf: "flex-start",
              width: "100%",
              background: COLORS.bgCard,
              border: `1.5px solid ${COLORS.cyan}55`,
              borderRadius: 28,
              padding: "34px 32px",
              opacity: workflowSpring,
              transform: `translateY(${interpolate(workflowSpring, [0, 1], [50, 0])}px) scale(${interpolate(workflowSpring, [0, 1], [0.94, 1])})`,
              boxShadow: `0 18px 50px rgba(34,211,238,0.15)`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: COLORS.green,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    boxShadow: `0 0 20px ${COLORS.green}99`,
                  }}
                >
                  ✓
                </div>
                <span
                  style={{
                    color: COLORS.white,
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Workflow ready
                </span>
              </div>
              <div
                style={{
                  background: COLORS.border,
                  padding: "9px 18px",
                  borderRadius: 99,
                  color: COLORS.muted,
                  fontSize: 18,
                  fontWeight: 500,
                }}
              >
                1 step
              </div>
            </div>

            <p
              style={{
                color: COLORS.muted,
                fontSize: 23,
                lineHeight: 1.5,
                marginBottom: 26,
              }}
            >
              Remuxing main demo.mp4 losslessly to the output directory.
            </p>

            <div
              style={{
                background: "#0F172A",
                borderRadius: 18,
                padding: "22px 24px",
                display: "flex",
                alignItems: "center",
                gap: 18,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: COLORS.cyan,
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 22,
                }}
              >
                1
              </div>
              <span
                style={{ color: COLORS.white, fontSize: 24, fontWeight: 500 }}
              >
                Lossless remux of main demo.mp4
              </span>
            </div>

            {/* Buttons */}
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 30,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #EC4899, #DB2777)",
                  color: "white",
                  padding: "22px 0",
                  borderRadius: 16,
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: 24,
                  boxShadow: allowHighlight
                    ? "0 0 0 6px rgba(236,72,153,0.35), 0 10px 32px rgba(236,72,153,0.45)"
                    : "0 10px 32px rgba(236,72,153,0.4)",
                  transform:
                    frame >= clickAllow && frame < clickAllow + 12
                      ? "scale(0.96)"
                      : "scale(1)",
                }}
              >
                ✓ Allow
              </div>
              <div
                style={{
                  flex: 1,
                  background: COLORS.border,
                  color: COLORS.muted,
                  padding: "22px 0",
                  borderRadius: 16,
                  textAlign: "center",
                  fontWeight: 600,
                  fontSize: 24,
                }}
              >
                Dismiss
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Bottom input bar */}
      <div
        style={{
          position: "absolute",
          bottom: 55,
          left: 36,
          right: 36,
          height: 96,
          background: COLORS.bgCard,
          borderRadius: 99,
          border: `1.5px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 26px",
          gap: 18,
        }}
      >
        <div style={{ fontSize: 34 }}>🖼</div>
        <div style={{ fontSize: 34 }}>★</div>

        <div
          style={{
            flex: 1,
            color: typed.length > 0 ? COLORS.white : COLORS.muted,
            fontSize: 24,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            letterSpacing: "-0.01em",
          }}
        >
          {typed.length > 0 ? typed : "Describe an edit or ask anything..."}
          {frame > 20 && frame < 100 && (
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 28,
                background: COLORS.cyan,
                marginLeft: 3,
                verticalAlign: "middle",
                opacity: Math.floor(frame / 7) % 2 === 0 ? 1 : 0,
              }}
            />
          )}
        </div>

        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #EC4899, #DB2777)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            boxShadow:
              frame >= clickSend && frame < clickSend + 18
                ? "0 0 0 10px rgba(236,72,153,0.3)"
                : "0 8px 24px rgba(236,72,153,0.35)",
            transform:
              frame >= clickSend && frame < clickSend + 10
                ? "scale(0.88)"
                : "scale(1)",
          }}
        >
          ↑
        </div>
      </div>
      {/* Mouse */}
      <MouseCursor
        x={mouseX}
        y={mouseY}
        clicking={isClicking}
        visible={mouseVisible}
      />
    </AbsoluteFill>
  );
};

// ============== PART 2: EXECUTION ==============
const ExecutionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(frame, [25, 165], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const cardSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 16 },
  });

  const showLine = (threshold: number) => frame > threshold;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: "50px 36px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          background: COLORS.bgCard,
          borderRadius: 24,
          border: `1px solid ${COLORS.border}`,
          padding: "32px 28px",
          opacity: cardSpring,
          transform: `translateY(${interpolate(cardSpring, [0, 1], [40, 0])}px)`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            color: COLORS.muted,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "0.08em",
            marginBottom: 18,
          }}
        >
          STEPS
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 26,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: COLORS.cyan,
                color: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 22,
              }}
            >
              1
            </div>
            <span
              style={{
                color: COLORS.white,
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Lossless Remux
            </span>
          </div>
          <div
            style={{
              background:
                progress >= 100
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(34,211,238,0.12)",
              color: progress >= 100 ? COLORS.green : COLORS.cyan,
              padding: "9px 18px",
              borderRadius: 99,
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {progress >= 100 ? "completed" : "running"}
          </div>
        </div>

        <div
          style={{
            color: COLORS.muted,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.06em",
            marginBottom: 10,
          }}
        >
          ATTEMPT 1
        </div>

        <div
          style={{
            background: "#0F172A",
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 14,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              color: COLORS.muted,
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 10,
              letterSpacing: "0.05em",
            }}
          >
            COMMAND
          </div>
          <div
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: 16,
              color: COLORS.cyan,
              lineHeight: 1.55,
              wordBreak: "break-all",
            }}
          >
            ffmpeg -i "main demo.mp4" -c copy -map 0 "output/main demo -
            lossless.mp4"
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <span
            style={{
              color: progress >= 100 ? COLORS.green : COLORS.muted,
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            exit {progress >= 100 ? "0 ✓" : "..."}
          </span>
          {progress >= 100 && (
            <span style={{ color: COLORS.green, fontSize: 18 }}>
              Completed (exit 0)
            </span>
          )}
        </div>

        <div
          style={{
            color: COLORS.muted,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.06em",
            marginBottom: 10,
          }}
        >
          TERMINAL LOG
        </div>

        <div
          style={{
            flex: 1,
            background: COLORS.terminalBg,
            borderRadius: 16,
            padding: "18px 20px",
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: 15,
            lineHeight: 1.65,
            color: "#CBD5E1",
            overflow: "hidden",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {showLine(30) && <div>Input #0, mov,mp4, from 'main demo.mp4':</div>}
          {showLine(45) && (
            <div style={{ color: "#94A3B8" }}>
              &nbsp;&nbsp;Duration: 00:00:42.18, start: 0.000000, bitrate: 8124
              kb/s
            </div>
          )}
          {showLine(60) && <div>Stream #0:0 → #0:0 (copy)</div>}
          {showLine(75) && <div>Stream #0:1 → #0:1 (copy)</div>}
          {showLine(95) && (
            <div style={{ color: COLORS.cyan }}>
              Output #0, mp4, to 'output/main demo - lossless.mp4':
            </div>
          )}
          {showLine(115) && <div>[mp4 @ ...] Starting second pass...</div>}
          {showLine(135) && (
            <div>
              frame= 1265 fps=0.0 q=-1.0 size= 42800kB time=00:00:42.15
              bitrate=8120.3kbits/s
            </div>
          )}
          {showLine(155) && (
            <div style={{ color: COLORS.green, marginTop: 8 }}>
              video:42156kB audio:612kB subtitle:0kB other streams:0kB
            </div>
          )}
          {showLine(165) && (
            <div style={{ color: COLORS.green }}>
              ✓ Remux completed successfully (exit 0)
            </div>
          )}
        </div>

        <div style={{ marginTop: 22 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span style={{ color: COLORS.muted, fontSize: 16 }}>
              {progress >= 100 ? "Done" : "Processing..."}
            </span>
            <span
              style={{
                color: COLORS.cyan,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {Math.round(progress)}%
            </span>
          </div>
          <div
            style={{
              height: 10,
              background: "#1E293B",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.purple})`,
                borderRadius: 99,
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============== PART 3: LOGO ==============
const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 13, stiffness: 95 },
  });

  const textOpacity = interpolate(frame, [18, 38], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(168,85,247,0.18) 0%, rgba(34,211,238,0.08) 45%, transparent 70%)",
        }}
      />

      <div
        style={{
          transform: `scale(${logoScale})`,
          filter:
            "drop-shadow(0 0 50px rgba(34,211,238,0.45)) drop-shadow(0 0 90px rgba(168,85,247,0.3))",
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{ width: 460, height: 460, objectFit: "contain" }}
        />
      </div>

      <h1
        style={{
          marginTop: 16,
          fontSize: 68,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: "-0.03em",
          opacity: textOpacity,
        }}
      >
        Vizio
      </h1>
      <p
        style={{
          fontSize: 28,
          color: COLORS.muted,
          opacity: textOpacity,
        }}
      >
        Your AI media agent
      </p>

      <div
        style={{
          marginTop: 48,
          background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.purple})`,
          color: "white",
          fontSize: 26,
          fontWeight: 700,
          padding: "22px 60px",
          borderRadius: 99,
          opacity: interpolate(frame, [32, 52], [0, 1]),
          boxShadow: `0 14px 44px rgba(34,211,238,0.4)`,
        }}
      >
        Download now
      </div>
    </AbsoluteFill>
  );
};

// ============== BETTER TRANSITIONS ==============
const ScaleSlideTransition: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [0, 22], [0.92, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const translateY = interpolate(frame, [0, 22], [50, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
      }}>
      {children}
    </AbsoluteFill>
  );
};

// ============== MAIN ==============
export const MyComponent: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* PART 1 - Chat (longer to allow second mouse click) */}
      <Sequence from={0} durationInFrames={290}>
        <ScaleSlideTransition>
          <ChatScene />
        </ScaleSlideTransition>
      </Sequence>
      {/* PART 2 - Execution */}
      <Sequence from={275} durationInFrames={220}>
        <ScaleSlideTransition>
          <ExecutionScene />
        </ScaleSlideTransition>
      </Sequence>
      {/* PART 3 - Logo */}
      <Sequence from={480} durationInFrames={160}>
        <ScaleSlideTransition>
          <LogoScene />
        </ScaleSlideTransition>
      </Sequence>
    </AbsoluteFill>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="VizioReels"
      component={MyComponent}
      durationInFrames={640}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
