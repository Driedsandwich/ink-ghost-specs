import { findSceneObjectByName, nextFrame } from "Leaf.lspkg/Utils/common/Utils"
import { findInteractablesByName } from "Leaf.lspkg/Interactors/InteractableUtils"
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { InkGhostController } from "../Scripts/InkGhostController"
import { InkGhostEndCardUI } from "../Scripts/InkGhostEndCardUI"

/** Shared helpers for the Ink Ghost LEAF scenarios. Read-only access to the Lens. */
export function getController(): InkGhostController {
  const so = findSceneObjectByName("InkGhostController")
  const c = so.getComponent(InkGhostController.getTypeName()) as InkGhostController
  if (!c) {
    throw new Error("InkGhostController component not found")
  }
  return c
}

export function getEndCard(): InkGhostEndCardUI {
  const so = findSceneObjectByName("EndCard")
  const c = so.getComponent(InkGhostEndCardUI.getTypeName()) as InkGhostEndCardUI
  if (!c) {
    throw new Error("InkGhostEndCardUI component not found")
  }
  return c
}

export function getInteractable(name: string): Interactable {
  const list = findInteractablesByName(name)
  if (list.length !== 1) {
    throw new Error("Expected exactly one interactable named " + name + ", found " + list.length)
  }
  return list[0]
}

/** Current state as one string, for failure messages and logs. */
export function describe(c: InkGhostController): string {
  return "char=" + c.charIndex + " step=" + c.step + "/" + c.strokeCount + " phase=" + c.phase + " progress=" + c.currentStrokeProgress.toFixed(2)
}

/** Wait frame by frame until cond() is true; throws after timeoutMs. */
export async function waitUntil(cond: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const start = getTime()
  while (!cond()) {
    if ((getTime() - start) * 1000 > timeoutMs) {
      throw new Error("Timed out after " + timeoutMs + " ms waiting for: " + what)
    }
    await nextFrame()
  }
}

export function dist(a: vec2, p: number[]): number {
  const dx = a.x - p[0]
  const dy = a.y - p[1]
  return Math.sqrt(dx * dx + dy * dy)
}

/** Point at fraction f (0..1) of the arc length of a lesson polyline. */
export function pointAtFraction(pts: number[][], f: number): number[] {
  if (pts.length === 1) {
    return pts[0]
  }
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2))
    seg.push(d)
    total += d
  }
  let target = Math.min(1, Math.max(0, f)) * total
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const t = seg[i] > 0 ? Math.min(1, target / seg[i]) : 1
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]
    }
    target -= seg[i]
  }
  return pts[pts.length - 1]
}

/** Relative luminance (Rec. 709) of an RGB(A) colour, for "brightest" comparisons. */
export function luminance(c: vec4): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}

/**
 * Which visual of progress dot i (0-based) is enabled in the scene: "Pending", "Current"
 * or "Done" (read from the dot's child SceneObjects, not from controller state).
 */
export function dotShown(i: number): string {
  const dot = findSceneObjectByName("ProgressDot " + (i + 1))
  const shown: string[] = []
  for (let k = 0; k < dot.getChildrenCount(); k++) {
    const child = dot.getChild(k)
    if (child.enabled) {
      shown.push(child.name)
    }
  }
  return shown.length === 1 ? shown[0] : "[" + shown.join(",") + "]"
}
