//redux
import { connect } from 'react-redux';
//components
import DropDownEmoji from './DropDownEmoji';
import CategoryNameInput from './CategoryNameInput';
import Field, { Input, inputClass } from '../ui/Field';
import Button from '../ui/Button';

/**
 * Formulario de categoría (crear). Lo usan el Modal de Presupuestos y, en versión compacta
 * (windowContext="trans"), la creación rápida dentro de los selectores de categoría.
 * hideActions: el contenedor pone las acciones (p. ej. en el pie del Modal).
 */
const EditCreateCategoryForm = ({
    categoryData,
    selectedEmoji,
    setSelectedEmoji,
    onChangeCreate,
    loadingCreate,
    contextEditCreate,
    onSubmitEditCreate,
    handleCloseDetail,
    windowContext = "",
    hideActions = false,
}) => {
    const compact = windowContext === "trans";

    return (
        <div className="flex flex-col gap-4">
            <div className={`flex ${compact ? 'flex-col gap-2' : 'flex-row gap-4'}`}>
                <div className={`${compact ? '' : 'w-24 shrink-0'} flex flex-col justify-start items-center`}>
                    <div className="w-full">
                        <DropDownEmoji
                            selectedEmoji={selectedEmoji}
                            setSelectedEmoji={setSelectedEmoji}
                            windowContext={windowContext}
                        />
                    </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                    {compact ? (
                        <input type="text" name="name" id="name" aria-label="Nombre de la categoría"
                            value={categoryData.name}
                            onChange={e => onChangeCreate(e)}
                            placeholder="Categoría" required
                            className={inputClass({ className: '!h-9' })}
                        />
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
                            <CategoryNameInput
                                categoryData={categoryData}
                                onChangeCreate={onChangeCreate}
                                setSelectedEmoji={setSelectedEmoji}
                            />
                        </div>
                    )}

                    <Field label="Presupuesto mensual" id="budget" labelClassName={compact ? '!text-xs' : ''}>
                        <Input type="text" inputMode="numeric" name="budget"
                            value={categoryData.budget}
                            onChange={e => onChangeCreate(e)}
                            placeholder="0" required className={compact ? '!h-9' : ''} />
                    </Field>

                    <label htmlFor="isIncome" className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            id="isIncome"
                            name="isIncome"
                            checked={categoryData.isIncome}
                            onChange={e => onChangeCreate(e)}
                            className="mt-0.5 w-4 h-4 rounded accent-topi-500 focus-visible:ring-2 focus-visible:ring-topi-500"
                        />
                        <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-700 dark:text-gray-300`}>
                            {compact ? 'Ingresos' : 'Es de ingresos (como salario o ganancias)'}
                        </span>
                    </label>
                </div>
            </div>

            {!hideActions && (
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    {windowContext !== "onboarding" && (
                        <Button variant="ghost" size={compact ? 'sm' : 'md'} onClick={e => handleCloseDetail()} disabled={loadingCreate}>Cancelar</Button>
                    )}
                    <Button size={compact ? 'sm' : 'md'} loading={loadingCreate} onClick={onSubmitEditCreate}>
                        {contextEditCreate === "create" ? 'Crear' : 'Actualizar'}
                    </Button>
                </div>
            )}
        </div>
    )
}

export default connect(() => ({}), {})(EditCreateCategoryForm)
