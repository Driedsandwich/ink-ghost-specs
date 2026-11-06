import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import { StrokeRibbon, StrokeStyle } from "./StrokeRibbon"
import { ShapeMesh } from "./ShapeMesh"
import { InkGhostTargetsUI } from "./InkGhostTargetsUI"
import { InkGhostEndCardUI } from "./InkGhostEndCardUI"

/** One character of the lesson: its glyph and its strokes in stroke order. */
export interface LessonCharacter {
  char: string
  strokes: number[][][]
}

export type InkGhostPhase = "idle" | "stroke" | "complete" | "lessonDone" | "cardDismissed"
export type ProgressDotState = "pending" | "current" | "done"

/**
 * InkGhostController runs the stroke-order lesson on the sheet.
 *
 * The lesson comes only from the lesson JsonAsset (Assets/Lesson/lesson_basic_strokes.json):
 * any number of characters, strokes and points. Nothing about the characters is in code.
 *
 * Flow per character with n strokes: pinch k (1..n) on Next stroke shows stroke k and
 * animates it once in its writing direction; pinch n + 1 completes the character (whole
 * character + check mark for 2 s, pinches ignored, then it fades) and the next
 * character's start dot appears. After the last character a card lists the practiced
 * characters; the next pinch fades it. Replay re-animates the current stroke.
 *
 * The sheet can be dragged flat on the desk (SIK) until the first Next stroke pinch locks it.
 */
@component
export class InkGhostController extends BaseScriptComponent {
  @ui.label("Ink Ghost lesson controller")
  @ui.separator
  @input
  @hint("Lesson file (Assets/Lesson/lesson_basic_strokes.json)")
  lesson: JsonAsset

  @input
  @hint("Unlit vertex-colour material (vertexBaseColorMaterial)")
  material: Material

  @input
  @hint("The virtual sheet (stand-in). Dragged flat on the desk until locked")
  sheet: SceneObject

  @input
  @hint("The virtual desk (stand-in). The sheet stays on its top")
  desk: SceneObject

  @input
  @hint("Follows the sheet; holds the pinch targets and the end card (kept out of the sheet's hierarchy so pinching a target never drags the sheet)")
  sheetOverlay: SceneObject

  @input
  @hint("SceneObject at the centre of the guide box, lying flat on the sheet")
  guideBox: SceneObject

  @input
  @hint("SceneObject at the centre of the writing square, lying flat on the sheet")
  writingSquare: SceneObject

  @input
  @hint("SceneObject at the centre of the progress row, along the far edge of the sheet")
  progressRow: SceneObject

  @input
  @hint("The pinch targets UI module")
  targets: InkGhostTargetsUI

  @input
  @hint("The end-of-lesson card UI module")
  endCard: InkGhostEndCardUI

  @ui.group_start("Settings")
  @input
  @hint("Side of the guide box the lesson points map onto, cm")
  boxSize: number = 10

  @input
  @hint("Side of the writing square outline, cm")
  writingSquareSize: number = 10

  @input
  @hint("Sheet size on the desk (X width, Z depth), cm")
  sheetSize: vec2 = new vec2(21, 29.7)

  @input
  @hint("Desk top size (X width, Z depth), cm")
  deskSize: vec2 = new vec2(120, 60)

  @input
  @hint("Seconds one stroke takes to draw")
  strokeSeconds: number = 1.2

  @input
  @hint("Seconds the completed character stays (pinches ignored)")
  completeSeconds: number = 2.0

  @input
  @hint("Seconds the completed character takes to fade")
  fadeSeconds: number = 0.4

  @ui.group_end
  private chars: LessonCharacter[] = []
  private _charIndex = 0
  private _step = 0
  private _phase: InkGhostPhase = "idle"
  private _nextPinches = 0
  private _ignoredPinches = 0
  private _replays = 0
  private _sheetLocked = false

