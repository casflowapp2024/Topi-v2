import {
    OPEN_SETTINGS_MODAL,
    CLOSE_SETTINGS_MODAL,
    SET_ACTIVE_REPORT_TAB
} from './types';

export const open_settings_modal = (tab) => async dispatch => {
    console.log("Action (UI): open_settings_modal called with tab:", tab);
    dispatch({
        type: OPEN_SETTINGS_MODAL,
        payload: tab
    });
}

export const close_settings_modal = () => async dispatch => {
    dispatch({
        type: CLOSE_SETTINGS_MODAL
    });
}

export const set_active_report_tab = (tab) => async dispatch => {
    dispatch({
        type: SET_ACTIVE_REPORT_TAB,
        payload: tab
    });
}
