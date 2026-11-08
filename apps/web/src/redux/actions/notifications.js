import axios from 'axios';

// Preferencias de correo (Ajustes > Correos). Sin reducer: las usa solo esa pestaña.
const config = () => ({
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    }
});

export const fetch_notification_prefs = async () => {
    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/users/notification-prefs`, config());
        return res.status === 200 ? res.data.data : null;
    } catch {
        return null;
    }
};

// Manda las dos preferencias juntas: la API exige ambas para no apagar nada por omisión
export const save_notification_prefs = async ({ email_monthly_summary, email_connection_alerts }) => {
    try {
        const body = JSON.stringify({ email_monthly_summary, email_connection_alerts });
        const res = await axios.put(`${process.env.REACT_APP_API_URL}/users/notification-prefs`, body, config());
        return res.status === 200 ? res.data.data : null;
    } catch {
        return null;
    }
};
