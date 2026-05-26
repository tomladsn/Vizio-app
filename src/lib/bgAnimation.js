/**
 * Aurora wave background animation
 * Renders animated waves, particles, sparkles, and film frames on canvas
 */

export function initBgAnimation(canvasId, accentRgbString) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) {
    console.error(`Canvas with id "${canvasId}" not found`)
    return
  }

  const ctx = canvas.getContext('2d')
  let W, H, frame = 0
  let animationId = null

  // Parse accent RGB or use default
  let accentRgb = [93, 36, 65] // default Vizio accent
  if (accentRgbString) {
    const parts = accentRgbString.split(',').map(p => parseInt(p.trim(), 10))
    if (parts.length === 3 && parts.every(p => !isNaN(p))) {
      accentRgb = parts
    }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.parentElement.getBoundingClientRect()
    W = Math.max(rect.width, 1) || 1
    H = Math.max(rect.height, 1) || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)
  }

  // Ensure proper initialization
  const initResize = () => {
    resize()
    if (W > 0 && H > 0) {
      draw()
    } else {
      // If dimensions aren't ready yet, try again
      setTimeout(draw, 100)
    }
  }

  window.addEventListener('resize', resize)

  const COLORS = {
    deepPurple:  [107, 31, 168],
    richViolet:  [139, 53, 204],
    midViolet:   [160, 80, 220],
    steelBlue:   [26,  74, 122],
    tealBlue:    [27, 107, 138],
    brightTeal:  [27, 159, 212],
    waveBlue:    [74, 107, 200],
    pearlWhite:  [200, 216, 232],
    sparkle:     [255, 255, 255],
  }

  const waves = [
    { c: COLORS.deepPurple,  amp:48, freq:0.010, phase:0.0,  yR:0.38, lw:4.0, a:0.26 },
    { c: accentRgb,          amp:34, freq:0.016, phase:0.8,  yR:0.42, lw:2.2, a:0.20 },
    { c: COLORS.midViolet,   amp:26, freq:0.023, phase:2.4,  yR:0.44, lw:1.4, a:0.15 },
    { c: COLORS.brightTeal,  amp:40, freq:0.013, phase:1.6,  yR:0.58, lw:3.2, a:0.22 },
    { c: COLORS.tealBlue,    amp:28, freq:0.020, phase:2.1,  yR:0.54, lw:1.8, a:0.16 },
    { c: COLORS.steelBlue,   amp:20, freq:0.028, phase:3.2,  yR:0.50, lw:1.2, a:0.12 },
    { c: COLORS.waveBlue,    amp:52, freq:0.007, phase:0.5,  yR:0.48, lw:5.5, a:0.09 },
    { c: COLORS.pearlWhite,  amp:14, freq:0.035, phase:1.1,  yR:0.46, lw:0.7, a:0.07 },
    { c: COLORS.richViolet,  amp:22, freq:0.019, phase:3.8,  yR:0.56, lw:1.0, a:0.10 },
    { c: COLORS.brightTeal,  amp:18, freq:0.031, phase:0.2,  yR:0.52, lw:0.8, a:0.08 },
  ]

  const filmFrames = [
    { x:0.07,  y:0.20, w:94,  h:64,  a:0.30, tilt:-7,  colorA:COLORS.richViolet,  colorB:COLORS.deepPurple },
    { x:0.16,  y:0.72, w:78,  h:54,  a:0.20, tilt:5,   colorA:COLORS.deepPurple,  colorB:COLORS.richViolet },
    { x:0.74,  y:0.18, w:88,  h:60,  a:0.28, tilt:8,   colorA:COLORS.brightTeal,  colorB:COLORS.steelBlue  },
    { x:0.84,  y:0.72, w:72,  h:50,  a:0.18, tilt:-6,  colorA:COLORS.tealBlue,    colorB:COLORS.brightTeal },
    { x:0.04,  y:0.50, w:62,  h:44,  a:0.14, tilt:4,   colorA:COLORS.richViolet,  colorB:COLORS.waveBlue   },
    { x:0.92,  y:0.46, w:66,  h:46,  a:0.16, tilt:-4,  colorA:COLORS.brightTeal,  colorB:COLORS.waveBlue   },
  ]

  const codecTags = [
    { text:'H.264',        x:0.11, y:0.14, c:COLORS.pearlWhite },
    { text:'AAC 192k',     x:0.80, y:0.12, c:COLORS.brightTeal },
    { text:'CRF 23',       x:0.05, y:0.84, c:COLORS.richViolet },
    { text:'1080p',        x:0.82, y:0.85, c:COLORS.brightTeal },
    { text:'ffmpeg -y',    x:0.50, y:0.08, c:COLORS.pearlWhite },
    { text:'-c:v libx264', x:0.28, y:0.90, c:COLORS.waveBlue   },
    { text:'yuv420p',      x:0.64, y:0.88, c:COLORS.tealBlue   },
    { text:'yt-dlp',       x:0.88, y:0.30, c:COLORS.richViolet },
    { text:'-b:a 192k',    x:0.10, y:0.34, c:COLORS.tealBlue   },
  ]

  const sparkles = []
  for (let i = 0; i < 14; i++) {
    sparkles.push({
      x: Math.random(), y: Math.random(),
      size: 1.5 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03,
    })
  }

  const particles = []
  for (let i = 0; i < 32; i++) {
    const pick = [COLORS.richViolet, COLORS.brightTeal, COLORS.waveBlue, COLORS.pearlWhite][Math.floor(Math.random()*4)]
    particles.push({
      x: Math.random(), y: Math.random(),
      r: 0.8 + Math.random() * 2.2,
      vy: 0.00012 + Math.random() * 0.00025,
      a: 0.06 + Math.random() * 0.20,
      c: pick,
      phase: Math.random() * Math.PI * 2,
    })
  }

  function drawFilmFrame(ff, t) {
    const px = ff.x * W
    const py = ff.y * H + Math.sin(t * 0.005 + ff.x * 6) * 7
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate((ff.tilt * Math.PI) / 180)
    ctx.globalAlpha = ff.a

    const g = ctx.createLinearGradient(-ff.w/2, -ff.h/2, ff.w/2, ff.h/2)
    const [r1,g1,b1] = ff.colorA
    const [r2,g2,b2] = ff.colorB
    g.addColorStop(0, `rgba(${r1},${g1},${b1},0.9)`)
    g.addColorStop(1, `rgba(${r2},${g2},${b2},0.7)`)
    ctx.strokeStyle = g
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.roundRect(-ff.w/2, -ff.h/2, ff.w, ff.h, 3)
    ctx.stroke()

    ctx.fillStyle = `rgba(${r1},${g1},${b1},0.05)`
    ctx.fill()

    const hs = 5
    const hc = Math.floor(ff.w / 15)
    for (const hy of [-ff.h/2 + hs, ff.h/2 - hs]) {
      for (let i = 0; i < hc; i++) {
        const hx = -ff.w/2 + (ff.w / hc) * (i + 0.5)
        ctx.fillStyle = `rgba(${r1},${g1},${b1},0.6)`
        ctx.beginPath()
        ctx.roundRect(hx - hs/2, hy - hs*0.35, hs, hs*0.7, 1)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  function drawSparkle(x, y, size, alpha) {
    const [r,g,b] = COLORS.sparkle
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.lineWidth = 0.8
    const arms = [[0,-size],[0,size],[-size,0],[size,0],
                  [-size*0.5,-size*0.5],[size*0.5,size*0.5],
                  [-size*0.5,size*0.5],[size*0.5,-size*0.5]]
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(x + arms[i*2][0], y + arms[i*2][1])
      ctx.lineTo(x + arms[i*2+1][0], y + arms[i*2+1][1])
      ctx.stroke()
    }
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.beginPath()
    ctx.arc(x, y, size * 0.18, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  function drawCodecTag(tag, t, idx) {
    const drift = Math.sin(t * 0.004 + idx * 1.4) * 5
    const pulse = 0.05 + Math.abs(Math.sin(t * 0.0025 + idx * 0.9)) * 0.13
    const [r,g,b] = tag.c
    const x = tag.x * W
    const y = tag.y * H + drift
    ctx.save()
    ctx.globalAlpha = pulse
    ctx.font = '10px monospace'
    const tw = ctx.measureText(tag.text).width
    const pad = 7
    const rx = x - tw/2 - pad
    const ry = y - 10
    const rw = tw + pad*2
    const rh = 19
    const bg = ctx.createLinearGradient(rx, ry, rx+rw, ry+rh)
    bg.addColorStop(0, `rgba(${r},${g},${b},0.18)`)
    bg.addColorStop(1, `rgba(${r},${g},${b},0.08)`)
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect(rx, ry, rw, rh, 3)
    ctx.fill()
    ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`
    ctx.lineWidth = 0.5
    ctx.stroke()
    ctx.fillStyle = `rgba(${r},${g},${b},0.9)`
    ctx.textAlign = 'center'
    ctx.fillText(tag.text, x, y + 3.5)
    ctx.restore()
  }

  function draw() {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)

    for (const wave of waves) {
      const [r,g,b] = wave.c
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

    for (const p of particles) {
      p.y -= p.vy
      if (p.y < -0.02) p.y = 1.02
      const px = p.x * W + Math.sin(frame * 0.009 + p.phase) * 20
      const py = p.y * H
      const [r,g,b] = p.c
      const a = p.a * (0.5 + 0.5 * Math.sin(frame * 0.018 + p.phase))
      ctx.globalAlpha = a
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.beginPath()
      ctx.arc(px, py, p.r, 0, Math.PI*2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    for (const s of sparkles) {
      const sx = s.x * W
      const sy = s.y * H + Math.sin(frame * s.speed + s.phase) * 8
      const a = 0.15 + 0.6 * Math.abs(Math.sin(frame * s.speed * 0.7 + s.phase))
      drawSparkle(sx, sy, s.size, a)
    }

    for (const ff of filmFrames) drawFilmFrame(ff, frame)
    for (let i = 0; i < codecTags.length; i++) drawCodecTag(codecTags[i], frame, i)

    const rg = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, W*0.52)
    rg.addColorStop(0, 'rgba(107,31,168,0.10)')
    rg.addColorStop(0.45, 'rgba(27,107,138,0.05)')
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, W, H)

    const tG = ctx.createLinearGradient(0,0,0,H*0.20)
    tG.addColorStop(0,'#000000'); tG.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=tG; ctx.fillRect(0,0,W,H)

    const bG = ctx.createLinearGradient(0,H*0.80,0,H)
    bG.addColorStop(0,'rgba(0,0,0,0)'); bG.addColorStop(1,'#000000')
    ctx.fillStyle=bG; ctx.fillRect(0,0,W,H)

    const lG = ctx.createLinearGradient(0,0,W*0.08,0)
    lG.addColorStop(0,'#000000'); lG.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=lG; ctx.fillRect(0,0,W,H)

    const rG2 = ctx.createLinearGradient(W*0.92,0,W,0)
    rG2.addColorStop(0,'rgba(0,0,0,0)'); rG2.addColorStop(1,'#000000')
    ctx.fillStyle=rG2; ctx.fillRect(0,0,W,H)

    frame++
    animationId = requestAnimationFrame(draw)
  }

  // Initialize with proper dimensions
  initResize()

  // Return cleanup function
  return () => {
    if (animationId) cancelAnimationFrame(animationId)
    window.removeEventListener('resize', resize)
  }
}
