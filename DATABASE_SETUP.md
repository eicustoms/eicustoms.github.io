# PostgreSQL Database Setup Guide

This guide walks you through setting up a PostgreSQL database locally, then deploying to Railway with a managed PostgreSQL instance.

---

## Step 1: Install PostgreSQL Locally

### Windows
1. Download from https://www.postgresql.org/download/windows/
2. Run the installer
3. Choose a password for the `postgres` user (remember it!)
4. Keep default port: `5432`
5. Accept the remaining defaults
6. After installation, verify it works:
   ```bash
   psql --version
   ```

### macOS
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

---

## Step 2: Create Local Database

In PowerShell or terminal, connect to PostgreSQL:

```bash
psql -U postgres
```

When prompted, enter the password you set during installation.

Inside the `psql` prompt, run:

```sql
CREATE DATABASE watchsite;
\q
```

This creates a new database called `watchsite` and exits.

---

## Step 3: Initialize Database Schema

Run the migration script to create tables:

```bash
psql -U postgres -d watchsite -f migrations/init.sql
```

Verify the tables were created:

```bash
psql -U postgres -d watchsite
\dt
\q
```

You should see 4 tables:
- `submissions`
- `comments`
- `gallery_metadata`
- `optimize_images`

---

## Step 4: Set Up Local `.env` File

Create or update `.env` in the project root:

```env
PORT=3000
ADMIN_PASSWORD=your-secure-password
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
DATABASE_URL=postgres://postgres:your-password@localhost:5432/watchsite
NODE_ENV=development
```

Replace:
- `your-password` with the PostgreSQL password you set during installation
- `your-email@gmail.com` and `your-gmail-app-password` with your Gmail credentials
- `your-secure-password` with a strong admin password

**Important:** Do NOT commit `.env` to GitHub. Ensure it's in `.gitignore`.

---

## Step 5: Test Locally

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

You should see:
```
✓ Database initialized
Server running on http://localhost:3000
```

Test the app:
1. Visit `http://localhost:3000`
2. Submit a contact form
3. Go to `http://localhost:3000/admin`
4. Login with your `ADMIN_PASSWORD`
5. See your submission in the admin panel

Check that data is saved in the database:

```bash
psql -U postgres -d watchsite
SELECT * FROM submissions;
\q
```

---

## Step 6: Deploy to Railway

### 6a. Push to GitHub

First, ensure your changes are committed:

```bash
git add .
git commit -m "Add PostgreSQL database support"
git push origin main
```

**Verify `.env` is NOT committed:**
```bash
git status
```

You should NOT see `.env` in the output.

### 6b. Create Railway Project

1. Go to https://railway.app
2. Sign in or create an account
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Connect your GitHub account and select your `watchsite` repo
6. Railway will auto-detect Node.js

### 6c. Add PostgreSQL to Railway

1. In your Railway project, click "Add"
2. Select "PostgreSQL"
3. Railway will provision a managed PostgreSQL instance
4. The connection string will automatically be available as `DATABASE_URL`

### 6d. Set Environment Variables

In your Railway project settings, go to "Variables" and add:

```
ADMIN_PASSWORD=your-secure-password
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
NODE_ENV=production
```

Railway will automatically provide `DATABASE_URL` from the PostgreSQL plugin.

### 6e. Deploy

Railway will auto-deploy when you push to GitHub. Check the "Deployments" tab to see logs.

Once deployed, visit:
- `https://your-railway-domain.com` (main site)
- `https://your-railway-domain.com/admin` (admin panel)

---

## Step 7: Verify Database on Railway

Once deployed, verify the database is working:

1. In Railway, find your PostgreSQL plugin details
2. You can connect via `psql` if needed:
   ```bash
   psql <CONNECTION_STRING_FROM_RAILWAY>
   SELECT * FROM submissions;
   ```

---

## What About Old JSON Files?

The app now prefers database storage but falls back to JSON files if `DATABASE_URL` is not set.

**Recommended cleanup:**
1. Once database is deployed and working, you can optionally delete the old JSON files from your repo:
   - `submissions.json`
   - `homepage-comments.json`
   - `gallery-metadata.json`
   - `image-optimizer-config.json`

2. Commit the deletion:
   ```bash
   git rm submissions.json homepage-comments.json gallery-metadata.json image-optimizer-config.json
   git commit -m "Remove obsolete JSON storage files"
   git push
   ```

The JSON files will remain locally for fallback, but won't be tracked in Git.

---

## Troubleshooting

### "Database initialization failed"
- Check `DATABASE_URL` is set correctly
- Verify PostgreSQL is running locally or on Railway
- Check database credentials in the connection string

### "Connection refused"
- Is PostgreSQL running? `psql -U postgres`
- Check port (default: 5432)
- Check firewall/network settings

### Data not persisting
- Verify `DATABASE_URL` is in environment variables
- Check that `initDb()` ran successfully in server logs
- Try submitting data and checking the database directly

### Railway deployment fails
- Check Railway logs: go to your project → "Deployments" tab
- Verify all environment variables are set
- Ensure PostgreSQL plugin is added to the project

---

## Next Steps

1. ✅ Database initialized locally
2. ✅ Environment variables configured
3. ✅ Server running with database
4. ✅ Data persisting through redeploys
5. (Optional) Add persistent image storage volume on Railway

If you want to also make image uploads persistent across redeploys, Railway offers "Persistent Storage" volumes. That's a separate step if needed.

---

## Questions?

- Railway docs: https://docs.railway.app
- PostgreSQL docs: https://www.postgresql.org/docs/
