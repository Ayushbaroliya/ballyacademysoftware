import React, { useState } from 'react';
import { cn } from '../lib/utils';

const Avatar = ({ src, name = '', className }) => {
  const [error, setError] = useState(false);

  // Generate initials
  const initials = (() => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  })();

  // Hash-based background colors (Tailwind class combinations for nice gradients/solid colors in dark mode)
  const bgClasses = [
    'from-red-500/20 to-red-600/30 text-red-300 border-red-500/20',
    'from-blue-500/20 to-blue-600/30 text-blue-300 border-blue-500/20',
    'from-green-500/20 to-green-600/30 text-green-300 border-green-500/20',
    'from-amber-500/20 to-amber-600/30 text-amber-300 border-amber-500/20',
    'from-purple-500/20 to-purple-600/30 text-purple-300 border-purple-500/20',
    'from-pink-500/20 to-pink-600/30 text-pink-300 border-pink-500/20',
    'from-indigo-500/20 to-indigo-600/30 text-indigo-300 border-indigo-500/20',
    'from-teal-500/20 to-teal-600/30 text-teal-300 border-teal-500/20',
  ];

  const getHashIndex = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % bgClasses.length;
  };

  const bgStyleClass = bgClasses[getHashIndex(name)];

  // Always render initials instead of images

  return (
    <div
      className={cn(
        "w-full h-full flex items-center justify-center font-bold bg-gradient-to-br border select-none",
        bgStyleClass,
        className
      )}
    >
      {initials}
    </div>
  );
};

export default Avatar;
