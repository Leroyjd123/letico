'use client';

import * as React from 'react';
import { Text } from '../ui/Text';

interface StatusCardProps {
  aheadBehindVerses: number | null;
}

export function StatusCard({ aheadBehindVerses }: StatusCardProps) {
  if (aheadBehindVerses === null) {
    return null;
  }

  // Assuming an average of 85 verses per day for a 1-year plan
  const VERSES_PER_DAY = 85;
  const daysDiff = Math.round(Math.abs(aheadBehindVerses) / VERSES_PER_DAY);

  let statusText = '';
  
  // Rules:
  // - > 0: "currently X days ahead of your reading intention"
  // - < 0: "currently X days behind your reading intention"
  // - === 0: "you're right on track with your reading intention"
  // NEVER use "you're behind" (standalone) or "you missed"
  
  if (aheadBehindVerses > 0) {
    statusText = `currently ${daysDiff} day${daysDiff !== 1 ? 's' : ''} ahead of your reading intention`;
  } else if (aheadBehindVerses < 0) {
    statusText = `currently ${daysDiff} day${daysDiff !== 1 ? 's' : ''} behind your reading intention`;
  } else {
    statusText = `you're right on track with your reading intention`;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-stat-card-bg)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        marginTop: 'var(--space-4)',
      }}
      aria-label={statusText}
    >
      <Text variant="subheading" color="primary">
        {statusText}
      </Text>
    </div>
  );
}
