import React, { useEffect, useRef } from 'react'
import { useCurrentFrame } from 'remotion'
import { W, H, C, FONT, clamp, easeOut, progress } from './constants'

// ── Navbar ────────────────────────────────────────────────────────────────────
export function Navbar({ opacity = 1, activeTab = 'Workspace' }: { opacity?: number; activeTab?: string }) {
  const tabs = ['Workspace', 'Tools', 'Settings']
  return (
    <div style={{
      position:'absolute', top:0, left:0, right:0, height:44,
      background: C.navBg,
      borderBottom:`0.5px solid ${C.border}`,
      display:'flex', alignItems:'center',
      padding:'0 12px', gap:0,
      opacity,
      fontFamily: FONT.sans,
      zIndex:100,
    }}>
      {/* Back/fwd arrows */}
      <div style={{ display:'flex', gap:4, marginRight:8, opacity:0.3 }}>
        <div style={{ width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:C.pearl }}>‹</div>
        <div style={{ width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:C.pearl }}>›</div>
      </div>
      {/* Project badge */}
      <div style={{
        display:'flex', alignItems:'center', gap:6,
        background:'rgba(139,53,204,0.12)', border:'0.5px solid rgba(139,53,204,0.3)',
        borderRadius:6, padding:'4px 10px', marginRight:16,
      }}>
        <div style={{ width:14, height:14, borderRadius:3, background:'linear-gradient(135deg,#8B35CC,#1B9FD4)', flexShrink:0 }} />
        <span style={{ fontSize:13, color:C.pearl, fontWeight:500 }}>taste</span>
        <span style={{ fontSize:11, color:C.pearlDim }}>↓</span>
      </div>
      {/* Tabs */}
      {tabs.map(tab => (
        <div key={tab} style={{
          padding:'0 14px', height:44, display:'flex', alignItems:'center',
          fontSize:13, color: tab === activeTab ? C.pearl : C.pearlDim,
          borderBottom: tab === activeTab ? `2px solid ${C.violet}` : '2px solid transparent',
          cursor:'pointer',
        }}>
          {tab}
        </div>
      ))}
      {/* Center title */}
      <div style={{ flex:1, textAlign:'center', fontSize:14, color:C.pearlFaint }}>Vizio</div>
      {/* Window buttons */}
      <div style={{ display:'flex', gap:8, opacity:0.4 }}>
        {['−','□','×'].map(b => (
          <div key={b} style={{ width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:C.pearl }}>{b}</div>
        ))}
      </div>
    </div>
  )
}

