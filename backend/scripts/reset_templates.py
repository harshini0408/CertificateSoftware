#!/usr/bin/env python3
"""Reset ImageTemplate collection and reseed with new templates from static/certificate_templates/"""

import asyncio
import sys
from pathlib import Path

# Add the backend to path so we can import the app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import connect_db, disconnect_db
from app.models.image_template import ImageTemplate


async def main():
    """Connect to DB, clear old templates, and reseed new ones."""
    await connect_db()
    
    try:
        # 1. Show current templates
        print("📋 Current templates in database:")
        all_templates = await ImageTemplate.find_all().to_list()
        for tmpl in all_templates:
            print(f"  • {tmpl.filename} → {tmpl.display_name}")
        
        if all_templates:
            print(f"\n🗑️  Deleting {len(all_templates)} old template(s)...")
            for tmpl in all_templates:
                await tmpl.delete()
            print("✅ Old templates deleted")
        
        # 2. Reseed new templates from static directory
        print("\n📂 Scanning static/certificate_templates/ for PNG files...")
        cert_templates_dir = Path(__file__).parent.parent / "app" / "static" / "certificate_templates"
        
        if not cert_templates_dir.exists():
            print(f"❌ Directory not found: {cert_templates_dir}")
            return
        
        png_files = sorted(cert_templates_dir.glob("*.png"))
        if not png_files:
            print("❌ No PNG files found!")
            return
        
        print(f"Found {len(png_files)} PNG file(s):")
        for png in png_files:
            print(f"  • {png.name}")
        
        # 3. Register new templates
        print("\n✨ Registering new templates...")
        for png_path in png_files:
            filename = png_path.name
            display_name = png_path.stem.replace("_", " ").title()
            preview_url = f"/static/certificate_templates/{filename}"
            
            template = ImageTemplate(
                filename=filename,
                display_name=display_name,
                preview_url=preview_url,
            )
            await template.insert()
            print(f"  ✅ {filename} → {display_name}")
        
        # 4. Verify
        print("\n✓ New templates registered in database:")
        all_templates = await ImageTemplate.find_all().to_list()
        for tmpl in all_templates:
            print(f"  • {tmpl.filename} → {tmpl.display_name} → {tmpl.preview_url}")
        
        print(f"\n✅ Successfully registered {len(all_templates)} template(s)")
        
    finally:
        await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())
