"""
EasyAccommodation Main Application
===================================
Main Flask application file - The heart of the backend
Location: backend/app.py

This file:
1. Initializes Flask app
2. Configures database
3. Sets up authentication
4. Registers API routes
5. Handles CORS for frontend communication
"""

import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import config

# Import database
from models import db

# We'll import routes later when we create them
# from routes.auth import auth_bp
# from routes.admin import admin_bp
# from routes.house import house_bp
# from routes.booking import booking_bp


def create_app(config_name='development'):
    """
    Application Factory Pattern
    Creates and configures the Flask application
    
    Args:
        config_name: 'development', 'production', or 'testing'
    
    Returns:
        Configured Flask application
    """
    
    # Initialize Flask app
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    # Initialize extensions
    initialize_extensions(app)
    
    # Register blueprints (API routes)
    register_blueprints(app)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Create database tables
    with app.app_context():
        create_tables()
    
    return app


def initialize_extensions(app):
    """
    Initialize Flask extensions
    """
    
    # Initialize database
    db.init_app(app)
    
    # Configure JWT BEFORE initializing
    app.config['JWT_SECRET_KEY'] = app.config.get('JWT_SECRET_KEY', 'dev-jwt-secret')
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    
    # Initialize JWT (authentication)
    jwt = JWTManager(app)
    
    # Initialize CORS (allow frontend to communicate)
    # During local development allow all origins for easier debugging of CORS issues.
    # In production this should be restricted to explicit origins.
    CORS(app, resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    # JWT error handlers
    @jwt.unauthorized_loader
    def unauthorized_callback(callback):
        """Handle missing JWT token"""
        print(f"❌ JWT UNAUTHORIZED: {callback}")
        return jsonify({
            'success': False,
            'message': 'Missing authorization token. Please log in.'
        }), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(callback):
        """Handle invalid JWT token"""
        print(f"❌ JWT INVALID: {callback}")
        return jsonify({
            'success': False,
            'message': 'Invalid token. Please log in again.'
        }), 401
    
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        """Handle expired JWT token"""
        print(f"❌ JWT EXPIRED: {jwt_header}, {jwt_payload}")
        return jsonify({
            'success': False,
            'message': 'Token has expired. Please log in again.'
        }), 401


def register_blueprints(app):
    """
    Register API route blueprints
    We'll uncomment these as we create the route files
    """
    
    # Authentication routes (login, register, logout)
    from routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    
    # Admin routes (manage houses, users, payments)
    from routes.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    # Owner routes (manage own house and payment methods)
    from routes.owner import owner_bp
    app.register_blueprint(owner_bp, url_prefix='/api/owner')
    
    # House routes (view houses, search, details)
    from routes.house import house_bp
    app.register_blueprint(house_bp, url_prefix='/api/houses')
    
    # Booking routes (make bookings, inquiries)
    from routes.booking import booking_bp
    app.register_blueprint(booking_bp, url_prefix='/api/bookings')
    
    # Payment routes (process payments)
    from routes.payment import payment_bp
    app.register_blueprint(payment_bp, url_prefix='/api/payments')
    # Payment proof uploads (students upload proof of payment)
    from routes.payment_proofs import payment_bp as payment_proofs_bp
    app.register_blueprint(payment_proofs_bp, url_prefix='/api/payment-proofs')
    
    # For now, create a simple test route
    @app.route('/')
    def index():
        return jsonify({
            'success': True,
            'message': 'Welcome to EasyAccommodation API',
            'version': '1.0.0',
            'endpoints': {
                'auth': '/api/auth',
                'houses': '/api/houses',
                'bookings': '/api/bookings',
                'admin': '/api/admin',
            }
        })

    # Helpful API root so visiting /api doesn't 404
    @app.route('/api')
    def api_root():
        return jsonify({
            'success': True,
            'message': 'EasyAccommodation API root',
            'version': '1.0.0',
            'endpoints': {
                'health': '/api/health',
                'auth': '/api/auth',
                'houses': '/api/houses',
                'bookings': '/api/bookings',
                'admin': '/api/admin',
                'owner': '/api/owner',
                'payments': '/api/payments',
                'payment_proofs': '/api/payment-proofs',
            }
        })
    
    @app.route('/api/health')
    def health_check():
        """Health check endpoint - verify API is running"""
        return jsonify({
            'success': True,
            'message': 'API is running',
            'database': 'connected'
        })
    
    # Serve static files (house images)
    @app.route('/static/<path:filename>')
    def serve_static(filename):
        """Serve static files like house images"""
        static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
        return send_from_directory(static_dir, filename)


def register_error_handlers(app):
    """
    Register error handlers for common HTTP errors
    """
    
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 - Not Found"""
        return jsonify({
            'success': False,
            'message': 'Resource not found',
            'error': 'Not Found'
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 - Internal Server Error"""
        db.session.rollback()  # Rollback any failed database transactions
        return jsonify({
            'success': False,
            'message': 'An internal error occurred',
            'error': 'Internal Server Error'
        }), 500
    
    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 - Bad Request"""
        return jsonify({
            'success': False,
            'message': 'Bad request',
            'error': 'Bad Request'
        }), 400
    
    @app.errorhandler(403)
    def forbidden(error):
        """Handle 403 - Forbidden"""
        return jsonify({
            'success': False,
            'message': 'You do not have permission to access this resource',
            'error': 'Forbidden'
        }), 403


def create_tables():
    """
    Create all database tables
    This runs when the app starts
    """
    try:
        db.create_all()
        print("✅ Database tables created successfully!")
        # Lightweight migration: ensure 'approximate_distance_km' exists on residential_areas
        try:
            from sqlalchemy import inspect, text
            insp = inspect(db.engine)
            cols = [c['name'] for c in insp.get_columns('residential_areas')]
            if 'approximate_distance_km' not in cols:
                with db.engine.connect() as conn:
                    # SQLite and Postgres both accept ADD COLUMN without IF NOT EXISTS for this simple case
                    conn.execute(text('ALTER TABLE residential_areas ADD COLUMN approximate_distance_km FLOAT'))
                    conn.commit()
                print("🛠️ Added column residential_areas.approximate_distance_km")
        except Exception as mig_e:
            print(f"⚠️ Migration check failed or not needed: {mig_e}")
        # Ensure houses.is_full exists
        try:
            insp = inspect(db.engine)
            cols = [c['name'] for c in insp.get_columns('houses')]
            if 'is_full' not in cols:
                with db.engine.connect() as conn:
                    conn.execute(text('ALTER TABLE houses ADD COLUMN is_full BOOLEAN DEFAULT FALSE'))
                    conn.commit()
                print("🛠️ Added column houses.is_full")
        except Exception as mig_e:
            print(f"⚠️ Migration check for is_full failed or not needed: {mig_e}")
        # Ensure users table has email verification/admin verification columns
        try:
            insp = inspect(db.engine)
            user_cols = [c['name'] for c in insp.get_columns('users')]
            with db.engine.connect() as conn:
                if 'email_verified' not in user_cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE'))
                if 'email_verified_at' not in user_cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP'))
                if 'email_verification_token' not in user_cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(128)'))
                if 'admin_verified' not in user_cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN admin_verified BOOLEAN DEFAULT FALSE'))
                if 'admin_verified_at' not in user_cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN admin_verified_at TIMESTAMP'))
                if 'admin_verified_expires_at' not in user_cols:
                    conn.execute(text('ALTER TABLE users ADD COLUMN admin_verified_expires_at TIMESTAMP'))
                conn.commit()
            print("🛠️ Ensured user verification columns exist")
        except Exception as evc:
            print(f"⚠️ User verification migration skipped or failed: {evc}")

        # Ensure payment_proofs table exists (basic create)
        try:
            if not insp.has_table('payment_proofs'):
                # Create table using simple SQL (works for sqlite/postgres in this shape)
                with db.engine.connect() as conn:
                    conn.execute(text('''
                        CREATE TABLE payment_proofs (
                            id INTEGER PRIMARY KEY,
                            user_id INTEGER NOT NULL,
                            filename VARCHAR(300) NOT NULL,
                            original_filename VARCHAR(300),
                            status VARCHAR(20) DEFAULT 'pending',
                            admin_id INTEGER,
                            admin_comment TEXT,
                            uploaded_at TIMESTAMP,
                            reviewed_at TIMESTAMP
                        )
                    '''))
                    conn.commit()
                print("🛠️ Created table payment_proofs")
        except Exception as pt_e:
            print(f"⚠️ Payment proofs table creation skipped or failed: {pt_e}")
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")


# Create the app instance
app = create_app(os.getenv('FLASK_ENV', 'development'))


if __name__ == '__main__':
    """
    Run the application
    This only runs when you execute: python app.py
    """
    
    print("\n" + "="*50)
    print("🚀 EASYACCOMMODATION API SERVER")
    print("="*50)
    print(f"Environment: {app.config['FLASK_ENV']}")
    print(f"Debug Mode: {app.config['DEBUG']}")
    print(f"Database: {app.config['SQLALCHEMY_DATABASE_URI'][:50]}...")
    print("="*50 + "\n")
    
    # Run the Flask development server
    app.run(
        host='0.0.0.0',  # Allow access from any IP (important for testing)
        port=5000,        # Default Flask port
        debug=True        # Enable debug mode (auto-reload on code changes)
    )