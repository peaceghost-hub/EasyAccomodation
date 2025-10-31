"""
Admin Routes
============
Handles all administrative functions
Location: backend/routes/admin.py

Only accessible by users with user_type='admin'

Endpoints:
- POST /api/admin/residential-areas - Add new residential area
- GET /api/admin/residential-areas - Get all residential areas
- POST /api/admin/houses - Add new house
- GET /api/admin/houses - Get all houses
- PUT /api/admin/houses/<id> - Update house
- DELETE /api/admin/houses/<id> - Delete house
- GET /api/admin/users - Get all users
- PUT /api/admin/users/<id>/activate - Activate user
- PUT /api/admin/users/<id>/deactivate - Deactivate user
- GET /api/admin/subscriptions - Get all subscription payments
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from datetime import datetime, timedelta
import os
from werkzeug.utils import secure_filename
import math
from models import (
    db,
    User,
    Student,
    ResidentialArea,
    House,
    Room,
    HouseOwner,
    SubscriptionPayment,
    Booking,
    BookingInquiry,
    PaymentProof,
)
from models import AdminAudit
from utils.email_utils import send_admin_created_email
from utils.email_utils import send_student_verified_email, send_payment_proof_rejected_email
from config import Config

# Create Blueprint
admin_bp = Blueprint('admin', __name__)


def admin_required(fn):
    """
    Decorator to ensure only admins can access certain endpoints
    Usage: @admin_required above any route function
    """
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        # identity is stored as string; cast to int for DB lookup
        try:
            current_user_id = int(get_jwt_identity())
        except Exception:
            return jsonify({'success': False, 'message': 'Invalid token identity'}), 401

        user = User.query.get(current_user_id)
        
        if not user or user.user_type != 'admin':
            return jsonify({
                'success': False,
                'message': 'Admin access required'
            }), 403
        
        return fn(*args, **kwargs)
    
    return wrapper


# ==================== RESIDENTIAL AREAS ====================

@admin_bp.route('/residential-areas', methods=['POST'])
@admin_required
def add_residential_area():
    """
    Add a new residential area
    
    Request Body:
    {
        "name": "Avondale",
        "description": "Prime residential area near schools",
        "latitude": -17.8252,
        "longitude": 31.0335
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({
                'success': False,
                'message': 'Area name is required'
            }), 400
        
        # Check if area already exists
        if ResidentialArea.query.filter_by(name=data['name']).first():
            return jsonify({
                'success': False,
                'message': 'Residential area with this name already exists'
            }), 409
        
        # Validate coords if provided
        lat = data.get('latitude')
        lon = data.get('longitude')
        if lat is not None:
            try:
                lat = float(lat)
            except Exception:
                return jsonify({'success': False, 'message': 'Invalid latitude'}), 400
            if lat < -90 or lat > 90:
                return jsonify({'success': False, 'message': 'Latitude must be between -90 and 90'}), 400
        if lon is not None:
            try:
                lon = float(lon)
            except Exception:
                return jsonify({'success': False, 'message': 'Invalid longitude'}), 400
            if lon < -180 or lon > 180:
                return jsonify({'success': False, 'message': 'Longitude must be between -180 and 180'}), 400

        # Create new residential area
        area = ResidentialArea(
            name=data['name'],
            description=data.get('description'),
            latitude=lat,
            longitude=lon,
            approximate_distance_km=(
                float(data.get('approximate_distance_km')) if data.get('approximate_distance_km') not in (None, '') else None
            )
        )
        if area.approximate_distance_km is not None and area.approximate_distance_km < 0:
            return jsonify({'success': False, 'message': 'approximate_distance_km cannot be negative'}), 400

        # Auto-calc distance if manual distance not provided and coords exist
        if area.approximate_distance_km is None and area.latitude is not None and area.longitude is not None:
            CAMPUS_LAT = -19.516
            CAMPUS_LON = 29.833
            try:
                R = 6371.0
                d_lat = math.radians(CAMPUS_LAT - area.latitude)
                d_lon = math.radians(CAMPUS_LON - area.longitude)
                a = math.sin(d_lat/2)**2 + math.cos(math.radians(area.latitude)) * math.cos(math.radians(CAMPUS_LAT)) * math.sin(d_lon/2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                area.approximate_distance_km = round(R * c, 1)
            except Exception:
                pass
        
        db.session.add(area)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Residential area added successfully',
            'area': area.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to add residential area: {str(e)}'
        }), 500


@admin_bp.route('/residential-areas', methods=['GET'])
@jwt_required()
def get_residential_areas():
    """Get all residential areas"""
    try:
        areas = ResidentialArea.query.all()
        # Build dicts and sort using manual approximate first, else computed
        area_dicts = [a.to_dict() for a in areas]
        area_dicts.sort(key=lambda d: ((d.get('approximate_distance_km') is None and d.get('computed_distance_km') is None), d.get('approximate_distance_km') if d.get('approximate_distance_km') is not None else (d.get('computed_distance_km') or 0)))

        return jsonify({
            'success': True,
            'count': len(area_dicts),
            'areas': area_dicts
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get areas: {str(e)}'
        }), 500





