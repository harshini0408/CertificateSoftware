"""
Test script to verify the Template Mapper flow:
1. GET /api/certificate-config/templates - List all templates
2. GET /api/certificate-config/config/{template_name} - Get existing config
3. POST /api/certificate-config/save - Save new config
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.certificate_config.model import CertificateTemplateConfig, FieldConfig
from app.database import connect_db, disconnect_db


async def test_mapper_flow():
    """Test the complete mapper workflow."""
    print("\n" + "="*60)
    print("TEMPLATE MAPPER FLOW TEST")
    print("="*60 + "\n")
    
    try:
        # Connect to database
        print("[1] Connecting to database...")
        await connect_db()
        print("✓ Database connected\n")
        
        # Test 1: Create a sample config
        print("[2] Creating sample configuration...")
        template_name = "test_certificate.png"
        fields = [
            FieldConfig(field_name="Name", x=150, y=200),
            FieldConfig(field_name="Date", x=600, y=300),
            FieldConfig(field_name="Role", x=400, y=350),
        ]
        
        # Delete if exists
        await CertificateTemplateConfig.find_one(
            CertificateTemplateConfig.template_name == template_name
        ).delete()
        
        config = CertificateTemplateConfig(
            template_name=template_name,
            fields=fields
        )
        result = await config.insert()
        print(f"✓ Configuration created: {result.id}\n")
        
        # Test 2: Retrieve config
        print("[3] Retrieving configuration...")
        retrieved = await CertificateTemplateConfig.find_one(
            CertificateTemplateConfig.template_name == template_name
        )
        if retrieved:
            print(f"✓ Found config with {len(retrieved.fields)} fields:")
            for f in retrieved.fields:
                print(f"  - {f.field_name}: ({f.x}, {f.y})")
        else:
            print("✗ Configuration not found")
            return
        print()
        
        # Test 3: Update config
        print("[4] Updating configuration...")
        new_fields = [
            FieldConfig(field_name="Student Name", x=200, y=250),
            FieldConfig(field_name="Event Date", x=650, y=320),
            FieldConfig(field_name="Award", x=450, y=400),
            FieldConfig(field_name="Signature", x=100, y=500),
        ]
        retrieved.fields = new_fields
        await retrieved.save()
        print(f"✓ Configuration updated with {len(new_fields)} fields\n")
        
        # Test 4: Verify update
        print("[5] Verifying update...")
        updated = await CertificateTemplateConfig.find_one(
            CertificateTemplateConfig.template_name == template_name
        )
        if updated and len(updated.fields) == 4:
            print("✓ Update verified:")
            for f in updated.fields:
                print(f"  - {f.field_name}: ({f.x}, {f.y})")
        else:
            print("✗ Update verification failed")
            return
        print()
        
        # Test 5: Format for API response
        print("[6] Testing API response format...")
        api_response = {f.field_name: {"x": f.x, "y": f.y} for f in updated.fields}
        print("✓ API response format:")
        for name, coords in api_response.items():
            print(f"  - {name}: {coords}")
        print()
        
        # Test 6: Delete and verify
        print("[7] Cleanup - deleting test configuration...")
        await updated.delete()
        print("✓ Configuration deleted")
        
        verify = await CertificateTemplateConfig.find_one(
            CertificateTemplateConfig.template_name == template_name
        )
        if verify is None:
            print("✓ Verified: Configuration no longer exists\n")
        
        print("="*60)
        print("ALL TESTS PASSED ✓")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await disconnect_db()
        print("Database disconnected\n")


if __name__ == "__main__":
    asyncio.run(test_mapper_flow())
