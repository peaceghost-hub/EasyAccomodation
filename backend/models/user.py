from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import foreign

db = SQLAlchemy()

class User(db.Model):
    """
    User model for all three user types: Admin, House Owner, Student
    """
    __tablename__ = 'users'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic Information
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    
    # User Type: 'admin', 'house_owner', 'student'
    user_type = db.Column(db.String(20), nullable=False)
    
    # For admins: track who created this admin account (None for root/initial admins)
    created_by_admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Account Status
    is_active = db.Column(db.Boolean, default=True)
    # Email verification (sent on registration)
    email_verified = db.Column(db.Boolean, default=False)
    email_verified_at = db.Column(db.DateTime, nullable=True)
    email_verification_token = db.Column(db.String(128), nullable=True, index=True)
    # Admin verification (payment checked & approved by admin)
    admin_verified = db.Column(db.Boolean, default=False)
    admin_verified_at = db.Column(db.DateTime, nullable=True)
    admin_verified_expires_at = db.Column(db.DateTime, nullable=True)  # 30 days from verification
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # If user is a house owner, they have one house
    owned_house = db.relationship('House', backref='owner', uselist=False, lazy=True)
    
    # If user is a student, they can have multiple bookings
    bookings = db.relationship('Booking', backref='student', lazy=True)
    
    def set_password(self, password):
        """
        Hash and set password - NEVER store plain passwords
        """
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """
        Verify password during login
        """
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """
        Convert user object to dictionary (for JSON responses)
        Excludes sensitive information like password_hash
        """
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'phone_number': self.phone_number,
            'user_type': self.user_type,
            'is_active': self.is_active,
            'email_verified': getattr(self, 'email_verified', False),
            'admin_verified': getattr(self, 'admin_verified', False),
            'admin_verified_expires_at': self.admin_verified_expires_at.isoformat() if self.admin_verified_expires_at else None,
            'created_at': self.created_at.isoformat(),
            'created_by_admin_id': self.created_by_admin_id,
        }
    
    def is_verification_expired(self):
        """Check if admin verification has expired (30 days)"""
        if not self.admin_verified:
            return False
        if not self.admin_verified_expires_at:
            return False
        return datetime.utcnow() > self.admin_verified_expires_at
    
    def __repr__(self):
        return f'<User {self.email} - {self.user_type}>'


class Student(db.Model):
    """
    Extended information for students
    Stores booking history and restrictions
    """
    __tablename__ = 'students'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    
    # Student-specific information
    student_id = db.Column(db.String(50), unique=True)  # University ID
    institution = db.Column(db.String(100))
    
    # Booking restrictions
    consecutive_booking_count = db.Column(db.Integer, default=0)
    last_booking_date = db.Column(db.DateTime)
    
    # Relationship to User
    user = db.relationship('User', backref=db.backref('student_profile', uselist=False))
    # Relationship to payment proofs uploaded by the student
    # PaymentProof.user_id references users.id (not students.id), so SQLAlchemy cannot
    # infer the join automatically. Specify a primaryjoin that links Student.user_id
    # to PaymentProof.user_id using foreign() so the mapper initialization succeeds.
    payment_proofs = db.relationship(
        'PaymentProof',
        primaryjoin="foreign(PaymentProof.user_id) == Student.user_id",
        backref='student_profile',
        lazy=True,
        cascade='all, delete-orphan'
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'institution': self.institution,
            'consecutive_booking_count': self.consecutive_booking_count,
        }


class HouseOwner(db.Model):
    """
    Extended information for house owners
    Tracks payment status to admin
    """
    __tablename__ = 'house_owners'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Payment to Admin
    last_payment_date = db.Column(db.DateTime)
    next_payment_due = db.Column(db.DateTime)
    payment_status = db.Column(db.String(20), default='pending')  # 'paid', 'pending', 'overdue'
    total_amount_paid = db.Column(db.Float, default=0.0)
    
    # Payment Methods (for students to pay owner)
    ecocash_number = db.Column(db.String(20))
    bank_account = db.Column(db.String(50))
    other_payment_info = db.Column(db.Text)
    
    # Relationship to User
    user = db.relationship('User', backref=db.backref('owner_profile', uselist=False))
    
    def to_dict(self):
        return {
            'id': self.id,
            'payment_status': self.payment_status,
            'last_payment_date': self.last_payment_date.isoformat() if self.last_payment_date else None,
            'next_payment_due': self.next_payment_due.isoformat() if self.next_payment_due else None,
        }

class AdminAudit(db.Model):
    """
    Simple audit log for administrative actions.
    Records who performed the action, the target user (if any), action type and optional details.
    """
    __tablename__ = 'admin_audits'

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    target_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships back to user for convenience
    actor = db.relationship('User', foreign_keys=[actor_id], backref=db.backref('performed_audits', lazy=True))
    target_user = db.relationship('User', foreign_keys=[target_user_id], backref=db.backref('targeted_audits', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'actor_id': self.actor_id,
            'target_user_id': self.target_user_id,
            'action': self.action,
            'details': self.details,
            'created_at': self.created_at.isoformat()
        }


class PaymentProof(db.Model):
    """
    Stores uploaded proof-of-payment files for student subscription verification.
    """
    __tablename__ = 'payment_proofs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(300), nullable=False)
    original_filename = db.Column(db.String(300), nullable=True)
    status = db.Column(db.String(20), default='pending')  # 'pending', 'accepted', 'rejected'
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    admin_comment = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    # relationships
    student = db.relationship('User', foreign_keys=[user_id], backref=db.backref('payment_proof_items', lazy=True))
    reviewer = db.relationship('User', foreign_keys=[admin_id])

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'status': self.status,
            'admin_id': self.admin_id,
            'admin_comment': self.admin_comment,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
        }