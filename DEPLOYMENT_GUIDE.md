# EasyAccommodation Deployment Guide for Render

This guide will walk you through deploying your EasyAccommodation app to Render (first-time deployment).

## Prerequisites

1. **GitHub Account**: Create one at https://github.com if you don't have it
2. **Render Account**: Sign up at https://render.com (free tier available)
3. **Git Repository**: Push your code to GitHub

## Step 1: Prepare Your Code for GitHub

### 1.1 Initialize Git Repository (if not already done)

```bash
cd /home/thewizard/EasyAccommodation
git init
```

### 1.2 Create .gitignore file

Create a file named `.gitignore` in the root directory:

```
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
.venv

# Flask
instance/
.webassets-cache

# Environment variables (IMPORTANT - Don't commit secrets!)
.env
.env.local
.env.production.local

# Node.js
node_modules/
npm-debug.log
yarn-error.log

# Build files
frontend/dist/
frontend/build/

# IDE
.vscode/
.idea/
*.swp
*.swo

# Database
*.db
*.sqlite
*.sqlite3

# OS
.DS_Store
Thumbs.db

# Static uploads
backend/static/house_images/*
!backend/static/house_images/.gitkeep
```

### 1.3 Create .gitkeep for static folders

```bash
mkdir -p backend/static/house_images
touch backend/static/house_images/.gitkeep
```

### 1.4 Commit and Push to GitHub

```bash
git add .
git commit -m "Initial commit for deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/EasyAccommodation.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy Backend to Render

### 2.1 Create PostgreSQL Database

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Fill in:
   - **Name**: `easyaccommodation-db`
   - **Database**: `easyaccommodation`
   - **User**: `easyaccom_user` (or leave default)
   - **Region**: Choose closest to your users
   - **Plan**: Free (or paid for better performance)
4. Click **"Create Database"**
5. **IMPORTANT**: Copy the **Internal Database URL** (starts with `postgresql://`)

### 2.2 Create Backend Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Fill in:
   - **Name**: `easyaccommodation-backend`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `chmod +x build.sh && ./build.sh`
   - **Start Command**: `gunicorn app:app`
   - **Plan**: Free (or paid)

4. **Environment Variables** - Click "Advanced" → "Add Environment Variable":

```
FLASK_ENV=production
SECRET_KEY=<generate-a-random-long-string>
JWT_SECRET_KEY=<generate-another-random-long-string>
DATABASE_URL=<paste-the-internal-database-url-from-step-2.1>
SENDGRID_API_KEY=your_sendgrid_api_key_here
ADMIN_EMAIL=magomobenam765@gmail.com
FROM_EMAIL=magomobenam765@gmail.com
FRONTEND_BASE_URL=<will-add-after-frontend-deployment>
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**To generate random keys**, run in terminal:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

5. Click **"Create Web Service"**
6. Wait for deployment (5-10 minutes)
7. **Copy the backend URL** (e.g., `https://easyaccommodation-backend.onrender.com`)

### 2.3 Update FRONTEND_BASE_URL

1. Go back to your backend service
2. Go to "Environment" tab
3. Update `FRONTEND_BASE_URL` to your frontend URL (will get this in next step)

## Step 3: Deploy Frontend to Render

### 3.1 Update Frontend Environment

Before deploying, update `frontend/.env.production`:

```
VITE_API_BASE_URL=https://easyaccommodation-backend.onrender.com/api
```

Commit and push:
```bash
git add frontend/.env.production
git commit -m "Update production API URL"
git push
```

### 3.2 Create Frontend Static Site

1. Click **"New +"** → **"Static Site"**
2. Connect your GitHub repository
3. Fill in:
   - **Name**: `easyaccommodation-frontend`
   - **Region**: Same as backend
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. **Environment Variables**:
```
VITE_API_BASE_URL=https://easyaccommodation-backend.onrender.com/api
```

5. Click **"Create Static Site"**
6. Wait for deployment (5-10 minutes)
7. **Copy the frontend URL** (e.g., `https://easyaccommodation-frontend.onrender.com`)

