# 3D to 2D SVG Interlock

Interlock is based on the standalone Joint SVG edge-pair selection page, with inner-dimension guided convex/concave joinery.

## Entry Point

Open `interlock/index.html` from a local static server:

```text
/interlock/
```

Remote page:

```text
https://panggihsieh.github.io/3Dto2D/joint/
```

## Interlock Features

- Import simple SVG polygons.
- Use a default cube net for edge-pair testing.
- Keep the V1 model selector out of the joint interface.
- Preserve unfolded shape positions while inserting small gaps for reliable edge picking.
- Use the 3D bottom face as the center of the default cube net.
- Select one pair of polygon edges for complementary `f/F` joinery.
- Convert the imported inner-dimension geometry to black source lines.
- Offset inner geometry outward by the material thickness to create gray reference lines.
- Treat each matching black source edge and gray offset edge as a joinery unit.
- Show selected edge pairs with distinct colors, up to 48 pairs.
- Play distinct tones for convex `f` and concave `F` edge selection.
- Preview the first selected edge immediately as convex `f` from the black inner line to the gray reference line.
- Preview the second selected edge as concave `F` from the gray reference line back to the black inner line.
- Click a pending edge or completed paired edge again to restore the original straight edge.
- Check each manual pair with Boxes.py-style finger count, length tolerance, and parameter warnings.
- Show the original uploaded SVG arrangement as a dashed source overlay after joinery is generated.
- Download cuboid and gable-roof house practice SVG files.
- Display English position labels for practice files, including `bottom`, `left`, `right`, `front`, `back`, `roof left`, and `roof right`.
- Generate a preview with finger-jointed polygon boundaries.
- Download the generated SVG or DXF.

## Joint Notes

- The first selected edge is always convex `f`: tabs are drawn from the black inner-dimension line outward to the gray reference line.
- The second selected edge is always concave `F`: recesses are drawn from the gray reference line inward to the black inner-dimension line.
- The joinery never cuts inside the black inner-dimension geometry, preserving the requested inner volume.
- A pending edge can be clicked again to cancel it. A completed paired edge can be clicked again to delete that pair.
- Manual pairing changes only the selected pair. It does not automatically apply all cube-net joinery.
- Gray preview lines are important inner-dimension offset references. Keep unselected gray offset lines visible; only hide the specific gray edge after it has been selected and replaced by a convex/concave joinery preview.
- The built-in cube net can still use its known correct topology when no manual pairs exist and the cube flow is confirmed.
- Gable-roof practice SVG labels are intended for spatial matching practice. The joint workflow preserves simple path `id` values and uses them to show labels again after import.
- Exported production SVG removes temporary edge overlays, source overlays, and preview labels.
- Browser download behavior differs by environment. The joint workflow tries the native save picker first, then falls back to an on-page download link.

## SVG Support

The first joint build supports:

- `polygon`
- `polyline`
- simple `path` data using `M`, `L`, `H`, `V`, and `Z`

Curves, complex transforms, and boolean-style SVG artwork should be expanded to straight polygon paths before import.
