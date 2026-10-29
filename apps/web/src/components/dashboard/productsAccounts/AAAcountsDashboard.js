import { useEffect, useState } from "react";
import { connect } from 'react-redux';
import { set_dash_account_activated, get_accounts_status_by_period, get_history_accounts_by_month } from "../../../redux/actions/reports.js";
import { PencilSquareIcon } from '@heroicons/react/20/solid';
import AccChartHistory from "./AccChartHistory.js";
import AccTransPeriod from "./AccTransPeriod.js";
import AccSummaryCard from "./AccSummaryCard.js";
import AccountDetail from "../../accounts/AccountDetail";
import AccountCreate from "../../accounts/AccountCreate";
import CreditCardPanel from "./CreditCardPanel";
import InvestmentValuationCard from "./InvestmentValuationCard";
import AccountsTypeBar from "./AccountsTypeBar";
import AccountGroupCard from "./AccountGroupCard";
import AccountPeriodControl from "./AccountPeriodControl";
import Button from "../../ui/Button";
import { findElmentById, accountReportGroup, accountClass, isOpenAccount } from "../../helpers.js";
import { groupOfAccount, accountsOfGroup, ACCOUNT_GROUPS } from "./accountGroups";

const CHART_TITLE = {
    deposit: ['Saldo', 'últimos 12 meses, al cierre de cada mes'],
    credit: ['Deuda', 'al cierre de cada mes, últimos 12 meses'],
    investment: ['Valor', 'al cierre de cada mes, últimos 12 meses'],
};

/**
 * Cuentas, en tres niveles:
 *  1. Barra de tipos (Todo · Efectivo · Tarjetas · Inversiones · Cerradas) y "Agregar cuenta".
 *  2. El total del grupo con sus cuentas en la misma tarjeta (en "Todo": el patrimonio).
 *  3. El detalle de la cuenta elegida: periodo (mes, corte de la tarjeta o rango), sus cifras,
 *     la gráfica propia de su tipo y los movimientos del periodo.
 */
