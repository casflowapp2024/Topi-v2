import { formatMoney } from '../helpers';
import { useAdminMetric, Panel, PanelSkeleton, PanelError, Stat, StatGrid, DailyBars, DailyLines, fillDays, fmtInt } from './AdminUi';

// centavos a partir de 1 USD; por debajo, 4 decimales para que no se vea en cero
const usd = (v) => formatMoney(v, 'USD', { decimals: Math.abs(Number(v)) >= 1 ? 2 : 4 });
const compactInt = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

const AdminCosts = ({ reloadKey }) => {
  const costs = useAdminMetric('costs', reloadKey);
  if (costs.loading && !costs.data) return <PanelSkeleton rows={3} />;
  if (costs.error) return <PanelError state={costs} />;
  const c = costs.data;
  const tokens = fillDays(c.daily, ['llm_tokens_in', 'llm_tokens_out'], 60);
  const mails = fillDays(c.daily, ['mails_sent'], 60);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Costo por usuario activo" subtitle="30 días · Gemini + servidor prorrateado entre el MAU">
        <StatGrid>
          <Stat label="Por usuario activo" value={usd(c.cost_per_active_user_usd)} hint={`MAU ${fmtInt(c.mau)}`} />
          <Stat label="Gemini (30 d)" value={usd(c.llm_cost_usd_30d)} hint={c.prices_configured
            ? `${c.price_in_usd_per_mtok} / ${c.price_out_usd_per_mtok} USD por millón (entrada / salida)`
            : 'Sin precio: configura LLM_PRICE_*_USD_PER_MTOK'} tone={c.prices_configured ? undefined : 'warn'} />
          <Stat label="Servidor (mes)" value={formatMoney(c.server_monthly_usd, 'USD')} hint="SERVER_MONTHLY_COST_USD" />
          <Stat label="Llamadas al modelo" value={fmtInt(c.calls_30d)}
            hint={`${compactInt.format(c.tokens_in_30d)} tokens entrada · ${compactInt.format(c.tokens_out_30d)} salida`} />
        </StatGrid>
      </Panel>

      <Panel title="Tokens de Gemini por día" subtitle="60 días · solo conteos, sin contenido">
        <DailyBars rows={tokens} bars={[
          { key: 'llm_tokens_in', label: 'Entrada', color: 'balance' },
          { key: 'llm_tokens_out', label: 'Salida', color: 'inversion' },
        ]} />
      </Panel>

      <Panel title="Correos enviados vs. cuota" subtitle={`Cuota diaria ${fmtInt(c.mail_daily_quota)} · máximo en 30 días ${fmtInt(c.max_mails_day_30d)} · ${fmtInt(c.mails_sent_30d)} en 30 días`}>
        <DailyLines rows={mails.map((m) => ({ ...m, quota: c.mail_daily_quota }))} lines={[
          { key: 'mails_sent', label: 'Enviados', color: 'balance' },
          { key: 'quota', label: 'Cuota', color: 'warn' },
        ]} />
      </Panel>
    </div>
  );
};

export default AdminCosts;