  private fadeMaterial: Material | null = null
  private charRoot: SceneObject | null = null
  private ribbons: StrokeRibbon[] = []
  private ribbonObjects: SceneObject[] = []
  private startDot: SceneObject | null = null
  private checkMark: SceneObject | null = null
  private checkRibbon: StrokeRibbon | null = null
  private dots: { pending: SceneObject; current: SceneObject; done: SceneObject }[] = []
  private dotStates: ProgressDotState[] = []
  private manipulation: InteractableManipulation | null = null

  private animating = false
  private animStart = 0
  private fading = false
  private fadeStart = 0
  private sheetY = 0

  // ── Public read-only state (for LEAF tests) ────────────────────────────────
  get lessonChars(): string[] {
    return this.chars.map((c) => c.char)
  }
  get lessonStrokeCounts(): number[] {
    return this.chars.map((c) => c.strokes.length)
  }
  /** Stroke `strokeIndex` (0-based) of character `charIndex` (0-based) as lesson points. */
  lessonStroke(charIndex: number, strokeIndex: number): number[][] {
    return this.chars[charIndex].strokes[strokeIndex]
  }
  get charIndex(): number {
    return this._charIndex
  }
  /** 0 = not started, k = stroke k shown, n + 1 = completed. */
  get step(): number {
    return this._step
  }
  get strokeCount(): number {
    const c = this.chars[this._charIndex]
    return c ? c.strokes.length : 0
  }
  get phase(): InkGhostPhase {
    return this._phase
  }
  get nextPinchCount(): number {
    return this._nextPinches
  }
  get ignoredPinchCount(): number {
    return this._ignoredPinches
  }
  /** Incremented each time a replay animation starts. */
  get replayCount(): number {
    return this._replays
  }
  get sheetLocked(): boolean {
    return this._sheetLocked
  }
  get isAnimating(): boolean {
    return this.animating
  }
  get checkMarkVisible(): boolean {
    return !!this.checkMark && this.checkMark.enabled
  }
  get startDotVisible(): boolean {
    return !!this.startDot && this.startDot.enabled
  }
  get progressDotStates(): ProgressDotState[] {
    return this.dotStates.slice()
  }
  /** Number of stroke ribbons of the current character that are visible. */
  get visibleStrokeCount(): number {
    return this.ribbonObjects.filter((o) => o.enabled).length
  }
  /** Draw progress (0..1) of the current stroke, or -1 when no stroke is current. */
  get currentStrokeProgress(): number {
    const r = this.currentRibbon()
    return r ? r.getProgress() : -1
  }
  /** Drawing tip of the current stroke in world space (cm), or null. */
  get currentTipWorld(): vec3 | null {
    const r = this.currentRibbon()
    if (!r) {
      return null
    }
    const p = r.getTipLocal()
    const owner = this.ribbonObjects[this._step - 1].getTransform()
    return owner.getWorldTransform().multiplyPoint(new vec3(p.x, 0, p.y))
  }
  /** Style of stroke i (0-based) of the current character, or null if it does not exist. */
  strokeStyle(i: number): StrokeStyle | null {
    return i >= 0 && i < this.ribbons.length ? this.ribbons[i].getStyle() : null
  }
  /** Draw progress (0..1) of stroke i (0-based) of the current character, or -1. */
  strokeProgress(i: number): number {
    return i >= 0 && i < this.ribbons.length ? this.ribbons[i].getProgress() : -1
  }
  /** Drawing tip of the current stroke in lesson coordinates (0..1, y down), or null. */
  get currentTipLesson(): vec2 | null {
    const r = this.currentRibbon()
    if (!r) {
      return null
    }
    const p = r.getTipLocal()
    return new vec2(p.x / this.boxSize + 0.5, p.y / this.boxSize + 0.5)
  }

