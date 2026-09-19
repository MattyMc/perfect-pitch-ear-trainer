# The method and its evidence

This page explains what the app is training, what the published evidence supports, and how carefully claims should be worded. It is deliberately conservative. The app is a training tool for one procedure; it is not, by itself, evidence that a child has acquired absolute pitch.

## What the Eguchi chord identification method is

A young child (typically pre-school) hears a fixed piano chord and identifies it by an arbitrary label, traditionally a coloured flag. Chords are introduced one at a time, very slowly, over months. The child never learns note names during this phase; the colour *is* the identity. Practice happens in several very short daily sessions run by a parent at home. Only after all nine white-key chords are reliably identified does the child move to naming the component notes of each chord, and eventually to identifying isolated notes.

The app implements the first of those stages, colour identification of chords, for all 14 chords in the curriculum. It does **not** implement the note-naming stage. See [decision-log.md](decision-log.md) D-009 and [known-issues.md](known-issues.md).

## The published source

- Sakakibara, A. (2014). *A longitudinal study of the process of acquiring absolute pitch: A practical report of training with the "chord identification method".* Psychology of Music, 42(1), 86–111. DOI `10.1177/0305735612463948`. Published online 29 October 2012; version of record January 2014. Cite as Sakakibara (2014).
- Sakakibara, A. (1999). *A longitudinal study of a process for acquiring absolute pitch.* Japanese Journal of Educational Psychology, 47(1), 19–27. In Japanese; a single child trained for 19 months on the nine-chord task.

The 2014 paper was read in full on 10 September 2026 (the SAGE version of record, via the PDF linked from the parent guide) and the figures below are taken from it. Page numbers are the journal's.

### What the paper reports

| Claim in the parent guide | Paper | Status |
|---|---|---|
| 24 children aged 2 to 6 | 24 children, start ages 2y4m to 6y7m, mean 4y2m (p. 93, Table 2) | Confirmed |
| 22 completed; 2 dropped out | Two stopped "for personal reasons unrelated to the current project" (p. 95) | Confirmed |
| All 22 completers acquired absolute pitch | "all of the 22 young participants who completed the training acquired AP" (p. 99) | Confirmed |
| Criterion: isolated piano notes, no reference, 100% | 30 single piano tones, no feedback, 100% required (p. 89, 95) | Confirmed. "Near-perfect" is wrong; the criterion is 100%. |
| Notes "from C3 to B5" | Not in the paper. Figure 1 spans most of the piano compass with 8va and 16va markings. | **Contradicted.** Remove the range. |
| Training took 1.5 to 2 years | Nine white chords: mean 42 weeks (range 22–76). All 14 chords: mean 58 weeks (range 34–94). Eguchi's general guidance is about a year for white keys plus six months for black keys. Passing the single-note criterion test took much longer: mean about 4.5 years after starting, pass ages 5y5m to 14y8m, median about 8 years (Table 2). | **Misattributed.** 1.5 to 2 years describes the chord stages, not reaching the absolute-pitch criterion. |
| Maintenance until about age 9 | "a child has to continue this practice until he/she reaches the age of 9" (p. 91); frequency may drop to once a week | Confirmed |
| 4 to 5 daily sessions of 20 to 25 trials, about 100 a day, 2 to 5 minutes each, run by a family member at home | p. 90, 93 | Confirmed |
| No randomised control group | Single-arm longitudinal design; no comparison group anywhere | Confirmed |
| Plateau around five to seven chords | "the doldrums usually began after about five (to seven) chords" (p. 97); all but two children | Confirmed |
| After nine white chords, responses switch to tone names; later isolated notes | p. 92–93 | Confirmed. The app does not implement this stage. |

### What the paper says about the curriculum

Figure 2 and Table 1 give the nine white-key chords in exactly the app's order and voicing, with exactly the app's colours: CEG Red, CFA Yellow, BDG Blue, ACF Black, DGB Green, EGC Orange, FAC Purple, GBD Pink, GCE Brown. The colour mapping is described as arbitrary but identical for all participants. Figure 3 gives the five black-key chords in the app's order, all root position. Inversions of the black-key chords exist as an optional extension; all 22 completers finished without them.

The published labels are small coloured **flags** the child holds up while saying the colour, not cards. The black-key chords used white flags printed with tone names.

### What the paper says about advancement

- A new chord may be added no sooner than **two weeks** after the previous one (p. 90). The app's 14-day minimum is therefore a **reported method** rule, not an operational definition.
- The gate is **100% accuracy** on the current set, judged by the author from records submitted every two weeks (p. 90, 95). The paper never states "100 consecutive correct"; that figure is the app's operationalisation of "100%" and should be labelled as such. Since about 100 trials is one day's practice, it amounts to one perfect day.
- Reducing the chord count is allowed "as a last resort" when errors distress the child. The dashboard's "Step back one chord" matches this.

### Other points worth carrying into the guide

- Prior musical training (7 of 24 children) and starting age had no significant effect on training length (p. 95).
- Eguchi's own claims of over 1,000 children trained with more than 90% success are reported by the author as unverifiable because the data are unavailable (p. 89).
- The author's stated limits: the results may be specific to this method, and a genetic contribution to individual differences cannot be excluded (p. 101–102).

## Rule classification, applied

The four labels are defined in [README.md](README.md). Here is how the main rules in the current build classify:

| Rule | Classification | Notes |
|---|---|---|
| Fixed chord set, fixed voicings, fixed order, fixed colours | Reported method | Verified against Figures 2–3 and Table 1 of Sakakibara (2014). |
| Colour-only identity during chord training | Reported method | No note names reach the child. |
| Neutral correction: label, replay, required tap | Reported method | Fidelity to the procedure and to the child's wellbeing. |
| Parent-controlled advancement, never automatic | Reported method + product decision | The dashboard button is never gated. |
| ~100 trials/day as 4 sessions of 20 to 25 | Reported method + product default | Onboarding text says 25; config allows 20 or 25. |
| One active chord is unscored familiarisation | Operational definition | One visible card cannot test discrimination. |
| Balanced random bag, no three identical in a row | Operational definition | The publication does not prescribe ordering. |
| First answer is the scored answer | Scoring definition | Corrections never overwrite it. |
| Replay allowed and counted, not penalised | Operational definition | The publication does not prohibit replay. |
| 10-minute idle timeout ends a session | Operational definition | Separates a break from a new session. |
| Two weeks minimum at each level | Reported method | Sakakibara (2014) p. 90. Advisory only in the app. |
| 95% over the last 100 trials as the accuracy gate | Operational definition | The paper requires 100% on the current set. The dashboard's 95% is looser than the method. |
| Portrait lock, 72 px card floor, hold-to-exit | Interface aid | Do not change the auditory task. |
| Synthesised success chime after a correct answer | Interface aid, arguably a deviation | Positive audio feedback is not described in the method. Keep it neutral and short. |
| Score and percentage shown to the child at session end | Method deviation, unlabelled | See known-issues. The decision log says analytics are adult-only. |

## What mastery in this app does and does not mean

High accuracy on the colour task means the child reliably discriminates and labels these specific chords in this specific register and timbre. It does not show that the child can name isolated notes, that the skill transfers to another instrument, or that it will persist without maintenance. The app has no isolated-note assessment. Any such claim about a child needs a separate, hint-free assessment that this app does not provide.
