
export const categoriesApiErrors ={
    "data conflicts with existing data in unique column": 'Esta categoría ya existe!!', // implemented in crear,update
    "unique constraint violated": 'Categoría vinculada con alguna transacción, no puede ser eliminada.', // implemented in eliminar
    "budget month out of range": 'Elige un mes entre el inicio y el mes en curso.',
    "the first budget version cannot be deleted": 'La primera versión del presupuesto no se puede borrar.',
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
      "exp":'El permiso para leerlo dejó de funcionar; a veces pasa solo.', 
      "sol":'Toca Reconectar y vuelve a dar el permiso: tus cuentas siguen ligadas a este correo.',
    }, 
    "token_expired_or_revoked": {
      "intro":'No hemos podido leer las transacciones que te llegan a este email.',
      "exp":'El permiso para leerlo dejó de funcionar; a veces pasa solo.', 
      "sol":'Toca Reconectar y vuelve a dar el permiso: tus cuentas siguen ligadas a este correo.',

    }
  };


  