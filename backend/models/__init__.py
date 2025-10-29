"""
Models Package Initializer
===========================
Imports all database models and makes them available
Location: backend/models/__init__.py
"""

from models.user import db, User, Student, HouseOwner
from models.house import ResidentialArea, House, Room
from models.booking import Booking, BookingInquiry
from models.payment import Payment, SubscriptionPayment
from models.user import AdminAudit, PaymentProof

# Export all models for easy importing
__all__ = [
    'db',
    'User',
    'Student',
    'HouseOwner',
    'ResidentialArea',
    'House',
    'Room',
    'Booking',
    'BookingInquiry',
    'Payment',
    'SubscriptionPayment',
    'AdminAudit',
    'PaymentProof',
]