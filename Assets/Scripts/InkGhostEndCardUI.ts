import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { StrokeRibbon } from "./StrokeRibbon"

// ── Typography: the single source of truth for text size + weight ────────────
const FONT_SIZE_SCALE = 1.0

type TextRole = "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2" | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"

const TYPE_SCALE: Record<TextRole, { size: number; weight: number }> = {
  Title1: { size: 105, weight: 700 },
  Title2: { size: 93, weight: 700 },
  HeadlineXL: { size: 62, weight: 700 },
  Headline1: { size: 54, weight: 700 },
  Headline2: { size: 48, weight: 700 },
  Subheadline: { size: 41, weight: 700 },
  Button: { size: 39, weight: 500 },
  Callout: { size: 39, weight: 700 },
  Body: { size: 39, weight: 500 },
  Caption: { size: 38, weight: 500 },
}

function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}

function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & { weight?: number }).weight = TYPE_SCALE[role].weight
}

const CONTENT_Z = 0.6
const LAYOUT_Z_LIFT = 0.02
const GLYPH_Z = 0.1

/** One practiced character for the card: its glyph and strokes (lesson data). */
export interface CardCharacter {
  char: string
  strokes: number[][][]
}

/**
 * InkGhostEndCardUI: the small card shown over the guide area after the lesson.
 * It lists the practiced characters, drawn from their own stroke data (so any
 * script renders, with no font dependency), and fades on request.
 *
 * Passive view: the controller calls show(...) and hide(); onHidden fires when
 * the fade finishes. Lay this SceneObject flat (rotate -90 degrees about X).
 */
@component
export class InkGhostEndCardUI extends BaseScriptComponent {
  @ui.label("Ink Ghost end-of-lesson card (UIKit)")
  @ui.separator
  @input
  @hint("Unlit vertex-colour material for the small character drawings")
  material: Material

  @ui.group_start("Settings")
  @input
  @hint("Card width, cm")
  @widget(new SliderWidget(6, 20, 0.5))
  cardWidth: number = 11

  @input
  @hint("Card height, cm")
  @widget(new SliderWidget(6, 20, 0.5))
  cardHeight: number = 10

  @input
  @hint("Title text")
  title: string = "Lesson complete"

  @input
  @hint("Line above the practiced characters")
  subtitle: string = "Characters practiced"

  @input
  @hint("Hint at the bottom of the card")
  footer: string = "Pinch Next stroke to close"

  @input
  @widget(new ColorWidget())
  @hint("Colour of the practiced-character drawings")
  glyphColor: vec4 = new vec4(0.55, 0.85, 1.0, 1.0)

  @input
  @hint("Eye-to-sheet distance used to size the text, cm")
  @widget(new SliderWidget(30, 110, 1))
  viewDistance: number = 57

  @input
  @hint("Fade-out time, seconds")
  @widget(new SliderWidget(0.1, 2, 0.05))
  fadeSeconds: number = 0.5

  @ui.group_end
  private built = false
  private shown = false
  private fading = false
  private fadeStart = 0
  private texts: Text[] = []
  private textColors: vec4[] = []
  private glyphs: StrokeRibbon[] = []
  private fadeMaterial: Material | null = null
  private columnItems: FlexItem[] = []
  private practicedCount = 0
  private _onHidden = new Event<void>()

  /** Fires once the fade-out has finished and the card is hidden. */
  get onHidden(): PublicApi<void> {
    return this._onHidden.publicApi()
  }

  /** True from show() until the fade-out finishes. */
  get isShown(): boolean {
    return this.shown
  }

  /** Number of stroke drawings on the card (all strokes of all practiced characters). */
  get glyphCount(): number {
    return this.glyphs.length
  }

  /** Number of practiced characters drawn on the card. */
  get characterCount(): number {
    return this.practicedCount
  }

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Build (first time) and show the card with the practiced characters. */
  show(chars: CardCharacter[]): void {
    if (!this.built) {
      this.build(chars)
    }
    this.sceneObject.getTransform().setLocalScale(vec3.one())
    this.sceneObject.enabled = true
    this.setAlpha(1)
    this.shown = true
    this.fading = false
  }

  /** Fade the card out; onHidden fires when done. */
  hide(): void {
    if (!this.shown || this.fading) {
      return
    }
    this.fading = true
    this.fadeStart = getTime()
  }

  private onUpdate(): void {
    if (!this.fading) {
      return
    }
    const t = Math.min(1, (getTime() - this.fadeStart) / Math.max(0.01, this.fadeSeconds))
    this.setAlpha(1 - t)
    const s = 1 - 0.15 * t
    this.sceneObject.getTransform().setLocalScale(new vec3(s, s, s))
    if (t >= 1) {
      this.fading = false
      this.shown = false
      this.sceneObject.enabled = false
      this._onHidden.invoke()
    }
  }

  private setAlpha(a: number): void {
    for (let i = 0; i < this.texts.length; i++) {
      const c = this.textColors[i]
      this.texts[i].textFill.color = new vec4(c.r, c.g, c.b, c.a * a)
    }
    for (const g of this.glyphs) {
      g.setStyle({ color: new vec4(this.glyphColor.r, this.glyphColor.g, this.glyphColor.b, this.glyphColor.a * a) })
    }
  }

