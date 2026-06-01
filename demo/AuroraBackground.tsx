import React, { useEffect, useRef } from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { C } from './constants'

const WAVES = [
  { r:107, g:31,  b:168, amp:48, freq:0.010, phase:0.0,  yR:0.38, lw:4.0, a:0.26 },
  { r:139, g:53,  b:204, amp:34, freq:0.016, phase:0.8,  yR:0.42, lw:2.2, a:0.20 },
  { r:160, g:80,  b:220, amp:26, freq:0.023, phase:2.4,  yR:0.44, lw:1.4, a:0.15 },
  { r:27,  g:159, b:212, amp:40, freq:0.013, phase:1.6,  yR:0.58, lw:3.2, a:0.22 },
  { r:27,  g:107, b:138, amp:28, freq:0.020, phase:2.1,  yR:0.54, lw:1.8, a:0.16 },
  { r:26,  g:74,  b:122, amp:20, freq:0.028, phase:3.2,  yR:0.50, lw:1.2, a:0.12 },
  { r:74,  g:107, b:200, amp:52, freq:0.007, phase:0.5,  yR:0.48, lw:5.5, a:0.09 },
  { r:200, g:216, b:232, amp:14, freq:0.035, phase:1.1,  yR:0.46, lw:0.7, a:0.07 },
]

const FILM_FRAMES = [
  { x:0.07,  y:0.20, w:94,  h:64,  a:0.30, tilt:-7  },
  { x:0.16,  y:0.72, w:78,  h:54,  a:0.20, tilt:5   },
  { x:0.74,  y:0.18, w:88,  h:60,  a:0.28, tilt:8   },
  { x:0.84,  y:0.72, w:72,  h:50,  a:0.18, tilt:-6  },
  { x:0.04,  y:0.50, w:62,  h:44,  a:0.14, tilt:4   },
  { x:0.92,  y:0.46, w:66,  h:46,  a:0.16, tilt:-4  },
]

export function AuroraBackground({ opacity = 1 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = width
    const H = height
    canvas.width  = W
    canvas.height = H

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)

    for (const wave of WAVES) {
      const { r, g, b } = wave
      for (let pass = 0; pass < 3; pass++) {
        const bAmp   = pass === 0 ? wave.amp * 2.4 : pass === 1 ? wave.amp * 1.5 : wave.amp
        const bAlpha = pass === 0 ? wave.a * 0.22  : pass === 1 ? wave.a * 0.52  : wave.a
        const bLw    = pass === 0 ? wave.lw * 8    : pass === 1 ? wave.lw * 3    : wave.lw
        const baseY  = H * wave.yR

        ctx.beginPath()
        for (let x = 0; x <= W; x += 2) {
          const y = baseY
            + Math.sin(x * wave.freq + wave.phase + frame * 0.007) * bAmp
            + Math.sin(x * wave.freq * 2.1 + wave.phase * 1.7 + frame * 0.005) * bAmp * 0.32
            + Math.sin(x * wave.freq * 0.5 + frame * 0.003) * bAmp * 0.18
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${bAlpha})`
        ctx.lineWidth = bLw
        ctx.stroke()
      }
    }

    for (const ff of FILM_FRAMES) {
      const px = ff.x * W
      const py = ff.y * H + Math.sin(frame * 0.005 + ff.x * 6) * 7
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate((ff.tilt * Math.PI) / 180)
      ctx.globalAlpha = ff.a

      const g = ctx.createLinearGradient(-ff.w/2, -ff.h/2, ff.w/2, ff.h/2)
      g.addColorStop(0, 'rgba(139,53,204,0.9)')
      g.addColorStop(1, 'rgba(27,107,138,0.7)')
      ctx.strokeStyle = g
      ctx.lineWidth = 0.9
      ctx.beginPath()
      ctx.roundRect(-ff.w/2, -ff.h/2, ff.w, ff.h, 3)
      ctx.stroke()
      ctx.fillStyle = 'rgba(139,53,204,0.05)'
      ctx.fill()

      const hs = 5
      const hc = Math.floor(ff.w / 15)
      for (const hy of [-ff.h/2 + hs, ff.h/2 - hs]) {
        for (let i = 0; i < hc; i++) {
          const hx = -ff.w/2 + (ff.w / hc) * (i + 0.5)
          ctx.fillStyle = 'rgba(139,53,204,0.6)'
          ctx.beginPath()
          ctx.roundRect(hx - hs/2, hy - hs*0.35, hs, hs*0.7, 1)
          ctx.fill()
        }
      }
      ctx.restore()
    }

    const rg = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, W*0.52)
    rg.addColorStop(0, 'rgba(107,31,168,0.10)')
    rg.addColorStop(0.5, 'rgba(27,107,138,0.05)')
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, W, H)

    const edges = [
      [0, 0, 0, H*0.22, '#000', 'rgba(0,0,0,0)'],
      [0, H*0.78, 0, H, 'rgba(0,0,0,0)', '#000'],
      [0, 0, W*0.08, 0, '#000', 'rgba(0,0,0,0)'],
      [W*0.92, 0, W, 0, 'rgba(0,0,0,0)', '#000'],
    ] as const

    for (const [x1, y1, x2, y2, c1, c2] of edges) {
      const eg = ctx.createLinearGradient(x1, y1, x2 || W, y2 || H)
      eg.addColorStop(0, c1)
      eg.addColorStop(1, c2)
      ctx.fillStyle = eg
      ctx.fillRect(0, 0, W, H)
    }

  }, [frame, width, height])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity,
      }}
    />
  )
}
