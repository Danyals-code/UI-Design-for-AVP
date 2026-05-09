import { useEffect, useRef, Suspense, memo } from 'react'
import * as THREE from 'three'
import { Canvas, useThree, useLoader } from '@react-three/fiber'
import {
  OrbitControls, Grid, GizmoHelper, GizmoViewport, Environment,
  ContactShadows, Lightformer
} from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useStore } from '../store'
import SceneTree from './SceneTree'
import DemoVolumeScene from './DemoVolumeScene'
import ModalTransform from './ModalTransform'
import FirstPersonControls from './FirstPersonControls'

// Camera targets in metres (1 unit = 1m). Window mode keeps a 1m-out
// chest-height target. Volume mode places the wearer at the studio's
// open +X edge, eye-line height, looking horizontally back toward the
// painting on the -X cyclorama wall. Target sits at chest height at
// world centre so the orbit pivot tracks the stool / spawn area, and
// new entities (which land at the same chest-height centre) appear
// dead-centre of the wearer's view. View vector is (-3, -0.35, 0) —
// almost pure -X with a 7° down-tilt, no head-tilt-down feel.
const TARGET_WINDOW = [0, 1.4, -1.0]
const VOLUME_VR_POS    = [3, 1.55, 0]
const VOLUME_VR_TARGET = [0, 1.2, 0]

// Cursor-driven Blender-modal transforms live in ModalTransform.jsx — no
// drei TransformControls handle. Click a tool (or press G/R/S), move
// the cursor, click to confirm or Esc to cancel.

// CameraViewBinder — listens for two events:
//   `snap-camera-to-entity`  — point the orbit camera at a named
//                              camera entity (custom user camera).
//   `snap-camera-to-default` — snap to the wearer's default VR pose
//                              (head height, looking forward) regardless
//                              of what's in the scene.
function CameraViewBinder() {
  const { camera, controls } = useThree()
  useEffect(() => {
    const onSnapToEntity = (e) => {
      const id = e.detail?.entityId
      const cur = useStore.getState().items
      const ent = cur.find((it) => it.id === id)
      if (!ent || ent.entityKind !== 'camera') return

      // Walk up to compute world position (camera entity may be
      // parented under an anchor or another entity).
      const pos = new THREE.Vector3()
      let p = ent
      while (p) {
        if (Array.isArray(p.position)) {
          pos.x += p.position[0] || 0
          pos.y += p.position[1] || 0
          pos.z += p.position[2] || 0
        }
        p = cur.find((it) => it.id === p.parentId) || null
      }

      // CameraGizmo is modelled as looking down -Z in its local frame;
      // applying the entity's rotation to the (0, 0, -1) vector gives
      // the world look-direction.
      const eul = new THREE.Euler(
        (ent.rotation?.[0] || 0) * Math.PI / 180,
        (ent.rotation?.[1] || 0) * Math.PI / 180,
        (ent.rotation?.[2] || 0) * Math.PI / 180,
        'YXZ'
      )
      const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(eul)
      const target = pos.clone().add(lookDir)

      camera.position.copy(pos)
      if (controls?.target) controls.target.copy(target)
      controls?.update?.()
    }

    // Default VR view — wearer at the open +X edge of the studio,
    // standing eye-line height, looking horizontally back at the
    // painting wall via the orbit pivot at chest height. Same pose
    // ModeHandler uses when entering volume mode, so the "VR View"
    // pill (editing) and the "Reset Camera" pill (preview) both
    // round-trip to the same pose. Calling `camera.lookAt` covers the
    // preview case where OrbitControls is disabled — without it, only
    // position would update and the FPS rig's pre-existing yaw/pitch
    // would survive the snap.
    const onSnapToDefault = () => {
      camera.position.set(...VOLUME_VR_POS)
      camera.lookAt(...VOLUME_VR_TARGET)
      if (controls?.target) controls.target.set(...VOLUME_VR_TARGET)
      controls?.update?.()
    }

    window.addEventListener('snap-camera-to-entity', onSnapToEntity)
    window.addEventListener('snap-camera-to-default', onSnapToDefault)
    return () => {
      window.removeEventListener('snap-camera-to-entity', onSnapToEntity)
      window.removeEventListener('snap-camera-to-default', onSnapToDefault)
    }
  }, [camera, controls])
  return null
}

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

