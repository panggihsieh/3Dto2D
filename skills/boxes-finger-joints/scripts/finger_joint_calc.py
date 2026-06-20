#!/usr/bin/env python3
"""Calculate a Boxes.py-style laser-cut finger joint layout."""

from __future__ import annotations

import argparse
import math


def positive_float(value: str) -> float:
    number = float(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("value must be greater than zero")
    return number


def nonnegative_float(value: str) -> float:
    number = float(value)
    if number < 0:
        raise argparse.ArgumentTypeError("value must be zero or greater")
    return number


def calc_fingers(length: float, thickness: float, space: float, finger: float, surroundingspaces: float) -> tuple[int, float]:
    if abs(space + finger) < 0.1:
        raise ValueError("space + finger must not be close to zero")

    fingers = int((length - (surroundingspaces - 1.0) * space) // (space + finger))

    if fingers == 0 and length > finger + thickness:
        fingers = 1

    if finger == 0:
        fingers = 0

    leftover = length - fingers * (space + finger) + space

    if fingers <= 0:
        return 0, length

    return fingers, leftover


def fit_hint(material: str, burn: float | None, play: float) -> str:
    material_l = material.lower()
    hints: list[str] = []

    if "acrylic" in material_l or "plex" in material_l:
        hints.append("Prefer a looser fit for brittle acrylic; avoid forced press-fit assembly.")
    elif "wood" in material_l or "ply" in material_l:
        hints.append("Plywood can usually tolerate a tighter press fit; tune burn in 0.005-0.01 mm steps.")
    else:
        hints.append("Make a small test coupon before cutting the full design.")

    if burn is None:
        hints.append("Burn is unknown; start with a kerf test and use about half the measured cut-width error.")
    elif burn == 0:
        hints.append("Burn is zero; make sure kerf compensation is handled downstream if needed.")
    else:
        hints.append("In Boxes.py-style compensation, larger burn makes the joint tighter.")

    if play > 0:
        hints.append("Positive play makes insertion/removal easier.")

    return " ".join(hints)


def main() -> int:
    parser = argparse.ArgumentParser(description="Calculate a Boxes.py-style finger joint layout.")
    parser.add_argument("--thickness", "-t", type=positive_float, required=True, help="Measured material thickness in mm.")
    parser.add_argument("--length", "-L", type=positive_float, required=True, help="Edge length in mm.")
    parser.add_argument("--finger", type=positive_float, help="Finger width in mm. Defaults to 2 * thickness.")
    parser.add_argument("--space", type=positive_float, help="Space between fingers in mm. Defaults to 2 * thickness.")
    parser.add_argument("--surroundingspaces", type=positive_float, default=2.0, help="End-space multiplier. Boxes.py default: 2.0.")
    parser.add_argument("--play", type=nonnegative_float, default=0.0, help="Extra clearance in mm.")
    parser.add_argument("--extra-length", type=nonnegative_float, default=0.0, help="Extra finger length for sanding burn marks, in mm.")
    parser.add_argument("--width", type=positive_float, help="T-joint hole height in mm. Defaults to thickness.")
    parser.add_argument("--burn", type=nonnegative_float, help="Boxes.py burn/kerf compensation in mm.")
    parser.add_argument("--material", default="unknown", help="Material note, e.g. plywood or acrylic.")
    args = parser.parse_args()

    thickness = args.thickness
    finger = args.finger if args.finger is not None else 2.0 * thickness
    space = args.space if args.space is not None else 2.0 * thickness
    hole_height = args.width if args.width is not None else thickness

    fingers, leftover = calc_fingers(args.length, thickness, space, finger, args.surroundingspaces)
    end_margin = leftover / 2.0
    finger_length = thickness + args.extra_length

    print("Boxes.py-style finger joint layout")
    print(f"  thickness:        {thickness:.3f} mm")
    print(f"  edge length:      {args.length:.3f} mm")
    print(f"  burn:             {'unknown' if args.burn is None else f'{args.burn:.3f} mm'}")
    print(f"  finger count:     {fingers}")
    print(f"  finger width:     {finger:.3f} mm")
    print(f"  space width:      {space:.3f} mm")
    print(f"  leftover:         {leftover:.3f} mm")
    print(f"  end margin:       {end_margin:.3f} mm each side")
    print(f"  finger length:    {finger_length:.3f} mm")

    if fingers:
        print("  T-joint holes:")
        print(f"    hole width:     {finger + args.play:.3f} mm")
        print(f"    hole height:    {hole_height + args.play:.3f} mm")
        centers = [end_margin + i * (space + finger) + finger / 2.0 for i in range(fingers)]
        center_text = ", ".join(f"{center:.3f}" for center in centers)
        print(f"    centers x:      {center_text} mm")

    if args.play:
        print("  opposing side with play:")
        print(f"    finger width:   {finger + args.play:.3f} mm")
        print(f"    space width:    {space - args.play:.3f} mm")
        print(f"    leftover:       {leftover - args.play:.3f} mm")

    print()
    print("Fit note:")
    print(f"  {fit_hint(args.material, args.burn, args.play)}")

    if fingers == 0:
        print()
        print("Warning:")
        print("  No normal fingers fit on this edge. Increase length or reduce finger/space.")

    if space <= args.play:
        print()
        print("Warning:")
        print("  play is greater than or equal to space; the opposing-side spacing becomes invalid.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