### 3.3 Update Backend CORS Settings

1. Go to backend code → `backend/config.py`
2. Add your frontend URL to CORS_ORIGINS:

```python
CORS_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5173',
    'https://easyaccommodation-frontend.onrender.com',  # Add this
]
```

3. Commit and push:
```bash
git add backend/config.py
git commit -m "Add production frontend to CORS"
git push
```

4. Render will auto-deploy the changes

### 3.4 Update Backend FRONTEND_BASE_URL

1. Go to backend service on Render
2. Environment tab
3. Update `FRONTEND_BASE_URL=https://easyaccommodation-frontend.onrender.com`
4. Click "Save Changes"

## Step 4: Initialize Database

### 4.1 Create Admin User

1. Go to your backend service on Render
2. Click "Shell" tab
3. Run:

```bash
python
from app import app
from models import db, User
from werkzeug.security import generate_password_hash

with app.app_context():
    admin = User(
        full_name="System Admin",
        email="admin@easyaccommodation.com",
        phone="1234567890",
        user_type="admin",
        password_hash=generate_password_hash("Admin@123")
    )
    db.session.add(admin)
    db.session.commit()
    print("Admin created successfully!")
```

## Step 5: Test Your Deployment

1. Visit your frontend URL: `https://easyaccommodation-frontend.onrender.com`
2. Try registering a new account
3. Check if email verification works
4. Login with admin account
5. Test house listings, bookings, etc.

## Important Notes

### Free Tier Limitations

- **Backend**: Sleeps after 15 mins of inactivity (takes ~30 seconds to wake up)
- **Database**: 90 days expiry, 1GB storage limit
- **Static Site**: No limitations on free tier

### Keeping Backend Awake (Optional)

Use a service like UptimeRobot (free) to ping your backend every 5 minutes:
- URL to ping: `https://easyaccommodation-backend.onrender.com/api/health`

### Custom Domain (Optional)

1. Buy a domain (e.g., from Namecheap, GoDaddy)
2. In Render, go to Settings → Custom Domains
3. Add your domain and configure DNS records

### Environment Variables Security

- **NEVER** commit `.env` files to GitHub
- Always use Render's Environment Variables for secrets
- Rotate your `SECRET_KEY` and `JWT_SECRET_KEY` regularly

### File Uploads

**Important**: Render's free tier doesn't persist uploaded files. For production:
- Use AWS S3, Cloudinary, or similar service for house images
- Update backend code to upload to cloud storage instead of local filesystem

### Database Backups

1. Go to your PostgreSQL database on Render
2. Click "Backups" tab
3. Enable automatic backups (paid plan required)
4. Or manually export database periodically

## Troubleshooting

### Backend not working?
- Check logs in Render dashboard
- Verify DATABASE_URL is set correctly
- Ensure all environment variables are present

### CORS errors?
- Verify frontend URL is in backend CORS_ORIGINS
- Check that FRONTEND_BASE_URL is set in backend

### Database connection failed?
- Use the **Internal Database URL** (not external)
- Verify backend and database are in same region

### Images not showing?
- For production, implement cloud storage (S3/Cloudinary)
- Current setup only works for development

## Next Steps After Deployment

1. ✅ Monitor application performance
2. ✅ Set up error tracking (e.g., Sentry)
3. ✅ Configure automated backups
4. ✅ Implement cloud storage for images
5. ✅ Add SSL certificate (Render does this automatically)
6. ✅ Set up domain name
7. ✅ Add analytics (Google Analytics)

## Cost Estimate

- **Free Tier**: $0/month (with limitations)
- **Starter Plan**: ~$25/month
  - Backend: $7/month
  - Database: $7/month
  - Frontend: Free
  - Storage (if needed): ~$5-10/month

## Support

- Render Docs: https://render.com/docs
- Flask Docs: https://flask.palletsprojects.com/
- React Docs: https://react.dev/

---

**Good luck with your deployment! 🚀**
