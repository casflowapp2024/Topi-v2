import {
    GET_FINANCIAL_REPORT_SUCCESS,
    GET_FINANCIAL_REPORT_FAIL,
    GET_BALANCE_HISTORY_SUCCESS,
    GET_BALANCE_HISTORY_FAIL,
    GET_EXPENSES_REPORT_SUCCESS,
    GET_EXPENSES_REPORT_FAIL,
    GET_SAVINGS_ACCOUNTS_SUCCESS,
    GET_SAVINGS_ACCOUNTS_FAIL,
    SET_ANOTHER_MONTH,
    SET_ANOTHER_YEAR,
    SET_HISTORY_DASH_SUCCESS,
    SET_HISTORY_DASH_FAIL,
    SET_DASH_CATEGORY_ACTIVATED,
    GET_CATEGORY_TRANSACTIONS,
    GET_CATEGORY_TRANSACTIONS_FAIL,
    GET_HISTORY_CATEGORY_BY_MONTH_SUCCESS,
    GET_HISTORY_CATEGORY_BY_MONTH_FAIL,
    SET_DASH_ACCOUNT_ACTIVATED,
    GET_ACCOUNT_STATUS_PERIOD_SUCCESS,
    GET_ACCOUNT_STATUS_PERIOD_FAIL,
    SET_INIDATE_ACCOUNT_ACTIVATED,
    SET_ENDDATE_ACCOUNT_ACTIVATED,
    GET_ACCOUNTS_TRANSACTIONS_SUCCESS,
    GET_ACCOUNTS_TRANSACTIONS_FAIL,
    GET_HISTORY_ACCOUNTS_BY_MONTH_SUCCESS,
    GET_HISTORY_ACCOUNTS_BY_MONTH_FAIL,
    SET_ACTIVE_REPORT_TAB,
    OPEN_SETTINGS_MODAL,
    CLOSE_SETTINGS_MODAL

} from '../actions/types';

const initialState = {
    savings_balance: null,
    income: null,
    expenses: null,
    credits_balance: null,
    history_balance: {
        history: null,
        past_history: null,
        updated_at: null

    },
    expenses_report: null,
    income_report: null,
    expenses_report_full: null,
    income_report_full: null,
    active_report_tab: 'Expenses',
    balance_by_account: null,
    history_dash: null,
    current_Month: (new Date().getMonth() + 1),
    current_Year: new Date().getFullYear(),
    category_activated: null,
    history_category: null,
    transactions_category_activated: null,
    account_activated: null,
    account_activated_stats: null,
    iniDate_account_dash: null,
    endDate_account_dash: null,
    transactions_accounts_activated: null,
    history_accounts_by_month: null
};

export default function Reports(state = initialState, action) {
    const { type, payload } = action;

    switch (type) {
        case SET_HISTORY_DASH_SUCCESS:
            return {
                ...state,
                history_dash: payload?.data ?? null
            }
        case SET_HISTORY_DASH_FAIL:
            return {
                ...state,
                history_dash: null
            }
        case GET_FINANCIAL_REPORT_SUCCESS:
            return {
                ...state,
                savings_balance: payload?.data?.savings_balance ?? null,
                income: payload?.data?.income ?? null,
                expenses: payload?.data?.expenses ?? null,
                credits_balance: payload?.data?.credits_balance ?? null
            }
        case GET_FINANCIAL_REPORT_FAIL:
            return {
                ...state,
                savings_balance: null,
                income: null,
                expenses: null,
                credits_balance: null
            }
        case GET_BALANCE_HISTORY_SUCCESS:
            return {
                ...state,
                history_balance: {
                    ...state.history_balance, // Spread the existing user_transactions object
                    history: payload?.data?.history ?? null,
                    past_history: payload?.data?.past_history ?? null,
                    //updated_at: payload.data.updated_at
                }
            }

        case GET_BALANCE_HISTORY_FAIL:
            return {
                ...state,
                history_balance: {
                    ...state.history_balance, // Spread the existing user_transactions object
                    history: null,
                    past_history: null,
                    updated_at: null
                }
            }
        case GET_EXPENSES_REPORT_SUCCESS:
            const expensesFull = payload?.data?.expense ?? null;
            const incomeFull = payload?.data?.income ?? null;
            return {
                ...state,
                expenses_report: expensesFull?.report ?? null,
                income_report: incomeFull?.report ?? null,
                expenses_report_full: expensesFull,
                income_report_full: incomeFull,
                // Ninguna categoría elegida por defecto: la elige el usuario en Presupuestos.
                // Si ya había una, se actualiza con los datos del mes nuevo.
                category_activated: state.category_activated
                    ? ([...(expensesFull?.report || []), ...(incomeFull?.report || [])].find(c => c.category_id === state.category_activated.category_id) || state.category_activated)
                    : null,
            };
        case GET_EXPENSES_REPORT_FAIL:
            return {
                ...state,
                expenses_report: null
            }
        case GET_SAVINGS_ACCOUNTS_SUCCESS:
            return {
                ...state,
                balance_by_account: payload?.data?.balance_by_account ?? null
            }
        case GET_SAVINGS_ACCOUNTS_FAIL:
            return {
                ...state,
                balance_by_account: null
            }
        case SET_ANOTHER_MONTH:
            return {
                ...state,
                current_Month: payload,
                category_activated: null
            }
        case SET_ANOTHER_YEAR:
            return {
                ...state,
                current_Year: payload,
                category_activated: null
            }
        //***************************dash category************************//
        case SET_DASH_CATEGORY_ACTIVATED:
            return {
                ...state,
                category_activated: payload,

            }
        case GET_CATEGORY_TRANSACTIONS:
            return {
                ...state,
                transactions_category_activated: payload?.data.transactions ?? null
            }
        case GET_CATEGORY_TRANSACTIONS_FAIL:
            return {
                ...state,
                transactions_category_activated: null
            }

        case GET_HISTORY_CATEGORY_BY_MONTH_SUCCESS:
            return {
                ...state,
                history_category: payload?.data ?? null
            }
        case GET_HISTORY_CATEGORY_BY_MONTH_FAIL:
            return {
                ...state,
                history_category: null
            }

        //***************************dash cuentas************************//
        case SET_DASH_ACCOUNT_ACTIVATED:
            return {
                ...state,
                account_activated: payload
            }
        case SET_INIDATE_ACCOUNT_ACTIVATED:
            return {
                ...state,
                iniDate_account_dash: payload
            }
        case SET_ENDDATE_ACCOUNT_ACTIVATED:
            return {
                ...state,
                endDate_account_dash: payload
            }

        case GET_ACCOUNT_STATUS_PERIOD_SUCCESS:
            return {
                ...state,
                account_activated_stats: payload?.data ?? null
            }
        case GET_ACCOUNT_STATUS_PERIOD_FAIL:
            return {
                ...state,
                account_activated_stats: null
            }
        case GET_ACCOUNTS_TRANSACTIONS_SUCCESS:
            return {
                ...state,
                transactions_accounts_activated: payload?.data ?? null
            }
        case GET_ACCOUNTS_TRANSACTIONS_FAIL:
            return {
                ...state,
                transactions_accounts_activated: null
            }
        case GET_HISTORY_ACCOUNTS_BY_MONTH_SUCCESS:
            return {
                ...state,
                history_accounts_by_month: payload?.data ?? null
            }
        case GET_HISTORY_ACCOUNTS_BY_MONTH_FAIL:
            return {
                ...state,
                history_accounts_by_month: null
            }
        default:
            return state
    }
}