// Camera routing (metres-scale):
//   - volume mode     → orbit around the demo floor / volumetric content
//   - window preview3D=true → angled orbit around the window plate
//   - window mode (2D) → flat head-on at the window
function ModeHandler() {
  const sceneMode = useStore((s) => s.scene.sceneMode)
  const preview3D = useStore((s) => s.scene.preview3D)
  const { camera, controls } = useThree()
  useEffect(() => {
    // Apply pose, then re-apply on the next frame. The first apply
    // catches the case where OrbitControls (and `controls`) is already
    // mounted; the rAF re-apply catches first-mount, where this effect
    // runs while controls is still null and the camera/target reset
    // would silently no-op on `controls.target`. Without it, picking a
    // template and entering volume mode lands the wearer on the
    // canvas's default orbit pose, not the VR view.
    const apply = () => {
      if (sceneMode === 'volume') {
        camera.position.set(...VOLUME_VR_POS)
        if (controls?.target) controls.target.set(...VOLUME_VR_TARGET)
      } else if (preview3D) {
        camera.position.set(1.4, 1.7, 0.6)
        if (controls?.target) controls.target.set(...TARGET_WINDOW)
      } else {
        camera.position.set(0, 1.4, 0.8)
        if (controls?.target) controls.target.set(...TARGET_WINDOW)
      }
      controls?.update?.()
    }
    apply()
    const raf = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(raf)
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

  // Slider → Camera. 0.05m epsilon avoids fighting the round-trip with
  // OrbitControls' damping at the new metres scale.
  useEffect(() => {
    if (!controls) return
    const currentDist = camera.position.distanceTo(controls.target)
    if (Math.abs(currentDist - zoomDistance) < 0.05) return
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
      if (Math.abs(dist - storeDist) > 0.05) {
        setZoomDistance(parseFloat(dist.toFixed(2)))
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
  const isVolume = scene.sceneMode === 'volume'
  // Volume mode is always 3D — no flat head-on view there. Window mode
  // honours the user's 2D / 3D toggle.
  const isOrbit = isVolume || preview3D

  // Mouse-button policy:
  //   2D (window head-on)   — LEFT pans (no rotation; design is flat).
  //   3D (preview / volume) — LEFT rotates freely, RIGHT pans, MIDDLE dollies.
  // Free LEFT-rotate matches Blender / Maya / Cinema4D conventions and lets
  // the user orbit without fighting the gizmo. The axis gizmo (top-right)
  // still snaps when you click X / Y / Z arrows — that's its purpose.
  const mouseButtons = !isOrbit
    ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }

  const enableRotate = isOrbit && !isDragging

  const imageBg = scene.colorScheme === 'image' && scene.backgroundImage
  // When an image background is active, keep the grid on the dark palette so
  // the grid lines don't disappear into most photographs.
  const effectiveScheme = imageBg ? 'dark' : scene.colorScheme
  // Brighter neutral than the previous near-black so volume mode reads
  // as a "studio" rather than "the void". Light scheme stays a soft grey
  // so dark UI text still has contrast.
  const viewportBg = effectiveScheme === 'dark' ? '#3a3d42' : '#e8e9ec'
  const gridMain   = effectiveScheme === 'dark' ? '#52555a' : '#c9c9cc'
  const gridSub    = effectiveScheme === 'dark' ? '#46484c' : '#d8d8dc'

  // When not in an orbit camera, dim the gizmo so it reads as an inactive
  // hint rather than a loud overlay. Full tint kicks in for any 3D camera
  // (window preview3D OR volume mode).
  const gizmoAxisColors = isOrbit
    ? ['#e5484d', '#30a46c', '#3b9eff']
    : ['#6a6a6e', '#6a6a6e', '#6a6a6e']
  const gizmoLabelColor = isOrbit ? 'white' : '#9a9a9a'

  return (
    <Canvas
      frameloop="always"
      // Soft shadows for entities + studio props; window plates use
      // unlit MeshBasic materials so they neither cast nor receive
      // shadows even with this enabled.
      shadows="soft"
      camera={{ position: [0, 1.4, 0.8], fov: 45 }}
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

      {scene.hdri ? (
        <Suspense fallback={null}>
          {/* `blur` (alias for backgroundBlurriness) defaulted to 0.15 which
              samples from low mipmaps and makes a 2K HDR look pixelated. 0
              keeps the source resolution. drei's bundled presets bias
              bright at unit intensity — 0.18 here keeps reflections
              legible on metals without blowing out matte surfaces. */}
          <Environment files={scene.hdri} background backgroundBlurriness={0} environmentIntensity={0.18} />
        </Suspense>
      ) : scene.environmentPreset && scene.environmentPreset !== 'none' ? (
        // drei built-in studio presets — gives every PBR material a
        // believable IBL bounce without the user having to load an
        // .hdr asset. `background={false}` keeps the user's picked
        // viewport color/scheme; the environment is invisible but
        // still lights / reflects in the materials.
        <Suspense fallback={null}>
          <Environment preset={scene.environmentPreset} background={false} environmentIntensity={0.18} />
        </Suspense>
      ) : null}

      <ambientLight intensity={scene.ambientLightIntensity ?? 0.7} />
      {/* Key light pulled almost straight overhead so its falloff is
          mostly on the floor (where designers want a real cast shadow
          under the model) and not on the cyclorama walls (which
          previously read as a "shadow band across the screen"). The
          1.5-unit forward bias keeps a hint of front-light so the
          painting on the back wall doesn't go completely flat. Shadow
          camera frustum is sized to the studio bbox + a 1 m margin so
          edge geometry isn't clipped out of the shadow map. */}
      <directionalLight
        position={[0, 6, 1.5]}
        intensity={scene.keyLightIntensity ?? 0.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0005}
      />

      {/* SoftShadows from drei patches the renderer's shadow shaders
          globally — but its HMR fingerprint occasionally triggers a
          hot-reload hook collision. Default-enabled shadows from the
          Canvas's `shadows="soft"` prop already run PCF soft shadow
          mapping, which is enough for a clean look without the patch. */}

      {/* Studio rim-lights — bright planar emitters that catch on
          metallic / clearcoat materials and make hero objects pop.
          Only in volume mode. Rendered invisible (`visible={false}`):
          without an enclosing <Environment>, Lightformers contribute
          nothing to PBR / IBL lighting, but their MeshBasicMaterial
          planes still draw — and from the wearer's default VR view
          they read as flat grey/blue rectangles in front of the
          painting. Keeping them in the tree (instead of removing the
          JSX) preserves the `rimLights` toggle for the future case of
          an Environment-wrapped lighting rig. */}
      {isVolume && scene.rimLights && (
        <group>
          <Lightformer
            visible={false}
            position={[2.5, 2.0, 1.5]}
            scale={[2, 1.5, 1]}
            intensity={1.2}
            color="#ffffff"
            target={[0, 0.7, -0.5]}
          />
          <Lightformer
            visible={false}
            position={[-2.5, 1.5, 1.0]}
            scale={[2, 1, 1]}
            intensity={0.6}
            color="#cfdcff"
            target={[0, 0.5, -0.5]}
          />
        </group>
      )}

      {/* Window-mode contact shadow — soft circular shadow under each
          floating window plate so it reads as "in space" rather than
          "drawn on the canvas". Uses ContactShadows centered at the
          floor (y=0); the window itself sits at y=1.4 so the shadow is
          ~1.4m below — visible in 3D preview only. */}
      {!isVolume && preview3D && scene.contactShadows && (
        <ContactShadows
          position={[0, 0, -1.0]}
          opacity={0.5}
          scale={3}
          blur={2.4}
          far={2.5}
        />
      )}

      {/* Per-axis grid planes — Blender-style. Each axis toggles a grid
          that lies perpendicular to that axis. Sized in metres now:
          5cm sub-cells, 50cm major sections — fine enough to read off
          0.1m sphere placement without filling the canvas with lines. */}
      {!scene.hdri && gridAxes.x && isOrbit && (
        <Grid
          args={[10, 10]}
          position={[0, 1.4, -1.0]}
          rotation={[0, 0, Math.PI / 2]}
          cellSize={0.05} cellThickness={0.5} cellColor={gridSub}
          sectionSize={0.5} sectionThickness={1.0} sectionColor={gridMain}
          fadeDistance={8} fadeStrength={1.4} infiniteGrid
        />
      )}
      {!scene.hdri && gridAxes.y && isOrbit && !(isVolume && scene.showDemoScene) && (
        <Grid
          args={[10, 10]}
          position={[0, 0, isVolume ? 0 : -1.0]}
          cellSize={0.05} cellThickness={0.5} cellColor={gridSub}
          sectionSize={0.5} sectionThickness={1.0} sectionColor={gridMain}
          fadeDistance={8} fadeStrength={1.4} infiniteGrid
        />
      )}
      {!scene.hdri && gridAxes.z && (
        <Grid
          args={[10, 10]}
          position={[0, 1.4, isVolume ? -1.5 : -1.05]}
          rotation={[Math.PI / 2, 0, 0]}
          cellSize={0.05} cellThickness={0.5} cellColor={gridSub}
          sectionSize={0.5} sectionThickness={1.0} sectionColor={gridMain}
          fadeDistance={8} fadeStrength={1.4} infiniteGrid
        />
      )}

      <SceneTree />

      {/* Simulator-style demo scene — only renders in volume mode and
          only when the user has it enabled in the overlays popover.
          Sits at the world origin / floor below the volumetric content. */}
      {isVolume && scene.showDemoScene && <DemoVolumeScene />}

      {/* Modal transform handler. When the user picks Move / Rotate /
          Scale (toolbar or G/R/S), the cursor drives the entity's
          transform live until they click to confirm or Esc to cancel. */}
      {isOrbit && <ModalTransform />}

      {/* Listens for the viewport "Camera View" snap request. */}
      <CameraViewBinder />

      <ModeHandler />
      <ZoomController />

      <OrbitControls
        makeDefault
        enabled={!isDragging && !scene.previewMode}
        enableRotate={enableRotate && !scene.previewMode}
        enableDamping
        dampingFactor={0.12}
        target={isVolume ? VOLUME_VR_TARGET : TARGET_WINDOW}
        // Both modes are metres-scale now. Window plates are ~1.2m wide
        // — so 0.3m is "right up against the surface" and 4m gives a
        // wide-shot. Volume rooms are 6m, dolly out to ~5m suffices to
        // see the whole stage. Floor as the lower bound (camera doesn't
        // dip beneath it).
        minDistance={isVolume ? 0.8 : 0.3}
        maxDistance={isVolume ? 5 : 4}
        mouseButtons={mouseButtons}
      />

      {/* Preview mode runs a different camera rig: a first-person
          look-around with mouse-look + pan + walk. OrbitControls is
          disabled (above) so its `target`-anchored rotation doesn't
          fight ours. Volume-only — window mode is a flat plate, no
          benefit from a head-rotation rig. */}
      {scene.previewMode && isVolume && (
        <FirstPersonControls enabled={true} />
      )}

      {/* Axis gizmo — overlay-controlled (Overlays \u2192 Axes). Only useful
          while rotating, so we still gate on preview3D — the gizmo would be
          visually inert in head-on 2D mode. Click X / Y / Z arrows to snap
          the camera to that axis (drei behavior); body-drag to rotate the
          gizmo itself by snap angles. Free orbit lives on left-drag in the
          viewport, not on the gizmo. */}
      {/* Post-processing — bloom for emissive pop. SSAO ships with
          the package but is gated to a per-scene flag (off by default
          since it doubles the GPU cost). Bloom-only is a meaningful
          upgrade on its own. */}
      {scene.bloom && (
        <EffectComposer disableNormalPass>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.85}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
        </EffectComposer>
      )}

      {/* Hide the orientation gizmo in preview — it's an editor
          affordance and would break the "this is what the wearer
          sees" illusion. */}
      {showAxes && isOrbit && !scene.previewMode && (
        <GizmoHelper alignment="top-right" margin={[80, 140]}>
          <GizmoViewport axisColors={gizmoAxisColors} labelColor={gizmoLabelColor} />
        </GizmoHelper>
      )}

    </Canvas>
  )
}

export default memo(Canvas3D)
