import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary hover:bg-primaryHover text-white shadow-lg shadow-primary/20 focus:ring-primary",
    secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm focus:ring-slate-300",
    outline: "bg-transparent border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 focus:ring-slate-300",
    ghost: "bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100",
    danger: "bg-danger hover:bg-red-700 text-white shadow-lg shadow-red-500/20 focus:ring-red-500",
    accent: "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 focus:ring-amber-500",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm md:text-base",
    md: "px-4 py-2 md:px-6 md:py-3 text-base md:text-lg",
    lg: "px-6 py-3 md:px-8 md:py-4 text-lg md:text-xl",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};