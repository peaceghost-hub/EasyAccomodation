import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen house-pattern-bg">
      {/* Animated gradient overlay */}
      <div className="gradient-overlay"></div>
      
      {/* Fixed Contact Admin Card */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="glass rounded-xl shadow-2xl p-5 w-72 border-2 border-blue-200">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-lg font-bold mr-3">
              👤
            </div>
            <h4 className="text-blue-900 font-bold text-lg">Contact Admin</h4>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-blue-800">
              <div className="font-semibold text-base mb-2">Benam Magomo</div>
              <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                <span className="text-lg">📧</span>
                <a
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=magomobenam765@gmail.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                >
                  magomobenam765@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                <span className="text-lg">📞</span>
                <span className="font-medium">+263787690803</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-20 sm:py-28">
          <div className="text-center mb-16 relative z-10">
            {/* Floating house icons */}
            <div className="absolute top-0 left-10 text-6xl opacity-20 float-animation">🏠</div>
            <div className="absolute top-20 right-20 text-5xl opacity-15 float-animation" style={{animationDelay: '1s'}}>🏘️</div>
            <div className="absolute bottom-0 left-1/4 text-4xl opacity-10 float-animation" style={{animationDelay: '2s'}}>🏡</div>
            
            <div className="inline-block mb-4">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                🌟 Your Student Housing Solution
              </span>
            </div>
            
            <h1 className="text-6xl sm:text-7xl font-extrabold mb-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 bg-clip-text text-transparent leading-tight">
              Welcome to<br/>
              <span className="text-blue-600">EasyAccommodation</span>
            </h1>
            
            <div className="max-w-4xl mx-auto mb-10">
              <p className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 leading-relaxed">
                Are you a student at <span className="text-blue-600">Midlands State University</span> in Gweru?
              </p>
              <p className="text-xl sm:text-2xl text-gray-700 mb-4 leading-relaxed">
                Are you <span className="font-semibold text-blue-700">struggling to find a home to rent?</span>
              </p>
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                We are here for you!
              </p>
              <p className="text-xl sm:text-2xl text-gray-700 leading-relaxed">
                Register with <span className="font-bold text-blue-600">EasyAccommodation</span> and find your 
                <span className="inline-block mx-2 px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-lg font-bold shadow-lg">
                  house of choice
                </span> 
                today! <span className="text-3xl">🎉</span>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
              <Link 
                to="/login" 
                className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold rounded-xl shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105"
              >
                🚀 Get Started Now
              </Link>
              <Link 
                to="/register" 
                className="px-10 py-4 bg-white text-blue-700 text-lg font-bold rounded-xl shadow-xl hover:shadow-2xl border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 transform hover:scale-105"
              >
                📝 Create Account
              </Link>
            </div>
            
            <div className="flex justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-500 text-xl">✓</span>
                <span>Verified Properties</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 text-xl">✓</span>
                <span>Instant Booking</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 text-xl">✓</span>
                <span>24/7 Support</span>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16 relative z-10">
            <div className="stat-card group">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🏠</div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Wide Selection</h3>
              <p className="text-gray-600 leading-relaxed">
                Browse through hundreds of verified student accommodations in prime locations 
                near your campus. From studios to shared houses, find exactly what you need.
              </p>
            </div>
            
            <div className="stat-card group">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">⚡</div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Instant Booking</h3>
              <p className="text-gray-600 leading-relaxed">
                Simple and straightforward booking process with instant confirmation. 
                No waiting, no hassle - just secure your perfect home in seconds.
              </p>
            </div>
            
            <div className="stat-card group">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">🛡️</div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Secure & Safe</h3>
              <p className="text-gray-600 leading-relaxed">
                All properties and landlords are verified. Your safety and security 
                are our top priorities with 24/7 support always available.
              </p>
            </div>
          </div>

          {/* Stats Section */}
          <div className="glass rounded-2xl p-8 mb-16 relative z-10">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">500+</div>
                <div className="text-gray-600 font-medium">Properties</div>
              </div>
              <div>
                <div className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">1,200+</div>
                <div className="text-gray-600 font-medium">Happy Students</div>
              </div>
              <div>
                <div className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">98%</div>
                <div className="text-gray-600 font-medium">Satisfaction Rate</div>
              </div>
              <div>
                <div className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">24/7</div>
                <div className="text-gray-600 font-medium">Support Available</div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="card mb-16 relative z-10">
            <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">1</div>
                <h4 className="text-xl font-semibold mb-2">Create Account</h4>
                <p className="text-gray-600">Sign up in seconds with your student email</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">2</div>
                <h4 className="text-xl font-semibold mb-2">Browse & Book</h4>
                <p className="text-gray-600">Find your perfect home and book instantly</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">3</div>
                <h4 className="text-xl font-semibold mb-2">Move In</h4>
                <p className="text-gray-600">Get verified and move into your new home</p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-12 shadow-2xl text-center text-white relative z-10 overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-8 text-8xl">🏠</div>
              <div className="absolute bottom-4 right-8 text-8xl">🏘️</div>
              <div className="absolute top-1/2 left-1/3 text-6xl">🏡</div>
            </div>
            <div className="relative z-10">
              <h2 className="text-4xl font-bold mb-4">Ready to Find Your New Home?</h2>
              <p className="text-xl mb-8 text-blue-100 max-w-2xl mx-auto">
                Join thousands of students who have already found their perfect accommodation through our platform.
              </p>
              <Link 
                to="/register" 
                className="inline-flex items-center px-10 py-4 bg-white text-blue-700 text-lg font-bold rounded-xl shadow-2xl hover:shadow-white/30 transition-all duration-300 transform hover:scale-105"
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
