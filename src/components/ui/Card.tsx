import React from 'react';

export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={"bg-white rounded-3xl p-6 shadow-sm border border-gray-100 " + className}>
      {children}
    </div>
  );
}
