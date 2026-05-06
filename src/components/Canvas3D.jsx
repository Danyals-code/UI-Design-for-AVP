import { useEffect, useRef, Suspense, memo } from 'react'
import * as THREE from 'three'
import { Canvas, useThree, useLoader } from '@react-three/fiber'
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Environment } from '@react-three/drei'
import { useStore } from '../store'
import SceneTree from './SceneTree'

// Attaches a user-supplied image as the scene's background so it reads as
// a flat environment behind the design. Used when scene.colorScheme is
// 'image' and scene.backgroundImage is a data/blob URL.
function ImageBackground({ url }) {
  const texture = useLoader(THREE.TextureLoader, url)
  useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
    }
  }, [texture])
  return <primitive attach="background" object={texture} />
}

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
  const gridAxes = useStore((s) => s.gridAxes)
  const showAxes = useStore((s) => s.showAxes)
  const scene = useStore((s) => s.scene)
  const preview3D = scene.preview3D
  const isWindow = scene.sceneMode === 'window'

  // Mouse-button policy:
  //   2D (window head-on)   — LEFT pans (no rotation; design is flat).
  //   3D (preview / volume) — LEFT rotates freely, RIGHT pans, MIDDLE dollies.
  // Free LEFT-rotate matches Blender / Maya / Cinema4D conventions and lets
  // the user orbit without fighting the gizmo. The axis gizmo (top-right)
  // still snaps when you click X / Y / Z arrows — that's its purpose.
  const mouseButtons = !preview3D
    ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }

  const enableRotate = preview3D && !isDragging

  const imageBg = scene.colorScheme === 'image' && scene.backgroundImage
  // When an image background is active, keep the grid on the dark palette so
  // the grid lines don't disappear into most photographs.
  const effectiveScheme = imageBg ? 'dark' : scene.colorScheme
  const viewportBg = effectiveScheme === 'dark' ? '#1e1e20' : '#e4e4e7'
  const gridMain   = effectiveScheme === 'dark' ? '#2a2a2c' : '#c9c9cc'
  const gridSub    = effectiveScheme === 'dark' ? '#1a1a1c' : '#d8d8dc'

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
      // ACESFilmic tone mapping is what HDRIs are designed for \u2014 without
      // it, HDR colors clip to white and the environment looks flat / blown
      // out. SRGB output color space is the modern three.js default but
      // we set it explicitly so the result is the same regardless of the
      // installed three version. dpr cap stays at 1.75 to avoid GPU thrash
      // on retina displays.
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace
      }}
      dpr={[1, 1.75]}
      // Debounce the resize observer — when the user drags a side-panel
      // gutter, flex resizes our container every frame. Without this the
      // renderer buffer resizes + the scene reflows constantly, which looks
      // laggy. 200ms means the buffer only updates once the drag pauses.
      resize={{ debounce: 200 }}
    >
      {imageBg ? (
        <Suspense fallback={<color attach="background" args={[viewportBg]} />}>
          <ImageBackground url={scene.backgroundImage} />
        </Suspense>
      ) : (
        <color attach="background" args={[viewportBg]} />
      )}
      {/* Fog in the 3D preview sells depth; in head-on (window 2D) we leave
          it off so pulling the camera back doesn't dim the design. Colors
          then stay consistent irrespective of the zoom level. */}
      {!scene.hdri && !imageBg && preview3D && <fog attach="fog" args={[viewportBg, 12, 40]} />}

      {scene.hdri && (
        <Suspense fallback={null}>
          {/* `blur` (alias for backgroundBlurriness) defaulted to 0.15 which
              samples from low mipmaps and makes a 2K HDR look pixelated. 0
              keeps the source resolution. environmentIntensity stays at 1 so
              IBL on 3D primitives reads accurately. */}
          <Environment files={scene.hdri} background backgroundBlurriness={0} environmentIntensity={1} />
        </Suspense>
      )}

      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 8, 5]} intensity={0.4} />

      {/* Per-axis grid planes — Blender-style. Each axis toggles a grid that
          lies perpendicular to that axis:
            X → YZ plane (side wall, rotated 90° around Z)
            Y → XZ plane (floor, default drei Grid orientation)
            Z → XY plane (back wall, rotated 90° around X)
          In 2D (head-on) mode only the back wall makes sense — a floor grid
          would render edge-on as a thin line, and the side grid would point
          straight at the camera. We hide X/Y when not in 3D preview so the
          inactive states don't surprise the user. */}
      {!scene.hdri && gridAxes.x && preview3D && (
        <Grid
          args={[40, 40]}
          position={[0, 2.5, -4.5]}
          rotation={[0, 0, Math.PI / 2]}
          cellSize={0.25} cellThickness={0.5} cellColor={gridSub}
          sectionSize={1.0} sectionThickness={1.0} sectionColor={gridMain}
          fadeDistance={30} fadeStrength={1.2} infiniteGrid
        />
      )}
      {!scene.hdri && gridAxes.y && preview3D && (
        <Grid
          args={[40, 40]}
          position={[0, 0, -4.5]}
          cellSize={0.25} cellThickness={0.5} cellColor={gridSub}
          sectionSize={1.0} sectionThickness={1.0} sectionColor={gridMain}
          fadeDistance={30} fadeStrength={1.2} infiniteGrid
        />
      )}
      {!scene.hdri && gridAxes.z && (
        <Grid
          args={[40, 40]}
          position={[0, 2.5, -6]}
          rotation={[Math.PI / 2, 0, 0]}
          cellSize={0.25} cellThickness={0.5} cellColor={gridSub}
          sectionSize={1.0} sectionThickness={1.0} sectionColor={gridMain}
          fadeDistance={30} fadeStrength={1.2} infiniteGrid
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
        // Clamp scroll / pinch dolly to the zoom slider's range (50%–350%).
        // zoomDistance range in the slider is 2–14, matching these caps so
        // keep-scrolling past 50% or 350% no longer works.
        minDistance={2}
        maxDistance={14}
        mouseButtons={mouseButtons}
      />

      {/* Axis gizmo — overlay-controlled (Overlays \u2192 Axes). Only useful
          while rotating, so we still gate on preview3D — the gizmo would be
          visually inert in head-on 2D mode. Click X / Y / Z arrows to snap
          the camera to that axis (drei behavior); body-drag to rotate the
          gizmo itself by snap angles. Free orbit lives on left-drag in the
          viewport, not on the gizmo. */}
      {showAxes && preview3D && (
        <GizmoHelper alignment="top-right" margin={[80, 140]}>
          <GizmoViewport axisColors={gizmoAxisColors} labelColor={gizmoLabelColor} />
        </GizmoHelper>
      )}

    </Canvas>
  )
}

export default memo(Canvas3D)
