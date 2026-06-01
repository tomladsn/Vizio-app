import React, { useEffect, useRef } from 'react'
import { useCurrentFrame } from 'remotion'
import { W, H } from './constants'

const WAVES = [
  { r:107, g:31,  b:168, amp:50, freq:0.010, phase:0.0,  yR:0.38, lw:4.5, a:0.28 },
  { r:139, g:53,  b:204, amp:36, freq:0.016, phase:0.9,  yR:0.43, lw:2.5, a:0.22 },
  { r:160, g:80,  b:220, amp:28, freq:0.023, phase:2.5,  yR:0.45, lw:1.6, a:0.16 },
  { r:27,  g:159, b:212, amp:42, freq:0.013, phase:1.6,  yR:0.57, lw:3.5, a:0.24 },
  { r:27,  g:107, b:138, amp:30, freq:0.020, phase:2.2,  yR:0.53, lw:2.0, a:0.18 },
  { r:26,  g:74,  b:122, amp:22, freq:0.028, phase:3.3,  yR:0.50, lw:1.3, a:0.13 },
  { r:74,  g:107, b:200, amp:55, freq:0.007, phase:0.5,  yR:0.48, lw:6.0, a:0.10 },
  { r:200, g:216, b:232, amp:15, freq:0.036, phase:1.2,  yR:0.46, lw:0.8, a:0.08 },
  { r:180, g:80,  b:255, amp:18, freq:0.032, phase:3.9,  yR:0.56, lw:1.0, a:0.10 },
]

const FILMS = [
  { xR:0.07,  yR:0.22, w:88,  h:60,  a:0.28, tilt:-7,  c1:[139,53,204],  c2:[107,31,168] },
  { xR:0.16,  yR:0.72, w:74,  h:52,  a:0.18, tilt:5,   c1:[107,31,168],  c2:[139,53,204] },
  { xR:0.76,  yR:0.19, w:82,  h:58,  a:0.26, tilt:8,   c1:[27,159,212],  c2:[27,107,138] },
  { xR:0.85,  yR:0.73, w:68,  h:48,  a:0.17, tilt:-6,  c1:[27,107,138],  c2:[27,159,212] },
  { xR:0.04,  yR:0.50, w:58,  h:42,  a:0.13, tilt:4,   c1:[139,53,204],  c2:[74,107,200] },
  { xR:0.93,  yR:0.46, w:62,  h:44,  a:0.15, tilt:-4,  c1:[27,159,212],  c2:[74,107,200] },
]

interface Props { opacity?: number; frameOffset?: number }

export function Aurora({ opacity = 1, frameOffset = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frame = useCurrentFrame() + frameOffset

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width  = W
    canvas.height = H

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)

    // Waves with 3-pass glow
    for (const w of WAVES) {
      const { r, g, b } = w
      for (let pass = 0; pass < 3; pass++) {
        const amp   = pass === 0 ? w.amp*2.5 : pass === 1 ? w.amp*1.5 : w.amp
        const alpha = pass === 0 ? w.a*0.20  : pass === 1 ? w.a*0.50  : w.a
        const lw    = pass === 0 ? w.lw*9    : pass === 1 ? w.lw*3.2  : w.lw
        ctx.beginPath()
        for (let x = 0; x <= W; x += 2) {
          const y = H * w.yR
            + Math.sin(x*w.freq + w.phase + frame*0.007)*amp
            + Math.sin(x*w.freq*2.1 + w.phase*1.7 + frame*0.005)*amp*0.32
            + Math.sin(x*w.freq*0.5 + frame*0.003)*amp*0.18
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.lineWidth = lw
        ctx.stroke()
      }
    }

    // Film frames
    for (const f of FILMS) {
      const px = f.xR * W
      const py = f.yR * H + Math.sin(frame*0.005 + f.xR*6)*7
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(f.tilt * Math.PI/180)
      ctx.globalAlpha = f.a
      const g = ctx.createLinearGradient(-f.w/2,-f.h/2,f.w/2,f.h/2)
      const [r1,g1,b1] = f.c1
      const [r2,g2,b2] = f.c2
      g.addColorStop(0, `rgba(${r1},${g1},${b1},0.9)`)
      g.addColorStop(1, `rgba(${r2},${g2},${b2},0.7)`)
      ctx.strokeStyle = g
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(-f.w/2,-f.h/2,f.w,f.h,3); ctx.stroke()
      ctx.fillStyle = `rgba(${r1},${g1},${b1},0.05)`; ctx.fill()
      const hs = 4.5, hc = Math.floor(f.w/14)
      for (const hy of [-f.h/2+hs, f.h/2-hs]) {
        for (let i=0; i<hc; i++) {
          const hx = -f.w/2 + (f.w/hc)*(i+0.5)
          ctx.fillStyle = `rgba(${r1},${g1},${b1},0.6)`
          ctx.beginPath(); ctx.roundRect(hx-hs/2,hy-hs*0.35,hs,hs*0.7,1); ctx.fill()
        }
      }
      ctx.restore()
    }

    // Sparkles
    for (let i = 0; i < 12; i++) {
      const sx = ((i*137.5 + 50) % W)
      const sy = ((i*97.3  + 80) % H)
      const sa = 0.12 + 0.6 * Math.abs(Math.sin(frame*0.025 + i*0.8))
      const ss = 2 + (i%3)*1.5
      ctx.save(); ctx.globalAlpha = sa
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.7
      for (const [dx,dy] of [[-ss,0],[ss,0],[0,-ss],[0,ss]]) {
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+dx,sy+dy); ctx.stroke()
      }
      ctx.restore()
    }

    // Radial glow center
    const rg = ctx.createRadialGradient(W*0.5,H*0.5,0,W*0.5,H*0.5,W*0.5)
    rg.addColorStop(0,'rgba(107,31,168,0.12)'); rg.addColorStop(0.5,'rgba(27,107,138,0.05)'); rg.addColorStop(1,'transparent')
    ctx.fillStyle = rg; ctx.fillRect(0,0,W,H)

    // Edge vignette
    const edges:[number,number,number,number,string,string][] = [
      [0,0,0,H*0.22,'#000','rgba(0,0,0,0)'],[0,H*0.78,0,H,'rgba(0,0,0,0)','#000'],
      [0,0,W*0.08,0,'#000','rgba(0,0,0,0)'],[W*0.92,0,W,0,'rgba(0,0,0,0)','#000'],
    ]
    for (const [x1,y1,x2,y2,c1,c2] of edges) {
      const eg = ctx.createLinearGradient(x1,y1,x2||W,y2||H)
      eg.addColorStop(0,c1); eg.addColorStop(1,c2)
      ctx.fillStyle=eg; ctx.fillRect(0,0,W,H)
    }
  }, [frame])

  return <canvas ref={canvasRef} style={{ position:'absolute',inset:0,width:'100%',height:'100%',opacity }} />
}
