// Simulator-style demo scene for volume mode.
//
// Loads a pre-authored GLB ("studio" environment) the user's volumetric
// content sits inside. Mirrors what Apple's visionOS simulator shows when
// you boot it up — gives the designer a feel for how their content will
// read in space.
//
// All meshes are non-interactive (no pointer handlers); the demo is
// purely a visual aid. Toggled via `scene.showDemoScene` from the
// viewport overlay.

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

const DEMO_URL = '/models/demo-scene.glb'

useGLTF.preload(DEMO_URL)

export default function DemoVolumeScene() {
  const { scene } = useGLTF(DEMO_URL)

  // Clone so multiple mounts (or re-renders) don't share mutated state,
  // and walk the tree once to enable shadow casting/receiving on every
  // mesh — GLBs from Blender don't carry shadow flags through the
  // export. Also lifts "Beige_Carpet" 4 mm above the floor: in the
  // shipped GLB its top face is at y ≈ 0.02 but the carpet's underside
  // and the studio Plane share y = 0, which z-fights along the carpet
  // edge — visible as a flicker/seam at low ambient. The lift kicks
  // the underside above the floor plane so the depth buffer has a
  // clean order; 4 mm is below the resolution of any sensible viewport
  // zoom but enough to defeat the tie.
  const root = useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        if (o.name === 'Beige_Carpet') {
          o.position.y += 0.004
        }
      }
    })
    return cloned
  }, [scene])

  // Make the meshes non-interactive so pointer events fall through to
  // the user's actual entities (the demo is decoration, not content).
  useEffect(() => {
    root.traverse((o) => { o.raycast = () => {} })
  }, [root])

  return (
    // Identity placement — the GLB's local axes match world axes
    // already, so the stool sits at world origin, the painting hangs
    // on the world -X cyclorama wall, and the open +X edge faces the
    // wearer's default VR pose. No translation: the camera is what
    // moves, not the room.
    //
    // No lights here: Canvas3D already supplies an ambient + key
    // directional. Stacking another ambient + hemisphere on top was
    // the source of the "too bright" feedback.
    <group position={[0, 0, 0]}>
      <primitive object={root} />
    </group>
  )
}
