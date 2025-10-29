"""
Helper script to manually verify a student's email for local testing
(bypasses SendGrid requirement)

Usage:
    python backend/utils/verify_student.py <email>

Example:
    python backend/utils/verify_student.py student@example.com
"""

import sys
import os
from datetime import datetime

# Add parent directory to path to import models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import db, User
from app import app

def verify_student_email(email):
    """Mark a student's email as verified"""
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        
        if not user:
            print(f"❌ User not found: {email}")
            return False
        
        if user.user_type != 'student':
            print(f"❌ User {email} is not a student (type: {user.user_type})")
            return False
        
        # Mark email as verified
        user.email_verified = True
        user.email_verified_at = datetime.utcnow()
        user.email_verification_token = None  # Clear token
        
        db.session.commit()
        
        print(f"✅ Email verified for: {user.full_name} ({email})")
        print(f"   Email Verified: {user.email_verified}")
        print(f"   Admin Verified: {user.admin_verified}")
        print(f"   Status: {'Can access full dashboard' if user.admin_verified else 'Can only upload proof of payment'}")
        
        return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python backend/utils/verify_student.py <email>")
        print("\nThis script marks a student's email as verified for local testing")
        print("(bypasses SendGrid requirement)")
        sys.exit(1)
    
    email = sys.argv[1]
    success = verify_student_email(email)
    sys.exit(0 if success else 1)
