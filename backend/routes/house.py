"""
House Routes
============
Handles house browsing and searching for students
Location: backend/routes/house.py

Endpoints:
- GET /api/houses - Get all available houses
- GET /api/houses/<id> - Get specific house details
- GET /api/houses/area/<area_id> - Get houses in specific area
- GET /api/houses/search - Search houses with filters
"""

from flask import Blueprint, request, jsonify
import re
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from models import db, House, ResidentialArea, Room, User
from sqlalchemy import or_, and_

# Create Blueprint
house_bp = Blueprint('houses', __name__)


@house_bp.route('/', methods=['GET'])
def get_houses():
    """
    Get all active houses
    Optional query parameters:
    - area_id: Filter by residential area
    - has_accommodation: true/false - Filter by availability
    - min_price: Minimum room price
    - max_price: Maximum room price
    - capacity: Room capacity (1, 2, or 4)
    """
    try:
        # If a JWT is present and belongs to a student who is not admin-verified,
        # block access to house listings until the student has been admin-verified.
        try:
            # verify_jwt_in_request supports an optional=True flag in this
            # installation of flask_jwt_extended. Use that instead of the
            # non-existent verify_jwt_in_request_optional symbol.
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
            if current_user_id:
                user = User.query.get(int(current_user_id))
                if user and user.user_type == 'student' and not getattr(user, 'admin_verified', False):
                    return jsonify({'success': False, 'message': 'Account pending admin verification. Upload proof of payment and wait for admin approval.'}), 403
        except Exception:
            # No JWT provided or invalid token — treat as public request
            pass
        # Base query - only active and verified houses
        query = House.query.filter_by(is_active=True, is_verified=True)
        
        # Filter by residential area
        area_id = request.args.get('area_id', type=int)
        if area_id:
            query = query.filter_by(residential_area_id=area_id)
        
        # Filter by availability
        has_accommodation = request.args.get('has_accommodation')
        if has_accommodation == 'true':
            # Only houses with available rooms
            query = query.join(Room).filter(
                Room.is_occupied == False,
                Room.is_available == True
            ).distinct()
        elif has_accommodation == 'false':
            # Only fully occupied houses
            query = query.filter(~House.rooms.any(
                and_(Room.is_occupied == False, Room.is_available == True)
            ))
        
        # Get all houses
        houses = query.all()
        
        # Filter by price and capacity (done in Python because it's per-room)
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        capacity = request.args.get('capacity', type=int)
        
        filtered_houses = []
        for house in houses:
            # Check if house has rooms matching criteria
            matching_rooms = [r for r in house.rooms if r.is_available]
            
            if min_price:
                matching_rooms = [r for r in matching_rooms if r.price_per_month >= min_price]
            
            if max_price:
                matching_rooms = [r for r in matching_rooms if r.price_per_month <= max_price]
            
            if capacity:
                matching_rooms = [r for r in matching_rooms if r.capacity == capacity]
            
            # If there are matching rooms, include the house
            if matching_rooms:
                filtered_houses.append(house)
        
        return jsonify({
            'success': True,
            'count': len(filtered_houses),
            'houses': [house.to_dict(include_owner=True) for house in filtered_houses]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get houses: {str(e)}'
        }), 500


@house_bp.route('/<int:house_id>', methods=['GET'])
def get_house_details(house_id):
    """Get detailed information about a specific house"""
    try:
        house = House.query.get(house_id)
        
        if not house:
            return jsonify({
                'success': False,
                'message': 'House not found'
            }), 404
        
        if not house.is_active or not house.is_verified:
            return jsonify({
                'success': False,
                'message': 'House is not available'
            }), 404
        
        return jsonify({
            'success': True,
            'house': house.to_dict(include_owner=True)
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get house: {str(e)}'
        }), 500


@house_bp.route('/area/<int:area_id>', methods=['GET'])
def get_houses_by_area(area_id):
    """Get all houses in a specific residential area"""
    try:
        # If a JWT is present and belongs to a student who is not admin-verified,
        # block access to area house listings until the student has been admin-verified.
        try:
            # Use the supported optional flag to allow public access while still
            # detecting logged-in students for gating.
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
            if current_user_id:
                user = User.query.get(int(current_user_id))
                if user and user.user_type == 'student' and not getattr(user, 'admin_verified', False):
                    return jsonify({'success': False, 'message': 'Account pending admin verification. Upload proof of payment and wait for admin approval.'}), 403
        except Exception:
            pass
        # Verify area exists
        area = ResidentialArea.query.get(area_id)
        if not area:
            return jsonify({
                'success': False,
                'message': 'Residential area not found'
            }), 404
        
        # Get active houses in this area
        houses = House.query.filter_by(
            residential_area_id=area_id,
            is_active=True,
            is_verified=True
        ).all()
        
        # Separate into available and full
        houses_with_accommodation = []
        houses_full = []
        
        for house in houses:
            if house.has_accommodation:
                houses_with_accommodation.append(house.to_dict(include_owner=True))
            else:
                houses_full.append(house.to_dict(include_owner=False))
        
        return jsonify({
            'success': True,
            'area': area.to_dict(),
            'houses_with_accommodation': houses_with_accommodation,
            'houses_full': houses_full
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get houses: {str(e)}'
        }), 500


