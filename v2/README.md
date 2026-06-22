# 3D to 2D SVG V2

V2 is a standalone uploaded SVG edge-pair selection page for finger-joint cutting.

## Entry Point

Open `v2/index.html` from GitHub Pages or a local static server:

```text
/v2/
```

Remote page:

```text
https://panggihsieh.github.io/3Dto2D/v2/
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
- Preview the first selected edge immediately as convex `f`, then preview the completed `f/F` pair after the second edge.
- Click a pending edge or completed paired edge again to restore the original straight edge.
- Check each manual pair with Boxes.py-style finger count, length tolerance, and parameter warnings.
- Show the original uploaded SVG arrangement as a dashed source overlay after joinery is generated.
- Download cuboid and gable-roof house practice SVG files.
- Display English position labels for practice files, including `bottom`, `left`, `right`, `front`, `back`, `roof left`, and `roof right`.
- Generate a preview with finger-jointed polygon boundaries.
- Download the generated SVG or DXF.

## V2 Notes

- The first selected edge is always convex `f`; the second selected edge is concave `F`.
- A pending edge can be clicked again to cancel it. A completed paired edge can be clicked again to delete that pair.
- Manual pairing changes only the selected pair. It does not automatically apply all cube-net joinery.
- The built-in cube net can still use its known correct topology when no manual pairs exist and the cube flow is confirmed.
- Gable-roof practice SVG labels are intended for spatial matching practice. V2 preserves simple path `id` values and uses them to show labels again after import.
- Exported production SVG removes temporary edge overlays, source overlays, and preview labels.
- Browser download behavior differs by environment. V2 tries the native save picker first, then falls back to an on-page download link.

## SVG Support

The first V2 build supports:

- `polygon`
- `polyline`
- simple `path` data using `M`, `L`, `H`, `V`, and `Z`

Curves, complex transforms, and boolean-style SVG artwork should be expanded to straight polygon paths before import.
