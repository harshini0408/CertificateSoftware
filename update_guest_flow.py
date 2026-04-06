
import os
from pathlib import Path

path = r'd:\CertificateSoftware\backend\app\routers\guest_flow.py'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_mode = False

for i, line in enumerate(lines):
    # Detect the start of the configuration block
    if '_FONTS_DIR = Path' in line:
        new_lines.append('    _FONTS_DIR = Path(__file__).parent.parent / "static" / "fonts"\n')
        new_lines.append('    _DEFAULT_FONT = _FONTS_DIR / "PlayfairDisplay.ttf"\n')
        new_lines.append('    _ALT_FONT = _FONTS_DIR / "Montserrat-Bold.ttf"\n')
        new_lines.append('    DEFAULT_FONT_PERCENT = 4.2\n')
        skip_mode = True
        continue
    
    # Skip old font loader and config
    if skip_mode:
        if 'img = Image.open' in line:
            skip_mode = False
            # Before opening image, insert the new loader
            new_lines.append('\n')
            new_lines.append('    def _load_font(size: int, is_main: bool = True):\n')
            new_lines.append('        try:\n')
            new_lines.append('            f = _DEFAULT_FONT if is_main else _ALT_FONT\n')
            new_lines.append('            if f.exists():\n')
            new_lines.append('                return ImageFont.truetype(str(f), size)\n')
            new_lines.append('        except Exception:\n')
            new_lines.append('            pass\n')
            new_lines.append('        return ImageFont.load_default()\n\n')
            new_lines.append(line)
            continue
        else:
            continue

    # Update the drawing loop logic
    if 'font_size = max(20' in line:
        new_lines.append('        is_name = any(k in col_header.lower() for k in ["name", "student", "full"])\n')
        new_lines.append('        fsp = max(1.0, min(fsp, 10.0))\n')
        new_lines.append('        if is_name: fsp *= 1.2\n')
        new_lines.append('        font_size = max(28, int(img_w * fsp / 100))\n')
    elif 'font = _load_font(font_size)' in line:
        new_lines.append('        font = _load_font(font_size, is_main=is_name)\n')
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Successfully updated guest_flow.py")
