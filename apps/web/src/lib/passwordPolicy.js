// Misma política que la API: >= 8 caracteres, mayúscula, minúscula, número y símbolo
export const passwordErrors = (value) => {
    const errors = [];

    if (value.length < 8) errors.push("Al menos 8 caracteres");
    if (!/\d/.test(value)) errors.push("Al menos un número");
    if (!/[^A-Za-z0-9]/.test(value)) errors.push("Al menos un carácter especial (@, $, !, %, *, ?, &...)");
    if (!/[A-Z]/.test(value)) errors.push("Al menos una letra mayúscula");
    if (!/[a-z]/.test(value)) errors.push("Al menos una letra minúscula");

    return errors;
};
