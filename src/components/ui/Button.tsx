import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
};

export function Button({ variant = 'primary', size = 'md', children, className = '', ...rest }: ButtonProps) {
    const base = 'inline-flex items-center justify-center rounded font-medium focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    
    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base'
    };

    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm border border-transparent',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 border border-transparent',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm border border-transparent',
        outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-sm',
        ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent',
    };

    return (
        <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
            {children}
        </button>
    );
}
