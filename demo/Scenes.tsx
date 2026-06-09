import React from 'react'
import { staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { Aurora } from './Aurora'
import { Navbar as AcNavbar, MediaSidebar as AcMediaSidebar, ChatPanel as AcChatPanel, SessionPanel as AcSessionPanel } from './AppChrome'
import { C as AcC, FONT as AcFONT, W as AcW, H as AcH, clamp } from './constants'

// ── helpers ───────────────────────────────────────────────────────────────────
function fade(frame:number, start:number, dur:number) {
  return easeOut(progress(frame, start, dur))
}
function slideUp(frame:number, start:number, dur:number, dist=24) {
  const t = easeOut(progress(frame, start, dur))
  return { opacity:t, transform:`translateY(${(1-t)*dist}px)` }
}
function GradText({ children }:{ children:React.ReactNode }) {
  return (
    <span style={{
      background:'linear-gradient(90deg,#8B35CC,#4A6BC8,#1B9FD4)',
      WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
    }}>{children}</span>
  )
}

// ── Scene 1: Intro — aurora + logo + tagline ──────────────────────────────────
export function SceneIntro() {
  const f = useCurrentFrame()
  const logoT   = easeOut(progress(f, 0, 22))
  const tagT    = easeOut(progress(f, 22, 20))
  const subT    = easeOut(progress(f, 40, 16))
  const badgeT  = easeOut(progress(f, 55, 14))
  const glowT   = easeOut(progress(f, 8, 30))

  return (
    <div style={{ width:AcW, height:AcH, position:'relative', background:'#000', overflow:'hidden' }}>
      <Aurora />
      {/* Center glow */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-56%)',
        width:280, height:280, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(107,31,168,0.40) 0%,rgba(27,107,138,0.18) 50%,transparent 70%)',
        filter:'blur(45px)', opacity:glowT*0.9,
      }} />
      {/* Logo mark — drawn as SVG matching the V shape */}
      <div style={{
        position:'absolute', top:'18%', left:'50%',
        transform:`translateX(-50%) scale(${0.82+logoT*0.18}) translateY(${(1-logoT)*22}px)`,
        opacity:logoT,
      }}>
        <svg width="110" height="110" viewBox="0 0 110 110">
          {/* Left purple film-strip arm */}
          <defs>
            <linearGradient id="gL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6B1FA8"/>
              <stop offset="100%" stopColor="#8B35CC"/>
            </linearGradient>
            <linearGradient id="gR" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1A4A7A"/>
              <stop offset="100%" stopColor="#1B9FD4"/>
            </linearGradient>
            <linearGradient id="gBubble" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D0E0F0"/>
              <stop offset="100%" stopColor="#A0B8CC"/>
            </linearGradient>
          </defs>
          {/* Left strip V arm */}
          <path d="M18 8 C16 8 14 10 14 12 L14 72 C14 74 16 76 18 76 L30 76 C32 76 34 74 34 72 L34 55 L55 88 L55 92 L50 99 L60 99 L55 92 L76 55 L76 72 C76 74 78 76 80 76 L92 76 C94 76 96 74 96 72 L96 12 C96 10 94 8 92 8 L80 8 C78 8 76 10 76 12 L76 38 L55 72 L34 38 L34 12 C34 10 32 8 30 8 Z"
            fill="url(#gL)" opacity="0"/>
          {/* Simpler V shape */}
          <path d="M15 10 L38 10 L38 42 L55 75 L72 42 L72 10 L95 10 L95 72 L72 72 L72 58 L55 90 L38 58 L38 72 L15 72 Z"
            fill="none" stroke="url(#gL)" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round"
            opacity="0.9"/>
          <path d="M55 10 L72 42 L72 10 L95 10 L95 72 L72 72 L72 58 L55 90"
            fill="none" stroke="url(#gR)" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round"/>
          {/* Chat bubble */}
          <rect x="40" y="16" width="30" height="22" rx="5" fill="url(#gBubble)" opacity="0.9"/>
          <circle cx="48" cy="27" r="2.5" fill="#1A4A7A"/>
          <circle cx="55" cy="27" r="2.5" fill="#1A4A7A"/>
          <circle cx="62" cy="27" r="2.5" fill="#1A4A7A"/>
          {/* Sparkles */}
          {[[54,8],[68,4],[60,3]].map(([sx,sy],i) => (
            <g key={i} opacity="0.9">
              <line x1={sx} y1={sy-3.5} x2={sx} y2={sy+3.5} stroke="white" strokeWidth="1"/>
              <line x1={sx-3.5} y1={sy} x2={sx+3.5} y2={sy} stroke="white" strokeWidth="1"/>
            </g>
          ))}
          {/* Waveform bars */}
          {[0,1,2,3,4,5,6,7].map(i => {
            const bh = [8,14,20,16,22,12,18,10][i]
            return (
              <rect key={i}
                x={16 + i*6} y={85-bh/2} width="4" height={bh} rx="2"
                fill={i < 4 ? '#8B35CC' : '#1B9FD4'} opacity="0.8"/>
            )
          })}
        </svg>
      </div>

      {/* Tagline */}
      <div style={{
        position:'absolute', top:'52%', left:0, right:0, textAlign:'center',
        ...slideUp(f, 22, 20), 
      }}>
        <div style={{ fontFamily:AcFONT.sans, fontSize:44, fontWeight:500, color:AcC.pearl, letterSpacing:'-0.5px', lineHeight:1.1 }}>
          Edit video with <GradText>plain English</GradText>
        </div>
      </div>

      {/* Sub */}
      <div style={{
        position:'absolute', top:'67%', left:0, right:0, textAlign:'center',
        ...slideUp(f, 40, 16),
      }}>
        <div style={{ fontFamily:AcFONT.sans, fontSize:16, color:'rgba(200,216,232,0.45)' }}>
          Describe it. Vizio handles the rest.
        </div>
      </div>

      {/* Badge */}
      <div style={{
        position:'absolute', top:'77%', left:0, right:0, display:'flex', justifyContent:'center',
        opacity:badgeT,
      }}>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:8,
          background:'rgba(139,53,204,0.10)', border:'0.5px solid rgba(139,53,204,0.3)',
          borderRadius:99, padding:'5px 18px',
          fontFamily:AcFONT.mono, fontSize:11, color:'rgba(200,216,232,0.55)', letterSpacing:'0.12em',
        }}>
          FREE · OPEN SOURCE · WINDOWS
        </div>
      </div>
    </div>
  )
}

