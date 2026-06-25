#!/usr/bin/env python3
import argparse
import csv
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image


COLORS = [
    "#0072b2",
    "#e69f00",
    "#009e73",
    "#d55e00",
    "#cc79a7",
    "#56b4e9",
    "#f0e442",
    "#6a3d9a",
    "#8c564b",
    "#17becf",
    "#7f7f7f",
    "#000000",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Create 12-layer grayscale trace SVG for FLUX / Beam Studio.")
    parser.add_argument("--input", required=True, help="Input bitmap or SVG path.")
    parser.add_argument("--output-dir", required=True, help="Directory for SVG and CSV outputs.")
    parser.add_argument("--name", default="flux_gradient_trace", help="Output basename.")
    parser.add_argument("--width-mm", type=float, default=100.0, help="Output SVG width in mm.")
    parser.add_argument("--max-px", type=int, default=1200, help="Maximum raster width before tracing.")
    parser.add_argument("--machine-watts", type=float, default=30.0, help="Rated laser power.")
    parser.add_argument("--min-power", type=float, default=8.0, help="L01 suggested power percent.")
    parser.add_argument("--max-power", type=float, default=40.0, help="L12 suggested power percent.")
    parser.add_argument("--speckles", type=int, default=2, help="Small path suppression threshold.")
    parser.add_argument("--remove-background", action="store_true", default=True, help="Ignore near-white background.")
    parser.add_argument("--keep-background", action="store_true", help="Do not ignore near-white background.")
    return parser.parse_args()


def run(cmd):
    completed = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return completed.stdout.strip()


def rasterize_if_needed(input_path, work_dir):
    suffix = input_path.suffix.lower()
    if suffix != ".svg":
        return input_path
    inkscape = shutil.which("inkscape")
    if not inkscape:
        raise RuntimeError("SVG input requires Inkscape to rasterize, but inkscape was not found.")
    png_path = work_dir / "input_from_svg.png"
    run([inkscape, str(input_path), "--export-type=png", f"--export-filename={png_path}"])
    return png_path


def load_image(path, max_px):
    image = Image.open(path).convert("RGBA")
    if image.width > max_px:
        height = max(1, round(image.height * max_px / image.width))
        image = image.resize((max_px, height), Image.Resampling.LANCZOS)
    return image


def layer_power(index, min_power, max_power, count=12):
    if count <= 1:
        return max_power
    return min_power + (max_power - min_power) * index / (count - 1)


def make_mask(image, layer_index, remove_background):
    width, height = image.size
    mask = Image.new("1", (width, height), 1)
    pixels = image.load()
    out = mask.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 16:
                continue
            gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if remove_background and gray >= 248:
                continue
            darkness = 255 - gray
            layer = min(11, int(math.floor(darkness / 256 * 12)))
            if layer == layer_index:
                out[x, y] = 0
    return mask


def trace_mask(mask, layer_index, work_dir, speckles):
    pbm_path = work_dir / f"layer_{layer_index + 1:02d}.pbm"
    svg_path = work_dir / f"layer_{layer_index + 1:02d}.svg"
    mask.save(pbm_path)
    cmd = [
        "potrace",
        str(pbm_path),
        "--svg",
        "--output",
        str(svg_path),
        "--turdsize",
        str(max(0, speckles)),
        "--alphamax",
        "1.0",
        "--opttolerance",
        "0.200",
    ]
    run(cmd)
    return extract_paths(svg_path)


def extract_paths(svg_path):
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    root = ET.parse(svg_path).getroot()
    paths = []
    for element in root.iter():
        if element.tag.endswith("path"):
            d = element.attrib.get("d")
            if d:
                paths.append(d)
    return paths


def layer_label(index, machine_watts, power):
    layer = f"L{index + 1:02d}"
    tone = "lightest" if index == 0 else "darkest" if index == 11 else f"tone_{index + 1:02d}"
    power_label = f"{power:.1f}".replace(".", "p")
    return f"{layer}_{tone}_{COLORS[index]}_{power_label}pct_FLUX_{machine_watts:g}W".replace("#", "color_")


def write_svg(output_path, image, traced_layers, args):
    width_px, height_px = image.size
    height_mm = args.width_mm * height_px / width_px
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("inkscape", "http://www.inkscape.org/namespaces/inkscape")
    svg = ET.Element("svg", {
        "xmlns": "http://www.w3.org/2000/svg",
        "xmlns:inkscape": "http://www.inkscape.org/namespaces/inkscape",
        "width": f"{args.width_mm:.4f}mm",
        "height": f"{height_mm:.4f}mm",
        "viewBox": f"0 0 {width_px} {height_px}",
        "version": "1.1",
    })
    metadata = ET.SubElement(svg, "metadata")
    metadata.text = json.dumps({
        "generator": "3Dto2D v4 GitHub Actions batch trace",
        "workflow": "bitmap-trace-multiple-scan-grayscale",
        "machineProfile": f"FLUX {args.machine_watts:g}W",
        "layers": 12,
        "powerRangePercent": [args.min_power, args.max_power],
        "traceEngine": "potrace",
        "inkscapeRequired": "for SVG rasterization/inspection, not Trace Bitmap automation",
    }, ensure_ascii=False, indent=2)
    desc = ET.SubElement(svg, "desc")
    desc.text = "12-layer grayscale trace SVG for Beam Studio color-layer import."

    for index, paths in enumerate(traced_layers):
        power = layer_power(index, args.min_power, args.max_power)
        label = layer_label(index, args.machine_watts, power)
        group = ET.SubElement(svg, "g", {
            "id": label,
            "{http://www.inkscape.org/namespaces/inkscape}groupmode": "layer",
            "{http://www.inkscape.org/namespaces/inkscape}label": label,
            "data-layer": f"L{index + 1:02d}",
            "data-color": COLORS[index],
            "data-power-percent": f"{power:.1f}",
            "data-estimated-watts": f"{args.machine_watts * power / 100:.2f}",
            "fill": COLORS[index],
            "stroke": "none",
            "fill-rule": "evenodd",
        })
        for d in paths:
            ET.SubElement(group, "path", {"d": d})

    ET.ElementTree(svg).write(output_path, encoding="utf-8", xml_declaration=True)


def write_csv(output_path, args):
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "Layer", "Tone", "Color", "MachineProfile", "TraceMode", "Scans",
            "Smooth", "RemoveBackground", "Speckles", "SmoothCorners", "Optimize",
            "SuggestedPowerPercent", "EstimatedWatts", "BeamStudioNote"
        ])
        for index, color in enumerate(COLORS):
            power = layer_power(index, args.min_power, args.max_power)
            tone = "lightest" if index == 0 else "darkest" if index == 11 else f"tone_{index + 1:02d}"
            writer.writerow([
                f"L{index + 1:02d}",
                tone,
                color,
                f"FLUX {args.machine_watts:g}W",
                "grayscale",
                12,
                "yes",
                "no" if args.keep_background else "yes",
                args.speckles,
                "1.00",
                "0.200",
                f"{power:.1f}",
                f"{args.machine_watts * power / 100:.2f}",
                "Import SVG by Color, then set this color layer power in Beam Studio."
            ])


def main():
    args = parse_args()
    if args.keep_background:
        args.remove_background = False
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    if not input_path.exists():
        raise FileNotFoundError(input_path)
    if not shutil.which("potrace"):
        raise RuntimeError("potrace is required for batch tracing.")

    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp)
        raster_path = rasterize_if_needed(input_path, work_dir)
        image = load_image(raster_path, args.max_px)
        traced_layers = []
        for index in range(12):
            mask = make_mask(image, index, args.remove_background)
            traced_layers.append(trace_mask(mask, index, work_dir, args.speckles))

    svg_path = output_dir / f"{args.name}.svg"
    csv_path = output_dir / f"{args.name}_beam_studio_power_table.csv"
    write_svg(svg_path, image, traced_layers, args)
    write_csv(csv_path, args)
    print(f"Wrote {svg_path}")
    print(f"Wrote {csv_path}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
