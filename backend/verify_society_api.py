import asyncio
from datetime import datetime
import httpx
from app.main import app
from app.config import get_settings
from app.database import connect_db, disconnect_db
from app.models.user import User, UserRole
from app.models.professional_society import ProfessionalSociety
from app.models.society_event import SocietyEvent
from app.models.student_society_membership import StudentSocietyMembership, SocietyMembershipStatus
from app.core.security import create_access_token
from beanie import PydanticObjectId

settings = get_settings()

async def cleanup_test_records():
    society_slug = "TESTIEEE"
    expected_society_name = "IEEE Computer Society Test"
    society = await ProfessionalSociety.find_one(ProfessionalSociety.slug == society_slug)
    if society and society.name != expected_society_name:
        raise RuntimeError(
            f"Refusing to clean society {society_slug!r}: its name does not match the test fixture"
        )

    if society:
        for event in await SocietyEvent.find(SocietyEvent.society_id == society.id).to_list():
            await event.delete()
        for membership in await StudentSocietyMembership.find(
            StudentSocietyMembership.society_id == society.id
        ).to_list():
            await membership.delete()
        for coordinator in await User.find(
            User.society_id == society.id,
            User.role == UserRole.PROFESSIONAL_SOCIETY_COORDINATOR,
        ).to_list():
            await coordinator.delete()
        await society.delete()

    verification_event_date = datetime(2026, 11, 15, 9, 30)
    for event in await SocietyEvent.find(
        SocietyEvent.name == "Hands-on Workshop on Robotics"
    ).to_list():
        event_society = await ProfessionalSociety.get(event.society_id)
        if (
            event_society is None
            and event.event_date
            and event.event_date.replace(tzinfo=None) == verification_event_date
            and event.event_time == "09:30 AM"
        ):
            await event.delete()

    temp_principal = await User.find_one({
        "username": "temp_princ_verify",
        "email": "princ.verify@psgitech.ac.in",
    })
    if temp_principal:
        await temp_principal.delete()


