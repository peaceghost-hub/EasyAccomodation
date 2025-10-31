import React, { useEffect, useRef, useState } from 'react';

const baseButton = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm border focus:outline-none focus:ring-2 focus:ring-offset-2';
const variants = {
  primary: `${baseButton} bg-white/95 border-blue-200 text-blue-700 hover:bg-blue-50 focus:ring-blue-400`,
  subtle: `${baseButton} bg-white border-gray-200 text-gray-700 hover:bg-gray-50 focus:ring-gray-300`,
};

const itemBase = 'w-full text-left px-3 py-2 text-sm rounded-md transition-colors';

export default function ActionMenu({
  items = [],
  label = 'Actions',
  variant = 'primary',
  align = 'right',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleAction = (action) => {
    if (typeof action?.onClick === 'function') {
      action.onClick();
    }
    setOpen(false);
  };

  const dropdownPosition = align === 'left' ? 'left-0' : 'right-0';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={variants[variant] || variants.primary}
      >
        <span>{label}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className={`absolute ${dropdownPosition} mt-2 w-44 rounded-lg border border-blue-100 bg-white shadow-xl z-50`}> 
          <div className="py-2">
            {items.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleAction(item)}
                disabled={item.disabled}
                className={`${itemBase} ${
                  item.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