const AAAcountsDashboard = ({
    set_dash_account_activated, get_accounts_status_by_period, get_history_accounts_by_month,
    current_Month, current_Year, user_accounts, account_activated,
    iniDate_account_dash, endDate_account_dash, account_activated_stats, history_accounts_by_month,
}) => {
    const [openCreateBox, setOpenCreateBox] = useState(false);
    const [detailInfo, setDetailInfo] = useState(null);
    const [openAccDetail, setOpenAccDetail] = useState(false);
    const handleOpenAccDetail = (accId) => {
        setDetailInfo(findElmentById(user_accounts.items, accId));
        setOpenAccDetail(true);
    };

    // Grupo: si llegas con una cuenta elegida (p. ej. desde el inicio) se abre su grupo; si no, "Todo"
    const [group, setGroup] = useState(() => (account_activated ? groupOfAccount(account_activated) : 'all'));
    useEffect(() => {
        if (account_activated && group !== 'all') setGroup(groupOfAccount(account_activated));
    }, [account_activated?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const handleGroupChange = (g) => {
        setGroup(g);
        if (g === 'all') return;
        const list = accountsOfGroup(user_accounts?.items, g);
        if (list.length && !list.some(a => a.id === account_activated?.id)) set_dash_account_activated(list[0]);
    };

    // Sin cuenta elegida (o si se borró): la primera abierta
    useEffect(() => {
        const items = user_accounts?.items;
        if (!items?.length) return;
        if (!account_activated || !items.some(a => a.id === account_activated.id)) {
            set_dash_account_activated(items.find(isOpenAccount) || items[0]);
        }
    }, [user_accounts]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cifras del periodo (el periodo lo pone AccountPeriodControl)
    useEffect(() => {
        if (!account_activated || !iniDate_account_dash || !endDate_account_dash) return;
        get_accounts_status_by_period(iniDate_account_dash, endDate_account_dash, accountReportGroup(account_activated), [account_activated.id]);
    }, [account_activated?.id, iniDate_account_dash, endDate_account_dash]); // eslint-disable-line react-hooks/exhaustive-deps

    // Historial de 12 meses hasta el mes elegido
    useEffect(() => {
        if (!account_activated) return;
        get_history_accounts_by_month(`${current_Year}-${String(current_Month).padStart(2, '0')}`, account_activated.id);
    }, [account_activated?.id, current_Month, current_Year]); // eslint-disable-line react-hooks/exhaustive-deps

    const showDetail = group !== 'all' && account_activated && groupOfAccount(account_activated) === group;
    const cls = account_activated ? accountClass(account_activated) : 'deposit';
    const [chartTitle, chartHint] = CHART_TITLE[cls] || CHART_TITLE.deposit;
    const meta = ACCOUNT_GROUPS.find(g => g.id === groupOfAccount(account_activated));

    return (
        <>
            <div className="flex flex-col gap-2 lg:gap-6 px-2 lg:px-0 pb-4 md:max-w-[560px] md:mx-auto lg:max-w-none lg:w-full">
                <AccountsTypeBar group={group} onChange={handleGroupChange} onCreate={() => setOpenCreateBox(true)} />
                <AccountGroupCard group={group} onGroupChange={handleGroupChange} onOpenDetail={handleOpenAccDetail} />

                {showDetail && (
                    <>
                        {/* Encabezado de la cuenta y su periodo */}
                        <section className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md flex flex-col gap-3" aria-label="Cuenta elegida">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    {meta && <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.tint}`}><meta.Icon className="w-5 h-5" aria-hidden="true" /></span>}
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{account_activated.name}</h2>
                                        <p className="text-xs text-ink-2 dark:text-gray-400 truncate">
                                            {account_activated.bank?.name}{account_activated.last_four_digits ? ` · ••${account_activated.last_four_digits}` : ''} · {account_activated.currency || 'COP'}{account_activated.type?.name ? ` · ${account_activated.type.name}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <Button size="sm" variant="secondary" icon={PencilSquareIcon} onClick={() => handleOpenAccDetail(account_activated.id)}>
                                    <span className="hidden sm:inline">Editar</span>
                                </Button>
                            </div>
                            <AccountPeriodControl account={account_activated} />
                        </section>

                        {/* Cifras + gráfica a la izquierda, movimientos a la derecha */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 lg:gap-6">
                            <div className="lg:col-span-3 flex flex-col gap-2 lg:gap-6 min-w-0">
                                {cls === 'credit' ? (
                                    <CreditCardPanel account={account_activated} data={account_activated_stats} />
                                ) : cls === 'investment' ? (
                                    <InvestmentValuationCard account={account_activated} />
                                ) : (
                                    <AccSummaryCard acc={account_activated} data={account_activated_stats} />
                                )}
                                <section className="h-[280px] md:h-[320px] p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md flex flex-col" aria-label={chartTitle}>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{chartTitle} <span className="font-normal text-ink-2 dark:text-gray-400">· {chartHint}</span></h3>
                                    {history_accounts_by_month && (
                                        <div className="flex-1 min-h-0 mt-1">
                                            <AccChartHistory />
                                        </div>
                                    )}
                                </section>
                            </div>
                            <div className="lg:col-span-2 min-w-0 lg:min-h-[560px]">
                                <AccTransPeriod />
                            </div>
                        </div>
                    </>
                )}
            </div>

            <AccountCreate openCreateBox={openCreateBox} setOpenCreateBox={setOpenCreateBox} />
            <AccountDetail openAccDetail={openAccDetail} setOpenAccDetail={setOpenAccDetail} detailInfo={detailInfo} setDetailInfo={setDetailInfo} />
        </>
    );
};

const mapStateToProps = state => ({
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    user_accounts: state.CashFlow.user_accounts,
    account_activated: state.Reports.account_activated,
    iniDate_account_dash: state.Reports.iniDate_account_dash,
    endDate_account_dash: state.Reports.endDate_account_dash,
    account_activated_stats: state.Reports.account_activated_stats,
    history_accounts_by_month: state.Reports.history_accounts_by_month,
});

export default connect(mapStateToProps, {
    set_dash_account_activated, get_accounts_status_by_period, get_history_accounts_by_month,
})(AAAcountsDashboard);
