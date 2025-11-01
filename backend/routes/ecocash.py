"""
EcoCash Callback Routes
=======================
Handles payment notifications from EcoCash and updates payment & verification.
Location: backend/routes/ecocash.py

Endpoint:
- POST /api/v1/ecocash/callback
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from models import db, Payment, User
from config import Config
import logging

ecocash_bp = Blueprint('ecocash', __name__)


@ecocash_bp.route('/callback', methods=['POST'])
def ecocash_callback():
    """Receive EcoCash payment notifications.
    Expected JSON includes at least a unique reference and a status.
    We'll be tolerant with key names since providers differ.
    """
    try:
        payload = request.get_json(silent=True) or {}
        # Log the raw payload for troubleshooting
        logging.info('EcoCash callback payload: %s', payload)

        # Try to extract a reference used when initiating the payment
        ref = payload.get('sourceReference') or payload.get('reference') or payload.get('source_reference')
        status = str(payload.get('status') or '').upper()
        txn_id = payload.get('transactionId') or payload.get('transaction_id')

        if not ref:
            return jsonify({'success': False, 'message': 'Missing source reference'}), 400

        payment = Payment.query.filter_by(transaction_reference=ref).first()
        if not payment:
            return jsonify({'success': False, 'message': 'Payment not found'}), 404

        # Save raw callback for audit
        raw = payment.gateway_response or ''
        newraw = f"{raw}\n\nCALLBACK@{datetime.utcnow().isoformat()}: {payload}"
        payment.gateway_response = newraw[:8000]

        # Interpret status
        success = status in ('SUCCESS', 'COMPLETED', 'OK', '200') or payload.get('code') in (200, '200')

        if success:
            payment.status = 'completed'
            payment.confirmed_date = datetime.utcnow()
            if txn_id:
                payment.transaction_id = str(txn_id)

            # Auto-verify student if this is the verification payment
            if payment.payment_type == 'student_verification' and payment.payer_id:
                user = User.query.get(payment.payer_id)
                if user and user.user_type == 'student':
                    user.admin_verified = True
                    user.admin_verified_at = datetime.utcnow()
                    # 30-day verification window by default
                    user.admin_verified_expires_at = datetime.utcnow() + timedelta(days=30)
        else:
            payment.status = 'failed'
            # Optionally store a reason
            if isinstance(payload.get('message'), str):
                payment.notes = payload.get('message')

        db.session.commit()

        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        logging.exception('EcoCash callback failed')
        return jsonify({'success': False, 'message': f'Callback handling failed: {str(e)}'}), 500
