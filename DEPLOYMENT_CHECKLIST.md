# Quick Deployment Checklist

## ✅ Pre-Deployment Changes Made

- [x] Added `gunicorn` to requirements.txt
- [x] Created `build.sh` for Render
- [x] Added production config in `config.py`
- [x] Created `.env.production` for frontend
- [x] Updated `api.js` to use environment variables
- [x] Created comprehensive `.gitignore`
- [x] Added static file serving in `app.py`

## 📋 What You Need to Do

### 1. Push to GitHub (10 minutes)
```bash
cd /home/thewizard/EasyAccommodation
chmod +x prepare-deployment.sh
./prepare-deployment.sh

# Then follow the commands shown
```

### 2. Deploy Backend on Render (15 minutes)

**Database:**
- Go to https://render.com → New → PostgreSQL
- Name: `easyaccommodation-db`
- Copy the Internal Database URL

**Backend Service:**
- New → Web Service
- Connect GitHub repo
- Root Directory: `backend`
- Build: `chmod +x build.sh && ./build.sh`
- Start: `gunicorn app:app`
- Add Environment Variables (see DEPLOYMENT_GUIDE.md)

### 3. Deploy Frontend on Render (10 minutes)

- New → Static Site
- Connect GitHub repo
- Root Directory: `frontend`
- Build: `npm install && npm run build`
- Publish: `dist`
- Environment: `VITE_API_BASE_URL=<backend-url>/api`

### 4. Update CORS & URLs (5 minutes)

- Add frontend URL to backend `config.py` CORS_ORIGINS
- Set `FRONTEND_BASE_URL` in backend environment variables
- Commit and push changes

### 5. Create Admin User (5 minutes)

Use backend Shell on Render to create first admin

## 🔑 Environment Variables Needed

**Backend (.env on Render):**
```
FLASK_ENV=production
SECRET_KEY=<random-32-chars>
JWT_SECRET_KEY=<random-32-chars>
DATABASE_URL=<from-render-database>
SENDGRID_API_KEY=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
ADMIN_EMAIL=magomobenam765@gmail.com
FROM_EMAIL=magomobenam765@gmail.com
FRONTEND_BASE_URL=<frontend-url>
```

**Generate random keys:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## ⚠️ Important Notes

1. **Don't commit `.env` file** - Already in .gitignore
2. **Use Internal Database URL** - Not the external one
3. **Free tier sleeps** - First request takes ~30 seconds
4. **Files don't persist** - Need AWS S3/Cloudinary for images in production
5. **Database expires in 90 days** - On free tier

## 📚 Full Instructions

See `DEPLOYMENT_GUIDE.md` for complete step-by-step instructions.

## 🆘 Quick Help

**CORS errors?**
→ Add frontend URL to backend CORS_ORIGINS

**Database errors?**
→ Check DATABASE_URL is the Internal URL

**Images not working?**
→ Need to implement cloud storage (AWS S3)

**Backend slow?**
→ Free tier sleeps after 15 min (use UptimeRobot to keep awake)

---

**Total Deployment Time: ~45 minutes** ⏱️
