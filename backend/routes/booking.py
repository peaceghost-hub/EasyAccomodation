"""
Booking Routes
==============
Handles room bookings and inquiries
Location: backend/routes/booking.py

Endpoints:
- POST /api/bookings/inquiry - Send inquiry email to house owner
- POST /api/bookings/reserve - Reserve a room (book for later payment)
- POST /api/bookings/confirm - Confirm booking with payment
- GET /api/bookings/my-bookings - Get user's bookings
- PUT /api/bookings/<id>/cancel - Cancel a booking
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from models import db, Booking, BookingInquiry, House, Room, User, Student
from config import Config

# Create Blueprint
booking_bp = Blueprint('bookings', __name__)


def student_required(fn):
    """Decorator to ensure only students can access booking endpoints"""
    from functools import wraps
    
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.user_type != 'student':
            return jsonify({
                'success': False,
                'message': 'Student access required'
            }), 403
        # Require email verification to have occurred first (students must verify email to proceed)
        if not getattr(user, 'email_verified', False):
            return jsonify({'success': False, 'message': 'Please verify your email before accessing booking features.'}), 403
        # Require admin verification (payment approved) to perform booking operations
        if not getattr(user, 'admin_verified', False):
            return jsonify({'success': False, 'message': 'Account pending admin verification. Upload proof of payment and wait for admin approval.'}), 403
        
        return fn(*args, **kwargs)
    
    return wrapper


@booking_bp.route('/inquiry', methods=['POST'])
@student_required
def send_inquiry():
    """
    Send inquiry email to house owner
    
    Request Body:
    {
        "house_id": 1,
        "subject": "Inquiry about room availability",
        "message": "Hello, I'm interested in renting a room..."
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        if not data.get('house_id') or not data.get('message'):
            return jsonify({
                'success': False,
                'message': 'House ID and message are required'
            }), 400
        
        # Verify house exists
        house = House.query.get(data['house_id'])
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
        
        # Create inquiry
        inquiry = BookingInquiry(
            student_id=current_user_id,
            house_id=data['house_id'],
            subject=data.get('subject', 'Room Inquiry'),
            message=data['message']
        )
        
        db.session.add(inquiry)
        db.session.commit()
        
        # TODO: Send email to house owner
        # This would use the email utility we'll create
        
        return jsonify({
            'success': True,
            'message': 'Inquiry sent successfully',
            'inquiry': inquiry.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to send inquiry: {str(e)}'
        }), 500


@booking_bp.route('/reserve', methods=['POST'])
@student_required
def reserve_room():
    """
    Reserve a room for later payment (valid for 7 days)
    
    Request Body:
    {
        "house_id": 1,
        "room_id": 1,
        "move_in_date": "2025-11-01",
        "notes": "Optional notes"
    }
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        student_profile = user.student_profile
        
        data = request.get_json()
        
        # Validate required fields
        if not data.get('house_id') or not data.get('room_id'):
            return jsonify({
                'success': False,
                'message': 'House ID and Room ID are required'
            }), 400
        
        # Check consecutive booking limit
        if student_profile:
            if student_profile.consecutive_booking_count >= Config.MAX_CONSECUTIVE_BOOKINGS:
                return jsonify({
                    'success': False,
                    'message': f'You have reached the maximum of {Config.MAX_CONSECUTIVE_BOOKINGS} consecutive bookings'
                }), 400
        
        # Verify house and room
        house = House.query.get(data['house_id'])
        room = Room.query.get(data['room_id'])
        
        if not house or not room:
            return jsonify({
                'success': False,
                'message': 'House or room not found'
            }), 404

        # Prevent reserving if house has been marked full
        if house.is_full:
            return jsonify({
                'success': False,
                'message': 'House is full; cannot reserve rooms at this time'
            }), 400
        
        if room.house_id != house.id:
            return jsonify({
                'success': False,
                'message': 'Room does not belong to this house'
            }), 400
        
        if not room.is_available or room.is_occupied:
            return jsonify({
                'success': False,
                'message': 'Room is not available'
            }), 400
        
        # Create booking
        booking = Booking(
            student_id=current_user_id,
            house_id=data['house_id'],
            room_id=data['room_id'],
            booking_type='reserved',
            notes=data.get('notes'),
            move_in_date=datetime.fromisoformat(data['move_in_date']) if data.get('move_in_date') else None
        )
        
        # Set expiry date (7 days from now)
        booking.set_expiry_date()
        
        # Update consecutive booking count
        if student_profile:
            student_profile.consecutive_booking_count += 1
            student_profile.last_booking_date = datetime.utcnow()
        
        db.session.add(booking)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Room reserved successfully',
            'booking': booking.to_dict(include_house_details=True),
            'expires_in_days': booking.days_until_expiry
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to reserve room: {str(e)}'
        }), 500


@booking_bp.route('/confirm', methods=['POST'])
@student_required
def confirm_booking():
    """
    Confirm a booking with payment
    
    Request Body:
    {
        "booking_id": 1  (optional - for confirming existing reservation)
        OR
        "house_id": 1,
        "room_id": 1,
        "move_in_date": "2025-11-01",
        "payment_method": "ecocash",
        "transaction_reference": "ABC123"
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        booking = None
        
        # Check if confirming existing reservation
        if data.get('booking_id'):
            booking = Booking.query.get(data['booking_id'])
            
            if not booking or booking.student_id != current_user_id:
                return jsonify({
                    'success': False,
                    'message': 'Booking not found'
                }), 404
            
            if booking.is_expired:
                return jsonify({
                    'success': False,
                    'message': 'Booking has expired'
                }), 400
            
            # Update booking to confirmed
            booking.booking_type = 'confirmed'
            booking.is_paid = True
            
        else:
            # Create new direct booking
            if not data.get('house_id') or not data.get('room_id'):
                return jsonify({
                    'success': False,
                    'message': 'House ID and Room ID are required'
                }), 400
            
            # Verify room is available
            room = Room.query.get(data['room_id'])
            if not room or not room.is_available or room.is_occupied:
                return jsonify({
                    'success': False,
                    'message': 'Room is not available'
                }), 400

            # Load house and prevent direct confirmed booking if marked full
            house = House.query.get(data['house_id'])
            if house and house.is_full:
                return jsonify({
                    'success': False,
                    'message': 'House is full; cannot create booking at this time'
                }), 400
            
            # Create confirmed booking
            booking = Booking(
                student_id=current_user_id,
                house_id=data['house_id'],
                room_id=data['room_id'],
                booking_type='confirmed',
                is_paid=True,
                move_in_date=datetime.fromisoformat(data['move_in_date']) if data.get('move_in_date') else None,
                notes=data.get('notes')
            )
            
            db.session.add(booking)
        
        # Mark room as occupied
        room = Room.query.get(booking.room_id)
        room.is_occupied = True
        room.current_tenant_id = current_user_id
        room.occupancy_start_date = booking.move_in_date or datetime.utcnow()
        # Recompute and persist house fullness status after occupancy change
        try:
            if room.house:
                # available_rooms is computed based on current room states; after marking this room occupied,
                # available_rooms will be decreased accordingly. House is full when available_rooms == 0
                room.house.is_full = (room.house.available_rooms == 0)
        except Exception:
            # non-fatal: don't block booking if fullness calc fails
            pass
        
        # Reset consecutive booking count on successful payment
        user = User.query.get(current_user_id)
        if user.student_profile:
            user.student_profile.consecutive_booking_count = 0
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Booking confirmed successfully',
            'booking': booking.to_dict(include_house_details=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to confirm booking: {str(e)}'
        }), 500


@booking_bp.route('/my-bookings', methods=['GET'])
@student_required
def get_my_bookings():
    """Get all bookings for the current student"""
    try:
        current_user_id = get_jwt_identity()
        
        # Get bookings
        bookings = Booking.query.filter_by(student_id=current_user_id).order_by(
            Booking.created_at.desc()
        ).all()
        
        return jsonify({
            'success': True,
            'count': len(bookings),
            'bookings': [booking.to_dict(include_house_details=True) for booking in bookings]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get bookings: {str(e)}'
        }), 500


@booking_bp.route('/<int:booking_id>/cancel', methods=['PUT'])
@student_required
def cancel_booking(booking_id):
    """Cancel a booking"""
    try:
        current_user_id = get_jwt_identity()
        
        booking = Booking.query.get(booking_id)
        
        if not booking or booking.student_id != current_user_id:
            return jsonify({
                'success': False,
                'message': 'Booking not found'
            }), 404
        
        if booking.booking_type == 'cancelled':
            return jsonify({
                'success': False,
                'message': 'Booking is already cancelled'
            }), 400
        
        payload = request.get_json() or {}
        
        # Free up the room if it was occupied
        room = booking.room
        if room:
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

        booking.booking_type = 'cancelled'
        booking.cancellation_reason = payload.get('reason', 'Cancelled by student')
        booking.owner_response_date = datetime.utcnow()  # or something, but maybe not needed

        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Booking cancelled',
            'booking': booking.to_dict(include_student_details=True, include_house_details=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to cancel booking: {str(e)}'
        }), 500


