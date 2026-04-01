"""
PSG iTech Certificate Platform - Phase 1 Initialization Test
This script verifies that all Phase 1 components are properly set up.
"""

import sys
from pathlib import Path

def check_environment():
    """Check Python environment."""
    print("=" * 60)
    print("🔍 PHASE 1 SETUP VERIFICATION")
    print("=" * 60)
    
    print(f"\n✓ Python Version: {sys.version}")
    print(f"✓ Python Executable: {sys.executable}")
    print(f"✓ Current Directory: {Path.cwd()}")
    
    return True

def check_project_structure():
    """Verify all required directories exist."""
    print("\n" + "=" * 60)
    print("📁 PROJECT STRUCTURE CHECK")
    print("=" * 60)
    
    backend_path = Path("backend")
    required_dirs = [
        "backend",
        "backend/app",
        "backend/app/models",
        "backend/app/schemas",
        "backend/app/routers",
        "backend/app/services",
        "backend/app/core",
        "backend/app/static",
        "backend/app/static/templates",
        "backend/app/static/fonts",
        "backend/storage",
        "backend/storage/certs",
        "backend/storage/assets",
    ]
    
    all_exist = True
    for dir_path in required_dirs:
        path = Path(dir_path)
        if path.exists() and path.is_dir():
            print(f"✓ {dir_path}/")
        else:
            print(f"✗ {dir_path}/ NOT FOUND")
            all_exist = False
    
    return all_exist

def check_configuration_files():
    """Verify configuration files exist."""
    print("\n" + "=" * 60)
    print("⚙️  CONFIGURATION FILES CHECK")
    print("=" * 60)
    
    backend_path = Path("backend")
    required_files = [
        ("requirements.txt", "Dependencies"),
        (".env.example", "Environment template"),
        (".gitignore", "Git ignore rules"),
        ("app/config.py", "Settings loader"),
        ("app/main.py", "FastAPI app"),
        ("app/database.py", "MongoDB connection"),
    ]
    
    all_exist = True
    for file_path, description in required_files:
        full_path = backend_path / file_path
        if full_path.exists():
            size = full_path.stat().st_size
            print(f"✓ {file_path:<25} ({description}) - {size} bytes")
        else:
            print(f"✗ {file_path:<25} NOT FOUND")
            all_exist = False
    
    return all_exist

def check_models():
    """Verify all model files exist."""
    print("\n" + "=" * 60)
    print("🗄️  DATABASE MODELS CHECK")
    print("=" * 60)
    
    models_dir = Path("backend/app/models")
    required_models = [
        "user.py",
        "club.py",
        "event.py",
        "participant.py",
        "certificate.py",
        "template.py",
        "email_log.py",
        "scan_log.py",
        "credit_rule.py",
        "student_credit.py",
    ]
    
    all_exist = True
    for model in required_models:
        model_path = models_dir / model
        if model_path.exists():
            with open(model_path, 'r') as f:
                content = f.read()
                has_document = "Document" in content
                status = "✓" if has_document else "⚠"
                print(f"{status} {model:<25} (Has Document class: {has_document})")
        else:
            print(f"✗ {model:<25} NOT FOUND")
            all_exist = False
    
    return all_exist

def check_dependencies():
    """Check if key dependencies can be imported."""
    print("\n" + "=" * 60)
    print("📦 DEPENDENCIES CHECK")
    print("=" * 60)
    
    dependencies = [
        ("fastapi", "FastAPI"),
        ("uvicorn", "Uvicorn"),
        ("motor", "Motor"),
        ("beanie", "Beanie"),
        ("pydantic", "Pydantic"),
    ]
    
    all_available = True
    for module_name, display_name in dependencies:
        try:
            __import__(module_name)
            print(f"✓ {display_name:<20} - Available")
        except ImportError:
            print(f"⚠ {display_name:<20} - Not installed (needs: pip install -r requirements.txt)")
            all_available = False
    
    return all_available

def check_environment_config():
    """Check .env file configuration."""
    print("\n" + "=" * 60)
    print("🔐 ENVIRONMENT CONFIGURATION CHECK")
    print("=" * 60)
    
    env_file = Path("backend/.env")
    env_example = Path("backend/.env.example")
    
    if env_file.exists():
        print(f"✓ .env file exists")
        print(f"  → Ready for configuration")
    elif env_example.exists():
        print(f"⚠ .env file not found")
        print(f"✓ .env.example template exists")
        print(f"  → Run: copy backend\\.env.example backend\\.env")
    else:
        print(f"✗ Neither .env nor .env.example found")
        return False
    
    return True

def check_documentation():
    """Check if documentation files exist."""
    print("\n" + "=" * 60)
    print("📚 DOCUMENTATION CHECK")
    print("=" * 60)
    
    docs = [
        ("README.md", "Project overview"),
        ("SETUP_GUIDE.md", "Installation guide"),
        ("DATABASE_CONNECTION_STEPS.md", "Connection steps"),
        ("ARCHITECTURE.md", "System architecture"),
        ("QUICK_REFERENCE.md", "Quick commands"),
        ("PHASE1_COMPLETION_SUMMARY.md", "Phase 1 summary"),
    ]
    
    all_exist = True
    for doc_file, description in docs:
        doc_path = Path(doc_file)
        if doc_path.exists():
            size = doc_path.stat().st_size
            print(f"✓ {doc_file:<40} ({description}) - {size} bytes")
        else:
            print(f"✗ {doc_file:<40} NOT FOUND")
            all_exist = False
    
    return all_exist

def print_next_steps():
    """Print next steps for the user."""
    print("\n" + "=" * 60)
    print("🚀 NEXT STEPS")
    print("=" * 60)
    
    steps = [
        ("1. Install MongoDB", "Download and install from https://www.mongodb.com/try/download/community"),
        ("2. Configure .env", "copy backend\\.env.example backend\\.env"),
        ("3. Generate SECRET_KEY", "python -c \"import secrets; print(secrets.token_urlsafe(32))\""),
        ("4. Update STORAGE_PATH", "Edit backend\\.env and set STORAGE_PATH"),
        ("5. Install dependencies", "cd backend && pip install -r requirements.txt"),
        ("6. Start application", "python -m uvicorn app.main:app --reload"),
        ("7. Test API", "Open http://localhost:8000/docs in browser"),
    ]
    
    for step, description in steps:
        print(f"\n{step}")
        print(f"   → {description}")

def print_summary(results):
    """Print verification summary."""
    print("\n" + "=" * 60)
    print("✅ VERIFICATION SUMMARY")
    print("=" * 60)
    
    all_passed = all(results.values())
    
    for check_name, passed in results.items():
        status = "✓ PASS" if passed else "⚠ WARN"
        print(f"{status}: {check_name}")
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL CHECKS PASSED - READY FOR PHASE 2!")
        print("=" * 60)
        return True
    else:
        print("⚠️  SOME CHECKS NEED ATTENTION")
        print("=" * 60)
        return False

def main():
    """Run all verification checks."""
    try:
        results = {
            "Environment": check_environment(),
            "Project Structure": check_project_structure(),
            "Configuration Files": check_configuration_files(),
            "Database Models": check_models(),
            "Documentation": check_documentation(),
            "Environment Config": check_environment_config(),
        }
        
        # Dependencies check is informational (they might not be installed yet)
        print("\n")
        check_dependencies()
        
        # Print next steps
        print_next_steps()
        
        # Print summary
        success = print_summary(results)
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"\n❌ ERROR during verification: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
