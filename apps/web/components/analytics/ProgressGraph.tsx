'use client';

import * as React from 'react';
import type { DailyCount } from '@lectio/types';

interface ProgressGraphProps {
  data: DailyCount[];
}

export function ProgressGraph({ data }: ProgressGraphProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const W = 100;
  const H = 60;

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const points = data.map((d, i) => {
    const x = data.length < 2 ? W / 2 : (i / (data.length - 1)) * W;
    const y = H - (d.count / maxCount) * H;
    return { x, y, date: d.date, count: d.count };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? 'M ' + p.x + ',' + p.y : 'L ' + p.x + ',' + p.y))
    .join(' ');

  const viewBox = '0 -10 ' + W + ' ' + (H + 30);

  return (
    <div style={{ marginTop: 'var(--space-6)', width: '100%' }}>
      <svg
        viewBox={viewBox}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          opacity="0.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--color-primary)" />
            <text
              x={p.x}
              y={H + 15}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize="8"
              fontFamily="var(--font-body)"
            >
              {days[new Date(p.date).getUTCDay()]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
