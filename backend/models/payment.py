"""
Payment Models
==============
Manages all payments in the system:
1. Student payments to house owners (for rooms)
2. House owner payments to admin (monthly subscription)
Location: backend/models/payment.py
"""

from datetime import datetime
from models.user import db


class Payment(db.Model):
    """
    Main payment tracking table
    Handles both student->owner and owner->admin payments
    """
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Payment Type
    payment_type = db.Column(db.String(20), nullable=False)  # 'room_rental', 'subscription'
    
    # Who paid and who received
    payer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # Student or House Owner
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # House Owner or Admin
    
    # Payment Details
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), default='USD')
    
    # Payment Method
    payment_method = db.Column(db.String(50), nullable=False)  # 'paypal', 'ecocash', 'bank_transfer', 'cash'
    
    # Payment Status
    status = db.Column(db.String(20), default='pending')  # 'pending', 'completed', 'failed', 'refunded'
    
    # Transaction Details
    transaction_id = db.Column(db.String(100), unique=True)  # From payment gateway
    transaction_reference = db.Column(db.String(100))  # Internal reference
    
    # Gateway-specific data (stored as JSON-like text)
    gateway_response = db.Column(db.Text)  # Raw response from PayPal/EcoCash
    
    # Dates
    payment_date = db.Column(db.DateTime, default=datetime.utcnow)
    confirmed_date = db.Column(db.DateTime)
    
    # For Room Rentals (student payments)
    house_id = db.Column(db.Integer, db.ForeignKey('houses.id'), nullable=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=True)
    rental_period_start = db.Column(db.DateTime)
    rental_period_end = db.Column(db.DateTime)
    
    # For Subscriptions (house owner payments to admin)
    subscription_month = db.Column(db.String(7))  # Format: "2025-01" for January 2025
    
    # Notes
    notes = db.Column(db.Text)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    payer = db.relationship('User', foreign_keys=[payer_id], backref='payments_made')
    recipient = db.relationship('User', foreign_keys=[recipient_id], backref='payments_received')
    house = db.relationship('House', foreign_keys=[house_id])
    room = db.relationship('Room', foreign_keys=[room_id])
    
    def to_dict(self, include_user_details=False):
        """Convert payment to dictionary"""
        data = {
            'id': self.id,
            'payment_type': self.payment_type,
            'amount': self.amount,
            'currency': self.currency,
            'payment_method': self.payment_method,
            'status': self.status,
            'transaction_id': self.transaction_id,
            'transaction_reference': self.transaction_reference,
            'payment_date': self.payment_date.isoformat(),
            'confirmed_date': self.confirmed_date.isoformat() if self.confirmed_date else None,
            'notes': self.notes,
        }
        
        # Add rental details if it's a room rental payment
        if self.payment_type == 'room_rental' and self.room:
            data['rental_details'] = {
                'house_id': self.house_id,
                'room_number': self.room.room_number,
                'period_start': self.rental_period_start.isoformat() if self.rental_period_start else None,
                'period_end': self.rental_period_end.isoformat() if self.rental_period_end else None,
            }
        
        # Add subscription details if it's a subscription payment
        if self.payment_type == 'subscription':
            data['subscription_details'] = {
                'month': self.subscription_month,
            }
        
        # Include user details if requested
        if include_user_details:
            data['payer'] = {
                'id': self.payer.id,
                'name': self.payer.full_name,
                'email': self.payer.email,
            }
            if self.recipient:
                data['recipient'] = {
                    'id': self.recipient.id,
                    'name': self.recipient.full_name,
                    'email': self.recipient.email,
                }
        
        return data
    
    def mark_as_completed(self):
        """Mark payment as completed"""
        self.status = 'completed'
        self.confirmed_date = datetime.utcnow()
    
    def mark_as_failed(self, reason=None):
        """Mark payment as failed"""
        self.status = 'failed'
        if reason:
            self.notes = f"Failed: {reason}"
    
    def __repr__(self):
        return f'<Payment {self.id} - {self.payment_type} - {self.amount} {self.currency}>'


class SubscriptionPayment(db.Model):
    """
    Tracks house owner monthly subscriptions to admin
    Separate table for easier subscription management
    """
    __tablename__ = 'subscription_payments'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Foreign Keys
    house_owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    house_id = db.Column(db.Integer, db.ForeignKey('houses.id'), nullable=False)
    payment_id = db.Column(db.Integer, db.ForeignKey('payments.id'), nullable=True)
    
    # Subscription Details
    subscription_month = db.Column(db.String(7), nullable=False)  # "2025-01"
    amount_due = db.Column(db.Float, nullable=False)
    amount_paid = db.Column(db.Float, default=0.0)
    
    # Status
    status = db.Column(db.String(20), default='pending')  # 'pending', 'paid', 'overdue', 'waived'
    
    # Dates
    due_date = db.Column(db.DateTime, nullable=False)
    paid_date = db.Column(db.DateTime)
    
    # Grace period (days after due date before house is deactivated)
    grace_period_days = db.Column(db.Integer, default=7)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    house_owner = db.relationship('User', foreign_keys=[house_owner_id])
    house = db.relationship('House', foreign_keys=[house_id])
    payment = db.relationship('Payment', foreign_keys=[payment_id])
    
    @property
    def is_overdue(self):
        """Check if payment is overdue"""
        if self.status == 'paid':
            return False
        grace_end = self.due_date + timedelta(days=self.grace_period_days)
        return datetime.utcnow() > grace_end
    
    @property
    def days_overdue(self):
        """Calculate how many days overdue"""
        if not self.is_overdue:
            return 0
        grace_end = self.due_date + timedelta(days=self.grace_period_days)
        delta = datetime.utcnow() - grace_end
        return delta.days
    
    def to_dict(self):
        return {
            'id': self.id,
            'house_owner_name': self.house_owner.full_name,
            'house_address': f"{self.house.house_number} {self.house.street_address}",
            'subscription_month': self.subscription_month,
            'amount_due': self.amount_due,
            'amount_paid': self.amount_paid,
            'status': self.status,
            'due_date': self.due_date.isoformat(),
            'paid_date': self.paid_date.isoformat() if self.paid_date else None,
            'is_overdue': self.is_overdue,
            'days_overdue': self.days_overdue,
        }
    
    def __repr__(self):
        return f'<SubscriptionPayment {self.subscription_month} - Owner: {self.house_owner_id}>'


from datetime import timedelta  # Import at top of file