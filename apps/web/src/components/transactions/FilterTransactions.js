import { useEffect, useState, useRef } from 'react'
import moment from 'moment';
//redux
import { connect } from 'react-redux'
import { get_user_transactions, change_transactions_filter } from '../../redux/actions/cashflow';

//components
import { formatDate } from '../helpers';
import DatePicker from 'react-datepicker';
//icons
import {
    ChevronRightIcon

} from '@heroicons/react/24/outline'

/* This example requires Tailwind CSS v2.0+ */



function FilterTransactions({
    openFilterPopUp,
    SetOpenFilterPopUp,
    setCurrentFrontendPage,
    setOneFilterActivated,
    user_categories,
    user_accounts,
    get_user_transactions,
    change_transactions_filter, trans_filters_activated,
    default_limit

}) {


    //close Filter pop up
    const filterPopupRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click was on the filter button or inside the popup
            const isFilterButton = event.target.closest('button[onClick*="handleOpenFilterPopUp"]');
            const isInsidePopup = filterPopupRef.current && filterPopupRef.current.contains(event.target);

            if (!isFilterButton && !isInsidePopup) {
                event.stopPropagation();
                SetOpenFilterPopUp(false);
            }
        };

        if (openFilterPopUp) {
            document.addEventListener('mousedown', handleClickOutside, true); // Use capture phase
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [openFilterPopUp, SetOpenFilterPopUp]);

    //toggle filter tab
    const [toggle, setToggle] = useState(1)
    function updateToggle(id) {
        setToggle(id)
    }
    const activatedStyleGen = {
        borderRight: '4px solid #6366F1', // This corresponds to border-indigo-500
        color: '#6366F1',
    };

    ////////////////////////////FILTERS//////////////////////////////777

    //initializacion filters
    const [selectedCategories, setSelectedCategories] = useState(trans_filters_activated.categorie_ids);
    const [selectedAccounts, setSelectedAccounts] = useState(trans_filters_activated.accounts_ids);
    const [iniDate, setIniDate] = useState(trans_filters_activated.iniDate);
    const [endDate, setEndDate] = useState(trans_filters_activated.endDate);
    const [keyword, setKeyword] = useState(trans_filters_activated.keyword);
    const [expenseFilter, setExpenseFilter] = useState(trans_filters_activated.expence);
    const [automated, setAutomated] = useState(trans_filters_activated.automated);
    const [shouldVerify, setShouldVerify] = useState(trans_filters_activated.shouldVerify);
    const [orderByFilter, setOrderByFilter] = useState(trans_filters_activated.sortby);

    const [filterChanged, setFilterChanged] = useState(false)


    //->categories
    const handleCategoryChange = (id) => {
        const idStr = id.toString();
        if (selectedCategories.includes(idStr)) {
            setSelectedCategories(selectedCategories.filter(c => c !== idStr));
        } else {
            setSelectedCategories([...selectedCategories, idStr]);
        }
        setFilterChanged(!filterChanged)
    };

    //->cuentas
    const handleAccountChange = (accountID) => {
        const idStr = accountID.toString();
        if (selectedAccounts.includes(idStr)) {
            setSelectedAccounts(selectedAccounts.filter(c => c !== idStr));
        } else {
            setSelectedAccounts([...selectedAccounts, idStr]);
        }
        setFilterChanged(!filterChanged)
    };


    //-->Fechas
    const handleChangeInidate = (date) => {
        setIniDate(formatDate(date))
        setFilterChanged(!filterChanged)

    };
    const handleChangeEndDate = (date) => {
        setEndDate(formatDate(date))
        setFilterChanged(!filterChanged)
    };


    //keyword
    const onChangekey = (e) => {
        setKeyword(e.target.value);
        setFilterChanged(!filterChanged)
    };

    //expense-income
    const [expense, setExpense] = useState(false);
    const [income, setIncome] = useState(false);
    const handleExpenseChange = (e) => {

        if (e.target.name === "expense") {
            setExpense(e.target.checked);
        }
        if (e.target.name === "income") {
            setIncome(e.target.checked);
        }
    };

    useEffect(() => {
        if (expense === income) {
            setExpenseFilter("")
        } else if (expense === true) {
            setExpenseFilter(true)
        } else {
            setExpenseFilter(false)
        }
        setFilterChanged(!filterChanged)
    }, [expense, income])

    //lectura automatizada
    const handleAutomatedChange = (e) => {
        if (e.target.checked === true) {
            setAutomated(e.target.checked);
        } else {
            setAutomated("");
        }
        setFilterChanged(!filterChanged)
    }
    //should verify
    const handleShouldVerifyChange = (e) => {
        if (e.target.checked === true) {
            setShouldVerify(e.target.checked);
        } else {
            setShouldVerify("");
        }
        setFilterChanged(!filterChanged)
    }

    //orderby

    const orderMaping = {
        "Categoria": "category",
        "Cuenta": "account",
        "Gastos": "expense",
        "Monto": "amount",
        "Fecha": "date",
        "Automatizado": "automated"
    };


    const [optionSelected, setOptionSelected] = useState("Fecha");

    useEffect(() => {
        const selected = orderMaping[optionSelected] || 'date';
        setOrderByFilter(selected)
    }, [optionSelected]);


    //retrieve items filtered

    const handleApplyFilters = async () => {

        const filters_done = await change_transactions_filter(
            {
                selectedCategories,
                selectedAccounts,
                iniDate,
                endDate,
                keyword,
                expenseFilter,
                orderByFilter,
                automated,
                shouldVerify
            }
        )
        if (filters_done) {
            const transResponse = await get_user_transactions(
                0, default_limit, filters_done
            )
            setCurrentFrontendPage(1)
        }
    }

    useEffect(() => {
        if (
            trans_filters_activated &&
            trans_filters_activated.categorie_ids !== undefined &&
            trans_filters_activated.accounts_ids !== undefined &&
            trans_filters_activated.iniDate !== undefined &&
            trans_filters_activated.endDate !== undefined &&
            trans_filters_activated.keyword !== undefined &&
            trans_filters_activated.expence !== undefined &&
            trans_filters_activated.automated !== undefined &&
            trans_filters_activated.shouldVerify !== undefined &&
            trans_filters_activated.sortby !== undefined
            // add other checks as needed
        ) {

            handleApplyFilters();
            if ((trans_filters_activated.categorie_ids.length > 0) || (trans_filters_activated.accounts_ids.length > 0) || (trans_filters_activated.iniDate) || (trans_filters_activated.endDate) || (trans_filters_activated.keyword) || (trans_filters_activated.expence) || (trans_filters_activated.automated) || (trans_filters_activated.shouldVerify)) {
                console.log("seting one filter activated1")
                setOneFilterActivated(true)
            } else {
                console.log("seting one filter activated2", trans_filters_activated.categorie_ids.length)
                setOneFilterActivated(false)
            }
        }
    }, [filterChanged]);

    //onfilter activated

    useEffect(() => {
        if (
            trans_filters_activated &&
            trans_filters_activated.categorie_ids !== undefined &&
            trans_filters_activated.accounts_ids !== undefined &&
            trans_filters_activated.iniDate !== undefined &&
            trans_filters_activated.endDate !== undefined &&
            trans_filters_activated.keyword !== undefined &&
            trans_filters_activated.expence !== undefined &&
            trans_filters_activated.automated !== undefined &&
            trans_filters_activated.shouldVerify !== undefined &&
            trans_filters_activated.sortby !== undefined
        ) {
            if ((trans_filters_activated.categorie_ids.length > 0) || (trans_filters_activated.accounts_ids.length > 0) || (trans_filters_activated.iniDate) || (trans_filters_activated.endDate) || (trans_filters_activated.keyword) || (trans_filters_activated.expence) || (trans_filters_activated.automated) || (trans_filters_activated.shouldVerify)) {
                //console.log("seting one filter activated1")
                console.log("seting date filter", trans_filters_activated.iniDate)
                setOneFilterActivated(true)
            } else {
                //console.log("seting one filter activated2", trans_filters_activated.categorie_ids.length)
                setOneFilterActivated(false)
            }
        }
    }, [trans_filters_activated]);


    //quitar filtros


    const handleQuitarFitlros = async () => {

        setSelectedCategories("")
        setSelectedAccounts("")
        setIniDate("")
        setEndDate("")
        setKeyword("")
        setExpense(false)
        setIncome(false)
        setExpenseFilter("")
        setOrderByFilter("date")
        setAutomated(false)
        setShouldVerify(false)

        const filters_done = await change_transactions_filter({
            selectedCategories: "",
            selectedAccounts: "",
            iniDate: "",
            endDate: "",
            keyword: "",
            expenseFilter: "",
            orderByFilter: "date",
            automated: "",
            shouldVerify: ""
        })
        if (filters_done) {
            const transResponse = await get_user_transactions(
                0,
                default_limit
            )
        }

    }

    return (

        <div className="absolute top-full -right-3 md:right-0 flex justify-end">
            {openFilterPopUp && trans_filters_activated && (
                <div className="mt-1 w-[350px] md:w-[410px] h-[332px] text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40 transition-colors duration-200"
                    ref={filterPopupRef}
                >
                    <div className="flex flex-row h-[294px] border-b border-[#5266EB] dark:border-[#5266EB]/50">
                        {/*filter left*/}
                        <div className="w-40 md:w-52 border-r border-[#5266EB] dark:border-[#5266EB]/50">
                            <ul className="py-8 flex flex-col gap-1 justify-start md:text-base text-xs">
                                <button
                                    onClick={() => updateToggle(1)}
                                    style={toggle === 1 ? activatedStyleGen : null}
                                    className={`${toggle === 1 ? 'active' : ''} relative flex flex-row items-center justify-between h-11 focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border-r-4 border-transparent hover:border-indigo-500 transition-colors`}>
                                    <span className="ml-4 tracking-wide truncate">Categorias</span>
                                    <ChevronRightIcon className='w-4 h-4 mr-1' />
                                </button>
                                <button
                                    onClick={() => updateToggle(2)}
                                    style={toggle === 2 ? activatedStyleGen : null}
                                    className={`${toggle === 2 ? 'active' : ''} relative flex flex-row items-center justify-between h-11 focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border-r-4 border-transparent hover:border-indigo-500 transition-colors`}>
                                    <span className="ml-4 tracking-wide truncate">Cuentas</span>
                                    <ChevronRightIcon className='w-4 h-4 mr-1' />
                                </button>
                                <button
                                    onClick={() => updateToggle(3)}
                                    style={toggle === 3 ? activatedStyleGen : null}
                                    className={`${toggle === 3 ? 'active' : ''} relative flex flex-row items-center justify-between h-11 focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border-r-4 border-transparent hover:border-indigo-500 transition-colors`}>
                                    <span className="ml-4 tracking-wide truncate">Periodo</span>
                                    <ChevronRightIcon className='w-4 h-4 mr-1' />
                                </button>
                                <button
                                    onClick={() => updateToggle(4)}
                                    style={toggle === 4 ? activatedStyleGen : null}
                                    className={`${toggle === 4 ? 'active' : ''} relative flex flex-row items-center justify-between h-11 focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border-r-4 border-transparent hover:border-indigo-500 transition-colors`}>
                                    <span className="ml-4 tracking-wide truncate">Descripción</span>
                                    <ChevronRightIcon className='w-4 h-4 mr-1' />
                                </button>
                                <button
                                    onClick={() => updateToggle(5)}
                                    style={toggle === 5 ? activatedStyleGen : null}
                                    className={`${toggle === 5 ? 'active' : ''} relative flex flex-row items-center justify-between h-11 focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border-r-4 border-transparent hover:border-indigo-500 transition-colors`}>
                                    <span className="ml-4 tracking-wide truncate">Lectura Automática</span>
                                    <ChevronRightIcon className='w-4 h-4 mr-1' />
                                </button>


                            </ul>
                        </div>

                        {/*filter right*/}
                        <div className="w-[200px] overflow-auto">
                            {/*Tab de categorias*/}
                            <div className={toggle === 1 ? "block" : "hidden"}>
                                <ul className="w-full text-sm font-medium text-gray-900 bg-white dark:bg-gray-800 dark:text-white">
                                    {user_categories.items && user_categories.items.filter(category => !category.isDefault).map((category) => (
                                        <li
                                            key={category.id}
                                            className="w-full border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <div className="flex items-center ps-3">

                                                <input
                                                    id={`checkbox-${category.id}`}
                                                    type="checkbox"
                                                    value={category.id}
                                                    className="w-4 h-4 text-[#5266EB] bg-gray-100 border-gray-300 rounded focus:ring-[#5266EB] dark:focus:ring-indigo-600 dark:bg-gray-700 dark:border-gray-600"
                                                    onChange={() => handleCategoryChange(category.id)}
                                                    checked={selectedCategories.includes(category.id.toString())}
                                                />

                                                <label
                                                    htmlFor={`checkbox-${category.id}`}
                                                    className="w-full py-3 ms-2 text-xs font-medium text-gray-900 dark:text-gray-300 cursor-pointer">
                                                    {category.name}
                                                </label>
                                            </div>
                                        </li>
                                    ))
                                    }
                                </ul>
                            </div>
                            {/*Tab de cuentas*/}
                            <div className={toggle === 2 ? "block" : "hidden"}>
                                <ul className="w-full text-sm font-medium text-gray-900 bg-white dark:bg-gray-800 dark:text-white">
                                    {user_accounts.items && user_accounts.items.map((account) => (
                                        <li
                                            key={account.id}
                                            className="w-full border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <div className="flex items-center ps-3">

                                                <input
                                                    id={`checkbox-${account.id}`}
                                                    type="checkbox"
                                                    value={account.id}
                                                    className="w-4 h-4 text-[#5266EB] bg-gray-100 border-gray-300 rounded focus:ring-[#5266EB] dark:focus:ring-indigo-600 dark:bg-gray-700 dark:border-gray-600"
                                                    onChange={() => handleAccountChange(account.id)}
                                                    checked={selectedAccounts.includes(account.id.toString())}
                                                />

                                                <label
                                                    htmlFor={`checkbox-${account.id}`}
                                                    className="w-full py-3 ms-2 text-xs font-medium text-gray-900 dark:text-gray-300 cursor-pointer">
                                                    {account.name} - {account.last_four_digits}
                                                </label>
                                            </div>
                                        </li>
                                    ))
                                    }
                                </ul>
                            </div>
                            {/*Tab de fechas*/}
                            <div className={toggle === 3 ? "block" : "hidden"}>
                                <div className='flex flex-col justify-start pt-2 items-center text-xs'>

                                    <div className='pt-4 text-gray-800 dark:text-gray-200'>Fecha Inicial:</div>
                                    <div className='w-[180px] p-1 mt-2 border border-[#5266EB] dark:border-[#5266EB]/60 rounded-md bg-white dark:bg-gray-800'>
                                        <DatePicker
                                            selected={iniDate ? moment(iniDate).toDate() : null}
                                            onChange={(date) => {
                                                // Create a new date object and set it to noon to avoid timezone issues
                                                const newDate = new Date(date);
                                                newDate.setHours(12, 0, 0, 0);
                                                handleChangeInidate(newDate);
                                            }}
                                            /* {(date) => {
                                                if (!date) return;
                                            const newDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                            handleChangeInidate(newDate); // Store as Date object
                                            }} */

                                            dateFormat="dd-MM-YYYY"
                                            selectsStart
                                            date={iniDate}

                                            className='text-center w-full bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none'
                                        />
                                    </div>

                                    <div className='pt-4 text-gray-800 dark:text-gray-200'>Fecha Final:</div>
                                    <div className='w-[180px] p-1 mt-2 border border-[#5266EB] dark:border-[#5266EB]/60 rounded-md bg-white dark:bg-gray-800'>
                                        <DatePicker
                                            selected={endDate ? moment(endDate).toDate() : null}
                                            onChange={(date) => {
                                                // Create a new date object and set it to noon to avoid timezone issues
                                                const newDate = new Date(date);
                                                newDate.setHours(12, 0, 0, 0);
                                                handleChangeEndDate(newDate);
                                            }}
                                            dateFormat="dd-MM-yyyy"
                                            selectsEnd
                                            date={endDate}
                                            className='text-center w-full bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none'
                                        />
                                    </div>
                                </div>
                            </div>
                            {/*Tab de Palabra clave*/}
                            <div className={toggle === 4 ? "block" : "hidden"}>
                                <div className='w-full flex flex-col justify-start pt-2 items-center text-xs'>

                                    <div className='pt-16 text-gray-800 dark:text-gray-200'>Palabra Clave:</div>
                                    <input type="text" name="keyword" id="keyword"
                                        value={keyword}
                                        onChange={e => onChangekey(e)}
                                        className="mt-2 p-1 border-[#5266EB] dark:border-[#5266EB]/60 h-6 border w-3/5 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5266EB]"
                                    />

                                </div>
                            </div>
                            {/*lectura automatizada*/}
                            <div className={toggle === 5 ? "block" : "hidden"}>
                                <div className='w-[90%] flex flex-col justify-start pt-2 items-center text-xs'>

                                    <div className='pt-16 text-center text-gray-800 dark:text-gray-200'>Solo trasacciones para verificar:</div>
                                    <input type="checkbox" name="shouldVerify" id="shouldVerify"
                                        value={shouldVerify}
                                        onChange={e => handleShouldVerifyChange(e)}
                                        className="mt-2 p-1 border-[#5266EB] h-4 border w-3/5 rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-500"
                                    />
                                    <div className='pt-4 text-center text-gray-800 dark:text-gray-200'>Solo trasacciones automatizadas:</div>
                                    <input type="checkbox" name="automated" id="automated"
                                        value={automated}
                                        onChange={e => handleAutomatedChange(e)}
                                        className="mt-2 p-1 border-[#5266EB] h-4 border w-3/5 rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-500"
                                    />

                                </div>
                            </div>

                        </div>
                    </div>
                    <div className='flex flex-col text-sm bg-white dark:bg-gray-800'>

                        <ul className='flex flex-row justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-b-lg'>
                            <li
                                className="w-1/3 flex-1 h-full flex items-center justify-center">
                                <div className="flex items-center ps-3">
                                    <input
                                        id="expense"
                                        type="checkbox"
                                        name="expense"
                                        value={expense}
                                        className="w-4 h-4 text-[#5266EB] bg-gray-100 border-gray-300 rounded focus:ring-[#5266EB] dark:focus:ring-indigo-600 dark:bg-gray-700 dark:border-gray-600"
                                        checked={expense}
                                        onChange={e => handleExpenseChange(e)}
                                    />

                                    <label
                                        htmlFor="expense"
                                        className="w-full py-3 ms-2 text-xs font-medium text-gray-900 dark:text-gray-300 cursor-pointer">
                                        Solo Gastos
                                    </label>
                                </div>
                            </li>
                            <li
                                className="w-1/3 flex-1 h-full flex items-center justify-center">
                                <div className="flex items-center ps-3">
                                    <input
                                        id="income"
                                        type="checkbox"
                                        name="income"
                                        value={income}
                                        className="w-4 h-4 text-[#5266EB] bg-gray-100 border-gray-300 rounded focus:ring-[#5266EB] dark:focus:ring-indigo-600 dark:bg-gray-700 dark:border-gray-600"
                                        checked={income}
                                        onChange={e => handleExpenseChange(e)}
                                    />

                                    <label
                                        htmlFor="income"
                                        className="w-full py-3 ms-2 text-xs font-medium text-gray-900 dark:text-gray-300 cursor-pointer">
                                        Solo Ingresos
                                    </label>
                                </div>
                            </li>
                            <div className='p-1 border-l border-gray-200 dark:border-gray-700 h-full flex items-center justify-center px-2'>
                                <button
                                    onClick={handleQuitarFitlros}
                                    className='p-1.5 px-2 bg-[#5266EB] text-white rounded-md hover:bg-indigo-600 transition-colors text-xs font-medium whitespace-nowrap shadow-sm'>
                                    Quitar filtros
                                </button>
                            </div>
                        </ul>
                    </div>


                </div>
            )}
        </div>

    )
}


const mapStateToProps = state => ({
    user_categories: state.CashFlow.user_categories,
    user_accounts: state.CashFlow.user_accounts,
    trans_filters_activated: state.CashFlow.trans_filters_activated,
    default_limit: state.CashFlow.user_transactions.default_limit

})

export default connect(mapStateToProps, {
    get_user_transactions,
    change_transactions_filter


})(FilterTransactions)