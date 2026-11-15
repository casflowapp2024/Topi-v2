//redux
import { connect } from 'react-redux'
import { emailsAutomationErrors } from '../errosMaping'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { ChevronDoubleDownIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid'

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
                </div>
            ) : null}
        </Modal>
    )
}


const mapStateToProps = state => ({


})

export default connect(mapStateToProps, {


})(ConexionErrorDisplay)
