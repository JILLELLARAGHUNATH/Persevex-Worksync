'use client';

import React from 'react';
import Image from 'next/image';

interface PersevexLogoProps {
  showWorkSyncTag?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  subtitle?: string;
  priority?: boolean;
}

export default function PersevexLogo({
  showWorkSyncTag = false,
  size = 'md',
  className = '',
  subtitle,
  priority = true,
}: PersevexLogoProps) {
  const logoDimensions = {
    sm: { width: 120, height: 53 },
    md: { width: 150, height: 67 },
    lg: { width: 190, height: 85 },
    xl: { width: 240, height: 107 },
  };

  const tagSizes = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
    xl: 'text-base px-3 py-1',
  };

  const dim = logoDimensions[size];

  return (
    <div className={'inline-flex flex-col items-center justify-center select-none ' + className}>
      <div className="flex items-center gap-2">
        <Image
          src="/logo.svg.webp"
          alt="Persevex"
          width={dim.width}
          height={dim.height}
          priority={priority}
          className="object-contain h-auto w-auto max-h-full"
          style={{ width: `${dim.width}px`, height: 'auto' }}
        />

        {showWorkSyncTag && (
          <span className={'rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold tracking-tight shrink-0 ' + tagSizes[size]}>
            WorkSync
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1 text-center">
          {subtitle}
        </p>
      )}
    </div>
  );
}


