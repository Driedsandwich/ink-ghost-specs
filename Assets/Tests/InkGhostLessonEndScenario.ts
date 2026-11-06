import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { getController, getEndCard, getInteractable, describe, waitUntil } from "./InkGhostTestUtils"

/**
 * "After the lesson" (When things show): once every character is done, a card over the
 * guide area lists the practiced characters (drawn from the lesson strokes), every progress
 * dot is filled, and the next pinch on Next stroke fades the card. Later pinches do nothing.
 */
@component
export class InkGhostLessonEndScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const card = getEndCard()
    const next = getInteractable("NextStrokeButton")
    const ix = new DefaultLeafInteractor()
    const total = c.lessonChars.length
    expect(card.isShown).toBe(false)

    for (let ci = 0; ci < total; ci++) {
      await waitUntil(() => c.phase === "idle" && c.charIndex === ci, 5000, "character " + ci + " ready")
      const n = c.strokeCount
      for (let k = 0; k <= n; k++) {
        await ix.trigger(next)
        await sleep(120)
      }
    }
    await waitUntil(() => c.phase === "lessonDone", 5000, "lesson done")
    print("[InkGhostTest] lesson end: " + describe(c) + " dots=" + c.progressDotStates.join(","))
    expect(card.isShown).toBe(true)
    // Counts from an independent read of the lesson file.
    const file = JSON.parse(c.lesson.getString())
    let totalStrokes = 0
    for (const ch of file.characters) {
      totalStrokes += ch.strokes.length
    }
    expect(card.characterCount).toBe(file.characters.length)
    expect(card.glyphCount).toBe(totalStrokes)
    for (const s of c.progressDotStates) {
      expect(s).toBe("done")
    }

    await ix.trigger(next)
    await waitUntil(() => c.phase === "cardDismissed", 3000, "card to fade")
    expect(card.isShown).toBe(false)
    const ignored = c.ignoredPinchCount
    await ix.trigger(next)
    await sleep(200)
    expect(c.ignoredPinchCount - ignored).toBe(1)
    expect(c.phase).toBe("cardDismissed")
  }
}