  onAwake(): void {
    if (!this.lesson || !this.material || !this.sheet || !this.sheetOverlay || !this.guideBox || !this.targets || !this.endCard) {
      print("[InkGhost] ERROR missing input: lesson, material, sheet, sheetOverlay, guideBox, targets and endCard are required")
      return
    }
    this.chars = InkGhostController.parseLesson(this.lesson.getString())
    print("[InkGhost] lesson loaded: " + this.chars.length + " chars [" + this.lessonChars.join(",") + "] strokes [" + this.lessonStrokeCounts.join(",") + "]")

    this.fadeMaterial = this.material.clone()
    this.fadeMaterial.mainPass.blendMode = BlendMode.Normal
    this.sheetY = this.sheet.getTransform().getWorldPosition().y

    this.buildStartDot()
    this.buildCheckMark()
    this.buildWritingSquare()
    this.buildProgressRow()
    this.setupSheetDrag()

    this.createEvent("OnStartEvent").bind(() => {
      this.targets.onNextStroke.add(() => this.onNextStroke())
      this.targets.onReplay.add(() => this.onReplay())
      this.endCard.onHidden.add(() => this.onCardHidden())
      this.enterCharacter(0)
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.createEvent("LateUpdateEvent").bind(() => this.onLateUpdate())
  }

  /**
   * Validate and normalise the lesson JSON. Throws if the file is not JSON or has no
   * 'characters' array; points that are not two finite numbers, and strokes left with
   * no points, are skipped with a warning so one bad entry does not stop the lesson.
   */
  static parseLesson(text: string): LessonCharacter[] {
    const data = JSON.parse(text)
    const list = data && data.characters
    if (!Array.isArray(list)) {
      throw new Error("[InkGhost] lesson JSON has no 'characters' array")
    }
    const out: LessonCharacter[] = []
    for (let ci = 0; ci < list.length; ci++) {
      const item = list[ci]
      const strokes: number[][][] = []
      const rawStrokes = item && Array.isArray(item.strokes) ? item.strokes : []
      for (let si = 0; si < rawStrokes.length; si++) {
        const stroke = rawStrokes[si]
        const pts: number[][] = []
        let bad = 0
        for (const p of Array.isArray(stroke) ? stroke : []) {
          const x = Array.isArray(p) ? Number(p[0]) : NaN
          const y = Array.isArray(p) ? Number(p[1]) : NaN
          if (isFinite(x) && isFinite(y)) {
            pts.push([x, y])
          } else {
            bad++
          }
        }
        if (bad > 0) {
          print("[InkGhost] WARNING lesson char " + (ci + 1) + " stroke " + (si + 1) + ": skipped " + bad + " invalid point(s)")
        }
        if (pts.length >= 1) {
          strokes.push(pts)
        } else {
          print("[InkGhost] WARNING lesson char " + (ci + 1) + " stroke " + (si + 1) + ": no valid points, stroke skipped")
        }
      }
      out.push({ char: String(item && item.char !== undefined ? item.char : "?"), strokes: strokes })
    }
    return out
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onNextStroke(): void {
    this._nextPinches++
    if (!this._sheetLocked) {
      this.lockSheet()
    }
    switch (this._phase) {
      case "idle":
      case "stroke":
        this.advance()
        return
      case "complete":
        this._ignoredPinches++
        print("[InkGhost] ignored pinch (completion window)")
        return
      case "lessonDone":
        if (this.endCard.isShown) {
          this.endCard.hide()
          print("[InkGhost] card fading")
        }
        return
      default:
        this._ignoredPinches++
        print("[InkGhost] ignored pinch (phase=" + this._phase + ")")
        return
    }
  }

  private onReplay(): void {
    if (this._phase !== "stroke") {
      print("[InkGhost] replay ignored (phase=" + this._phase + ")")
      return
    }
    this._replays++
    this.startStrokeAnimation()
    print("[InkGhost] replay char=" + (this._charIndex + 1) + " step=" + this._step + " replays=" + this._replays)
  }

  // ── Flow ───────────────────────────────────────────────────────────────────

  private advance(): void {
    const n = this.strokeCount
    if (this._step < n) {
      this._step++
      this._phase = "stroke"
      this.showStep()
      this.startStrokeAnimation()
      this.logState()
    } else {
      this.completeCharacter()
    }
  }

  private enterCharacter(index: number): void {
    this.destroyCharacter()
    this.animating = false
    this.fading = false
    this._charIndex = index
    this._step = 0
    if (index >= this.chars.length) {
      this._phase = "lessonDone"
      this.startDot.enabled = false
      this.checkMark.enabled = false
      this.updateProgressRow()
      this.endCard.show(this.chars)
      print("[InkGhost] lesson complete: " + this.chars.length + " chars, card shown")
      return
    }
    this._phase = "idle"
    this.buildCharacter(this.chars[index])
    this.startDot.enabled = true
    this.checkMark.enabled = false
    this.updateProgressRow()
    this.logState()
  }

  private completeCharacter(): void {
    this._phase = "complete"
    this._step = this.strokeCount + 1
    this.animating = false
    for (let i = 0; i < this.ribbons.length; i++) {
      this.ribbonObjects[i].enabled = true
      this.ribbons[i].setStyle(this.completeStyle(i, 1))
      this.ribbons[i].setProgress(1)
    }
    this.startDot.enabled = false
    this.checkRibbon.setStyle({ color: this.checkColor(1) })
    this.checkMark.enabled = true
    print("[InkGhost] complete char=" + (this._charIndex + 1) + "/" + this.chars.length + " " + this.chars[this._charIndex].char)
    const hold = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    hold.bind(() => {
      this.fading = true
      this.fadeStart = getTime()
    })
    hold.reset(this.completeSeconds)
  }

  private finishCharacter(): void {
    this.fading = false
    this.dotStates[this._charIndex] = "done"
    this.enterCharacter(this._charIndex + 1)
  }

  private onCardHidden(): void {
    this._phase = "cardDismissed"
    print("[InkGhost] card dismissed")
  }

  /** Earlier strokes dim and thin, stroke `step` current, later strokes hidden. */
  private showStep(): void {
    this.startDot.enabled = this._step === 0
    for (let i = 0; i < this.ribbons.length; i++) {
      const k = i + 1
      if (k < this._step) {
        this.ribbonObjects[i].enabled = true
        this.ribbons[i].setStyle(this.earlierStyle(i))
        this.ribbons[i].setProgress(1)
      } else if (k === this._step) {
        this.ribbonObjects[i].enabled = true
        this.ribbons[i].setStyle(this.currentStyle())
      } else {
        this.ribbonObjects[i].enabled = false
      }
    }
  }

  private startStrokeAnimation(): void {
    const r = this.currentRibbon()
    if (!r) {
      return
    }
    r.setProgress(0)
    this.animStart = getTime()
    this.animating = true
  }

  private currentRibbon(): StrokeRibbon | null {
    if (this._phase !== "stroke" || this._step < 1 || this._step > this.ribbons.length) {
      return null
    }
    return this.ribbons[this._step - 1]
  }

  private onUpdate(): void {
    if (this.animating) {
      const r = this.currentRibbon()
      if (!r) {
        this.animating = false
      } else {
        const t = Math.min(1, (getTime() - this.animStart) / Math.max(0.01, this.strokeSeconds))
        r.setProgress(t)
        if (t >= 1) {
          this.animating = false
        }
      }
    }
    if (this.fading) {
      const t = Math.min(1, (getTime() - this.fadeStart) / Math.max(0.01, this.fadeSeconds))
      const a = 1 - t
      for (let i = 0; i < this.ribbons.length; i++) {
        this.ribbons[i].setStyle(this.completeStyle(i, a))
      }
      this.checkRibbon.setStyle({ color: this.checkColor(a) })
      if (t >= 1) {
        this.finishCharacter()
      }
    }
  }

  // ── Sheet placement ────────────────────────────────────────────────────────

  private setupSheetDrag(): void {
    const collider = this.sheet.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(this.sheetSize.x, 0.4, this.sheetSize.y)
    collider.shape = shape
    collider.fitVisual = false
    this.sheet.createComponent(Interactable.getTypeName())
    this.manipulation = this.sheet.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    // Slide flat on the desk: no lift, no tilt, no scale, 1:1 movement.
    this.manipulation.setCanRotate(false)
    this.manipulation.setCanScale(false)
    this.manipulation.enableYTranslation = false
    this.manipulation.enableStretchZ = false
  }

  private lockSheet(): void {
    this._sheetLocked = true
    if (this.manipulation) {
      this.manipulation.setCanTranslate(false)
    }
    const p = this.sheet.getTransform().getWorldPosition()
    print("[InkGhost] sheet locked at x=" + p.x.toFixed(1) + " z=" + p.z.toFixed(1))
  }

  /** Keep the sheet flat on the desk top, and carry the overlay (targets, card) with it. */
  private onLateUpdate(): void {
    const st = this.sheet.getTransform()
    let p = st.getWorldPosition()
    if (this.desk) {
      const d = this.desk.getTransform().getWorldPosition()
      const hx = Math.max(0, this.deskSize.x / 2 - this.sheetSize.x / 2)
      const hz = Math.max(0, this.deskSize.y / 2 - this.sheetSize.y / 2)
      const x = Math.min(d.x + hx, Math.max(d.x - hx, p.x))
      const z = Math.min(d.z + hz, Math.max(d.z - hz, p.z))
      if (x !== p.x || z !== p.z || p.y !== this.sheetY) {
        p = new vec3(x, this.sheetY, z)
        st.setWorldPosition(p)
      }
    }
    if (!st.getWorldRotation().equal(quat.quatIdentity())) {
      st.setWorldRotation(quat.quatIdentity())
    }
    const ot = this.sheetOverlay.getTransform()
    if (!ot.getWorldPosition().equal(p)) {
      ot.setWorldPosition(p)
    }
  }

  // ── Building ───────────────────────────────────────────────────────────────

  private buildCharacter(c: LessonCharacter): void {
    this.charRoot = global.scene.createSceneObject("Character " + (this._charIndex + 1) + " " + c.char)
    this.charRoot.setParent(this.guideBox)
    for (let i = 0; i < c.strokes.length; i++) {
      const so = global.scene.createSceneObject("Stroke " + (i + 1))
      so.setParent(this.charRoot)
      const ribbon = new StrokeRibbon(so, this.fadeMaterial, c.strokes[i], this.boxSize, this.currentStyle())
      so.enabled = false
      this.ribbons.push(ribbon)
      this.ribbonObjects.push(so)
    }
  }

  private destroyCharacter(): void {
    if (this.charRoot) {
      this.charRoot.destroy()
    }
    this.charRoot = null
    this.ribbons = []
    this.ribbonObjects = []
  }

  private buildStartDot(): void {
    this.startDot = global.scene.createSceneObject("StartDot")
    this.startDot.setParent(this.guideBox)
    ShapeMesh.disc(this.startDot, this.material, 0.4, new vec4(0.85, 0.45, 0.12, 1), 0.06)
    this.startDot.enabled = false
  }

  private buildCheckMark(): void {
    this.checkMark = global.scene.createSceneObject("CheckMark")
    this.checkMark.setParent(this.guideBox)
    // Beside the far right corner of the guide box, outside the character.
    this.checkMark.getTransform().setLocalPosition(new vec3(this.boxSize * 0.5 + 1.6, 0, -this.boxSize * 0.5 + 1.2))
    const pts = [
      [0.12, 0.55],
      [0.4, 0.82],
      [0.9, 0.18],
    ]
    this.checkRibbon = new StrokeRibbon(this.checkMark, this.fadeMaterial, pts, 2.4, {
      width: 0.45,
      color: this.checkColor(1),
      showArrow: false,
      lift: 0.25,
    })
    this.checkRibbon.setProgress(1)
    this.checkMark.enabled = false
  }

  private buildWritingSquare(): void {
    if (!this.writingSquare) {
      return
    }
    ShapeMesh.rectOutline(this.writingSquare, this.material, this.writingSquareSize, this.writingSquareSize, 0.18, new vec4(0.42, 0.48, 0.58, 1), 0.02)
  }

  /** One dot per lesson character along the far edge, centred, shrinking to fit long lessons. */
  private buildProgressRow(): void {
    if (!this.progressRow) {
      return
    }
    const n = this.chars.length
    const usable = this.sheetSize.x - 2
    const spacing = n > 1 ? Math.min(1.8, usable / (n - 1)) : 0
    const diameter = n > 1 ? Math.min(1.0, spacing * 0.62) : 1.0
    const r = diameter / 2
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * spacing
      const dot = global.scene.createSceneObject("ProgressDot " + (i + 1))
      dot.setParent(this.progressRow)
      dot.getTransform().setLocalPosition(new vec3(x, 0, 0))
      const pending = global.scene.createSceneObject("Pending")
      pending.setParent(dot)
      ShapeMesh.ring(pending, this.material, r, r * 0.62, new vec4(0.42, 0.5, 0.62, 1), 0.03)
      const current = global.scene.createSceneObject("Current")
      current.setParent(dot)
      ShapeMesh.ring(current, this.material, r * 1.25, r * 0.85, new vec4(0.85, 0.45, 0.12, 1), 0.04)
      const inner = global.scene.createSceneObject("CurrentFill")
      inner.setParent(current)
      ShapeMesh.disc(inner, this.material, r * 0.55, new vec4(0.85, 0.45, 0.12, 1), 0.04)
      const done = global.scene.createSceneObject("Done")
      done.setParent(dot)
      ShapeMesh.disc(done, this.material, r, new vec4(0.2, 0.6, 0.55, 1), 0.03)
      this.dots.push({ pending: pending, current: current, done: done })
      this.dotStates.push("pending")
    }
  }

  private updateProgressRow(): void {
    for (let i = 0; i < this.dots.length; i++) {
      if (this.dotStates[i] !== "done") {
        this.dotStates[i] = i === this._charIndex ? "current" : "pending"
      }
      const s = this.dotStates[i]
      this.dots[i].pending.enabled = s === "pending"
      this.dots[i].current.enabled = s === "current"
      this.dots[i].done.enabled = s === "done"
    }
  }

  private logState(): void {
    const c = this.chars[this._charIndex]
    print("[InkGhost] char=" + (this._charIndex + 1) + "/" + this.chars.length + " " + (c ? c.char : "-") + " step=" + this._step + "/" + this.strokeCount + " phase=" + this._phase)
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  /** The current stroke: the brightest, most saturated thing on the sheet. */
  private currentStyle(): Partial<StrokeStyle> {
    return {
      width: 0.6,
      color: new vec4(1.0, 0.5, 0.06, 1.0),
      arrowColor: new vec4(1.0, 0.9, 0.35, 1.0),
      arrowLength: 1.2,
      arrowWidth: 1.3,
      showArrow: true,
      lift: 0.2,
    }
  }

  /** Earlier strokes: thinner and calmer in colour, but never faded toward invisible. */
  private earlierStyle(i: number): Partial<StrokeStyle> {
    return {
      width: 0.3,
      color: new vec4(0.3, 0.5, 0.78, 1.0),
      showArrow: false,
      lift: this.strokeLift(i),
    }
  }

  /** The whole character after the last stroke (alpha a for the fade). */
  private completeStyle(i: number, a: number): Partial<StrokeStyle> {
    return {
      width: 0.5,
      color: new vec4(0.2, 0.7, 0.62, a),
      showArrow: false,
      lift: this.strokeLift(i),
    }
  }

  /**
   * Height of non-current stroke i: distinct per stroke (no z-fighting where strokes cross)
   * and always below the current stroke's 0.2 cm, however many strokes the character has.
   */
  private strokeLift(i: number): number {
    const n = Math.max(1, this.ribbons.length)
    return 0.05 + (0.1 * i) / n
  }

  private checkColor(a: number): vec4 {
    return new vec4(0.3, 0.85, 0.4, a)
  }
}
