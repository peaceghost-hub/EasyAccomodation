import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-20 sm:py-28">
          <div className="text-center mb-16 relative z-10">
            {/* Minimal floating icons */}
            <div className="absolute top-0 left-10 text-4xl opacity-10 float-animation">🏠</div>
            <div className="absolute top-20 right-20 text-3xl opacity-10 float-animation" style={{animationDelay: '1s'}}>�</div>
            <div className="absolute bottom-0 left-1/4 text-3xl opacity-10 float-animation" style={{animationDelay: '2s'}}>�</div>
            
            <div className="inline-block mb-6">
              <span className="bg-white/10 text-white px-6 py-2 rounded-full text-sm font-medium border border-white/20">
                Your Student Housing Solution
              </span>
            </div>
            
            <h1 className="text-6xl sm:text-7xl font-bold mb-8 text-white leading-tight">
              Welcome to<br/>
              <span className="text-white">EasyAccommodation</span>
            </h1>
            
            <div className="max-w-4xl mx-auto mb-10 space-y-4">
              <p className="text-2xl sm:text-3xl font-semibold text-white/90 leading-relaxed">
                Are you a student at <span className="text-white">Midlands State University</span> in Gweru?
              </p>
              <p className="text-xl sm:text-2xl text-white/80 leading-relaxed">
                Are you <span className="font-semibold text-white">struggling to find a home to rent?</span>
              </p>
              <p className="text-2xl sm:text-3xl font-semibold text-white mb-4">
                We are here for you!
              </p>
              <p className="text-xl sm:text-2xl text-white/80 leading-relaxed">
                Register with <span className="font-bold text-white">EasyAccommodation</span> and find your 
                <span className="inline-block mx-2 px-3 py-1 bg-white text-black rounded-full text-lg font-bold">
                  house of choice
                </span> 
                today!
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <Link 
                to="/login" 
                className="px-10 py-4 bg-white text-black text-lg font-semibold rounded-lg shadow-lg hover:bg-gray-200 transition-all duration-200"
              >
                Get Started Now
              </Link>
              <Link 
                to="/register" 
                className="px-10 py-4 bg-black text-white text-lg font-semibold rounded-lg shadow-lg border border-white hover:bg-white hover:text-black transition-all duration-200"
              >
                Create Account
              </Link>
            </div>
            
            <div className="flex justify-center gap-8 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <span className="text-white text-lg">✓</span>
                <span>Verified Properties</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white text-lg">✓</span>
                <span>Instant Booking</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white text-lg">✓</span>
                <span>24/7 Support</span>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16 relative z-10">
            <div className="stat-card group">
              <div className="text-5xl mb-4 group-hover:scale-105 transition-transform duration-200">🏠</div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Wide Selection</h3>
              <p className="text-white/70 leading-relaxed">
                Browse through hundreds of verified student accommodations in prime locations 
                near your campus. From studios to shared houses, find exactly what you need.
              </p>
            </div>
            
            <div className="stat-card group">
              <div className="text-5xl mb-4 group-hover:scale-105 transition-transform duration-200">⚡</div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Instant Booking</h3>
              <p className="text-white/70 leading-relaxed">
                Simple and straightforward booking process with instant confirmation. 
                No waiting, no hassle - just secure your perfect home in seconds.
              </p>
            </div>
            
            <div className="stat-card group">
              <div className="text-5xl mb-4 group-hover:scale-105 transition-transform duration-200">🛡️</div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Secure & Safe</h3>
              <p className="text-white/70 leading-relaxed">
                All properties and landlords are verified. Your safety and security 
                are our top priorities with 24/7 support always available.
              </p>
            </div>
          </div>

          {/* Stats Section */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-16 relative z-10">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-white mb-2">500+</div>
                <div className="text-white/60 font-medium">Properties</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white mb-2">1,200+</div>
                <div className="text-white/60 font-medium">Happy Students</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white mb-2">98%</div>
                <div className="text-white/60 font-medium">Satisfaction Rate</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white mb-2">24/7</div>
                <div className="text-white/60 font-medium">Support Available</div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-16 relative z-10">
            <h2 className="text-3xl font-bold text-center mb-12 text-white">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black text-2xl font-bold mx-auto mb-4">1</div>
                <h4 className="text-xl font-semibold mb-2 text-white">Create Account</h4>
                <p className="text-white/70">Sign up in seconds with your student email</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black text-2xl font-bold mx-auto mb-4">2</div>
                <h4 className="text-xl font-semibold mb-2 text-white">Browse & Book</h4>
                <p className="text-white/70">Find your perfect home and book instantly</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black text-2xl font-bold mx-auto mb-4">3</div>
                <h4 className="text-xl font-semibold mb-2 text-white">Move In</h4>
                <p className="text-white/70">Get verified and move into your new home</p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-12 shadow-lg text-center text-white relative z-10 overflow-hidden">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-4 left-8 text-6xl">🏠</div>
              <div className="absolute bottom-4 right-8 text-6xl">�</div>
              <div className="absolute top-1/2 left-1/3 text-5xl">�</div>
            </div>
            <div className="relative z-10">
              <h2 className="text-4xl font-bold mb-4 text-white">Ready to Find Your New Home?</h2>
              <p className="text-xl mb-8 text-white/70 max-w-2xl mx-auto">
                Join thousands of students who have already found their perfect accommodation through our platform.
              </p>
              <Link 
                to="/register" 
                className="inline-flex items-center px-10 py-4 bg-white text-black text-lg font-semibold rounded-lg shadow-lg hover:bg-gray-200 transition-all duration-200"
              >
                Get Started Today →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
