---
name: boxes-finger-joints
description: Design, calculate, and review laser-cut finger joints using Boxes.py-style formulas. Use when Codex needs to size tabs, slots, T-joint holes, kerf/burn compensation, play/fit tolerance, or produce a workflow/checklist for press-fit laser-cut box joints based on material thickness and edge length.
---

# Boxes Finger Joints

## Quick Use

Use this skill to design or check laser-cut finger joints inspired by `florianfesti/boxes`.

If the user provides dimensions, calculate the layout directly. If important inputs are missing, make conservative defaults and state them:

- `thickness`: required when possible; measure the real sheet, not the nominal value.
- `length`: required for a concrete layout.
- `finger`: default `2 * thickness`.
- `space`: default `2 * thickness`.
- `surroundingspaces`: default `2.0`.
- `play`: default `0`.
- `burn`: default unknown; ask for machine/material data or suggest a burn test.

For deterministic calculations, run:

```bash
python scripts/finger_joint_calc.py --thickness 3 --length 100 --burn 0.08
```

## Workflow

1. Confirm the use case: 90-degree outside corner, T-joint/interior divider holes, or flat dovetail-like joining.
2. Measure actual material thickness `t`; do not rely on nominal plywood/acrylic thickness.
3. Estimate or test laser kerf. In Boxes.py terms, `burn ~= kerf_width / 2`.
4. Pick base proportions:
   - Use `finger = 2t` and `space = 2t` for the default Boxes.py look.
   - Use wider fingers for stronger, chunkier joints.
   - Use narrower fingers only if the material and laser accuracy justify it.
5. Calculate finger count and leftover end margin.
6. Apply fit intent:
   - Wood/plywood press fit: increase `burn` in small steps for tighter fit.
   - Acrylic/brittle materials: prefer looser fit; avoid forced assembly.
   - Removable joints: add `play`.
7. Output a compact cut checklist: thickness, burn, finger count, finger width, gap width, end margin, slot/hole size, and test-cut advice.

## Core Formulas

Let:

- `t` = material thickness
- `L` = edge length
- `s` = space between fingers
- `f` = finger width
- `C` = `surroundingspaces`, default `2.0`
- `p` = `play`
- `e` = `extra_length`
- `B` = `burn`

Finger count:

```text
N = floor((L - (C - 1) * s) / (s + f))
```

If `N == 0` but the edge is still long enough for a small joint, Boxes.py may use one small rectangular finger.

Leftover edge length:

```text
leftover = L - N * (s + f) + s
end_margin = leftover / 2
```

Nominal sequence:

```text
end_margin, finger, space, finger, space, ..., finger, end_margin
```

For the opposing side, Boxes.py applies `play` by widening fingers and shrinking spaces:

```text
f_opposite = f + p
s_opposite = s - p
leftover_opposite = leftover - p
```

For 90-degree corner joints:

```text
finger_length = t + e
```

For T-joint holes:

```text
hole_center_x_i = end_margin + i * (s + f) + f / 2
hole_width = f + p
hole_height = t + p
```

Use `width` instead of `t` for hole height when matching Boxes.py `FingerJointSettings.width`.

## Burn And Fit Rules

In Boxes.py, `burn` is the distance the laser path is offset from the intended part edge. It is approximately half the real kerf width.

Important behavior:

- Larger `burn` makes finger joints tighter.
- Smaller `burn` makes joints looser.
- Tune in small steps: `0.01 mm` or `0.005 mm` can matter.
- To estimate `burn`, cut a known rectangle and measure the size error; start near half the measured difference.
- If the downstream CAM tool applies kerf compensation, set Boxes.py-style `burn` to `0` and avoid double compensation.

## Output Pattern

When answering a user, prefer this structure:

```text
Assumptions
- thickness: ...
- edge length: ...
- burn: ...
- fit intent: ...

Calculated layout
- fingers: ...
- finger width: ...
- space: ...
- end margin: ...
- finger length: ...
- T-slot size, if needed: ...

Cutting advice
- first test cut ...
- adjust burn/play ...
```

Keep the explanation short unless the user asks for derivation.

## Source Notes

This skill is based on the public Boxes.py behavior documented in:

- https://github.com/florianfesti/boxes
- https://florianfesti.github.io/boxes/html/api_edges.html
- https://florianfesti.github.io/boxes/html/usermanual.html
- https://florianfesti.github.io/boxes/html/api_burn.html