async def _run_verification():
    print("=" * 60)
    print("STARTING IN-PROCESS ASGITransport VERIFICATION")
    print("=" * 60)

    # 1. Ensure Superadmin
    admin_user = await User.find_one(User.role == UserRole.SUPER_ADMIN)
    if not admin_user:
        print("[-] Superadmin not found!")
        return
    admin_token = create_access_token(str(admin_user.id), admin_user.role.value)
    admin_cookies = {"access_token": admin_token}
    print(f"[+] Authenticated as Superadmin: {admin_user.username}")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 2. Test Superadmin CRUD for Professional Societies
        print("\n--- Testing Superadmin Professional Societies Endpoints ---")
        society_slug = "TESTIEEE"
        
        # Create Society
        resp = await client.post(
            "/admin/professional-societies",
            json={"name": "IEEE Computer Society Test", "slug": society_slug, "contact_email": "ieee.test@psgitech.ac.in"},
            cookies=admin_cookies,
        )
        assert resp.status_code == 201, f"Failed to create society: {resp.text}"
        soc_data = resp.json()
        society_id = soc_data["id"]
        print(f"[PASS] POST /admin/professional-societies -> ID: {society_id}, Name: {soc_data['name']}")

        # List Societies
        resp = await client.get("/admin/professional-societies", cookies=admin_cookies)
        assert resp.status_code == 200, f"Failed to list societies: {resp.text}"
        soc_list = resp.json()
        assert any(s["id"] == society_id for s in soc_list), "Created society not found in list"
        print(f"[PASS] GET /admin/professional-societies -> Found {len(soc_list)} societies")

        # Toggle Active
        resp = await client.patch(f"/admin/professional-societies/{society_id}/toggle-active", cookies=admin_cookies)
        assert resp.status_code == 200, f"Failed toggle-active: {resp.text}"
        assert resp.json()["is_active"] is False, "Expected is_active to be False"
        # Toggle back
        resp = await client.patch(f"/admin/professional-societies/{society_id}/toggle-active", cookies=admin_cookies)
        assert resp.json()["is_active"] is True
        print("[PASS] PATCH /admin/professional-societies/{id}/toggle-active -> Successfully toggled")

        # 3. Create Coordinator User linked to this society
        print("\n--- Testing Coordinator User Creation & Auth ---")
        coord_username = "ieee_test_coord"
        coord_email = "ieee.coord.test@psgitech.ac.in"
        existing_coord = await User.find_one(User.username == coord_username)
        if existing_coord:
            await existing_coord.delete()

        resp = await client.post(
            "/admin/users",
            json={
                "username": coord_username,
                "name": "IEEE Coordinator Test",
                "email": coord_email,
                "password": "Password123!",
                "role": "professional_society_coordinator",
                "society_id": society_id,
                "is_active": True,
            },
            cookies=admin_cookies,
        )
        assert resp.status_code == 201, f"Failed to create coordinator: {resp.text}"
        coord_user_data = resp.json()
        coord_user_id = coord_user_data["id"]
        assert coord_user_data["society_id"] == society_id
        print(f"[PASS] POST /admin/users -> Created coordinator with society_id: {coord_user_data['society_id']}")

        # Login as Coordinator
        login_resp = await client.post(
            "/auth/login",
            json={"username": coord_username, "password": "Password123!"},
        )
        assert login_resp.status_code == 200, f"Coordinator login failed: {login_resp.text}"
        login_data = login_resp.json()
        coord_token = login_resp.cookies.get("access_token")
        assert coord_token, "access_token cookie not found in login response"
        assert login_data["role"] == "professional_society_coordinator"
        assert login_data["society_id"] == society_id
        assert login_data["redirect_to"] == f"/society/{society_id}"
        coord_cookies = {"access_token": coord_token}
        print(f"[PASS] POST /auth/login -> Role: {login_data['role']}, Redirect: {login_data['redirect_to']}")

        # 4. Coordinator Society Portal Endpoints
        print("\n--- Testing Coordinator Dashboard & Events Endpoints ---")
        # Dashboard stats
        resp = await client.get(f"/societies/{society_id}/dashboard", cookies=coord_cookies)
        assert resp.status_code == 200, f"Dashboard failed: {resp.text}"
        dash_data = resp.json()
        assert dash_data["society_id"] == society_id
        print(f"[PASS] GET /societies/{society_id}/dashboard -> {dash_data['name']}")

        # Coordinator /stats endpoint
        resp = await client.get("/society-coordinator/stats", cookies=coord_cookies)
        assert resp.status_code == 200, f"Stats failed: {resp.text}"
        print(f"[PASS] GET /society-coordinator/stats -> {resp.json()}")

        # Create Event
        resp = await client.post(
            f"/societies/{society_id}/events",
            json={
                "name": "Hands-on Workshop on Robotics",
                "description": "Comprehensive robotics session",
                "event_date": "2026-11-15T09:30:00Z",
                "event_time": "09:30 AM",
                "session": "FN",
                "venue": "Lab 301",
                "category": "Workshop",
                "max_participants": 60,
                "volunteers_required": 5,
                "is_published": True,
            },
            cookies=coord_cookies,
        )
        assert resp.status_code == 201, f"Failed to create event: {resp.text}"
        event_id = resp.json()["id"]
        print(f"[PASS] POST /societies/{society_id}/events -> Event ID: {event_id}")

        # List Events
        resp = await client.get(f"/societies/{society_id}/events", cookies=coord_cookies)
        assert resp.status_code == 200, f"List events failed: {resp.text}"
        events = resp.json()
        assert any(e["id"] == event_id for e in events)
        print(f"[PASS] GET /societies/{society_id}/events -> {len(events)} events found")

        # Get Event Detail
        resp = await client.get(f"/societies/{society_id}/events/{event_id}", cookies=coord_cookies)
        assert resp.status_code == 200, f"Get event detail failed: {resp.text}"
        assert resp.json()["name"] == "Hands-on Workshop on Robotics"
        print(f"[PASS] GET /societies/{society_id}/events/{event_id} -> OK")

        # Update Event
        resp = await client.patch(
            f"/societies/{society_id}/events/{event_id}",
            json={"venue": "Main Auditorium"},
            cookies=coord_cookies,
        )
        assert resp.status_code == 200, f"Patch event failed: {resp.text}"
        print("[PASS] PATCH /societies/{society_id}/events/{event_id} -> Updated venue")

        # 5. Principal Endpoints & Isolation
        print("\n--- Testing Principal Dashboard Endpoints ---")
        principal_user = await User.find_one(User.role == UserRole.PRINCIPAL)
        if principal_user:
            princ_token = create_access_token(str(principal_user.id), principal_user.role.value)
            princ_cookies = {"access_token": princ_token}
            resp = await client.get("/principal/professional-societies", cookies=princ_cookies)
            assert resp.status_code == 200, f"Principal societies failed: {resp.text}"
            p_socs = resp.json()
            assert any(s["id"] == society_id for s in p_socs), "Society not returned to Principal"
            print(f"[PASS] GET /principal/professional-societies -> {len(p_socs)} societies")

            resp = await client.get(f"/principal/professional-societies/{society_id}/events", cookies=princ_cookies)
            assert resp.status_code == 200, f"Principal society events failed: {resp.text}"
            p_data = resp.json()
            assert any(e["id"] == event_id for e in p_data.get("events", [])), "Event not found for principal"
            print(f"[PASS] GET /principal/professional-societies/{society_id}/events -> OK")
        else:
            print("[SKIP] No principal user in DB to test with")

        # Test isolation: Ensure HOD cannot access society coordinator endpoints
        print("\n--- Testing Security Isolation (HOD Access Denial) ---")
        hod_user = await User.find_one(User.role == UserRole.HOD)
        if hod_user:
            hod_token = create_access_token(str(hod_user.id), hod_user.role.value)
            hod_cookies = {"access_token": hod_token}
            resp = await client.get(f"/societies/{society_id}/events", cookies=hod_cookies)
            assert resp.status_code in (403, 404), f"HOD should not have access: {resp.status_code}"
            print(f"[PASS] HOD access properly denied with status {resp.status_code}")

        # 6. Student Endpoints
        print("\n--- Testing Student Upcoming Events & Registration ---")
        student_user = await User.find_one(User.role == UserRole.STUDENT)
        if student_user:
            student_token = create_access_token(str(student_user.id), student_user.role.value)
            student_cookies = {"access_token": student_token}

            # Fetch upcoming society events
            resp = await client.get("/student/upcoming-society-events", cookies=student_cookies)
            assert resp.status_code == 200, f"Student upcoming events failed: {resp.text}"
            soc_upcoming = resp.json()
            assert any(e["id"] == event_id for e in soc_upcoming), f"Society event {event_id} not in upcoming list: {soc_upcoming}"
            print(f"[PASS] GET /student/upcoming-society-events -> {len(soc_upcoming)} events found")

            # Register for society event
            resp = await client.post(
                f"/student/society-events/{event_id}/register",
                params={"type": "participant"},
                cookies=student_cookies,
            )
            assert resp.status_code == 200, f"Registration failed: {resp.text}"
            print(f"[PASS] POST /student/society-events/{event_id}/register -> {resp.json().get('message')}")

            # Verify registration is marked in upcoming list
            resp = await client.get("/student/upcoming-society-events", cookies=student_cookies)
            registered_event = next((e for e in resp.json() if e["id"] == event_id), None)
            assert registered_event and registered_event["is_registered"] is True
            print("[PASS] Verified is_registered == True for student")

            # Cancel registration
            resp = await client.post(
                f"/student/society-events/{event_id}/cancel-registration",
                cookies=student_cookies,
            )
            assert resp.status_code == 200, f"Cancel failed: {resp.text}"
            print(f"[PASS] POST /student/society-events/{event_id}/cancel-registration -> OK")

        # 6b. Principal Dashboard Endpoints & Drill-Down
        print("\n--- Testing Principal Professional Societies Endpoints ---")
        princ_user = await User.find_one(User.role == UserRole.PRINCIPAL)
        if not princ_user:
            princ_user = User(
                username="temp_princ_verify",
                name="Principal Verify",
                email="princ.verify@psgitech.ac.in",
                role=UserRole.PRINCIPAL,
                is_active=True,
            )
            princ_user.set_password("Password123!")
            await princ_user.insert()

        princ_token = create_access_token(str(princ_user.id), princ_user.role.value)
        princ_cookies = {"access_token": princ_token}

        # List societies as Principal
        resp = await client.get("/principal/professional-societies", cookies=princ_cookies)
        assert resp.status_code == 200, f"Principal societies list failed: {resp.text}"
        princ_soc_list = resp.json()
        target_soc = next((s for s in princ_soc_list if s["society_id"] == society_id or s.get("id") == society_id), None)
        assert target_soc is not None, f"Created society not found in principal list: {princ_soc_list}"
        print(f"[PASS] GET /principal/professional-societies -> Found society: {target_soc['society_name']}, events: {target_soc['total_conducted_events']}")

        # Society events drilldown as Principal
        resp = await client.get(f"/principal/professional-societies/{society_id}/events", cookies=princ_cookies)
        assert resp.status_code == 200, f"Principal society events drilldown failed: {resp.text}"
        soc_events_drill = resp.json()
        assert soc_events_drill["society_id"] == society_id
        assert any(e["id"] == event_id for e in soc_events_drill["events"])
        print(f"[PASS] GET /principal/professional-societies/{society_id}/events -> Returned {len(soc_events_drill['events'])} events")

        # 6c. Role Isolation Verification (HOD and Student Affairs strictly blocked)
        print("\n--- Testing Role Isolation (HOD and Student Affairs Blocked) ---")
        hod_user = await User.find_one(User.role == UserRole.HOD)
        if hod_user:
            hod_token = create_access_token(str(hod_user.id), hod_user.role.value)
            resp = await client.get("/principal/professional-societies", cookies={"access_token": hod_token})
            assert resp.status_code == 403, f"Expected 403 for HOD, got {resp.status_code}"
            print("[PASS] Role Isolation: HOD cannot access /principal/professional-societies (403 Forbidden)")

        sa_user = await User.find_one(User.role == UserRole.STUDENT_AFFAIRS)
        if sa_user:
            sa_token = create_access_token(str(sa_user.id), sa_user.role.value)
            resp = await client.get("/principal/professional-societies", cookies={"access_token": sa_token})
            assert resp.status_code == 403, f"Expected 403 for Student Affairs, got {resp.status_code}"
            print("[PASS] Role Isolation: Student Affairs cannot access /principal/professional-societies (403 Forbidden)")

        # 7. Memberships & Office Bearers
        print("\n--- Testing Memberships and Office Bearers ---")
        if student_user:
            # Create a membership directly
            test_membership = StudentSocietyMembership(
                society_id=PydanticObjectId(society_id),
                society_name="IEEE Computer Society Test",
                student_id=student_user.id,
                student_name=student_user.name,
                student_email=student_user.email,
                status=SocietyMembershipStatus.APPROVED,
            )
            await test_membership.insert()

            # Active members list
            resp = await client.get("/society-coordinator/active-members", cookies=coord_cookies)
            assert resp.status_code == 200
            active_members = resp.json()
            assert any(m["student_email"] == student_user.email for m in active_members)
            print(f"[PASS] GET /society-coordinator/active-members -> {len(active_members)} active members")

            # Office bearers list
            resp = await client.get("/society-coordinator/office-bearers", cookies=coord_cookies)
            assert resp.status_code == 200
            print(f"[PASS] GET /society-coordinator/office-bearers -> {len(resp.json()['positions'])} positions")

            # Assign office bearer
            resp = await client.post(
                "/society-coordinator/office-bearers",
                json={
                    "position": "President",
                    "student_id": str(student_user.id),
                },
                cookies=coord_cookies,
            )
            assert resp.status_code == 200, f"Assign office bearer failed: {resp.text}"
            print(f"[PASS] POST /society-coordinator/office-bearers -> {resp.json().get('message')}")

            # Verify in active members or office bearers
            resp = await client.get("/society-coordinator/office-bearers", cookies=coord_cookies)
            bearers = resp.json()["office_bearers"]
            assert any(b["position"] == "President" and b["student_email"] == student_user.email for b in bearers)
            print("[PASS] Verified President role assigned to student")

            # Tutor Student Roster check (verify third column data: society_memberships)
            tutor_user = await User.find_one(User.role == UserRole.TUTOR)
            if tutor_user:
                tutor_token = create_access_token(str(tutor_user.id), tutor_user.role.value)
                tutor_cookies = {"access_token": tutor_token}
                resp = await client.get("/tutor/students", cookies=tutor_cookies)
                assert resp.status_code == 200
                st_data = resp.json()
                assert len(st_data) > 0, "No students returned for tutor"
                assert "society_memberships" in st_data[0], "society_memberships missing from /tutor/students response"
                print(f"[PASS] GET /tutor/students -> returns society_memberships: {st_data[0].get('society_memberships')}")

            # Unassign office bearer
            resp = await client.delete(
                "/society-coordinator/office-bearers/President",
                cookies=coord_cookies,
            )
            assert resp.status_code == 200
            print("[PASS] DELETE /society-coordinator/office-bearers/President -> Unassigned")

            # Clean up test membership
            await test_membership.delete()

        # 8. Clean up created test entities
        print("\n--- Cleaning up test records ---")
        await client.delete(f"/societies/{society_id}/events/{event_id}", cookies=coord_cookies)
        await client.delete(f"/admin/professional-societies/{society_id}", cookies=admin_cookies)
        deleted_coord = await User.get(coord_user_id)
        assert deleted_coord is None, "Coordinator user should be deleted by cascade"
        print("[PASS] Cascade deletion of society and coordinator verified cleanly")

    print("\n" + "=" * 60)
    print("ALL API ENDPOINTS & FLOWS VERIFIED SUCCESSFULLY WITH ZERO ERRORS!")
    print("=" * 60)


async def run_verification():
    await connect_db()
    try:
        await cleanup_test_records()
        await _run_verification()
    finally:
        try:
            await cleanup_test_records()
        finally:
            await disconnect_db()


if __name__ == "__main__":
    asyncio.run(run_verification())
