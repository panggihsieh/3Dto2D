# V4 Beam Studio Gradient Layers

V4 is a standalone browser tool for preparing FLUX Beam Studio friendly grayscale engraving test files.

Open:

```text
https://panggihsieh.github.io/3Dto2D/v4/
```

## Workflow

1. Upload a bitmap image.
2. Choose a FLUX rated-power profile:
   - FLUX 30W
   - FLUX 40W
   - FLUX 50W
3. Keep or adjust the suggested engraving power range.
4. Download:
   - A 12-color / 12-layer SVG.
   - A CSV Beam Studio power table.

## Beam Studio Import

Prefer importing the exported SVG by color in Beam Studio.

Each layer uses a fixed color and a readable layer name such as:

```text
L01_lightest_color_0072b2_8p0pct_FLUX_30W
L12_darkest_color_000000_40p0pct_FLUX_30W
```

Beam Studio may preserve SVG layer names, but automatic power assignment from SVG names or metadata should not be assumed. Use the exported CSV table to set the matching color layers in Beam Studio.

## Default Power Profile

Default profile:

- Machine: FLUX 30W
- Layers: 12
- Suggested power range: 8% to 40%

The estimated watt value is only a reference:

```text
estimated watts = rated machine watts * suggested power percent / 100
```

Always calibrate on real material before production.
