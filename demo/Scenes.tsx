import React from 'react'
import { staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import { Aurora } from './Aurora'
import { Navbar, MediaSidebar, ChatPanel, SessionPanel } from './AppChrome'
import { C, FONT, W, H, clamp, easeOut, easeInOut, progress, FPS } from './constants'

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
    <div style={{ width:W, height:H, position:'relative', background:'#000', overflow:'hidden' }}>
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
        <div style={{ fontFamily:FONT.sans, fontSize:44, fontWeight:500, color:C.pearl, letterSpacing:'-0.5px', lineHeight:1.1 }}>
          Edit video with <GradText>plain English</GradText>
        </div>
      </div>

      {/* Sub */}
      <div style={{
        position:'absolute', top:'67%', left:0, right:0, textAlign:'center',
        ...slideUp(f, 40, 16),
      }}>
        <div style={{ fontFamily:FONT.sans, fontSize:16, color:'rgba(200,216,232,0.45)' }}>
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
          fontFamily:FONT.mono, fontSize:11, color:'rgba(200,216,232,0.55)', letterSpacing:'0.12em',
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
    <div style={{ width:W, height:H, position:'relative', background:'#000', overflow:'hidden' }}>
      <Aurora opacity={bgT} />

      {/* Card */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:`translate(-50%,-50%) scale(${0.92+cardT*0.08}) translateY(${(1-cardT)*20}px)`,
        opacity:cardT,
        width:560,
        background:'rgba(10,15,28,0.90)',
        border:`0.5px solid rgba(255,255,255,0.10)`,
        borderRadius:14,
        padding:'40px 40px 32px',
        backdropFilter:'blur(20px)',
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

        <h2 style={{ fontFamily:FONT.sans, fontSize:26, fontWeight:500, color:C.pearl, margin:'0 0 6px', textAlign:'center' }}>
          Welcome back
        </h2>
        <p style={{ fontFamily:FONT.sans, fontSize:14, color:C.pearlDim, margin:'0 0 24px', textAlign:'center' }}>
          Open a recent project or start a new one
        </p>

        {/* Project row */}
        <div style={{
          background:C.surface, border:`0.5px solid ${C.border}`,
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
            <div style={{ fontFamily:FONT.sans, fontSize:14, color:C.pearl, fontWeight:500 }}>taste</div>
            <div style={{ fontFamily:FONT.mono, fontSize:11, color:C.pearlFaint }}>C:\Users\USER\Videos\taste</div>
          </div>
          <span style={{ fontSize:18, color:C.pearlDim }}>→</span>
          <span style={{ fontSize:14, color:C.pearlFaint, opacity:0.5 }}>×</span>
        </div>

        {/* New project button */}
        <div style={{
          background:'rgba(139,53,204,0.08)', border:`0.5px solid rgba(139,53,204,0.2)`,
          borderRadius:8, padding:'11px', textAlign:'center',
          fontFamily:FONT.sans, fontSize:14, color:'rgba(139,53,204,0.7)',
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
    <div style={{ width:W, height:H, position:'relative', background:C.bg, overflow:'hidden' }}>
      <Navbar opacity={1} activeTab="Workspace" />
      <MediaSidebar opacity={1} visibleFiles={6} />
      <SessionPanel opacity={0.4} steps={[]} tasks={[]} />

      {/* Chat panel with live typing */}
      <div style={{
        position:'absolute', right:0, top:44, bottom:0, width:340,
        background:C.card, borderLeft:`0.5px solid ${C.border}`,
        display:'flex', flexDirection:'column', fontFamily:FONT.sans,
      }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 14px', borderBottom:`0.5px solid ${C.border}`,
        }}>
          <span style={{ fontSize:11, color:C.pearlDim }}>@[clip_06_chips_california_short...]</span>
          <div style={{
            background:'rgba(139,53,204,0.12)', border:`0.5px solid rgba(139,53,204,0.3)`,
            borderRadius:99, padding:'3px 10px', fontSize:11, color:C.violet,
          }}>+ New chat</div>
        </div>

        <div style={{ flex:1, padding:'14px', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{
            alignSelf:'flex-end', maxWidth:'88%',
            background:'rgba(139,53,204,0.18)', border:`0.5px solid rgba(139,53,204,0.3)`,
            borderRadius:10, padding:'9px 13px', fontSize:12, color:C.pearl, lineHeight:1.6,
          }}>
            what can you do with my videos?
          </div>
          <div style={{
            alignSelf:'flex-start', maxWidth:'88%',
            background:C.surface, border:`0.5px solid ${C.border}`,
            borderRadius:10, padding:'9px 13px', fontSize:12, color:C.pearl, lineHeight:1.6,
          }}>
            I can see <strong style={{color:C.brightTeal}}>7 MP4 files</strong> in your project. I can compress, trim, merge, add captions, convert format, extract audio, and more — just describe what you want.
          </div>

          {/* Thinking dots */}
          {showThinking && (
            <div style={{
              alignSelf:'flex-start',
              background:C.surface, border:`0.5px solid ${C.border}`,
              borderRadius:10, padding:'10px 14px',
              display:'flex', gap:5, alignItems:'center',
              opacity: thinkingProgress, transform:`translateY(${(1-thinkingProgress)*10}px)`,
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:7, height:7, borderRadius:'50%', background:C.violet,
                  opacity: 0.3 + 0.7*Math.abs(Math.sin((f-140)*0.18 + i*1.1)),
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Input with typing */}
        <div style={{ borderTop:`0.5px solid ${C.border}`, padding:'10px 12px' }}>
          <div style={{
            background:C.surface, borderRadius:8,
            border:`0.5px solid rgba(139,53,204,0.3)`,
            display:'flex', alignItems:'flex-start', gap:8, padding:'8px 12px', minHeight:44,
          }}>
            <div style={{ width:18, height:18, opacity:0.3, fontSize:14, color:C.pearl, flexShrink:0, marginTop:1 }}>🖼</div>
            <span style={{ flex:1, fontSize:12, color: displayed ? C.pearl : C.pearlFaint, lineHeight:1.5, wordBreak:'break-word' }}>
              {displayed}
              {typing && (
                <span style={{
                  display:'inline-block', width:2, height:'1.1em',
                  background:C.brightTeal, marginLeft:2, verticalAlign:'text-bottom',
                  opacity: Math.floor(f/7)%2===0 ? 1 : 0,
                }} />
              )}
            </span>
            <div style={{
              width:28, height:28, borderRadius:'50%',
              background:`linear-gradient(135deg,${C.violet},${C.brightTeal})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, color:'#fff', flexShrink:0,
            }}>↑</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Scene 5: Approval card ────────────────────────────────────────────────────
export function SceneWorkflow() {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()

  const cardSpring = spring({ frame:f, fps, config:{ damping:18, stiffness:100, mass:0.9 }, durationInFrames:28 })
  const btnT = easeOut(progress(f, 28, 16))
  const glowT = easeOut(progress(f, 80, 20))

  const STEPS = [
    'Mix audio.wav at -20dB over video track',
    'Encode H.264 CRF 28, AAC 128k, scale 1280×720',
    'Output to project/output/intro_twitter.mp4',
  ]

  return (
    <div style={{ width:W, height:H, position:'relative', background:C.bg, overflow:'hidden' }}>
      <Navbar opacity={1} activeTab="Workspace" />
      <MediaSidebar opacity={0.5} visibleFiles={5} />
      <SessionPanel opacity={0.35} steps={[]} tasks={[]} />

      {/* Darkened chat bg */}
      <div style={{
        position:'absolute', right:0, top:44, bottom:0, width:340,
        background:C.card, borderLeft:`0.5px solid ${C.border}`, opacity:0.5,
      }} />

      {/* Centered approval card */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:`translate(-50%,-50%) scale(${0.88+cardSpring*0.12}) translateY(${(1-cardSpring)*28}px)`,
        opacity:cardSpring,
        width:460,
        background:C.card,
        border:`0.5px solid rgba(139,53,204,0.40)`,
        borderRadius:12,
        padding:'18px 20px',
        fontFamily:FONT.sans,
        boxShadow:`0 0 60px rgba(139,53,204,0.18)`,
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <div style={{
            width:20, height:20, borderRadius:'50%',
            background:'rgba(139,53,204,0.2)', border:`0.5px solid rgba(139,53,204,0.5)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:10, color:C.violet,
          }}>✓</div>
          <span style={{ fontSize:12, color:C.violet, fontWeight:500 }}>Workflow ready</span>
          <div style={{
            marginLeft:'auto', background:'rgba(139,53,204,0.12)', border:`0.5px solid rgba(139,53,204,0.2)`,
            borderRadius:99, padding:'2px 8px', fontSize:10, color:C.violet,
          }}>3 steps</div>
        </div>

        <div style={{ fontSize:12, color:C.pearlDim, marginBottom:12, lineHeight:1.5 }}>
          Compress <strong style={{color:C.pearl}}>intro.mp4</strong> for Twitter with background audio from <strong style={{color:C.pearl}}>audio.wav</strong>
        </div>

        {/* Steps */}
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:14 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'8px 10px',
              background:`rgba(139,53,204,${[0.08,0.05,0.04][i]})`,
              borderRadius:7,
            }}>
              <div style={{
                width:20, height:20, borderRadius:'50%', flexShrink:0,
                background:'rgba(139,53,204,0.15)', border:`0.5px solid rgba(139,53,204,0.3)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, color:C.violet, fontWeight:500,
              }}>{i+1}</div>
              <span style={{ fontSize:11, color:'rgba(200,216,232,0.55)', lineHeight:1.4 }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display:'flex', gap:8, opacity:btnT, transform:`translateY(${(1-btnT)*8}px)` }}>
          <div style={{
            background:`linear-gradient(90deg,${C.violet},${C.brightTeal})`,
            borderRadius:6, padding:'8px 22px',
            fontSize:12, color:'#fff', fontWeight:500, cursor:'pointer',
            boxShadow:`0 0 20px rgba(139,53,204,${glowT*0.5})`,
          }}>
            ✓ Allow
          </div>
          <div style={{
            background:'transparent', border:`0.5px solid ${C.border}`,
            borderRadius:6, padding:'8px 16px',
            fontSize:12, color:C.pearlFaint, cursor:'pointer',
          }}>
            Dismiss
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const statusColor = { waiting:C.pearlFaint, running:C.violet, done:C.green }

  return (
    <div style={{ width:W, height:H, position:'relative', background:C.bg, overflow:'hidden' }}>
      <Navbar opacity={1} activeTab="Workspace" />
      <MediaSidebar opacity={0.8} visibleFiles={6} />

      {/* Center execution view */}
      <div style={{
        position:'absolute', left:200, right:340, top:44, bottom:0,
        background:C.bg, display:'flex', flexDirection:'column', padding:24,
        fontFamily:FONT.sans,
      }}>
        <div style={{ fontSize:12, color:C.pearlFaint, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16 }}>
          Executing workflow
        </div>

        {/* Goal */}
        <div style={{
          background:C.card, border:`0.5px solid ${C.border}`,
          borderRadius:8, padding:'10px 14px', marginBottom:16,
          fontSize:12, color:C.pearlDim, lineHeight:1.5,
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
                background:C.card, border:`0.5px solid ${C.border}`,
                borderRadius:8, padding:'12px 14px',
                opacity: status==='waiting' ? 0.4 : 1,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:12, color: status==='waiting' ? C.pearlFaint : C.pearl }}>
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
                      ? C.green
                      : `linear-gradient(90deg,${C.violet},${C.brightTeal})`,
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
            fontFamily:FONT.sans, fontSize:14, color:C.green,
            opacity:easeOut(progress(f,205,20)),
          }}>
            ✓ All steps complete — output ready
          </div>
        )}
      </div>

      <ChatPanel opacity={0.6} messages={[]} />
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
    <div style={{ width:W, height:H, position:'relative', background:C.bg, overflow:'hidden' }}>
      <Navbar opacity={1} activeTab="Workspace" />
      <MediaSidebar opacity={0.7} visibleFiles={6} />

      <div style={{
        position:'absolute', left:200, right:340, top:44, bottom:0,
        background:C.bg, fontFamily:FONT.sans,
      }}>
        {/* Tabs */}
        <div style={{
          display:'flex', alignItems:'center', padding:'0 16px',
          borderBottom:`0.5px solid ${C.border}`, height:44,
        }}>
          {['preview','output files','session log'].map(tab => (
            <div key={tab} style={{
              padding:'0 12px', height:44, display:'flex', alignItems:'center', gap:6,
              fontSize:12,
              color: tab==='session log' ? C.pearl : C.pearlDim,
              borderBottom: tab==='session log' ? `2px solid ${C.violet}` : '2px solid transparent',
            }}>
              {tab}
              {tab==='session log' && (
                <span style={{ background:C.purple, color:'#fff', borderRadius:99, padding:'1px 6px', fontSize:10 }}>live</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding:16 }}>
          {/* Meta */}
          <div style={{
            background:C.card, border:`0.5px solid ${C.border}`,
            borderRadius:8, padding:'12px 16px', marginBottom:14,
          }}>
            {[['GOAL','Generate captions for all clips'],['STATUS','in_progress'],['STARTED','11:32:37 AM']].map(([k,v]) => (
              <div key={k} style={{ display:'flex', gap:16, marginBottom:3 }}>
                <span style={{ fontSize:11, color:C.pearlFaint, width:64 }}>{k}</span>
                <span style={{ fontSize:11, color: v==='in_progress' ? C.purple : C.pearlDim }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Steps */}
          <div style={{ fontSize:10, color:C.pearlFaint, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>STEPS</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {LOG_STEPS.map((step, i) => (
              <div key={step.id} style={{
                background:C.card, border:`0.5px solid ${C.border}`,
                borderRadius:8, padding:'10px 12px',
                opacity:easeOut(progress(f, i*20, 18)),
                transform:`translateY(${(1-easeOut(progress(f,i*20,18)))*12}px)`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: step.status==='running' ? 8 : 0 }}>
                  <div style={{
                    width:20, height:20, borderRadius:'50%', flexShrink:0,
                    background: step.status==='done' ? 'rgba(29,158,117,0.2)' : 'rgba(139,53,204,0.15)',
                    border:`0.5px solid ${step.status==='done' ? C.green : C.violet}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, color: step.status==='done' ? C.green : C.violet,
                  }}>
                    {step.status==='done' ? '✓' : step.id}
                  </div>
                  <span style={{ flex:1, fontSize:11, color:C.pearlDim }}>{step.title}</span>
                  <span style={{ fontSize:10, color: step.status==='done' ? C.green : C.purple }}>{step.status}</span>
                </div>
                {step.status==='running' && (
                  <div style={{
                    fontFamily:FONT.mono, fontSize:9, color:'rgba(27,159,212,0.65)',
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

      <ChatPanel opacity={0.7} messages={[
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
    <div style={{ width:W, height:H, position:'relative', background:C.bg, overflow:'hidden', fontFamily:FONT.sans }}>
      <Navbar opacity={1} activeTab="Settings" />

      {/* Sidebar */}
      <div style={{
        position:'absolute', top:44, left:0, width:200, bottom:0,
        background:C.surface, borderRight:`0.5px solid ${C.border}`,
        padding:'16px 12px',
      }}>
        <div style={{ fontSize:10, color:C.pearlFaint, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12, paddingLeft:8 }}>PREFERENCES</div>
        {[['API & models', false],['Appearance', true]].map(([label, active]) => (
          <div key={label as string} style={{
            padding:'8px 10px', borderRadius:6, marginBottom:2,
            background: active ? 'rgba(139,53,204,0.12)' : 'transparent',
            fontSize:13, color: active ? C.pearl : C.pearlDim,
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
        <div style={{ fontSize:22, fontWeight:500, color:C.pearl, marginBottom:24 }}>Settings</div>

        {/* Theme section */}
        <div style={{
          background:C.card, border:`0.5px solid ${C.border}`,
          borderRadius:10, padding:'20px 22px', marginBottom:16,
        }}>
          <div style={{ fontSize:14, fontWeight:500, color:C.pearl, marginBottom:16 }}>Theme</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {THEMES.map((theme, i) => (
              <div key={theme} style={{
                width:168, borderRadius:8,
                border:`${i===0 ? `1.5px solid ${C.violet}` : `0.5px solid ${C.border}`}`,
                background: i < 3 ? C.surface : 'rgba(240,245,255,0.9)',
                padding:'10px',
                opacity:easeOut(progress(f, i*8, 14)),
              }}>
                <div style={{
                  height:52, borderRadius:5, background: i<3
                    ? `linear-gradient(135deg, ${C.bg}, ${C.surface})`
                    : 'linear-gradient(135deg,#f0f5ff,#e8f0ff)',
                  marginBottom:8, border:`0.5px solid ${C.border}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  overflow:'hidden',
                }}>
                  <div style={{ width:'60%', height:2, background: i===0 ? C.violet : i<3 ? C.pearlFaint : '#ccc', borderRadius:99 }} />
                </div>
                <div style={{ fontSize:11, fontWeight:500, color: i<3 ? C.pearl : '#111', textAlign:'center' }}>{theme}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Accent section */}
        <div style={{
          background:C.card, border:`0.5px solid ${C.border}`,
          borderRadius:10, padding:'20px 22px',
          opacity:easeOut(progress(f,30,18)),
        }}>
          <div style={{ fontSize:14, fontWeight:500, color:C.pearl, marginBottom:6 }}>Accent color</div>
          <div style={{ fontSize:12, color:C.pearlFaint, marginBottom:14 }}>
            Used for active states, progress bars and highlights throughout the app.
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {ACCENTS.map((a, i) => (
              <div key={a.name} style={{
                display:'flex', alignItems:'center', gap:8,
                background: i===0 ? 'rgba(139,53,204,0.12)' : C.surface,
                border:`0.5px solid ${i===0 ? `rgba(139,53,204,0.4)` : C.border}`,
                borderRadius:8, padding:'7px 14px',
                opacity:easeOut(progress(f, 36+i*5, 14)),
              }}>
                <div style={{ width:16, height:16, borderRadius:'50%', background:a.color, flexShrink:0 }}>
                  {i===0 && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff', margin:'4.5px auto' }} />}
                </div>
                <span style={{ fontSize:12, color: i===0 ? C.pearl : C.pearlDim }}>{a.name}</span>
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
    <div style={{ width:W, height:H, position:'relative', background:'#000', overflow:'hidden' }}>
      <Aurora />

      {/* Logo mark */}
      <div style={{
        position:'absolute', top:'14%', left:'50%',
        transform:`translateX(-50%) scale(${0.85+logoT*0.15}) translateY(${(1-logoT)*18}px)`,
        opacity:logoT,
      }}>
        <div style={{
          width:80, height:80, borderRadius:16,
          background:'linear-gradient(135deg,#6B1FA8,#1B9FD4)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:36, color:'#fff', fontWeight:300,
          boxShadow:`0 0 50px rgba(107,31,168,0.4)`,
        }}>V</div>
      </div>

      {/* Headline */}
      <div style={{
        position:'absolute', top:'34%', left:0, right:0, textAlign:'center',
        opacity:headT, transform:`translateY(${(1-headT)*18}px)`,
      }}>
        <div style={{ fontFamily:FONT.sans, fontSize:48, fontWeight:500, color:C.pearl, letterSpacing:'-0.5px', marginBottom:10 }}>
          Download <GradText>Vizio</GradText>
        </div>
        <div style={{ fontFamily:FONT.sans, fontSize:16, color:'rgba(200,216,232,0.45)' }}>
          Free and open source · Windows 10/11
        </div>
      </div>

      {/* Buttons */}
      <div style={{
        position:'absolute', top:'57%', left:'50%',
        transform:`translateX(-50%) translateY(${(1-btnsT)*14}px)`,
        opacity:btnsT, display:'flex', gap:14,
      }}>
        <div style={{
          background:`linear-gradient(90deg,${C.violet},${C.brightTeal})`,
          borderRadius:8, padding:'12px 30px',
          fontFamily:FONT.sans, fontSize:15, fontWeight:500, color:'#fff',
          boxShadow:`0 0 30px rgba(139,53,204,0.4)`,
        }}>
          ↓ Download for Windows
        </div>
        <div style={{
          background:'transparent', border:`0.5px solid rgba(255,255,255,0.18)`,
          borderRadius:8, padding:'12px 24px',
          fontFamily:FONT.sans, fontSize:15, color:'rgba(200,216,232,0.7)',
        }}>
          View on GitHub
        </div>
      </div>

      {/* Chips */}
      <div style={{
        position:'absolute', top:'73%', left:'50%',
        transform:'translateX(-50%)',
        opacity:chipsT, display:'flex', gap:8,
      }}>
        {['v0.1.0','ffmpeg bundled','no account needed','MIT license'].map(chip => (
          <div key={chip} style={{
            background:'rgba(139,53,204,0.10)', border:`0.5px solid rgba(139,53,204,0.22)`,
            borderRadius:4, padding:'3px 10px',
            fontFamily:FONT.sans, fontSize:11, color:'rgba(200,216,232,0.45)',
          }}>{chip}</div>
        ))}
      </div>
    </div>
  )
}
