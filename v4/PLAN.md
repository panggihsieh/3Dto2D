# V4 Gradient Laser Engraving Test Plan

## Goal

Create a standalone V4 workflow for generating 12 grayscale-separated SVG layers for gradient laser engraving tests.

The first target machine profile is FLUX 30W. The tool should also allow switching to 40W and 50W rated laser profiles for future calibration.

## Machine Power Profiles

Treat `30W`, `40W`, and `50W` as machine rated-power profiles, not as direct layer power values.

Default profile:

- Machine: FLUX
- Rated power: 30W
- Layer count: 12
- Engraving power range: 8% to 40%

Selectable profiles:

- FLUX 30W
- FLUX 40W
- FLUX 50W

## 12-Layer Gradient Power Table

For the default 30W profile, generate 12 layers from light to dark. The suggested engraving power is evenly distributed from 8% to 40%.

| Layer | Tone | Suggested power |
| --- | --- | --- |
| L01 | Lightest | 8.0% |
| L02 |  | 10.9% |
| L03 |  | 13.8% |
| L04 |  | 16.7% |
| L05 |  | 19.6% |
| L06 |  | 22.5% |
| L07 |  | 25.5% |
| L08 |  | 28.4% |
| L09 |  | 31.3% |
| L10 |  | 34.2% |
| L11 |  | 37.1% |
| L12 | Darkest | 40.0% |

Estimated optical power can be shown as a reference only:

```text
estimated watts = rated machine watts * suggested power percent / 100
```

For a 30W machine, the 8% to 40% range corresponds to about 2.4W to 12.0W estimated output. Actual engraving behavior must be calibrated by material, speed, focus, lens condition, and beam alignment.

## SVG Layer Metadata

Each exported SVG layer should include:

- Layer id: `L01` through `L12`
- Tone range: light to dark grayscale threshold band
- Machine profile: `FLUX 30W`, `FLUX 40W`, or `FLUX 50W`
- Suggested power percent
- Estimated watts as reference
- Calibration note: verify with real FLUX beamo material tests before production

Example layer naming:

```text
L01_lightest_power_8.0pct_flux_30w
L12_darkest_power_40.0pct_flux_30w
```

## Trace Strategy

Start with a browser-only grayscale separation workflow:

1. Load bitmap into Canvas.
2. Convert pixels to grayscale.
3. Split grayscale values into 12 threshold bands.
4. Generate one SVG group per band.
5. Export a layered SVG for FLUX software or Inkscape inspection.

Bitmap trace quality can be improved later with Potrace-style path fitting if the first browser-only contour output is too jagged.

## Verification

- Default profile is FLUX 30W.
- 40W and 50W profiles are selectable.
- The 12 layers recalculate their estimated watts when the rated profile changes.
- The suggested power percent table remains 8% to 40% unless the user changes the engraving range.
- Exported SVG contains 12 named layers and machine/power metadata.
