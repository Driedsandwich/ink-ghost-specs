import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { getController, getInteractable, describe, waitUntil, dotShown } from "./InkGhostTestUtils"

/**
 * Done criterion 3: after the last stroke, the character shows complete with a check mark,
 * and the next character's dot appears.
 * For the first (up to) two characters: pinch n + 1 draws all n strokes fully and shows the
 * check mark; pinches inside the 2-second window (right away and at about 1.9 s) are ignored,
 * so no stroke is skipped; after the window and the fade the next character's start dot
 * appears and the progress row's dot objects show finished / current. With a one-character
 * lesson the lesson ends instead.
 */
@component
export class InkGhostC3CompletionScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const next = getInteractable("NextStrokeButton")
    const ix = new DefaultLeafInteractor()
    const total = c.lessonChars.length
    expect(total >= 1).toBe(true)
    const count = Math.min(2, total)

    for (let ci = 0; ci < count; ci++) {
      await waitUntil(() => c.phase === "idle" && c.charIndex === ci, 5000, "character " + ci + " ready")
      expect(dotShown(ci)).toBe("Current")
      const n = c.strokeCount
      for (let k = 1; k <= n; k++) {
        await ix.trigger(next)
        await sleep(200)
      }
      expect(c.step).toBe(n)
      expect(c.checkMarkVisible).toBe(false)

      await ix.trigger(next)
      const tComplete = getTime()
      await sleep(200)
      expect(c.phase).toBe("complete")
      expect(c.checkMarkVisible).toBe(true)
      expect(c.visibleStrokeCount).toBe(n)
      for (let j = 0; j < n; j++) {
        expect(c.strokeProgress(j)).toBe(1)
      }
      expect(c.startDotVisible).toBe(false)

      // Pinches during the completion window are ignored: right away and near the end.
      const ignored = c.ignoredPinchCount
      await ix.trigger(next)
      await sleep(100)
      await waitUntil(() => getTime() - tComplete >= 1.9, 3000, "1.9 s into the completion window")
      expect(c.phase).toBe("complete")
      expect(c.checkMarkVisible).toBe(true)
      await ix.trigger(next)
      await sleep(50)
      expect(c.ignoredPinchCount - ignored).toBe(2)
      expect(c.charIndex).toBe(ci)
      expect(c.step).toBe(n + 1)

      await waitUntil(() => c.phase !== "complete", 3000, "end of completion window")
      const held = getTime() - tComplete
      print("[InkGhostTest] C3 " + c.lessonChars[ci] + " held complete for " + held.toFixed(2) + " s; now " + describe(c))
      expect(held >= 2.0 && held < 3.2).toBe(true)
      expect(c.checkMarkVisible).toBe(false)
      expect(dotShown(ci)).toBe("Done")
      if (ci + 1 < total) {
        expect(c.phase).toBe("idle")
        expect(c.charIndex).toBe(ci + 1)
        expect(c.step).toBe(0)
        expect(c.startDotVisible).toBe(true)
        expect(dotShown(ci + 1)).toBe("Current")
      } else {
        expect(c.phase).toBe("lessonDone")
      }
    }
  }
}
