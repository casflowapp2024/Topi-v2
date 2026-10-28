
import { use, useEffect, useState } from "react";

//redux
import { connect } from 'react-redux';
import { get_user_transactions } from "../../../redux/actions/cashflow.js";
import { set_dash_account_activated, set_init_date_account_activated, set_end_date_account_activated } from "../../../redux/actions/reports.js";
import { get_accounts_status_by_period, get_history_accounts_by_month } from "../../../redux/actions/reports.js";
//components
import { parseDatetimetoDateStrFormat } from '../../helpers.js';
import AccbyTypeDash from "./AccbyTypeDash.js";
import AccPeriodFilter from "./AccPeriodFilter.js";
import AccChartHistory from "./AccChartHistory.js";
import AccTransPeriod from "./AccTransPeriod.js";
import AccSummaryCard from "./AccSummaryCard.js";
import AccountDetail from "../../accounts/AccountDetail";
import AccountCreate from "../../accounts/AccountCreate";
import { PlusIcon, CreditCardIcon, DocumentCurrencyDollarIcon } from '@heroicons/react/20/solid'
import { findElmentById, accountReportGroup, isInvestmentAccount } from "../../helpers.js";
import InvestmentValuationCard from "./InvestmentValuationCard";
//redux
//import {  } from "../redux/actions/cashflow";

