/**
 * Dim — focus-aware visual fade for sibling regions.
 *
 * Wrap a parent container with <DimRegion>. Mark the focus target with
 * <DimTarget> and dimmable peers with <DimPeer>. When focus enters the
 * target (tab, click on an input), peers fade to 0.55 opacity with a
 * 200ms transition. Focus leaving the target restores full opacity.
 *
 * Rules:
 *   - Peers stay interactive throughout — opacity only, never pointer-events.
 *   - One DimTarget per DimRegion (current contract; extend later if needed).
 *   - Clicking inside a peer does NOT count as leaving focus — peers can
 *     be interacted with freely without dismissing the dim state.
 *
 * Reused in Phase 3 (workspace editors). Keep this minimal.
 */
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

interface DimContextValue {
  focused: boolean;
  setFocused: (v: boolean) => void;
}

const DimContext = createContext<DimContextValue>({
  focused: false,
  setFocused: () => { /* noop */ },
});

export function DimRegion({ children }: { children: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <DimContext.Provider value={{ focused, setFocused }}>
      {children}
    </DimContext.Provider>
  );
}

interface DimTargetProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function DimTarget({ children, style, className }: DimTargetProps) {
  const { setFocused } = useContext(DimContext);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFocus = useCallback(() => {
    setFocused(true);
  }, [setFocused]);

  // Use rAF after blur so we can check whether focus moved to another element
  // inside this container. Without this, tabbing within the target would
  // flicker the dim state.
  const handleBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setFocused(false);
      }
    });
  }, [setFocused]);

  return (
    <div
      ref={containerRef}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={style}
      className={className}
    >
      {children}
    </div>
  );
}

interface DimPeerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function DimPeer({ children, style, className }: DimPeerProps) {
  const { focused } = useContext(DimContext);
  return (
    <div
      style={{
        opacity: focused ? 0.55 : 1,
        transition: 'opacity 200ms ease',
        ...style,
      }}
      className={className}
    >
      {children}
    </div>
  );
}
