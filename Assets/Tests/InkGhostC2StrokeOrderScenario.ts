import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { getController, getInteractable, describe, waitUntil, dist, pointAtFraction, luminance } from "./InkGhostTestUtils"

/**
 * Done criterion 2: each pinch on Next stroke advances exactly one step, strokes come in
 * the lesson file's order, and each stroke animates in its writing direction.
 * Runs over every character and every stroke of whatever lesson is loaded. For stroke k:
 * - exactly one step per pinch; only strokes 1..k visible;
 * - expected points come from an independent parse of the lesson file;
 * - mid-animation the tip lies on lesson stroke k at the reported progress, and at the end
 *   it rests on the stroke's last point;
 * - in world space the tip moves by (du, dv) x box size along (+X, +Z): x = 0 left,
 *   y = 0 (top of the character) far from the user - no mirroring or flipping;
 * - drawing takes about 1.2 s; the current stroke has the arrow and is the brightest stroke,
 *   earlier strokes are thinner, calmer and fully opaque (not faded).
 */
@component
export class InkGhostC2StrokeOrderScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const next = getInteractable("NextStrokeButton")
    const ix = new DefaultLeafInteractor()
    const total = c.lessonChars.length
    expect(total > 0).toBe(true)
    // Expected strokes come from an independent read of the lesson file, not the Lens's parsed copy.
    const file = JSON.parse(c.lesson.getString())
    expect(file.characters.length).toBe(total)
    const box = c.boxSize

    for (let ci = 0; ci < total; ci++) {
      await waitUntil(() => c.phase === "idle" && c.charIndex === ci, 5000, "character " + ci + " ready")
      expect(c.startDotVisible).toBe(true)
      expect(c.visibleStrokeCount).toBe(0)
      const n = c.strokeCount
      expect(n).toBe(file.characters[ci].strokes.length)
      expect(c.lessonChars[ci]).toBe(String(file.characters[ci].char))
      for (let k = 1; k <= n; k++) {
        const pinches = c.nextPinchCount
        const stepBefore = c.step
        await ix.trigger(next)
        const tAfterPinch = getTime()
        await sleep(150)
        expect(c.nextPinchCount - pinches).toBe(1)
        expect(c.step - stepBefore).toBe(1)
        expect(c.step).toBe(k)
        expect(c.phase).toBe("stroke")
        expect(c.visibleStrokeCount).toBe(k)
        expect(c.startDotVisible).toBe(false)

        // Styles: current stroke has the arrow and is the brightest; earlier ones thinner, calmer, opaque.
        const cur = c.strokeStyle(k - 1)
        expect(cur.showArrow).toBe(true)
        expect(cur.color.a).toBe(1)
        for (let j = 0; j < k - 1; j++) {
          const e = c.strokeStyle(j)
          expect(e.showArrow).toBe(false)
          expect(e.color.a).toBe(1)
          expect(e.width < cur.width).toBe(true)
          expect(luminance(e.color) < luminance(cur.color)).toBe(true)
          expect(c.strokeProgress(j)).toBe(1)
        }

        // Mid-animation: the tip is on lesson stroke k at the reported progress.
        const pts: number[][] = file.characters[ci].strokes[k - 1]
        const prog = c.currentStrokeProgress
        const tipMid = c.currentTipLesson
        const worldMid = c.currentTipWorld
        expect(c.isAnimating).toBe(true)
        expect(prog > 0 && prog < 1).toBe(true)
        const onPath = pointAtFraction(pts, prog)
        const dMid = dist(tipMid, onPath)
        expect(dMid < 0.01).toBe(true)

        await waitUntil(() => !c.isAnimating, 3000, "stroke " + k + " animation to finish")
        const seconds = getTime() - tAfterPinch
        expect(seconds > 0.9 && seconds < 1.6).toBe(true)
        expect(c.currentStrokeProgress).toBe(1)
        const last = pts[pts.length - 1]
        const dEnd = dist(c.currentTipLesson, last)
        expect(dEnd < 0.005).toBe(true)

        // World space: lesson (du, dv) maps to (+X, +Z) * box size on the flat sheet.
        const worldEnd = c.currentTipWorld
        const d = worldEnd.sub(worldMid)
        const ex = (last[0] - onPath[0]) * box
        const ez = (last[1] - onPath[1]) * box
        const worldErr = Math.max(Math.abs(d.x - ex), Math.abs(d.z - ez), Math.abs(d.y))
        expect(worldErr < 0.05).toBe(true)

        // Stays lit until the next pinch.
        await sleep(300)
        expect(c.step).toBe(k)
        expect(c.visibleStrokeCount).toBe(k)
        print("[InkGhostTest] C2 " + c.lessonChars[ci] + " stroke " + k + "/" + n + " ok (draw " + seconds.toFixed(2) + " s, mid progress " + prog.toFixed(2) + ", tip error " + dMid.toFixed(4) + ", end error " + dEnd.toFixed(4) + ", world error " + worldErr.toFixed(3) + " cm)")
      }
      // Pinch n + 1 completes the character: one more step, no new stroke.
      await ix.trigger(next)
      await sleep(150)
      expect(c.phase).toBe("complete")
      expect(c.step).toBe(n + 1)
      expect(c.visibleStrokeCount).toBe(n)
      print("[InkGhostTest] C2 completed " + c.lessonChars[ci] + " " + describe(c))
    }
    await waitUntil(() => c.phase === "lessonDone", 5000, "lesson done")
  }
}
