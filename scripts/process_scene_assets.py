#!/usr/bin/env python3
"""Prepare transparent stone and carving overlays from the supplied JPEGs."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "scene" / "source"
OUTPUT = ROOT / "public" / "assets" / "scene"


def connected_near_white(rgb: np.ndarray) -> np.ndarray:
    """Find near-white pixels connected to an image edge."""

    minimum = rgb.min(axis=2)
    maximum = rgb.max(axis=2)
    candidate = (minimum >= 226) & ((maximum - minimum) <= 22)
    height, width = candidate.shape
    visited = np.zeros_like(candidate, dtype=np.bool_)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        if candidate[0, x]:
            visited[0, x] = True
            queue.append((0, x))
        if candidate[height - 1, x]:
            visited[height - 1, x] = True
            queue.append((height - 1, x))

    for y in range(height):
        if candidate[y, 0]:
            visited[y, 0] = True
            queue.append((y, 0))
        if candidate[y, width - 1]:
            visited[y, width - 1] = True
            queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        if y > 0 and candidate[y - 1, x] and not visited[y - 1, x]:
            visited[y - 1, x] = True
            queue.append((y - 1, x))
        if y + 1 < height and candidate[y + 1, x] and not visited[y + 1, x]:
            visited[y + 1, x] = True
            queue.append((y + 1, x))
        if x > 0 and candidate[y, x - 1] and not visited[y, x - 1]:
            visited[y, x - 1] = True
            queue.append((y, x - 1))
        if x + 1 < width and candidate[y, x + 1] and not visited[y, x + 1]:
            visited[y, x + 1] = True
            queue.append((y, x + 1))

    return visited


def crop_to_alpha(image: Image.Image, margin: int) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return image
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - margin),
            max(0, top - margin),
            min(image.width, right + margin),
            min(image.height, bottom + margin),
        )
    )


def prepare_stone() -> None:
    source = Image.open(SOURCE / "stone.jpg").convert("RGB")
    rgb = np.asarray(source).astype(np.float32)
    background = connected_near_white(rgb.astype(np.uint8))
    luminance = rgb.mean(axis=2)

    alpha = np.full(luminance.shape, 255, dtype=np.float32)
    alpha[background] = np.clip((250 - luminance[background]) / 24 * 255, 0, 255)
    alpha_image = Image.fromarray(alpha.astype(np.uint8), "L").filter(
        ImageFilter.GaussianBlur(radius=0.55)
    )

    rgba = source.convert("RGBA")
    rgba.putalpha(alpha_image)
    rgba = crop_to_alpha(rgba, margin=10)
    rgba.save(OUTPUT / "stone.webp", "WEBP", lossless=True, method=6)


def prepare_mark(source_name: str, output_name: str) -> None:
    source = Image.open(SOURCE / source_name).convert("RGB")
    rgb = np.asarray(source).astype(np.float32)
    minimum = rgb.min(axis=2)

    raw_alpha = np.clip((247 - minimum) / 86, 0, 1)
    alpha = np.power(raw_alpha, 0.72)
    alpha[alpha < 0.035] = 0
    alpha[:20, :] = 0
    alpha[-20:, :] = 0
    alpha[:, :20] = 0
    alpha[:, -20:] = 0
    safe_alpha = np.maximum(alpha, 1 / 255)

    foreground = (rgb - (1 - safe_alpha[..., None]) * 255) / safe_alpha[..., None]
    foreground = np.clip(foreground, 0, 255).astype(np.uint8)
    alpha_image = Image.fromarray((alpha * 255).astype(np.uint8), "L").filter(
        ImageFilter.GaussianBlur(radius=0.35)
    )

    rgba = Image.fromarray(foreground, "RGB").convert("RGBA")
    rgba.putalpha(alpha_image)
    rgba = crop_to_alpha(rgba, margin=8)
    rgba.save(OUTPUT / output_name, "WEBP", lossless=True, method=6)


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    prepare_stone()
    prepare_mark("mark-success.jpg", "mark-success.webp")
    prepare_mark("mark-broken.jpg", "mark-broken.webp")
    print("Prepared stone.webp, mark-success.webp, and mark-broken.webp")
