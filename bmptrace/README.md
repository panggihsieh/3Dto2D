# BMPTrace Beam Studio Gradient Layers

BMPTrace is a standalone browser tool for preparing FLUX Beam Studio friendly grayscale engraving test files.

Open:

```text
https://panggihsieh.github.io/3Dto2D/bmptrace/
```

## Workflow

1. Upload a bitmap image.
   - Or click the built-in tiger sample image.
2. Choose a FLUX rated-power profile:
   - FLUX 30W
   - FLUX 40W
   - FLUX 50W
3. Keep or adjust the suggested engraving power range.
4. Download:
   - A 5-grayscale-fill / 5-layer SVG.
   - A CSV Beam Studio power table.

## Output Modes

- Fast rectangular layers: stable browser-only output using sampled pixel runs.
- Smooth trace layers: browser-only bitmap trace using vendored ImageTracerJS. This follows the Inkscape-style Multiple Scans / Grayscale workflow with 5 scans by default, matching the current tiger.svg reference more closely. It does not require installing Inkscape, Potrace, Node.js, or Python on the user's computer.
- Inkscape CLI mode: planned high-quality trace mode. The user machine or server must have Inkscape installed, and a local helper or backend service is required because a static browser page cannot directly launch `inkscape`.

Smooth trace mode is better for softer outlines, while fast rectangular mode is more predictable for dense photo-style engraving tests.

Default bitmap trace settings:

- Scan mode: Grayscale
- Scans: 5
- Smooth: enabled
- Remove background: enabled
- Speckles: 2
- Smooth corners: 1.00
- Optimize: 0.200

Official Inkscape download page:

```text
https://inkscape.org/release/
```

Optional local helper for checking the installed Inkscape path:

```powershell
node bmptrace/helper/inkscape-helper.js
```

The BMPTrace page checks `http://127.0.0.1:4175/status` on load. If the helper is running and Inkscape is installed in a known location, the page shows the detected `inkscape.exe` path. If not, it prompts the user to install Inkscape or start the helper.

## Beam Studio Import

Prefer importing the exported SVG by color in Beam Studio. The colors are grayscale fills, matching the Inkscape Multiple Scans / Grayscale workflow more closely than the earlier color-swatch output.

Each layer uses a fixed grayscale fill and a readable layer name such as:

```text
L01_lightest_gray_b3b3b3_8p0pct_FLUX_30W
L05_darkest_gray_1d1d1d_40p0pct_FLUX_30W
```

Beam Studio may preserve SVG layer names, but automatic power assignment from SVG names or metadata should not be assumed. Use the exported CSV table to set the matching grayscale layers in Beam Studio.

## GitHub Actions Batch Trace

For higher-quality batch output, run the `BMPTrace Batch High Quality Trace` workflow in GitHub Actions.

The workflow:

- Installs Inkscape, Potrace, and Pillow on the GitHub runner.
- Accepts a repo image path such as `bmptrace/assets/sample.png`.
- Generates a 5-layer grayscale traced SVG.
- Generates a Beam Studio power CSV.
- Uploads both files as a workflow artifact.

Note: Inkscape's GUI Trace Bitmap panel is not reliably exposed as a CLI action. The batch workflow uses Potrace for the actual layer tracing and Inkscape for SVG rasterization or inspection support.

## Local Potrace Install

Potrace is optional for the current browser preview, but it is the recommended local dependency for future high-quality export that is closer to Inkscape Trace Bitmap.

The BMPTrace page provides Windows, macOS, and Ubuntu buttons that copy these commands to the clipboard. Browsers cannot safely execute installer commands directly; paste the copied command into PowerShell or Terminal.

Windows PowerShell:

```powershell
winget search potrace
winget install --id <package-id-from-search>
potrace --version
```

If winget does not list Potrace, download it from the official site and add the folder containing `potrace.exe` to `PATH`:

```text
https://potrace.sourceforge.net/
```

macOS:

```sh
brew install potrace
potrace --version
```

Ubuntu / Debian:

```sh
sudo apt update
sudo apt install potrace
potrace --version
```

## Default Power Profile

Default profile:

- Machine: FLUX 30W
- Layers: 5
- Suggested power range: 8% to 40%

The estimated watt value is only a reference:

```text
estimated watts = rated machine watts * suggested power percent / 100
```

Always calibrate on real material before production.
