import React from 'react';

interface Props {
  children: React.ReactNode;
}

/**
 * Pass-through gate.
 *
 * Previously rendered a "Your profile isn't ready yet" blocking modal that
 * read as hopeless on freshly onboarded users — especially candidates whose
 * impact doesn't quantify cleanly. Activation pressure now lives in the
 * Strategy Hub redesign (Dual-Signal analysis with "Distance to Match"
 * framing), so this component is intentionally a no-op. Kept as a wrapper
 * so the routing wiring in App.tsx doesn't need to change.
 */
export const ProfileGate: React.FC<Props> = ({ children }) => {
  return <>{children}</>;
};
