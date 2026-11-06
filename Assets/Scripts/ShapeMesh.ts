/**
 * ShapeMesh builds the small flat shapes Ink Ghost needs (boxes, discs, rings,
 * rectangle outlines) with MeshBuilder, using per-vertex colour so one unlit
 * vertex-colour material serves every shape.
 *
 * Every builder returns a ShapeMesh that owns a RenderMeshVisual on the given
 * SceneObject. Flat shapes lie in the owner's local XZ plane and face local +Y.
 * Triangles are counter-clockwise seen from outside (front face), as required
 * by the default Cull Back.
 */

// position(3) + normal(3) + color(4)
const STRIDE = 10
const RING_SEGMENTS = 24

type Vec3Arr = [number, number, number]

class Writer {
  data: number[] = []
  indices: number[] = []

  vertex(p: Vec3Arr, n: Vec3Arr, c: vec4): number {
    const index = this.data.length / STRIDE
    this.data.push(p[0], p[1], p[2], n[0], n[1], n[2], c.r, c.g, c.b, c.a)
    return index
  }

  tri(a: number, b: number, c: number): void {
    this.indices.push(a, b, c)
  }

  /** Quad from centre c, half-axes u and v with u x v = normal (front face). */
  quad(c: Vec3Arr, u: Vec3Arr, v: Vec3Arr, n: Vec3Arr, col: vec4): void {
    const p = (su: number, sv: number): Vec3Arr => [
      c[0] + su * u[0] + sv * v[0],
      c[1] + su * u[1] + sv * v[1],
      c[2] + su * u[2] + sv * v[2],
    ]
    const i0 = this.vertex(p(-1, -1), n, col)
    const i1 = this.vertex(p(1, -1), n, col)
    const i2 = this.vertex(p(1, 1), n, col)
    const i3 = this.vertex(p(-1, 1), n, col)
    this.tri(i0, i1, i2)
    this.tri(i0, i2, i3)
  }

  /** Axis-aligned flat rectangle in XZ at height y, facing +Y. */
  flatRect(x0: number, z0: number, x1: number, z1: number, y: number, col: vec4): void {
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    // u = Z, v = X so that u x v = +Y.
    this.quad([cx, y, cz], [0, 0, Math.abs(z1 - z0) / 2], [Math.abs(x1 - x0) / 2, 0, 0], [0, 1, 0], col)
  }
}

export class ShapeMesh {
  readonly visual: RenderMeshVisual
  private builder: MeshBuilder
  private data: number[]

