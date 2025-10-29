"""
House and Residential Area Models
==================================
Manages houses, their locations, and amenities
Location: backend/models/house.py
"""

from datetime import datetime
import math
from models.user import db


class ResidentialArea(db.Model):
    """
    Residential areas/locations where houses are located
    Examples: Avondale, Belgravia, Mount Pleasant, etc.
    """
    __tablename__ = 'residential_areas'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    
    # Location coordinates (for map display)
    # These are approximate center coordinates of the area
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

    # Approximate distance to main campus in kilometers (admin-provided)
    approximate_distance_km = db.Column(db.Float)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship: One area has many houses
    houses = db.relationship('House', backref='residential_area', lazy=True, cascade='all, delete-orphan')
    
    def _haversine_km(self, lat1, lon1, lat2, lon2):
        try:
            lat1 = float(lat1); lon1 = float(lon1); lat2 = float(lat2); lon2 = float(lon2)
        except Exception:
            return None
        if not (-90 <= lat1 <= 90 and -180 <= lon1 <= 180):
            return None
        R = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return round(R * c, 1)

    def _computed_distance_km(self):
        """Compute distance from this area's coordinates to main campus if coords are present."""
        if self.latitude is None or self.longitude is None:
            return None
        # Main campus
        return self._haversine_km(self.latitude, self.longitude, -19.516, 29.833)

    def _computed_distance_telone_km(self):
        if self.latitude is None or self.longitude is None:
            return None
        # TelOne Campus
        return self._haversine_km(self.latitude, self.longitude, -19.484133, 29.833482)

    def _computed_distance_batanai_km(self):
        if self.latitude is None or self.longitude is None:
            return None
        # Batanai Campus
        return self._haversine_km(self.latitude, self.longitude, -19.498133, 29.840290)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'approximate_distance_km': self.approximate_distance_km,
            'computed_distance_km': self._computed_distance_km(),  # Back-compat: main campus
            'computed_distance_main_km': self._computed_distance_km(),
            'computed_distance_telone_km': self._computed_distance_telone_km(),
            'computed_distance_batanai_km': self._computed_distance_batanai_km(),
            'house_count': len(self.houses),
        }
    
    def __repr__(self):
        return f'<ResidentialArea {self.name}>'


