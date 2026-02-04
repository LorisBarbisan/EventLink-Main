import { useCallback, useEffect, useRef, useState } from "react";

export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void, boolean] {
  // Helper to load from storage
  const loadFromStorage = useCallback(() => {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [state, setState] = useState<T>(loadFromStorage);
  const [isDirty, setIsDirty] = useState(false);

  // Track previous key to handle key changes
  const prevKeyRef = useRef(key);

  if (prevKeyRef.current !== key) {
    prevKeyRef.current = key;
    setState(loadFromStorage());
  }

  // Update sessionStorage when state changes
  useEffect(() => {
    try {
      if (state !== undefined) {
        sessionStorage.setItem(key, JSON.stringify(state));

        const currentString = JSON.stringify(state);
        const initialString = JSON.stringify(initialValue);
        setIsDirty(currentString !== initialString);
      }
    } catch (error) {
      console.warn(`Error saving localStorage key "${key}":`, error);
    }
  }, [key, state, initialValue]);

  const clearState = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
      setState(initialValue);
      setIsDirty(false);
    } catch (error) {
      console.warn(`Error clearing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [state, setState, clearState, isDirty];
}
