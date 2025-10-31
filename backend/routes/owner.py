"""
Owner Routes
============
Endpoints for house owners to manage their own house and profile
Location: backend/routes/owner.py

Endpoints:
- GET /api/owner/house - Get owner's house details
- PUT /api/owner/house - Update owner's house (amenities, description, images)
- PUT /api/owner/payment-methods - Update owner's payment methods
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, House, HouseOwner, Room, Booking
import os
from werkzeug.utils import secure_filename
from datetime import datetime

owner_bp = Blueprint('owner', __name__)


def _release_room_and_refresh_fullness(room):
    if not room:
        return
    room.is_occupied = False
    room.is_available = True
    room.current_tenant_id = None
    room.occupancy_start_date = None
    room.occupancy_end_date = None
    try:
        if room.house:
            room.house.is_full = (room.house.available_rooms == 0)
    except Exception:
        pass


@owner_bp.route('/house', methods=['GET'])
@jwt_required()
def get_my_house():
    """Get the house owned by the current user"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        # Return all houses owned by this user
        houses = House.query.filter_by(owner_id=user.id).all()
        houses_list = [h.to_dict(include_owner=True) for h in houses]

        return jsonify({
            'success': True,
            'house': houses_list[0] if houses_list else None,
            'houses': houses_list
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to get house: {str(e)}'}), 500


@owner_bp.route('/house', methods=['PUT'])
@jwt_required()
def update_my_house():
    """Update amenities, description, rules, and images for the owner's house"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        house = user.owned_house
        if not house:
            return jsonify({'success': False, 'message': 'No house assigned to this owner'}), 400

        data = request.get_json()

        # Allow updating description, rules, amenities, coords, image_filenames
        if 'description' in data:
            house.description = data['description']
        if 'rules' in data:
            house.rules = data['rules']

        # Coordinates (validate ranges)
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

        amenity_fields = ['is_tiled', 'has_solar', 'has_jojo_tank', 'has_wifi', 'has_parking', 'has_kitchen', 'has_laundry']
        for field in amenity_fields:
            if field in data:
                setattr(house, field, bool(data[field]))

        if 'image_filenames' in data:
            # Expect a comma-separated string or list
            if isinstance(data['image_filenames'], list):
                house.image_filenames = ','.join(data['image_filenames'])
            else:
                house.image_filenames = data['image_filenames']

        # Optionally update rooms (simple replace for now)
        if 'rooms' in data and isinstance(data['rooms'], list):
            # Delete existing rooms and recreate
            for r in house.rooms:
                db.session.delete(r)
            db.session.flush()
            for room_data in data['rooms']:
                room = Room(
                    house_id=house.id,
                    room_number=room_data.get('room_number', ''),
                    capacity=room_data.get('capacity', 1),
                    price_per_month=room_data.get('price_per_month', 0.0),
                    is_available=room_data.get('is_available', True),
                    is_occupied=bool(room_data.get('is_occupied', False))
                )
                # Optionally allow owner to set tenant info (not required)
                if room_data.get('current_tenant_id'):
                    try:
                        room.current_tenant_id = int(room_data.get('current_tenant_id'))
                    except Exception:
                        pass
                db.session.add(room)

        db.session.commit()

        # After saving rooms and house changes, recompute house.is_full
        try:
            refreshed_house = House.query.get(house.id)
            if refreshed_house.available_rooms == 0:
                refreshed_house.is_full = True
            else:
                refreshed_house.is_full = False
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({'success': True, 'message': 'House updated', 'house': house.to_dict(include_owner=True)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to update house: {str(e)}'}), 500


@owner_bp.route('/payment-methods', methods=['PUT'])
@jwt_required()
def update_payment_methods():
    """Update owner payment methods (ecocash, bank_account, other)"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        data = request.get_json()

        if not hasattr(user, 'owner_profile') or not user.owner_profile:
            # Create owner profile if missing
            owner_profile = HouseOwner(user_id=user.id)
            db.session.add(owner_profile)
            db.session.flush()
            user = User.query.get(current_user_id)  # reload

        profile = user.owner_profile

        if 'ecocash_number' in data:
            profile.ecocash_number = data['ecocash_number']
        if 'bank_account' in data:
            profile.bank_account = data['bank_account']
        if 'other_payment_info' in data:
            profile.other_payment_info = data['other_payment_info']

        db.session.commit()

        return jsonify({'success': True, 'message': 'Payment methods updated', 'owner_info': profile.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to update payment methods: {str(e)}'}), 500



@owner_bp.route('/upload-house-images', methods=['POST'])
@jwt_required()
def upload_owner_house_images():
    """Allow a house owner to upload images for their own house. Filenames are prefixed to avoid collisions."""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        if not user.owned_house:
            return jsonify({'success': False, 'message': 'No house assigned to this owner'}), 400

        upload_folder = os.path.join(os.path.dirname(__file__), '..', 'static', 'house_images')
        upload_folder = os.path.abspath(upload_folder)
        os.makedirs(upload_folder, exist_ok=True)

        files = request.files.getlist('images')
        if not files:
            return jsonify({'success': False, 'message': 'No files provided'}), 400
        
        # Enforce maximum of 3 images per house
        existing_filenames = []
        if user.owned_house.image_filenames:
            existing_filenames = [fn for fn in user.owned_house.image_filenames.split(',') if fn]

        if len(existing_filenames) + len(files) > 3:
            return jsonify({'success': False, 'message': f'You can upload at most 3 images per house. Currently {len(existing_filenames)} image(s) present.'}), 400

        saved_filenames = []
        prefix = f"owner{user.id}_{int(datetime.utcnow().timestamp())}_"
        for f in files:
            filename = secure_filename(f.filename)
            if not filename:
                continue
            filename = prefix + filename
            dest = os.path.join(upload_folder, filename)
            f.save(dest)
            saved_filenames.append(filename)

        # Append newly uploaded filenames to existing ones
        combined = existing_filenames + saved_filenames
        user.owned_house.image_filenames = ','.join(combined)
        db.session.commit()

        return jsonify({'success': True, 'filenames': saved_filenames, 'all_filenames': combined}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Upload failed: {str(e)}'}), 500


@owner_bp.route('/house-image/<filename>', methods=['DELETE'])
@jwt_required()
def delete_house_image(filename):
    """Delete a specific image from the owner's house"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        if not user.owned_house:
            return jsonify({'success': False, 'message': 'No house assigned to this owner'}), 400

        # Get current filenames
        existing_filenames = []
        if user.owned_house.image_filenames:
            existing_filenames = [fn for fn in user.owned_house.image_filenames.split(',') if fn]

        # Remove the specified filename
        if filename not in existing_filenames:
            return jsonify({'success': False, 'message': 'Image not found'}), 404

        existing_filenames.remove(filename)
        
        # Update database
        user.owned_house.image_filenames = ','.join(existing_filenames)
        db.session.commit()

        # Try to delete the physical file
        try:
            upload_folder = os.path.join(os.path.dirname(__file__), '..', 'static', 'house_images')
            file_path = os.path.join(upload_folder, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            # File deletion failed but database updated - non-fatal
            pass

        return jsonify({'success': True, 'message': 'Image deleted', 'remaining_filenames': existing_filenames}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Delete failed: {str(e)}'}), 500


@owner_bp.route('/house/bookings', methods=['GET'])
@jwt_required()
def get_owner_house_bookings():
    """
    Get bookings and inquiries for all houses owned by the current owner
    Returns JSON with 'bookings' and 'inquiries' arrays. Bookings include student details.
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        # Find houses owned by this user
        houses = House.query.filter_by(owner_id=user.id).all()
        house_ids = [h.id for h in houses]

        # If no houses, return empty lists
        if not house_ids:
            return jsonify({'success': True, 'bookings': [], 'inquiries': []}), 200

        # Fetch bookings for these houses
        bookings = []
        from models import Booking, BookingInquiry

        booking_rows = Booking.query.filter(Booking.house_id.in_(house_ids)).order_by(Booking.created_at.desc()).all()
        for b in booking_rows:
            bookings.append(b.to_dict(include_student_details=True, include_house_details=True))

        # Fetch inquiries for these houses
        inquiries_rows = BookingInquiry.query.filter(BookingInquiry.house_id.in_(house_ids)).order_by(BookingInquiry.created_at.desc()).all()
        inquiries = [iq.to_dict() for iq in inquiries_rows]

        return jsonify({'success': True, 'bookings': bookings, 'inquiries': inquiries}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to get owner bookings: {str(e)}'}), 500


@owner_bp.route('/bookings/<int:booking_id>/accept', methods=['PUT'])
@jwt_required()
def accept_booking(booking_id):
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        booking = Booking.query.get(booking_id)
        if not booking or not booking.house or booking.house.owner_id != user.id:
            return jsonify({'success': False, 'message': 'Booking not found'}), 404

        payload = request.get_json() or {}
        booking.owner_status = 'accepted'
        if 'message' in payload:
            booking.owner_response = payload.get('message')
            booking.owner_response_date = datetime.utcnow()
        else:
            booking.owner_response_date = datetime.utcnow()

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Booking accepted',
            'booking': booking.to_dict(include_student_details=True, include_house_details=True)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to accept booking: {str(e)}'}), 500


@owner_bp.route('/bookings/<int:booking_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_booking(booking_id):
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        booking = Booking.query.get(booking_id)
        if not booking or not booking.house or booking.house.owner_id != user.id:
            return jsonify({'success': False, 'message': 'Booking not found'}), 404

        payload = request.get_json() or {}
        booking.owner_status = 'cancelled'
        booking.booking_type = 'cancelled'
        booking.cancellation_reason = payload.get('reason', 'Cancelled by house owner')
        if 'message' in payload:
            booking.owner_response = payload.get('message')
        booking.owner_response_date = datetime.utcnow()

        _release_room_and_refresh_fullness(booking.room)

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Booking cancelled',
            'booking': booking.to_dict(include_student_details=True, include_house_details=True)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to cancel booking: {str(e)}'}), 500


@owner_bp.route('/bookings/<int:booking_id>', methods=['DELETE'])
@jwt_required()
def delete_booking(booking_id):
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        booking = Booking.query.get(booking_id)
        if not booking or not booking.house or booking.house.owner_id != user.id:
            return jsonify({'success': False, 'message': 'Booking not found'}), 404

        _release_room_and_refresh_fullness(booking.room)

        db.session.delete(booking)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Booking deleted', 'deleted_id': booking_id}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to delete booking: {str(e)}'}), 500


@owner_bp.route('/rooms/<int:room_id>/occupancy', methods=['PUT'])
@jwt_required()
def set_room_occupancy(room_id):
    """Allow owner to set a room as occupied or not. Body: { is_occupied: bool }"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        room = Room.query.get(room_id)
        if not room:
            return jsonify({'success': False, 'message': 'Room not found'}), 404

        house = House.query.get(room.house_id)
        if not house or house.owner_id != user.id:
            return jsonify({'success': False, 'message': 'Not authorized for this room'}), 403

        data = request.get_json() or {}
        if 'is_occupied' not in data:
            return jsonify({'success': False, 'message': 'is_occupied field required'}), 400

        is_occ = bool(data.get('is_occupied'))

        # Update room occupancy status
        room.is_occupied = is_occ
        # If marking unoccupied, clear tenant info
        if not is_occ:
            room.current_tenant_id = None
            room.occupancy_start_date = None
            room.occupancy_end_date = None

        db.session.commit()

        # After update, recompute house fullness
        try:
            house = House.query.get(house.id)
            if house.available_rooms == 0:
                house.is_full = True
            else:
                house.is_full = False
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({'success': True, 'message': 'Room occupancy updated', 'room': room.to_dict(), 'house': house.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to update room occupancy: {str(e)}'}), 500


@owner_bp.route('/inquiries/<int:inquiry_id>/verify', methods=['PUT'])
@jwt_required()
def verify_inquiry(inquiry_id):
    """Allow an owner to verify/approve an inquiry for their house"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        from models import BookingInquiry
        inquiry = BookingInquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': 'Inquiry not found'}), 404

        # Ensure the inquiry belongs to one of the owner's houses
        house = House.query.get(inquiry.house_id)
        if not house or house.owner_id != user.id:
            return jsonify({'success': False, 'message': 'Not authorized for this inquiry'}), 403

        data = request.get_json() or {}
        # Mark as verified and optionally include a response
        inquiry.status = 'verified'
        if 'response' in data:
            inquiry.response = data.get('response')
            inquiry.response_date = datetime.utcnow()

        db.session.commit()
        return jsonify({'success': True, 'message': 'Inquiry verified'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to verify inquiry: {str(e)}'}), 500


@owner_bp.route('/inquiries/<int:inquiry_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_inquiry_by_owner(inquiry_id):
    """Allow an owner to cancel an inquiry (e.g., not available)"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        from models import BookingInquiry
        inquiry = BookingInquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': 'Inquiry not found'}), 404

        house = House.query.get(inquiry.house_id)
        if not house or house.owner_id != user.id:
            return jsonify({'success': False, 'message': 'Not authorized for this inquiry'}), 403

        inquiry.status = 'cancelled'
        db.session.commit()
        return jsonify({'success': True, 'message': 'Inquiry cancelled'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to cancel inquiry: {str(e)}'}), 500


@owner_bp.route('/inquiries/<int:inquiry_id>', methods=['DELETE'])
@jwt_required()
def delete_inquiry_by_owner(inquiry_id):
    """Allow an owner to delete an inquiry record for their house"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'house_owner':
            return jsonify({'success': False, 'message': 'House owner access required'}), 403

        from models import BookingInquiry
        inquiry = BookingInquiry.query.get(inquiry_id)
        if not inquiry:
            return jsonify({'success': False, 'message': 'Inquiry not found'}), 404

        house = House.query.get(inquiry.house_id)
        if not house or house.owner_id != user.id:
            return jsonify({'success': False, 'message': 'Not authorized for this inquiry'}), 403

        db.session.delete(inquiry)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Inquiry deleted'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to delete inquiry: {str(e)}'}), 500
