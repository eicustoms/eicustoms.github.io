# Railway Deployment Guide

This guide explains how to deploy your watch site backend + frontend to Railway with a custom domain.

## Prerequisites

- GitHub account (fork/push your repo there)
- Railway account (free: https://railway.app)
- Gmail account (for email notifications - optional)

---

## Step 1: Set Up Environment Variables Locally

Create a `.env` file in your project root (copy from `.env.example`):

```
PORT=3000
ADMIN_PASSWORD=your-secure-password-here
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

**For Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification" if not already done
3. Go to "App passwords" (at the bottom of Security)
4. Select "Mail" and "Windows Computer"
5. Copy the 16-character password into `EMAIL_PASSWORD`

**Don't commit `.env` to GitHub** - Railway will read it from their dashboard.

---

## Step 2: Install Dependencies Locally (First Time Only)

```bash
npm install
```

This installs express, nodemailer, and dotenv.

---

## Step 3: Test Locally

```bash
npm start
```

Your server should run on `http://localhost:3000`

**Test the admin panel:**
1. Visit `http://localhost:3000/admin`
2. Login with your `ADMIN_PASSWORD`
3. Submit a contact form on the main site
4. Check if it appears in the admin panel

---

## Step 4: Push to GitHub

Make sure all your files are on GitHub:

```bash
git add .
git commit -m "Add admin panel and email notifications"
git push origin main
```

**Important:** Add `.env` to `.gitignore` so it doesn't get committed:

```
.env
node_modules/
submissions.json
```

---

## Step 5: Deploy to Railway

1. **Go to https://railway.app and sign up**

2. **Create a new project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account
   - Select your watchsite repo

3. **Railway will auto-detect Node.js** - just confirm

4. **Add Environment Variables:**
   - Go to "Variables" tab in your Railway project
   - Add:
     ```
     ADMIN_PASSWORD=your-secure-password
     EMAIL_USER=your-email@gmail.com
     EMAIL_PASSWORD=your-gmail-app-password
     NODE_ENV=production
     DATA_DIR=/data
     ```

   - `DATA_DIR` tells the app where to store runtime JSON and uploaded images.

5. **Add persistent storage:**
   - In Railway, add the "Persistent Storage" plugin to your project.
   - Mount the storage at `/data`.
   - This keeps `submissions.json`, `homepage-comments.json`, `image-optimizer-config.json`, `gallery-metadata.json`, and uploaded images persistent across redeploys.

6. **Deploy:**
   - Railway auto-deploys after you push to GitHub
   - Your site will be live at: `https://your-project-name.railway.app`

---

## Step 6: Add a Custom Domain (Later)

Once you buy a domain (e.g., eitanisaaccustoms.com):

1. **Go to your Railway project → "Settings"**
2. **Click "Domains"**
3. **Add your custom domain**
4. **Railway shows you DNS settings** - update your domain registrar's DNS to point to Railway

(Full guide: https://docs.railway.app/deploy/deployments#custom-domains)

---

## Testing Your Deployed Site

1. Visit `https://your-domain.com` - your main site
2. Fill out contact form - you should get an email
3. Visit `https://your-domain.com/admin` - login and see submissions

---

## Troubleshooting

**Submissions not showing in admin?**
- Check Railway logs (project → "Logs" tab)
- Verify `ADMIN_PASSWORD` is set

**No email received?**
- Check EMAIL_USER and EMAIL_PASSWORD are correct
- Gmail requires app password (not regular password)
- Check spam folder

**Site offline?**
- Check Railway project status
- View logs for errors
- Ensure `.env` variables are set

---

## Next Steps

1. Deploy to Railway ✓
2. Add your custom domain
3. Monitor submissions via admin panel
4. Add more features (delete submissions, export CSV, etc.)

Questions? Check Railway docs: https://docs.railway.app
