
import React, { useEffect, useState } from "react";

//redux
import { connect } from 'react-redux';
import { get_user_transactions } from "../../../redux/actions/cashflow";
import { get_savings_account, get_history_dash, get_history_category_by_month } from "../../../redux/actions/reports";

//components
import { parseDatetimetoDateStrFormat } from '../../helpers';
import BudDashTotalSpent from './BudDashTotalSpent';
import BudDashCategorieList from './BudDashCategorieList';
import BudDashBudgetSummary from './BudDashBudgetSummary';
import BudDashTransCategorie from './BudDashTransCategorie';
import BudDashDailySpent from "./BudDashDailySpent.js";
import CreateCategory from "../../expensePlan/CreateCategory";
import EditCategory from "../../expensePlan/EditCategory";

import { PlusIcon } from '@heroicons/react/20/solid';
import { Emoji } from "emoji-picker-react";
import { formatMoney, capitalizeWords, findElmentById } from "../../helpers";
//redux
//import {  } from "../redux/actions/cashflow";

const AABudgetDashboard = ({
    //actions
    get_user_transactions,
    get_history_dash,
    get_history_category_by_month,
    //state
    category_activated,
    current_Month,
    current_Year,

    /* get_user_transactions,
    get_savings_account,
    default_limit, */
    user_categories,
}) => {

    //create category
    const [openCreateBox, setOpenCreateBox] = useState(false)

    //Edit Open
    const [openEditCat, setOpenEditCat] = useState(false)
    const [detailInfo, setDetailInfo] = useState(null)

    const handleOpenEditCat = async (categoryId) => {
        const selectedCat = findElmentById(user_categories.items, categoryId)
        setDetailInfo(selectedCat)
        setOpenEditCat(true)
    }

    const [loadingTransactions, setLoadingTransactions] = useState(true)

    const buildTransactionParams = ({
        selectedCategories,
        iniDate,
        endDate,
    }) => {

        const params = [];
        if (selectedCategories && selectedCategories.length > 0) params.push(`categories=${selectedCategories}`);
        if (iniDate) params.push(`init_date=${iniDate}`);
        if (endDate) params.push(`end_date=${endDate}`);

        return params.join("&");
    };


    const handleGetTransactions = async () => {
        setLoadingTransactions(true)
        const filterParams = buildTransactionParams(
            {
                selectedCategories: category_activated ? [category_activated.category_id] : null,
                iniDate: parseDatetimetoDateStrFormat(new Date(current_Year, current_Month - 1, 1), "YYYY-MM-DD HH:mm:ss Z"),
                endDate: parseDatetimetoDateStrFormat(new Date(current_Year, current_Month, 0), "YYYY-MM-DD HH:mm:ss Z")
            }
        )
        const transResponse = await get_user_transactions(0, 100, filterParams, "budgetCategory")

        if (transResponse === true) {
            console.log("transResponse", transResponse);
            setLoadingTransactions(false)
        } else {
            setLoadingTransactions(false)
        }
    }

    useEffect(() => {
        handleGetTransactions()
    }, [category_activated]);


    useEffect(() => {
        const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`
        get_history_dash(date_filter);
    }, [current_Month, current_Year]);

    useEffect(() => {
        const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`
        if (category_activated?.category_id != undefined) {
            get_history_category_by_month(category_activated.category_id, date_filter);
        }
    }, [category_activated, current_Year]);


    // Chart Tab State
    const [activeChartTab, setActiveChartTab] = useState(1);

    return (
        <div className="flex flex-col w-full">
            {/*
                Una sola versión para todos los tamaños (antes había un bloque PC y otro móvil,
                y cada componente se montaba y pedía sus datos dos veces).
                En móvil las columnas usan `contents`, así sus hijos entran directo en la pila
                y `order-*` define el orden; en PC (lg) vuelven a ser columnas.
            */}
            <div className="flex flex-col gap-2 lg:flex-row lg:gap-6 px-2 lg:px-0 pb-4 md:max-w-[560px] md:mx-auto lg:max-w-none lg:w-full">
                {/* Total, resumen y lista de categorías */}
                <div className="contents lg:flex lg:flex-col lg:gap-6 lg:w-[380px] xl:w-[360px] lg:shrink-0">
                    <div className="order-1 lg:order-none">
                        <BudDashTotalSpent />
                    </div>
                    <div className="order-2 lg:order-none">
                        <BudDashBudgetSummary
                            setOpenCreateBox={setOpenCreateBox}
                        />
                    </div>
                    <div className="order-3 lg:order-none">
                        <BudDashCategorieList
                            handleOpenEditCat={handleOpenEditCat}
                            setOpenCreateBox={setOpenCreateBox}
                            onCategoryClick={() => setActiveChartTab(2)}
                        />
                    </div>
                </div>
                {/* Gráfica y movimientos de la categoría */}
                <div className="contents lg:flex lg:flex-col lg:gap-6 lg:flex-1 lg:min-w-0">
                    <div className="order-5 lg:order-none">
                        <BudDashDailySpent
                            activeChartTab={activeChartTab}
                            setActiveChartTab={setActiveChartTab}
                        />
                    </div>
                    <div className="order-4 lg:order-none">
                        <BudDashTransCategorie />
                    </div>
                </div>
            </div>
            {/*Modal Create category*/}
            <CreateCategory
                openCreateBox={openCreateBox}
                setOpenCreateBox={setOpenCreateBox}
            />

            {/*Modal Edit category*/}
            {detailInfo &&
                <EditCategory
                    openEditCat={openEditCat}
                    setOpenEditCat={setOpenEditCat}
                    detailInfo={detailInfo}
                    setDetailInfo={setDetailInfo}
                />
            }

        </div>
    )
}

const mapStateToProps = state => ({
    category_activated: state.Reports.category_activated,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    user_categories: state.CashFlow.user_categories,
    //default_limit: state.CashFlow.user_transactions.default_limit

})

export default connect(mapStateToProps, {
    get_user_transactions,
    get_history_dash,
    get_history_category_by_month
    /* get_user_transactions,
    get_savings_account */

})(AABudgetDashboard)