@booking_bp.route('/inquiries', methods=['GET'])
@jwt_required()
def get_my_inquiries():
    """
    Get inquiries
    For students: Get their sent inquiries
    For house owners: Get inquiries for their house
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if user.user_type == 'student':
            inquiries = BookingInquiry.query.filter_by(student_id=current_user_id).order_by(
                BookingInquiry.created_at.desc()
            ).all()
        elif user.user_type == 'house_owner':
            if not user.owned_house:
                return jsonify({
                    'success': True,
                    'count': 0,
                    'inquiries': []
                }), 200
            
            inquiries = BookingInquiry.query.filter_by(house_id=user.owned_house.id).order_by(
                BookingInquiry.created_at.desc()
            ).all()
        else:
            return jsonify({
                'success': False,
                'message': 'Invalid user type'
            }), 403
        
        return jsonify({
            'success': True,
            'count': len(inquiries),
            'inquiries': [inquiry.to_dict() for inquiry in inquiries]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get inquiries: {str(e)}'
        }), 500


@booking_bp.route('/inquiries/<int:inquiry_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_my_inquiry(inquiry_id):
    """Allow a student to cancel their own inquiry"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)

        if not user or user.user_type != 'student':
            return jsonify({'success': False, 'message': 'Student access required'}), 403

        inquiry = BookingInquiry.query.get(inquiry_id)
        if not inquiry or inquiry.student_id != user.id:
            return jsonify({'success': False, 'message': 'Inquiry not found'}), 404

        # Update status to cancelled (soft cancel)
        inquiry.status = 'cancelled'
        db.session.commit()

        return jsonify({'success': True, 'message': 'Inquiry cancelled'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to cancel inquiry: {str(e)}'}), 500