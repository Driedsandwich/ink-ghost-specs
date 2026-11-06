/**
 * StrokeRibbon draws one brush stroke as a flat ribbon mesh built with MeshBuilder.
 *
 * Plane and mapping
 *   The stroke lies in the owner SceneObject's local XZ plane and faces local +Y,
 *   so lay the owner flat on the sheet. Lesson points are normalized 0..1 with y
 *   pointing down (KanjiVG). They map onto a boxSize x boxSize cm square centred
 *   on the owner (see lessonPointToLocal):
 *     x = 0 -> left  (-X), x = 1 -> right (+X)
 *     y = 0 (top of the character) -> far side (-Z), y = 1 -> near side (+Z)
 *   With the owner unrotated and the user looking down -Z, the character reads
 *   upright. No mirroring or flipping.
 *
 * Geometry
 *   Each segment is its own quad and every point gets a small disc (round joins),
 *   so sharp turns and hooks never fold the ribbon. A disc rides the drawing tip
 *   and an arrowhead points along the writing direction at the tip.
 *
 * Reveal
 *   setProgress(t) shows the stroke from its start up to fraction t of its arc
 *   length. Geometry past the tip is collapsed onto the tip (zero-area triangles
 *   draw nothing), so the buffers keep a fixed size and an update only rewrites
 *   vertex data.
 *
 * Winding: every triangle is counter-clockwise seen from local +Y (front face up),
 * as required by the default Cull Back.
 */

export interface StrokeStyle {
  /** Ribbon width in cm. */
  width: number
  /** RGBA colour of the ribbon and discs. */
  color: vec4
  /** RGBA colour of the arrowhead. */
  arrowColor: vec4
  /** Arrowhead length in cm. */
  arrowLength: number
  /** Arrowhead base width in cm. */
  arrowWidth: number
  /** Height above the owner's plane in cm. Give crossing strokes different lifts to avoid z-fighting. */
  lift: number
  /** Show the arrowhead at the tip. */
  showArrow: boolean
}

export const DEFAULT_STROKE_STYLE: StrokeStyle = {
  width: 0.6,
  color: new vec4(1.0, 0.45, 0.05, 1.0),
  arrowColor: new vec4(1.0, 0.85, 0.3, 1.0),
  arrowLength: 1.1,
  arrowWidth: 1.2,
  lift: 0.1,
  showArrow: true,
}

/** Map a lesson point (normalized, y down) to the owner's local space in cm. */
export function lessonPointToLocal(x: number, y: number, boxSize: number, lift: number): vec3 {
  return new vec3((x - 0.5) * boxSize, lift, (y - 0.5) * boxSize)
}

// position(3) + normal(3) + color(4)
const STRIDE = 10
const DISC_SEGMENTS = 12
const DISC_VERTS = DISC_SEGMENTS + 1
const ARROW_LIFT = 0.02

export class StrokeRibbon {
  readonly visual: RenderMeshVisual

  private builder: MeshBuilder
  private style: StrokeStyle
  private progress = 1

  // Stroke points in local XZ (y is ignored here; the lift is applied when writing).
  private px: number[] = []
  private pz: number[] = []
  // Cumulative arc length at each point.
  private s: number[] = []
  private totalLength = 0

  private segCount: number
  private segBase = 0
  private jointBase: number
  private tipBase: number
  private arrowBase: number
  private vertexCount: number

