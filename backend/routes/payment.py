"""
Payment Routes
==============
Handles payment processing
Location: backend/routes/payment.py

Endpoints:
- POST /api/payments/room-rental - Process room rental payment
- POST /api/payments/subscription - House owner pays monthly subscription
- GET /api/payments/my-payments - Get user's payment history
- GET /api/payments/<id> - Get specific payment details
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from models import db, Payment, SubscriptionPayment, House, Room, User, HouseOwner, Booking
from config import Config
import uuid
import requests
import logging

# Create Blueprint
payment_bp = Blueprint('payments', __name__)


@payment_bp.route('/room-rental', methods=['POST'])
@jwt_required()
def process_room_rental():
    """
    Process room rental payment (student pays house owner)
    
    Request Body:
    {
        "booking_id": 1,
        "room_id": 1,
        "house_id": 1,
        "amount": 150.00,
        "payment_method": "ecocash",  // ecocash, paypal, bank_transfer, cash
        "transaction_reference": "ECO123456",
        "rental_period_months": 1
    }
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if user.user_type != 'student':
            return jsonify({
                'success': False,
                'message': 'Only students can make room rental payments'
            }), 403
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['house_id', 'room_id', 'amount', 'payment_method']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Verify house and room
        house = House.query.get(data['house_id'])
        room = Room.query.get(data['room_id'])
        
        if not house or not room:
            return jsonify({
                'success': False,
                'message': 'House or room not found'
            }), 404
        
        if not house.owner:
            return jsonify({
                'success': False,
                'message': 'House has no owner'
            }), 400
        
        # Create payment record
        payment = Payment(
            payment_type='room_rental',
            payer_id=current_user_id,
            recipient_id=house.owner_id,
            amount=data['amount'],
            payment_method=data['payment_method'],
            status='completed',  # In real app, this would be 'pending' until verified
            transaction_id=str(uuid.uuid4()),
            transaction_reference=data.get('transaction_reference'),
            house_id=data['house_id'],
            room_id=data['room_id'],
            rental_period_start=datetime.utcnow(),
            rental_period_end=datetime.utcnow() + timedelta(days=30 * data.get('rental_period_months', 1)),
            notes=data.get('notes')
        )
        
        payment.mark_as_completed()
        
        # Update booking if provided
        if data.get('booking_id'):
            booking = Booking.query.get(data['booking_id'])
            if booking and booking.student_id == current_user_id:
                booking.payment_id = payment.id
                booking.is_paid = True
                booking.booking_type = 'confirmed'
        
        db.session.add(payment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Payment processed successfully',
            'payment': payment.to_dict(include_user_details=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Payment failed: {str(e)}'
        }), 500


