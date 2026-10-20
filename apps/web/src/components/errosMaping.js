
export const categoriesApiErrors ={
    "data conflicts with existing data in unique column": 'Esta categoría ya existe!!', // implemented in crear,update
    "unique constraint violated": 'Categoría vinculada con alguna transacción, no puede ser eliminada.', // implemented in eliminar
    3: 'Mar',
    4: 'Abr',
    5: 'May', 
    6: 'Jun',
    7: 'Jul',
    8: 'Ago',
    9: 'Sep',
    10: 'Oct',
    11: 'Nov',
    12: 'Dic'
  };

export const emailsAutomationErrors ={
    "authorization_error": 'Email no configurado en Conexiones a aplicaciones de Google', // implemented in crear,update
    "oauth_client_deleted": {
      "intro":'No hemos podido leer las transacciones que te llegan a este email.',
      "exp":'Detectamos que ha sido desconectado de Topi.', 
      "sol":'Para continuar la lectura automatica de transacciones, en CONEXIONES elimina el correo de Topi y vinculalo de nuevo. No olvides vincular tambien las cuentas bancarias asociadas a este.',
      "step1icon": 'basurita',
      "step2icon": 'vincular',
    }, 
    "token_expired_or_revoked": {
      "intro":'No hemos podido leer las transacciones que te llegan a este email.',
      "exp":'Detectamos que ha sido desconectado de Topi.', 
      "sol":'Para continuar la lectura automatica de transacciones, en CONEXIONES elimina el correo de Topi y vinculalo de nuevo. No olvides vincular tambien las cuentas bancarias asociadas a este.',
      "step1icon": 'basurita',
      "step2icon": 'vincular',

    }
  };


  