import {
    GET_BANKS_SUCCESS,
    GET_BANKS_FAIL,
    GET_OFFICIAL_BANKS_SUCCESS,
    GET_OFFICIAL_BANKS_FAIL,

    GET_USER_CATEGORIES_SUCCESS,
    GET_USER_CATEGORIES_FAIL,
    CREATE_USER_CATEGORY_SUCCESS,
    CREATE_USER_CATEGORY_FAIL,
    DELETE_USER_CATEGORY_SUCCESS,
    DELETE_USER_CATEGORY_FAIL,
    UPDATE_USER_CATEGORY_SUCCESS,
    UPDATE_USER_CATEGORY_FAIL,

    CREATE_NEW_USER_ACCOUNT_SUCCESS,
    CREATE_NEW_USER_ACCOUNT_FAIL,
    GET_USER_ACCOUNTS_SUCCESS,
    GET_USER_ACCOUNTS_FAIL,
    GET_ACCOUNT_TYPES_SUCCESS,
    GET_ACCOUNT_TYPES_FAIL,

    GET_USER_BALANCES_SUCCESS,
    GET_USER_BALANCES_FAIL,

    GET_USER_TRANSACTIONS_SUCCESS,
    GET_USER_TRANSACTIONS_FAIL,
    GET_USER_TRANSACTIONS_DASH_SUCCESS,
    GET_USER_TRANSACTIONS_DASH_FAIL,
    DELETE_USER_TRANSACTION_SUCCESS,
    DELETE_USER_TRANSACTION_FAIL,
    UPDATE_USER_TRANSACTION_LOCAL,
    UPDATE_USER_TRANSACTION_LOCAL_DASH,
    UPDATE_TRANS_FILTER,
    COLLAPSE_FIRST_STEPS,

    GET_AUTOMATED_EMAILS_SUCCESS,
    GET_AUTOMATED_EMAILS_FAIL

} from '../actions/types';
import { default_cats } from '../../components/info_arrays';
import def from 'ajv/dist/vocabularies/discriminator';

const initialState = {

    banks: {
        items: null,
        default: [],
        total: null,
        skip: null,
        limit: null,
    },

    default_banks: [],

    user_accounts: {
        items: null,
        total: null,
        skip: null,
        limit: null,
    },

    user_categories: {
        items: null,
        default: default_cats,
        total: null,
        skip: null,
        limit: null,
    },

    default_categories: default_cats,

    user_transactions: {
        items: null,
        total: null,
        skip: null,
        limit: null,
        news: null,
        default_limit: 10,
        read_email_onboarding: null
    },


    user_transactions_dash: {
        items: null,
        total: null,
        skip: null,
        limit: null,
        news: null,
    },

    trans_filters_activated: {
        categorie_ids: [],
        accounts_ids: [],
        iniDate: "",
        endDate: "",
        keyword: "",
        expence: "",
        sortby: "date",
        automated: "",
        shouldVerify: "",
        checked: "",
        transfer: "",
        params: ""
    },
    user_balances: null,

    account_types: {
        items: null,
        total: null,
        skip: null,
        limit: null,
    },

    first_steps: {
        retrieved: false,
        email: false,
        retrieved_email: false,
        bank: false,
        retrieved_bank: false,
        cat: false,
        retrieved_cat: false,
        trans: false,
        retrieved_trans: false,
        keep_open: true
    },
};