  private build(chars: CardCharacter[]): void {
    this.built = true
    if (this.material) {
      this.fadeMaterial = this.material.clone()
      this.fadeMaterial.mainPass.blendMode = BlendMode.Normal
    }
    this.sceneObject.createComponent("Component.Canvas")
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(this.cardWidth, this.cardHeight)

    const content = this.obj(this.sceneObject, "Content", new vec3(0, 0, CONTENT_Z))
    const innerW = this.cardWidth - 1.2
    const innerH = this.cardHeight - 1.0
    // Vertical padding keeps the title and the hint clear of the card's rounded edges.
    const padY = 0.6
    const column = this.makeFlex(content, FlexDirection.Column, innerW, innerH, {
      gap: 0.35,
      padY: padY,
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
    })

    const titleH = 1.0
    const lineH = 0.8
    const glyphAreaH = Math.max(2, innerH - 2 * padY - titleH - 2 * lineH - 3 * 0.35)
    this.addTextRow(column, "Title", this.title, "Headline2", innerW, titleH, new vec4(1, 1, 1, 1))
    this.addTextRow(column, "Subtitle", this.subtitle, "Body", innerW, lineH, new vec4(1, 1, 1, 0.75))
    this.addGlyphArea(column, chars, innerW, glyphAreaH)
    this.addTextRow(column, "Footer", this.footer, "Caption", innerW, lineH, new vec4(1, 1, 1, 0.6))
    // Built at runtime after the layout may already have started, so items are
    // registered explicitly (auto-discovery is off for this layout).
    const layout = column.getComponent(FlexLayout.getTypeName()) as FlexLayout
    layout.addItems(this.columnItems)
  }

  private addTextRow(parent: SceneObject, name: string, text: string, role: TextRole, w: number, h: number, color: vec4): void {
    const so = this.obj(parent, name)
    this.liftInZ(so, LAYOUT_Z_LIFT)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, this.viewDistance)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5)
    t.textFill.color = color
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h
    item.alignSelf = FlexAlignSelf.Stretch
    this.columnItems.push(item)
    this.texts.push(t)
    this.textColors.push(color)
  }

  /** A fixed-size flex child holding the practiced characters as small stroke drawings. */
  private addGlyphArea(parent: SceneObject, chars: CardCharacter[], w: number, h: number): void {
    const area = this.obj(parent, "PracticedCharacters")
    this.liftInZ(area, LAYOUT_Z_LIFT)
    const item = area.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h
    this.columnItems.push(item)

    const n = chars.length
    if (n === 0) {
      return
    }
    // Grid of square cells that fits the area: as many columns as needed for the cells to fit.
    const gap = 0.3
    let best = { cols: 1, cell: 0 }
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols)
      const cell = Math.min((w - (cols - 1) * gap) / cols, (h - (rows - 1) * gap) / rows)
      if (cell > best.cell) {
        best = { cols: cols, cell: cell }
      }
    }
    const cols = best.cols
    const rows = Math.ceil(n / cols)
    const cell = Math.min(best.cell, 2.6)
    const totalW = cols * cell + (cols - 1) * gap
    const totalH = rows * cell + (rows - 1) * gap
    const width = Math.max(0.12, cell * 0.06)
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      const x = -totalW / 2 + cell / 2 + c * (cell + gap)
      const y = totalH / 2 - cell / 2 - r * (cell + gap)
      // Holder rotated +90 deg about X: its local XZ plane (ribbon plane) maps onto
      // the card's XY plane, with lesson "top" toward the card's +Y.
      const holder = this.obj(area, "Practiced " + (i + 1) + " " + chars[i].char, new vec3(x, y, GLYPH_Z))
      this.practicedCount++
      holder.getTransform().setLocalRotation(quat.angleAxis(Math.PI / 2, vec3.right()))
      for (const stroke of chars[i].strokes) {
        const so = this.obj(holder, "Stroke")
        const ribbon = new StrokeRibbon(so, this.fadeMaterial || this.material, stroke, cell, {
          width: width,
          color: this.glyphColor,
          showArrow: false,
          lift: 0.02,
        })
        ribbon.setProgress(1)
        this.glyphs.push(ribbon)
      }
    }
  }

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const sceneObject = global.scene.createSceneObject(name)
    sceneObject.setParent(parent)
    if (position) sceneObject.getTransform().setLocalPosition(position)
    return sceneObject
  }

  private liftInZ(sceneObject: SceneObject, zOffset: number): void {
    const transform = sceneObject.getTransform()
    const pos = transform.getLocalPosition()
    transform.setLocalPosition(new vec3(pos.x, pos.y, pos.z + zOffset))
  }

  private makeFlex(parent: SceneObject, direction: FlexDirection, width: number, height: number, opts?: { gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign }): SceneObject {
    const container = this.obj(parent, "Flex")
    this.liftInZ(container, LAYOUT_Z_LIFT)
    const flexLayout = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flexLayout.autoDiscoverItemsOnStart = false
    const flexItem = container.createComponent(FlexItem.getTypeName()) as FlexItem
    if (width > 0) flexItem.overrideWidth = width
    if (height > 0) flexItem.overrideHeight = height

    flexLayout.onInitialized.add(() => {
      flexLayout.width = width
      flexLayout.height = height
      flexLayout.direction = direction
      if (direction === FlexDirection.Row) {
        flexLayout.columnGap = opts?.gap ?? 0
      } else {
        flexLayout.rowGap = opts?.gap ?? 0
      }
      flexLayout.paddingTop = opts?.padY ?? 0
      flexLayout.paddingBottom = opts?.padY ?? 0
      flexLayout.paddingLeft = opts?.padX ?? 0
      flexLayout.paddingRight = opts?.padX ?? 0
      flexLayout.justifyContent = opts?.justify ?? FlexJustify.Start
      flexLayout.alignItems = opts?.align ?? FlexAlign.Stretch
    })
    return container
  }
}
