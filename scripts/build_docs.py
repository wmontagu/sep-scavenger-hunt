"""
Flatten the indoor-stage documents into plain PNGs for the web app.

Source: source-docs/Scavenger Hunt October 3rd.pdf (NOT web-served).
Why images: the PDF's "redactions" are black boxes drawn over live text. The
hidden values are still in the text layer and can be copied. Rendering to
pixels burns the boxes in. The pitch-deck .pptx also has WILL-ONLY speaker
notes, so we render the slide from the PDF instead.

Usage:  python scripts/build_docs.py        (needs: pip install pymupdf pillow)
Edit PAGES below if the PDF's page order changes.
"""
from io import BytesIO
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source-docs" / "Scavenger Hunt October 3rd.pdf"
OUT = ROOT / "public" / "assets" / "docs"

# output name -> 1-based PDF page
PAGES = {
    "stage1-cap-table.png": 2,
    "stage2-term-sheet-1.png": 4,
    "stage2-term-sheet-2.png": 5,
    "stage3-pitch-deck.png": 7,
}
ZOOM = 2.0  # ~144 dpi: sharp on phones, small files
MARGIN = 24


def trim(im: Image.Image) -> Image.Image:
    """Crop surrounding white space."""
    bg = Image.new(im.mode, im.size, (255, 255, 255))
    box = ImageChops.difference(im, bg).convert("L").point(lambda v: 255 if v > 12 else 0).getbbox()
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - MARGIN), max(0, t - MARGIN), min(im.width, r + MARGIN), min(im.height, b + MARGIN)))


def main() -> None:
    doc = pymupdf.open(SRC)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, page_no in PAGES.items():
        pix = doc[page_no - 1].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), alpha=False)
        im = trim(Image.open(BytesIO(pix.tobytes("png"))).convert("RGB"))
        # palette PNG keeps these document scans small
        im.convert("P", palette=Image.ADAPTIVE, colors=64).save(OUT / name, optimize=True)
        print(f"{name}: page {page_no} -> {im.size}")


if __name__ == "__main__":
    main()
