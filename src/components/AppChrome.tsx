'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const AiAssistantDrawer = dynamic(
  () => import('@/components/AiAssistantDrawer').then((mod) => mod.AiAssistantDrawer),
  { ssr: false }
);

/**
 * The assistant owns its own keyboard shortcut and floating launcher, so it
 * must stay mounted. Previously it was only mounted after ⌘J, which meant the
 * floating launcher never existed.
 */
export function AppChrome() {
  return <AiAssistantDrawer />;
}
