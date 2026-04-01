# 🌐 MongoDB Basics & Team Sharing Guide

This guide will explain from the **absolute basics** how your project uses MongoDB, how to put your database on the cloud, and how to share it with your team members so everyone is working on the *same* data.

---

## 1. The Absolute Basics: Local vs. Cloud Database

Right now, your application is configured to use a **Local Database** (`mongodb://localhost:27017`).
- **Local:** The database lives *only on your laptop*. When your team member runs the app on their laptop, they get their own blank database. You are not sharing data.
- **Cloud (MongoDB Atlas):** The database lives on secure servers on the internet. You and all your team members connect to this *exact same database*. If you create a user, your team member instantly sees that user.

**To share the database with your team, you must move to the Cloud using MongoDB Atlas.**

---

## 2. How to Share the Database (Setting up MongoDB Atlas)

MongoDB Atlas is the official, free cloud service for MongoDB. Here is the step-by-step process to set it up:

### Step A: Create an Atlas Account
1. Go to [MongoDB Atlas (account.mongodb.com)](https://account.mongodb.com/account/register)
2. Sign up for a free account (you can use your Google account).
3. Once logged in, it may ask you a few survey questions (just select "Learning" or "Building a new application").

### Step B: Create a Free Database Cluster
1. You will be prompted to create a cluster. Choose the **"M0 Free"** tier (it's completely free forever).
2. Select a provider (AWS, Google Cloud, or Azure) and a region closest to you (e.g., AWS - Mumbai if you are in India).
3. Give your cluster a name (e.g., `CertificateCluster`) and click **Create**.

*Note: It takes about 1-3 minutes for the servers to provision your new database.*

---

## 3. How to Generate the Connection String

Now that your cloud database is running, you need a "key" to connect to it. This key is your **Connection String**.

### Step A: Create a Database User
1. In your Atlas dashboard, go to the **Security** section on the left sidebar and click **Database Access**.
2. Click **Add New Database User**.
3. Choose **Password** authentication.
4. Enter a username (e.g., `adminUser`).
5. Enter a password (or click "Autogenerate Secure Password" and **copy it somewhere safe**).
6. Under *Database User Privileges*, select **Read and write to any database**.
7. Click **Add User**.

### Step B: Allow Network Access (The Whitelist)
For security, Atlas blocks all connections by default. We need to tell it to allow your team to connect.
1. On the left sidebar, click **Network Access**.
2. Click **Add IP Address**.
3. To make it easy for your whole team to connect from anywhere, click **Allow Access from Anywhere** (this enters `0.0.0.0/0` into the box).
   *(Note: This means anyone with the password can connect. If you want maximum security, you would only add the specific IP addresses of your team members).*
4. Click **Confirm**.

### Step C: Get the Connection String
1. On the left sidebar, click **Database** (under Deployments).
2. Click the **Connect** button next to your cluster.
3. Choose **Drivers** as your connection method (since we are using Python/FastAPI for the backend).
4. You will see a connection string that looks like this:
   `mongodb+srv://adminUser:<password>@certificatecluster.abcde.mongodb.net/?retryWrites=true&w=majority&appName=CertificateCluster`
5. **Copy this entire string.**

---

## 4. How to Connect the Project to the Shared Database

Now you need to put this connection string into your project so your code knows where to find the database.

1. Open your `backend/.env` file.
2. Find the `MONGODB_URL` variable.
3. Replace the `localhost` URL with the string you just copied.
4. **CRITICAL:** Replace `<password>` in the connection string with the actual password you created for the database user. (Remove the `<` and `>` brackets!).

**Before:**
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=psgItech_certs
```

**After (Example):**
```env
MONGODB_URL=mongodb+srv://adminUser:MySuperSecretPassword123@certificatecluster.abcde.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=psgItech_certs
```

**Restart your application:** Stop the server if it's running, and run `python -m uvicorn app.main:app --reload` again. You are now successfully connected to the shared cloud database!

---

## 5. How to Share it with Others Working on the Project

To get your entire team working on this exact same database, you need to share the environment configuration with them.

**What your team members need to do:**

1. **Pull the latest code:** Have them pull your latest backend code from your GitHub repository.
2. **Do NOT put the `.env` file in GitHub:** Passwords should *never* go in public/shared code! Our `.gitignore` is already set up to hide the `.env` file, which is perfectly correct.
3. **Share the `.env` details privately:** Send your team members the completed text of your `.env` file directly via Slack, Discord, WhatsApp, or email.
4. **Team creates their local `.env`:** Each team member creates a new file called `.env` inside their local `backend/` folder and pastes exactly what you sent them:

```env
SECRET_KEY=your_shared_secret_key_here
MONGODB_URL=mongodb+srv://adminUser:MySuperSecretPassword123@certificatecluster.abcde.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=psgItech_certs
APP_ENV=development
```

5. **Start the app:** When your team members run the app locally, it will read that URL and connect to *your* MongoDB Atlas Cloud cluster.

Now, if Team Member A registers a new user or creates a certificate, Team Member B will immediately see that data in their application! You are all officially sharing the database.
