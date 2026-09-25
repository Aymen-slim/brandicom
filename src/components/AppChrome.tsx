'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const AiAssistantDrawer = dynamic(
  () => import('@/components/AiAssistantDrawer').then((mod) => mod.AiAssistantDrawer),
  { ssr: false }
);

export function AppChrome() {
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        setShowAi(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!showAi) return null;
  return <AiAssistantDrawer initialOpen />;
}