@payment_bp.route('/subscription', methods=['POST'])
@jwt_required()
def process_subscription():
    """
    House owner pays monthly subscription to admin
    
    Request Body:
    {
        "amount": 50.00,
        "payment_method": "ecocash",
        "transaction_reference": "ECO789456",
        "subscription_month": "2025-11"  // Format: YYYY-MM
    }
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if user.user_type != 'house_owner':
            return jsonify({
                'success': False,
                'message': 'Only house owners can make subscription payments'
            }), 403
        
        if not user.owned_house:
            return jsonify({
                'success': False,
                'message': 'You must have a house registered to pay subscription'
            }), 400
        
        data = request.get_json()
        
        # Validate required fields
        if not data.get('amount') or not data.get('payment_method'):
            return jsonify({
                'success': False,
                'message': 'Amount and payment method are required'
            }), 400
        
        # Get admin user (recipient)
        admin = User.query.filter_by(user_type='admin').first()
        
        # Create payment record
        payment = Payment(
            payment_type='subscription',
            payer_id=current_user_id,
            recipient_id=admin.id if admin else None,
            amount=data['amount'],
            payment_method=data['payment_method'],
            status='completed',
            transaction_id=str(uuid.uuid4()),
            transaction_reference=data.get('transaction_reference'),
            subscription_month=data.get('subscription_month', datetime.utcnow().strftime('%Y-%m'))
        )
        
        payment.mark_as_completed()
        
        # Update or create subscription payment record
        subscription_month = data.get('subscription_month', datetime.utcnow().strftime('%Y-%m'))
        
        subscription = SubscriptionPayment.query.filter_by(
            house_owner_id=current_user_id,
            subscription_month=subscription_month
        ).first()
        
        if subscription:
            subscription.amount_paid = data['amount']
            subscription.status = 'paid'
            subscription.paid_date = datetime.utcnow()
            subscription.payment_id = payment.id
        else:
            # Create new subscription record
            subscription = SubscriptionPayment(
                house_owner_id=current_user_id,
                house_id=user.owned_house.id,
                subscription_month=subscription_month,
                amount_due=Config.MONTHLY_SUBSCRIPTION_FEE,
                amount_paid=data['amount'],
                status='paid',
                due_date=datetime.utcnow(),
                paid_date=datetime.utcnow(),
                payment_id=payment.id
            )
            db.session.add(subscription)
        
        # Update owner profile
        if user.owner_profile:
            user.owner_profile.last_payment_date = datetime.utcnow()
            user.owner_profile.next_payment_due = datetime.utcnow() + timedelta(days=30)
            user.owner_profile.payment_status = 'paid'
            user.owner_profile.total_amount_paid += data['amount']
        
        db.session.add(payment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Subscription payment processed successfully',
            'payment': payment.to_dict(),
            'subscription': subscription.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Subscription payment failed: {str(e)}'
        }), 500


@payment_bp.route('/my-payments', methods=['GET'])
@jwt_required()
def get_my_payments():
    """
    Get payment history for current user
    Students see their rental payments
    House owners see their received payments and subscription payments
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        payments = []
        
        if user.user_type == 'student':
            # Get payments made by student
            payments = Payment.query.filter_by(payer_id=current_user_id).order_by(
                Payment.payment_date.desc()
            ).all()
        
        elif user.user_type == 'house_owner':
            # Get payments received and subscription payments made
            received = Payment.query.filter_by(
                recipient_id=current_user_id,
                payment_type='room_rental'
            ).all()
            
            subscriptions = Payment.query.filter_by(
                payer_id=current_user_id,
                payment_type='subscription'
            ).all()
            
            payments = received + subscriptions
            payments.sort(key=lambda x: x.payment_date, reverse=True)
        
        elif user.user_type == 'admin':
            # Admin sees all subscription payments received
            payments = Payment.query.filter_by(
                payment_type='subscription'
            ).order_by(Payment.payment_date.desc()).all()
        
        return jsonify({
            'success': True,
            'count': len(payments),
            'payments': [payment.to_dict(include_user_details=True) for payment in payments]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get payments: {str(e)}'
        }), 500


@payment_bp.route('/<int:payment_id>', methods=['GET'])
@jwt_required()
def get_payment_details(payment_id):
    """Get specific payment details"""
    try:
        current_user_id = get_jwt_identity()
        
        payment = Payment.query.get(payment_id)
        
        if not payment:
            return jsonify({
                'success': False,
                'message': 'Payment not found'
            }), 404
        
        # Check authorization
        if payment.payer_id != current_user_id and payment.recipient_id != current_user_id:
            user = User.query.get(current_user_id)
            if user.user_type != 'admin':
                return jsonify({
                    'success': False,
                    'message': 'Unauthorized to view this payment'
                }), 403
        
        return jsonify({
            'success': True,
            'payment': payment.to_dict(include_user_details=True)
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to get payment: {str(e)}'
        }), 500


