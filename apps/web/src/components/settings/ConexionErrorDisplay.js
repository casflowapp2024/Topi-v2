//redux
import { connect } from 'react-redux'
import { emailsAutomationErrors } from '../errosMaping'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { ChevronDoubleDownIcon, PlusIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid'

// Íconos de los pasos de la solución (los mismos botones que hay en Conexiones)
const stepiconsMap = {
    'basurita': (
        <span className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-status-crit text-status-crit-text dark:text-red-400 text-sm font-medium">
            <TrashIcon className="w-5 h-5" aria-hidden="true" /> Eliminar
        </span>
    ),
    'vincular': (
        <span className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-topi-500 bg-gray-100 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200">
            <PlusIcon className="w-4 h-4" aria-hidden="true" /> Conectar nuevo Email
        </span>
    ),
}

function ConexionErrorDisplay({
    //props
    openErrorPopup,
    setOpenErrorPopup,
    emailErrorSelected
}) {

    const handleClosePopover = () => {
        setOpenErrorPopup(false);
    }

    const info = emailErrorSelected && emailErrorSelected.error !== null ? emailsAutomationErrors[emailErrorSelected.error] : null

    return (
        <Modal open={Boolean(openErrorPopup)} onClose={handleClosePopover} title="Conexión con problemas"
            footer={<Button variant="secondary" onClick={handleClosePopover}>Entendido</Button>}>
            {info ? (
                <div className="flex flex-col gap-3 items-center text-center">
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-status-warn-text dark:text-amber-300">
                        <ExclamationTriangleIcon className="w-4 h-4 shrink-0" aria-hidden="true" /> Sin lectura
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">{info["intro"]}</p>
                    <h4 className="font-bold text-gray-900 dark:text-white break-all">{emailErrorSelected.email}</h4>
                    <p className="text-sm text-ink-2 dark:text-gray-300">{info["exp"]}</p>
                    <ChevronDoubleDownIcon className="h-6 w-6 text-topi-500" aria-hidden="true" />
                    <p className="text-sm text-ink-2 dark:text-gray-300">{info["sol"]}</p>
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                        {stepiconsMap[info["step1icon"]]}
                        <span className="text-gray-500 dark:text-gray-400" aria-hidden="true">➔</span>
                        {stepiconsMap[info["step2icon"]]}
                    </div>
                </div>
            ) : null}
        </Modal>
    )
}


const mapStateToProps = state => ({


})

export default connect(mapStateToProps, {


})(ConexionErrorDisplay)
