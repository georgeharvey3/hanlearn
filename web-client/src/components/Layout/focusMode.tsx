import { createContext, useContext, useEffect } from 'react';

/**
 * A study session fills the screen: the layout hides the app's navigation
 * while a screen asks for focus, and the session's own bar has the way out.
 */
export const FocusModeContext = createContext<(focused: boolean) => void>(() => {});

/** Ask the layout to hide its navigation while `active` is true. */
export const useFocusMode = (active: boolean): void => {
  const setFocused = useContext(FocusModeContext);
  useEffect(() => {
    setFocused(active);
    return () => setFocused(false);
  }, [active, setFocused]);
};

export const FocusModeProvider = FocusModeContext.Provider;
