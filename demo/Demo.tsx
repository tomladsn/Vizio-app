import React from 'react'
import { Composition, AbsoluteFill, Series, useCurrentFrame, interpolate } from 'remotion'
import { SCENE, TOTAL, FPS, W, H } from './constants'
import { SceneIntro } from './SceneIntro'
import {
  SceneProjectGate, SceneChat,
  SceneWorkflow, SceneExecuting, SceneSessionLog,
  SceneSettings, SceneOutro,
} from './Scenes'

function FadeOut({ children, dur, fadeFrames = 12 }:{children:React.ReactNode;dur:number;fadeFrames?:number}) {
  const f = useCurrentFrame()
  const opacity = interpolate(f,[dur-fadeFrames,dur],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})
  return <div style={{width:'100%',height:'100%',opacity}}>{children}</div>
}

export function VizioDemo() {
  return (
    <AbsoluteFill style={{ background:'#000' }}>
      <Series>
        <Series.Sequence durationInFrames={SCENE.INTRO}        name="Intro">
          <FadeOut dur={SCENE.INTRO}><SceneIntro /></FadeOut>
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE.PROJECT_GATE} name="Project Gate">
          <FadeOut dur={SCENE.PROJECT_GATE}><SceneProjectGate /></FadeOut>
        </Series.Sequence>
                <Series.Sequence durationInFrames={SCENE.CHAT}         name="Chat">
          <FadeOut dur={SCENE.CHAT}><SceneChat /></FadeOut>
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE.WORKFLOW}     name="Workflow">
          <FadeOut dur={SCENE.WORKFLOW}><SceneWorkflow /></FadeOut>
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE.EXECUTING}    name="Executing">
          <FadeOut dur={SCENE.EXECUTING}><SceneExecuting /></FadeOut>
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE.SESSION_LOG}  name="Session Log">
          <FadeOut dur={SCENE.SESSION_LOG}><SceneSessionLog /></FadeOut>
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE.SETTINGS}     name="Settings">
          <FadeOut dur={SCENE.SETTINGS}><SceneSettings /></FadeOut>
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE.OUTRO}        name="Outro">
          <SceneOutro />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  )
}

export function Root() {
  return (
    <Composition
      id="VizioDemo"
      component={VizioDemo}
      durationInFrames={TOTAL}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{}}
    />
  )
}