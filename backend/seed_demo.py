import asyncio
from app.database import connect_db, disconnect_db
from app.models.user import User, UserRole
from app.models.club import Club
from app.core.security import hash_password

async def seed():
    await connect_db()

    # Create dummy club
    club = await Club.find_one(Club.name == "Demo Club")
    if not club:
        club = await Club(name="Demo Club", description="A test club").insert()
        print("Created Demo Club")

    users = [
        {
            "username": "clubdemo",
            "name": "Club Coordinator User",
            "email": "club@example.com",
            "password_hash": hash_password("demo1234"),
            "role": UserRole.CLUB_COORDINATOR,
            "club_id": club.id
        },
        {
            "username": "deptdemo",
            "name": "Dept Coordinator User",
            "email": "dept@example.com",
            "password_hash": hash_password("demo1234"),
            "role": UserRole.DEPT_COORDINATOR,
            "department": "Computer Science"
        },
        {
            "username": "studentdemo",
            "name": "Student User",
            "email": "student@example.com",
            "password_hash": hash_password("demo1234"),
            "role": UserRole.STUDENT,
            "registration_number": "21CS001",
            "batch": "2021-2025",
            "department": "Computer Science",
            "section": "A"
        }
    ]

    for u_data in users:
        user = await User.find_one(User.username == u_data["username"])
        if user:
            user.password_hash = hash_password("demo1234")
            await user.save()
            print(f"Reset {u_data['role'].value} password for {u_data['username']}")
        else:
            await User(**u_data).insert()
            print(f"Created {u_data['role'].value}: {u_data['username']}")

    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(seed())
