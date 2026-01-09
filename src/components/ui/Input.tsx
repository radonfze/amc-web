import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
};

export function Input({ label, className = '', ...rest }: InputProps) {
    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-xs font-medium text-gray-700">
                    {label}
                </label>
            )}
            <input
                {...rest}
                className={`w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
            />
        </div>
    );
}
