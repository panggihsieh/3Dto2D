# 3D to 2D SVG V2

V2 is a standalone uploaded SVG edge-pair selection page for finger-joint cutting.

## Entry Point

Open `v2/index.html` from GitHub Pages or a local static server:

```text
/v2/
```

## V2 Features

- Import simple SVG polygons.
- Use a default cube net for edge-pair testing.
- Keep the V1 model selector out of the V2 interface.
- Preserve unfolded shape positions while inserting small gaps for reliable edge picking.
- Use the 3D bottom face as the center of the default cube net.
- Select one pair of polygon edges for complementary `f/F` joinery.
- Show selected edge pairs with distinct colors, up to 48 pairs.
- Play distinct tones for convex `f` and concave `F` edge selection.
- Show the original uploaded SVG arrangement as a dashed source overlay after joinery is generated.
- Generate a preview with finger-jointed polygon boundaries.
- Download the generated SVG.

## SVG Support

The first V2 build supports:

- `polygon`
- `polyline`
- simple `path` data using `M`, `L`, `H`, `V`, and `Z`

Curves, complex transforms, and boolean-style SVG artwork should be expanded to straight polygon paths before import.