  private constructor(owner: SceneObject, material: Material, w: Writer) {
    this.data = w.data
    this.builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 },
    ])
    this.builder.topology = MeshTopology.Triangles
    this.builder.indexType = MeshIndexType.UInt16
    this.builder.appendVerticesInterleaved(w.data)
    this.builder.appendIndices(w.indices)
    this.visual = owner.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.visual.mesh = this.builder.getMesh()
    this.visual.mainMaterial = material
    this.builder.updateMesh()
  }

  /** Recolour every vertex (keeps geometry). */
  setColor(c: vec4): void {
    const one: number[] = new Array(STRIDE)
    const count = this.data.length / STRIDE
    for (let v = 0; v < count; v++) {
      const off = v * STRIDE
      this.data[off + 6] = c.r
      this.data[off + 7] = c.g
      this.data[off + 8] = c.b
      this.data[off + 9] = c.a
      for (let k = 0; k < STRIDE; k++) {
        one[k] = this.data[off + k]
      }
      this.builder.setVertexInterleaved(v, one)
    }
    this.builder.updateMesh()
  }

  /**
   * Solid box centred on the owner. The top face uses topColor, the sides
   * sideColor and the bottom bottomColor, so an unlit material still reads as 3D.
   */
  static box(owner: SceneObject, material: Material, size: vec3, topColor: vec4, sideColor: vec4, bottomColor: vec4, offset?: vec3): ShapeMesh {
    const w = new Writer()
    ShapeMesh.writeBox(w, size, topColor, sideColor, bottomColor, offset || vec3.zero())
    return new ShapeMesh(owner, material, w)
  }

  /** Several boxes in one mesh (e.g. a desk top and its legs). */
  static boxes(owner: SceneObject, material: Material, parts: { size: vec3; offset: vec3; top: vec4; side: vec4; bottom: vec4 }[]): ShapeMesh {
    const w = new Writer()
    for (const p of parts) {
      ShapeMesh.writeBox(w, p.size, p.top, p.side, p.bottom, p.offset)
    }
    return new ShapeMesh(owner, material, w)
  }

  private static writeBox(w: Writer, size: vec3, top: vec4, side: vec4, bottom: vec4, o: vec3): void {
    const hx = size.x / 2
    const hy = size.y / 2
    const hz = size.z / 2
    // Each face: centre, u, v with u x v = outward normal.
    w.quad([o.x, o.y + hy, o.z], [0, 0, hz], [hx, 0, 0], [0, 1, 0], top)
    w.quad([o.x, o.y - hy, o.z], [hx, 0, 0], [0, 0, hz], [0, -1, 0], bottom)
    w.quad([o.x + hx, o.y, o.z], [0, hy, 0], [0, 0, hz], [1, 0, 0], side)
    w.quad([o.x - hx, o.y, o.z], [0, 0, hz], [0, hy, 0], [-1, 0, 0], side)
    w.quad([o.x, o.y, o.z + hz], [hx, 0, 0], [0, hy, 0], [0, 0, 1], side)
    w.quad([o.x, o.y, o.z - hz], [0, hy, 0], [hx, 0, 0], [0, 0, -1], side)
  }

  /** Filled disc of the given radius at height lift, facing +Y. */
  static disc(owner: SceneObject, material: Material, radius: number, color: vec4, lift: number): ShapeMesh {
    const w = new Writer()
    const n: Vec3Arr = [0, 1, 0]
    const centre = w.vertex([0, lift, 0], n, color)
    const ring: number[] = []
    for (let k = 0; k < RING_SEGMENTS; k++) {
      const a = (2 * Math.PI * k) / RING_SEGMENTS
      ring.push(w.vertex([Math.cos(a) * radius, lift, Math.sin(a) * radius], n, color))
    }
    for (let k = 0; k < RING_SEGMENTS; k++) {
      // (centre, ring[k+1], ring[k]) is CCW seen from +Y for increasing angle in XZ.
      w.tri(centre, ring[(k + 1) % RING_SEGMENTS], ring[k])
    }
    return new ShapeMesh(owner, material, w)
  }

  /** Ring (annulus) between innerRadius and outerRadius at height lift, facing +Y. */
  static ring(owner: SceneObject, material: Material, outerRadius: number, innerRadius: number, color: vec4, lift: number): ShapeMesh {
    const w = new Writer()
    const n: Vec3Arr = [0, 1, 0]
    const inner: number[] = []
    const outer: number[] = []
    for (let k = 0; k < RING_SEGMENTS; k++) {
      const a = (2 * Math.PI * k) / RING_SEGMENTS
      const c = Math.cos(a)
      const s = Math.sin(a)
      inner.push(w.vertex([c * innerRadius, lift, s * innerRadius], n, color))
      outer.push(w.vertex([c * outerRadius, lift, s * outerRadius], n, color))
    }
    for (let k = 0; k < RING_SEGMENTS; k++) {
      const k1 = (k + 1) % RING_SEGMENTS
      w.tri(inner[k], outer[k1], outer[k])
      w.tri(inner[k], inner[k1], outer[k1])
    }
    return new ShapeMesh(owner, material, w)
  }

  /** Thin outline of a width x depth rectangle centred on the owner, at height lift, facing +Y. */
  static rectOutline(owner: SceneObject, material: Material, width: number, depth: number, lineWidth: number, color: vec4, lift: number): ShapeMesh {
    const w = new Writer()
    const hx = width / 2
    const hz = depth / 2
    const lw = lineWidth
    // Far and near edges span the full width; left and right edges fill between them.
    w.flatRect(-hx, -hz, hx, -hz + lw, lift, color)
    w.flatRect(-hx, hz - lw, hx, hz, lift, color)
    w.flatRect(-hx, -hz + lw, -hx + lw, hz - lw, lift, color)
    w.flatRect(hx - lw, -hz + lw, hx, hz - lw, lift, color)
    return new ShapeMesh(owner, material, w)
  }
}
