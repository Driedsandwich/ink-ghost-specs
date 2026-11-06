import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { createIKInteractor } from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import { DiagnosticRecorder } from "Leaf.lspkg/Diagnostic/DiagnosticRecorder"
import { getController, getInteractable, waitUntil } from "./InkGhostTestUtils"

/**
 * Reachability (supports criteria 2 and 4): a simulated arm, using the free left hand,
 * reaches and pinches the Next stroke and Replay targets on the sheet from where the
 * user sits. Any reach diagnostic error (out of reach, behind, out of view) fails the run.
 */
@component
export class InkGhostReachIKScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const ik = createIKInteractor()
    await ik.ready

    await ik.trigger(getInteractable("NextStrokeButton"), "left")
    await waitUntil(() => c.step === 1, 5000, "IK pinch on Next stroke")
    await waitUntil(() => !c.isAnimating, 3000, "stroke drawn")
    const r0 = c.replayCount
    await ik.trigger(getInteractable("ReplayButton"), "left")
    await waitUntil(() => c.replayCount === r0 + 1, 5000, "IK pinch on Replay")
    expect(c.step).toBe(1)

    const recorder = DiagnosticRecorder.getInstance()
    const report = recorder.toReport()
    print("[InkGhostTest] IK diagnostics: " + (report === "" ? "none" : report))
    expect(recorder.hasErrors()).toBe(false)
  }
}
