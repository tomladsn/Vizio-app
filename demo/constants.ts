export const FPS          = 30
export const W            = 1920
export const H            = 1080
export const DURATION_SCALE = 1

// Scene durations in frames
export const SCENE = {
  INTRO:       Math.round(12 * FPS * DURATION_SCALE),   // 390  — aurora + logo + pain statement + tagline (voiceover synced)
  PROJECT_GATE: Math.round(3 * FPS * DURATION_SCALE),   // 150  — welcome back screen
  WORKSPACE:    Math.round(3  * FPS * DURATION_SCALE),   // 180  — three-panel layout reveal
  CHAT:         Math.round(3  * FPS * DURATION_SCALE),   // 180  — typing + thinking
  WORKFLOW:     Math.round(3  * FPS * DURATION_SCALE),   // 150  — approval card
  EXECUTING:    Math.round(3  * FPS * DURATION_SCALE),   // 210  — progress bars
  SESSION_LOG:  Math.round(3  * FPS * DURATION_SCALE),   // 120  — session log steps
  SETTINGS:     Math.round(4  * FPS * DURATION_SCALE),   // 120  — settings page
  OUTRO:        Math.round(5  * FPS * DURATION_SCALE),   // 150  — CTA
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