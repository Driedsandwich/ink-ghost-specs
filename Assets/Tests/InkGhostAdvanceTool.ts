import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { getController, getInteractable, describe, waitUntil } from "./InkGhostTestUtils"

/**
 * Not a test: a helper that pinches Next stroke `pinches` times (waiting out completion
 * windows) and leaves the Lens in that state, for screenshots and for recording the demo.
 * Example: pinches = 13 stops at the third stroke of the fourth character in the default lesson.
 */
@component
export class InkGhostAdvanceTool extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    await sleep(1500)
    const c = getController()
    const next = getInteractable("NextStrokeButton")
    const ix = new DefaultLeafInteractor()
    const pinches = config ? config.getNumber("pinches") || 0 : 0
    const gapMs = config ? config.getNumber("gapMs") || 150 : 150
    for (let i = 0; i < pinches; i++) {
      if (c.phase === "complete") {
        await waitUntil(() => c.phase !== "complete", 5000, "completion window")
      }
      await ix.trigger(next)
      await sleep(gapMs)
    }
    print("[InkGhostTest] advance tool stopped at " + describe(c))
  }
}
