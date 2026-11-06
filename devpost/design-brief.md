---
status: final
---

# Design brief: Ink Ghost

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). Values changed after a design push-back are marked (adjusted). -->

Ink Ghost is a stroke-order tutor for people teaching themselves to handwrite Japanese (kana and kanji).

## The one spatial moment
I sit at a desk with a sheet of paper and a pen, looking down at the sheet. Just beyond my writing square, only the next stroke glows and animates in its writing direction; I copy it with my real pen, pinch once, and the following stroke glows.

## Why it belongs on glasses
- Uses: draws in the world (on the paper, real size) and leaves your body free (pen stays in hand, eyes stay on the sheet). It does not use "shares your view": the Lens never reads my handwriting.
- Why it's better than the phone or laptop version: the next stroke appears at real size on the paper, right beside where you write, so you keep the pen in your hand and your eyes on the sheet. A phone or laptop shows the stroke on a screen next to the paper, not on it.

## Product or overlay
- Type: overlay on a real sheet of paper.
- What the real version would sense: nothing. There is no recognition of what I wrote; I mark my own progress with a pinch, and I place the sheet by hand.
- Stand-in for the preview: a virtual desk and a virtual sheet stand in for the real ones. The virtual sheet is matte light grey, not pure white, so the strokes on it stay readable in the preview (adjusted; see Risks).

## Where things live
- Where the user is looking during the main task: down at the sheet on the desk, about 55 to 60 cm from the eyes, a little below eye level (at a desk this means looking down; the distances below govern).
- Desk (stand-in): real size, about 120 x 60 cm (default). Place it relative to where the preview camera starts, so the sheet centre is about 40 cm below the eyes and about 40 cm in front of them (default; about 57 cm away). The 55 to 60 cm eye-to-sheet distance matters more than the desk's height from the floor.
- Sheet (stand-in): A4 portrait, 21 x 29.7 cm (default), lying flat on the desk.
- Writing square: 10 x 10 cm (default), a thin light outline on the near half of the sheet. This is where I write with the real pen.
- Guide character: about 10 cm tall, just beyond the writing square on the same sheet (on the far side, away from me).
  - Lesson points map onto a 10 x 10 cm box (default): x = 0 is the left side, x = 1 the right side; y = 0 (the top of the character) is the side of the box farther from me, y = 1 the side nearer to me. Don't mirror or flip it.
- Progress row: small dots, about 1 cm (default), along the top (far) edge of the sheet, one dot per character in today's lesson.
- "Next stroke" target: about 6 cm, at the left edge of the sheet (adjusted: mirrored from the right edge, because most learners write right-handed and the free hand should do the pinching), level with the guide character (default).
- "Replay" target: smaller, about 4 cm (default), next to "Next stroke" on the side nearer to me (default).
- Nothing floats in front of my face. The sheet, the targets and the progress row all fit in one downward look (at 55 cm the usable view is about 23 x 38 cm).

## Hands and input
- Place the sheet: grab and drag it once. It slides flat on the desk; it can't be lifted or tilted (default). It locks in place with the first pinch on "Next stroke" (default).
- Next stroke: pinch the big "Next stroke" target. Each pinch advances exactly one step.
- Replay: pinch the smaller "Replay" target. It re-animates the current stroke without advancing.
- The free hand does the pinching; the pen stays in the writing hand. For a right-handed writer that is the left hand, which is why the targets sit at the left edge (adjusted).
- No custom gestures.
- Targets are big and highlight when aimed at.
- Voice (if any) and the button that does the same job: none.

## When things show
- Before I start a character: only a small dot on the sheet, where the guide character will appear (default).
- Flow for a character with n strokes: pinch 1 shows stroke 1; pinch k shows stroke k; pinch n + 1 completes the character (default).
- Current stroke: glows and animates once in its writing direction, about 1.2 s (default), with a direction arrow: an arrowhead rides the drawing tip and rests at the end of the stroke (default). It stays lit until the next pinch. It is the brightest, most saturated thing on the sheet.
- Earlier strokes: stay dim, shown as thinner lines in a calmer colour, but still clearly visible on the sheet; never faded toward invisible (adjusted; see Risks).
- Later strokes: hidden.
- After the last stroke: the whole character shows for two seconds with a check mark, then fades, and the next character's dot appears. Pinches during those two seconds are ignored (default), so a stroke is never skipped.
- Progress row: the current character's dot is highlighted; finished characters' dots are filled (default).
- After the lesson: a small card on the sheet, over the guide area (default), lists the characters practiced, then fades on a pinch on "Next stroke" (default).
- If something needs attention out of view: none. Everything stays on the sheet, inside the one downward look.

