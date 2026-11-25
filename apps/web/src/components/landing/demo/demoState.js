// Estado de Redux de ejemplo para la vitrina de la landing (plan/28 §10): los componentes reales del Inicio,
// Presupuestos, Cuentas y Movimientos lo leen igual que en la app. Todo es inventado y relativo a hoy, para que
// "Hoy puedes gastar", la proyección y el patrimonio tengan sentido cualquier día del mes.

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const buildDemoState = (now = new Date()) => {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.getDate();
  const dim = new Date(year, month, 0).getDate();
  // qué tanto del mes pasó, con piso para que a principio de mes también haya algo que mostrar
  const pace = Math.min(1, Math.max(0.3, today / dim));

  // Presupuestos de gasto (la API los manda en negativo) y lo gastado en cada uno
  const budgets = [
    { category_id: 1, name: 'mercado', emoji: '1f6d2', budget: 1200000, used: 0.86 },
    { category_id: 2, name: 'restaurantes', emoji: '1f37d-fe0f', budget: 400000, used: 1.08 },
    { category_id: 3, name: 'transporte', emoji: '1f697', budget: 500000, used: 0.62 },
  ].map((c) => {
    const spent = Math.round((c.budget * c.used * pace) / 100) * 100;
    return { category_id: c.category_id, name: c.name, emoji: c.emoji, budget: -c.budget, value: -spent, expenses: -spent, usage: (spent / c.budget) * 100 };
  });
  const expenseBudget = budgets.reduce((s, c) => s + Math.abs(c.budget), 0);
  const budgetedSpent = budgets.reduce((s, c) => s + Math.abs(c.value), 0);
  const otherSpent = Math.round(380000 * pace / 100) * 100;
  const allSpent = budgetedSpent + otherSpent;

  // Lo gastado acumulado día a día, como un mes real: días casi sin gasto, compras grandes (mercado, servicios)
  // que hacen saltos y alguna devolución que lo baja un poco. Pseudoaleatorio con semilla: siempre igual.
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const daily = [];
  for (let d = 1; d <= today; d += 1) {
    let w = rand() < 0.35 ? 0.02 : 0.1 + rand() * 0.6; // días casi sin gasto y días normales
    if (d % 7 === 6) w += 5 + rand() * 4; // la compra grande de la semana
    if (d === 2 || d === 5) w += 7; // servicios y arriendo al empezar el mes
    if (d > 6 && d % 11 === 8) w = -2.5; // una devolución
    daily.push(w);
  }
  const weight = daily.reduce((s, w) => s + w, 0) || 1;
  const dates = [];
  const mtdBudget = [];
  const mtdExpense = [];
  let acc = 0;
  daily.forEach((w, i) => {
    acc += w;
    dates.push(`${year}-${pad(month)}-${pad(i + 1)}`);
    mtdBudget.push(-Math.round((budgetedSpent * acc) / weight));
    mtdExpense.push(-Math.round((allSpent * acc) / weight));
  });

  const income = 5200000;
  const saved = income - allSpent;
  const prev = new Date(year, month - 2, 1);

  const Reports = {
    current_Month: month,
    current_Year: year,
    history_dash: {
      expense_budget: -expenseBudget,
      daily: { date: dates, mtd_budget: mtdBudget, mtd_expense: mtdExpense },
      monthly: {
        year: [prev.getFullYear(), year],
        month: [prev.getMonth() + 1, month],
        savings: [{ value: 640000, percentage: 0 }, { value: saved, percentage: Math.round(((saved - 640000) / 640000) * 100) }],
      },
    },
    income: { value: income, vs_past_month: 4 },
    expenses: { value: -allSpent, vs_past_month: -9 },
    expenses_report: budgets,
    expenses_report_full: { value: -allSpent, budget: -expenseBudget },
    income_report_full: { value: 4800000, budget: income },
    income_report: [
      { category_id: 21, name: 'salario', emoji: '1f4bc', value: 4200000, budget: 4400000, usage: 95.45 },
      { category_id: 22, name: 'trabajos extra', emoji: '1f4bb', value: 600000, budget: 800000, usage: 75 },
    ],
  };

  // Cuentas (type_id: 1 efectivo, 2 ahorros, 3 inversión, 4 tarjeta) y patrimonio de hoy
  const accounts = [
    { id: 11, name: 'Cuenta de ahorros', type: { id: 2, class: 'deposit', name: 'Ahorros' }, bank: 'Banco Andino', digits: '4821', currency: 'COP', balance: 8450000 },
    { id: 12, name: 'Cuenta nómina', type: { id: 2, class: 'deposit', name: 'Ahorros' }, bank: 'Banca Sol', digits: '0917', currency: 'COP', balance: 1320000 },
    { id: 13, name: 'Inversión', type: { id: 3, class: 'investment', name: 'Inversión' }, bank: 'Fondo Norte', digits: '', currency: 'COP', balance: 12300000, gain: 410000 },
    { id: 14, name: 'Cuenta en dólares', type: { id: 2, class: 'deposit', name: 'Ahorros' }, bank: 'Banco Global', digits: '3306', currency: 'USD', balance: 2150, rate: 3950 },
    { id: 15, name: 'Tarjeta de crédito', type: { id: 4, class: 'credit', name: 'Tarjeta' }, bank: 'Banco Andino', digits: '7712', currency: 'COP', balance: -1230000 },
  ];
  const nwAccounts = accounts.map((a) => ({
    account_id: a.id, name: a.name, type_id: a.type.id, bank: a.bank, last_four_digits: a.digits,
    currency: a.currency, balance: String(a.balance), base_value: String(Math.round(a.balance * (a.rate || 1))),
    market_gain: a.gain != null ? String(a.gain) : null,
  }));
  const sumOf = (cls) => accounts.filter((a) => a.type.class === cls).reduce((s, a) => s + Math.round(a.balance * (a.rate || 1)), 0);
  const cash = sumOf('deposit');
  const investments = sumOf('investment');
  const credit = sumOf('credit');
  const total = cash + investments + credit;

  // Patrimonio al cierre de cada uno de los últimos 12 meses, subiendo con altibajos, y hoy
  const points = [];
  const steps = [0, 0.05, 0.08, 0.06, 0.14, 0.2, 0.27, 0.31, 0.29, 0.4, 0.52, 0.61, 0.66];
  const start = total * 0.78;
  for (let i = 12; i >= 1; i -= 1) {
    const close = new Date(year, month - i, 0); // último día del mes, i meses atrás
    const t = Math.round(start + (total - start) * steps[12 - i]);
    points.push({ date: ymd(close), total: String(t), cash_total: String(Math.round(t * 0.6)), investments_total: String(Math.round(t * 0.44)), credit_total: String(-Math.round(t * 0.04)), missing_rates: false });
  }
  points.push({ date: ymd(now), total: String(total), cash_total: String(cash), investments_total: String(investments), credit_total: String(credit), missing_rates: false });

  const Fx = {
    net_worth: { total: String(total), base_currency: 'COP', cash_total: String(cash), investments_total: String(investments), credit_total: String(credit), missing_rates: false, accounts: nwAccounts },
    net_worth_history: { base_currency: 'COP', points },
  };

  const CashFlow = {
    user_accounts: { items: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, bank: { name: a.bank }, last_four_digits: a.digits, currency: a.currency })) },
    user_categories: budgets.map((c) => ({ id: c.category_id, name: c.name, emoji: c.emoji })),
  };

  return { Reports, Fx, CashFlow, UI: { active_report_tab: 'Expenses' } };
};

