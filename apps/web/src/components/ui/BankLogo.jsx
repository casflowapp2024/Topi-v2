import { useState } from 'react';

// Sin axios ni helpers: se usa en listas de la app y no debe traer nada pesado.
const apiBase = () => process.env.REACT_APP_API_URL || '';

const SIZES = { sm: 'w-6 h-6 text-[11px]', md: 'w-8 h-8 text-xs', lg: 'w-11 h-11 text-sm' };

export const bankInitials = (name = '') => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

/**
 * Logo de un banco del catálogo (plan/33). Sin logo, o si no carga: las iniciales sobre el color del banco
 * (o un gris). `logoUrl` es el que manda la API, relativo a ella.
 */
const BankLogo = ({ name, logoUrl, color, size = 'md', className = '' }) => {
  const [broken, setBroken] = useState(false);
  const box = `${SIZES[size] || SIZES.md} shrink-0 rounded-full overflow-hidden inline-flex items-center justify-center ${className}`;
  if (logoUrl && !broken) {
    return (
      <span className={`${box} bg-white ring-1 ring-gray-200 dark:ring-gray-700`}>
        <img src={`${apiBase()}${logoUrl}`} alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="w-full h-full object-contain" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`${box} font-semibold text-white ${color ? '' : 'bg-gray-400 dark:bg-gray-600'}`}
      style={color ? { backgroundColor: color } : undefined}>
      {bankInitials(name)}
    </span>
  );
};

export default BankLogo;
