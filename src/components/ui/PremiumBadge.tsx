'use client';

import React from 'react';

interface PremiumBadgeProps {
  type: 'pro' | 'biz';
}

export default function PremiumBadge({ type }: PremiumBadgeProps) {
  // BETA: all features free until September 2026 — uncomment badge after beta ends
  return null;

  // return (
  //   <span className={`inline-flex items-center text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded ml-1.5 select-none ${
  //     type === 'pro'
  //       ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
  //       : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
  //   }`}>
  //     {type}
  //   </span>
  // );
}
