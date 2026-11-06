import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { InkGhostController } from "../Scripts/InkGhostController"
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { getController, getInteractable, waitUntil, dist, pointAtFraction } from "./InkGhostTestUtils"

/**
 * Done criterion 4: Replay re-animates the current stroke without advancing.
 * Replay before any stroke does nothing. Then, on the first character that has two or more
 * strokes (or the first character if none does), Replay is pressed on stroke 1, on stroke 2
 * and on the last stroke: each time the animation restarts from the start along that same
 * stroke (expected points from an independent parse of the lesson file), while the step,
 * the character and the Next stroke count stay unchanged.
 */
@component
export class InkGhostC4ReplayScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const next = getInteractable("NextStrokeButton")
    const replay = getInteractable("ReplayButton")
    const ix = new DefaultLeafInteractor()
    const file = JSON.parse(c.lesson.getString())

    // Before the first stroke: nothing to replay.
    const r0 = c.replayCount
    await ix.trigger(replay)
    await sleep(200)
    expect(c.replayCount).toBe(r0)
    expect(c.step).toBe(0)

    // Move to the first character with 2+ strokes (pinch through earlier characters).
    let target = 0
    for (let i = 0; i < file.characters.length; i++) {
      if (file.characters[i].strokes.length >= 2) {
        target = i
        break
      }
    }
    while (c.charIndex < target) {
      if (c.phase === "complete") {
        await waitUntil(() => c.phase !== "complete", 5000, "completion window")
        continue
      }
      await ix.trigger(next)
      await sleep(120)
    }
    await waitUntil(() => c.phase === "idle" && c.charIndex === target, 5000, "target character ready")

    const n = c.strokeCount
    const strokesToTest = Array.from(new Set([1, Math.min(2, n), n]))
    let replays = 0
    for (const k of strokesToTest) {
      while (c.step < k) {
        await ix.trigger(next)
        await sleep(120)
      }
      await waitUntil(() => !c.isAnimating, 3000, "stroke " + k + " drawn")
      expect(c.step).toBe(k)
      const pts: number[][] = file.characters[target].strokes[k - 1]
      replays++
      await this.replayOnce(c, ix, replay, pts, k, target, r0 + replays)
    }
  }

  private async replayOnce(c: InkGhostController, ix: DefaultLeafInteractor, replay: Interactable, pts: number[][], k: number, charIndex: number, expectedReplays: number): Promise<void> {
    const pinchesBefore = c.nextPinchCount
    expect(c.currentStrokeProgress).toBe(1)
    await ix.trigger(replay)
    await sleep(150)
    expect(c.replayCount).toBe(expectedReplays)
    expect(c.isAnimating).toBe(true)
    const prog = c.currentStrokeProgress
    expect(prog > 0 && prog < 1).toBe(true)
    expect(dist(c.currentTipLesson, pointAtFraction(pts, prog)) < 0.01).toBe(true)
    // Not advanced.
    expect(c.step).toBe(k)
    expect(c.charIndex).toBe(charIndex)
    expect(c.phase).toBe("stroke")
    expect(c.visibleStrokeCount).toBe(k)
    expect(c.nextPinchCount).toBe(pinchesBefore)
    await waitUntil(() => !c.isAnimating, 3000, "replay of stroke " + k + " to finish")
    expect(c.currentStrokeProgress).toBe(1)
    expect(dist(c.currentTipLesson, pts[pts.length - 1]) < 0.005).toBe(true)
    expect(c.step).toBe(k)
    print("[InkGhostTest] C4 replay on " + c.lessonChars[charIndex] + " stroke " + k + "/" + c.strokeCount + " ok (mid progress " + prog.toFixed(2) + ")")
  }
}
