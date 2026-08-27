'use client';

import React from 'react';
import Image from 'next/image';

interface PersevexLogoProps {
  showWorkSyncTag?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  subtitle?: string;
  priority?: boolean;
  contained?: boolean;
}

export default function PersevexLogo({
  showWorkSyncTag = false,
  size = 'md',
  className = '',
  subtitle,
  priority = true,
  contained = true,
}: PersevexLogoProps) {
  const logoDimensions = {
    sm: { width: 110, height: 48 },
    md: { width: 140, height: 62 },
    lg: { width: 180, height: 80 },
    xl: { width: 230, height: 102 },
  };

  const tagSizes = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[11px] px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1',
    xl: 'text-sm px-3 py-1',
  };

  const containerPadding = {
    sm: 'px-2.5 py-1.5 rounded-lg',
    md: 'px-3.5 py-2 rounded-xl',
    lg: 'px-4 py-2.5 rounded-xl',
    xl: 'px-5 py-3 rounded-2xl',
  };

  const dim = logoDimensions[size];

  const logoContent = (
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
        <span className={'rounded-md bg-blue-50 border border-blue-200/80 text-blue-600 font-extrabold tracking-tight shrink-0 ' + tagSizes[size]}>
          WorkSync
        </span>
      )}
    </div>
  );

  return (
    <div className={'inline-flex flex-col items-center justify-center select-none ' + className}>
      {contained ? (
        <div className={`bg-white border border-slate-200/90 shadow-xs flex items-center justify-center ${containerPadding[size]}`}>
          {logoContent}
        </div>
      ) : (
        logoContent
      )}

      {subtitle && (
        <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-1.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}


