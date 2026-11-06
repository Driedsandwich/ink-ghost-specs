import { ShapeMesh } from "./ShapeMesh"

/**
 * StandInBox draws a preview stand-in (the virtual desk or the virtual sheet of
 * paper) as a solid box centred on this SceneObject. On real glasses over real
 * paper these stand-ins would be hidden; in Lens Studio's preview they give the
 * strokes something to sit on.
 */
@component
export class StandInBox extends BaseScriptComponent {
  @ui.label("Preview stand-in (virtual desk or sheet)")
  @ui.separator
  @input
  @hint("Unlit vertex-colour material (vertexBaseColorMaterial)")
  material: Material

  @ui.group_start("Settings")
  @input
  @hint("Box size in cm (X width, Y thickness, Z depth)")
  size: vec3 = new vec3(21, 0.1, 29.7)

  @input
  @widget(new ColorWidget())
  @hint("Colour of the top face")
  topColor: vec3 = new vec3(0.8, 0.8, 0.8)

  @input
  @widget(new ColorWidget())
  @hint("Colour of the side faces")
  sideColor: vec3 = new vec3(0.62, 0.62, 0.62)

  @input
  @hint("Add four legs under the box (for the desk)")
  legs: boolean = false

  @input
  @showIf("legs", true)
  @hint("Leg length in cm, measured down from the underside of the box")
  legLength: number = 72

  @input
  @showIf("legs", true)
  @hint("Leg thickness in cm")
  legThickness: number = 4

  @ui.group_end
  private mesh: ShapeMesh | null = null

  onAwake(): void {
    if (!this.material) {
      print("[InkGhost] StandInBox on " + this.sceneObject.name + ": material input is missing")
      return
    }
    const top = new vec4(this.topColor.x, this.topColor.y, this.topColor.z, 1)
    const side = new vec4(this.sideColor.x, this.sideColor.y, this.sideColor.z, 1)
    const bottom = new vec4(this.sideColor.x * 0.8, this.sideColor.y * 0.8, this.sideColor.z * 0.8, 1)
    const parts = [{ size: this.size, offset: vec3.zero(), top: top, side: side, bottom: bottom }]
    if (this.legs) {
      const lx = this.size.x / 2 - this.legThickness
      const lz = this.size.z / 2 - this.legThickness
      const ly = -this.size.y / 2 - this.legLength / 2
      const legSize = new vec3(this.legThickness, this.legLength, this.legThickness)
      const corners = [
        [-lx, -lz],
        [lx, -lz],
        [-lx, lz],
        [lx, lz],
      ]
      for (const c of corners) {
        parts.push({ size: legSize, offset: new vec3(c[0], ly, c[1]), top: side, side: bottom, bottom: bottom })
      }
    }
    this.mesh = ShapeMesh.boxes(this.sceneObject, this.material, parts)
  }
}
