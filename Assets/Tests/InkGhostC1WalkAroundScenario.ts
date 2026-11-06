import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { findSceneObjectByName, nextFrame, sleep } from "Leaf.lspkg/Utils/common/Utils"
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { getController, getInteractable } from "./InkGhostTestUtils"

/**
 * Done criterion 1, second half: the placed sheet stays in place while I walk around it.
 * Places and locks the sheet, then samples the sheet and the camera every frame for
 * `seconds` while the preview camera is moved around the desk (driven from outside the
 * Lens, e.g. MovePreviewCamera or WASD). Passes only if the camera really moved and the
 * sheet never did.
 */
@component
export class InkGhostC1WalkAroundScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    await sleep(1500)
    const c = getController()
    const ix = new DefaultLeafInteractor()
    const seconds = config ? config.getNumber("seconds") || 20 : 20
    const minCameraTravel = config ? config.getNumber("minCameraTravelCm") || 30 : 30

    await ix.drag(getInteractable("StandIn_Sheet"), new vec3(0.2, 0, 0.1), 400)
    await sleep(300)
    await ix.trigger(getInteractable("NextStrokeButton"))
    await sleep(300)
    expect(c.sheetLocked).toBe(true)

    const sheet = findSceneObjectByName("StandIn_Sheet").getTransform()
    const camera = findSceneObjectByName("Camera Object").getTransform()
    const s0 = sheet.getWorldPosition()
    const c0 = camera.getWorldPosition()
    let maxSheet = 0
    let maxCamera = 0
    let frames = 0
    const start = getTime()
    print("[InkGhostTest] C1 walk: sampling for " + seconds + " s; move the preview camera now")
    while (getTime() - start < seconds) {
      maxSheet = Math.max(maxSheet, sheet.getWorldPosition().distance(s0))
      maxCamera = Math.max(maxCamera, camera.getWorldPosition().distance(c0))
      frames++
      await nextFrame()
    }
    print("[InkGhostTest] C1 walk: frames=" + frames + " camera moved up to " + maxCamera.toFixed(1) + " cm, sheet moved up to " + maxSheet.toFixed(4) + " cm")
    expect(maxCamera >= minCameraTravel).toBe(true)
    expect(maxSheet < 0.01).toBe(true)
  }
}
