import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import { InkGhostSmokeScenario } from "./InkGhostSmokeScenario"
import { InkGhostC1PlaceSheetScenario } from "./InkGhostC1PlaceSheetScenario"
import { InkGhostC1WalkAroundScenario } from "./InkGhostC1WalkAroundScenario"
import { InkGhostC2StrokeOrderScenario } from "./InkGhostC2StrokeOrderScenario"
import { InkGhostC3CompletionScenario } from "./InkGhostC3CompletionScenario"
import { InkGhostC4ReplayScenario } from "./InkGhostC4ReplayScenario"
import { InkGhostLessonEndScenario } from "./InkGhostLessonEndScenario"
import { InkGhostReachIKScenario } from "./InkGhostReachIKScenario"
import { InkGhostAdvanceTool } from "./InkGhostAdvanceTool"

/** Registers the Ink Ghost LEAF scenarios with the LEAF plugin (one per done criterion, plus extras). */
@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    { id: "inkghost-smoke", typename: InkGhostSmokeScenario.getTypeName() },
    { id: "c1-place-sheet", typename: InkGhostC1PlaceSheetScenario.getTypeName() },
    // Needs the preview camera to be moved around the desk while it runs (MovePreviewCamera or WASD).
    { id: "c1-walk-around", typename: InkGhostC1WalkAroundScenario.getTypeName(), parameters: { seconds: "20", minCameraTravelCm: "30" } },
    { id: "c2-stroke-order", typename: InkGhostC2StrokeOrderScenario.getTypeName() },
    { id: "c3-completion", typename: InkGhostC3CompletionScenario.getTypeName() },
    { id: "c4-replay", typename: InkGhostC4ReplayScenario.getTypeName() },
    { id: "lesson-end-card", typename: InkGhostLessonEndScenario.getTypeName() },
    { id: "reach-ik", typename: InkGhostReachIKScenario.getTypeName() },
    // Not a test: advances the lesson by N pinches and stops (for screenshots / demo recording).
    { id: "tool-advance", typename: InkGhostAdvanceTool.getTypeName(), parameters: { pinches: "0", gapMs: "150" } },
  ]
}
