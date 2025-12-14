import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'HighStackers - Stack Higher, Win Bigger';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#000',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        {/* Stacked Chips */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          {/* Top chip */}
          <div
            style={{
              width: 240,
              height: 70,
              background: '#7F73FF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid #9F93FF',
              marginBottom: -20,
            }}
          />
          {/* Middle chip */}
          <div
            style={{
              width: 240,
              height: 70,
              background: '#F7931A',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid #FFA640',
              marginBottom: -20,
            }}
          />
          {/* Bottom chip */}
          <div
            style={{
              width: 240,
              height: 70,
              background: '#7F73FF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid #9F93FF',
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 'bold',
            background: 'linear-gradient(to right, #7F73FF, #F7931A)',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'flex',
          }}
        >
          HighStackers
        </div>
        
        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: '#888',
            marginTop: 20,
            display: 'flex',
          }}
        >
          Stack Higher, Win Bigger
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