// Movimientos de ejemplo para el historial (la fila real de Movimientos los dibuja)
export const buildDemoTransactions = (now = new Date()) => {
  const day = (back) => {
    const d = new Date(now);
    d.setDate(d.getDate() - back);
    return `${ymd(d)} 12:00:00`;
  };
  const card = { id: 15, name: 'Tarjeta de crédito', type: { id: 4, class: 'credit' } };
  const savings = { id: 11, name: 'Cuenta de ahorros', type: { id: 2, class: 'deposit' } };
  const rows = [
    [0, 'Panadería La Espiga', 12400, 'mercado', '1f950', card],
    [0, 'Supermercado Sol', 186500, 'mercado', '1f6d2', card],
    [1, 'Nómina', 5200000, 'salario', '1f4bc', savings, false],
    [2, 'Restaurante El Patio', 96000, 'restaurantes', '1f37d-fe0f', card],
    [2, 'Panadería La Espiga', 9800, 'mercado', '1f950', card],
    [3, 'Streaming', 38900, 'suscripciones', '1f3ac', card],
    [4, 'Farmacia del Centro', 54300, 'salud', '1f48a', savings],
  ];
  return rows.map(([back, description, amount, category, emoji, account, expense = true], i) => ({
    id: 900 + i, date: day(back), description, amount: String(amount), amount_base: String(amount), currency: 'COP',
    expense, category: { name: category, emoji }, account, checked: i > 1, automated: true,
  }));
};
