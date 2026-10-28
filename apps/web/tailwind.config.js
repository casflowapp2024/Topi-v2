/** @type {import('tailwindcss').Config} */

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx,html}',
  ],
  darkMode: 'selector',
  theme: {
    extend: {
      // Tokens de color (propuesta UX v1). Usar estos en vez de hex sueltos.
      colors: {
        topi: { 50: '#EEF0FE', 500: '#5266EB', 600: '#4354D6' },
        data: { balance: '#5266EB', ingreso: '#12A877', gasto: '#F2664A', ahorro: '#9B5DE5' },
        money: { in: '#0B7A55', out: '#C2412A', 'in-dark': '#34D399', 'out-dark': '#FF8A70' },
        status: {
          ok: '#12A877', 'ok-soft': '#E5F7F0',
          warn: '#F5A524', 'warn-text': '#B45309', 'warn-soft': '#FEF4E2',
          crit: '#DC2626', 'crit-text': '#B91C1C', 'crit-soft': '#FDECEC',
        },
        ink: { DEFAULT: '#1E1E2A', 2: '#5B6078' },
      },
      fontFamily:{
        Inter :  ["Inter","serif"],
      },
      animation: {
        marquee: 'marquee 20s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [],
}
