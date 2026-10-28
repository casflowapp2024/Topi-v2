import { Fragment, useEffect, useState, useRef } from 'react';

//redux
import { connect } from 'react-redux';
import { get_financial_report } from '../../../redux/actions/reports';
import { get_savings_account } from '../../../redux/actions/reports';
//components
import DropDownAccount from './DropDownAccounts';
import { formatMoney, getPerc2 } from '../../helpers';
import FormatMoneyShowDecs from '../../FormatMoneyShowDecs';
import DashStatsCard from './DashStatsCard';
import PeriodSelector from '../../navigation/PeriodSelector';
import {
    ArrowDownRightIcon,
    ArrowUpRightIcon,
    ShoppingBagIcon,
    WalletIcon,
    SparklesIcon,
    BanknotesIcon,
    CreditCardIcon
} from '@heroicons/react/24/solid';

import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

import { ThreeDots } from 'react-loader-spinner';

const DashStats = ({
    current_Month,
    current_Year,
    savings_balance,
    income,
    expenses,
    credits_balance,
    user_accounts,
    get_financial_report,
    get_savings_account, balance_by_account

}) => {


    const [loadingReport, setLoadingReport] = useState(true);


    const get_financial_report_confirm = async (current_Month, current_Year) => {
        setLoadingReport(true);
        const success = await get_financial_report(current_Month, current_Year);
        if (success === true) {
            setLoadingReport(false);
        }
    };

    // Handle account selection updates
    useEffect(() => {
        if (current_Month && current_Year) {
            get_financial_report_confirm(current_Month, current_Year)
        }
    }, [current_Month, current_Year]);


    return (

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-md h-full transition-colors duration-300">
            <div className='flex flex-col gap-4 h-full'>
                <div className='flex flex-row justify-between items-center text-gray-900 dark:text-gray-100'>
                    <div className=' font-medium'>
                        Resumen
                    </div>
                    {/* En móvil el periodo vive en la barra superior */}
                    <PeriodSelector className="hidden lg:flex" />

                </div>

                <div className=" flex flex-row gap-4">

                    <DashStatsCard
                        loadingReport={loadingReport}
                        metric_id={0}
                        metric_state={savings_balance}
                        up_pos={true}
                        down_pos={false}
                    />

                    <DashStatsCard
                        loadingReport={loadingReport}
                        metric_id={1}
                        metric_state={credits_balance}
                        up_pos={false}
                        down_pos={true}
                    />

                </div>

                <div className=" flex flex-row gap-4">

                    <DashStatsCard
                        loadingReport={loadingReport}
                        metric_id={2}
                        metric_state={income}
                        up_pos={true}
                        down_pos={false}
                    />

                    <DashStatsCard
                        loadingReport={loadingReport}
                        metric_id={3}
                        metric_state={expenses}
                        up_pos={false}
                        down_pos={true}
                    />

                </div>


            </div>

        </div>
    );
};

const mapStateToProps = (state) => ({
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    savings_balance: state.Reports.savings_balance,
    income: state.Reports.income,
    expenses: state.Reports.expenses,
    credits_balance: state.Reports.credits_balance,
    user_accounts: state.CashFlow.user_accounts,
    account_in_dash: state.Reports.account_in_dash,
    balance_by_account: state.Reports.balance_by_account,

});

export default connect(mapStateToProps, {
    get_financial_report,
    get_savings_account

})(DashStats)


