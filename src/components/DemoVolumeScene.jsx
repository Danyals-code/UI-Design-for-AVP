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
    // The GLB was authored with the painting wall on -X and the open
    // edge on +X. The volume camera sits on +Z (the conventional
    // three.js forward axis), so we rotate the room 90° around Y to
    // line the painting wall up along -Z behind the spawn area. The
    // open edge then faces +Z toward the wearer.
    //
    // No lights here: Canvas3D already supplies an ambient + key
    // directional. Stacking another ambient + hemisphere on top was
    // the source of the "too bright" feedback.
    <group position={[0, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={root} />
    </group>
  )
}
