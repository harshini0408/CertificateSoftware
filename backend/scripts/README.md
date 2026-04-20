# Backend Utility Scripts

One-off maintenance, migration, and debugging scripts. **Do not run these in production without reading them first.**

| Script | Purpose |
|--------|---------|
| `fix_db.py` | Early migration — fixes old certificate document structure |
| `fix_db2.py` | Patch 2 — corrects template_map field on Event documents |
| `fix_db3.py` | Patch 3 — back-fills missing `cert_type` on Participant documents |
| `reset_admin.py` | Resets the super-admin password to the value in `.env` |
| `reset_templates.py` | Drops and re-seeds all ImageTemplate documents from the static PNG folder |
| `seed_demo.py` | Seeds a demo club, event, and participants for local development |
| `cleanup_non_emailed_credit_awards.py` | Removes legacy credit entries tied to non-emailed certificates and recomputes totals |
| `db_check.py` | Prints counts of all collections — useful for sanity-checking DB state |
| `check_superadmin.py` | Verifies the super-admin account exists and is active |

## How to run

```bash
# From the backend/ directory with the virtual environment activated:
cd backend
source venv/bin/activate   # Windows: venv\Scripts\activate

python scripts/reset_admin.py
python scripts/seed_demo.py
# etc.
```

> [!WARNING]
> `reset_templates.py` drops all existing `image_templates` collection documents.
> Run only when re-seeding from scratch.
