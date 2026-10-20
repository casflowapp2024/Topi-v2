
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
import { formatCurrency, capitalizeWords, findElmentById } from "../../helpers";
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
            {/* pc screen */}

            <div className="lg:flex lg:flex-row gap-6 hidden justify-center">
                {/* TOTAL SPENT AND CATEGORIE */}
                <div className="w-[380px] xl:w-[360px] flex flex-col gap-6">
                    {/* TOTAL SPENT CARD */}
                    <BudDashTotalSpent />
                    {/* BUDGET SUMMARY */}
                    <BudDashBudgetSummary
                        setOpenCreateBox={setOpenCreateBox}
                    />

                    {/* CATEGORIES LIST */}
                    <BudDashCategorieList
                        handleOpenEditCat={handleOpenEditCat}
                        setOpenCreateBox={setOpenCreateBox}
                        onCategoryClick={() => setActiveChartTab(2)}
                    />
                </div>

                {/* DETAILED SPENT PER CATEGORIE */}
                <div className="w-[400px] xl:w-[546px] flex flex-col gap-6">
                    <BudDashDailySpent
                        activeChartTab={activeChartTab}
                        setActiveChartTab={setActiveChartTab}
                    />
                    <BudDashTransCategorie />
                </div>
            </div>




            {/* mobile screen dashboard */}
            <div className="lg:hidden mb-4">
                <div className="w-auto flex flex-col gap-2 justify-center items-center">
                    <div className="w-screen md:w-[450px]  px-2">
                        <BudDashTotalSpent />
                    </div>
                    <div className="w-screen md:w-[450px] px-2">
                        <BudDashBudgetSummary
                            setOpenCreateBox={setOpenCreateBox}
                        />
                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        <BudDashCategorieList
                            handleOpenEditCat={handleOpenEditCat}
                            setOpenCreateBox={setOpenCreateBox}
                            onCategoryClick={() => setActiveChartTab(2)}
                        />
                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        <BudDashTransCategorie />
                    </div>
                    <div className="w-screen md:w-[450px]  px-2">
                        <BudDashDailySpent
                            activeChartTab={activeChartTab}
                            setActiveChartTab={setActiveChartTab}
                        />
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
