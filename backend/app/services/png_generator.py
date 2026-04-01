import imgkit


def generate_png(html: str, output_path: str) -> None:
    """Convert an HTML string to a 2480×3508 px PNG (A4 at 300 DPI).

    Uses wkhtmltoimage via imgkit.
    """
    options = {
        "format": "png",
        "width": "2480",
        "height": "3508",
        "enable-local-file-access": "",
        "quality": "100",
    }
    imgkit.from_string(html, output_path, options=options)
