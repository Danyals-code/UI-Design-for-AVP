// Simulator-style demo scene for volume mode.
//
// Renders a "room" the user's volumetric content sits inside: a square
// floor, four short low-poly walls so the eye has corners to read scale
// off, and a few decorative props at realistic real-world dimensions.
// Mirrors what Apple's visionOS simulator shows when you boot it up —
// gives the designer a feel for how their content will read in space.
//
// All meshes are non-interactive (no pointer handlers); the demo is
// purely a visual aid. Toggled via `scene.showDemoScene` from the
// viewport overlay.

import { useMemo } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { getInterFont } from '../fonts'

// ---- materials -------------------------------------------------------

const FLOOR_COLOR = '#3a3a3e'
const WALL_COLOR  = '#2a2a2e'

// Lift the floor a hair above y=0 so it doesn't z-fight the
// `gridAxes.y` "floor grid" the user can also turn on. 4mm is below the
// resolution of any sensible camera but enough to defeat the depth-buffer
// tie at our typical zoom level.
const FLOOR_LIFT = 0.004

// ---- floor + ring guides ---------------------------------------------
//
// A flat square floor with three faint concentric rings drawn into a
// canvas texture so distances are easy to read off. Memoised so we only
// build the texture once per session.

function useFloorTexture() {
  return useMemo(() => {
    const SIZE = 1024
    const c = document.createElement('canvas')
    c.width = SIZE; c.height = SIZE
    const ctx = c.getContext('2d')
    ctx.fillStyle = FLOOR_COLOR
    ctx.fillRect(0, 0, SIZE, SIZE)
    // Soft radial vignette so the corners read darker — gives the floor
    // a sense of "room" without modelling actual walls fading into it.
    const vg = ctx.createRadialGradient(SIZE/2, SIZE/2, SIZE * 0.2, SIZE/2, SIZE/2, SIZE * 0.7)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.45)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, SIZE, SIZE)
    // Concentric rings every 1m (assuming the floor is 6m × 6m → ring at
    // 1/6, 2/6, 3/6 of the texture). The label below shows scale.
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1.5
    for (const r of [1/6, 2/6, 3/6]) {
      ctx.beginPath()
      ctx.arc(SIZE/2, SIZE/2, SIZE * r, 0, Math.PI * 2)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [])
}

// ---- compound studio props -------------------------------------------
//
// Each prop is a small group of primitives arranged to read as real
// furniture / studio dressing — a coffee table has legs, a lamp has a
// stand and shade, a plant has a pot and foliage. The point isn't
// photorealism (we have no asset pipeline); it's giving the designer
// enough visual context that a 0.1m sphere reads as "small object on
// the table" rather than "abstract dot in a void".

