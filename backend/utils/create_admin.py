"""
Create Admin User Script
=========================
Run this script once to create the first admin user
Location: backend/utils/create_admin.py

Usage: python utils/create_admin.py
"""

import sys
import os

# Add parent directory to path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from models import db, User


def create_admin():
    """Create the first admin user"""
    
    with app.app_context():
        # Check if admin already exists
        existing_admin = User.query.filter_by(user_type='admin').first()
        
        if existing_admin:
            print(f"❌ Admin user already exists: {existing_admin.email}")
            return
        
        # Admin details
        print("\n" + "="*50)
        print("CREATE ADMIN USER")
        print("="*50)
        
        email = input("Admin Email (default: admin@easyaccommodation.com): ").strip()
        if not email:
            email = "admin@easyaccommodation.com"
        
        password = input("Admin Password (default: admin123): ").strip()
        if not password:
            password = "admin123"
        
        full_name = input("Admin Full Name (default: System Administrator): ").strip()
        if not full_name:
            full_name = "System Administrator"
        
        phone_number = input("Admin Phone (default: +263771234567): ").strip()
        if not phone_number:
            phone_number = "+263771234567"
        
        # Check if email already exists
        if User.query.filter_by(email=email).first():
            print(f"\n❌ User with email {email} already exists!")
            return
        
        # Create admin user
        admin = User(
            email=email,
            full_name=full_name,
            phone_number=phone_number,
            user_type='admin',
            is_active=True
        )
        admin.set_password(password)
        
        db.session.add(admin)
        db.session.commit()
        
        print("\n" + "="*50)
        print("✅ ADMIN USER CREATED SUCCESSFULLY!")
        print("="*50)
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"User ID: {admin.id}")
        print("="*50)
        print("\n⚠️  IMPORTANT: Change the default password after first login!")
        print(f"\nYou can now login at: http://localhost:5000/api/auth/login")
        print("="*50 + "\n")


if __name__ == '__main__':
    try:
        create_admin()
    except Exception as e:
        print(f"\n❌ Error creating admin: {e}")
        sys.exit(1)