const AAAcountsDashboard = ({
    //actions
    get_user_transactions,
    set_dash_account_activated,
    set_init_date_account_activated,
    set_end_date_account_activated,
    get_accounts_status_by_period,
    get_history_accounts_by_month,

    //state
    current_Month,
    current_Year,
    user_accounts,
    account_activated,
    iniDate_account_dash,
    endDate_account_dash,
    account_activated_stats,
    history_accounts_by_month,

    /* get_user_transactions,
    get_savings_account,
    default_limit, */
}) => {


    //////////////////////////////////////////////////////////////////7
    //////CREAR CUENTAS//////////////////////////////77///////////////

    const [openCreateBox, setOpenCreateBox] = useState(false)

    ///////////////////////////////////////////////////////////////77
    /////////////OPEN DETAIL////////////////////////////////77777

    const [detailInfo, setDetailInfo] = useState(null)
    const [openAccDetail, setOpenAccDetail] = useState(false)

    const handleOpenAccDetail = (AccId) => {
        const selectedAcc = findElmentById(user_accounts.items, AccId)
        setDetailInfo(selectedAcc)
        setOpenAccDetail(true);
    }


    useEffect(() => {
        //al cargar el componente, si no hay cuenta activada, activar la primera cuenta de la lista
        // Respeta la cuenta elegida antes (p. ej. desde "Mis cuentas" en el inicio)
        if (user_accounts.items && user_accounts.items.length > 0) {
            const stillExists = account_activated && user_accounts.items.some(acc => acc.id === account_activated.id);
            if (!stillExists) set_dash_account_activated(user_accounts.items[0]);
        }
    }, [user_accounts]);


    useEffect(() => {
        console.log("AAAcountsDashboard - current_Month o current_Year o account_activated cambiaron")
        //al cargar el componente, si no hay cuenta activada, activar la primera cuenta de la list
        const ini_date_first = parseDatetimetoDateStrFormat(new Date(current_Year, current_Month - 1, 1), "YYYY-MM-DD");
        const end_date_first = parseDatetimetoDateStrFormat(new Date(current_Year, current_Month, 0), "YYYY-MM-DD")
        set_init_date_account_activated(ini_date_first);
        set_end_date_account_activated(end_date_first);
        if (!account_activated) {
            return
        }
        const accounts_type = accountReportGroup(account_activated)
        get_accounts_status_by_period(ini_date_first, end_date_first, accounts_type, [account_activated.id]);
        const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`
        get_history_accounts_by_month(date_filter, account_activated.id)

    }, []);

    useEffect(() => {
        if (!account_activated) {
            return
        }
        const accounts_type = accountReportGroup(account_activated)
        if (endDate_account_dash) {
            console.log("endDate_account_dash", endDate_account_dash)
            const year_from_end_date = endDate_account_dash.substring(0, 4);
            const month_from_end_date = endDate_account_dash.substring(5, 7);
            get_accounts_status_by_period(iniDate_account_dash, endDate_account_dash, accounts_type, [account_activated.id]);
            const date_filter = `${year_from_end_date}-${month_from_end_date.toString().padStart(2, '0')}`
            get_history_accounts_by_month(date_filter, account_activated.id)
        }

    }, [account_activated]);



    return (
        <>
            {/*
                Una sola versión para todos los tamaños (antes había un bloque PC y otro móvil,
                y cada componente se montaba y pedía sus datos dos veces).
                En móvil las columnas usan `contents`, así sus hijos entran directo en la pila
                y `order-*` define el orden; en PC (lg) vuelven a ser columnas.
            */}
            <div className="flex flex-col gap-2 lg:flex-row lg:gap-6 px-2 lg:px-0 pb-4 md:max-w-[560px] md:mx-auto lg:max-w-none lg:w-full">
                {/* Cuentas por tipo y movimientos */}
                <div className="contents lg:flex lg:flex-col lg:gap-6 lg:w-[380px] xl:w-[360px] lg:shrink-0">
                    {user_accounts &&
                        <div className="order-1 lg:order-none">
                            <AccbyTypeDash
                                onOpenDetail={handleOpenAccDetail}
                                onOpenCreate={() => setOpenCreateBox(true)}
                            />
                        </div>
                    }
                    <div className="order-5 lg:order-none">
                        <AccTransPeriod />
                    </div>
                </div>
                {/* Filtro, resumen e historial de la cuenta elegida */}
                <div className="contents lg:flex lg:flex-col lg:gap-6 lg:flex-1 lg:min-w-0">
                    {user_accounts && account_activated &&
                        <div className="order-2 lg:order-none">
                            <AccPeriodFilter />
                        </div>
                    }
                    {/* las inversiones tienen su propio resumen: valor, aportes y ganancia */}
                    {account_activated && !isInvestmentAccount(account_activated) &&
                        <div className='order-3 lg:order-none p-4 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-xl shadow-md'>
                            <AccSummaryCard acc={account_activated} data={account_activated_stats} />
                        </div>
                    }
                    {account_activated && isInvestmentAccount(account_activated) &&
                        <div className="order-3 lg:order-none">
                            <InvestmentValuationCard account={account_activated} />
                        </div>
                    }
                    <div className="order-4 lg:order-none h-[260px] md:h-[364px] lg:h-[360px] p-4 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-xl shadow-md flex flex-col">
                        <h2 className="text-md font-bold mb-2 text-gray-800 dark:text-gray-100">Saldo histórico de la cuenta</h2>
                        {account_activated && history_accounts_by_month &&
                            <div className="flex-1 min-h-0">
                                <AccChartHistory />
                            </div>
                        }
                    </div>
                </div>
            </div>

            {/*PopOver Create accounts*/}
            <AccountCreate
                openCreateBox={openCreateBox}
                setOpenCreateBox={setOpenCreateBox}
            />

            {/*PopOver Detail Accounts*/}
            <AccountDetail
                openAccDetail={openAccDetail}
                setOpenAccDetail={setOpenAccDetail}
                detailInfo={detailInfo}
                setDetailInfo={setDetailInfo}
            />

        </>
    )
}

const mapStateToProps = state => ({

    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    user_accounts: state.CashFlow.user_accounts,
    account_activated: state.Reports.account_activated,
    iniDate_account_dash: state.Reports.iniDate_account_dash,
    endDate_account_dash: state.Reports.endDate_account_dash,
    account_activated_stats: state.Reports.account_activated_stats,
    history_accounts_by_month: state.Reports.history_accounts_by_month,


})

export default connect(mapStateToProps, {
    get_user_transactions,
    set_dash_account_activated,
    set_init_date_account_activated,
    set_end_date_account_activated,
    get_accounts_status_by_period,
    get_history_accounts_by_month

})(AAAcountsDashboard)
