// Leyenda compacta para las gráficas. Va fuera del área de dibujo, así nunca se
// superpone con barras ni ejes.
//   items: [{ type: 'bar' | 'line', color, label, value }]
//   lead:  { label, value, negative } -> último valor del periodo, a la izquierda
const ChartLegend = ({ items = [], lead = null, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 text-xs text-ink-2 dark:text-gray-400 ${lead ? 'justify-between' : 'justify-end'} ${className}`}>
    {lead && (
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="capitalize">{lead.label}</span>
        <span className={`text-sm font-bold tabular-nums ${lead.negative ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`}>
          {lead.value}
        </span>
      </span>
    )}
    <span className="inline-flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
      {items.filter(Boolean).map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {it.type === 'line' ? (
            <svg width="18" height="6" aria-hidden="true" className="shrink-0">
              <line x1="0" y1="3" x2="18" y2="3" strokeWidth="2" strokeDasharray="4 3" className="topi-budget-swatch" />
            </svg>
          ) : (
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: it.color }} aria-hidden="true" />
          )}
          <span>{it.label}</span>
          {it.value != null && <span className="font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{it.value}</span>}
        </span>
      ))}
    </span>
  </div>
);

// Etiqueta y valor del último punto de la serie (mes o día en curso).
export const lastPointLead = (data, key, monthly, moment) => {
  if (!Array.isArray(data) || data.length === 0) return null;
  const last = data[data.length - 1];
  const v = Number(last?.[key] ?? 0);
  return {
    label: monthly ? moment(last.date).locale('es').format('MMMM') : moment(last.date).locale('es').format('D [de] MMMM'),
    value: v,
    negative: v < 0,
  };
};

export default ChartLegend;
