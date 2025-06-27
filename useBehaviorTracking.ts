import { useEffect, useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface KeystrokeEvent {
  key: string;
  timestamp: number;
  dwellTime: number;
  flightTime: number;
}

interface MouseEventData {
  x: number;
  y: number;
  timestamp: number;
  eventType: string;
  pressure?: number;
}

export function useBehaviorTracking(sessionId: string) {
  const recordKeystroke = useMutation(api.biometrics.recordKeystroke);
  const recordMouseMovement = useMutation(api.biometrics.recordMouseMovement);
  const recordNavigation = useMutation(api.biometrics.recordNavigation);

  const keystrokeBuffer = useRef<KeystrokeEvent[]>([]);
  const mouseBuffer = useRef<MouseEventData[]>([]);
  const lastKeyDown = useRef<{ [key: string]: number }>({});
  const lastKeyUp = useRef<number>(0);

  // Flush buffers periodically
  const flushBuffers = useCallback(async () => {
    if (keystrokeBuffer.current.length > 0) {
      await recordKeystroke({
        sessionId,
        keystrokeData: keystrokeBuffer.current
      });
      keystrokeBuffer.current = [];
    }

    if (mouseBuffer.current.length > 0) {
      await recordMouseMovement({
        sessionId,
        mouseData: mouseBuffer.current
      });
      mouseBuffer.current = [];
    }
  }, [sessionId, recordKeystroke, recordMouseMovement]);

  // Keystroke tracking
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const timestamp = Date.now();
    lastKeyDown.current[event.key] = timestamp;
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const timestamp = Date.now();
    const keyDownTime = lastKeyDown.current[event.key];
    
    if (keyDownTime) {
      const dwellTime = timestamp - keyDownTime;
      const flightTime = lastKeyUp.current > 0 ? keyDownTime - lastKeyUp.current : 0;

      keystrokeBuffer.current.push({
        key: event.key,
        timestamp,
        dwellTime,
        flightTime
      });

      delete lastKeyDown.current[event.key];
      lastKeyUp.current = timestamp;

      // Flush buffer if it gets too large
      if (keystrokeBuffer.current.length >= 10) {
        flushBuffers();
      }
    }
  }, [flushBuffers]);

  // Mouse tracking
  const handleMouseMove = useCallback((event: globalThis.MouseEvent) => {
    mouseBuffer.current.push({
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
      eventType: 'move'
    });

    // Keep buffer size manageable
    if (mouseBuffer.current.length > 50) {
      mouseBuffer.current = mouseBuffer.current.slice(-25);
    }
  }, []);

  const handleMouseClick = useCallback((event: globalThis.MouseEvent) => {
    mouseBuffer.current.push({
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
      eventType: 'click',
      pressure: (event as any).pressure || 0.5
    });
  }, []);

  // Navigation tracking
  const trackNavigation = useCallback((page: string, action: string) => {
    recordNavigation({
      sessionId,
      page,
      action
    });
  }, [sessionId, recordNavigation]);

  useEffect(() => {
    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleMouseClick);

    // Flush buffers every 5 seconds
    const flushInterval = setInterval(flushBuffers, 5000);

    return () => {
      // Clean up
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleMouseClick);
      clearInterval(flushInterval);
      
      // Final flush
      flushBuffers();
    };
  }, [handleKeyDown, handleKeyUp, handleMouseMove, handleMouseClick, flushBuffers]);

  return { trackNavigation };
}
