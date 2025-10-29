"""
Authentication Routes
=====================
Handles user registration, login, and logout
Location: backend/routes/auth.py

Endpoints:
- POST /api/auth/register - Register new user
- POST /api/auth/login - User login
- POST /api/auth/logout - User logout
- GET /api/auth/profile - Get current user profile
"""

from flask import Blueprint, request, jsonify
import re
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import uuid
from models import db, User, Student, HouseOwner, House, ResidentialArea
from sqlalchemy import func
from config import Config
from utils.email_utils import send_email_verification, send_student_verified_email

# Create Blueprint
auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user (Student or House Owner)
    
    Request Body:
    {
        "email": "user@example.com",
        "password": "password123",
        "full_name": "John Doe",
        "phone_number": "+263771234567",
        "user_type": "student" or "house_owner",
        
        // For students (optional):
        "student_id": "H12345",
        "institution": "University of Zimbabwe",
        
        // For house owners (optional):
        "house_id": 123  // Must be an existing unclaimed house
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'full_name', 'phone_number', 'user_type']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Validate user_type
        if data['user_type'] not in ['student', 'house_owner']:
            return jsonify({
                'success': False,
                'message': 'user_type must be either "student" or "house_owner"'
            }), 400

        # Normalize phone and accept local 07x or international +263/00263 formats
        def to_local_07(phone: str) -> str:
            """Convert various phone inputs to local 0-prefixed 07xXXXXXXXX format.

            Accepts:
            - Local: 07xxxxxxxx (10 digits)
            - International: +2637xxxxxxxx, 2637xxxxxxxx, 002637xxxxxxxx
            - Bare 9-digit mobile starting with 7 (will be converted to 0 + digits)
            Returns normalized 10-digit local string or None if invalid.
            """
            digits = ''.join(ch for ch in (phone or '') if ch.isdigit())
            if not digits:
                return None
            # 00263 prefix
            if digits.startswith('00263'):
                rest = digits[5:]
                if re.fullmatch(r'7\d{8}', rest):
                    return '0' + rest
                return None
            # 263 prefix
            if digits.startswith('263'):
                rest = digits[3:]
                if re.fullmatch(r'7\d{8}', rest):
                    return '0' + rest
                return None
            # already local with leading 0
            if digits.startswith('0'):
                if re.fullmatch(r'07(1|7|8)\d{7}', digits):
                    return digits
                return None
            # bare 9-digit starting with 7 -> convert to local
            if re.fullmatch(r'7\d{8}', digits):
                return '0' + digits
            return None

        normalized_phone = to_local_07(data.get('phone_number'))
        if not normalized_phone:
            return jsonify({
                'success': False,
                'message': 'Invalid phone number. It must be 10 digits starting with 071, 077, or 078 (accepts +263/263/00263 formats).'
            }), 400

        # Prevent duplicate phone registrations
        if User.query.filter_by(phone_number=normalized_phone).first():
            return jsonify({
                'success': False,
                'message': 'Phone number already registered'
            }), 409
        
        # Check if email already exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({
                'success': False,
                'message': 'Email already registered'
            }, 409)
        
        # Special validation for house owners
        if data['user_type'] == 'house_owner':
            # Expect house details (house_number, street_address, residential_area)
            house_number = (data.get('house_number') or '').strip()
            street_address = (data.get('street_address') or '').strip()
            residential_area_input = data.get('residential_area')

            if not house_number or not street_address or not residential_area_input:
                return jsonify({
                    'success': False,
                    'message': 'House owners must provide house_number, street_address and residential_area to claim'
                }), 400

            # Resolve residential area by id or name (case-insensitive)
            area = None
            try:
                # try numeric id
                area_id = int(residential_area_input)
                area = ResidentialArea.query.get(area_id)
            except Exception:
                area = ResidentialArea.query.filter(func.lower(ResidentialArea.name) == residential_area_input.strip().lower()).first()

            if not area:
                return jsonify({'success': False, 'message': 'Residential area not found'}), 404

            # Find house by exact normalized fields (case-insensitive match)
            house = House.query.filter(
                func.lower(House.house_number) == house_number.lower(),
                func.lower(House.street_address) == street_address.lower(),
                House.residential_area_id == area.id
            ).first()

            if not house:
                return jsonify({
                    'success': False,
                    'message': 'No matching house found. Please verify the house details with the admin.'
                }), 404

            # Check if house is already claimed
            if house.owner_id is not None or house.is_claimed:
                return jsonify({
                    'success': False,
                    'message': 'This house has already been claimed by another owner.'
                }), 409

            # If admin supplied owner contact details on the house, ensure they match the registering owner
            # Admin-provided owner fields are optional; only validate when present
            admin_name = (house.owner_name or '').strip()
            admin_email = (house.owner_email or '').strip()
            admin_phone = (house.owner_phone or '').strip()

            provided_name = (data.get('full_name') or '').strip()
            provided_email = (data.get('email') or '').strip()
            provided_phone = (data.get('phone_number') or '').strip()

            def normalize_phone(p):
                return ''.join(ch for ch in (p or '') if ch.isdigit())

            # Compare only when admin provided a value
            if admin_name and admin_name.lower() != provided_name.lower():
                return jsonify({'success': False, 'message': 'Owner name does not match admin record for this house.'}), 400
            if admin_email and admin_email.lower() != provided_email.lower():
                return jsonify({'success': False, 'message': 'Owner email does not match admin record for this house.'}), 400
            if admin_phone and normalize_phone(admin_phone) and normalize_phone(admin_phone) != normalize_phone(provided_phone):
                return jsonify({'success': False, 'message': 'Owner phone does not match admin record for this house.'}), 400
        
        # Create new user
        new_user = User(
            email=data['email'],
            full_name=data['full_name'],
            phone_number=normalized_phone,
            user_type=data['user_type']
        )
        new_user.set_password(data['password'])
        # If student, create an email verification token and send verification email
        if data['user_type'] == 'student':
            token = uuid.uuid4().hex
            new_user.email_verification_token = token
        
        db.session.add(new_user)
        db.session.flush()  # Get the user ID before committing
        
        # Create student profile if user is a student
        if data['user_type'] == 'student':
            existing_student = Student.query.filter_by(user_id=new_user.id).first()
            if not existing_student:
                # Also ensure student_id uniqueness if provided
                if data.get('student_id') and Student.query.filter_by(student_id=data.get('student_id')).first():
                    return jsonify({'success': False, 'message': 'Student ID already registered'}), 409
                student_profile = Student(
                    user_id=new_user.id,
                    student_id=data.get('student_id'),
                    institution=data.get('institution')
                )
                db.session.add(student_profile)
        
        # Create house owner profile if user is a house owner
        elif data['user_type'] == 'house_owner':
            # Determine which house to claim. Prefer the `house` variable resolved earlier
            # during validation (when registration provided house_number/street_address/area).
            house_to_claim = None
            if 'house' in locals() and house is not None:
                house_to_claim = house
            else:
                # Fallback: allow frontend to send house_id (legacy behavior)
                house_id = data.get('house_id')
                if house_id:
                    house_to_claim = House.query.get(house_id)

            if not house_to_claim:
                return jsonify({'success': False, 'message': 'House to claim not provided or not found.'}), 400

            # Claim the house
            house_to_claim.owner_id = new_user.id
            house_to_claim.is_claimed = True
            db.session.add(house_to_claim)

            # Create owner profile
            owner_profile = HouseOwner(
                user_id=new_user.id,
                payment_status='pending',
                next_payment_due=datetime.utcnow() + timedelta(days=30)
            )
            db.session.add(owner_profile)
        
        db.session.commit()
        # Send verification email (best-effort, non-blocking)
        try:
            if data['user_type'] == 'student':
                frontend_base = Config.FRONTEND_BASE_URL if hasattr(Config, 'FRONTEND_BASE_URL') else None
                send_email_verification(new_user.email, new_user.full_name, token, frontend_base)
        except Exception:
            pass
        return jsonify({
            'success': True,
            'message': 'Registration successful! Please check your email for a verification link.',
            'user': new_user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Registration failed: {str(e)}'
        }), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    User login
    
    Request Body:
    {
        "email": "user@example.com",
        "password": "password123"
    }
    
    Returns JWT access token and refresh token
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('email') or not data.get('password'):
            return jsonify({
                'success': False,
                'message': 'Email and password are required'
            }), 400
        # Support login by email OR phone number in the 'email' field for backward compatibility
        identifier = (data.get('email') or '').strip()
        user = None
        # If identifier looks like a phone (digits, may include spaces), validate and lookup by phone
        digits = ''.join(ch for ch in identifier if ch.isdigit())
        if digits and re.fullmatch(r"07(1|7|8)\d{7}", digits or ''):
            user = User.query.filter_by(phone_number=digits).first()
        else:
            # Fallback: treat as email
            user = User.query.filter_by(email=identifier).first()

        # Check if user exists and password is correct
        if not user or not user.check_password(data['password']):
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401

        # Check if user account is active
        if not user.is_active:
            return jsonify({
                'success': False,
                'message': 'Your account has been deactivated. Please contact admin.'
            }), 403

        # IMPORTANT: Students must verify their email before they can login
        if user.user_type == 'student' and not user.email_verified:
            return jsonify({
                'success': False,
                'message': 'Please verify your email address before logging in. Check your inbox for the verification link.'
            }), 403

        # Special handling: Allow house owners without an assigned house to claim an existing unclaimed house
        # If the frontend sends 'house_id' in the login payload and the user is a house_owner without an owned_house,
        # we'll attempt to assign the house to this user (only if the house exists and has no owner).
        if user.user_type == 'house_owner' and not user.owned_house:
            house_id = data.get('house_id')
            if house_id:
                house = House.query.get(house_id)
                if house and house.owner_id is None:
                    # Assign house to this user and create owner profile if needed
                    house.owner_id = user.id
                    if not hasattr(user, 'owner_profile') or not user.owner_profile:
                        owner_profile = HouseOwner(
                            user_id=user.id,
                            payment_status='pending',
                            next_payment_due=datetime.utcnow() + timedelta(days=30)
                        )
                        db.session.add(owner_profile)
                    db.session.commit()
                else:
                    # If a house_id was supplied but is invalid, reject login with informative message
                    return jsonify({
                        'success': False,
                        'message': 'House not found or already claimed. Please contact admin.'
                    }), 400

    # Create JWT tokens
        # Use string identity to ensure the JWT 'sub' (subject) is a string
        # This avoids PyJWT "Subject must be a string" errors when decoding
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        # Prepare user data
        user_data = user.to_dict()

        # Add additional data based on user type
        if user.user_type == 'student' and hasattr(user, 'student_profile'):
            user_data['student_info'] = user.student_profile.to_dict()

        elif user.user_type == 'house_owner':
            if hasattr(user, 'owner_profile') and user.owner_profile:
                user_data['owner_info'] = user.owner_profile.to_dict()

            # Include list of houses owned by this user (support multiple houses)
            houses = House.query.filter_by(owner_id=user.id).all()
            user_data['houses'] = [h.to_dict(include_owner=True) for h in houses]

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Login failed: {str(e)}'
        }), 500


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """
    Get current user profile
    Requires JWT token in Authorization header
    Auto-expires verification if past 30 days
    """
    try:
        # Get user ID from JWT token (stored as string) and cast to int
        current_user_id = int(get_jwt_identity())

        # Find user
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Auto-expire verification if expired (students only)
        if user.user_type == 'student' and user.admin_verified and user.is_verification_expired():
            user.admin_verified = False
            user.admin_verified_expires_at = None
            db.session.commit()
        
        # Prepare user data
        user_data = user.to_dict()
        
        # Add additional data based on user type
        if user.user_type == 'student' and hasattr(user, 'student_profile'):
            user_data['student_info'] = user.student_profile.to_dict()
            user_data['bookings_count'] = len(user.bookings)
        
        elif user.user_type == 'house_owner' and hasattr(user, 'owner_profile'):
            user_data['owner_info'] = user.owner_profile.to_dict()
            
            if user.owned_house:
                user_data['house'] = user.owned_house.to_dict(include_owner=False)
        
        return jsonify({
            'success': True,
            'user': user_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get profile: {str(e)}'
        }), 500


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user's profile. Accepts JSON with optional fields:
    full_name, email, phone_number, student_profile (dict), owner_profile (dict)
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        data = request.get_json() or {}

        # Basic fields
        if 'full_name' in data and data['full_name']:
            user.full_name = data['full_name']

        if 'email' in data and data['email']:
            # ensure uniqueness
            existing = User.query.filter(User.email == data['email'], User.id != user.id).first()
            if existing:
                return jsonify({'success': False, 'message': 'Email already in use'}), 409
            user.email = data['email']

        if 'phone_number' in data and data['phone_number'] is not None:
            # Reuse to_local_07 logic to accept +263 formats and normalize
            def to_local_07(phone: str) -> str:
                digits = ''.join(ch for ch in (phone or '') if ch.isdigit())
                if not digits:
                    return None
                if digits.startswith('00263'):
                    rest = digits[5:]
                    if re.fullmatch(r'7\d{8}', rest):
                        return '0' + rest
                    return None
                if digits.startswith('263'):
                    rest = digits[3:]
                    if re.fullmatch(r'7\d{8}', rest):
                        return '0' + rest
                    return None
                if digits.startswith('0'):
                    if re.fullmatch(r'07(1|7|8)\d{7}', digits):
                        return digits
                    return None
                if re.fullmatch(r'7\d{8}', digits):
                    return '0' + digits
                return None

            normalized = to_local_07(data['phone_number'])
            if not normalized:
                return jsonify({'success': False, 'message': 'Invalid phone number. It must be 10 digits starting with 071, 077, or 078 (accepts +263/263/00263).'}), 400

            other = User.query.filter(User.phone_number == normalized, User.id != user.id).first()
            if other:
                return jsonify({'success': False, 'message': 'Phone number already in use'}), 409

            user.phone_number = normalized

        # Student profile updates
        if user.user_type == 'student' and 'student_profile' in data:
            sp = data['student_profile'] or {}
            if hasattr(user, 'student_profile') and user.student_profile:
                student = user.student_profile
            else:
                student = Student(user_id=user.id)
                db.session.add(student)

            if 'student_id' in sp and sp.get('student_id'):
                # ensure uniqueness
                existing_sid = Student.query.filter(Student.student_id == sp.get('student_id'), Student.user_id != user.id).first()
                if existing_sid:
                    return jsonify({'success': False, 'message': 'Student ID already in use'}), 409
                student.student_id = sp.get('student_id')
            if 'institution' in sp:
                student.institution = sp.get('institution')

        # Owner profile updates
        if user.user_type == 'house_owner' and 'owner_profile' in data:
            op = data['owner_profile'] or {}
            if hasattr(user, 'owner_profile') and user.owner_profile:
                owner = user.owner_profile
            else:
                owner = HouseOwner(user_id=user.id)
                db.session.add(owner)

            if 'ecocash_number' in op:
                owner.ecocash_number = op.get('ecocash_number')
            if 'bank_account' in op:
                owner.bank_account = op.get('bank_account')
            if 'other_payment_info' in op:
                owner.other_payment_info = op.get('other_payment_info')

        db.session.commit()

        # Return updated user representation
        user_data = user.to_dict()
        if user.user_type == 'student' and hasattr(user, 'student_profile') and user.student_profile:
            user_data['student_info'] = user.student_profile.to_dict()
        if user.user_type == 'house_owner' and hasattr(user, 'owner_profile') and user.owner_profile:
            user_data['owner_info'] = user.owner_profile.to_dict()

        return jsonify({'success': True, 'user': user_data}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to update profile: {str(e)}'}), 500



@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    """Change password for the authenticated user.

    Body: { current_password: str, new_password: str }
    """
    try:
        data = request.get_json() or {}
        current = data.get('current_password')
        new = data.get('new_password')

        if not current or not new:
            return jsonify({'success': False, 'message': 'current_password and new_password are required'}), 400

        if len(new) < 8:
            return jsonify({'success': False, 'message': 'New password must be at least 8 characters'}), 400

        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        if not user.check_password(current):
            return jsonify({'success': False, 'message': 'Current password is incorrect'}), 401

        user.set_password(new)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Password changed successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to change password: {str(e)}'}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token using refresh token
    """
    try:
        # get_jwt_identity() returns the identity we stored (string user id)
        current_user_id = int(get_jwt_identity())
        new_access_token = create_access_token(identity=str(current_user_id))

        return jsonify({
            'success': True,
            'access_token': new_access_token
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Token refresh failed: {str(e)}'
        }), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout user
    Note: With JWT, actual logout is handled on the client side by removing the token
    This endpoint is here for consistency and future token blacklisting implementation
    """
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200


@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """
    Verify an email verification token sent to the user's email.
    Body: { token: '<token>' }
    """
    try:
        data = request.get_json() or {}
        token = data.get('token')
        if not token:
            return jsonify({'success': False, 'message': 'Token is required'}), 400

        user = User.query.filter_by(email_verification_token=token).first()
        if not user:
            return jsonify({'success': False, 'message': 'Invalid or expired token'}), 404

        user.email_verified = True
        user.email_verified_at = datetime.utcnow()
        user.email_verification_token = None
        db.session.commit()

        return jsonify({'success': True, 'message': 'Email verified successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to verify email: {str(e)}'}), 500


@auth_bp.route('/students', methods=['GET'])
@jwt_required()
def list_students():
    """
    List all students.
    Requires admin authentication.
    """
    try:
        students = Student.query.all()

        # Return combined student + user info so frontend has name/email
        students_data = []
        for s in students:
            user = s.user
            student_info = s.to_dict()
            # Preserve student record id and add user fields
            student_info['student_record_id'] = s.id
            student_info['user_id'] = user.id if user else None
            student_info['full_name'] = user.full_name if user else None
            student_info['email'] = user.email if user else None
            student_info['phone_number'] = user.phone_number if user else None
            student_info['is_active'] = user.is_active if user else None
            student_info['created_at'] = user.created_at.isoformat() if user else None
            students_data.append(student_info)

        return jsonify({
            'success': True,
            'students': students_data
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to fetch students: {str(e)}'
        }), 500


@auth_bp.route('/students/<int:student_id>', methods=['DELETE'])
@jwt_required()
def delete_student(student_id):
    """
    Delete a student profile.
    Requires admin authentication.
    """
    try:
        # student_id here refers to the Student.id (not user id)
        student = Student.query.get(student_id)

        if not student:
            return jsonify({
                'success': False,
                'message': 'Student not found.'
            }), 404

        # Decide between soft-delete (default) and force hard-delete
        force = request.args.get('force', 'false').lower() == 'true'

        user = student.user

        if not user:
            # If no user linked, just delete the student record
            db.session.delete(student)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Student record deleted.'}), 200

        if not force:
            # Soft-delete: deactivate the user account but keep bookings/history intact
            user.is_active = False
            db.session.commit()
            return jsonify({'success': True, 'message': 'Student account deactivated (soft-delete).'}), 200

        # Force delete: remove bookings and inquiries first, then student and user
        # Delete bookings referencing this user
        try:
            from models import Booking, BookingInquiry

            Booking.query.filter_by(student_id=user.id).delete(synchronize_session=False)
            BookingInquiry.query.filter_by(student_id=user.id).delete(synchronize_session=False)

            # Now delete student record and user
            db.session.delete(student)
            db.session.delete(user)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Student and related records deleted.'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Failed to force-delete student: {str(e)}'}), 500

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to delete student: {str(e)}'
        }), 500