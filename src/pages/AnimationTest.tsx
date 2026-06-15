import { useState } from 'react';
import { ResumeScanAnimation } from '../components/landing/ResumeScanAnimation';

export function AnimationTest() {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8f4ef',
      fontFamily: "'Fraunces', serif",
      flexDirection: 'column',
      gap: 24,
    }}>
      {!show && !done && (
        <button
          onClick={() => { setShow(true); setDone(false); }}
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 700, fontSize: 20, cursor: 'pointer',
            padding: '16px 40px', borderRadius: 14, border: 'none',
            background: '#2D5A6E', color: 'white',
            boxShadow: '0 8px 24px rgba(45,90,110,0.22)',
          }}
        >
          Play 6-Second Scan
        </button>
      )}

      {!show && done && (
        <p style={{ fontSize: 18, color: '#666' }}>Animation complete!</p>
      )}

      {show && (
        <ResumeScanAnimation
          onComplete={() => { setShow(false); setDone(true); }}
        />
      )}
    </div>
  );
}
