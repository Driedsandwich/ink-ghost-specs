import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { getController, getInteractable, describe } from "./InkGhostTestUtils"

/**
 * Smoke test of the basic flow: the lesson loads, one pinch on Next stroke shows
 * the first stroke of the first character, the next pinch completes it, and after
 * the completion window the second character starts.
 */
@component
export class InkGhostSmokeScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const next = getInteractable("NextStrokeButton")
    const interactor = new DefaultLeafInteractor()

    expect(c.lessonChars.length > 0).toBe(true)
    expect(c.charIndex).toBe(0)
    expect(c.step).toBe(0)
    print("[InkGhostTest] smoke start " + describe(c))

    const n = c.strokeCount
    for (let k = 1; k <= n; k++) {
      await interactor.trigger(next)
      await sleep(300)
      print("[InkGhostTest] after pinch " + k + ": " + describe(c))
      expect(c.step).toBe(k)
      expect(c.phase).toBe("stroke")
    }
    await interactor.trigger(next)
    await sleep(300)
    expect(c.phase).toBe("complete")
    await sleep(2600)
    print("[InkGhostTest] after completion window: " + describe(c))
    expect(c.charIndex).toBe(1)
    if (c.lessonChars.length > 1) {
      expect(c.phase).toBe("idle")
      expect(c.step).toBe(0)
    } else {
      expect(c.phase).toBe("lessonDone")
    }
  }
}
