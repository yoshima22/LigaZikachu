"""Normalize original PMD GIFs: python normalize_animations.py ORIGINAL_DIR OUTPUT_DIR.
Requires Pillow. This runs offline; the app only loads the resulting bundled files.
"""
from pathlib import Path
import sys
from PIL import Image, ImageSequence

source, output = map(Path, sys.argv[1:3])
output.mkdir(parents=True, exist_ok=True)
for number in (1, 4, 7, 25):
    actions = {}
    for action in ("idle", "walk-left", "walk-right", "sleep"):
        path = source / f"{number:04d}-{action}.gif"
        with Image.open(path) as gif:
            frames = [frame.convert("RGBA") for frame in ImageSequence.Iterator(gif)]
            durations = [frame.info.get("duration", 100) for frame in ImageSequence.Iterator(gif)]
        boxes = [frame.getbbox() for frame in frames if frame.getbbox()]
        bounds = (min(b[0] for b in boxes), min(b[1] for b in boxes),
                  max(b[2] for b in boxes), max(b[3] for b in boxes))
        actions[action] = (frames, durations, bounds)
    width = max(bounds[2] - bounds[0] for _, _, bounds in actions.values())
    height = max(bounds[3] - bounds[1] for _, _, bounds in actions.values())
    for action, (frames, durations, bounds) in actions.items():
        x = (width - (bounds[2] - bounds[0])) // 2 - bounds[0]
        y = height - bounds[3]
        result = []
        for frame in frames:
            canvas = Image.new("RGBA", (width, height))
            canvas.paste(frame, (x, y))
            result.append(canvas)
        result[0].save(output / f"{number:04d}-{action}.gif", save_all=True,
                       append_images=result[1:], duration=durations, loop=0,
                       disposal=2, optimize=False, transparency=0)
