# Setup Instructions

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your admin password and email settings.

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access the site:**
   - Main site: `http://localhost:3000`
   - Admin panel: `http://localhost:3000/admin`

---

## Features

✅ **Contact Form** - Saves submissions to `submissions.json`
✅ **Admin Panel** - Password-protected dashboard to view submissions
✅ **Email Notifications** - Automatically email you when someone submits
✅ **Custom Watch Designs** - Captures customizer selections with contact info

---

## Admin Panel

**Login:** `http://localhost:3000/admin`
- Default password: check your `.env` file (`ADMIN_PASSWORD`)
- View all submissions with timestamps
- See custom watch design details

---

## Email Setup (Optional)

To enable email notifications:

1. Use a Gmail account
2. Enable 2-Step Verification on your Google account
3. Generate an "App Password" at: https://myaccount.google.com/apppasswords
4. Add to `.env`:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   ```

---

## Deployment to Railway

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step Railway deployment guide.

**TL;DR:**
1. Push to GitHub
2. Connect repo to Railway
3. Add environment variables
4. Railway auto-deploys
5. Add custom domain later

---

## Files Structure

```
watchsite/
├── server.js          # Node.js backend (Express)
├── admin.html         # Admin panel UI
├── admin.js           # Admin panel logic
├── contact.html       # Contact form page
├── contact.js         # Contact form handling
├── style.css          # Styles
├── submissions.json   # Data file (auto-created)
├── .env               # Environment variables (local only)
├── .env.example       # Template for .env
├── package.json       # Dependencies
└── DEPLOYMENT.md      # Railway deployment guide
```

---

## Troubleshooting

**Submit button not working?**
- Is the server running? (`npm start`)
- Check browser console (F12 → Console tab)

**Admin panel shows "Unauthorized"?**
- Make sure you're using the correct `ADMIN_PASSWORD`

**Emails not sending?**
- Check `.env` has EMAIL_USER and EMAIL_PASSWORD
- Gmail requires an app-specific password, not your regular password

---

For more help, see DEPLOYMENT.md or contact support.
