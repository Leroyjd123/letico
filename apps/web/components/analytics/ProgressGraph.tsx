'use client';

import * as React from 'react';
import type { DailyCount } from '@lectio/types';

interface ProgressGraphProps {
  data: DailyCount[];
}

export function ProgressGraph({ data }: ProgressGraphProps) {
  if (!data || data.length === 0) {
    return null; /* Fallback for no data */
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1); // Avoid div by zero
  const viewBoxWidth = 100;
  const viewBoxHeight = 100;

  // X axis labels
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  // Points mapping
  const points = data.map((d, index) => {
    const x = (index / (data.length - 1)) * viewBoxWidth;
    // Map count to y axis where 0 is at bottom (viewBoxHeight) and maxCount is at top (0)
    const y = viewBoxHeight - (d.count / maxCount) * viewBoxHeight;
    return { x, y, date: d.date, count: d.count };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? \`M \${p.x},\${p.y}\` : \`L \${p.x},\${p.y}\`))
    .join(' ');

  return (
    <div style={{ marginTop: 'var(--space-6)', width: '100%' }}>
      <svg
        viewBox={\`0 -10 \${viewBoxWidth} \${viewBoxHeight + 30}\`}
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
            <circle
              cx={p.x}
              cy={p.y}
              r="3"
              fill="var(--color-primary)"
            />
            {/* X-axis labels (day of week) */}
            <text
              x={p.x}
              y={viewBoxHeight + 15}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize="8"
              fontFamily="var(--font-body)"
            >
              {days[new Date(p.date).getUTCDay()]}
            </text>
            {/* Tooltip/Count above the dot if we want to show it, or keep simple */}
          </g>
        ))}
      </svg>
    </div>
  );
}
