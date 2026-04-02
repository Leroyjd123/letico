import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#4d614f',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
      }}
    >
      <div
        style={{
          color: '#d2e8d1',
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'serif',
          lineHeight: 1,
        }}
      >
        l
      </div>
    </div>,
    { ...size },
  );
}