export default function CashFlow(state = initialState, action) {
    const { type, payload } = action;

    switch (type) {
        case GET_OFFICIAL_BANKS_SUCCESS:
            return {
                ...state,
                default_banks: payload,
                banks: {
                    ...state.banks,
                    default: payload,
                    items: state.banks.items ? [...state.banks.items.filter(b => !b.isDefault), ...payload] : payload
                }
            }

        case GET_BANKS_SUCCESS:
            const userBanks = payload.data.banks.map(bnk => ({
                ...bnk,
                isDefault: false,
            }));
            const defaultBnks = state.default_banks.map(def => {
                const match = payload.data.banks.find(bnk => bnk.name === def.name);
                return {
                    ...def,
                    userBank: !!match,  // true if match exists
                };
            });
            const combinedBanksItems = [...userBanks, ...defaultBnks];
            //const BankssCreated = (payload.data.meta.total!==0)
            return {
                ...state,
                banks: {
                    ...state.banks,
                    items: combinedBanksItems,
                    default: defaultBnks,
                    total: payload.data.meta.total,
                    skip: payload.data.meta.skip,
                    limit: payload.data.meta.limit,
                },
            };

        case GET_BANKS_FAIL:
            return {
                ...state,
                banks: {
                    ...state.banks,
                    items: null,
                    default: null,
                    total: null,
                    skip: null,
                    limit: null,
                },
            }
        case GET_USER_CATEGORIES_SUCCESS:
            const userItems = payload.data.categories.map(cat => ({
                ...cat,
                isDefault: false,
            }));
            const defaultItems = default_cats.map(def => {
                const match = payload.data.categories.find(cat => cat.name === def.name);
                return {
                    ...def,
                    userCat: !!match,  // true if match exists
                };
            });
            const combinedItems = [...userItems, ...defaultItems];
            const catsCreated = (payload.data.meta.total > 1)
            return {
                ...state,
                user_categories: {
                    ...state.user_categories,
                    items: combinedItems,
                    default: defaultItems,
                    total: payload.data.meta.total,
                    skip: payload.data.meta.skip,
                    limit: payload.data.meta.limit,
                },
                first_steps: {
                    ...state.first_steps,
                    retrieved: true,
                    retrieved_cat: true,
                    cat: catsCreated,
                }

            };
        case GET_USER_CATEGORIES_FAIL:
            return {
                ...state,
                user_categories: {
                    ...state.user_categories, // Spread the existing user_transactions object
                    items: null,
                    total: null,
                    skip: null,
                    limit: null,
                }
            }
        case GET_AUTOMATED_EMAILS_SUCCESS:
            const autoamtedEmailCreated = (payload.data.meta.total !== 0)
            return {
                ...state,
                first_steps: {
                    ...state.first_steps,
                    retrieved: true,
                    retrieved_email: true,
                    email: autoamtedEmailCreated,
                }
            };

        case GET_USER_ACCOUNTS_SUCCESS:
            const accountBankCreated = (payload.data.meta.total !== 0)

            return {
                ...state,
                user_accounts: {
                    ...state.user_accounts, // Spread the existing user_transactions object
                    items: payload.data.accounts,
                    total: payload.data.meta.total,
                    skip: payload.data.meta.skip,
                    limit: payload.data.meta.limit,
                },
                first_steps: {
                    ...state.first_steps,
                    retrieved: true,
                    bank: accountBankCreated,
                    retrieved_bank: true

                }
            }
        case GET_USER_ACCOUNTS_FAIL:
            return {
                ...state,
                user_accounts: {
                    ...state.user_accounts, // Spread the existing user_transactions object
                    items: null,
                    total: null,
                    skip: null,
                    limit: null,
                }
            }
        case GET_ACCOUNT_TYPES_SUCCESS:
            return {
                ...state,
                account_types: {
                    ...state.account_types, // Spread the existing user_transactions object
                    items: payload.data.account_types,
                    total: payload.data.meta.total,
                    skip: payload.data.meta.skip,
                    limit: payload.data.meta.limit,
                }
            }
        case GET_ACCOUNT_TYPES_FAIL:
            return {
                ...state,
                account_types: {
                    ...state.account_types, // Spread the existing user_transactions object
                    items: null,
                    total: null,
                    skip: null,
                    limit: null,
                }
            }
        case GET_USER_TRANSACTIONS_SUCCESS:

            return {
                ...state,
                user_transactions: {
                    ...state.user_transactions, // Spread the existing user_transactions object
                    items: payload.data.transactions,
                    total: payload.data.meta.total,
                    skip: payload.data.meta.skip,
                    limit: payload.data.meta.limit,
                    news: payload.data.meta.news,
                    read_email_onboarding: payload.data.meta.read_email_onboarding,
                }

            }

        case GET_USER_TRANSACTIONS_FAIL:
            return {
                ...state,
                user_transactions: {
                    ...state.user_transactions, // Spread the existing user_transactions object
                    items: null,
                    total: null,
                    skip: null,
                    limit: null,
                    news: null,
                    read_email_onboarding: null,
                }
            }
        case GET_USER_TRANSACTIONS_DASH_SUCCESS:
            const trasCreated = (payload.data.meta.total !== 0)
            return {
                ...state,
                user_transactions_dash: {
                    ...state.user_transactions_dash, // Spread the existing user_transactions object
                    items: payload.data.transactions,
                    total: payload.data.meta.total,
                    skip: payload.data.meta.skip,
                    limit: payload.data.meta.limit,
                    news: payload.data.meta.news,
                    read_email_onboarding: payload.data.meta.read_email_onboarding,
                },
                first_steps: {
                    ...state.first_steps,
                    retrieved: true,
                    retrieved_trans: true,
                    trans: trasCreated,
                }
            }
        case GET_USER_TRANSACTIONS_DASH_FAIL:
            return {
                ...state,
                user_transactions_dash: {
                    ...state.user_transactions_dash, // Spread the existing user_transactions object
                    items: null,
                    total: null,
                    skip: null,
                    limit: null,
                    news: null,
                    read_email_onboarding: null,
                }
            }
        case UPDATE_TRANS_FILTER:
            return {
                ...state,
                trans_filters_activated: payload
            }
        case GET_USER_BALANCES_SUCCESS:
            return {
                ...state,
                user_balances: payload
            }
        case GET_USER_BALANCES_FAIL:
            return {
                ...state,
                user_balances: null
            }
        case UPDATE_USER_TRANSACTION_LOCAL:
            return {
                ...state,
                user_transactions: {
                    ...state.user_transactions,
                    items: state.user_transactions.items.map(transaction => {
                        if (transaction.id === action.payload.id) {
                            return { ...transaction, ...action.payload };
                        }
                        return transaction;
                    })
                }
            };
        case UPDATE_USER_TRANSACTION_LOCAL_DASH:
            return {
                ...state,
                user_transactions_dash: {
                    ...state.user_transactions_dash,
                    items: state.user_transactions_dash.items.map(transaction => {
                        if (transaction.id === action.payload.id) {
                            return { ...transaction, ...action.payload };
                        }
                        return transaction;
                    })
                }
            };
        case COLLAPSE_FIRST_STEPS:
            return {
                ...state,
                first_steps: {
                    ...state.first_steps,
                    keep_open: false,
                }
            }

        default:
            return state
    }
}