function CoffeeTable({ position, rotation = 0 }) {
  const TOP_W = 0.9, TOP_D = 0.5, TOP_H = 0.04
  const LEG_R = 0.025, LEG_H = 0.42
  const TOP_Y = LEG_H + TOP_H / 2
  const wood = '#5a4632'
  const matWood = { color: wood, roughness: 0.7, metalness: 0.05 }
  const xs = TOP_W / 2 - LEG_R - 0.02
  const zs = TOP_D / 2 - LEG_R - 0.02
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Top */}
      <mesh position={[0, TOP_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[TOP_W, TOP_H, TOP_D]} />
        <meshStandardMaterial {...matWood} />
      </mesh>
      {/* Four legs */}
      {[[xs, zs], [-xs, zs], [xs, -zs], [-xs, -zs]].map(([x, z], i) => (
        <mesh key={i} position={[x, LEG_H / 2, z]} castShadow receiveShadow>
          <cylinderGeometry args={[LEG_R, LEG_R * 0.8, LEG_H, 12]} />
          <meshStandardMaterial color="#2a2a2c" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function FloorLamp({ position }) {
  const POLE_H = 1.5
  const SHADE_H = 0.22
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.04, 24]} />
        <meshStandardMaterial color="#2a2a2c" roughness={0.45} metalness={0.6} />
      </mesh>
      {/* Pole */}
      <mesh position={[0, POLE_H / 2 + 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, POLE_H, 12]} />
        <meshStandardMaterial color="#3a3a3c" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Shade — tapered cylinder, slightly emissive so the lamp reads
          as "on" without needing an actual point light. */}
      <mesh position={[0, POLE_H + 0.04 + SHADE_H / 2, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, SHADE_H, 24, 1, true]} />
        <meshStandardMaterial
          color="#f3e3c7"
          emissive="#f3d8a8"
          emissiveIntensity={0.25}
          roughness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function PottedPlant({ position }) {
  const POT_H = 0.22, POT_TOP = 0.18, POT_BOT = 0.14
  const FOLIAGE_Y = POT_H + 0.05
  return (
    <group position={position}>
      {/* Pot — cone open-ended for that planter taper */}
      <mesh position={[0, POT_H / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[POT_TOP, POT_BOT, POT_H, 24]} />
        <meshStandardMaterial color="#7a4f33" roughness={0.85} />
      </mesh>
      {/* Foliage — three layered scaled spheres for a fuller silhouette
          than a single sphere can provide. */}
      <mesh position={[0, FOLIAGE_Y + 0.18, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#3d6b3a" roughness={0.85} />
      </mesh>
      <mesh position={[0.13, FOLIAGE_Y + 0.10, 0.05]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#4a7a45" roughness={0.85} />
      </mesh>
      <mesh position={[-0.10, FOLIAGE_Y + 0.04, -0.08]} castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#365e35" roughness={0.85} />
      </mesh>
    </group>
  )
}

function Sofa({ position, rotation = 0 }) {
  const SEAT_W = 1.6, SEAT_D = 0.7, SEAT_H = 0.42
  const BACK_H = 0.55
  const ARM_W = 0.12
  const fabric = '#6c7480'
  const matFabric = { color: fabric, roughness: 0.85 }
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Base */}
      <mesh position={[0, SEAT_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[SEAT_W, SEAT_H, SEAT_D]} />
        <meshStandardMaterial {...matFabric} />
      </mesh>
      {/* Back */}
      <mesh position={[0, SEAT_H + BACK_H / 2, -SEAT_D / 2 + 0.08]} castShadow receiveShadow>
        <boxGeometry args={[SEAT_W, BACK_H, 0.14]} />
        <meshStandardMaterial {...matFabric} />
      </mesh>
      {/* Arms */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[(SEAT_W / 2 - ARM_W / 2) * s, SEAT_H / 2 + 0.08, 0]}
          castShadow receiveShadow
        >
          <boxGeometry args={[ARM_W, SEAT_H + 0.16, SEAT_D]} />
          <meshStandardMaterial {...matFabric} />
        </mesh>
      ))}
      {/* Seat cushions — slightly lighter fabric for visual break */}
      {[-0.45, 0, 0.45].map((dx) => (
        <mesh
          key={dx}
          position={[dx, SEAT_H + 0.04, 0.04]}
          castShadow receiveShadow
        >
          <boxGeometry args={[0.42, 0.10, SEAT_D - 0.16]} />
          <meshStandardMaterial color="#7d8493" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function PictureFrame({ position, size = [0.6, 0.42], color = '#8da6c7' }) {
  const [w, h] = size
  const FRAME_T = 0.03
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w + FRAME_T, h + FRAME_T, FRAME_T]} />
        <meshStandardMaterial color="#2a2a2c" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, FRAME_T / 2 + 0.001]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  )
}

// Default arrangement — a small living-room corner that reads as a
// real space without filling the whole 6m floor. Subject area
// (around y=0..0.5, x ≈ 0, z ≈ -0.5) is left empty so user content
// sits on a clear stage.
function StudioProps() {
  return (
    <group>
      <Sofa        position={[0, 0, -1.7]} />
      <CoffeeTable position={[0, 0, -1.05]} />
      <FloorLamp   position={[1.5, 0, -1.6]} />
      <PottedPlant position={[-1.7, 0, -1.4]} />
      <PictureFrame
        position={[-1.3, 1.6, BACKDROP_Z + 0.02]}
        size={[0.7, 0.5]}
        color="#cfa066"
      />
      <PictureFrame
        position={[1.3, 1.6, BACKDROP_Z + 0.02]}
        size={[0.5, 0.7]}
        color="#88a89e"
      />
    </group>
  )
}

// ---- studio backdrop -------------------------------------------------
//
// Photo-studio cyclorama: a single tall wall behind the subject (camera
// is at +z, looking toward -z), nothing on the other three sides. The
// wall blends seamlessly into the floor with a fillet curve so the eye
// reads "infinite backdrop" rather than "wall meets floor". Approximated
// with a flat wall plus a curved fillet strip along the wall/floor seam.

const ROOM_HALF = 3                    // 6m × 6m floor
const BACKDROP_H = 2.6                 // tall enough for full subjects
const BACKDROP_W = ROOM_HALF * 2 + 1   // overhangs the floor edges
const BACKDROP_Z = -2.4                // 2.4m back from world origin

function StudioBackdrop() {
  return (
    <group>
      {/* Tall flat wall behind the subject — sits opposite the camera
          + key light so the front of the scene reads brightest while
          the backdrop catches gentle fill bounce. Plane only (no
          thickness) since the camera never goes behind it. */}
      <mesh
        position={[0, BACKDROP_H / 2, BACKDROP_Z]}
        receiveShadow
      >
        <planeGeometry args={[BACKDROP_W, BACKDROP_H]} />
        <meshStandardMaterial
          color={WALL_COLOR}
          roughness={0.95}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

// ---- root ------------------------------------------------------------

export default function DemoVolumeScene() {
  const floorTex = useFloorTexture()

  return (
    <group position={[0, 0, 0]}>
      {/* Soft fill so props read even when no HDRI / scene HDRI is on. */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 6, 4]} intensity={0.7} castShadow />

      {/* Square floor (6m × 6m). Lifted FLOOR_LIFT above y=0 so it
          stops z-fighting with the optional floor grid. DoubleSide so
          when the user dollies the camera below the floor they don't
          see straight through into the world below. */}
      <mesh position={[0, FLOOR_LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial map={floorTex} roughness={0.92} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Underside cap — keeps the room's exterior closed when the
          camera dips below the floor. Plain dark fill, no texture. */}
      <mesh position={[0, FLOOR_LIFT - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial color="#16181c" roughness={1} metalness={0} />
      </mesh>

      <StudioBackdrop />
      <StudioProps />
    </group>
  )
}
