// Leyenda compacta para las gráficas. Va fuera del área de dibujo, así nunca se
// superpone con barras ni ejes.
//   items: [{ type: 'bar' | 'line' (presupuesto, punteada) | 'solid' | 'dot', color, label, value, faded }]
//   lead:  { label, value, negative, tone } -> titular a la izquierda (tone: ok | warn | crit | neg)
const LEAD_TONE = {
  default: 'text-gray-900 dark:text-gray-100',
  neg: 'text-money-out dark:text-money-out-dark',
  ok: 'text-money-in dark:text-money-in-dark',
  warn: 'text-status-warn-text dark:text-amber-300',
  crit: 'text-status-crit-text dark:text-red-400',
};

const ChartLegend = ({ items = [], lead = null, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 text-xs text-ink-2 dark:text-gray-400 ${lead ? 'justify-between' : 'justify-end'} ${className}`}>
    {lead && (
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span>{String(lead.label ?? "").charAt(0).toUpperCase() + String(lead.label ?? "").slice(1)}</span>
        <span className={`text-sm font-bold tabular-nums ${LEAD_TONE[lead.tone || (lead.negative ? 'neg' : 'default')]}`}>
          {lead.value}
        </span>
      </span>
    )}
    <span className="inline-flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
      {items.filter(Boolean).map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {it.type === 'solid' ? (
            <svg width="18" height="6" aria-hidden="true" className="shrink-0">
              <line x1="0" y1="3" x2="18" y2="3" strokeWidth="2.5" strokeLinecap="round" stroke={it.color} />
            </svg>
          ) : it.type === 'line' && it.color ? (
            <svg width="18" height="6" aria-hidden="true" className="shrink-0">
              <line x1="0" y1="3" x2="18" y2="3" strokeWidth="2" strokeDasharray="4 3" stroke={it.color} />
            </svg>
          ) : it.type === 'line' ? (
            <svg width="18" height="6" aria-hidden="true" className="shrink-0">
              <line x1="0" y1="3" x2="18" y2="3" strokeWidth="2" strokeDasharray="4 3" className="topi-budget-swatch" />
            </svg>
          ) : it.type === 'dot' ? (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: it.color }} aria-hidden="true" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: it.color, opacity: it.faded ? 0.4 : 1 }} aria-hidden="true" />
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