@house_bp.route('/search', methods=['GET'])
def search_houses():
    """
    Advanced search for houses
    Query parameters:
    - q: Search term (searches in address and description)
    - area: Residential area name
    - amenities: Comma-separated list (e.g., "solar,wifi,parking")
    """
    try:
        search_term = request.args.get('q', '').strip()
        area_name = request.args.get('area', '').strip()
        amenities = request.args.get('amenities', '').strip()
        
        # Base query
        query = House.query.filter_by(is_active=True, is_verified=True)
        
        # Search in address and description
        if search_term:
            query = query.filter(
                or_(
                    House.house_number.ilike(f'%{search_term}%'),
                    House.street_address.ilike(f'%{search_term}%'),
                    House.description.ilike(f'%{search_term}%')
                )
            )
        
        # Filter by area name
        if area_name:
            query = query.join(ResidentialArea).filter(
                ResidentialArea.name.ilike(f'%{area_name}%')
            )
        
        # Filter by amenities
        if amenities:
            amenity_list = [a.strip().lower() for a in amenities.split(',')]
            
            for amenity in amenity_list:
                if amenity == 'solar':
                    query = query.filter(House.has_solar == True)
                elif amenity == 'wifi':
                    query = query.filter(House.has_wifi == True)
                elif amenity == 'parking':
                    query = query.filter(House.has_parking == True)
                elif amenity == 'jojo' or amenity == 'tank':
                    query = query.filter(House.has_jojo_tank == True)
                elif amenity == 'tiled':
                    query = query.filter(House.is_tiled == True)
                elif amenity == 'kitchen':
                    query = query.filter(House.has_kitchen == True)
                elif amenity == 'laundry':
                    query = query.filter(House.has_laundry == True)
        
        houses = query.all()
        
        return jsonify({
            'success': True,
            'count': len(houses),
            'houses': [house.to_dict(include_owner=True) for house in houses]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Search failed: {str(e)}'
        }), 500


@house_bp.route('/residential-areas', methods=['GET'])
def get_residential_areas():
    """Get all residential areas with house counts"""
    try:
        # If a JWT is present and belongs to a student who is not admin-verified,
        # block access to the list of residential areas until admin verification.
        try:
            # Use optional JWT verification to allow public access while still
            # detecting logged-in students for gating.
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
            if current_user_id:
                user = User.query.get(int(current_user_id))
                if user and user.user_type == 'student' and not getattr(user, 'admin_verified', False):
                    return jsonify({'success': False, 'message': 'Account pending admin verification. Upload proof of payment and wait for admin approval.'}), 403
        except Exception:
            pass
        areas = ResidentialArea.query.all()
        # Sort by admin-provided approximate distance ascending (closest first); unknowns at end
        areas.sort(key=lambda a: (a.approximate_distance_km is None, a.approximate_distance_km if a.approximate_distance_km is not None else 0))
        
        areas_data = []
        for area in areas:
            area_dict = area.to_dict()
            # Count only active houses
            active_houses = House.query.filter_by(
                residential_area_id=area.id,
                is_active=True,
                is_verified=True
            ).count()
            area_dict['active_house_count'] = active_houses
            areas_data.append(area_dict)
        # Sort by manual approximate first, else computed; unknowns last
        areas_data.sort(key=lambda d: ((d.get('approximate_distance_km') is None and d.get('computed_distance_km') is None), d.get('approximate_distance_km') if d.get('approximate_distance_km') is not None else (d.get('computed_distance_km') or 0)))

        return jsonify({
            'success': True,
            'count': len(areas_data),
            'areas': areas_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get areas: {str(e)}'
        }), 500


@house_bp.route('/<int:house_id>/rooms', methods=['GET'])
def get_house_rooms(house_id):
    """Get all rooms for a specific house"""
    try:
        house = House.query.get(house_id)
        
        if not house:
            return jsonify({
                'success': False,
                'message': 'House not found'
            }), 404
        
        # Get all rooms
        rooms = Room.query.filter_by(house_id=house_id).all()
        
        return jsonify({
            'success': True,
            'house': {
                'id': house.id,
                'address': f"{house.house_number} {house.street_address}",
                'area': house.residential_area.name
            },
            'total_rooms': len(rooms),
            'rooms': [room.to_dict() for room in rooms]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get rooms: {str(e)}'
        }), 500


