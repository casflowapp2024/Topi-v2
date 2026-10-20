import { combineReducers } from 'redux';
import Auth from './auth';
//import Alert from './alert';
import CashFlow from './cashflow';
import Reports from './reports';
import Alert from './alert';
import Conexions from './conexions';
import UI from './ui';

export default combineReducers({
    Auth,
    CashFlow,
    Reports,
    UI,
    Conexions,
    Alert

    //Alert,
    /*
    Categories,
    
    Cart,
    Shipping,
    Payment,
    Orders,
    Coupons,
    Profile,
    Wishlist,
    Reviews */
})