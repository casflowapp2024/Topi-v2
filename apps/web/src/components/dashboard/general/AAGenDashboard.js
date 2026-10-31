//redux
import { connect } from 'react-redux';
import { get_financial_report } from "../../../redux/actions/reports";
//react
import { useEffect, useState } from "react";
//components
import DashAccounts from "./DashAccounts";
import DashPlan from "./DashPlan";
import MultiChartDash from './MultiChartDash';
import HomePaceCard from './HomePaceCard';
import HomeFlowCard from './HomeFlowCard';
import HomeNetWorthCard from './HomeNetWorthCard';
import ReviewInbox from './ReviewInbox';
import PeriodSelector from '../../navigation/PeriodSelector';

const AAGenDashboard = ({
    current_Month,
    current_Year,
    get_financial_report,
}) => {

    // Mientras llega el mes nuevo se mantienen las cifras anteriores atenuadas
    const [loadingReport, setLoadingReport] = useState(true);
    useEffect(() => {
        let active = true;
        setLoadingReport(true);
        Promise.resolve(get_financial_report(current_Month, current_Year))
            .finally(() => { if (active) setLoadingReport(false); });
        return () => { active = false; };
    }, [current_Month, current_Year, get_financial_report]);

    return (
        <div className="flex flex-col gap-2 lg:gap-6 px-2 lg:px-0 pb-3 md:max-w-[560px] md:mx-auto lg:max-w-none">
            {/*
                Una sola versión para todos los tamaños (antes había un bloque PC y otro móvil,
                y cada componente se montaba y pedía sus datos dos veces).
                En móvil las filas y columnas usan `contents`, así sus hijos entran directo en la pila
                y `order-*` define el orden; en PC (lg) vuelven a ser filas y columnas.
            */}
            {/* En móvil el periodo vive en la barra superior */}
            <div className="hidden lg:flex items-center justify-between gap-2">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Inicio</h1>
                <PeriodSelector />
            </div>
            <div className="contents lg:grid lg:grid-cols-3 lg:gap-6">
                <div className="order-1 lg:order-none min-w-0">
                    <HomePaceCard loading={loadingReport} />
                </div>
                <div className="order-2 lg:order-none min-w-0">
                    <HomeFlowCard loading={loadingReport} />
                </div>
                <div className="order-3 lg:order-none min-w-0">
                    <HomeNetWorthCard />
                </div>
            </div>
            <div className="contents lg:flex lg:flex-row lg:gap-6">
                <div className="order-6 lg:order-none lg:flex-1 lg:min-w-0">
                    <MultiChartDash />
                </div>
                <div className="contents lg:flex lg:flex-col lg:gap-6 lg:w-[320px] xl:w-[300px] lg:shrink-0">
                    <div className="order-4 lg:order-none">
                        <ReviewInbox />
                    </div>
                    <div className="order-5 lg:order-none">
                        <DashPlan />
                    </div>
                </div>
            </div>
            <div className="order-7 lg:order-none">
                <DashAccounts />
            </div>
        </div>
    )
}

const mapStateToProps = state => ({
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
})

export default connect(mapStateToProps, {
    get_financial_report,
})(AAGenDashboard)
