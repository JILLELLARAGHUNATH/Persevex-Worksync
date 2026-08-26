'use client';

import React from 'react';

interface PersevexLogoProps {
  showWorkSyncTag?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  subtitle?: string;
}

export default function PersevexLogo({
  showWorkSyncTag = true,
  size = 'md',
  className = '',
  subtitle,
}: PersevexLogoProps) {
  const logoDimensions = {
    sm: { width: 110, height: 48 },
    md: { width: 135, height: 58 },
    lg: { width: 175, height: 74 },
    xl: { width: 220, height: 95 },
  };

  const tagSizes = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
    xl: 'text-base px-3 py-1',
  };

  const dim = logoDimensions[size];

  return (
    <div className={'inline-flex items-center gap-2.5 select-none ' + className}>
      {/* Exact Official Persevex Logo Graphic (Cap + persevex) */}
      <div className="flex flex-col items-start justify-center shrink-0">
        <svg
          style={{ width: dim.width, height: dim.height }}
          viewBox="0 0 520 250"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-colors duration-200"
        >
          {/* Graduation Cap Top (Mortarboard) */}
          <path
            d="M260 18L350 56L260 94L170 56L260 18Z"
            className="fill-[#0f2042] dark:fill-white transition-colors duration-200"
          />

          {/* Left Book Page / Collar */}
          <path
            d="M190 70C208 88 234 92 250 84V124C234 132 208 128 190 110V70Z"
            className="fill-[#0f2042] dark:fill-white transition-colors duration-200"
          />

          {/* Right Book Page / Collar */}
          <path
            d="M330 70C312 88 286 92 270 84V124C286 132 312 128 330 110V70Z"
            className="fill-[#0f2042] dark:fill-white transition-colors duration-200"
          />

          {/* Spine Notch */}
          <path
            d="M250 84L260 90L270 84V124L260 130L250 124V84Z"
            className="fill-[#0f2042] dark:fill-white transition-colors duration-200"
          />

          {/* Tassel on Left */}
          <path
            d="M174 58V112"
            className="stroke-[#0f2042] dark:stroke-white transition-colors duration-200"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle
            cx="174"
            cy="88"
            r="4.5"
            className="fill-[#0f2042] dark:fill-white transition-colors duration-200"
          />
          <path
            d="M168 112H180L177 136H171L168 112Z"
            className="fill-[#0f2042] dark:fill-white transition-colors duration-200"
          />

          {/* Exact 'persevex' text with golden 'e' */}
          <text
            x="260"
            y="215"
            textAnchor="middle"
            fontFamily="'Inter', 'Montserrat', 'Segoe UI', system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="86"
            letterSpacing="-3"
          >
            <tspan className="fill-[#0f2042] dark:fill-white transition-colors duration-200">pers</tspan>
            <tspan fill="#f5a623">e</tspan>
            <tspan className="fill-[#0f2042] dark:fill-white transition-colors duration-200">vex</tspan>
          </text>
        </svg>

        {subtitle && (
          <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider pl-1 mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>

      {showWorkSyncTag && (
        <span className={'rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold tracking-tight shrink-0 ' + tagSizes[size]}>
          WorkSync
        </span>
      )}
    </div>
  );
}
