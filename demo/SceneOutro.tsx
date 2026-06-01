import React from 'react'
import { useCurrentFrame, useVideoConfig, interpolate, staticFile } from 'remotion'
import { AuroraBackground } from './AuroraBackground'
import { GradientText } from './Shared'
import { C, FONT } from './constants'

export function SceneOutro() {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()

  const logoOpacity  = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' })
  const textOpacity  = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: 'clamp' })
  const textY        = interpolate(frame, [20, 45], [16, 0], { extrapolateRight: 'clamp' })
  const btnOpacity   = interpolate(frame, [45, 65], [0, 1], { extrapolateRight: 'clamp' })
  const btnY         = interpolate(frame, [45, 65], [12, 0], { extrapolateRight: 'clamp' })
  const chipsOpacity = interpolate(frame, [65, 80], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div style={{ width, height, position: 'relative', background: '#000', overflow: 'hidden' }}>
      <AuroraBackground />

      {/* Logo */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: logoOpacity,
      }}>
        <img
          src={staticFile('icon.png')}
          width={90}
          height={90}
          alt="Vizio logo"
          style={{ objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Headline */}
      <div style={{
        position: 'absolute',
        top: '34%',
        left: 0, right: 0,
        textAlign: 'center',
        opacity: textOpacity,
        transform: `translateY(${textY}px)`,
      }}>
        <div style={{
          fontFamily: FONT.sans,
          fontSize: 46,
          fontWeight: 500,
          color: C.pearl,
          letterSpacing: '-0.5px',
          lineHeight: 1.1,
          marginBottom: 12,
        }}>
          Download <GradientText>Vizio</GradientText>
        </div>
        <div style={{
          fontFamily: FONT.sans,
          fontSize: 16,
          color: 'rgba(200,216,232,0.45)',
        }}>
          Free and open source · Windows 10/11
        </div>
      </div>

      {/* CTA Buttons */}
      <div style={{
        position: 'absolute',
        top: '60%',
        left: '50%',
        transform: `translateX(-50%) translateY(${btnY}px)`,
        opacity: btnOpacity,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #8B35CC, #1B9FD4)',
          borderRadius: 8,
          padding: '12px 28px',
          fontFamily: FONT.sans,
          fontSize: 15,
          fontWeight: 500,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          ↓ Download for Windows
        </div>
        <div style={{
          background: 'transparent',
          border: '0.5px solid rgba(255,255,255,0.18)',
          borderRadius: 8,
          padding: '12px 24px',
          fontFamily: FONT.sans,
          fontSize: 15,
          color: 'rgba(200,216,232,0.7)',
        }}>
          View on GitHub
        </div>
      </div>

      {/* Chips */}
      <div style={{
        position: 'absolute',
        top: '75%',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: chipsOpacity,
        display: 'flex',
        gap: 10,
      }}>
        {['v0.1.0', 'ffmpeg bundled', 'no account needed', 'MIT license'].map(chip => (
          <div key={chip} style={{
            background: 'rgba(139,53,204,0.12)',
            border: '0.5px solid rgba(139,53,204,0.25)',
            borderRadius: 4,
            padding: '3px 10px',
            fontFamily: FONT.sans,
            fontSize: 11,
            color: 'rgba(200,216,232,0.5)',
          }}>
            {chip}
          </div>
        ))}
      </div>
    </div>
  )
}
