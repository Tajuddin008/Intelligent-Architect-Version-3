// useUndo.ts - tiny undo/redo for immutable objects
import { useRef, useState } from 'react';

export function useUndo<T>(initial: T) {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);

  const set = (next: T) => {
    past.current.push(present);
    setPresent(next);
    future.current = [];
  };

  const undo = () => {
    if (!past.current.length) return;
    const prev = past.current.pop() as T;
    future.current.push(present);
    setPresent(prev);
  };

  const redo = () => {
    if (!future.current.length) return;
    const nxt = future.current.pop() as T;
    past.current.push(present);
    setPresent(nxt);
  };

  const reset = (val: T) => {
    past.current = [];
    future.current = [];
    setPresent(val);
  };

  return { present, set, undo, redo, reset, canUndo: !!past.current.length, canRedo: !!future.current.length };
}