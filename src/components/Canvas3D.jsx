import { useEffect, useRef, Suspense, memo } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Environment } from '@react-three/drei'
import { useStore } from '../store'
import SceneTree from './SceneTree'

// Camera routing:
//   - preview3D=true  → angled orbit camera, regardless of sceneMode
//   - window mode     → flat head-on camera
//   - volume (non-3D) → placeholder is shown by the App, canvas isn't rendered
function ModeHandler() {
  const sceneMode = useStore((s) => s.scene.sceneMode)
  const preview3D = useStore((s) => s.scene.preview3D)
  const { camera, controls } = useThree()
  useEffect(() => {
    if (preview3D) {
      camera.position.set(6, 3.5, 4)
      if (controls?.target) controls.target.set(0, 2.5, -4.5)
    } else if (sceneMode === 'window') {
      camera.position.set(0, 2.5, 2.5)
      if (controls?.target) controls.target.set(0, 2.5, -4.5)
    } else {
      camera.position.set(6, 3.5, 4)
      if (controls?.target) controls.target.set(0, 2.5, -4.5)
    }
    controls?.update?.()
  }, [sceneMode, preview3D, camera, controls])
  return null
}

// Syncs the zoom slider (in the DOM overlay) with the OrbitControls camera
// distance. Uses the OrbitControls 'end' event + a ref-based guard to
// prevent feedback loops with damping-enabled controls.
function ZoomController() {
  const { controls, camera, invalidate } = useThree()
  const zoomDistance = useStore((s) => s.zoomDistance)
  const setZoomDistance = useStore((s) => s.setZoomDistance)
  const fromSlider = useRef(false)

  // Slider → Camera
  useEffect(() => {
    if (!controls) return
    const currentDist = camera.position.distanceTo(controls.target)
    if (Math.abs(currentDist - zoomDistance) < 0.2) return
    fromSlider.current = true
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize()
    camera.position.copy(controls.target).add(dir.multiplyScalar(zoomDistance))
    controls.update()
    invalidate()
    requestAnimationFrame(() => { fromSlider.current = false })
  }, [zoomDistance, controls, camera, invalidate])

  useEffect(() => {
    if (!controls) return
    const onEnd = () => {
      if (fromSlider.current) return
      const dist = camera.position.distanceTo(controls.target)
      const storeDist = useStore.getState().zoomDistance
      if (Math.abs(dist - storeDist) > 0.2) {
        setZoomDistance(parseFloat(dist.toFixed(1)))
      }
    }
    controls.addEventListener('end', onEnd)
    return () => controls.removeEventListener('end', onEnd)
  }, [controls, camera, setZoomDistance])

  return null
}

function Canvas3D() {
  const select = useStore((s) => s.select)
  const isDragging = useStore((s) => s.isDragging)
  const showGrid = useStore((s) => s.showGrid)
  const panMode = useStore((s) => s.panMode)
  const scene = useStore((s) => s.scene)
  const preview3D = scene.preview3D
  const isWindow = scene.sceneMode === 'window'

  // Rotate/orbit is only available while actually in 3D preview. Outside of
  // it (window head-on), LEFT=PAN everywhere so panel clicks never race with
  // an orbit gesture. panMode (hand icon) swaps LEFT→ROTATE for users who
  // want to orbit with one button.
  const mouseButtons = !preview3D
    ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    : panMode
      ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
      : { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }

  const enableRotate = preview3D && !isDragging

  const viewportBg = scene.colorScheme === 'dark' ? '#1e1e20' : '#e4e4e7'
  const gridMain = scene.colorScheme === 'dark' ? '#2a2a2c' : '#c9c9cc'
  const gridSub = scene.colorScheme === 'dark' ? '#1a1a1c' : '#d8d8dc'

  // When not in 3D preview, dim the gizmo so it reads as an inactive hint
  // rather than a loud overlay. Full tint kicks in only in 3D preview.
  const gizmoAxisColors = preview3D
    ? ['#e5484d', '#30a46c', '#3b9eff']
    : ['#6a6a6e', '#6a6a6e', '#6a6a6e']
  const gizmoLabelColor = preview3D ? 'white' : '#9a9a9a'

  return (
    <Canvas
      frameloop="always"
      camera={{ position: [0, 2.5, 2.5], fov: 45 }}
      onPointerMissed={() => select(null)}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      // Debounce the resize observer — when the user drags a side-panel
      // gutter, flex resizes our container every frame. Without this the
      // renderer buffer resizes + the scene reflows constantly, which looks
      // laggy. 200ms means the buffer only updates once the drag pauses.
      resize={{ debounce: 200 }}
    >
      <color attach="background" args={[viewportBg]} />
      {!scene.hdri && <fog attach="fog" args={[viewportBg, 12, 40]} />}

      {scene.hdri && (
        <Suspense fallback={null}>
          <Environment preset={scene.hdri} background blur={0.15} />
        </Suspense>
      )}

      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 8, 5]} intensity={0.4} />

      {showGrid && !scene.hdri && (
        <Grid
          args={[40, 40]}
          position={[0, 2.5, -6]}
          rotation={[Math.PI / 2, 0, 0]}
          cellSize={0.25}
          cellThickness={0.5}
          cellColor={gridSub}
          sectionSize={1.0}
          sectionThickness={1.0}
          sectionColor={gridMain}
          fadeDistance={30}
          fadeStrength={1.2}
          infiniteGrid
        />
      )}

      <SceneTree />

      <ModeHandler />
      <ZoomController />

      <OrbitControls
        makeDefault
        enabled={!isDragging}
        enableRotate={enableRotate}
        enableDamping
        dampingFactor={0.12}
        target={[0, 2.5, -4.5]}
        minDistance={1.0}
        maxDistance={20}
        mouseButtons={mouseButtons}
      />

      {/* Gizmo lives further down so it doesn't sit under the viewport
          toolbar; greyed out when we aren't actively in 3D preview. */}
      <GizmoHelper alignment="top-right" margin={[80, 140]}>
        <GizmoViewport axisColors={gizmoAxisColors} labelColor={gizmoLabelColor} />
      </GizmoHelper>
    </Canvas>
  )
}

export default memo(Canvas3D)
