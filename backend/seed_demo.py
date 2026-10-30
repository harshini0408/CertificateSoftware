import asyncio
from app.database import connect_db, disconnect_db
from app.models.user import User, UserRole
from app.models.club import Club
from app.core.security import hash_password

async def seed():
    await connect_db()

    try:
        # Create dummy club
        club = await Club.find_one(Club.name == "Demo Club")
        if not club:
            club = await Club(name="Demo Club", slug="DEMO").insert()
            print("Created Demo Club")

        users = [
            {
                "username": "demoadmin",
                "name": "Admin User",
                "email": "superadminadmin@psgitech.ac.in",
                "password_hash": hash_password("Admin@123456"),
                "role": UserRole.SUPER_ADMIN
            },
            {
                "username": "clubdemo",
                "name": "Club Coordinator User",
                "email": "club@psgitech.ac.in",
                "password_hash": hash_password("demo1234"),
                "role": UserRole.CLUB_COORDINATOR,
                "club_id": club.id
            },
            {
                "username": "deptdemo",
                "name": "Dept Coordinator User",
                "email": "dept@psgitech.ac.in",
                "password_hash": hash_password("demo1234"),
                "role": UserRole.DEPT_COORDINATOR,
                "department": "Computer Science"
            },
            {
                "username": "studentdemo",
                "name": "Student User",
                "email": "student@psgitech.ac.in",
                "password_hash": hash_password("demo1234"),
                "role": UserRole.STUDENT,
                "registration_number": "21CS001",
                "batch": "2021-2025",
                "department": "Computer Science",
                "section": "A"
            },
            {
                "username": "studentdemo2",
                "name": "Student User2",
                "email": "student2@psgitech.ac.in",
                "password_hash": hash_password("demo1234"),
                "role": UserRole.STUDENT,
                "registration_number": "21CS002",
                "batch": "2021-2025",
                "department": "Computer Science",
                "section": "B"
            },
            {
                "username": "studentdemo3",
                "name": "Student User3",
                "email": "student3@psgitech.ac.in",
                "password_hash": hash_password("demo1234"),
                "role": UserRole.STUDENT,
                "registration_number": "21CS003",
                "batch": "2021-2025",
                "department": "Computer Science",
                "section": "C"
            }
        ]

        for u_data in users:
            username_user = await User.find_one(User.username == u_data["username"])
            email_user = await User.find_one(User.email == u_data["email"])
            if username_user and email_user and username_user.id != email_user.id:
                raise RuntimeError(
                    f"Cannot seed {u_data['username']}: username and email belong to different accounts."
                )

            user = username_user or email_user
            if user:
                for field, value in u_data.items():
                    setattr(user, field, value)
                await user.save()
                print(f"Updated {u_data['role'].value} demo account: {u_data['username']}")
            else:
                await User(**u_data).insert()
                print(f"Created {u_data['role'].value}: {u_data['username']}")
    finally:
        await disconnect_db()

if __name__ == "__main__":
    asyncio.run(seed())
