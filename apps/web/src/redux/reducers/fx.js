import {
    GET_CURRENCIES_SUCCESS,
    GET_NET_WORTH_SUCCESS,
    GET_NET_WORTH_FAIL,
    SET_NET_WORTH_LOADING,
    LOGOUT,
} from '../actions/types';

const initialState = {
    currencies: null,
    net_worth: null,
    net_worth_loading: false,
};

export default function Fx(state = initialState, action) {
    const { type, payload } = action;
    switch (type) {
        case GET_CURRENCIES_SUCCESS:
            return { ...state, currencies: payload };
        case SET_NET_WORTH_LOADING:
            return { ...state, net_worth_loading: true };
        case GET_NET_WORTH_SUCCESS:
            return { ...state, net_worth: payload, net_worth_loading: false };
        case GET_NET_WORTH_FAIL:
            return { ...state, net_worth_loading: false };
        case LOGOUT:
            return initialState;
        default:
            return state;
    }
}
