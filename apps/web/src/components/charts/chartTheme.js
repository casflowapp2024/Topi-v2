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

// Métrica ({ value, diff, percentage, ... }) de un mes en una serie mensual del API; null si no está
export const monthlyMetricAt = (monthly, key, year, month) => {
  const i = (monthly?.month || []).findIndex((m, idx) => Number(m) === Number(month) && Number(monthly.year?.[idx]) === Number(year));
  return i >= 0 ? monthly[key]?.[i] ?? null : null;
};

export const isCurrentMonth = (year, month) => {
  const now = new Date();
  return now.getFullYear() === Number(year) && now.getMonth() + 1 === Number(month);
};
export const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

// Tope "redondo" del eje Y para que quepa `value` (p. ej. el presupuesto) con 3 tramos limpios
// (0, 2 M, 4 M, 6 M). Se usa como domain={[0, (dataMax) => niceMax(dataMax, budget)]}.
// Presupuesto de un mes (plan/26-presupuestos-historicos.md): el arreglo por mes que manda el API o, si no
// viene (respuestas viejas en caché), el valor de arriba.
export const budgetAt = (perMonth, i, fallback) => Math.abs(Number(perMonth?.[i] ?? fallback) || 0);

// Con el mismo presupuesto en todos los meses se dibuja la línea fija de siempre; si cambió, una línea
// escalonada que sube o baja en el borde entre meses. Los meses sin presupuesto cortan la línea.
export const budgetLine = (rows, key) => {
  const values = rows.map(r => r[key]).filter(v => v > 0);
  const flat = values.length === 0 || (values.length === rows.length && values.every(v => v === values[0]));
  return { flat, max: Math.max(0, ...values), value: flat ? (values[0] || 0) : null };
};

export const niceMax = (...values) => {
  const max = Math.max(0, ...values.map(Number).filter(Number.isFinite)) * 1.04;
  if (max <= 0) return 1;
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw);
  return step * 3;
};
