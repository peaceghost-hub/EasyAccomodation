"""
Booking Model
=============
Manages room bookings and inquiries
Location: backend/models/booking.py
"""

from datetime import datetime, timedelta
from models.user import db
from config import Config


class Booking(db.Model):
    """
    Student bookings for rooms
    Tracks both inquiries and actual bookings
    """
    __tablename__ = 'bookings'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Foreign Keys
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    house_id = db.Column(db.Integer, db.ForeignKey('houses.id'), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    
    # Booking Type
    booking_type = db.Column(db.String(20), nullable=False)  # 'inquiry', 'reserved', 'confirmed', 'cancelled'
    
    # Booking Status Flow:
    # 1. 'inquiry' - Student sends inquiry email to owner
    # 2. 'reserved' - Student books for later payment (1 week validity)
    # 3. 'confirmed' - Student has paid
    # 4. 'cancelled' - Booking cancelled or expired
    
    # Dates
    booking_date = db.Column(db.DateTime, default=datetime.utcnow)
    expiry_date = db.Column(db.DateTime)  # For 'reserved' bookings (1 week from booking)
    move_in_date = db.Column(db.DateTime)
    move_out_date = db.Column(db.DateTime)
    
    # Inquiry Details (for inquiry emails)
    inquiry_message = db.Column(db.Text)
    inquiry_status = db.Column(db.String(20))  # 'pending', 'approved', 'rejected'
    owner_response = db.Column(db.Text)
    owner_response_date = db.Column(db.DateTime)
    
    # Payment Information
    is_paid = db.Column(db.Boolean, default=False)
    payment_id = db.Column(db.Integer, db.ForeignKey('payments.id'), nullable=True)
    
    # Notes
    notes = db.Column(db.Text)
    owner_status = db.Column(db.String(20), default='pending')  # 'pending', 'accepted', 'cancelled'
    cancellation_reason = db.Column(db.Text)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    payment = db.relationship('Payment', backref='booking', uselist=False)
    
    @property
    def is_expired(self):
        """Check if booking has expired (for reserved bookings)"""
        if self.booking_type == 'reserved' and self.expiry_date:
            return datetime.utcnow() > self.expiry_date
        return False
    
    @property
    def days_until_expiry(self):
        """Calculate days remaining until expiry"""
        if self.booking_type == 'reserved' and self.expiry_date:
            delta = self.expiry_date - datetime.utcnow()
            return max(0, delta.days)
        return None
    
    def to_dict(self, include_student_details=False, include_house_details=False):
        """Convert booking to dictionary"""
        data = {
            'id': self.id,
            'booking_type': self.booking_type,
            'booking_date': self.booking_date.isoformat(),
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'move_in_date': self.move_in_date.isoformat() if self.move_in_date else None,
            'move_out_date': self.move_out_date.isoformat() if self.move_out_date else None,
            'is_paid': self.is_paid,
            'is_expired': self.is_expired,
            'days_until_expiry': self.days_until_expiry,
            'inquiry_status': self.inquiry_status,
            'notes': self.notes,
            'owner_status': self.owner_status or 'pending',
        }
        
        # Include student details if requested (for house owners viewing bookings)
        if include_student_details and self.student:
            data['student'] = {
                'id': self.student.id,
                'name': self.student.full_name,
                'email': self.student.email,
                'phone': self.student.phone_number,
            }
        
        # Include house/room details if requested (for students viewing their bookings)
        if include_house_details:
            data['house'] = {
                'id': self.house.id,
                'address': f"{self.house.house_number} {self.house.street_address}",
                'area': self.house.residential_area.name,
            }
            data['room'] = {
                'id': self.room.id,
                'room_number': self.room.room_number,
                'capacity': self.room.capacity,
                'price': self.room.price_per_month,
            }
        
        return data
    
    def set_expiry_date(self, days=None):
        """Set expiry date for reserved bookings"""
        if days is None:
            days = Config.BOOKING_EXPIRY_DAYS
        self.expiry_date = datetime.utcnow() + timedelta(days=days)
    
    def __repr__(self):
        return f'<Booking {self.id} - {self.booking_type} - Student: {self.student_id}>'


class BookingInquiry(db.Model):
    """
    Separate table for inquiry emails
    Tracks communication between students and house owners
    """
    __tablename__ = 'booking_inquiries'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Foreign Keys
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    house_id = db.Column(db.Integer, db.ForeignKey('houses.id'), nullable=False)
    
    # Inquiry Details
    subject = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    
    # Status
    status = db.Column(db.String(20), default='sent')  # 'sent', 'read', 'replied'
    
    # Owner Response
    response = db.Column(db.Text)
    response_date = db.Column(db.DateTime)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    student = db.relationship('User', foreign_keys=[student_id])
    house = db.relationship('House', foreign_keys=[house_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'house_id': self.house_id,
            'student_name': self.student.full_name,
            'student_email': self.student.email,
            'student_phone': self.student.phone_number,
            'house_address': f"{self.house.house_number} {self.house.street_address}",
            'subject': self.subject,
            'message': self.message,
            'status': self.status,
            'response': self.response,
            'response_date': self.response_date.isoformat() if self.response_date else None,
            'created_at': self.created_at.isoformat(),
        }
    
    def __repr__(self):
        return f'<Inquiry {self.id} - Student: {self.student_id} - House: {self.house_id}>'