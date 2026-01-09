import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-lg shadow p-4 border border-gray-100 ${className}`}>
            {children}
        </div>
    );
}
