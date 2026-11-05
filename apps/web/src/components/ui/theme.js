import { useEffect, useState } from 'react';

export const THEMES = ['light', 'dark', 'system'];
const QUERY = '(prefers-color-scheme: dark)';

/**
 * Preferencia de tema guardada en user_extra.config.
 * `theme` manda; sin él, quien eligió oscuro antes (dark_mode: true) sigue en oscuro y el resto queda en "system".
 */
export const themePreference = (config) => {
  if (THEMES.includes(config?.theme)) return config.theme;
  return config?.dark_mode === true ? 'dark' : 'system';
};

const systemPrefersDark = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY)?.matches);

/** true si la app debe verse oscura; con "system" sigue al sistema operativo y escucha sus cambios. */
export const useResolvedDark = (preference) => {
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(QUERY);
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    setSystemDark(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener?.(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener?.(onChange);
    };
  }, [preference]);

  return preference === 'dark' || (preference === 'system' && systemDark);
};
