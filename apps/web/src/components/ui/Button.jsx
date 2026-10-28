import { forwardRef } from 'react';

const VARIANTS = {
  primary: 'bg-topi-500 hover:bg-topi-600 text-white shadow-sm',
  secondary: 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-sm dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100 dark:border-gray-700',
  ghost: 'bg-transparent hover:bg-topi-50 text-topi-600 dark:text-indigo-300 dark:hover:bg-gray-700',
  danger: 'bg-status-crit hover:bg-red-700 text-white shadow-sm',
};
const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-2xl',
  icon: 'h-9 w-9 rounded-2xl',
};

/**
 * Botón de Topi. variant: primary | secondary | ghost | danger. size: sm | md | lg | icon.
 * icon: componente de Heroicons que va antes del texto. loading: deshabilita y muestra un spinner.
 */
const Button = forwardRef(({ variant = 'primary', size = 'md', icon: Icon, loading = false, className = '', children, type = 'button', disabled, ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    {...props}
  >
    {loading
      ? <span className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin motion-reduce:animate-none" aria-hidden="true" />
      : Icon && <Icon className={size === 'icon' ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />}
    {children}
  </button>
));

export default Button;