// ── Scene 2: Project gate ─────────────────────────────────────────────────────
export function SceneProjectGate() {
  const f = useCurrentFrame()
  const bgT   = easeOut(progress(f, 0, 18))
  const cardT = easeOut(progress(f, 15, 22))
  const rowT  = easeOut(progress(f, 32, 16))

  return (
    <div style={{ width:AcW, height:AcH, position:'relative', background:'#000', overflow:'hidden' }}>
      <Aurora opacity={bgT} />
      <div style={{
        position:'absolute', inset:0,
        background:'radial-gradient(circle at 30% 30%, rgba(139,53,204,0.14), transparent 20%), radial-gradient(circle at 70% 40%, rgba(27,159,212,0.12), transparent 16%)',
        pointerEvents:'none',
        opacity:bgT,
      }} />

      {/* Card */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:`translate(-50%,-50%) scale(${0.92+cardT*0.08}) translateY(${(1-cardT)*20}px)`,
        opacity:cardT,
        width:560,
        background:'rgba(10,15,28,0.78)',
        border:`0.5px solid rgba(255,255,255,0.10)`,
        borderRadius:14,
        padding:'40px 40px 32px',
        backdropFilter:'blur(20px)',
        boxShadow:'0 0 120px rgba(91,26,154,0.12)',
      }}>
        {/* Logo mark small */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
          <img
          src={staticFile('icon.png')}
          width={48}
          height={48}
          alt="Vizio logo"
          style={{ width:48, height:48, objectFit:'contain', display:'block' }}
        />
        </div>

        <h2 style={{ fontFamily:AcFONT.sans, fontSize:26, fontWeight:500, color:AcC.pearl, margin:'0 0 6px', textAlign:'center' }}>
          Welcome back
        </h2>
        <p style={{ fontFamily:AcFONT.sans, fontSize:14, color:AcC.pearlDim, margin:'0 0 24px', textAlign:'center' }}>
          Open a recent project or start a new one
        </p>

        {/* Project row */}
        <div style={{
          background:AcC.surface, border:`0.5px solid ${AcC.border}`,
          borderRadius:8, padding:'12px 14px',
          display:'flex', alignItems:'center', gap:12,
          marginBottom:10,
          opacity:rowT,
          transform:`translateY(${(1-rowT)*10}px)`,
        }}>
          <div style={{
            width:34, height:34, borderRadius:7,
            background:'linear-gradient(135deg,#6B1FA8,#1B9FD4)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, color:'#fff', flexShrink:0,
          }}>V</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:AcFONT.sans, fontSize:14, color:AcC.pearl, fontWeight:500 }}>taste</div>
            <div style={{ fontFamily:AcFONT.mono, fontSize:11, color:AcC.pearlFaint }}>C:\Users\USER\Videos\taste</div>
          </div>
          <span style={{ fontSize:18, color:AcC.pearlDim }}>→</span>
          <span style={{ fontSize:14, color:AcC.pearlFaint, opacity:0.5 }}>×</span>
        </div>

        {/* New project button */}
        <div style={{
          background:'rgba(139,53,204,0.08)', border:`0.5px solid rgba(139,53,204,0.2)`,
          borderRadius:8, padding:'11px', textAlign:'center',
          fontFamily:AcFONT.sans, fontSize:14, color:'rgba(139,53,204,0.7)',
          opacity:rowT,
        }}>
          + New project
        </div>
      </div>
    </div>
  )
}

