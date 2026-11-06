import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { findSceneObjectByName, hasAncestorWithName, sleep } from "Leaf.lspkg/Utils/common/Utils"
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { getController, getInteractable } from "./InkGhostTestUtils"

/**
 * Done criterion 1: place the sheet on the virtual desk with grab and drag; it stays in place.
 * - A drag moves the sheet in the desk plane only (height and tilt unchanged).
 * - The pinch targets move with the sheet.
 * - The sheet is world-anchored (not under the camera) and does not drift.
 * - The first pinch on Next stroke locks it: a later drag does not move it.
 * Walking around it with the preview camera is checked outside LEAF (MovePreviewCamera).
 */
@component
export class InkGhostC1PlaceSheetScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const sheet = findSceneObjectByName("StandIn_Sheet")
    const st = sheet.getTransform()
    const targets = findSceneObjectByName("Targets").getTransform()
    const sheetHandle = getInteractable("StandIn_Sheet")
    const ix = new DefaultLeafInteractor()

    expect(c.sheetLocked).toBe(false)
    expect(hasAncestorWithName(sheet, "Camera Object")).toBe(false)
    const p0 = st.getWorldPosition()
    const t0 = targets.getWorldPosition()

    // Drag with a vertical component too: the sheet must stay flat on the desk.
    await ix.drag(sheetHandle, new vec3(0.25, 0.2, 0.15), 600)
    await sleep(400)
    const p1 = st.getWorldPosition()
    const t1 = targets.getWorldPosition()
    const planar = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.z - p0.z, 2))
    print("[InkGhostTest] C1 drag moved the sheet " + planar.toFixed(2) + " cm in the desk plane; dy=" + (p1.y - p0.y).toFixed(3))
    expect(planar > 1).toBe(true)
    expect(Math.abs(p1.y - p0.y) < 0.01).toBe(true)
    const rot = st.getWorldRotation()
    expect(Math.abs(Math.abs(rot.w) - 1) < 0.0001).toBe(true)
    // The pinch targets travel with the sheet.
    expect(t1.sub(t0).distance(p1.sub(p0)) < 0.05).toBe(true)

    // Stays in place on its own (world-anchored, no drift).
    await sleep(1000)
    expect(st.getWorldPosition().distance(p1) < 0.01).toBe(true)

    // First pinch on Next stroke locks the sheet and shows stroke 1.
    await ix.trigger(getInteractable("NextStrokeButton"))
    await sleep(300)
    expect(c.sheetLocked).toBe(true)
    expect(c.step).toBe(1)
    const p2 = st.getWorldPosition()
    await ix.drag(sheetHandle, new vec3(0.25, 0, 0.15), 600)
    await sleep(400)
    const p3 = st.getWorldPosition()
    print("[InkGhostTest] C1 drag after lock moved the sheet " + p3.distance(p2).toFixed(3) + " cm")
    expect(p3.distance(p2) < 0.01).toBe(true)
  }
}
