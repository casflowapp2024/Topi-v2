
//react
import { connect } from 'react-redux';
import { get_user_transactions } from "../../../redux/actions/cashflow";
import { get_savings_account } from "../../../redux/actions/reports";
//react
import { useEffect, useState } from "react";
//components
import DashAccounts from "./DashAccounts";
import DashTrans from "./DashTrans";
import DashStats from "./DashStats";
import DashPlan from "./DashPlan";
import MultiChartDash from './MultiChartDash';
//redux
//import {  } from "../redux/actions/cashflow";

const AAGenDashboard = ({
    /* get_user_transactions,
    get_savings_account,
    default_limit, */
}) => {

    /* const [periodData, setPeriodData] = useState({});
    useEffect(() => {
        window.scrollTo(0, 0);
        get_user_transactions(0,default_limit,null,"dash")
        get_savings_account();

    }, []);  */


    return (
        <div className="flex flex-col gap-2 lg:gap-6 px-2 lg:px-0 pb-3 md:max-w-[560px] md:mx-auto lg:max-w-none">
            {/*
                Una sola versión para todos los tamaños (antes había un bloque PC y otro móvil,
                y cada componente se montaba y pedía sus datos dos veces).
                En móvil las columnas usan `contents`, así sus hijos entran directo en la pila
                y `order-*` define el orden; en PC (lg) vuelven a ser columnas.
            */}
            <div className="contents lg:flex lg:flex-row lg:gap-6">
                <div className="contents lg:flex lg:flex-col lg:gap-6 lg:flex-1 lg:min-w-0">
                    <div className="order-1 lg:order-none lg:h-[410px]">
                        <DashStats />
                    </div>
                    <div className="order-4 lg:order-none">
                        <MultiChartDash />
                    </div>
                </div>
                <div className="contents lg:flex lg:flex-col lg:gap-6 lg:w-[320px] xl:w-[300px] lg:shrink-0">
                    <div className="order-2 lg:order-none">
                        <DashPlan />
                    </div>
                    <div className="order-3 lg:order-none">
                        <DashTrans />
                    </div>
                </div>
            </div>
            <div className="order-5 lg:order-none">
                <DashAccounts />
            </div>
        </div>
    )
}

const mapStateToProps = state => ({
    //default_limit: state.CashFlow.user_transactions.default_limit

})

export default connect(mapStateToProps, {
    /* get_user_transactions,
    get_savings_account */

})(AAGenDashboard)
