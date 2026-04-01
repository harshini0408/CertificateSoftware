"""Download the 5 Google Fonts required for certificate rendering.

Run this script once before starting the server:
    python download_fonts.py
"""

import os
import sys
import urllib.request
from pathlib import Path

FONTS_DIR = Path(__file__).parent / "app" / "static" / "fonts"

# Google Fonts direct download URLs (TTF format)
FONTS = {
    "PlayfairDisplay.ttf": "https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf",
    "Montserrat.ttf": "https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
    "EBGaramond.ttf": "https://github.com/google/fonts/raw/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf",
    "Raleway.ttf": "https://github.com/google/fonts/raw/main/ofl/raleway/Raleway%5Bwght%5D.ttf",
    "DancingScript.ttf": "https://github.com/google/fonts/raw/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf",
}


def main():
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading fonts to {FONTS_DIR} ...\n")

    for filename, url in FONTS.items():
        dest = FONTS_DIR / filename
        if dest.exists():
            print(f"  ✓ {filename} (already exists, skipping)")
            continue

        print(f"  ↓ {filename} ...", end=" ", flush=True)
        try:
            urllib.request.urlretrieve(url, dest)
            size_kb = dest.stat().st_size / 1024
            print(f"OK ({size_kb:.0f} KB)")
        except Exception as exc:
            print(f"FAILED: {exc}")
            print(f"\n    Manual download: {url}")
            print(f"    Save to: {dest}\n")

    print("\nDone! All fonts saved to app/static/fonts/")


if __name__ == "__main__":
    main()
