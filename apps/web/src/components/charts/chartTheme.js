import { useEffect, useState } from 'react';
import moment from 'moment';
import 'moment/locale/es';

// Colores de datos validados para daltonismo (ver propuesta UX). Cada serie conserva su color
// en todas las gráficas; el modo oscuro usa la misma familia, ajustada para la superficie oscura.
const LIGHT = {
  balance: '#5266EB', ingreso: '#12A877', gasto: '#F2664A', ahorro: '#9B5DE5',
  inversion: '#0E9AA7', transfer: '#64748B',
  ok: '#12A877', warn: '#F5A524', crit: '#DC2626',
  neutral: '#6A6F88', surface: '#FFFFFF',
};
const DARK = {
  balance: '#6F80F2', ingreso: '#139E70', gasto: '#E8603F', ahorro: '#9466E0',
  inversion: '#139AA6', transfer: '#94A3B8',
  ok: '#139E70', warn: '#E39A1E', crit: '#F25555',
  neutral: '#9097B4', surface: '#1F2937',
};

// El tema vive en la clase `dark` de <html> (la pone Layout); se observa para repintar al cambiarlo.
export const useIsDark = () => {
  const get = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(get);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(get()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
};

export const useChartColors = () => (useIsDark() ? DARK : LIGHT);

// Props comunes de ejes y márgenes
export const xAxisProps = {
  axisLine: false, tickLine: false, tick: { fontSize: 11 }, interval: 'preserveStartEnd', minTickGap: 8,
};
export const yAxisProps = {
  width: 52, axisLine: false, tickLine: false, tick: { fontSize: 11 }, tickCount: 4,
};
export const chartMargin = { top: 16, right: 12, left: 0, bottom: 0 };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const metricValue = (m) => num(m && typeof m === 'object' ? m.value : m);

// Serie mensual del API ({ year: [], month: [], <serie>: [{ value, ... }] }) -> [{ key, label, date, ... }]
// Usa el año de cada punto (antes se asumía el año seleccionado y los meses del año anterior salían mal).
export const monthlyRows = (monthly, fallbackYear) => {
  const months = monthly?.month || [];
  return months.map((m, i) => {
    const y = monthly?.year?.[i] ?? fallbackYear;
    const date = new Date(y, m - 1, 1);
    return {
      key: `${y}-${m}`,
      year: y,
      month: m,
      date,
      label: moment(date).locale('es').format('MMM'),
      longLabel: moment(date).locale('es').format('MMMM YYYY'),
    };
  });
};

export const dailyRows = (daily) => (daily?.date || []).map((d) => {
  const date = moment(d, 'YYYY-MM-DD').toDate();
  return {
    key: d,
    date,
    day: date.getDate(),
    label: String(date.getDate()),
    longLabel: moment(date).locale('es').format('D [de] MMMM'),
  };
});

export const isCurrentMonth = (year, month) => {
  const now = new Date();
  return now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month);
};
export const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