## Lesson data and credits
- Lesson file: `Assets/Lesson/lesson_basic_strokes.json`, already in the project. Five characters (一 十 日 本 永), each a list of strokes in correct stroke order, each stroke 24 points normalized 0..1 with y pointing down.
- Format: `{"source": ..., "license": ..., "coordinates": ..., "characters": [{"char": "永", "strokes": [[[x, y], ...], ...]}]}`. Stroke counts in this file: 一 1, 十 2, 日 4, 本 5, 永 5.
- The lesson file is the AI-facing interface: an AI agent or a script can regenerate it for any characters with `tools/strokes_from_kanjivg.py` in this repo, for example `python3 tools/strokes_from_kanjivg.py 永 学 あ --points 24 --out Assets/Lesson/lesson_basic_strokes.json`, and the Lens loads whatever lesson file is there.
- The Lens reads characters and strokes only from the lesson file. Nothing is hard-coded: any number of characters, any number of strokes per character (this file has 1 to 5; other characters have 10 or more), and any number of points per stroke.
- Credit: stroke data from KanjiVG (https://kanjivg.tagaini.net/), (c) Ulrich Apel, CC BY-SA 3.0, converted by `tools/strokes_from_kanjivg.py` in this repo. Disclose it as pre-existing work on Devpost.
- CC BY-SA is a share-alike license: treat the lesson file as derived from KanjiVG and keep it under CC BY-SA 3.0 with this credit, whatever license the rest of the repo uses. The file already carries `source` and `license` fields; keep them.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Place the sheet on the virtual desk with grab and drag; it stays in place while I walk around it.
2. Each pinch on "Next stroke" advances exactly one step of the flow in "When things show" (one stroke, or the completion after the last stroke), with strokes in the correct order (the lesson file's order) and the direction animation.
3. After the last stroke, the character shows complete with a check mark, and the next character's dot appears.
4. "Replay" re-animates the current stroke without advancing.
5. The lesson (five characters) loads from the JSON lesson file in the project: replace `lesson_basic_strokes.json` (same filename) with a file in the same format but other characters, restart the preview, and the new characters appear in the progress row and draw in their own order. This is what lets an AI agent or a script swap in a new lesson. (This one may have no LEAF test; check it by hand.)

## Out of scope
- Reading or checking my handwriting. There is no recognition.
- Choosing a lesson inside the Lens; swap the lesson file instead (default).
- Restarting the lesson without restarting the preview (default).
- Remembering progress between sessions.
- Hiding the virtual desk and sheet to use the Lens over real paper on glasses (default).

## Risks and open questions
- Drawing smooth strokes in Lens Studio. Fallback: a row of small spheres along each stroke.
- Writing distance (about 45 to 60 cm) is closer than the 0.6 to 1.6 m comfort range; keep the guide on the far part of the sheet. Comfort over time is unproven.
- Contrast on real white paper (adjusted): the glasses' display adds light, so faint or dim light on bright white paper washes out, and a faint light stroke on a white virtual sheet disappears in the preview too. This brief keeps the order of importance (current stroke strongest, earlier strokes quieter) but makes the quieter strokes thinner and calmer in colour instead of fainter, and makes the virtual sheet light grey. How it reads on real paper under a desk lamp is feel unproven.
- Pen grip and pinch: holding a pen puts thumb and index finger together, which hand tracking may read as a pinch. The targets now sit at the left edge (adjusted), on the free-hand side for a right-handed writer, away from the pen hand. Whether the pen hand still triggers false pinches is feel unproven; the preview's mouse can't show it.
- Decided: later strokes stay hidden, as in answer 6. Only the current stroke and earlier strokes show; the whole character appears only after the last stroke.
- Stroke data comes from KanjiVG (CC BY-SA 3.0, Ulrich Apel), converted by a small script; disclose it as pre-existing work.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
