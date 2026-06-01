export const FPS          = 30
export const W            = 1280
export const H            = 720

// Scene durations in frames
export const SCENE = {
  INTRO:       13 * FPS,   // 390  — aurora + logo + pain statement + tagline (voiceover synced)
  PROJECT_GATE:5  * FPS,   // 150  — welcome back screen
  WORKSPACE:   6  * FPS,   // 180  — three-panel layout reveal
  CHAT:        6  * FPS,   // 180  — typing + thinking
  WORKFLOW:    5  * FPS,   // 150  — approval card
  EXECUTING:   7  * FPS,   // 210  — progress bars
  SESSION_LOG: 4  * FPS,   // 120  — session log steps
  SETTINGS:    4  * FPS,   // 120  — settings page
  OUTRO:       5  * FPS,   // 150  — CTA
}
export const TOTAL = Object.values(SCENE).reduce((a, b) => a + b, 0)

// Brand colors from the logo
export const C = {
  black:       '#000000',
  bg:          '#05070D',
  surface:     '#0A0F1C',
  card:        '#0D1525',
  border:      'rgba(255,255,255,0.07)',
  // Purple family
  deepPurple:  '#6B1FA8',
  violet:      '#8B35CC',
  midViolet:   '#A050DC',
  // Blue-teal family
  steelBlue:   '#1A4A7A',
  teal:        '#1B6B8A',
  brightTeal:  '#1B9FD4',
  waveBlue:    '#4A6BC8',
  // Pearl
  pearl:       '#C8D8E8',
  pearlDim:    'rgba(200,216,232,0.5)',
  pearlFaint:  'rgba(200,216,232,0.25)',
  // Status
  green:       '#1D9E75',
  amber:       '#F59E0B',
  red:         '#E24B4A',
  purple:      '#9B6DFF',
  // Navbar
  navBg:       '#080C18',
  // Accent
  accent:      '#8B35CC',
}

export const FONT = {
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  mono: "'JetBrains Mono','Fira Code','Consolas',monospace",
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi)
}
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t, 0, 1)
}
export function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3)
}
export function easeInOut(t: number) {
  const c = clamp(t, 0, 1)
  return c < 0.5 ? 4*c*c*c : 1 - Math.pow(-2*c+2,3)/2
}
export function progress(frame: number, start: number, duration: number) {
  return clamp((frame - start) / duration, 0, 1)
}