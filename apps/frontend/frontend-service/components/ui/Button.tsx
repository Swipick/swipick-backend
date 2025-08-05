import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  fullWidth = false,
  className = '',
  disabled = false,
  type = 'button',
}: ButtonProps) {
  const baseClasses = 'px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';
  
  const variantClasses = {
    primary: 'bg-[#554099] hover:bg-[#3d2d73] text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-gray-200 hover:bg-white text-[#554099] shadow-md hover:shadow-lg',
  };

  const widthClasses = fullWidth ? 'w-full' : '';

  const allClasses = `${baseClasses} ${variantClasses[variant]} ${widthClasses} ${className}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={allClasses}
    >
      {children}
    </button>
  );
}
