'use client';

import * as React from 'react';
import { Text } from '../ui/Text';

interface StatCardProps {
  label: string;
  value: string | number;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-stat-card-bg)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        border: 'none',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <div 
        style={{ 
          fontSize: '10px', 
          letterSpacing: '0.18em', 
          color: 'var(--color-text-muted)', 
          textTransform: 'uppercase' 
        }}
      >
        {label}
      </div>
      <Text 
        variant="display" 
        style={{ 
          fontFamily: 'var(--font-headline)', 
          fontSize: '40px', 
          fontWeight: 300, 
          marginTop: 'var(--space-2)' 
        }}
      >
        {value}
      </Text>
    </div>
  );
}
