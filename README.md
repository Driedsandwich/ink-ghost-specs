# Ink Ghost

Ink Ghost is a stroke-order tutor for people teaching themselves to handwrite Japanese kana and kanji. It is a Lens for Snap's SPECS AR glasses, designed to show the next stroke on the paper, just beyond the learner's writing square, so the pen stays in the writing hand and the eyes stay on the sheet. This build runs in Lens Studio's preview, where a virtual desk and a light-grey virtual sheet stand in for real ones. No SPECS glasses were used. The Lens never reads the learner's handwriting.

It was made for the Devpost hackathon "Learn AR with SPECS": planned with the Devpost Learn skill pack's `plan-lens` skill, then built by a coding agent (Claude Code) through the CLAD plugin, Lens Studio, and the Lens Studio MCP.

## Open and run in Lens Studio

1. Install Lens Studio 5.23.2 (the version the hackathon recommends).
2. Clone this repository and open `Specs Base Template.esproj` in Lens Studio. (The project keeps the name of the SPECS Base Template it started from.)
3. Wait until the TypeScript Status panel shows that compilation succeeded. The Preview panel then shows the virtual desk and sheet.
4. In the preview the content sits below eye level, on the desk. Look down at the sheet to see the dot, the guide area, and the two targets at the sheet's left edge.

## Preview controls

