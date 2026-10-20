import {
    GET_AUTOMATED_EMAILS_SUCCESS,
    GET_AUTOMATED_EMAILS_FAIL
} from '../actions/types';



const initialState = {
    automated_emails: {
        emails:null,
        total: null,
        skip: null,
        limit: null,
    },

};

export default function Conexions(state = initialState, action) {
    const { type, payload } = action;

    switch(type) {
        case GET_AUTOMATED_EMAILS_SUCCESS:
            
            return {
                ...state,
                    automated_emails:{
                    ...state.automated_emails, 
                    emails: payload.data.emails,
                    total: payload.data.meta.total,
                    skip: payload.data.meta.skip,
                    limit: payload.data.meta.limit
                    }
                }
        case GET_AUTOMATED_EMAILS_FAIL:
            return {
                ...state,
                automated_emails: {
                    emails:null,
                    total: null,
                    skip: null,
                    limit: null,
                },
            }

        default:
            return state
    }
}