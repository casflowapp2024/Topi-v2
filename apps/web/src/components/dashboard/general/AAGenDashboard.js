
//react
import { connect } from 'react-redux';
import { get_user_transactions } from "../../../redux/actions/cashflow";
import { get_savings_account } from "../../../redux/actions/reports";
//react
import { useEffect, useState } from "react";
//components
import DashBalances from "./DashBalanceChart";
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
        <>
            {/* pc screen */}
            <div className="lg:flex lg:flex-col hidden justify-center">
                <div className="w-auto flex flex-row gap-6 justify-center items-center">
                    <div className="w-[460px] xl:w-[606px] h-[410px]">
                        <DashStats />
                    </div>
                    <div className="w-[320px] xl:w-[300px]">
                        <DashPlan />
                    </div>
                </div>
                <div className="h-6"></div>
                <div className="w-auto flex flex-row gap-6 justify-center items-center">
                    <div className="w-[460px] xl:w-[606px]">
                        {/* <DashBalances 
                        /> */}
                        <MultiChartDash />
                    </div>
                    <div className="w-[320px] xl:w-[300px]">
                        <DashTrans />
                    </div>
                </div>
                <div className="h-6"></div>
                <div className="w-auto">
                    <div className="w-[80x6px] xl:w-[930px] flex justify-start items-center">
                        <DashAccounts />
                    </div>
                </div>

            </div>
            {/* mobile screen */}
            <div className="lg:hidden">
                <div className="w-auto flex flex-col gap-2 justify-center items-center">
                    <div className="w-screen md:w-[450px]  px-2">
                        <DashStats />
                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        <DashPlan />

                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        <DashTrans />
                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        {/* <DashBalances 
                        /> */}
                        <MultiChartDash />
                    </div>
                    <div className="w-screen md:w-[450px]  px-2 mb-3">
                        <DashAccounts />
                    </div>
                </div>
            </div>

        </>
    )
}

const mapStateToProps = state => ({
    //default_limit: state.CashFlow.user_transactions.default_limit

})

export default connect(mapStateToProps, {
    /* get_user_transactions,
    get_savings_account */

})(AAGenDashboard)