// ── Media sidebar ─────────────────────────────────────────────────────────────
export function MediaSidebar({ opacity = 1, visibleFiles = 6 }: { opacity?: number; visibleFiles?: number }) {
  const files = [
    { name:'clip_03_build_a...', size:'4.7 MB · .mp4' },
    { name:'clip_03_build_a...', size:'1.6 MB · .mp4' },
    { name:'clip_04_three_...', size:'3.9 MB · .mp4'  },
    { name:'clip_04_three_...', size:'1.5 MB · .mp4'  },
    { name:'clip_05_ai_jobs...', size:'4.1 MB · .mp4' },
    { name:'clip_06_chips_c...', size:'4.2 MB · .mp4' },
    { name:'clip_06_chips_c...', size:'1.6 MB · .mp4' },
  ]

  return (
    <div style={{
      position:'absolute', left:0, top:44, bottom:0, width:200,
      background: C.surface,
      borderRight:`0.5px solid ${C.border}`,
      display:'flex', flexDirection:'column',
      fontFamily: FONT.sans,
      opacity,
    }}>
      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 12px 6px',
      }}>
        <span style={{ fontSize:10, color:C.pearlFaint, letterSpacing:'0.08em', textTransform:'uppercase' }}>MEDIA</span>
        <span style={{ fontSize:11, color:C.pearlDim, background:'rgba(255,255,255,0.06)', borderRadius:4, padding:'1px 6px' }}>
          {visibleFiles} files
        </span>
      </div>
      {/* File list */}
      <div style={{ flex:1, overflow:'hidden', padding:'4px 8px' }}>
        {files.slice(0, visibleFiles).map((f, i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'7px 6px', borderRadius:6, marginBottom:2,
            background: i === 0 ? 'rgba(139,53,204,0.10)' : 'transparent',
          }}>
            <div style={{
              width:34, height:26, borderRadius:4,
              background: `linear-gradient(135deg, ${C.violet}33, ${C.teal}44)`,
              border:`0.5px solid rgba(139,53,204,0.3)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:8, color:C.violet, fontWeight:700, letterSpacing:0.5, flexShrink:0,
            }}>
              MP4
            </div>
            <div>
              <div style={{ fontSize:11, color: i===0 ? C.pearl : C.pearlDim, lineHeight:1.3 }}>{f.name}</div>
              <div style={{ fontSize:10, color:C.pearlFaint }}>{f.size}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Add more */}
      <div style={{
        margin:'8px', padding:'7px', textAlign:'center',
        border:`0.5px dashed rgba(255,255,255,0.1)`, borderRadius:6,
        fontSize:11, color:C.pearlFaint, cursor:'pointer',
      }}>
        + add more files
      </div>
      {/* Session info */}
      <div style={{
        borderTop:`0.5px solid ${C.border}`,
        padding:'8px 12px',
      }}>
        <div style={{ fontSize:10, color:C.pearlFaint, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:4 }}>SESSION</div>
        {[['provider','Groq'],['model','llama-3.3-70b'],['status','local']].map(([k,v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
            <span style={{ fontSize:10, color:C.pearlFaint }}>{k}</span>
            <span style={{ fontSize:10, color:C.pearlDim }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Chat panel ────────────────────────────────────────────────────────────────
export function ChatPanel({
  opacity = 1,
  messages = [],
  showInput = true,
  inputText = '',
  showThinking = false,
}: {
  opacity?: number
  messages?: { role:'user'|'ai', text:string, bold?:string }[]
  showInput?: boolean
  inputText?: string
  showThinking?: boolean
}) {
  return (
    <div style={{
      position:'absolute', right:0, top:44, bottom:0, width:340,
      background: C.card,
      borderLeft:`0.5px solid ${C.border}`,
      display:'flex', flexDirection:'column',
      fontFamily: FONT.sans,
      opacity,
    }}>
      {/* Top bar */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px', borderBottom:`0.5px solid ${C.border}`,
      }}>
        <span style={{ fontSize:11, color:C.pearlDim, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          @[clip_06_chips_california_short...]
        </span>
        <div style={{
          background:'rgba(139,53,204,0.12)', border:`0.5px solid rgba(139,53,204,0.3)`,
          borderRadius:99, padding:'3px 10px', fontSize:11, color:C.violet,
        }}>
          + New chat
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, padding:'12px 14px', display:'flex', flexDirection:'column', gap:10, overflow:'hidden' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth:'88%',
            background: m.role === 'user' ? 'rgba(139,53,204,0.18)' : C.surface,
            border:`0.5px solid ${m.role==='user' ? 'rgba(139,53,204,0.3)' : C.border}`,
            borderRadius:10, padding:'9px 13px',
            fontSize:12, color:C.pearl, lineHeight:1.6,
          }}>
            {m.text}
          </div>
        ))}
        {showThinking && (
          <div style={{
            alignSelf:'flex-start',
            background: C.surface, border:`0.5px solid ${C.border}`,
            borderRadius:10, padding:'10px 14px',
            display:'flex', gap:5, alignItems:'center',
          }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width:7, height:7, borderRadius:'50%', background:C.violet,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      {showInput && (
        <div style={{ borderTop:`0.5px solid ${C.border}`, padding:'10px 12px' }}>
          <div style={{
            background: C.surface, borderRadius:8,
            border:`0.5px solid ${C.border}`,
            display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
          }}>
            <div style={{ width:18, height:18, opacity:0.3, fontSize:14, color:C.pearl }}>🖼</div>
            <span style={{ flex:1, fontSize:12, color: inputText ? C.pearl : C.pearlFaint }}>
              {inputText || 'Describe an edit or ask anything...'}
            </span>
            <div style={{
              width:28, height:28, borderRadius:'50%',
              background:`linear-gradient(135deg,${C.violet},${C.brightTeal})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12, color:'#fff', flexShrink:0,
            }}>
              ↑
            </div>
          </div>
          <div style={{ fontSize:10, color:C.pearlFaint, marginTop:5, textAlign:'center' }}>
            Enter to send · Shift+Enter for new line · Use @ to mention files
          </div>
        </div>
      )}
    </div>
  )
}

