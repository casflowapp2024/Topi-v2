// Aviso al guardar: si el movimiento venía de un correo y cambió de cuenta, lo que Topi aprendió (plan/32)
export const updatedMessage = (learned) => {
    if (!learned || !learned.digits) return 'Transacción actualizada';
    const count = learned.moved === 1 ? '1 movimiento pendiente' : `${learned.moved} movimientos pendientes`;
    if (learned.learned) {
        return `Transacción actualizada. Topi recordará ••${learned.digits} para esta cuenta`
            + (learned.moved > 0 ? ` y le pasó ${count} con ese número.` : '.');
    }
    return learned.moved > 0 ? `Transacción actualizada. También pasamos ${count} de ••${learned.digits} a esta cuenta.`
        : 'Transacción actualizada';
};