  constructor(owner: SceneObject, material: Material, points: number[][], boxSize: number, style?: Partial<StrokeStyle>) {
    this.style = StrokeRibbon.mergeStyle(DEFAULT_STROKE_STYLE, style)

    const n = points.length
    if (n < 1) {
      throw new Error("StrokeRibbon needs at least one point")
    }
    for (let i = 0; i < n; i++) {
      const p = lessonPointToLocal(points[i][0], points[i][1], boxSize, 0)
      this.px.push(p.x)
      this.pz.push(p.z)
    }
    this.s.push(0)
    for (let i = 1; i < n; i++) {
      const dx = this.px[i] - this.px[i - 1]
      const dz = this.pz[i] - this.pz[i - 1]
      this.s.push(this.s[i - 1] + Math.sqrt(dx * dx + dz * dz))
    }
    this.totalLength = this.s[n - 1]

    this.segCount = Math.max(0, n - 1)
    this.jointBase = this.segBase + this.segCount * 4
    this.tipBase = this.jointBase + n * DISC_VERTS
    this.arrowBase = this.tipBase + DISC_VERTS
    this.vertexCount = this.arrowBase + 3
    if (this.vertexCount > 65535) {
      throw new Error("StrokeRibbon: too many points for 16-bit indices")
    }

    this.builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 },
    ])
    this.builder.topology = MeshTopology.Triangles
    this.builder.indexType = MeshIndexType.UInt16

    this.builder.appendVerticesInterleaved(this.buildVertexData())
    this.builder.appendIndices(this.buildIndices())

    this.visual = owner.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.visual.mesh = this.builder.getMesh()
    if (material) {
      this.visual.mainMaterial = material
    }
    this.builder.updateMesh()
  }

  /** Total arc length of the stroke in cm. */
  getLength(): number {
    return this.totalLength
  }

  getProgress(): number {
    return this.progress
  }

  /** Drawing tip at the current progress, in the owner's local XZ plane (x, z) in cm. */
  getTipLocal(): vec2 {
    const tip = this.computeTip()
    return new vec2(tip.x, tip.z)
  }

  /** Reveal the stroke up to fraction t (0..1) of its length. */
  setProgress(t: number): void {
    const clamped = Math.min(1, Math.max(0, t))
    if (clamped === this.progress) {
      return
    }
    this.progress = clamped
    this.rewrite()
  }

  /** Change width, colours, lift or arrow. Rewrites the vertex data in place. */
  setStyle(style: Partial<StrokeStyle>): void {
    this.style = StrokeRibbon.mergeStyle(this.style, style)
    this.rewrite()
  }

  getStyle(): StrokeStyle {
    return StrokeRibbon.mergeStyle(this.style, undefined)
  }

  private static mergeStyle(base: StrokeStyle, over?: Partial<StrokeStyle>): StrokeStyle {
    const o = over || {}
    return {
      width: o.width !== undefined ? o.width : base.width,
      color: o.color !== undefined ? o.color : base.color,
      arrowColor: o.arrowColor !== undefined ? o.arrowColor : base.arrowColor,
      arrowLength: o.arrowLength !== undefined ? o.arrowLength : base.arrowLength,
      arrowWidth: o.arrowWidth !== undefined ? o.arrowWidth : base.arrowWidth,
      lift: o.lift !== undefined ? o.lift : base.lift,
      showArrow: o.showArrow !== undefined ? o.showArrow : base.showArrow,
    }
  }

  private rewrite(): void {
    const data = this.buildVertexData()
    const one: number[] = new Array(STRIDE)
    for (let v = 0; v < this.vertexCount; v++) {
      const off = v * STRIDE
      for (let k = 0; k < STRIDE; k++) {
        one[k] = data[off + k]
      }
      this.builder.setVertexInterleaved(v, one)
    }
    this.builder.updateMesh()
  }

  /** Tip position and writing direction at the current progress. */
  private computeTip(): { x: number; z: number; dx: number; dz: number; seg: number; dist: number } {
    const n = this.px.length
    const dist = this.totalLength * this.progress
    if (n === 1 || this.totalLength <= 0) {
      return { x: this.px[0], z: this.pz[0], dx: 1, dz: 0, seg: -1, dist: 0 }
    }
    let seg = 0
    while (seg < n - 2 && this.s[seg + 1] < dist) {
      seg++
    }
    const segLen = this.s[seg + 1] - this.s[seg]
    const f = segLen > 0 ? Math.min(1, Math.max(0, (dist - this.s[seg]) / segLen)) : 1
    const x = this.px[seg] + (this.px[seg + 1] - this.px[seg]) * f
    const z = this.pz[seg] + (this.pz[seg + 1] - this.pz[seg]) * f
    const dir = this.segmentDirection(seg)
    return { x, z, dx: dir[0], dz: dir[1], seg, dist }
  }

  /** Unit direction of segment i; falls back to a neighbour for zero-length segments. */
  private segmentDirection(i: number): number[] {
    const n = this.px.length
    for (let k = 0; k < n - 1; k++) {
      // Search outward from i: i, i-1, i+1, i-2, ...
      const candidates = [i - k, i + k]
      for (const c of candidates) {
        if (c < 0 || c >= n - 1) {
          continue
        }
        const dx = this.px[c + 1] - this.px[c]
        const dz = this.pz[c + 1] - this.pz[c]
        const len = Math.sqrt(dx * dx + dz * dz)
        if (len > 1e-6) {
          return [dx / len, dz / len]
        }
      }
    }
    return [1, 0]
  }

  private buildVertexData(): number[] {
    const st = this.style
    const y = st.lift
    const hw = st.width * 0.5
    const c = st.color
    const ac = st.arrowColor
    const tip = this.computeTip()
    const out: number[] = []

    const push = (x: number, py: number, z: number, col: vec4) => {
      out.push(x, py, z, 0, 1, 0, col.r, col.g, col.b, col.a)
    }

    // Segment quads: L_a, R_a, L_b, R_b. Perpendicular p = up x dir = (dz, 0, -dx).
    for (let i = 0; i < this.segCount; i++) {
      let ax = this.px[i]
      let az = this.pz[i]
      let bx = this.px[i + 1]
      let bz = this.pz[i + 1]
      const sa = this.s[i]
      const sb = this.s[i + 1]
      if (sb <= tip.dist) {
        // Fully drawn.
      } else if (sa < tip.dist) {
        // Straddles the tip: end the quad at the tip.
        bx = tip.x
        bz = tip.z
      } else {
        // Not reached yet: collapse onto the tip (zero area).
        ax = tip.x
        az = tip.z
        bx = tip.x
        bz = tip.z
      }
      const dir = this.segmentDirection(i)
      const pxp = dir[1] * hw
      const pzp = -dir[0] * hw
      push(ax + pxp, y, az + pzp, c)
      push(ax - pxp, y, az - pzp, c)
      push(bx + pxp, y, bz + pzp, c)
      push(bx - pxp, y, bz - pzp, c)
    }

    // Joint discs at every point that the tip has reached.
    for (let i = 0; i < this.px.length; i++) {
      const reached = this.s[i] <= tip.dist
      const cx = reached ? this.px[i] : tip.x
      const cz = reached ? this.pz[i] : tip.z
      this.pushDisc(out, cx, y, cz, reached ? hw : 0, c)
    }

    // Disc riding the tip.
    this.pushDisc(out, tip.x, y, tip.z, hw, c)

    // Arrowhead: apex ahead of the tip, base behind it.
    const ay = y + ARROW_LIFT
    if (st.showArrow && st.arrowLength > 0) {
      const ahead = st.arrowLength * 0.65
      const behind = st.arrowLength * 0.35
      const ahw = st.arrowWidth * 0.5
      const bxc = tip.x - tip.dx * behind
      const bzc = tip.z - tip.dz * behind
      const ppx = tip.dz * ahw
      const ppz = -tip.dx * ahw
      push(bxc + ppx, ay, bzc + ppz, ac) // base left
      push(bxc - ppx, ay, bzc - ppz, ac) // base right
      push(tip.x + tip.dx * ahead, ay, tip.z + tip.dz * ahead, ac) // apex
    } else {
      push(tip.x, ay, tip.z, ac)
      push(tip.x, ay, tip.z, ac)
      push(tip.x, ay, tip.z, ac)
    }

    return out
  }

  private pushDisc(out: number[], cx: number, y: number, cz: number, r: number, col: vec4): void {
    out.push(cx, y, cz, 0, 1, 0, col.r, col.g, col.b, col.a)
    for (let k = 0; k < DISC_SEGMENTS; k++) {
      const a = (2 * Math.PI * k) / DISC_SEGMENTS
      out.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, 0, 1, 0, col.r, col.g, col.b, col.a)
    }
  }

  private buildIndices(): number[] {
    const idx: number[] = []
    // Quads: (L_a, R_a, L_b) and (R_a, R_b, L_b) are CCW seen from +Y.
    for (let i = 0; i < this.segCount; i++) {
      const b = this.segBase + i * 4
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2)
    }
    // Discs: (centre, ring[k+1], ring[k]) is CCW seen from +Y for increasing angle in XZ.
    const discCount = this.px.length + 1
    for (let d = 0; d < discCount; d++) {
      const centre = this.jointBase + d * DISC_VERTS
      for (let k = 0; k < DISC_SEGMENTS; k++) {
        const r0 = centre + 1 + k
        const r1 = centre + 1 + ((k + 1) % DISC_SEGMENTS)
        idx.push(centre, r1, r0)
      }
    }
    // Arrow: (base left, base right, apex) is CCW seen from +Y.
    idx.push(this.arrowBase, this.arrowBase + 1, this.arrowBase + 2)
    return idx
  }
}
