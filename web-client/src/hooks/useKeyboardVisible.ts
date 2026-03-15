import { useEffect, useState } from 'react';

const KEYBOARD_THRESHOLD = 150;

/**
 * Detects whether a mobile virtual keyboard is likely open by comparing
 * the visual viewport height to the full window height.
 *
 * Returns `false` on desktop or browsers without `visualViewport` support.
 */
export default function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const isOpen = window.innerHeight - vv.height > KEYBOARD_THRESHOLD;
      setVisible((prev) => (prev !== isOpen ? isOpen : prev));
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return visible;
}