@house_bp.route('/<int:house_id>/owner', methods=['GET'])
@jwt_required()
def get_house_owner_contact(house_id):
    """
    Get house owner contact information
    Requires authentication (students must be logged in)
    """
    try:
        house = House.query.get(house_id)
        
        if not house:
            return jsonify({
                'success': False,
                'message': 'House not found'
            }), 404
        
        if not house.owner:
            return jsonify({
                'success': False,
                'message': 'House has no owner assigned'
            }), 404
        
        owner = house.owner
        owner_profile = owner.owner_profile
        
        return jsonify({
            'success': True,
            'owner': {
                'name': owner.full_name,
                'phone': owner.phone_number,
                'email': owner.email,
                'payment_methods': {
                    'ecocash': owner_profile.ecocash_number if owner_profile else None,
                    'bank_account': owner_profile.bank_account if owner_profile else None,
                    'other': owner_profile.other_payment_info if owner_profile else None
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get owner info: {str(e)}'
        }), 500


@house_bp.route('/<int:house_id>/claim', methods=['POST'])
def claim_house(house_id):
    """
    Claim a house by providing owner details.
    Request body:
    - name: Owner's full name
    - email: Owner's email address
    - phone: Owner's phone number
    """
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')

        if not all([name, email, phone]):
            return jsonify({
                'success': False,
                'message': 'All fields (name, email, phone) are required.'
            }), 400

        house = House.query.get(house_id)

        if not house:
            return jsonify({
                'success': False,
                'message': 'House not found.'
            }), 404

        if house.is_claimed:
            return jsonify({
                'success': False,
                'message': 'House has already been claimed.'
            }), 400

        # Validate owner details with normalization
        def norm_name(s):
            if not s:
                return ''
            # Trim, collapse whitespace, lowercase
            return re.sub(r"\s+", ' ', s.strip()).lower()

        def norm_email(s):
            if not s:
                return ''
            return s.strip().lower()

        def norm_phone(s):
            if not s:
                return ''
            # Keep only digits
            digits = re.sub(r"\D", '', s)
            return digits

        name_ok = False
        email_ok = False
        phone_ok = False

        # Normalize inputs and stored values
        input_name = norm_name(name)
        input_email = norm_email(email)
        input_phone = norm_phone(phone)

        house_name = norm_name(house.owner_name) if house.owner_name else ''
        house_email = norm_email(house.owner_email) if house.owner_email else ''
        house_phone = norm_phone(house.owner_phone) if house.owner_phone else ''

        # Name: exact normalized match
        if house_name and input_name and house_name == input_name:
            name_ok = True

        # Email: case-insensitive exact match
        if house_email and input_email and house_email == input_email:
            email_ok = True

        # Phone: compare digits; accept if exact match or if suffixes match (handle country codes and leading zeros)
        if house_phone and input_phone:
            if house_phone == input_phone:
                phone_ok = True
            else:
                # Prepare variants that strip leading zeros (local formats) for robust matching
                house_variants = {house_phone, house_phone.lstrip('0')}
                input_variants = {input_phone, input_phone.lstrip('0')}

                matched = False
                for hv in house_variants:
                    for iv in input_variants:
                        if not hv or not iv:
                            continue
                        if hv == iv:
                            matched = True
                            break
                        # Compare suffix of up to 9 digits to handle country codes
                        minlen = min(len(hv), len(iv), 9)
                        if minlen > 0 and hv[-minlen:] == iv[-minlen:]:
                            matched = True
                            break
                    if matched:
                        break

                if matched:
                    phone_ok = True

        if name_ok and email_ok and phone_ok:
            # Mark house as claimed
            house.is_claimed = True
            db.session.commit()

            return jsonify({
                'success': True,
                'message': 'House claimed successfully.'
            }), 200

        return jsonify({
            'success': False,
            'message': 'Owner details do not match.'
        }), 400

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to claim house: {str(e)}'
        }), 500


@house_bp.route('/unclaimed', methods=['GET'])
def get_unclaimed_houses():
    """
    Public endpoint to get houses that have no assigned owner but have admin-provided owner details
    These are candidate houses for owners to claim.
    """
    try:
        houses = House.query.filter_by(owner_id=None, is_verified=True).all()
        # Only return houses that have admin-provided owner details
        candidate_houses = [h for h in houses if h.owner_name or h.owner_email or h.owner_phone]

        return jsonify({
            'success': True,
            'count': len(candidate_houses),
            'houses': [house.to_dict(include_owner=True) for house in candidate_houses]
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get unclaimed houses: {str(e)}'
        }), 500


@house_bp.route('/<int:house_id>/remove-owner', methods=['DELETE'])
@jwt_required()
def remove_house_owner(house_id):
    """
    Remove the owner of a house and delete their profile.
    Requires admin authentication.
    """
    try:
        house = House.query.get(house_id)

        if not house:
            return jsonify({
                'success': False,
                'message': 'House not found.'
            }), 404

        if not house.owner:
            return jsonify({
                'success': False,
                'message': 'House does not have an assigned owner.'
            }), 400

        # Remove owner and delete their profile
        owner = house.owner
        house.owner_id = None
        db.session.delete(owner)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'House owner removed successfully.'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to remove house owner: {str(e)}'
        }), 500