// ── Session / workflow panel (center) ─────────────────────────────────────────
export function SessionPanel({ opacity = 1, activeTab = 'session log', steps = [], tasks = [] }: {
  opacity?: number
  activeTab?: string
  steps?: { id:number; title:string; status:'running'|'pending'|'done'|'failed' }[]
  tasks?: { label:string; progress:number; status:'done'|'failed'|'running' }[]
}) {
  const tabs = ['preview','output files','session log']
  const statusColors: Record<string,string> = {
    running: C.purple, pending: C.pearlFaint, done: C.green, failed: C.red,
  }
  const taskBg: Record<string,string> = {
    done:'rgba(29,158,117,0.12)', failed:'rgba(226,75,74,0.12)', running:'rgba(139,53,204,0.08)',
  }

  return (
    <div style={{
      position:'absolute', left:200, right:340, top:44, bottom:0,
      background: C.bg,
      display:'flex', flexDirection:'column',
      fontFamily: FONT.sans,
      opacity,
    }}>
      {/* Tabs */}
      <div style={{
        display:'flex', alignItems:'center', gap:4,
        padding:'0 16px', borderBottom:`0.5px solid ${C.border}`, height:44,
      }}>
        {tabs.map(tab => (
          <button key={tab} style={{
            background:'none', border:'none',
            padding:'0 12px', height:44,
            fontSize:12, color: tab === activeTab ? C.pearl : C.pearlDim,
            borderBottom: tab === activeTab ? `2px solid ${C.violet}` : '2px solid transparent',
            cursor:'pointer', display:'flex', alignItems:'center', gap:6,
          }}>
            {tab}
            {tab === 'session log' && (
              <span style={{
                background: C.purple, color:'#fff',
                borderRadius:99, padding:'1px 6px', fontSize:10,
              }}>live</span>
            )}
            {tab === 'output files' && steps.filter(s=>s.status==='done').length > 0 && (
              <span style={{
                background:'rgba(29,158,117,0.2)', color:C.green,
                borderRadius:99, padding:'1px 6px', fontSize:10,
              }}>{steps.filter(s=>s.status==='done').length}</span>
            )}
          </button>
        ))}
        {/* Task pills */}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          {['task 1','task 2','task 3','task 4','task 5','task 6'].map((t,i) => (
            <div key={t} style={{
              borderRadius:99, padding:'3px 10px', fontSize:11,
              background: i===5 ? C.violet : 'rgba(255,255,255,0.06)',
              color: i===5 ? '#fff' : C.pearlDim,
              border:`0.5px solid ${i===5 ? C.violet : C.border}`,
            }}>{t}</div>
          ))}
        </div>
      </div>

      {/* Session log content */}
      <div style={{ flex:1, overflow:'hidden', padding:'16px' }}>
        {/* Goal/status/started */}
        <div style={{
          background:C.card, border:`0.5px solid ${C.border}`,
          borderRadius:8, padding:'12px 16px', marginBottom:16,
        }}>
          {[['GOAL','—'],['STATUS','in_progress'],['STARTED','11:32:37 AM']].map(([k,v]) => (
            <div key={k} style={{ display:'flex', gap:16, marginBottom:4 }}>
              <span style={{ fontSize:11, color:C.pearlFaint, width:60 }}>{k}</span>
              <span style={{ fontSize:11, color: v==='in_progress' ? C.purple : C.pearlDim }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Plan */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:C.pearlFaint, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>PLAN</div>
          <div style={{
            background:C.card, border:`0.5px solid ${C.border}`,
            borderRadius:8, padding:'10px 14px',
            fontSize:12, color:C.pearlDim, lineHeight:1.6,
          }}>
            I will generate transcriptions using Whisper with word timestamps and burn styled captions into each video clip.
          </div>
        </div>

        {/* Steps */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:C.pearlFaint, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>STEPS</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {steps.map(step => (
              <div key={step.id} style={{
                background:C.card, border:`0.5px solid ${C.border}`,
                borderRadius:8, padding:'10px 14px',
                display:'flex', alignItems:'center', gap:12,
              }}>
                <div style={{
                  width:22, height:22, borderRadius:'50%', flexShrink:0,
                  background:`rgba(139,53,204,0.1)`,
                  border:`0.5px solid rgba(139,53,204,0.3)`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, color:C.violet, fontWeight:500,
                }}>
                  {step.id}
                </div>
                <span style={{ flex:1, fontSize:12, color:C.pearlDim }}>{step.title}</span>
                <span style={{ fontSize:11, color: statusColors[step.status] ?? C.pearlFaint }}>{step.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks bottom bar */}
      {tasks.length > 0 && (
        <div style={{
          borderTop:`0.5px solid ${C.border}`,
          padding:'10px 16px',
          display:'flex', flexDirection:'column', gap:6,
        }}>
          <div style={{ fontSize:10, color:C.pearlFaint, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:2 }}>
            TASKS {tasks.length}
          </div>
          {tasks.map((task, i) => (
            <div key={i} style={{
              background: taskBg[task.status] ?? 'transparent',
              borderRadius:6, padding:'6px 10px',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:11, color:C.pearlDim, flex:1, marginRight:8 }}>{task.label}</span>
                <span style={{ fontSize:11, color: statusColors[task.status], whiteSpace:'nowrap' }}>
                  {task.status} {Math.round(task.progress*100)}%
                </span>
              </div>
              <div style={{ height:3, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:99,
                  width:`${task.progress*100}%`,
                  background: task.status==='done' ? C.green : task.status==='failed' ? C.red : `linear-gradient(90deg,${C.violet},${C.brightTeal})`,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
