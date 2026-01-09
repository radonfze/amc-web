import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ variant = 'primary', children, className = '', ...rest }: ButtonProps) {
    const base = 'inline-flex items-center justify-center px-4 py-2 rounded text-sm font-medium focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
        danger: 'bg-red-600 text-white hover:bg-red-700',
    };

    return (
        <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
            {children}
        </button>
    );
}
