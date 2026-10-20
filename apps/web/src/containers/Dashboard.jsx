
//redux
import { connect } from 'react-redux';
import { get_user_transactions } from "../redux/actions/cashflow";
import { get_savings_account, get_history_dash } from "../redux/actions/reports";
import { logout } from "../redux/actions/auth";

//react
import { useEffect, useState } from "react";
import { useLocation, Navigate, Outlet, useNavigate } from 'react-router-dom';
import Layout from "../hocs/Layout"

const Dashboard = ({
    get_user_transactions,
    get_savings_account,
    default_limit,
    get_history_dash,
    //states
    history_dash,
    current_Month,
    current_Year,
    user,
    logout
}) => {

    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
        get_user_transactions(0, default_limit, null, "dash")
        get_savings_account();

    }, []);

    const location = useLocation();

    useEffect(() => {
        const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`
        get_history_dash(date_filter);
    }, [current_Month, current_Year]);

    if (location.pathname === '/dashboard/') {
        return <Navigate to="/dashboard" replace />;
    }


    return (
        <Layout>
            <div>
                <Outlet />
            </div>
        </Layout>
    )
}

const mapStateToProps = state => ({
    default_limit: state.CashFlow.user_transactions.default_limit,
    history_dash: state.Reports.history_dash,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    user: state.Auth.user
})

export default connect(mapStateToProps, {
    get_user_transactions,
    get_savings_account,
    get_history_dash,
    logout
})(Dashboard)