// ── Scene 4: Chat typing ──────────────────────────────────────────────────────
export function SceneChat() {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()

  const PROMPT = 'compress this for twitter and mix in audio.wav as background music, keep it under 140MB'
  const typeStart   = 10
  const charsPerFrame = 0.85
  const charsVisible = Math.floor(Math.max(0, f - typeStart) * charsPerFrame)
  const displayed   = PROMPT.slice(0, Math.min(charsVisible, PROMPT.length))
  const typing      = charsVisible < PROMPT.length
  const showThinking = f >= 140

  const thinkingProgress = spring({ frame:f-140, fps, config:{ damping:18, stiffness:120, mass:0.8 }, durationInFrames:20 })

  return (
    <div style={{ width:AcW, height:AcH, position:'relative', background:AcC.bg, overflow:'hidden' }}>
      <AcNavbar opacity={1} activeTab="Workspace" />
      <AcMediaSidebar opacity={1} visibleFiles={6} />
      <AcSessionPanel opacity={0.4} steps={[]} tasks={[]} />

      {/* Chat panel with live typing */}
      <div style={{
        position:'absolute', right:0, top:44, bottom:0, width:340,
        background:AcC.card, borderLeft:`0.5px solid ${AcC.border}`,
        display:'flex', flexDirection:'column', fontFamily:AcFONT.sans,
      }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 14px', borderBottom:`0.5px solid ${AcC.border}`,
        }}>
          <span style={{ fontSize:11, color:AcC.pearlDim }}>@[clip_06_chips_california_short...]</span>
          <div style={{
            background:'rgba(139,53,204,0.12)', border:`0.5px solid rgba(139,53,204,0.3)`,
            borderRadius:99, padding:'3px 10px', fontSize:11, color:AcC.violet,
          }}>+ New chat</div>
        </div>

        <div style={{ flex:1, padding:'14px', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{
            alignSelf:'flex-end', maxWidth:'88%',
            background:'rgba(139,53,204,0.18)', border:`0.5px solid rgba(139,53,204,0.3)`,
            borderRadius:10, padding:'9px 13px', fontSize:12, color:AcC.pearl, lineHeight:1.6,
          }}>
            what can you do with my videos?
          </div>
          <div style={{
            alignSelf:'flex-start', maxWidth:'88%',
            background:AcC.surface, border:`0.5px solid ${AcC.border}`,
            borderRadius:10, padding:'9px 13px', fontSize:12, color:AcC.pearl, lineHeight:1.6,
          }}>
            I can see <strong style={{color:AcC.brightTeal}}>7 MP4 files</strong> in your project. I can compress, trim, merge, add captions, convert format, extract audio, and more — just describe what you want.
          </div>

          {/* Thinking dots */}
          {showThinking && (
            <div style={{
              alignSelf:'flex-start',
              background:AcC.surface, border:`0.5px solid ${AcC.border}`,
              borderRadius:10, padding:'10px 14px',
              display:'flex', gap:5, alignItems:'center',
              opacity: thinkingProgress, transform:`translateY(${(1-thinkingProgress)*10}px)`,
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:7, height:7, borderRadius:'50%', background:AcC.violet,
                  opacity: 0.3 + 0.7*Math.abs(Math.sin((f-140)*0.18 + i*1.1)),
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Input with typing */}
        <div style={{ borderTop:`0.5px solid ${AcC.border}`, padding:'10px 12px' }}>
          <div style={{
            background:AcC.surface, borderRadius:8,
            border:`0.5px solid rgba(139,53,204,0.3)`,
            display:'flex', alignItems:'flex-start', gap:8, padding:'8px 12px', minHeight:44,
          }}>
            <div style={{ width:18, height:18, opacity:0.3, fontSize:14, color:AcC.pearl, flexShrink:0, marginTop:1 }}>🖼</div>
            <span style={{ flex:1, fontSize:12, color: displayed ? AcC.pearl : AcC.pearlFaint, lineHeight:1.5, wordBreak:'break-word' }}>
              {displayed}
              {typing && (
                <span style={{
                  display:'inline-block', width:2, height:'1.1em',
                  background:AcC.brightTeal, marginLeft:2, verticalAlign:'text-bottom',
                  opacity: Math.floor(f/7)%2===0 ? 1 : 0,
                }} />
              )}
            </span>
            <div style={{
              width:28, height:28, borderRadius:'50%',
              background:`linear-gradient(135deg,${AcC.violet},${AcC.brightTeal})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, color:'#fff', flexShrink:0,
            }}>↑</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Scene 5: Approval card (complete rework) ──────────────────

// ─── Constants matching the real app ─────────────────────────────
const W = 1920
const H = 1080

const FONT = {
  sans: 'Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", "Fira Code", Consolas, monospace',
}

const C = {
  bg:          '#0d1117',
  navbar:      '#090d14',
  sidebar:     '#0b0f18',
  panel:       '#0e1220',
  card:        '#111827',
  cardHover:   '#141c2e',
  border:      'rgba(120,140,200,0.10)',
  borderMed:   'rgba(120,140,200,0.16)',

  // text
  pearl:       '#c8d4ee',
  pearlDim:    'rgba(200,212,238,0.55)',
  pearlFaint:  'rgba(200,212,238,0.30)',
  muted:       'rgba(200,212,238,0.18)',
  label:       '#5a7090',

  // accent
  violet:      '#8b35cc',
  violetBright:'#a855f7',
  teal:        '#14b8a6',
  brightTeal:  '#2dd4bf',
  cyan:        '#18d8f0',

  // status
  amber:       '#f59e0b',
  amberDim:    'rgba(245,158,11,0.15)',
  green:       '#22c55e',
  greenDim:    'rgba(34,197,94,0.12)',
  pending:     'rgba(200,212,238,0.22)',
}

// ─── Layout dims (matching screenshot proportions) ────────────────
const NAVBAR_H   = 44
const SIDEBAR_W  = 252   // left media panel
const CHAT_W     = 340   // right chat panel
const SESSION_H  = 165   // lower-left session block height

// ─── Helpers ─────────────────────────────────────────────────────
function progress(frame: number, start: number, dur: number) {
  return Math.max(0, Math.min(1, (frame - start) / dur))
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

// ─── Sub-components ───────────────────────────────────────────────

function Navbar({ opacity }: { opacity: number }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: NAVBAR_H,
      background: C.navbar,
      borderBottom: `0.5px solid ${C.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 12,
      opacity,
      fontFamily: FONT.sans,
      zIndex: 10,
    }}>
      {/* Back / forward */}
      <div style={{ display: 'flex', gap: 6, opacity: 0.4 }}>
        <span style={{ color: C.pearl, fontSize: 13 }}>‹</span>
        <span style={{ color: C.pearl, fontSize: 13 }}>›</span>
      </div>

      {/* Project pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: 'rgba(139,53,204,0.12)',
        border: `0.5px solid rgba(139,53,204,0.28)`,
        borderRadius: 6, padding: '3px 10px',
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: 4,
          background: 'linear-gradient(135deg,#8b35cc,#14b8a6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#fff', fontWeight: 700,
        }}>V</div>
        <span style={{ fontSize: 12, color: C.pearl, fontWeight: 500 }}>crake</span>
        <span style={{ fontSize: 11, color: C.label }}>↓</span>
      </div>

      {/* Tabs */}
      {['Workspace', 'Tools', 'Node', 'Settings'].map((tab, i) => (
        <span key={tab} style={{
          fontSize: 12, fontWeight: i === 0 ? 600 : 400,
          color: i === 0 ? C.pearl : C.label,
          borderBottom: i === 0 ? `1.5px solid ${C.violetBright}` : 'none',
          paddingBottom: i === 0 ? 2 : 0,
          cursor: 'default',
        }}>{tab}</span>
      ))}

      {/* Center wordmark */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        fontSize: 13, fontWeight: 600, color: C.pearlDim, letterSpacing: 0.3,
      }}>Vizio</div>

      {/* Window controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {['#ff5f57','#febc2e','#28c840'].map(c => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
        ))}
      </div>
    </div>
  )
}

function MediaSidebar({ opacity }: { opacity: number }) {
  return (
    <div style={{
      position: 'absolute',
      top: NAVBAR_H, left: 0, bottom: 0,
      width: SIDEBAR_W,
      background: C.sidebar,
      borderRight: `0.5px solid ${C.border}`,
      opacity,
      fontFamily: FONT.sans,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px 8px',
        borderBottom: `0.5px solid ${C.border}`,
      }}>
        <span style={{ fontSize: 9.5, letterSpacing: '0.12em', color: C.label, textTransform: 'uppercase' }}>
          MEDIA
        </span>
        <span style={{
          fontSize: 9, color: C.label, background: 'rgba(90,112,144,0.18)',
          border: `0.5px solid ${C.border}`, borderRadius: 4, padding: '1px 6px',
        }}>19 files</span>
      </div>

      {/* Files */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {FILES.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 12px',
            borderBottom: `0.5px solid rgba(120,140,200,0.04)`,
          }}>
            {/* Thumbnail */}
            <div style={{
              width: 36, height: 26, borderRadius: 3, flexShrink: 0,
              background: 'rgba(30,40,70,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `0.5px solid ${C.border}`,
              fontSize: 9, color: C.label, fontWeight: 700, fontFamily: FONT.mono,
            }}>MP4</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9.5, color: C.pearlDim, fontFamily: FONT.mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
              <div style={{ fontSize: 9, color: C.label, marginTop: 1 }}>{f.size}</div>
            </div>
          </div>
        ))}
        {/* Add more */}
        <div style={{
          padding: '10px 14px',
          fontSize: 10, color: C.label,
          textAlign: 'center',
          borderTop: `0.5px solid ${C.border}`,
        }}>+ add more files</div>
      </div>

      {/* SESSION block — lower left */}
      <div style={{
        borderTop: `0.5px solid ${C.border}`,
        padding: '10px 14px',
        background: 'rgba(6,8,14,0.7)',
      }}>
        <div style={{ fontSize: 9, letterSpacing: '0.12em', color: C.label, textTransform: 'uppercase', marginBottom: 8 }}>
          SESSION
        </div>
        {[
          { k: 'provider', v: 'OpenRouter' },
          { k: 'model',    v: 'openrouter/owl-alpha' },
          { k: 'status',   v: 'ready' },
        ].map(({ k, v }) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: C.label, fontFamily: FONT.mono }}>{k}</span>
            <span style={{
              fontSize: 9, fontFamily: FONT.mono,
              color: k === 'status' ? C.green : C.pearlDim,
              maxWidth: 140, textAlign: 'right',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{v}</span>
          </div>
        ))}

        {/* PENDING APPROVAL label */}
        <div style={{
          marginTop: 10,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: C.amber,
            boxShadow: `0 0 8px ${C.amber}`,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 9, fontFamily: FONT.mono, fontWeight: 600,
            color: C.amber, letterSpacing: '0.05em',
          }}>PENDING APPROVAL - 19 STEPS</span>
        </div>

        {/* Execution preview steps */}
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {EXEC_STEPS.map(({ n, cmd, sub }) => (
            <div key={n} style={{ display: 'flex', gap: 7 }}>
              <span style={{
                fontSize: 8.5, fontFamily: FONT.mono,
                color: C.amber, flexShrink: 0, marginTop: 1,
              }}>{n}</span>
              <div>
                <div style={{ fontSize: 8.5, fontFamily: FONT.mono, color: C.pearlDim, lineHeight: 1.4 }}>{cmd}</div>
                <div style={{ fontSize: 8, fontFamily: FONT.mono, color: C.label, lineHeight: 1.4, marginTop: 1 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// The session log center panel (left side of center area)
function SessionPanel({ opacity, stepsVisible }: { opacity: number; stepsVisible: number }) {
  return (
    <div style={{
      position: 'absolute',
      top: NAVBAR_H, left: SIDEBAR_W,
      right: CHAT_W,
      bottom: 0,
      background: C.panel,
      opacity,
      fontFamily: FONT.sans,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: C.navbar,
        borderBottom: `0.5px solid ${C.border}`,
        padding: '0 16px',
      }}>
        {[
          { label: 'preview', active: false },
          { label: 'output files', badge: '19', active: false },
          { label: 'session log', active: true },
          { label: 'draft', badge: null, chip: true, active: false },
        ].map(({ label, badge, active }) => (
          <div key={label} style={{
            padding: '11px 12px',
            fontSize: 10, fontFamily: FONT.mono,
            color: active ? C.pearl : C.label,
            borderBottom: active ? `1.5px solid ${C.violetBright}` : '1.5px solid transparent',
            display: 'flex', alignItems: 'center', gap: 5,
            cursor: 'default',
          }}>
            {label}
            {badge && (
              <span style={{
                fontSize: 8, background: 'rgba(24,216,240,0.1)', color: C.cyan,
                border: `0.5px solid rgba(24,216,240,0.2)`, borderRadius: 3,
                padding: '1px 4px', fontFamily: FONT.mono,
              }}>{badge}</span>
            )}
          </div>
        ))}
      </div>

      {/* Task pills */}
      <div style={{
        display: 'flex', gap: 6, padding: '9px 14px',
        borderBottom: `0.5px solid ${C.border}`,
        background: C.navbar,
      }}>
        {['task 1', 'task 2'].map((t, i) => (
          <div key={t} style={{
            fontSize: 9, fontFamily: FONT.mono, padding: '3px 10px',
            borderRadius: 20,
            border: `0.5px solid ${i === 1 ? 'rgba(139,53,204,0.45)' : C.border}`,
            color: i === 1 ? C.violetBright : C.label,
            background: i === 1 ? 'rgba(139,53,204,0.08)' : 'transparent',
          }}>{t}</div>
        ))}
      </div>

      {/* Body — scrollable log */}
      <div style={{ flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        {/* Goal card */}
        <div style={{
          background: C.card, border: `0.5px solid ${C.borderMed}`,
          borderRadius: 8, padding: '11px 14px',
        }}>
          {[
            { k: 'GOAL',    v: 'Process 19 attached files: i want you to remux all these videos', mono: true },
            { k: 'STATUS',  v: 'proposed', color: '#a78bfa' },
            { k: 'STARTED', v: '9:37:07 PM', mono: true },
          ].map(({ k, v, mono, color }) => (
            <div key={k} style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
              <span style={{ fontSize: 9.5, fontFamily: FONT.mono, color: C.label, width: 56, flexShrink: 0 }}>{k}</span>
              <span style={{
                fontSize: 9.5,
                fontFamily: mono ? FONT.mono : FONT.sans,
                color: color ?? C.pearlDim, lineHeight: 1.45,
              }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Plan card */}
        <div>
          <div style={{ fontSize: 8.5, fontFamily: FONT.mono, color: C.label, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>PLAN</div>
          <div style={{
            background: C.card, border: `0.5px solid ${C.borderMed}`,
            borderRadius: 8, padding: '11px 14px',
            fontSize: 11.5, color: C.pearlDim, lineHeight: 1.55,
          }}>
            I will remux all 19 videos using stream copy (no re-encoding) to ensure clean container formatting. Output files will be saved with '_remuxed' suffix in the output folder.
          </div>
        </div>

        {/* Steps */}
        <div>
          <div style={{ fontSize: 8.5, fontFamily: FONT.mono, color: C.label, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>STEPS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((step, i) => {
              const visible = i < stepsVisible
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px',
                  background: C.card,
                  borderBottom: `0.5px solid rgba(120,140,200,0.05)`,
                  borderRadius: i === 0 ? '7px 7px 0 0' : i === STEPS.length - 1 ? '0 0 7px 7px' : 0,
                  border: `0.5px solid ${C.borderMed}`,
                  opacity: visible ? 1 : 0,
                  transform: `translateY(${visible ? 0 : 8}px)`,
                  transition: 'opacity 0.3s, transform 0.3s',
                  marginBottom: 1,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: C.card, border: `0.5px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9.5, color: C.label, fontFamily: FONT.mono,
                  }}>{i + 1}</div>
                  <span style={{ flex: 1, fontSize: 11.5, color: C.pearlDim, fontFamily: FONT.mono }}>{step}</span>
                  <span style={{
                    fontSize: 9, fontFamily: FONT.mono, color: C.label,
                    background: 'rgba(90,112,144,0.12)', border: `0.5px solid ${C.border}`,
                    borderRadius: 3, padding: '1px 6px',
                  }}>pending</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tasks */}
        <div>
          <div style={{ fontSize: 8.5, fontFamily: FONT.mono, color: C.label, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>TASKS</div>
          <div style={{ fontSize: 11, color: C.label, fontStyle: 'italic' }}>No tasks yet -- describe an edit in the chat</div>
        </div>
      </div>
    </div>
  )
}

// Right chat panel — matches screenshot exactly
function ChatPanel({
  opacity,
  cardSpring,
  btnT,
  glowT,
}: {
  opacity: number
  cardSpring: number
  btnT: number
  glowT: number
}) {
  return (
    <div style={{
      position: 'absolute',
      top: NAVBAR_H, right: 0,
      width: CHAT_W, bottom: 0,
      background: C.sidebar,
      borderLeft: `0.5px solid ${C.border}`,
      opacity,
      fontFamily: FONT.sans,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '10px 13px',
        background: C.navbar,
        borderBottom: `0.5px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {/* Hamburger / menu icon */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, opacity: 0.5, flexShrink: 0 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 13, height: 1.2, background: C.pearl, borderRadius: 1 }} />
          ))}
        </div>
        <span style={{
          flex: 1, fontSize: 10.5, fontFamily: FONT.mono, color: C.pearlDim,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          Process 19 attached files: i w...
        </span>
        <span style={{
          fontSize: 9.5, fontFamily: FONT.mono, color: C.label,
          border: `0.5px solid ${C.border}`, padding: '3px 8px', borderRadius: 4,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>+ New chat</span>
      </div>

      {/* ── Step list 11–19 ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {CHAT_STEPS.map((step, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center',
            padding: '8px 14px',
            borderBottom: `0.5px solid rgba(120,140,200,0.05)`,
            gap: 8,
          }}>
            {/* Step number */}
            <span style={{
              fontSize: 10, fontFamily: FONT.mono,
              color: C.label, width: 18, flexShrink: 0,
              textAlign: 'right',
            }}>{i + 11}</span>

            {/* Step label */}
            <span style={{
              flex: 1, fontSize: 11, fontFamily: FONT.mono,
              color: C.pearlDim,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{step}</span>

            {/* Expand chevron */}
            <span style={{ fontSize: 11, color: C.label, opacity: 0.5, flexShrink: 0 }}>›</span>
          </div>
        ))}
      </div>

      {/* ── PERMISSION / APPROVAL ROW ──────────────────────────
          Just the two buttons, no card wrapper,
          sitting directly below the step list with a subtle top border.
      ──────────────────────────────────────────────────────── */}
      <div style={{
  
        padding: '12px 14px',
        borderTop: `0.5px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
        opacity: cardSpring,
        transform: `translateY(${(1 - cardSpring) * 14}px)`,
      }}>
        {/* Allow — filled teal pill with checkmark */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: C.brightTeal,
          borderRadius: 20,
          padding: '7px 18px',
          fontSize: 12, fontWeight: 500, color: '#fff',
          cursor: 'pointer',
          boxShadow: `0 0 ${16 + glowT * 18}px rgba(45,212,191,${0.3 + glowT * 0.25})`,
          opacity: btnT,
          transform: `translateY(${(1 - btnT) * 5}px)`,
          transition: 'box-shadow 0.3s',
        }}>
          {/* Checkmark icon */}
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path
              d="M2.5 6.5L5.5 9.5L10.5 3.5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Allow
        </div>

        {/* Dismiss — ghost outline pill */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'transparent',
          border: `0.5px solid ${C.borderMed}`,
          borderRadius: 20,
          padding: '7px 18px',
          fontSize: 12, fontWeight: 400, color: C.pearlDim,
          cursor: 'pointer',
          opacity: btnT,
          transform: `translateY(${(1 - btnT) * 5}px)`,
        }}>
          Dismiss
        </div>
      </div>

      {/* ── Dark separator gap between approval and input ── */}
      <div style={{
        height: 8,
        background: 'rgba(6,8,14,0.6)',
        borderTop: `0.5px solid ${C.border}`,
        borderBottom: `0.5px solid ${C.border}`,
      }} />

      {/* ── Chat input area ── */}
      <div style={{
        background: 'rgba(8,11,18,0.85)',
        padding: '10px 13px 6px',
      }}>
        {/* Input pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          background: 'rgba(13,17,28,0.8)',
          border: `0.5px solid ${C.borderMed}`,
          borderRadius: 20,
          padding: '10px 14px',
        }}>
          {/* Image / attachment icon */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1" y="2" width="13" height="11" rx="2" stroke={C.label} strokeWidth="0.9"/>
            <circle cx="5" cy="6" r="1.4" fill={C.label} opacity="0.45"/>
            <path d="M1 10.5l3.5-3 3 2.5 2.5-3.5L14 10.5" stroke={C.label} strokeWidth="0.9" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          <span style={{
            flex: 1, fontSize: 12, color: C.label, fontFamily: FONT.sans,
          }}>Describe an edit or ask anything...</span>

          {/* Send button — teal gradient circle */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${C.violet}, ${C.brightTeal})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 16px rgba(45,212,191,0.45)`,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 11L11 6L1 1V4.5L9 6L1 7.5V11Z" fill="white"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Hint text ── */}
      <div style={{
        background: 'rgba(8,11,18,0.85)',
        textAlign: 'center',
        paddingBottom: 10,
        fontSize: 9, fontFamily: FONT.mono, color: C.label,
        lineHeight: 1.5,
      }}>
        Enter to send · Shift+Enter for new line · Use @ to mention files
      </div>
    </div>
  )
}

// ─── Main Scene ───────────────────────────────────────────────────
export function SceneWorkflow() {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Timing
  // 0–20:   UI fades in
  // 20–48:  card slides up inside chat panel
  // 28–44:  buttons fade in
  // 80–100: glow pulses

  const uiOpacity = easeOut(progress(f, 0, 18))

  const cardSpring = spring({
    frame: f,
    fps,
    config: { damping: 20, stiffness: 110, mass: 0.85 },
    durationInFrames: 30,
    delay: 20,
  })

  const btnT    = easeOut(progress(f, 30, 18))
  const glowT   = easeOut(progress(f, 80, 20))

  // Stagger step reveal
  const stepsVisible = Math.min(STEPS.length, Math.floor(progress(f, 18, 24) * (STEPS.length + 1)))

  return (
    <div style={{
      width: W, height: H,
      position: 'relative',
      background: C.bg,
      overflow: 'hidden',
      fontFamily: FONT.sans,
    }}>
      {/* Navbar */}
      <Navbar opacity={uiOpacity} />

      {/* Left: media sidebar with SESSION block + pending approval */}
      <MediaSidebar opacity={uiOpacity} />

      {/* Center: session log */}
      <SessionPanel opacity={uiOpacity} stepsVisible={stepsVisible} />

      {/* Right: chat panel — approval card lives inside here */}
      <ChatPanel
        opacity={uiOpacity}
        cardSpring={cardSpring}
        btnT={btnT}
        glowT={glowT}
      />
    </div>
  )
}

const FILES = [
  { name: 'the secret beh...', size: '5.6 MB · .mp4' },
  { name: 'the secret that...', size: '11.7 MB · .mp4' },
  { name: 'this might be t...', size: '7.1 MB · .mp4' },
  { name: 'watch me coo...', size: '8.8 MB · .mp4' },
  { name: 'what are these...', size: '5.5 MB · .mp4' },
  { name: 'when my daw ...', size: '6.4 MB · .mp4' },
  { name: 'when the beat ...', size: '14.8 MB · .mp4' },
  { name: 'why are these ...', size: '14.6 MB · .mp4' },
]

const STEPS = [
  'Remux all 19 videos: beat day -cc_captioned.mp4',
  'Remux all 19 videos: being a mouse detective - cc_captioned.mp4',
  'Remux all 19 videos: i finally played drums, blew my mind_captioned.mp4',
  'Remux all 19 videos: inspiring beat turn to chaos -cc_captioned.mp4',
]

const CHAT_STEPS = [
  'Remux all 19 videos: the secre...',
  'Remux all 19 videos: the secre...',
  'Remux all 19 videos: this migh...',
  'Remux all 19 videos: watch m...',
  'Remux all 19 videos: what are ...',
  'Remux all 19 videos: when my...',
  'Remux all 19 videos: when the...',
  'Remux all 19 videos: why are t...',
  'Remux all 19 videos: you wont...',
]

const EXEC_STEPS = [
  { n: 1,  cmd: 'Remux all 19 videos: beat day -cc_...', sub: 'ffmpeg -y -i "C:/Users/USER/Vid...' },
  { n: 2,  cmd: 'Remux all 19 videos: being a mous...', sub: 'ffmpeg -y -i "C:/Users/USER/Vid...' },
]

// ── Scene 6: Executing ────────────────────────────────────────────────────────
export function SceneExecuting() {
  const f = useCurrentFrame()

  const STEPS = [
    { label:'Mix audio tracks',     range:[0,  60]  },
    { label:'Encode H.264 720p',    range:[55, 158] },
    { label:'Write output file',    range:[152,200] },
  ]

  function getStatus(i:number): 'waiting'|'running'|'done' {
    const [s,e] = STEPS[i].range
    if (f < s)  return 'waiting'
    if (f >= e) return 'done'
    return 'running'
  }
  function getPct(i:number) {
    const [s,e] = STEPS[i].range
    return clamp((f-s)/(e-s),0,1)
  }

  const allDone = f >= 205
  const statusColor = { waiting:AcC.pearlFaint, running:AcC.violet, done:AcC.green }

  return (
    <div style={{ width:AcW, height:AcH, position:'relative', background:AcC.bg, overflow:'hidden' }}>
      <AcNavbar opacity={1} activeTab="Workspace" />
      <AcMediaSidebar opacity={0.8} visibleFiles={6} />

      {/* Center execution view */}
      <div style={{
        position:'absolute', left:200, right:340, top:44, bottom:0,
        background:AcC.bg, display:'flex', flexDirection:'column', padding:24,
        fontFamily:AcFONT.sans,
      }}>
        <div style={{ fontSize:12, color:AcC.pearlFaint, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16 }}>
          Executing workflow
        </div>

        {/* Goal */}
        <div style={{
          background:AcC.card, border:`0.5px solid ${AcC.border}`,
          borderRadius:8, padding:'10px 14px', marginBottom:16,
          fontSize:12, color:AcC.pearlDim, lineHeight:1.5,
        }}>
          Compress intro.mp4 for Twitter with background audio from audio.wav
        </div>

        {/* Step progress bars */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {STEPS.map((step, i) => {
            const status = getStatus(i)
            const pct    = status==='done' ? 1 : status==='running' ? getPct(i) : 0
            return (
              <div key={step.label} style={{
                background:AcC.card, border:`0.5px solid ${AcC.border}`,
                borderRadius:8, padding:'12px 14px',
                opacity: status==='waiting' ? 0.4 : 1,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:12, color: status==='waiting' ? AcC.pearlFaint : AcC.pearl }}>
                    Step {i+1} — {step.label}
                  </span>
                  <span style={{ fontSize:12, color:statusColor[status] }}>
                    {status==='done' ? '✓ done' : status==='running' ? `${Math.round(pct*100)}%` : '—'}
                  </span>
                </div>
                <div style={{ height:4, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', borderRadius:99,
                    width:`${pct*100}%`,
                    background: status==='done'
                      ? AcC.green
                      : `linear-gradient(90deg,${AcC.violet},${AcC.brightTeal})`,
                    transition:'width 0.05s linear',
                  }}/>
                </div>
              </div>
            )
          })}
        </div>

        {allDone && (
          <div style={{
            marginTop:20, padding:'12px 16px', textAlign:'center',
            borderTop:`0.5px solid rgba(29,158,117,0.25)`,
            fontFamily:AcFONT.sans, fontSize:14, color:AcC.green,
            opacity:easeOut(progress(f,205,20)),
          }}>
            ✓ All steps complete — output ready
          </div>
        )}
      </div>

      <AcChatPanel opacity={0.6} messages={[]} />
    </div>
  )
}

// ── Scene 7: Session log ──────────────────────────────────────────────────────
export function SceneSessionLog() {
  const f = useCurrentFrame()

  const LOG_STEPS = [
    { id:1, title:'Generate Transcriptions: clip_06_chips_california_shorts.mp4', status:'done'    as const, cmd:'whisper clip_06... --model base --output_format srt --word_timestamps True --max_words_per_line 2' },
    { id:2, title:'Generate Transcriptions: clip_05_ai_jobs_shorts.mp4',          status:'done'    as const, cmd:'whisper clip_05... --model base --output_format srt --word_timestamps True --max_words_per_line 2' },
    { id:3, title:'Burn Captions: clip_06_chips_california_shorts.mp4',            status:'running' as const, cmd:'ffmpeg -y -i clip_06.mp4 -vf "subtitles=clip_06.srt:force_style=\'FontSize=24\'" clip_06_captioned.mp4' },
  ]

  return (
    <div style={{ width:AcW, height:AcH, position:'relative', background:AcC.bg, overflow:'hidden' }}>
      <AcNavbar opacity={1} activeTab="Workspace" />
      <AcMediaSidebar opacity={0.7} visibleFiles={6} />

      <div style={{
        position:'absolute', left:200, right:340, top:44, bottom:0,
        background:AcC.bg, fontFamily:AcFONT.sans,
      }}>
        {/* Tabs */}
        <div style={{
          display:'flex', alignItems:'center', padding:'0 16px',
          borderBottom:`0.5px solid ${AcC.border}`, height:44,
        }}>
          {['preview','output files','session log'].map(tab => (
            <div key={tab} style={{
              padding:'0 12px', height:44, display:'flex', alignItems:'center', gap:6,
              fontSize:12,
              color: tab==='session log' ? AcC.pearl : AcC.pearlDim,
              borderBottom: tab==='session log' ? `2px solid ${AcC.violet}` : '2px solid transparent',
            }}>
              {tab}
              {tab==='session log' && (
                <span style={{ background:AcC.purple, color:'#fff', borderRadius:99, padding:'1px 6px', fontSize:10 }}>live</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding:16 }}>
          {/* Meta */}
          <div style={{
            background:AcC.card, border:`0.5px solid ${AcC.border}`,
            borderRadius:8, padding:'12px 16px', marginBottom:14,
          }}>
            {[['GOAL','Generate captions for all clips'],['STATUS','in_progress'],['STARTED','11:32:37 AM']].map(([k,v]) => (
              <div key={k} style={{ display:'flex', gap:16, marginBottom:3 }}>
                <span style={{ fontSize:11, color:AcC.pearlFaint, width:64 }}>{k}</span>
                <span style={{ fontSize:11, color: v==='in_progress' ? AcC.purple : AcC.pearlDim }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Steps */}
          <div style={{ fontSize:10, color:AcC.pearlFaint, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>STEPS</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {LOG_STEPS.map((step, i) => (
              <div key={step.id} style={{
                background:AcC.card, border:`0.5px solid ${AcC.border}`,
                borderRadius:8, padding:'10px 12px',
                opacity:easeOut(progress(f, i*20, 18)),
                transform:`translateY(${(1-easeOut(progress(f,i*20,18)))*12}px)`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: step.status==='running' ? 8 : 0 }}>
                  <div style={{
                    width:20, height:20, borderRadius:'50%', flexShrink:0,
                    background: step.status==='done' ? 'rgba(29,158,117,0.2)' : 'rgba(139,53,204,0.15)',
                    border:`0.5px solid ${step.status==='done' ? AcC.green : AcC.violet}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, color: step.status==='done' ? AcC.green : AcC.violet,
                  }}>
                    {step.status==='done' ? '✓' : step.id}
                  </div>
                  <span style={{ flex:1, fontSize:11, color:AcC.pearlDim }}>{step.title}</span>
                  <span style={{ fontSize:10, color: step.status==='done' ? AcC.green : AcC.purple }}>{step.status}</span>
                </div>
                {step.status==='running' && (
                  <div style={{
                    fontFamily:AcFONT.mono, fontSize:9, color:'rgba(27,159,212,0.65)',
                    background:'rgba(0,0,0,0.3)', borderRadius:4, padding:'4px 8px',
                    lineHeight:1.5, marginLeft:30,
                  }}>
                    {step.cmd}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AcChatPanel opacity={0.7} messages={[
        { role:'ai', text:'Transcriptions done! Now burning captions into the videos...' }
      ]} />
    </div>
  )
}

// ── Scene 8: Settings page ────────────────────────────────────────────────────
export function SceneSettings() {
  const f = useCurrentFrame()

  const THEMES = ['Vizio Dark','Midnight','Studio','Frost','Pearl','Daylight']
  const ACCENTS = [
    { name:'Vizio', color:'#8B35CC' }, { name:'Mint',   color:'#10B981' },
    { name:'Indigo',color:'#EF4444' }, { name:'Violet', color:'#9B6DFF' },
    { name:'Coral', color:'#FB923C' }, { name:'Amber',  color:'#EAB308' },
  ]

  return (
    <div style={{ width:AcW, height:AcH, position:'relative', background:AcC.bg, overflow:'hidden', fontFamily:AcFONT.sans }}>
      <AcNavbar opacity={1} activeTab="Settings" />

      {/* Sidebar */}
      <div style={{
        position:'absolute', top:44, left:0, width:200, bottom:0,
        background:AcC.surface, borderRight:`0.5px solid ${AcC.border}`,
        padding:'16px 12px',
      }}>
        <div style={{ fontSize:10, color:AcC.pearlFaint, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12, paddingLeft:8 }}>PREFERENCES</div>
        {[['API & models', false],['Appearance', true]].map(([label, active]) => (
          <div key={label as string} style={{
            padding:'8px 10px', borderRadius:6, marginBottom:2,
            background: active ? 'rgba(139,53,204,0.12)' : 'transparent',
            fontSize:13, color: active ? AcC.pearl : AcC.pearlDim,
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{
        position:'absolute', top:44, left:200, right:0, bottom:0,
        padding:'24px 28px', overflow:'hidden',
        opacity:easeOut(progress(f,0,18)),
      }}>
        <div style={{ fontSize:22, fontWeight:500, color:AcC.pearl, marginBottom:24 }}>Settings</div>

        {/* Theme section */}
        <div style={{
          background:AcC.card, border:`0.5px solid ${AcC.border}`,
          borderRadius:10, padding:'20px 22px', marginBottom:16,
        }}>
          <div style={{ fontSize:14, fontWeight:500, color:AcC.pearl, marginBottom:16 }}>Theme</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {THEMES.map((theme, i) => (
              <div key={theme} style={{
                width:168, borderRadius:8,
                border:`${i===0 ? `1.5px solid ${AcC.violet}` : `0.5px solid ${AcC.border}`}`,
                background: i < 3 ? AcC.surface : 'rgba(240,245,255,0.9)',
                padding:'10px',
                opacity:easeOut(progress(f, i*8, 14)),
              }}>
                <div style={{
                  height:52, borderRadius:5, background: i<3
                    ? `linear-gradient(135deg, ${AcC.bg}, ${AcC.surface})`
                    : 'linear-gradient(135deg,#f0f5ff,#e8f0ff)',
                  marginBottom:8, border:`0.5px solid ${AcC.border}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  overflow:'hidden',
                }}>
                  <div style={{ width:'60%', height:2, background: i===0 ? AcC.violet : i<3 ? AcC.pearlFaint : '#ccc', borderRadius:99 }} />
                </div>
                <div style={{ fontSize:11, fontWeight:500, color: i<3 ? AcC.pearl : '#111', textAlign:'center' }}>{theme}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Accent section */}
        <div style={{
          background:AcC.card, border:`0.5px solid ${AcC.border}`,
          borderRadius:10, padding:'20px 22px',
          opacity:easeOut(progress(f,30,18)),
        }}>
          <div style={{ fontSize:14, fontWeight:500, color:AcC.pearl, marginBottom:6 }}>Accent color</div>
          <div style={{ fontSize:12, color:AcC.pearlFaint, marginBottom:14 }}>
            Used for active states, progress bars and highlights throughout the app.
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {ACCENTS.map((a, i) => (
              <div key={a.name} style={{
                display:'flex', alignItems:'center', gap:8,
                background: i===0 ? 'rgba(139,53,204,0.12)' : AcC.surface,
                border:`0.5px solid ${i===0 ? `rgba(139,53,204,0.4)` : AcC.border}`,
                borderRadius:8, padding:'7px 14px',
                opacity:easeOut(progress(f, 36+i*5, 14)),
              }}>
                <div style={{ width:16, height:16, borderRadius:'50%', background:a.color, flexShrink:0 }}>
                  {i===0 && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff', margin:'4.5px auto' }} />}
                </div>
                <span style={{ fontSize:12, color: i===0 ? AcC.pearl : AcC.pearlDim }}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Scene 9: Outro ────────────────────────────────────────────────────────────
export function SceneOutro() {
  const f = useCurrentFrame()
  const logoT  = easeOut(progress(f, 0, 22))
  const headT  = easeOut(progress(f, 20, 20))
  const btnsT  = easeOut(progress(f, 38, 18))
  const chipsT = easeOut(progress(f, 55, 16))

  return (
    <div style={{ width:AcW, height:AcH, position:'relative', background:'#000', overflow:'hidden' }}>
      <Aurora />
      <div style={{
        position:'absolute', inset:0,
        background: 'radial-gradient(circle at 32% 22%, rgba(139,53,204,0.18), transparent 24%),\n          radial-gradient(circle at 68% 40%, rgba(27, 159, 212, 0.29), transparent 20%),\n          linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.96) 100%)',
        pointerEvents:'none',
      }} />

      {/* Logo mark */}
      <div style={{
        position:'absolute', top:'25%', left:'50%',
        transform:`translateX(-50%) scale(${0.85+logoT*0.15}) translateY(${(1-logoT)*18}px)`,
        opacity:logoT,
      }}>
        <img
          src={staticFile('icon.png')}
          width={190}
          height={180}
          alt='Vizio logo'
          style={{ width:180, height:180, objectFit:'contain', display:'block' }}
        />
      </div>

      {/* Headline */}
      <div style={{
        position:'absolute', top:'47%', left:0, right:0, textAlign:'center',
        opacity:headT, transform:`translateY(${(1-headT)*18}px)`,
      }}>
        <div style={{ fontFamily:AcFONT.sans, fontSize:48, fontWeight:500, color:AcC.pearl, letterSpacing:'-0.5px', marginBottom:10 }}>
          Download <GradText>Vizio</GradText>
        </div>
        <div style={{ fontFamily:AcFONT.sans, fontSize:16, color:'rgba(200,216,232,0.45)' }}>
          Free and open source · Windows 10/11
        </div>
      </div>

      {/* Buttons */}
      <div style={{
        position:'absolute', top:'60%', left:'50%',
        transform:`translateX(-50%) translateY(${(1-btnsT)*14}px)`,
        opacity:btnsT, display:'flex', gap:14,
      }}>
        <div style={{
          background:`linear-gradient(90deg,${AcC.violet},${AcC.brightTeal})`,
          borderRadius:8, padding:'12px 30px',
          fontFamily:AcFONT.sans, fontSize:15, fontWeight:500, color:'#fff',
          boxShadow:`0 0 30px rgba(139,53,204,0.4)`,
        }}>
          ↓ Download for Windows
        </div>
        <div style={{
          background:'transparent', border:`0.5px solid rgba(255,255,255,0.18)`,
          borderRadius:8, padding:'12px 24px',
          fontFamily:AcFONT.sans, fontSize:15, color:'rgba(200,216,232,0.7)',
        }}>
          View on GitHub
        </div>
      </div>

      {/* Chips */}
      <div style={{
        position:'absolute', top:'69%', left:'50%',
        transform:'translateX(-50%)',
        opacity:chipsT, display:'flex', gap:8,
      }}>
        {['v0.1.0','ffmpeg bundled','no account needed','No subscription'].map(chip => (
          <div key={chip} style={{
            background:'rgba(139,53,204,0.10)', border:`0.5px solid rgba(139,53,204,0.22)`,
            borderRadius:4, padding:'3px 10px',
            fontFamily:AcFONT.sans, fontSize:13, color:'rgba(200,216,232,0.45)',
          }}>{chip}</div>
        ))}
      </div>
    </div>
  )
}
