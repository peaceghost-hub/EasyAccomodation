import React, { useState } from 'react';

/**
 * Compact floating admin contact widget.
 * Shows a single-line link on load; expands to the full contact card on demand to avoid obstructing mobile layouts.
 */
export default function ContactAdminWidget() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <div className="fixed bottom-4 right-4 z-50 text-sm">
      {!isOpen && (
        <button
          type="button"
          onClick={toggle}
          className="px-4 py-2 rounded-full shadow-lg bg-white/95 text-blue-700 font-semibold hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
        >
          Need help? Contact Admin →
        </button>
      )}

      {isOpen && (
        <div className="glass rounded-xl shadow-2xl border-2 border-blue-200 p-4 w-72 max-w-[calc(100vw-2rem)]">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                👤
              </div>
              <div>
                <h4 className="text-blue-900 font-bold text-base">Contact Admin</h4>
                <p className="text-xs text-blue-700">We usually reply within a few hours.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggle}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Close contact details"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 text-blue-800">
            <div className="font-semibold text-sm">Admin</div>
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=magomobenam765@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <span className="text-lg">📧</span>
              <span className="text-xs font-medium text-blue-700 break-all">magomobenam765@gmail.com</span>
            </a>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50">
              <span className="text-lg">📞</span>
              <span className="text-sm font-medium">+263787690803</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
