import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Tip {
  id: string;
  text: string;
}

interface FirstVisitTipsProps {
  tips: Tip[];
}

export function FirstVisitTip({ tips }: FirstVisitTipsProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reportSeen = localStorage.getItem('jobhub_report_seen') === 'true';
    const tipsSeen   = localStorage.getItem('jobhub_tips_seen') === 'true';
    if (reportSeen && !tipsSeen) {
      setVisible(true);
      const t = setTimeout(() => dismiss(), 8_000);
      const handler = () => dismiss();
      document.addEventListener('click', handler);
      return () => { clearTimeout(t); document.removeEventListener('click', handler); };
    }
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem('jobhub_tips_seen', 'true');
  }

  return (
    <AnimatePresence>
      {visible && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {tips.map((tip, i) => (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ delay: i * 0.2, duration: 0.3 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                background: 'rgba(14,165,233,0.1)',
                border: '1px solid rgba(14,165,233,0.2)',
                borderRadius: 99,
                fontSize: 12,
                color: '#7dd3fc',
                width: 'fit-content',
              }}
            >
              <span style={{ fontSize: 14 }}>💡</span>
              {tip.text}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
