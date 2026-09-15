import { useEffect, useRef, useState } from 'react';

const SCROLL_THRESHOLD = 10;
const SHOW_AFTER_IDLE_MS = 1200;

export function useAutoHidePlayer() {
  const playerRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const interactionRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const accumulatedDeltaRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);

  const clearIdleTimeout = () => {
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  };

  const scheduleShowAfterIdle = () => {
    clearIdleTimeout();
    if (interactionRef.current) return;
    idleTimeoutRef.current = window.setTimeout(() => {
      if (!interactionRef.current) setIsVisible(true);
      idleTimeoutRef.current = null;
    }, SHOW_AFTER_IDLE_MS);
  };

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const updateVisibility = () => {
      frameRef.current = null;
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;
      lastScrollYRef.current = currentScrollY;

      if (Math.abs(delta) < 1) return;
      accumulatedDeltaRef.current += delta;
      if (Math.abs(accumulatedDeltaRef.current) < SCROLL_THRESHOLD) return;

      accumulatedDeltaRef.current = 0;
      if (!interactionRef.current) {
        setIsVisible(false);
        scheduleShowAfterIdle();
      }
    };

    const handleScroll = () => {
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(updateVisibility);
    };

    window.addEventListener('scroll', handleScroll, {passive: true});
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      clearIdleTimeout();
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleFocusIn = () => {
      clearIdleTimeout();
      interactionRef.current = true;
      setIsVisible(true);
    };
    const handleFocusOut = () => {
      window.setTimeout(() => {
        if (!player.contains(document.activeElement)) interactionRef.current = false;
      }, 0);
    };
    const handlePointerDown = () => {
      clearIdleTimeout();
      interactionRef.current = true;
      setIsVisible(true);
    };
    const handlePointerUp = () => {
      interactionRef.current = false;
    };

    player.addEventListener('focusin', handleFocusIn);
    player.addEventListener('focusout', handleFocusOut);
    player.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      player.removeEventListener('focusin', handleFocusIn);
      player.removeEventListener('focusout', handleFocusOut);
      player.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const revealPlayer = () => {
    clearIdleTimeout();
    setIsVisible(true);
    accumulatedDeltaRef.current = 0;
  };

  return {playerRef, isVisible, revealPlayer};
}
