import React from 'react';

export default function BettingPreview() {
  const bettingOptions = [
    { label: '1', value: '1', active: false },
    { label: 'X', value: 'X', active: true },
    { label: '2', value: '2', active: false },
  ];

  return (
    <div className="flex justify-center space-x-4">
      {bettingOptions.map((option) => (
        <button
          key={option.value}
          className={`w-12 h-12 rounded-full font-bold text-lg transition-all duration-200 ${
            option.active
              ? 'bg-purple-600 text-white shadow-lg scale-110'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          disabled // These are decorative only
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
