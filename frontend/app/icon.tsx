import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
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
          position: 'relative',
        }}
      >
        {/* Top chip - Purple */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            width: 24,
            height: 8,
            background: '#7F73FF',
            borderRadius: '50%',
            border: '1px solid #9F93FF',
          }}
        />
        {/* Middle chip - Orange */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            width: 24,
            height: 8,
            background: '#F7931A',
            borderRadius: '50%',
            border: '1px solid #FFA640',
          }}
        />
        {/* Bottom chip - Purple */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            width: 24,
            height: 8,
            background: '#7F73FF',
            borderRadius: '50%',
            border: '1px solid #9F93FF',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
