import React from 'react'
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'
import { C, FONT, easeOut } from './constants'

// ── FadeIn ────────────────────────────────────────────────────────────────────
export function FadeIn({
  children,
  from = 0,
  duration = 15,
  translateY = 0,
  style,
}: {
  children: React.ReactNode
  from?: number
  duration?: number
  translateY?: number
  style?: React.CSSProperties
}) {
  const frame = useCurrentFrame()
  const t = Math.clamp((frame - from) / duration, 0, 1)
  const eased = easeOut(t)
  return (
    <div style={{
      opacity: eased,
      transform: `translateY(${(1 - eased) * translateY}px)`,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── SlideIn ───────────────────────────────────────────────────────────────────
export function SlideIn({
  children,
  from = 0,
  duration = 20,
  direction = 'up',
  distance = 32,
  style,
}: {
  children: React.ReactNode
  from?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  distance?: number
  style?: React.CSSProperties
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const progress = spring({
    frame: frame - from,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    durationInFrames: duration,
  })

  const dx = direction === 'left' ? (1 - progress) * distance
           : direction === 'right' ? -(1 - progress) * distance : 0
  const dy = direction === 'up'   ? (1 - progress) * distance
           : direction === 'down' ? -(1 - progress) * distance : 0

  return (
    <div style={{
      opacity: Math.clamp(progress * 2, 0, 1),
      transform: `translate(${dx}px, ${dy}px)`,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Typewriter ────────────────────────────────────────────────────────────────
export function Typewriter({
  text,
  from = 0,
  charsPerFrame = 0.5,
  style,
}: {
  text: string
  from?: number
  charsPerFrame?: number
  style?: React.CSSProperties
}) {
  const frame = useCurrentFrame()
  const elapsed = Math.max(0, frame - from)
  const charsToShow = Math.floor(elapsed * charsPerFrame)
  const displayed = text.slice(0, Math.min(charsToShow, text.length))

  return (
    <span style={{ fontFamily: FONT.sans, ...style }}>
      {displayed}
    </span>
  )
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({
  progress,
  label,
  status = 'running',
}: {
  progress: number
  label: string
  status?: 'running' | 'done' | 'failed'
}) {
  const color = status === 'done' ? C.green
              : status === 'failed' ? C.red
              : C.richViolet

  const fillColor = status === 'done'
    ? C.green
    : `linear-gradient(90deg, ${C.richViolet}, ${C.brightTeal})`

  return (
    <div style={{
      background: C.surface,
      border: `0.5px solid rgba(255,255,255,0.08)`,
      borderRadius: 8,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{
        fontFamily: FONT.sans,
        fontSize: 12,
        color: C.pearlDim,
        minWidth: 80,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        height: 4,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 99,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.clamp(progress * 100, 0, 100)}%`,
          background: fillColor,
          borderRadius: 99,
          transition: 'width 0.1s',
        }} />
      </div>
      <span style={{
        fontFamily: FONT.sans,
        fontSize: 11,
        color,
        minWidth: 36,
        textAlign: 'right',
      }}>
        {status === 'done' ? '✓ done' : status === 'failed' ? '✗ fail' : `${Math.round(progress * 100)}%`}
      </span>
    </div>
  )
}

// ── ChatBubble ────────────────────────────────────────────────────────────────
export function ChatBubble({
  role,
  children,
  style,
}: {
  role: 'user' | 'ai'
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const isUser = role === 'user'
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '82%',
      background: isUser ? 'rgba(139,53,204,0.20)' : C.card,
      border: `0.5px solid ${isUser ? 'rgba(139,53,204,0.35)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 10,
      padding: '9px 14px',
      fontFamily: FONT.sans,
      fontSize: 12,
      color: C.pearl,
      lineHeight: 1.6,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── StepBadge ─────────────────────────────────────────────────────────────────
export function StepBadge({
  num,
  label,
  status,
}: {
  num: number
  label: string
  status: 'waiting' | 'running' | 'done' | 'failed'
}) {
  const dotColor = status === 'done'   ? C.green
                 : status === 'failed' ? C.red
                 : status === 'running' ? C.richViolet
                 : 'rgba(255,255,255,0.2)'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 12px',
      background: status === 'running' ? 'rgba(139,53,204,0.08)' : 'transparent',
      borderRadius: 6,
    }}>
      <div style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: dotColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        color: '#fff',
        fontFamily: FONT.sans,
        fontWeight: 500,
        flexShrink: 0,
      }}>
        {status === 'done' ? '✓' : status === 'failed' ? '✗' : num}
      </div>
      <span style={{
        fontFamily: FONT.sans,
        fontSize: 12,
        color: status === 'waiting' ? 'rgba(200,216,232,0.3)' : C.pearl,
      }}>
        {label}
      </span>
    </div>
  )
}

// ── GradientText ──────────────────────────────────────────────────────────────
export function GradientText({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <span style={{
      background: 'linear-gradient(90deg, #8B35CC, #4A6BC8, #1B9FD4)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      ...style,
    }}>
      {children}
    </span>
  )
}

// ── ApprovalCard ──────────────────────────────────────────────────────────────
export function ApprovalCard({
  steps,
  message,
  showButton = false,
}: {
  steps: string[]
  message: string
  showButton?: boolean
}) {
  return (
    <div style={{
      background: C.card,
      border: `0.5px solid rgba(139,53,204,0.35)`,
      borderRadius: 10,
      padding: '12px 14px',
      fontFamily: FONT.sans,
      maxWidth: '88%',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
        fontSize: 11,
        color: C.midViolet,
        fontWeight: 500,
      }}>
        ✦ Workflow ready · {steps.length} steps
      </div>

      <div style={{ fontSize: 12, color: C.pearlDim, marginBottom: 10 }}>
        {message}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            fontSize: 11,
            color: 'rgba(200,216,232,0.5)',
            paddingLeft: 10,
            borderLeft: `1.5px solid rgba(139,53,204,0.35)`,
            lineHeight: 1.5,
          }}>
            {step}
          </div>
        ))}
      </div>

      {showButton && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            background: 'linear-gradient(90deg, #8B35CC, #1B9FD4)',
            borderRadius: 5,
            padding: '5px 16px',
            fontSize: 11,
            color: '#fff',
            fontWeight: 500,
          }}>
            Allow
          </div>
          <div style={{
            background: 'transparent',
            border: `0.5px solid rgba(255,255,255,0.12)`,
            borderRadius: 5,
            padding: '5px 12px',
            fontSize: 11,
            color: 'rgba(200,216,232,0.4)',
          }}>
            Dismiss
          </div>
        </div>
      )}
    </div>
  )
}
