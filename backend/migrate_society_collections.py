import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.config import get_settings
from app.models import (
    ALL_MODELS,
    ProfessionalSociety,
    SocietyEvent,
    SocietyAsset,
    SocietyCertificate,
    SocietyAttendance,
    SocietyAttendanceSession,
    SocietyParticipant,
    SocietyFieldPosition,
    Certificate,
    Attendance,
    AttendanceSession,
    Participant,
    FieldPosition,
)

async def migrate():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.db_name]
    await init_beanie(database=db, document_models=ALL_MODELS)

    print("Migrating society assets...")
    societies = await ProfessionalSociety.find_all().to_list()
    for s in societies:
        if s.assets and (s.assets.logo_url or s.assets.signature_url):
            existing = await SocietyAsset.find_one(SocietyAsset.society_id == s.id)
            if not existing:
                soc_asset = SocietyAsset(
                    society_id=s.id,
                    society_slug=s.slug,
                    logo_path=s.assets.logo_path,
                    logo_hash=s.assets.logo_hash,
                    logo_url=s.assets.logo_url,
                    signature_path=s.assets.signature_path,
                    signature_hash=s.assets.signature_hash,
                    signature_url=s.assets.signature_url,
                    signature2_path=s.assets.signature2_path,
                    signature2_hash=s.assets.signature2_hash,
                    signature2_url=s.assets.signature2_url,
                )
                await soc_asset.insert()
                print(f"Created SocietyAsset for {s.name} ({s.slug})")

    events = await SocietyEvent.find_all().to_list()
    event_ids = [e.id for e in events]
    print(f"Found {len(events)} society events to check for migrations...")

    for e in events:
        eid = e.id
        sid = e.society_id

        # Participants
        parts = await Participant.find(Participant.event_id == eid).to_list()
        for p in parts:
            existing_sp = await SocietyParticipant.find_one(
                SocietyParticipant.event_id == eid,
                SocietyParticipant.email == p.email,
            )
            if not existing_sp:
                sp = SocietyParticipant(
                    event_id=eid,
                    society_id=sid,
                    club_id=sid,
                    email=p.email,
                    registration_number=p.registration_number,
                    cert_type=p.cert_type,
                    fields=p.fields or {},
                    field_mapping=p.field_mapping or {},
                    source=p.source,
                    verified=p.verified,
                    manually_verified=getattr(p, "manually_verified", False),
                    status=p.status,
                    team_id=getattr(p, "team_id", None),
                    team_name=getattr(p, "team_name", None),
                    team_role=getattr(p, "team_role", None),
                    registered_at=p.registered_at,
                )
                await sp.insert()

        # Certificates
        certs = await Certificate.find(Certificate.event_id == eid).to_list()
        for c in certs:
            existing_sc = await SocietyCertificate.find_one(SocietyCertificate.cert_number == c.cert_number)
            if not existing_sc:
                sc = SocietyCertificate(
                    cert_number=c.cert_number,
                    participant_id=c.participant_id,
                    event_id=eid,
                    template_id=c.template_id,
                    society_id=sid,
                    club_id=sid,
                    snapshot=c.snapshot,
                    png_url=c.png_url,
                    status=c.status,
                    issued_at=c.issued_at,
                    revoked_at=c.revoked_at,
                    revoked_by=c.revoked_by,
                )
                await sc.insert()

        # Attendances
        atts = await Attendance.find(Attendance.event_id == eid).to_list()
        for a in atts:
            existing_sa = await SocietyAttendance.find_one(
                SocietyAttendance.event_id == eid,
                SocietyAttendance.student_id == a.student_id,
            )
            if not existing_sa:
                sa = SocietyAttendance(
                    event_id=eid,
                    society_id=sid,
                    club_id=sid,
                    student_id=a.student_id,
                    student_email=a.student_email,
                    student_name=a.student_name,
                    registration_number=a.registration_number,
                    feedback=a.feedback,
                    marked_at=a.marked_at,
                )
                await sa.insert()

        # Field positions
        fps = await FieldPosition.find(FieldPosition.event_id == eid).to_list()
        for fp in fps:
            existing_sfp = await SocietyFieldPosition.find_one(
                SocietyFieldPosition.event_id == eid,
                SocietyFieldPosition.cert_type == fp.cert_type,
            )
            if not existing_sfp:
                sfp = SocietyFieldPosition(
                    event_id=eid,
                    cert_type=fp.cert_type,
                    template_filename=fp.template_filename,
                    column_positions=fp.column_positions or {},
                    asset_positions=fp.asset_positions,
                    display_width=fp.display_width,
                    confirmed=fp.confirmed,
                    created_at=fp.created_at,
                )
                await sfp.insert()

    print("Migration to dedicated society collections completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
