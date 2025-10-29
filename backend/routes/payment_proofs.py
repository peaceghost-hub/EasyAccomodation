from flask import Blueprint, request, jsonify, current_app, url_for
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from models import db, User, PaymentProof
from config import Config

payment_bp = Blueprint('payment_proofs', __name__)


def allowed_file(filename):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    return ext in Config.ALLOWED_EXTENSIONS


@payment_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_payment_proof():
    """
    Student uploads proof of payment. Multipart form with file field 'proof'.
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or user.user_type != 'student':
            return jsonify({'success': False, 'message': 'Student access required'}), 403

        if 'proof' not in request.files:
            return jsonify({'success': False, 'message': 'No file uploaded (field name: proof)'}), 400

        file = request.files['proof']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': 'File type not allowed'}), 400

        # Ensure folder exists
        proofs_folder = os.path.join(os.path.dirname(__file__), '..', 'static', 'payment_proofs')
        os.makedirs(proofs_folder, exist_ok=True)

        filename = secure_filename(file.filename)
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
        stored_name = f"proof_u{user.id}_{timestamp}_{filename}"
        stored_path = os.path.join(proofs_folder, stored_name)
        file.save(stored_path)

        # Create PaymentProof record
        proof = PaymentProof(
            user_id=user.id,
            filename=stored_name,
            original_filename=filename,
            status='pending'
        )
        db.session.add(proof)
        db.session.commit()

        # Return a URL for the admin to view (relative path)
        view_url = f"/static/payment_proofs/{stored_name}"

        return jsonify({'success': True, 'message': 'Proof uploaded', 'proof': proof.to_dict(), 'view_url': view_url}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Upload failed: {str(e)}'}), 500