@payment_bp.route('/ecocash/initiate', methods=['POST'])
@jwt_required()
def ecocash_initiate():
    """
    Initiate EcoCash C2B payment for student verification.
    Body: { msisdn: string }
    Returns: { reference: string, message }
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or user.user_type != 'student':
            return jsonify({'success': False, 'message': 'Only students can pay for verification'}), 403

        data = request.get_json() or {}
        msisdn = str(data.get('msisdn', '')).strip()
        if not msisdn:
            return jsonify({'success': False, 'message': 'msisdn (phone number) is required'}), 400

        # Normalize msisdn to 263 format if user enters 07xxxxxxxx
        if msisdn.startswith('07') and len(msisdn) == 10:
            msisdn_263 = '263' + msisdn[1:]
        elif msisdn.startswith('263'):
            msisdn_263 = msisdn
        elif msisdn.startswith('+263'):
            msisdn_263 = msisdn[1:]
        else:
            msisdn_263 = msisdn  # best-effort

        amount = Config.ECOCASH_VERIFICATION_AMOUNT_USD
        currency = 'USD'
        reason = 'Student Verification'
        source_ref = str(uuid.uuid4())

        # Create payment record as pending
        payment = Payment(
            payment_type='student_verification',
            payer_id=current_user_id,
            recipient_id=None,
            amount=amount,
            currency=currency,
            payment_method='ecocash',
            status='pending',
            transaction_reference=source_ref,
            notes=f'EcoCash payment init for {reason}'
        )
        db.session.add(payment)
        db.session.commit()

        # Build EcoCash API URL
        path = '/api/v2/payment/instant/c2b/sandbox' if Config.ECOCASH_MODE == 'sandbox' else '/api/v2/payment/instant/c2b/live'
        url = f"{Config.ECOCASH_BASE_URL.rstrip('/')}{path}"

        # Normalize receiving merchant number to 263 format
        recv = (Config.ECOCASH_RECEIVER_MSISDN or '').strip()
        if recv.startswith('07') and len(recv) == 10:
            recv_263 = '263' + recv[1:]
        elif recv.startswith('+263'):
            recv_263 = recv[1:]
        elif recv.startswith('263'):
            recv_263 = recv
        else:
            recv_263 = recv

        # Build callback URL for EcoCash to notify us (if they require it in request)
        try:
            base = request.host_url.rstrip('/')  # e.g., http://localhost:5000
            cb = Config.ECOCASH_CALLBACK_PATH or '/api/v1/ecocash/callback'
            callback_url = f"{base}{cb}"
        except Exception:
            callback_url = None

        payload = {
            'customerMsisdn': msisdn_263,
            'amount': amount,
            'reason': reason,
            'currency': currency,
            'sourceReference': source_ref,
            # Include merchant details so payment goes to your merchant instead of a default sandbox merchant
            'merchantCode': Config.ECOCASH_MERCHANT_ID,
            'payeeMsisdn': recv_263,
        }
        if callback_url:
            payload['callbackUrl'] = callback_url

        headers = {
            'X-API-KEY': (Config.ECOCASH_API_KEY or ''),
            'Content-Type': 'application/json',
        }

        try:
            # Fire-and-forget: even if request fails, keep payment pending and let user retry
            resp = requests.post(url, json=payload, headers=headers, timeout=20)
            # Save raw response for troubleshooting
            payment.gateway_response = (resp.text or '')[:4000]
            db.session.commit()
        except Exception as ex:
            logging.exception('EcoCash initiate request failed')
            payment.gateway_response = f'ERROR: {str(ex)}'
            db.session.commit()

        return jsonify({'success': True, 'message': 'EcoCash request sent. Check your phone to approve.', 'reference': source_ref}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to initiate EcoCash: {str(e)}'}), 500


@payment_bp.route('/ecocash/status/<reference>', methods=['GET'])
@jwt_required()
def ecocash_status(reference):
    """Poll status for a given EcoCash source reference (only for owner of the payment)."""
    try:
        current_user_id = get_jwt_identity()
        payment = Payment.query.filter_by(transaction_reference=reference).first()
        if not payment or payment.payer_id != current_user_id:
            return jsonify({'success': False, 'message': 'Not found'}), 404
        return jsonify({'success': True, 'status': payment.status, 'payment': payment.to_dict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to get status: {str(e)}'}), 500


@payment_bp.route('/verify', methods=['POST'])
@jwt_required()
def verify_payment():
    """
    Verify a payment (for manual verification)
    Admin or house owner can verify
    
    Request Body:
    {
        "payment_id": 1,
        "verified": true
    }
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        data = request.get_json()
        
        if not data.get('payment_id'):
            return jsonify({
                'success': False,
                'message': 'Payment ID is required'
            }), 400
        
        payment = Payment.query.get(data['payment_id'])
        
        if not payment:
            return jsonify({
                'success': False,
                'message': 'Payment not found'
            }), 404
        
        # Check authorization
        can_verify = (
            user.user_type == 'admin' or
            (user.user_type == 'house_owner' and payment.recipient_id == current_user_id)
        )
        
        if not can_verify:
            return jsonify({
                'success': False,
                'message': 'Unauthorized to verify this payment'
            }), 403
        
        # Update payment status
        if data.get('verified'):
            payment.status = 'completed'
            payment.confirmed_date = datetime.utcnow()
        else:
            payment.status = 'failed'
            payment.notes = data.get('reason', 'Payment verification failed')
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Payment verification updated',
            'payment': payment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Payment verification failed: {str(e)}'
        }), 500