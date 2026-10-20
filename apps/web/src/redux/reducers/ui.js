import {
    OPEN_SETTINGS_MODAL,
    CLOSE_SETTINGS_MODAL,
    SET_ACTIVE_REPORT_TAB
} from '../actions/types';

const initialState = {
    is_settings_open: false,
    active_settings_tab: 'profile',
    active_report_tab: 'Expenses'
};

export default function UI(state = initialState, action) {
    const { type, payload } = action;

    switch (type) {
        case OPEN_SETTINGS_MODAL:
            return {
                ...state,
                is_settings_open: true,
                active_settings_tab: payload || state.active_settings_tab
            };
        case CLOSE_SETTINGS_MODAL:
            return {
                ...state,
                is_settings_open: false
            };
        case SET_ACTIVE_REPORT_TAB:
            return {
                ...state,
                active_report_tab: payload
            };
        default:
            return state;
    }
}