@admin_bp.route('/residential-areas/<int:area_id>', methods=['DELETE'])
@admin_required
def delete_residential_area(area_id):
    """Delete a residential area and all houses inside it (along with bookings and rooms).

    This is permanent. Admin-only.
    """
    try:
        area = ResidentialArea.query.get(area_id)
        if not area:
            return jsonify({'success': False, 'message': 'Residential area not found'}), 404

        # Find houses in this area
        houses = House.query.filter_by(residential_area_id=area_id).all()

        # Import Booking and Room here to avoid circular import issues
        from models import Booking, Room

        # Delete dependent records for each house
        for h in houses:
            try:
                # Remove bookings for the house
                Booking.query.filter_by(house_id=h.id).delete(synchronize_session=False)
                db.session.flush()
            except Exception:
                db.session.rollback()
                return jsonify({'success': False, 'message': f'Failed to delete bookings for house {h.id}'}), 500

            try:
                # Remove rooms for the house
                Room.query.filter_by(house_id=h.id).delete(synchronize_session=False)
                db.session.flush()
            except Exception:
                db.session.rollback()
                return jsonify({'success': False, 'message': f'Failed to delete rooms for house {h.id}'}), 500

            try:
                # Finally remove the house
                db.session.delete(h)
                db.session.flush()
            except Exception:
                db.session.rollback()
                return jsonify({'success': False, 'message': f'Failed to delete house {h.id}'}), 500

        # Now delete the residential area itself
        try:
            db.session.delete(area)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Failed to delete residential area: {str(e)}'}), 500

        return jsonify({'success': True, 'message': 'Residential area and contained houses deleted.'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to delete residential area: {str(e)}'}), 500


@admin_bp.route('/residential-areas/<int:area_id>', methods=['PUT'])
@admin_required
def update_residential_area(area_id):
    """Update residential area: name, description, coordinates, approximate_distance_km.

    If approximate_distance_km is omitted or null and coords are present, auto-compute it.
    """
    try:
        area = ResidentialArea.query.get(area_id)
        if not area:
            return jsonify({'success': False, 'message': 'Residential area not found'}), 404

        data = request.get_json() or {}

        if 'name' in data and data['name']:
            # Check unique name constraint if changing name
            if data['name'] != area.name and ResidentialArea.query.filter_by(name=data['name']).first():
                return jsonify({'success': False, 'message': 'Residential area with this name already exists'}), 409
            area.name = data['name']
        if 'description' in data:
            area.description = data['description']

        if 'latitude' in data:
            if data['latitude'] in (None, ''):
                area.latitude = None
            else:
                try:
                    lat = float(data['latitude'])
                except Exception:
                    return jsonify({'success': False, 'message': 'Invalid latitude'}), 400
                if lat < -90 or lat > 90:
                    return jsonify({'success': False, 'message': 'Latitude must be between -90 and 90'}), 400
                area.latitude = lat

        if 'longitude' in data:
            if data['longitude'] in (None, ''):
                area.longitude = None
            else:
                try:
                    lon = float(data['longitude'])
                except Exception:
                    return jsonify({'success': False, 'message': 'Invalid longitude'}), 400
                if lon < -180 or lon > 180:
                    return jsonify({'success': False, 'message': 'Longitude must be between -180 and 180'}), 400
                area.longitude = lon

        approx_provided = 'approximate_distance_km' in data
        if approx_provided:
            if data['approximate_distance_km'] in (None, ''):
                area.approximate_distance_km = None
            else:
                try:
                    d = float(data['approximate_distance_km'])
                except Exception:
                    return jsonify({'success': False, 'message': 'Invalid approximate_distance_km'}), 400
                if d < 0:
                    return jsonify({'success': False, 'message': 'approximate_distance_km cannot be negative'}), 400
                area.approximate_distance_km = round(d, 1)

        # Auto-calc if manual not provided or cleared
        if (not approx_provided or area.approximate_distance_km is None) and area.latitude is not None and area.longitude is not None:
            CAMPUS_LAT = -19.516
            CAMPUS_LON = 29.833
            try:
                R = 6371.0
                d_lat = math.radians(CAMPUS_LAT - area.latitude)
                d_lon = math.radians(CAMPUS_LON - area.longitude)
                a = math.sin(d_lat/2)**2 + math.cos(math.radians(area.latitude)) * math.cos(math.radians(CAMPUS_LAT)) * math.sin(d_lon/2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                area.approximate_distance_km = round(R * c, 1)
            except Exception:
                pass

        db.session.commit()
        return jsonify({'success': True, 'message': 'Residential area updated', 'area': area.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to update residential area: {str(e)}'}), 500


# ==================== HOUSES ====================

@admin_bp.route('/houses', methods=['POST'])
@admin_required
def add_house():
    """
    Add a new house to the system
    
    Request Body:
    {
        "house_number": "12A",
        "street_address": "King George Road",
        "residential_area_id": 1,
        "latitude": -17.8252,
        "longitude": 31.0335,
        "rooms": [
            {"room_number": "1", "capacity": 2, "price_per_month": 150},
            {"room_number": "2", "capacity": 1, "price_per_month": 100},
            {"room_number": "3", "capacity": 4, "price_per_month": 200}
        ]
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['house_number', 'street_address', 'residential_area_id', 'latitude', 'longitude']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Validate residential area exists
        area = ResidentialArea.query.get(data['residential_area_id'])
        if not area:
            return jsonify({
                'success': False,
                'message': 'Residential area not found'
            }), 404
        
        # Create new house
        house = House(
            house_number=data['house_number'],
            street_address=data['street_address'],
            residential_area_id=data['residential_area_id'],
            latitude=data['latitude'],
            longitude=data['longitude'],
            is_verified=True,  # Admin-added houses are auto-verified
            is_active=True
        )
        # If admin provided owner details, store them for future owner claims
        owner_details = data.get('owner_details') or {}
        if owner_details:
            house.owner_name = owner_details.get('full_name')
            house.owner_email = owner_details.get('email')
            house.owner_phone = owner_details.get('phone_number')
            house.is_claimed = False
        
        db.session.add(house)
        db.session.flush()  # Get house ID before adding rooms
        
        # Add rooms if provided
        if data.get('rooms'):
            for room_data in data['rooms']:
                room = Room(
                    house_id=house.id,
                    room_number=room_data['room_number'],
                    capacity=room_data['capacity'],
                    price_per_month=room_data['price_per_month'],
                    is_available=True
                )
                db.session.add(room)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'House added successfully',
            'house': house.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to add house: {str(e)}'
        }), 500


@admin_bp.route('/houses', methods=['GET'])
@admin_required
def get_all_houses():
    """Get all houses with filters"""
    try:
        # Optional filters
        area_id = request.args.get('area_id', type=int)
        is_active = request.args.get('is_active', type=str)
        has_owner = request.args.get('has_owner', type=str)
        
        # Base query
        query = House.query
        
        # Apply filters
        if area_id:
            query = query.filter_by(residential_area_id=area_id)
        
        if is_active == 'true':
            query = query.filter_by(is_active=True)
        elif is_active == 'false':
            query = query.filter_by(is_active=False)
        
        if has_owner == 'true':
            query = query.filter(House.owner_id.isnot(None))
        elif has_owner == 'false':
            query = query.filter(House.owner_id.is_(None))
        
        houses = query.all()
        
        return jsonify({
            'success': True,
            'count': len(houses),
            'houses': [house.to_dict(include_owner=True) for house in houses]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get houses: {str(e)}'
        }), 500


@admin_bp.route('/houses/<int:house_id>', methods=['PUT'])
@admin_required
def update_house(house_id):
    """
    Update house details
    
    Can update: is_active, is_verified, amenities, etc.
    """
    try:
        house = House.query.get(house_id)
        
        if not house:
            return jsonify({
                'success': False,
                'message': 'House not found'
            }), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'is_active' in data:
            house.is_active = data['is_active']
        
        if 'is_verified' in data:
            house.is_verified = data['is_verified']
        
        if 'description' in data:
            house.description = data['description']
        
        # Update coords if provided (validate ranges)
        if 'latitude' in data:
            try:
                lat = float(data['latitude'])
            except Exception:
                return jsonify({'success': False, 'message': 'Invalid latitude'}), 400
            if lat < -90 or lat > 90:
                return jsonify({'success': False, 'message': 'Latitude must be between -90 and 90'}), 400
            house.latitude = lat

        if 'longitude' in data:
            try:
                lon = float(data['longitude'])
            except Exception:
                return jsonify({'success': False, 'message': 'Invalid longitude'}), 400
            if lon < -180 or lon > 180:
                return jsonify({'success': False, 'message': 'Longitude must be between -180 and 180'}), 400
            house.longitude = lon

        # Update amenities
        amenity_fields = ['is_tiled', 'has_solar', 'has_jojo_tank', 'has_wifi', 
                         'has_parking', 'has_kitchen', 'has_laundry']
        for field in amenity_fields:
            if field in data:
                setattr(house, field, data[field])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'House updated successfully',
            'house': house.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to update house: {str(e)}'
        }), 500


@admin_bp.route('/houses/<int:house_id>', methods=['DELETE'])
@admin_required
def delete_house(house_id):
    """Delete a house (careful - this is permanent!)"""
    try:
        house = House.query.get(house_id)
        
        if not house:
            return jsonify({
                'success': False,
                'message': 'House not found'
            }), 404
        
        # Check for any bookings referencing this house
        from models import Booking, Room
        total_bookings = Booking.query.filter_by(house_id=house_id).count()

        force = request.args.get('force', 'false').lower() == 'true'

        if total_bookings > 0 and not force:
            return jsonify({
                'success': False,
                'message': f'Cannot delete house with {total_bookings} existing bookings. Pass ?force=true to delete bookings and the house.'
            }), 400

        # If force delete requested, remove dependent bookings and rooms first to avoid FK violations
        if total_bookings > 0 and force:
            try:
                # Delete bookings linked to this house
                Booking.query.filter_by(house_id=house_id).delete(synchronize_session=False)
                db.session.flush()
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'message': f'Failed to delete bookings: {str(e)}'}), 500

        # Delete rooms belonging to the house
        try:
            Room.query.filter_by(house_id=house_id).delete(synchronize_session=False)
            db.session.flush()
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Failed to delete rooms: {str(e)}'}), 500

        # Finally delete the house
        try:
            db.session.delete(house)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Failed to delete house: {str(e)}'}), 500

        return jsonify({
            'success': True,
            'message': 'House deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to delete house: {str(e)}'
        }), 500


@admin_bp.route('/houses/<int:house_id>/unassign-owner', methods=['PUT'])
@admin_required
def unassign_house_owner(house_id):
    """Unassign the owner of a house, leaving the house without an owner

    This will set house.owner_id to None and leave the user account intact.
    """
    try:
        house = House.query.get(house_id)
        if not house:
            return jsonify({'success': False, 'message': 'House not found'}), 404

        # If house has no owner, nothing to do
        if not house.owner_id:
            return jsonify({'success': True, 'message': 'House had no owner', 'house': house.to_dict()}), 200

        # Null out the owner relationship
        old_owner_id = house.owner_id
        house.owner_id = None

        # Also, if there is an owner Profile linking back to this house, keep the user but clear any owned_house relationship
        owner = HouseOwner.query.filter_by(user_id=old_owner_id).first()
        if owner:
            owner.house_id = None

        db.session.commit()

        return jsonify({'success': True, 'message': 'Owner unassigned successfully', 'house': house.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to unassign owner: {str(e)}'}), 500


@admin_bp.route('/houses/<int:house_id>/bookings', methods=['GET'])
@admin_required
def get_house_bookings(house_id):
    """Get bookings for a specific house (admin only). Returns booking records with student details."""
    try:
        from models import Booking
        house = House.query.get(house_id)
        if not house:
            return jsonify({'success': False, 'message': 'House not found'}), 404

        bookings = Booking.query.filter_by(house_id=house_id).order_by(Booking.booking_date.desc()).all()

        return jsonify({
            'success': True,
            'count': len(bookings),
            'bookings': [b.to_dict(include_student_details=True) for b in bookings]
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to get bookings: {str(e)}'}), 500


# ==================== USER MANAGEMENT ====================

@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_all_users():
    """Get all users with optional filters"""
    try:
        # Optional filters
        user_type = request.args.get('user_type')
        is_active = request.args.get('is_active', type=str)
        
        # Base query
        query = User.query
        
        # Apply filters
        if user_type:
            query = query.filter_by(user_type=user_type)
        
        if is_active == 'true':
            query = query.filter_by(is_active=True)
        elif is_active == 'false':
            query = query.filter_by(is_active=False)
        
        users = query.all()
        
        # Prepare user data
        users_data = []
        for user in users:
            user_dict = user.to_dict()
            
            # Add extra info based on user type
            if user.user_type == 'house_owner' and hasattr(user, 'owner_profile'):
                user_dict['owner_info'] = user.owner_profile.to_dict()
                if user.owned_house:
                    user_dict['house'] = {
                        'id': user.owned_house.id,
                        'address': f"{user.owned_house.house_number} {user.owned_house.street_address}"
                    }
            
            elif user.user_type == 'student' and hasattr(user, 'student_profile'):
                user_dict['student_info'] = user.student_profile.to_dict()
                user_dict['bookings_count'] = len(user.bookings)
            
            users_data.append(user_dict)
        
        return jsonify({
            'success': True,
            'count': len(users),
            'users': users_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get users: {str(e)}'
        }), 500


@admin_bp.route('/register', methods=['POST'])
def register_admin():
    """
    Register a new admin user using a server-side registration secret.

    Body: { email, password, full_name, phone_number, registration_secret }

    This endpoint is deliberately different from the public /auth/register flow.
    It requires a valid registration_secret equal to Config.ADMIN_REGISTRATION_SECRET
    to prevent arbitrary creation of admin accounts. If the secret is not set
    on the server, admin self-registration is disabled.
    """
    try:
        data = request.get_json() or {}

        required = ['email', 'password', 'full_name', 'phone_number', 'registration_secret']
        for f in required:
            if not data.get(f):
                return jsonify({'success': False, 'message': f'Missing required field: {f}'}), 400

        # Check registration secret is configured
        server_secret = getattr(Config, 'ADMIN_REGISTRATION_SECRET', None)
        if not server_secret:
            return jsonify({'success': False, 'message': 'Admin self-registration is disabled on this server.'}), 403

        # Validate secret
        if data.get('registration_secret') != server_secret:
            return jsonify({'success': False, 'message': 'Invalid registration secret'}), 403

        # Reuse normalization logic similar to auth.register
        def to_local_07(phone: str) -> str:
            import re
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

        normalized_phone = to_local_07(data.get('phone_number'))
        if not normalized_phone:
            return jsonify({'success': False, 'message': 'Invalid phone number. It must be 10 digits starting with 071, 077, or 078 (accepts +263/263/00263 formats).'}), 400

        # Uniqueness checks
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'success': False, 'message': 'Email already registered'}), 409
        if User.query.filter_by(phone_number=normalized_phone).first():
            return jsonify({'success': False, 'message': 'Phone number already registered'}), 409

        # Create admin user
        admin_user = User(
            email=data['email'],
            full_name=data['full_name'],
            phone_number=normalized_phone,
            user_type='admin',
            is_active=True
        )
        admin_user.set_password(data['password'])

        db.session.add(admin_user)
        db.session.commit()

        # Return created admin (without sensitive fields)
        return jsonify({'success': True, 'message': 'Admin account created', 'user': admin_user.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to create admin: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>/activate', methods=['PUT'])
@admin_required
def activate_user(user_id):
    """Activate a user account"""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        user.is_active = True
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'User {user.email} activated successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to activate user: {str(e)}'
        }), 500


@admin_bp.route('/users/<int:user_id>/deactivate', methods=['PUT'])
@admin_required
def deactivate_user(user_id):
    """Deactivate a user account"""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        if user.user_type == 'admin':
            return jsonify({
                'success': False,
                'message': 'Cannot deactivate admin users'
            }), 400
        
        user.is_active = False
        
        # If house owner, also deactivate their house
        if user.user_type == 'house_owner' and user.owned_house:
            user.owned_house.is_active = False
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'User {user.email} deactivated successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to deactivate user: {str(e)}'
        }), 500


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Permanently delete a user. For house owners, unassign their house and delete their owner profile."""
    try:
        user = User.query.get(user_id)

        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        if user.user_type == 'admin':
            return jsonify({'success': False, 'message': 'Cannot delete admin users'}), 400

        # If user is a house owner, unassign their houses and remove owner_profile
        if user.user_type == 'house_owner':
            houses = House.query.filter_by(owner_id=user.id).all()
            for house in houses:
                house.owner_id = None
                house.is_claimed = False
                house.owner_name = None
                house.owner_email = None
                house.owner_phone = None
            if hasattr(user, 'owner_profile') and user.owner_profile:
                db.session.delete(user.owner_profile)

        # If student, remove associated records and profile before deleting user
        if user.user_type == 'student':
            Booking.query.filter_by(student_id=user.id).delete(synchronize_session=False)
            BookingInquiry.query.filter_by(student_id=user.id).delete(synchronize_session=False)
            if hasattr(user, 'student_profile') and user.student_profile:
                db.session.delete(user.student_profile)

        # Remove any pending payment proofs tied to this user
        PaymentProof.query.filter_by(user_id=user.id).delete(synchronize_session=False)

        db.session.delete(user)
        db.session.commit()

        return jsonify({'success': True, 'message': 'User deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to delete user: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@admin_required
def get_user(user_id):
    """Get detailed user information for editing in admin UI"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        user_dict = user.to_dict()
        # include profile details when available
        if user.user_type == 'house_owner' and hasattr(user, 'owner_profile') and user.owner_profile:
            user_dict['owner_profile'] = user.owner_profile.to_dict()
            if user.owned_house:
                user_dict['house'] = {'id': user.owned_house.id, 'address': f"{user.owned_house.house_number} {user.owned_house.street_address}"}

        if user.user_type == 'student' and hasattr(user, 'student_profile') and user.student_profile:
            user_dict['student_profile'] = user.student_profile.to_dict()

        return jsonify({'success': True, 'user': user_dict}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to get user: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    """Update user basic fields and nested student/owner profile fields.

    Accepts JSON body with any of: full_name, email, phone_number
    and optionally 'student_profile': {student_id, institution}
    or 'owner_profile': {ecocash_number, bank_account, payment_status}
    """
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        data = request.get_json() or {}

        # Basic fields
        if 'full_name' in data:
            user.full_name = data['full_name']

        if 'email' in data and data['email']:
            # Check uniqueness
            existing = User.query.filter(User.email == data['email'], User.id != user.id).first()
            if existing:
                return jsonify({'success': False, 'message': 'Email already in use'}), 409
            user.email = data['email']

        if 'phone_number' in data:
            # Normalize phone to digits only
            def normalize_phone_digits(p: str) -> str:
                return ''.join(ch for ch in (p or '') if ch.isdigit())

            normalized_phone = normalize_phone_digits(data.get('phone_number'))
            # Enforce strict local phone format: 10 digits starting with 071, 077, or 078
            import re
            if not re.fullmatch(r"07(1|7|8)\d{7}", normalized_phone or ''):
                return jsonify({'success': False, 'message': 'Invalid phone number. It must be 10 digits starting with 071, 077, or 078.'}), 400

            # Check uniqueness
            existing_phone = User.query.filter(User.phone_number == normalized_phone, User.id != user.id).first()
            if existing_phone:
                return jsonify({'success': False, 'message': 'Phone number already in use'}), 409

            user.phone_number = normalized_phone

        # Nested student profile update
        if user.user_type == 'student' and 'student_profile' in data:
            sp = data['student_profile'] or {}
            if hasattr(user, 'student_profile') and user.student_profile:
                student = user.student_profile
            else:
                # create profile if missing
                student = Student(user_id=user.id)
                db.session.add(student)

            if 'student_id' in sp:
                student.student_id = sp.get('student_id')
            if 'institution' in sp:
                student.institution = sp.get('institution')

        # Nested owner profile update
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
            if 'payment_status' in op:
                owner.payment_status = op.get('payment_status')

        db.session.commit()

        return jsonify({'success': True, 'message': 'User updated', 'user': user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to update user: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>/password', methods=['PUT'])
@admin_required
def admin_set_user_password(user_id):
    """Admin override to set a user's password without knowing the current password.

    Body: { "new_password": "..." }
    """
    try:
        data = request.get_json() or {}
        new_password = data.get('new_password')
        if not new_password or len(new_password) < 8:
            return jsonify({'success': False, 'message': 'New password is required and must be at least 8 characters'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # Prevent admin from accidentally locking out the only admin by changing own password? Allow for now.
        user.set_password(new_password)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Password updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to set password: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>/houses', methods=['GET'])
@admin_required
def get_user_houses(user_id):
    """Get houses claimed/owned by a particular user (admin only)"""
    try:
        houses = House.query.filter_by(owner_id=user_id).all()
        return jsonify({
            'success': True,
            'count': len(houses),
            'houses': [h.to_dict(include_owner=True) for h in houses]
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to get owner houses: {str(e)}'}), 500


@admin_bp.route('/create-admin', methods=['POST'])
@admin_required
def create_admin():
    """Create a new admin user. Only accessible to existing admins.

    Body: { email, password, full_name, phone_number }
    """
    try:
        data = request.get_json() or {}
        required = ['email', 'password', 'full_name', 'phone_number']
        for f in required:
            if not data.get(f):
                return jsonify({'success': False, 'message': f'Missing required field: {f}'}), 400

        # Phone normalization (reuse logic from auth.register)
        import re
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

        normalized_phone = to_local_07(data.get('phone_number'))
        if not normalized_phone:
            return jsonify({'success': False, 'message': 'Invalid phone number. It must be 10 digits starting with 071, 077, or 078 (accepts +263/263/00263 formats).'}), 400

        # Uniqueness checks
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'success': False, 'message': 'Email already registered'}), 409
        if User.query.filter_by(phone_number=normalized_phone).first():
            return jsonify({'success': False, 'message': 'Phone number already registered'}), 409

        # Get current admin ID
        current_user_id = int(get_jwt_identity())

        # Create admin user
        admin_user = User(
            email=data['email'],
            full_name=data['full_name'],
            phone_number=normalized_phone,
            user_type='admin',
            is_active=True,
            created_by_admin_id=current_user_id  # Track who created this admin
        )
        admin_user.set_password(data['password'])

        db.session.add(admin_user)
        db.session.commit()

        # Record audit entry
        try:
            current_user_id = int(get_jwt_identity())
        except Exception:
            current_user_id = None

        try:
            audit = AdminAudit(
                actor_id=current_user_id or None,
                target_user_id=admin_user.id,
                action='create_admin',
                details=f'Admin {current_user_id} created admin {admin_user.id}'
            )
            db.session.add(audit)
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Send notification email to the new admin if configured (do not fail if email fails)
        try:
            actor_name = None
            try:
                actor = User.query.get(current_user_id) if current_user_id else None
                actor_name = actor.full_name if actor else 'System'
            except Exception:
                actor_name = 'System'
            send_admin_created_email(admin_user.email, admin_user.full_name, actor_name)
        except Exception:
            pass

        return jsonify({'success': True, 'message': 'Admin created successfully', 'user': admin_user.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to create admin: {str(e)}'}), 500


@admin_bp.route('/my-created-admins', methods=['GET'])
@admin_required
def get_my_created_admins():
    """Get list of admins created by the current admin"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Query admins created by current user
        created_admins = User.query.filter_by(
            user_type='admin',
            created_by_admin_id=current_user_id,
            is_active=True
        ).all()
        
        admins_data = []
        for admin in created_admins:
            admins_data.append({
                'id': admin.id,
                'email': admin.email,
                'full_name': admin.full_name,
                'phone_number': admin.phone_number,
                'created_at': admin.created_at.isoformat() if admin.created_at else None,
                'email_verified': admin.email_verified
            })
        
        return jsonify({
            'success': True,
            'count': len(admins_data),
            'admins': admins_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get created admins: {str(e)}'
        }), 500


@admin_bp.route('/delete-admin/<int:admin_id>', methods=['DELETE'])
@admin_required
def delete_created_admin(admin_id):
    """Delete an admin that was created by the current admin"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Find the admin to delete
        admin_to_delete = User.query.get(admin_id)
        
        if not admin_to_delete:
            return jsonify({'success': False, 'message': 'Admin not found'}), 404
        
        if admin_to_delete.user_type != 'admin':
            return jsonify({'success': False, 'message': 'User is not an admin'}), 400
        
        # Check if current admin created this admin
        if admin_to_delete.created_by_admin_id != current_user_id:
            return jsonify({
                'success': False,
                'message': 'You can only delete admins that you created'
            }), 403
        
        # Prevent deleting yourself
        if admin_to_delete.id == current_user_id:
            return jsonify({'success': False, 'message': 'You cannot delete yourself'}), 400
        
        # Check if this admin has created other admins
        has_created_admins = User.query.filter_by(
            user_type='admin',
            created_by_admin_id=admin_id,
            is_active=True
        ).count() > 0
        
        if has_created_admins:
            return jsonify({
                'success': False,
                'message': 'Cannot delete admin who has created other admins. Please delete their created admins first.'
            }), 400
        
        # Soft delete: deactivate instead of hard delete
        admin_to_delete.is_active = False
        db.session.commit()
        
        # Record audit
        try:
            audit = AdminAudit(
                actor_id=current_user_id,
                target_user_id=admin_id,
                action='delete_admin',
                details=f'Admin {current_user_id} deleted admin {admin_id} ({admin_to_delete.full_name})'
            )
            db.session.add(audit)
            db.session.commit()
        except Exception:
            pass  # Don't fail deletion if audit fails
        
        return jsonify({
            'success': True,
            'message': f'Admin {admin_to_delete.full_name} deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to delete admin: {str(e)}'
        }), 500


@admin_bp.route('/audits', methods=['GET'])
@admin_required
def list_audits():
    """List admin audit records with optional filters and pagination."""
    try:
        # Pagination
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        per_page = min(max(per_page, 1), 100)

        # Filters
        actor_id = request.args.get('actor_id', type=int)
        target_user_id = request.args.get('target_user_id', type=int)
        action = request.args.get('action')

        query = AdminAudit.query
        if actor_id:
            query = query.filter(AdminAudit.actor_id == actor_id)
        if target_user_id:
            query = query.filter(AdminAudit.target_user_id == target_user_id)
        if action:
            query = query.filter(AdminAudit.action.ilike(f"%{action}%"))

        total = query.count()
        audits = query.order_by(AdminAudit.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

        return jsonify({
            'success': True,
            'count': total,
            'page': page,
            'per_page': per_page,
            'audits': [a.to_dict() for a in audits]
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to list audits: {str(e)}'}), 500


# ==================== SUBSCRIPTION MANAGEMENT ====================

@admin_bp.route('/subscriptions', methods=['GET'])
@admin_required
def get_subscriptions():
    """Get all subscription payments"""
    try:
        status = request.args.get('status')  # 'pending', 'paid', 'overdue'
        
        query = SubscriptionPayment.query
        
        if status:
            query = query.filter_by(status=status)
        
        subscriptions = query.order_by(SubscriptionPayment.due_date.desc()).all()
        
        return jsonify({
            'success': True,
            'count': len(subscriptions),
            'subscriptions': [sub.to_dict() for sub in subscriptions]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get subscriptions: {str(e)}'
        }), 500


@admin_bp.route('/stats', methods=['GET'])
@admin_required
def get_stats():
    """Get system statistics for admin dashboard"""
    try:
        stats = {
            'total_users': User.query.count(),
            'total_students': User.query.filter_by(user_type='student').count(),
            'total_house_owners': User.query.filter_by(user_type='house_owner').count(),
            'total_admins': User.query.filter_by(user_type='admin').count(),
            
            'total_houses': House.query.count(),
            'active_houses': House.query.filter_by(is_active=True).count(),
            'unclaimed_houses': House.query.filter(House.owner_id.is_(None)).count(),
            
            'total_residential_areas': ResidentialArea.query.count(),
            
            'total_rooms': Room.query.count(),
            'occupied_rooms': Room.query.filter_by(is_occupied=True).count(),
            'available_rooms': Room.query.filter_by(is_occupied=False, is_available=True).count(),
        }
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get stats: {str(e)}'
        }), 500


@admin_bp.route('/payment-proofs/pending', methods=['GET'])
@admin_required
def list_pending_payment_proofs():
    """List pending payment proofs uploaded by students"""
    try:
        proofs = PaymentProof.query.filter_by(status='pending').order_by(PaymentProof.uploaded_at.desc()).all()
        items = []
        for p in proofs:
            user = User.query.get(p.user_id)
            items.append({
                'proof': p.to_dict(),
                'student': {
                    'id': user.id,
                    'email': user.email,
                    'full_name': user.full_name,
                    'phone_number': user.phone_number,
                    'email_verified': user.email_verified,
                    'admin_verified': user.admin_verified
                },
                'view_url': f"/static/payment_proofs/{p.filename}"
            })

        return jsonify({'success': True, 'count': len(items), 'items': items}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to list proofs: {str(e)}'}), 500


@admin_bp.route('/payment-proofs/<int:proof_id>/review', methods=['PUT'])
@admin_required
def review_payment_proof(proof_id):
    """Admin reviews (accepts/rejects) a student's payment proof.
    Body: { action: 'accept'|'reject', comment: 'optional' }
    """
    try:
        data = request.get_json() or {}
        action = data.get('action')
        comment = data.get('comment')
        if action not in ('accept', 'reject'):
            return jsonify({'success': False, 'message': 'Action must be accept or reject'}), 400

        proof = PaymentProof.query.get(proof_id)
        if not proof:
            return jsonify({'success': False, 'message': 'Proof not found'}), 404

        current_admin_id = int(get_jwt_identity())
        proof.admin_id = current_admin_id
        proof.admin_comment = comment
        proof.reviewed_at = datetime.utcnow()

        if action == 'accept':
            proof.status = 'accepted'
            # Mark the user as admin_verified with 30-day expiry
            user = User.query.get(proof.user_id)
            if user:
                user.admin_verified = True
                user.admin_verified_at = datetime.utcnow()
                # Set expiry to 30 days from now
                user.admin_verified_expires_at = datetime.utcnow() + timedelta(days=30)
                db.session.add(user)
                # send notification email to student
                try:
                    send_student_verified_email(user.email, user.full_name)
                except Exception:
                    pass
        else:
            proof.status = 'rejected'
            # Send rejection email to student
            user = User.query.get(proof.user_id)
            if user:
                try:
                    send_payment_proof_rejected_email(user.email, user.full_name, comment)
                except Exception:
                    pass

        db.session.add(proof)
        db.session.commit()

        return jsonify({'success': True, 'message': f'Proof {action}ed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to review proof: {str(e)}'}), 500


@admin_bp.route('/payment-proofs/<int:proof_id>', methods=['DELETE'])
@admin_required
def delete_payment_proof(proof_id):
    """Admin deletes a payment proof (permanently removes the record and file)"""
    try:
        proof = PaymentProof.query.get(proof_id)
        if not proof:
            return jsonify({'success': False, 'message': 'Proof not found'}), 404

        # Delete the file from filesystem if it exists
        try:
            proofs_folder = os.path.join(os.path.dirname(__file__), '..', 'static', 'payment_proofs')
            file_path = os.path.join(proofs_folder, proof.filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            # Log but don't fail if file deletion fails
            print(f"Warning: Failed to delete proof file {proof.filename}: {str(e)}")

        # Delete the database record
        db.session.delete(proof)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Payment proof deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to delete proof: {str(e)}'}), 500


@admin_bp.route('/students', methods=['GET'])
@admin_required
def get_students():
    """Get all students with verification status"""
    try:
        query = Student.query.join(User)

        is_active_filter = request.args.get('is_active')
        if is_active_filter == 'true':
            query = query.filter(User.is_active.is_(True))
        elif is_active_filter == 'false':
            query = query.filter(User.is_active.is_(False))

        students = query.all()
        
        students_data = []
        for s in students:
            user = s.user
            students_data.append({
                'student_record_id': s.id,
                'user_id': user.id,
                'full_name': user.full_name,
                'email': user.email,
                'phone_number': user.phone_number,
                'student_id': s.student_id,
                'institution': s.institution,
                'email_verified': user.email_verified or False,
                'admin_verified': user.admin_verified or False,
                'email_verified_at': user.email_verified_at.isoformat() if user.email_verified_at else None,
                'admin_verified_at': user.admin_verified_at.isoformat() if user.admin_verified_at else None,
                'created_at': user.created_at.isoformat() if user.created_at else None,
                'is_active': user.is_active
            })
        
        return jsonify({
            'success': True,
            'count': len(students_data),
            'students': students_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get students: {str(e)}'
        }), 500


@admin_bp.route('/students/<int:student_id>/toggle-verification', methods=['PUT'])
@admin_required
def toggle_student_verification(student_id):
    """Toggle a student's admin_verified status (for testing and manual overrides)"""
    try:
        student = Student.query.get(student_id)
        if not student:
            return jsonify({'success': False, 'message': 'Student not found'}), 404
        
        user = student.user
        # Toggle admin_verified
        user.admin_verified = not user.admin_verified
        if user.admin_verified:
            user.admin_verified_at = datetime.utcnow()
            # Set 30-day expiry
            user.admin_verified_expires_at = datetime.utcnow() + timedelta(days=30)
        else:
            user.admin_verified_at = None
            user.admin_verified_expires_at = None
        
        db.session.commit()
        
        status = "verified" if user.admin_verified else "unverified"
        return jsonify({
            'success': True,
            'message': f'Student marked as {status}',
            'admin_verified': user.admin_verified
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to toggle verification: {str(e)}'
        }), 500


@admin_bp.route('/upload-house-images', methods=['POST'])
@admin_required
def upload_house_images():
    """Upload one or more house images and return saved filenames"""
    try:
        # Ensure upload folder exists
        upload_folder = Config.UPLOAD_FOLDER
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder, exist_ok=True)

        files = request.files.getlist('images')
        if not files:
            return jsonify({'success': False, 'message': 'No files provided'}), 400

        # Enforce maximum of 3 images per upload (admin constraint)
        if len(files) > 3:
            return jsonify({'success': False, 'message': 'You may upload a maximum of 3 images per house'}), 400

        saved_filenames = []
        prefix = f"admin_{int(datetime.utcnow().timestamp())}_"
        for f in files:
            filename = secure_filename(f.filename)
            if not filename:
                continue
            filename = prefix + filename
            dest = os.path.join(upload_folder, filename)
            f.save(dest)
            saved_filenames.append(filename)

        return jsonify({'success': True, 'filenames': saved_filenames}), 201

    except Exception as e:
        return jsonify({'success': False, 'message': f'Upload failed: {str(e)}'}), 500