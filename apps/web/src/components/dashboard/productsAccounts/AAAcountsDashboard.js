
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
import { findElmentById } from "../../helpers.js";
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
        let accounts_type
        if (!account_activated) {
            return
        }
        if (account_activated.type.id === 1 || account_activated.type.id === 2) {
            accounts_type = "savings"
        } else if (account_activated.type.id === 3) {
            accounts_type = "investments"
        } else if (account_activated.type.id === 4) {
            accounts_type = "credits"
        } else {
            return
        }
        get_accounts_status_by_period(ini_date_first, end_date_first, accounts_type, [account_activated.id]);
        const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`
        get_history_accounts_by_month(date_filter, account_activated.id)

    }, []);

    useEffect(() => {
        let accounts_type
        if (!account_activated) {
            return
        }
        if (account_activated.type.id === 1 || account_activated.type.id === 2) {
            accounts_type = "savings"
        } else if (account_activated.type.id === 3) {
            accounts_type = "investments"
        } else if (account_activated.type.id === 4) {
            accounts_type = "credits"
        } else {
            return
        }
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
            {/* pc screen */}

            <div className="lg:flex lg:flex-row gap-6 hidden justify-center">
                {/* TOTAL SPENT AND CATEGORIE */}
                <div className="w-[380px] xl:w-[360px] flex flex-col gap-6">
                    {/* ACCOUNTSBYTYPE */}
                    {user_accounts &&
                        <AccbyTypeDash
                            onOpenDetail={handleOpenAccDetail}
                            onOpenCreate={() => setOpenCreateBox(true)}
                        />
                    }

                    <AccTransPeriod />

                </div>

                {/* STATS ACCOUNTS AND TRANS */}
                <div className="w-[400px] xl:w-[546px] flex flex-col gap-6">
                    <div className="w-screen md:w-auto">
                        {user_accounts && account_activated &&
                            <AccPeriodFilter />
                        }
                    </div>
                    {account_activated &&
                        <div className='p-4 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-xl shadow-md'>
                            <AccSummaryCard acc={account_activated} data={account_activated_stats} />
                        </div>
                    }


                    {/* ACCOUNTCHART */}

                    <div className="h-[360.5px] p-4 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-xl shadow-md">
                        <h2 className="text-md font-bold mb-2 text-gray-800 dark:text-gray-100">Saldo Historico de la cuenta</h2>
                        {account_activated && history_accounts_by_month &&
                            <AccChartHistory />
                        }
                    </div>

                </div>
            </div>


            {/* mobile screen dashboard */}
            <div className="lg:hidden">
                <div className="w-auto flex flex-col gap-2 justify-center items-center">
                    <div className="w-screen md:w-[450px]  px-2">
                        {user_accounts &&
                            <AccbyTypeDash
                                onOpenDetail={handleOpenAccDetail}
                                onOpenCreate={() => setOpenCreateBox(true)}
                            />
                        }
                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        {user_accounts && account_activated &&
                            <AccPeriodFilter />
                        }
                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        {account_activated &&
                            <div className='p-4 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-xl shadow-md'>
                                <AccSummaryCard acc={account_activated} data={account_activated_stats} />
                            </div>
                        }
                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        <div className="h-[220px] md:h-[364px] p-4 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-xl shadow-md flex flex-col items-center justify-between">
                            <h2 className="text-md font-bold mb-2 text-gray-800 dark:text-gray-100">Saldo Historico de la cuenta</h2>
                            {account_activated && history_accounts_by_month &&
                                <AccChartHistory />
                            }
                        </div>
                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        <AccTransPeriod />
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