class House(db.Model):
    """
    Individual houses available for accommodation
    Each house belongs to one residential area and one owner
    """
    __tablename__ = 'houses'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic Information
    house_number = db.Column(db.String(50), nullable=False)
    street_address = db.Column(db.String(200), nullable=False)
    
    # Exact location coordinates (for precise map display and distance calculation)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    
    # Foreign Keys
    residential_area_id = db.Column(db.Integer, db.ForeignKey('residential_areas.id'), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Nullable until owner claims
    # Admin-provided owner contact details (used to let owners claim their house)
    owner_name = db.Column(db.String(100), nullable=True)
    owner_email = db.Column(db.String(120), nullable=True)
    owner_phone = db.Column(db.String(20), nullable=True)
    is_claimed = db.Column(db.Boolean, default=False)
    
    # House Status
    is_verified = db.Column(db.Boolean, default=False)  # Admin verifies house before it goes live
    is_active = db.Column(db.Boolean, default=True)  # Can be deactivated if owner doesn't pay
    is_full = db.Column(db.Boolean, default=False)
    
    # Amenities (Features of the house)
    is_tiled = db.Column(db.Boolean, default=False)
    has_solar = db.Column(db.Boolean, default=False)
    has_jojo_tank = db.Column(db.Boolean, default=False)
    has_wifi = db.Column(db.Boolean, default=False)
    has_parking = db.Column(db.Boolean, default=False)
    has_kitchen = db.Column(db.Boolean, default=False)
    has_laundry = db.Column(db.Boolean, default=False)
    
    # House Description
    description = db.Column(db.Text)
    rules = db.Column(db.Text)  # House rules
    
    # Images (stored as comma-separated filenames)
    # Example: "house1_img1.jpg,house1_img2.jpg,house1_img3.jpg"
    image_filenames = db.Column(db.Text)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    rooms = db.relationship('Room', backref='house', lazy=True, cascade='all, delete-orphan')
    bookings = db.relationship('Booking', backref='house', lazy=True, cascade='all, delete-orphan')
    
    @property
    def total_rooms(self):
        """Total number of rooms in the house"""
        return len(self.rooms)
    
    @property
    def occupied_rooms(self):
        """Number of currently occupied rooms"""
        return sum(1 for room in self.rooms if room.is_occupied)
    
    @property
    def available_rooms(self):
        """Number of available rooms"""
        return self.total_rooms - self.occupied_rooms
    
    @property
    def has_accommodation(self):
        """Check if house has any available rooms"""
        return self.available_rooms > 0
    
    @property
    def images(self):
        """Return list of image URLs"""
        if not self.image_filenames:
            return []
        return [f'/static/house_images/{img}' for img in self.image_filenames.split(',') if img]
    
    def to_dict(self, include_owner=False):
        """Convert house to dictionary"""
        data = {
            'id': self.id,
            'house_number': self.house_number,
            'street_address': self.street_address,
            'residential_area': self.residential_area.name if self.residential_area else None,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'is_claimed': self.is_claimed,
            'owner_id': self.owner_id,
            'is_verified': self.is_verified,
            'is_active': self.is_active,
            
            # Amenities
            'amenities': {
                'is_tiled': self.is_tiled,
                'has_solar': self.has_solar,
                'has_jojo_tank': self.has_jojo_tank,
                'has_wifi': self.has_wifi,
                'has_parking': self.has_parking,
                'has_kitchen': self.has_kitchen,
                'has_laundry': self.has_laundry,
            },
            
            # Description
            'description': self.description,
            'rules': self.rules,
            
            # Images
            'images': self.images,
            
            # Room availability
            'total_rooms': self.total_rooms,
            'occupied_rooms': self.occupied_rooms,
            'available_rooms': self.available_rooms,
            'has_accommodation': self.has_accommodation,
            'is_full': self.is_full,
            
            # Rooms details
            'rooms': [room.to_dict() for room in self.rooms],
            
            'created_at': self.created_at.isoformat(),
        }
        
        # Include owner contact info if requested (for students viewing houses)
        # If house has an assigned user owner, include that contact info
        if include_owner and self.owner:
            data['owner_contact'] = {
                'id': self.owner.id,
                'name': self.owner.full_name,
                'phone': self.owner.phone_number,
                'email': self.owner.email,
            }
        # If house is unassigned but admin supplied owner details during creation,
        # include those so the real owner can claim the house by matching details
        elif include_owner and not self.owner and (self.owner_name or self.owner_email or self.owner_phone):
            data['owner_contact'] = {
                'name': self.owner_name,
                'phone': self.owner_phone,
                'email': self.owner_email,
            }
            
            # Add payment methods if owner has set them up
            if hasattr(self.owner, 'owner_profile') and self.owner.owner_profile:
                owner_profile = self.owner.owner_profile
                data['payment_methods'] = {
                    'ecocash': owner_profile.ecocash_number,
                    'bank_account': owner_profile.bank_account,
                    'other': owner_profile.other_payment_info,
                }
        
        return data
    
    def __repr__(self):
        return f'<House {self.house_number} - {self.street_address}>'


class Room(db.Model):
    """
    Individual rooms within a house
    Each room has a capacity (1, 2, or 4 people) and price
    """
    __tablename__ = 'rooms'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Foreign Key
    house_id = db.Column(db.Integer, db.ForeignKey('houses.id'), nullable=False)
    
    # Room Details
    room_number = db.Column(db.String(20), nullable=False)
    capacity = db.Column(db.Integer, nullable=False)  # 1, 2, or 4 people
    price_per_month = db.Column(db.Float, nullable=False)
    
    # Room Status
    is_occupied = db.Column(db.Boolean, default=False)
    is_available = db.Column(db.Boolean, default=True)  # Owner can mark room as unavailable
    
    # Current occupant (if occupied)
    current_tenant_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    occupancy_start_date = db.Column(db.DateTime)
    occupancy_end_date = db.Column(db.DateTime)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    bookings = db.relationship('Booking', backref='room', lazy=True, cascade='all, delete-orphan')
    current_tenant = db.relationship('User', foreign_keys=[current_tenant_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'room_number': self.room_number,
            'capacity': self.capacity,
            'price_per_month': self.price_per_month,
            'is_occupied': self.is_occupied,
            'is_available': self.is_available,
            'occupancy_start_date': self.occupancy_start_date.isoformat() if self.occupancy_start_date else None,
            'occupancy_end_date': self.occupancy_end_date.isoformat() if self.occupancy_end_date else None,
        }
    
    def __repr__(self):
        return f'<Room {self.room_number} - Capacity: {self.capacity}>'