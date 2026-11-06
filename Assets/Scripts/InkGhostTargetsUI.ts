import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"

// ── Typography: the single source of truth for text size + weight ────────────
// Text.size is the glyph em-square height (em cm = size / 43.886), calibrated
// for the SnapOS system font at 110 cm; applyTextRole scales by viewing distance.
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

const LAYOUT_Z_LIFT = 0.02
const BUTTON_LABEL_Z = 0.08

/**
 * InkGhostTargetsUI: the two pinch targets at the left edge of the sheet.
 * "Next stroke" (big) sits level with the guide character; "Replay" (smaller)
 * sits next to it on the side nearer the user. Lay this SceneObject flat on the
 * sheet (rotate -90 degrees about X) so the buttons face up.
 *
 * Passive view: it holds no lesson state. The controller subscribes to
 * onNextStroke / onReplay. Each fires once per pinch (Button onTriggerUp only).
 */
@component
export class InkGhostTargetsUI extends BaseScriptComponent {
  @ui.label("Ink Ghost pinch targets (UIKit)")
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Side of the square Next stroke target, cm")
  @widget(new SliderWidget(3, 10, 0.5))
  nextSize: number = 6

  @input
  @hint("Side of the square Replay target, cm")
  @widget(new SliderWidget(2, 8, 0.5))
  replaySize: number = 4

  @input
  @hint("Gap between the two targets, cm")
  @widget(new SliderWidget(0, 3, 0.1))
  gap: number = 0.8

  @input
  @hint("Label on the big target")
  nextLabel: string = "Next stroke"

  @input
  @hint("Label on the small target")
  replayLabel: string = "Replay"

  @input
  @hint("Eye-to-sheet distance used to size the labels, cm")
  @widget(new SliderWidget(30, 110, 1))
  viewDistance: number = 57
  @ui.group_end

  private _onNextStroke = new Event<void>()
  private _onReplay = new Event<void>()

  /** Fires once per pinch on the Next stroke target. */
  get onNextStroke(): PublicApi<void> {
    return this._onNextStroke.publicApi()
  }

  /** Fires once per pinch on the Replay target. */
  get onReplay(): PublicApi<void> {
    return this._onReplay.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const width = Math.max(this.nextSize, this.replaySize)
    const height = this.nextSize + this.gap + this.replaySize
    const column = this.flexColumn(this.sceneObject, width, height, {
      gap: this.gap,
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
    })
    this.addButton(column, "NextStrokeButton", this.nextLabel, this.nextSize, this.nextSize, "Primary", "Headline2", () => this._onNextStroke.invoke())
    this.addButton(column, "ReplayButton", this.replayLabel, this.replaySize, this.replaySize, "PrimaryNeutral", "Button", () => this._onReplay.invoke())
  }

  private addButton(parent: SceneObject, name: string, label: string, w: number, h: number, style: string, role: TextRole, onPinch: () => void): void {
    const so = this.obj(parent, name)
    this.liftInZ(so, LAYOUT_Z_LIFT)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setVariant({ theme: "SnapOS2", shape: "Rectangle", style: style })
    btn.size = new vec3(w, h, 1)
    this.addButtonLabel(so, label, w - 0.5, role)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h
    item.flexGrow = 0
    item.flexShrink = 0
    // No addItems() here: these children exist before the layout's OnStart, and
    // FlexLayout.autoDiscoverItemsOnStart (default true) picks them up. Calling
    // addItems() before the layout initializes throws.
    // One subscription per button: one pinch = one event.
    btn.onTriggerUp.add(() => onPinch())
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCM: number, role: TextRole): void {
    const so = this.obj(parent, "ButtonLabel", new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, this.viewDistance)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCM / 2, widthCM / 2, -widthCM / 2, widthCM / 2)
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

  private flexColumn(parent: SceneObject, width: number, height: number, opts?: { gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign }): SceneObject {
    return this.makeFlex(parent, FlexDirection.Column, width, height, opts)
  }

  private makeFlex(parent: SceneObject, direction: FlexDirection, width: number, height: number, opts?: { gap?: number; padY?: number; padX?: number; justify?: FlexJustify; align?: FlexAlign }): SceneObject {
    const container = this.obj(parent, "Flex")
    this.liftInZ(container, LAYOUT_Z_LIFT)
    const flexLayout = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
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
