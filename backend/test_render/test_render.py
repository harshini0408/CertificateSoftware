"""
Standalone test script for HTML certificate rendering.

Run from the test_render/ directory:
    python test_render.py

Opens output.html in your default browser so you can iterate on the
template.html / CSS without touching the full FastAPI + React stack.
"""

import os
import sys
import webbrowser
from pathlib import Path

# ── Try importing Jinja2; give a helpful message if missing ──────────────────
try:
    from jinja2 import Environment, FileSystemLoader
except ImportError:
    print("[ERROR] jinja2 is not installed.")
    print("  Run:  pip install jinja2")
    sys.exit(1)

# ── 1. Setup Jinja2 environment ──────────────────────────────────────────────
#    FileSystemLoader('.') means it looks for templates in the current folder.
THIS_DIR = Path(__file__).parent
env = Environment(loader=FileSystemLoader(str(THIS_DIR)))
template = env.get_template("template.html")

# ── 2. Mock data – mirrors what the real backend builds from a Participant ───
#
# Each slot in `slots` maps to a <div class="field-slot"> in template.html.
# Coordinates are in PIXELS on the 2480 × 3508 px (A4 @ 300 DPI) canvas.
#
# slot fields:
#   x, y          – absolute position (top-left corner)
#   width, height – bounding box
#   font_size     – px on the full-res canvas (72 ≈ normal headline)
#   font_weight   – CSS value: "normal" | "bold"
#   text_align    – CSS value: "left" | "center" | "right"
#   color         – CSS hex (optional, defaults to #1B4D3E in template)
#   value         – the text that will be rendered

mock_data = {
    "slots": [
        # ── Participant name (large, bold, centred) ───────────────────
        {
            "x": 240,  "y": 780,
            "width": 2000, "height": 160,
            "font_size": 120, "font_weight": "bold",
            "text_align": "center",
            "color": "#1B4D3E",
            "value": "John Doe",
        },
        # ── Event name ────────────────────────────────────────────────
        {
            "x": 400,  "y": 1050,
            "width": 1680, "height": 90,
            "font_size": 48, "font_weight": "bold",
            "text_align": "center",
            "color": "#333333",
            "value": "PSG Tech Hackathon 2025",
        },
        # ── Department ────────────────────────────────────────────────
        {
            "x": 400,  "y": 1160,
            "width": 1680, "height": 70,
            "font_size": 36, "font_weight": "normal",
            "text_align": "center",
            "color": "#555555",
            "value": "Department of Computer Science",
        },
        # ── Date ──────────────────────────────────────────────────────
        {
            "x": 400,  "y": 1250,
            "width": 1680, "height": 70,
            "font_size": 36, "font_weight": "normal",
            "text_align": "center",
            "color": "#555555",
            "value": "15th March 2025",
        },
        # ── Certificate / registration number ─────────────────────────
        {
            "x": 400,  "y": 1370,
            "width": 1680, "height": 60,
            "font_size": 28, "font_weight": "normal",
            "text_align": "center",
            "color": "#888888",
            "value": "PSG-ECOCLUB-2025-000001",
        },
    ]
}

# ── 3. Render and write output.html ──────────────────────────────────────────
output_path = THIS_DIR / "output.html"
html_out = template.render(**mock_data)

with open(output_path, "w", encoding="utf-8") as f:
    f.write(html_out)

print(f"[OK] Rendered → {output_path}")

# ── 4. Auto-open in system browser ───────────────────────────────────────────
file_url = output_path.as_uri()   # e.g. file:///C:/...
print(f"[OK] Opening: {file_url}")
webbrowser.open(file_url)
