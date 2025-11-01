"""
Configuration Module for EasyAccommodation
==========================================
This file reads settings from .env file and makes them available to the app
Location: backend/config.py
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
# This reads the .env file and makes variables available via os.getenv()
load_dotenv()


class Config:
    """
    Base configuration class
    All settings are loaded from environment variables
    """
    
    # --------------------------------------------
    # FLASK SETTINGS
    # --------------------------------------------
    # Secret key for session management
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # Flask environment (development/production)
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    
    # Debug mode (shows detailed errors - only for development!)
    DEBUG = FLASK_ENV == 'development'
    
    # --------------------------------------------
    # DATABASE SETTINGS
    # --------------------------------------------
    # PostgreSQL connection string
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    
    # Disable modification tracking (improves performance)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Echo SQL queries to console (useful for debugging)
    SQLALCHEMY_ECHO = DEBUG
    
    # --------------------------------------------
    # JWT (Authentication) SETTINGS
    # --------------------------------------------
    # Secret key for JWT tokens
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-jwt-secret')
    
    # How long JWT tokens are valid
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)  # 24 hours
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)  # 30 days
    
    # Where to look for JWT tokens (in HTTP headers)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    
    # CRITICAL: Disable ALL CSRF protection (we're using bearer tokens in headers, not cookies)
    JWT_COOKIE_CSRF_PROTECT = False
    JWT_CSRF_IN_COOKIES = False
    JWT_CSRF_CHECK_FORM = False
    
    # Additional JWT settings for better error handling
    JWT_ERROR_MESSAGE_KEY = 'message'
    
    # Allow expired signatures for debugging (REMOVE IN PRODUCTION!)
    # JWT_DECODE_LEEWAY = timedelta(seconds=10)
    
    # --------------------------------------------
    # EMAIL SETTINGS (SendGrid)
    # --------------------------------------------
    SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
    ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'magomobenam765@gmail.com')
    FROM_EMAIL = os.getenv('FROM_EMAIL', 'magomobenam765@gmail.com')
    # Public frontend base url used in email links (e.g. https://app.example.com)
    FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL')
    
    # --------------------------------------------
    # PAYMENT GATEWAY SETTINGS
    # --------------------------------------------
    # PayPal
    PAYPAL_CLIENT_ID = os.getenv('PAYPAL_CLIENT_ID')
    PAYPAL_SECRET = os.getenv('PAYPAL_SECRET')
    PAYPAL_MODE = 'sandbox' if DEBUG else 'live'  # sandbox = testing mode
    
    # EcoCash
    # Merchant code provided by EcoCash (not secret). Default set per request; override via env in production.
    ECOCASH_MERCHANT_ID = os.getenv('ECOCASH_MERCHANT_ID', '08658')
    ECOCASH_API_KEY = os.getenv('ECOCASH_API_KEY')
    ECOCASH_MODE = os.getenv('ECOCASH_MODE', 'sandbox')  # 'sandbox' or 'live'
    ECOCASH_BASE_URL = os.getenv('ECOCASH_BASE_URL', 'https://developers.ecocash.co.zw/api/ecocash_pay')
    # Number that receives the payment (merchant wallet)
    ECOCASH_RECEIVER_MSISDN = os.getenv('ECOCASH_RECEIVER_MSISDN', '0787690803')
    # Fixed amount for student verification (USD)
    # Default verification amount set low for live testing; override via env in production
    ECOCASH_VERIFICATION_AMOUNT_USD = float(os.getenv('ECOCASH_VERIFICATION_AMOUNT_USD', 0.5))
    # Public callback path (must match your EcoCash app settings)
    ECOCASH_CALLBACK_PATH = os.getenv('ECOCASH_CALLBACK_PATH', '/api/v1/ecocash/callback')
    
    # --------------------------------------------
    # GOOGLE MAPS SETTINGS
    # --------------------------------------------
    GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
    
    # --------------------------------------------
    # FILE UPLOAD SETTINGS
    # --------------------------------------------
    # Maximum file size for image uploads (in bytes)
    MAX_IMAGE_SIZE = int(os.getenv('MAX_IMAGE_SIZE_MB', 2)) * 1024 * 1024  # Convert MB to bytes
    
    # Allowed image file extensions
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    
    # Where to store uploaded images
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'house_images')
    
    # --------------------------------------------
    # BOOKING SETTINGS
    # --------------------------------------------
    # How many days a booking remains valid
    BOOKING_EXPIRY_DAYS = int(os.getenv('BOOKING_EXPIRY_DAYS', 7))
    
    # Maximum consecutive bookings allowed per student
    MAX_CONSECUTIVE_BOOKINGS = int(os.getenv('MAX_CONSECUTIVE_BOOKINGS', 2))
    
    # --------------------------------------------
    # SUBSCRIPTION SETTINGS
    # --------------------------------------------
    # Monthly fee house owners pay to admin
    MONTHLY_SUBSCRIPTION_FEE = float(os.getenv('MONTHLY_SUBSCRIPTION_FEE', 50))
    
    # --------------------------------------------
    # CORS SETTINGS (Frontend-Backend Communication)
    # --------------------------------------------
    # In development, React runs on different port than Flask
    CORS_ORIGINS = [
        'http://localhost:5173',  # Vite dev server port
        'http://localhost:3000',  # Alternative React port
        'http://localhost:5000',  # Flask dev server port
        'http://127.0.0.1:5173',  # Vite dev server port
        # Add your production frontend URL here when deploying:
        'https://easyaccomodation-frontend.onrender.com',
    ]
    
    # Mail settings
    MAIL_PASSWORD = os.environ.get('SENDGRID_API_KEY')
    MAIL_DEFAULT_SENDER = os.environ.get('FROM_EMAIL')
    ADMIN_REGISTRATION_SECRET = os.environ.get('ADMIN_REGISTRATION_SECRET')

    @staticmethod
    def init_app(app):
        """
        Initialize application with this configuration
        Can be used for additional setup if needed
        """
        pass


class DevelopmentConfig(Config):
    """
    Development-specific configuration
    """
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """
    Production configuration
    Settings for live deployment
    """
    DEBUG = False
    TESTING = False
    SQLALCHEMY_ECHO = False
    
    # In production, ensure these are set from environment
    # Render will provide DATABASE_URL automatically for PostgreSQL
    # Make sure all sensitive keys are set in Render environment variables


class TestingConfig(Config):
    """
    Testing configuration
    """
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


class TestingConfig(Config):
    """
    Testing-specific configuration
    (For running automated tests)
    """
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'  # Use in-memory database for tests


# Dictionary to select configuration based on environment
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}