In Interactive Preview, WASD moves, Q and E go down and up, and right-drag (or holding Shift) looks around; clicking acts as a pinch (these are the preview's standard controls). The LEAF tests drive the same interactions with simulated hands.

| Action | Result |
|---|---|
| Drag the sheet before starting | Moves the sheet flat along the virtual desk. |
| Pinch **Next stroke** for the first time | Locks the sheet in place and reveals the first stroke. |
| Pinch **Next stroke** during a character | Reveals the next stroke and animates it once in its writing direction, with an arrowhead, over about 1.2 seconds. |
| Pinch **Replay** while a stroke is shown | Re-animates the current stroke without advancing. |
| Pinch during the completion display | Ignored during the two-second whole-character display with its check mark, so no stroke is ever skipped. |

Earlier strokes stay visible as thinner ribbons in a calmer colour. Later strokes stay hidden. After the completion display, the character fades and the next character's starting dot appears. After the lesson, a small card on the sheet lists the characters practised; the next pinch on Next stroke fades it.

Both targets sit at the sheet's left edge, so a right-handed writer can pinch with the free hand. The buttons live on a separate scene branch that follows the sheet: as children of the draggable sheet, pinching a button also grabbed the sheet.

The first lesson contains:

| Character | Strokes |
|---|---|
| 一 | 1 |
| 十 | 2 |
| 日 | 4 |
| 本 | 5 |
| 永 | 5 |
| Total | 17 |

## Swap the lesson: the AI-facing interface

The Lens reads every character and stroke from one file:

```
Assets/Lesson/lesson_basic_strokes.json
```

No characters are hard-coded in the Lens. An AI agent or a script can write a new lesson, and the Lens loads whatever lesson file is there.

Make a lesson from any characters with the converter (Python 3, standard library only; it downloads each character's SVG from the KanjiVG repository on GitHub and caches it in `tools/_kanjivg_cache/`):

```
python3 tools/strokes_from_kanjivg.py 永 学 あ --points 24 --out /tmp/new_lesson.json
mv /tmp/new_lesson.json Assets/Lesson/lesson_basic_strokes.json
python3 tools/strokes_from_kanjivg.py --selftest   # checks known stroke counts
```

Format:

```
{"source": "KanjiVG (https://kanjivg.tagaini.net/)",
 "license": "CC BY-SA 3.0 (c) Ulrich Apel",
 "coordinates": "normalized 0..1, y down, from 109x109 viewBox",
 "characters": [{"char": "永", "strokes": [[[x, y], ...], ...]}]}
```

Strokes are listed in stroke order; each stroke is a list of points from its start to its end. Any number of characters, strokes, and points per stroke is accepted.

Reloading: write the new lesson to a temporary file and move it over `lesson_basic_strokes.json` (same name), as above, then restart the preview (or reopen the project). In the build session, overwriting the file in place was not picked up for over a minute, while replacing it with a move and recompiling was; which of the two made the difference was not isolated.

A manual check replaced the lesson with 山, あ, 書 (3, 3 and 10 strokes): it loaded and drew correctly.

For the demo video, a second lesson was made the same way for 愛 (love), 忍 (endurance) and 夢 (dream), 13, 7 and 13 strokes, and recorded in the preview with no code changes. That file is kept in `examples/lesson_love_nin_dream.json` (same format and license); the lesson in `Assets/Lesson/` was put back afterwards.

## Tests (LEAF)

The LEAF scenarios are in `Assets/Tests` and run in the preview (LEAF 2.0.2). Run them from the LEAF panel in Lens Studio, or ask a coding agent to run them through the Lens Studio MCP. The results appear in the Lens Studio log as `PASSED:` lines.

| Scenario | What it checks | Recorded result |
|---|---|---|
| `c1-place-sheet` | The sheet moves flat on the desk (3.89 cm in the test), then locks on the first Next pinch | Passed |
| `c1-walk-around` | The camera moves up to 110 cm over 3,195 frames; the sheet moves 0.0000 cm | Passed |
| `c2-stroke-order` | All 17 strokes of the five characters, in order and in their writing direction; the drawing tip stays on the guide line | Passed |
| `c3-completion` | The check mark, and pinches ignored during the completion display | Passed |
| `c4-replay` | Replay re-animates without advancing | Passed |
| `lesson-end-card`, `reach-ik`, `inkghost-smoke` | End card, reach with a simulated left arm, a quick end-to-end run | Passed |
| `tool-advance` | Not a test: pinches Next a given number of times, for screenshots and demo recording | — |

The stroke-order test was checked to be able to fail: turning the guide 180 degrees made it fail.

These results establish behaviour in the preview. They do not establish readability, comfort, or tracking on real glasses.

## Project structure

| Path | Purpose |
|---|---|
| `devpost/design-brief.md` | Design brief written with the Devpost Learn skill pack's `plan-lens` skill |
| `Assets/Lesson/lesson_basic_strokes.json` | Lesson characters and stroke data |
| `Assets/Scripts/` | Six TypeScript scripts: `InkGhostController`, `StrokeRibbon` (strokes drawn as ribbons), the targets UI, the end-card UI, and two small helpers (`ShapeMesh`, `StandInBox`) |
| `Assets/Tests/` | LEAF scenarios and their helpers |
| `tools/strokes_from_kanjivg.py` | Converts characters into a lesson file using KanjiVG |

The end card draws its characters from the stroke data instead of a font.

## What still needs real glasses

No SPECS glasses were used. These remain unproven:

- Readability on real white paper under a desk lamp. The preview sheet is light grey because the glasses' display is additive (light adds to the scene) and faint light on white washes out; earlier strokes are thinner and calmer instead of fainter for the same reason.
- Comfort over time at a 45 to 60 cm writing distance, closer than the 0.6 to 1.6 m comfort range.
- Whether holding a pen triggers false pinches.
- Real hand tracking.

## Credits, licenses, and pre-existing work

- Stroke data: [KanjiVG](https://kanjivg.tagaini.net/), copyright Ulrich Apel, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). `Assets/Lesson/lesson_basic_strokes.json` and `examples/lesson_love_nin_dream.json` are converted from it by `tools/strokes_from_kanjivg.py` and stay under CC BY-SA 3.0 with this credit.
- Pre-existing work used as is: the Lens Studio SPECS Base Template, Spectacles Interaction Kit and UI Kit (from the template), and the LEAF package (2.0.2) with its dependency Bitmoji 3D (installed from Lens Studio's Asset Library), used under the terms that apply to Lens Studio and its packages; and the SimpleVertexBaseColor material that ships with the ls-clad plugin (Apache-2.0).
- The `plan-lens` skill in `.claude/skills/` is from the Devpost Learn skill pack ([challengepost/learn-specs](https://github.com/challengepost/learn-specs), MIT, copyright 2026 Devpost; its license is in `.claude/skills/plan-lens/LICENSE`).
- Everything else in `Assets/Scripts`, `Assets/Tests`, and `tools/` was written for this project during the hackathon and is released under the MIT License (see `LICENSE`).
