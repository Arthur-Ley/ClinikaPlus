import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export default function Button({ variant = 'primary', className = '', children, size = 'md', ...props }: ButtonProps) {
  const base = 'px-6 py-2.5 rounded-xl font-medium transition-all active:scale-95';
  const variants: Record<string, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  const sizes: Record<string, string> = { sm: 'text-sm px-3 py-1.5', md: '', lg: 'text-lg px-8 py-3' };

  const classes = base + ' ' + (variants[variant] || '') + ' ' + (sizes[size] || '') + ' ' + className;

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
