# Testing Admin Verification Flow (Local Environment - No SendGrid)

This guide walks through testing the complete student verification flow without SendGrid configured.

## Overview

The verification flow has **two steps**:
1. **Email Verification** (normally via SendGrid) - we'll bypass this manually
2. **Admin Verification** (manual approval after reviewing proof of payment)

Only after **both verifications** can a student access areas/houses and make bookings.

---

## Prerequisites

- Backend running: `python backend/app.py`
- Frontend running: `cd frontend && npm run dev`
- Admin account created (or use existing admin credentials)

---

## Step-by-Step Testing

### 1. Register a Test Student

**Via Frontend (http://localhost:5173/register):**
- Navigate to registration page
- Fill in student details:
  - Full Name: `Test Student`
  - Email: `teststudent@example.com`
  - Phone: `0712345678` (or any valid format)
  - Student ID: `S12345`
  - Institution: `Test University`
  - Password: `password123`
  - User Type: **Student**
- Click "Register"

**Expected Result:**
- Registration succeeds
- Student can log in BUT:
  - Email is NOT verified (SendGrid email not sent in local mode)
  - Admin verification is NOT approved yet
  - Student can only see "Upload Proof of Payment" section

---

### 2. Manually Verify Student's Email (Bypass SendGrid)

Since SendGrid is not configured, manually mark the student's email as verified:

```bash
# From project root
python backend/utils/verify_student.py teststudent@example.com
```

**Expected Output:**
```
✅ Email verified for: Test Student (teststudent@example.com)
   Email Verified: True
   Admin Verified: False
   Status: Can only upload proof of payment
```

---

### 3. Student Uploads Proof of Payment

**Login as Student:**
- Navigate to http://localhost:5173/login
- Email: `teststudent@example.com`
- Password: `password123`

**After Login:**
- You'll see the Student Dashboard
- Notice the message: "Your account is pending admin verification"
- You **CANNOT** view areas/houses yet (blocked)
- You **CAN** see "Upload Proof of Payment" section

**Upload Payment Proof:**
1. Read the payment instructions:
   - Monthly Subscription: $5
   - Ecocash: 0787690803 (Benam Magomo)
   - Bank: 263787690803840
2. Click "Choose File" and select an image (screenshot of payment)
3. Click "Upload Proof"

**Expected Result:**
- Success message appears
- Proof is uploaded and stored in `backend/static/payment_proofs/`
- Status remains "pending admin verification"

---

### 4. Admin Reviews Payment Proof

**Login as Admin:**
- Navigate to http://localhost:5173/login
- Use admin credentials
- Navigate to Admin Dashboard

**Review Proof:**
1. Look at the "Pending Payment Proofs" section (or click "Review Payment Proofs" button)
2. You should see the student's proof listed
3. Click "Review" button
4. Modal opens showing:
   - Student name and email
   - Uploaded payment proof image
5. Click **"Accept"** to verify the student

**Expected Result:**
- Backend sets `admin_verified = True` for the student
- Backend sends verification email (if SendGrid configured - will silently fail in local mode)
- Proof status changes to "accepted"
- Student is now **fully verified**

**Alternatively - Quick Toggle (Testing Only):**
In the Admin Dashboard "Students" section:
- Each student now shows verification badges:
  - `✓ Email` (green) or `✗ Email` (gray)
  - `✓ Admin` (blue) or `⏳ Pending` (yellow)
- Click the `✓ Verify` button next to unverified student
- This instantly toggles their admin_verified status (useful for quick testing)

---

### 5. Verify Student Can Now Access Full Dashboard

**Refresh Student Dashboard (or wait ~15 seconds):**
- The frontend polls the profile every 15 seconds
- Once admin accepts, student's UI automatically updates

**Student Should Now See:**
- ✅ "Account Status: Verified"
- ✅ Can view Areas button (unlocked)
- ✅ Can browse houses
- ✅ Can make inquiries/bookings
- ✅ Full access to student features

**Test Navigation:**
- Click "Browse Areas" → should load residential areas
- Click on an area → should show houses
- Click "View Details" on a house → should show house details
- Try making an inquiry → should succeed

---

## Admin Dashboard Features

### Registered Students Table

The Students section now shows:

| Student Name | Email | Badges | Actions |
|-------------|-------|--------|---------|
| Test Student | test@example.com | `✓ Email` `⏳ Pending` | Verify / Delete / Edit |

**Verification Badges:**
- `✓ Email` (green) - Email verified
- `✗ Email` (gray) - Email NOT verified
- `✓ Admin` (blue) - Admin verified (full access)
- `⏳ Pending` (yellow) - Waiting admin approval

**Quick Actions:**
- **✓ Verify / ✗ Unverify** - Toggle admin verification instantly
- **Delete** - Remove student (deactivate or permanent delete)
- **Edit** - Update student details

**Click to Expand:**
- Click student name to see full details:
  - Student ID
  - Institution
  - Phone number
  - Registration date
  - Email verified date/time
  - Admin verified date/time
  - Active status

---

## Testing Scenarios

### Scenario 1: Unverified Student Tries to Access Areas
**Steps:**
1. Register new student
2. Do NOT verify email
3. Do NOT upload/accept proof
4. Try to click "Browse Areas"

**Expected:**
- Blocked with 403 error
- Message: "Account pending admin verification. Upload proof of payment and wait for admin approval."

---

### Scenario 2: Email Verified But Not Admin Verified
**Steps:**
1. Register student
2. Manually verify email: `python backend/utils/verify_student.py email@example.com`
3. Do NOT upload proof or get admin approval
4. Try to access areas

**Expected:**
- Still blocked
- Can only upload proof of payment
- Cannot browse areas/houses

---

### Scenario 3: Complete Verification Flow
**Steps:**
1. Register student
2. Verify email (manual script)
3. Upload proof of payment
4. Admin accepts proof
5. Student dashboard refreshes

**Expected:**
- ✅ Full access granted
- Can browse areas/houses
- Can make bookings
- All student features unlocked

---

### Scenario 4: Admin Rejects Proof
**Steps:**
1. Student uploads proof
2. Admin clicks "Reject"
3. Check student status

**Expected:**
- Proof marked as "rejected"
- Student remains `admin_verified = False`
- Student must upload new proof
- Student still cannot access areas/houses

---

## Quick Testing Commands

```bash
# 1. Start backend
python backend/app.py

# 2. Start frontend (separate terminal)
cd frontend
npm run dev

# 3. Verify a student's email (bypass SendGrid)
python backend/utils/verify_student.py student@example.com

# 4. Check student verification status in Python shell
python
>>> from backend.app import app
>>> from backend.models import db, User
>>> with app.app_context():
...     user = User.query.filter_by(email='student@example.com').first()
...     print(f"Email Verified: {user.email_verified}")
...     print(f"Admin Verified: {user.admin_verified}")
```

---

## Database Inspection

**Check verification fields directly:**

```bash
# SQLite (if using SQLite)
sqlite3 backend/accommodation.db
> SELECT full_name, email, email_verified, admin_verified FROM users WHERE user_type='student';

# Or use Python:
python
>>> from backend.app import app
>>> from backend.models import db, User
>>> with app.app_context():
...     students = User.query.filter_by(user_type='student').all()
...     for s in students:
...         print(f"{s.full_name}: email={s.email_verified}, admin={s.admin_verified}")
```

---

## Troubleshooting

### Student Can't Log In
- **Check:** Email must be verified (run verify_student.py script)
- Login is NOT blocked by admin verification, only by email verification

### Student Still Blocked After Admin Accepts
- **Wait:** Frontend polls every 15 seconds
- **Or:** Manually refresh page (logout/login)
- **Check:** Backend logs to confirm admin_verified was set to True

### Admin Dashboard Not Showing Verification Badges
- **Check:** Frontend is using `adminAPI.getStudentsWithVerification()` (new endpoint)
- **Refresh:** Click refresh button or reload page
- **Console:** Check browser console for API errors

### Images Not Loading in Review Modal
- **Check:** Backend serving static files at `/static/payment_proofs/`
- **Check:** Frontend using absolute URL: `http://localhost:5000/static/payment_proofs/filename`
- **Test:** Open image URL directly in browser

---

## Success Criteria

✅ Student can register
✅ Email verification can be bypassed with manual script
✅ Student can upload proof of payment
✅ Admin can view proof in dashboard
✅ Admin can accept/reject proof
✅ After acceptance, student gains full access
✅ Admin dashboard shows verification badges
✅ Quick toggle button works for testing
✅ Students table shows verified/unverified status clearly

---

## Next Steps (After Testing)

Once local testing is complete:

1. **Configure SendGrid:**
   - Get SendGrid API key
   - Set environment variables:
     ```bash
     export SENDGRID_API_KEY="your_key"
     export FROM_EMAIL="noreply@yourdomain.com"
     export FRONTEND_BASE_URL="http://localhost:5173"
     ```
   - Test email delivery

2. **Deploy to Production:**
   - Configure environment variables on server
   - Verify email links work with production frontend URL
   - Test full flow end-to-end

3. **Optional Enhancements:**
   - Add admin comments on rejection
   - Email notifications for rejection
   - Proof upload history
   - Re-upload after rejection
   - Admin notes/messages

---

## Support

If you encounter issues:
- Check backend terminal for errors
- Check frontend browser console
- Verify all verification status fields in database
- Ensure both servers are running
- Check file permissions for payment_proofs folder

**Admin Contact:**
- Benam Magomo
- Email: magomobenam765@gmail.com
- Phone: +263787690803
