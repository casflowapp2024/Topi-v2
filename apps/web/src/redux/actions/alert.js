import {
    SET_ALERT,
    REMOVE_ALERT,
} from './types';

export const setAlert = (msg, isSuccess, colorText, colorBg, timeout = 3000) => dispatch => {
    console.log("alerting")
    if (msg===null){
        dispatch({ type: REMOVE_ALERT })
    }else if(timeout===false){
        dispatch({
            type: SET_ALERT,
            payload: { msg, isSuccess, colorText, colorBg }
        });
    }else{
        dispatch({
            type: SET_ALERT,
            payload: { msg, isSuccess, colorText, colorBg }
        });
        setTimeout(() => dispatch({ type: REMOVE_ALERT }), timeout);
    }
}