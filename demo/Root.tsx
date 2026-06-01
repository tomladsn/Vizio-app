import React from 'react'
import { Composition } from 'remotion'
import { VizioDemo } from './Demo'
import { FPS, W, H, TOTAL } from './constants'

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
