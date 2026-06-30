import React, { useEffect, useRef } from 'react'
import { staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

// ── Brand colors — all extracted from icon.png logo ───────────────────────────
// The logo has 5 distinct color families:
// 1. Deep purple → violet (left film strip)
// 2. Indigo (reddish-blue bridge between purple and blue, visible in waveform bars)
// 3. Steel blue → teal (right film strip)
// 4. Pearl silver (chat bubble)
// 5. White (sparkle stars)
const C = {
  black:      '#000000',
  deepPurple: '#5B1A9A',   // darkest purple, top-left of left strip
  violet:     '#8B35CC',   // main purple body of left strip
  midViolet:  '#A050DC',   // lighter purple highlight
  indigo:     '#6020B8',   // reddish-blue — waveform bar midpoint, visible where purple meets blue
  indigoMid:  '#7830C8',   // slightly lighter indigo for gradients
  steelBlue:  '#1A3A6B',   // dark blue, top of right strip
  teal:       '#1B8FAD',   // mid teal, body of right strip
  brightTeal: '#1B9FD4',   // bright teal, play button glow
  waveBlue:   '#4A6BC8',   // waveform bar blue
  pearl:      '#C8D8E8',   // chat bubble silver-white
  pearlDim:   'rgba(200,216,232,0.5)',
  pearlFaint: 'rgba(200,216,232,0.25)',
  white:      '#FFFFFF',
}

const FONT_DISPLAY = "'Sora','Outfit','Plus Jakarta Sans',system-ui,sans-serif"
const FONT_BODY    = "'DM Sans','Inter',system-ui,sans-serif"
const FONT_MONO    = "'JetBrains Mono','Fira Code',monospace"

function easeOut(t: number) {
  const c = Math.min(Math.max(t, 0), 1)
  return 1 - Math.pow(1 - c, 3)
}
function easeInOut(t: number) {
  const c = Math.min(Math.max(t, 0), 1)
  return c < 0.5 ? 4*c*c*c : 1 - Math.pow(-2*c+2, 3)/2
}
function p(frame: number, start: number, dur: number) {
  return Math.min(Math.max((frame - start) / dur, 0), 1)
}

// ── Aurora canvas — uses all 5 color families including indigo ───────────────
const WAVES = [
  // Purple family
  { r:91,  g:26,  b:154, amp:52, freq:0.010, phase:0.0,  yR:0.37, lw:5.0, a:0.30 },
  { r:139, g:53,  b:204, amp:38, freq:0.016, phase:0.9,  yR:0.42, lw:2.8, a:0.24 },
  { r:160, g:80,  b:220, amp:26, freq:0.024, phase:2.5,  yR:0.44, lw:1.8, a:0.17 },
  // Indigo — reddish-blue bridge waves
  { r:96,  g:32,  b:184, amp:34, freq:0.019, phase:1.3,  yR:0.46, lw:2.2, a:0.21 },
  { r:120, g:48,  b:200, amp:22, freq:0.027, phase:3.1,  yR:0.48, lw:1.4, a:0.15 },
  // Blue-teal family
  { r:27,  g:143, b:173, amp:44, freq:0.013, phase:1.6,  yR:0.58, lw:3.8, a:0.26 },
  { r:27,  g:107, b:138, amp:32, freq:0.020, phase:2.2,  yR:0.54, lw:2.2, a:0.20 },
  { r:26,  g:58,  b:107, amp:24, freq:0.028, phase:3.3,  yR:0.51, lw:1.5, a:0.14 },
  { r:74,  g:107, b:200, amp:58, freq:0.007, phase:0.5,  yR:0.49, lw:6.5, a:0.10 },
  // Pearl shimmer wave
  { r:200, g:216, b:232, amp:14, freq:0.038, phase:1.2,  yR:0.47, lw:0.8, a:0.08 },
]

const FILM_FRAMES = [
  // Purple film frames (left side)
  { xR:0.06, yR:0.20, w:96, h:66, a:0.32, tilt:-8,  c1:[91,26,154],   c2:[139,53,204]  },
  { xR:0.13, yR:0.74, w:76, h:54, a:0.20, tilt:6,   c1:[96,32,184],   c2:[91,26,154]   },
  { xR:0.03, yR:0.52, w:58, h:42, a:0.15, tilt:5,   c1:[139,53,204],  c2:[74,107,200]  },
  // Teal film frames (right side)
  { xR:0.78, yR:0.17, w:86, h:60, a:0.30, tilt:9,   c1:[27,143,173],  c2:[26,58,107]   },
  { xR:0.87, yR:0.75, w:70, h:50, a:0.19, tilt:-7,  c1:[27,107,138],  c2:[27,143,173]  },
  { xR:0.94, yR:0.48, w:62, h:46, a:0.17, tilt:-5,  c1:[27,143,173],  c2:[74,107,200]  },
  // Indigo / mixed frames (top center and bottom)
  { xR:0.50, yR:0.07, w:50, h:36, a:0.12, tilt:2,   c1:[96,32,184],   c2:[26,58,107]   },
  { xR:0.30, yR:0.89, w:56, h:40, a:0.13, tilt:-3,  c1:[74,107,200],  c2:[27,143,173]  },
]

function AuroraCanvas({
  frame, width, height, opacity = 1,
}: {
  frame: number; width: number; height: number; opacity?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width  = width
    canvas.height = height

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    // Waves — 3 passes (outer glow, inner glow, crisp line)
    for (const w of WAVES) {
      for (let pass = 0; pass < 3; pass++) {
        const amp   = pass === 0 ? w.amp*2.6 : pass === 1 ? w.amp*1.6 : w.amp
        const alpha = pass === 0 ? w.a*0.18  : pass === 1 ? w.a*0.48  : w.a
        const lw    = pass === 0 ? w.lw*10   : pass === 1 ? w.lw*3.5  : w.lw
        ctx.beginPath()
        for (let x = 0; x <= width; x += 2) {
          const y = height * w.yR
            + Math.sin(x * w.freq + w.phase + frame * 0.007) * amp
            + Math.sin(x * w.freq * 2.1 + w.phase * 1.7 + frame * 0.005) * amp * 0.32
            + Math.sin(x * w.freq * 0.5 + frame * 0.003) * amp * 0.18
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(${w.r},${w.g},${w.b},${alpha})`
        ctx.lineWidth = lw
        ctx.stroke()
      }
    }

    // Film frames floating at edges
    for (const f of FILM_FRAMES) {
      const px = f.xR * width
      const py = f.yR * height + Math.sin(frame * 0.005 + f.xR * 6) * 8
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(f.tilt * Math.PI / 180)
      ctx.globalAlpha = f.a

      const [r1, g1, b1] = f.c1
      const [r2, g2, b2] = f.c2
      const g = ctx.createLinearGradient(-f.w/2, -f.h/2, f.w/2, f.h/2)
      g.addColorStop(0, `rgba(${r1},${g1},${b1},0.95)`)
      g.addColorStop(1, `rgba(${r2},${g2},${b2},0.75)`)

      ctx.strokeStyle = g
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(-f.w/2, -f.h/2, f.w, f.h, 3)
      ctx.stroke()
      ctx.fillStyle = `rgba(${r1},${g1},${b1},0.06)`
      ctx.fill()

      // Film holes
      const hs = 4.5
      const hc = Math.floor(f.w / 14)
      for (const hy of [-f.h/2 + hs, f.h/2 - hs]) {
        for (let i = 0; i < hc; i++) {
          const hx = -f.w/2 + (f.w / hc) * (i + 0.5)
          ctx.fillStyle = `rgba(${r1},${g1},${b1},0.65)`
          ctx.beginPath()
          ctx.roundRect(hx - hs/2, hy - hs*0.35, hs, hs*0.7, 1)
          ctx.fill()
        }
      }
      ctx.restore()
    }

    // Waveform bars — bottom left, matches logo
    // Color transitions: deepPurple → indigo → waveBlue → brightTeal
    const barCount  = 20
    const barStartX = width * 0.05
    const barY      = height * 0.89
    const barColors = [
      [91, 26, 154],   // deepPurple
      [96, 32, 184],   // indigo
      [120, 48, 200],  // indigoMid
      [74, 107, 200],  // waveBlue
      [27, 143, 173],  // teal
      [27, 159, 212],  // brightTeal
    ]
    for (let i = 0; i < barCount; i++) {
      const bh = 5 + Math.abs(
        Math.sin(i * 0.42 + frame * 0.06) * 18 +
        Math.sin(i * 0.88 + frame * 0.03) * 10
      )
      const bx      = barStartX + i * 13
      const colorT  = i / (barCount - 1)
      const cIdx    = colorT * (barColors.length - 1)
      const cLo     = Math.floor(cIdx)
      const cHi     = Math.min(cLo + 1, barColors.length - 1)
      const cFrac   = cIdx - cLo
      const [r1,g1,b1] = barColors[cLo]
      const [r2,g2,b2] = barColors[cHi]
      const r = Math.round(r1 + (r2-r1)*cFrac)
      const g = Math.round(g1 + (g2-g1)*cFrac)
      const b = Math.round(b1 + (b2-b1)*cFrac)
      ctx.globalAlpha = 0.22 + 0.12 * Math.abs(Math.sin(i * 0.5 + frame * 0.04))
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.beginPath()
      ctx.roundRect(bx, barY - bh/2, 6, bh, 3)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Sparkle stars — white, referencing logo star elements
    const SPARKLES = [
      [0.52, 0.07, 5.5], [0.62, 0.04, 3.5], [0.58, 0.03, 2.5],
      [0.88, 0.22, 3.0], [0.12, 0.76, 2.5], [0.78, 0.78, 3.5],
      [0.25, 0.12, 2.0], [0.70, 0.88, 2.0],
    ]
    for (let i = 0; i < SPARKLES.length; i++) {
      const [xR, yR, ss] = SPARKLES[i]
      const sx  = xR * width
      const sy  = yR * height + Math.sin(frame * 0.02 + i * 1.3) * 6
      const sa  = 0.12 + 0.72 * Math.abs(Math.sin(frame * 0.025 + i * 0.9))
      ctx.save()
      ctx.globalAlpha = sa
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'
      ctx.lineWidth = 0.8
      // 4-point star
      for (const [dx, dy] of [[-ss,0],[ss,0],[0,-ss],[0,ss]]) {
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx+dx, sy+dy); ctx.stroke()
      }
      // diagonal arms (shorter)
      for (const [dx, dy] of [[-ss*0.55,-ss*0.55],[ss*0.55,ss*0.55],[-ss*0.55,ss*0.55],[ss*0.55,-ss*0.55]]) {
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx+dx, sy+dy); ctx.stroke()
      }
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.arc(sx, sy, ss * 0.15, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Purple radial glow center-left
    const rg1 = ctx.createRadialGradient(width*0.35, height*0.48, 0, width*0.35, height*0.48, width*0.38)
    rg1.addColorStop(0, 'rgba(91,26,154,0.16)')
    rg1.addColorStop(0.5, 'rgba(96,32,184,0.06)')
    rg1.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg1
    ctx.fillRect(0, 0, width, height)

    // Indigo center pulse
    const rg2 = ctx.createRadialGradient(width*0.5, height*0.48, 0, width*0.5, height*0.48, width*0.28)
    rg2.addColorStop(0, 'rgba(96,32,184,0.10)')
    rg2.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg2
    ctx.fillRect(0, 0, width, height)

    // Teal radial glow center-right
    const rg3 = ctx.createRadialGradient(width*0.65, height*0.52, 0, width*0.65, height*0.52, width*0.38)
    rg3.addColorStop(0, 'rgba(27,143,173,0.12)')
    rg3.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg3
    ctx.fillRect(0, 0, width, height)

    // Edge vignettes — pure black on all sides
    const edges: [number,number,number,number,string,string][] = [
      [0, 0,            0,  height*0.22, '#000', 'rgba(0,0,0,0)'],
      [0, height*0.78,  0,  height,      'rgba(0,0,0,0)', '#000'],
      [0, 0,            width*0.08, 0,   '#000', 'rgba(0,0,0,0)'],
      [width*0.92, 0,   width, 0,        'rgba(0,0,0,0)', '#000'],
    ]
    for (const [x1,y1,x2,y2,c1,c2] of edges) {
      const eg = ctx.createLinearGradient(x1, y1, x2 || width, y2 || height)
      eg.addColorStop(0, c1)
      eg.addColorStop(1, c2)
      ctx.fillStyle = eg
      ctx.fillRect(0, 0, width, height)
    }

  }, [frame, width, height])

  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        opacity,
      }}
    />
  )
}


// ── SceneIntro ────────────────────────────────────────────────────────────────
//
// VOICEOVER SCRIPT + FRAME SYNC:
// ─────────────────────────────────────────────────────────────────────────────
//  Frame  0 – 60   [SILENCE]
//                  Aurora fades in. Logo rises and scales up.
//
//  Frame 60 – 105  VO: "You have files. They need work."
//                  First pain line fades in.
//
//  Frame 110 – 172 VO: "You shouldn't need six tools and a manual to get there."
//                  Second pain line fades in below.
//
//  Frame 182 – 248 VO: "Meet Vizio."
//                  Both pain lines fade out. "Meet Vizio." explodes in large.
//
//  Frame 225 – 300 VO: "Your AI media assistant —"
//                  "Meet Vizio." fades. Tagline fades up.
//
//  Frame 258 – 320 VO: "raw files in, ready files out."
//                  Sub fades in under tagline.
//
//  Frame 300 – 390 [HOLD]
//                  Badge pills appear. Hold for cut to next scene.
//
// Total: 390 frames = 13 seconds @ 30fps
// ─────────────────────────────────────────────────────────────────────────────

export function SceneIntro() {
  const frame = useCurrentFrame()
  const { width: W, height: H } = useVideoConfig()

  // Aurora
  const auroraOpacity = easeOut(p(frame, 0, 45))

  // Logo
  const logoOpacity = easeOut(p(frame, 5, 32))
  const logoScale   = 0.76 + easeOut(p(frame, 5, 38)) * 0.24
  const logoY       = (1 - easeOut(p(frame, 5, 38))) * 30

  // Glow behind logo
  const glowOpacity = easeInOut(p(frame, 15, 45)) * 0.75

  // Pain lines
  const line1In  = easeOut(p(frame, 58, 20))
  const line1Out = easeOut(p(frame, 175, 14))
  const line2In  = easeOut(p(frame, 110, 20))
  const line2Out = easeOut(p(frame, 178, 14))

  // "Meet Vizio."
  const meetIn   = easeOut(p(frame, 182, 22))
  const meetOut  = easeOut(p(frame, 250, 16))
  const meetScale = 0.86 + easeOut(p(frame, 182, 24)) * 0.14

  // Tagline
  const tagIn  = easeOut(p(frame, 228, 24))
  const tagY   = (1 - easeOut(p(frame, 228, 24))) * 18

  // Divider line
  const dividerW = easeOut(p(frame, 242, 32)) * 300

  // Sub
  const subIn = easeOut(p(frame, 258, 22))
  const subY  = (1 - easeOut(p(frame, 258, 22))) * 14

  // Badges
  const badgeIn = easeOut(p(frame, 302, 22))

  return (
    <div style={{
      width: W, height: H,
      position: 'relative',
      background: '#000',
      overflow: 'hidden',
    }}>

      {/* Aurora */}
      <AuroraCanvas frame={frame} width={W} height={H} opacity={auroraOpacity} />

      {/* Purple glow behind logo — left of center */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '46%',
        transform: 'translate(-50%, -56%)',
        width: 380, height: 380,
        borderRadius: '50%',
        background: `radial-gradient(circle,
          rgba(91,26,154,0.50) 0%,
          rgba(96,32,184,0.22) 35%,
          rgba(27,143,173,0.10) 60%,
          transparent 75%)`,
        filter: 'blur(52px)',
        opacity: glowOpacity,
        pointerEvents: 'none',
      }} />

      {/* Teal glow — right of center */}
      <div style={{
        position: 'absolute',
        top: '48%', left: '56%',
        transform: 'translate(-50%, -52%)',
        width: 280, height: 280,
        borderRadius: '50%',
        background: `radial-gradient(circle,
          rgba(27,143,173,0.30) 0%,
          transparent 68%)`,
        filter: 'blur(40px)',
        opacity: glowOpacity * 0.8,
        pointerEvents: 'none',
      }} />

      {/* Logo — actual icon.png, place it in demo/public/icon.png */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: `translate(-50%, calc(-54% + ${logoY}px)) scale(${logoScale})`,
        opacity: logoOpacity,
      }}>
        <img
          src={staticFile('icon.png')}
          width={210}
          height={210}
          alt="Vizio logo"
          style={{ objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Pain line 1 — fades in at 58, fades out at 175 */}
      <div style={{
        position: 'absolute',
        top: '63%', left: 0, right: 0,
        textAlign: 'center',
        opacity: line1In * (1 - line1Out),
        transform: `translateY(${(1 - line1In) * 20}px)`,
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 22,
          fontWeight: 400,
          color: 'rgba(200,216,232,0.72)',
          letterSpacing: '0.01em',
        }}>
          You have files that need work.
        </span>
      </div>

      {/* Pain line 2 — fades in at 110, fades out at 178 */}
      <div style={{
        position: 'absolute',
        top: '70%', left: 0, right: 0,
        textAlign: 'center',
        opacity: line2In * (1 - line2Out),
        transform: `translateY(${(1 - line2In) * 18}px)`,
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 17,
          fontWeight: 300,
          color: 'rgba(200,216,232,0.42)',
          letterSpacing: '0.01em',
        }}>
          You shouldn't need six tools and a manual to get there.
        </span>
      </div>

      {/* "Meet Vizio." — large gradient text, in at 182, out at 250 */}
      <div style={{
        position: 'absolute',
        top: '60%', left: 0, right: 0,
        textAlign: 'center',
        opacity: meetIn * (1 - meetOut),
        transform: `scale(${meetScale})`,
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: '-1px',
          // Full 5-color gradient: deepPurple→indigo→waveBlue→teal→brightTeal
          background: `linear-gradient(100deg,
            ${C.deepPurple} 0%,
            ${C.indigo}     22%,
            ${C.indigoMid}  38%,
            ${C.waveBlue}   58%,
            ${C.teal}       78%,
            ${C.brightTeal} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Meet Vizio.
        </span>
      </div>

      {/* Tagline — in at 228 */}
      <div style={{
        position: 'absolute',
        bottom: '28%', left: 0, right: 0,
        textAlign: 'center',
        opacity: tagIn,
        transform: `translateY(${tagY}px)`,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 40,
          fontWeight: 500,
          color: C.pearl,
          letterSpacing: '-0.5px',
          lineHeight: 1.15,
        }}>
          From raw files to ready —{' '}
          <span style={{
            // All 5 color families in the gradient
            background: `linear-gradient(90deg,
              ${C.violet}     0%,
              ${C.indigo}     28%,
              ${C.waveBlue}   55%,
              ${C.teal}       78%,
              ${C.brightTeal} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            just describe it.
          </span>
        </div>
      </div>

      {/* Divider line under tagline */}
      <div style={{
        position: 'absolute',
        bottom: '25.4%', left: '50%',
        transform: 'translateX(-50%)',
        width: dividerW,
        height: 0.5,
        background: `linear-gradient(90deg,
          transparent,
          rgba(91,26,154,0.5),
          rgba(96,32,184,0.6),
          rgba(74,107,200,0.6),
          rgba(27,159,212,0.5),
          transparent)`,
        opacity: tagIn,
        pointerEvents: 'none',
      }} />

      {/* Sub — in at 258 */}
      <div style={{
        position: 'absolute',
        bottom: '19%', left: 0, right: 0,
        textAlign: 'center',
        opacity: subIn,
        transform: `translateY(${subY}px)`,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: FONT_BODY,
          fontSize: 16,
          color: 'rgba(200,216,232,0.48)',
          letterSpacing: '0.015em',
          lineHeight: 1.6,
        }}>
          Your AI media assistant — raw files in, ready files out.
        </div>
      </div>

      {/* Badge pills — in at 302 */}
      <div style={{
        position: 'absolute',
        bottom: '11%', left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 10,
        opacity: badgeIn,
        pointerEvents: 'none',
      }}>
        {[
          { label: 'FREE',             border: 'rgba(91,26,154,0.7)',  text: C.midViolet  },
          { label: 'OPEN SOURCE',      border: 'rgba(96,32,184,0.7)',  text: '#9040E0'    },
          { label: 'WINDOWS',          border: 'rgba(74,107,200,0.7)', text: C.waveBlue   },
          { label: 'FFMPEG BUNDLED',   border: 'rgba(27,143,173,0.6)', text: C.teal       },
        ].map(({ label, border, text }) => (
          <div key={label} style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.45)',
            border: `0.5px solid ${border}`,
            borderRadius: 99,
            padding: '4px 14px',
            fontFamily: FONT_MONO,
            fontSize: 10,
            color: text,
            letterSpacing: '0.12em',
          }}>
            {label}
          </div>
        ))}
      </div>

    </div>
  )
}