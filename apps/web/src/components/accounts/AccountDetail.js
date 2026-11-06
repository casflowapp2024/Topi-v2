import { useState, useEffect } from 'react'
//redux
import { connect } from 'react-redux'
import { delete_account, get_user_accounts } from '../../redux/actions/cashflow';
import { setAlert } from '../../redux/actions/alert';
//components
import AccCard from './AccCard';
import EditAccounts from './EditAccounts';
import Alert from '../alert';
import Alert2 from '../alert2';
import { formatMoney, formatedCurrToNumber } from '../helpers';
import { get_net_worth } from '../../redux/actions/fx';
import { CheckCircleIcon, XCircleIcon, TrashIcon, PencilSquareIcon, LinkSlashIcon } from '@heroicons/react/20/solid';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';


function AccountDetail({
    openAccDetail,
    setOpenAccDetail,
    detailInfo,
    setDetailInfo,
    banks,
    accountTypesOptions,
    delete_account,
    get_user_accounts,
    setAlert,
    balance_by_account,
    net_worth,
    get_net_worth

}) {


    //ELIMINAR CUENTA
    const [openDeleteBox, setOpenDeleteBox] = useState(false)
    const [loadingDelete, setLoadingDelete] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [isFailed, setIsFailed] = useState(false)

    const handleDeleteAcc = async (accId) => {
        setLoadingDelete(true)
        const deleteResponse = await delete_account(accId);

        // The code below will only execute after the transaction is deleted
        if (deleteResponse === true) {
            setLoadingDelete(false)
            setIsSuccess(true)
            setAlert('Cuenta Eliminada', true, 'text-red-600', 'bg-gray-200', false)
            get_user_accounts(0, 20)
            /* setTimeout(() => {
                setOpenAccDetail(false);
            }, 4900)
            setTimeout(() => {
                setOpenDeleteBox(false);
                setIsSuccess(false)
            }, 5200) */

        } else {
            setLoadingDelete(false)
            setIsFailed(true)
            setAlert('Algo salió mal la cuenta no fue eliminada', false, 'text-red-600', 'bg-gray-200', false)
            /* setTimeout(() => {
                //setOpenDeleteBox(false);
                setIsFailed(false)
            }, 5000) */
        }


    }

    const outSuccesFailed = async () => {
        if (isSuccess) {
            setOpenAccDetail(false)
            setTimeout(() => {
                setAlert('...', false, 'text-white', 'bg-white', 300)
                setIsSuccess(false)
                setOpenDeleteBox(false)
            }, 1000)
        } else {
            setIsFailed(false)
        }
    }

    //Edit Open
    const [openEditAcc, setOpenEditAcc] = useState(false)

    const handleOpenEditAcc = async () => {
        setOpenEditAcc(true)
    }

    //close popup
    const handleClosePopUp = async () => {
        setOpenAccDetail(false)
        setTimeout(() => {
            setAlert('...', true, 'text-white', 'bg-white', 100)
            setOpenDeleteBox(false)
            setOpenEditAcc(false)
            setIsFailed(false)
            setIsSuccess(false)
        }, 300)
    }

    useEffect(() => {
        if (openAccDetail === false) {
            setOpenDeleteBox(false)
            setLoadingDelete(false)
            setIsSuccess(false)
            setIsFailed(false)
        }

    }, [openAccDetail]);

    // Saldo de hoy en la moneda de la cuenta y su equivalente en la moneda base: sale del
    // patrimonio, que se recarga después de cada cambio (incluido el de moneda); el reporte de
    // saldos por cuenta queda de respaldo
    const accountNetWorth = (id) => net_worth?.accounts?.find(a => a.account_id === id);
    const findBalanceByAccountId = (elements, id) => {
        const nw = accountNetWorth(id);
        if (nw) return Number(nw.balance);
        const element = (elements || []).find(element => element.account_id === id);
        return element ? element.balance : null;
    };
    useEffect(() => { if (openAccDetail) get_net_worth(); }, [openAccDetail]); // eslint-disable-line react-hooks/exhaustive-deps

    /* useEffect(() => {
    console.log("detailInfo: ", detailInfo);
    }, [detailInfo]); */

    // Hoja lateral (acompaña la lista de cuentas). Estados: detalle → editar | desvincular → resultado.
    const view = (isSuccess || isFailed) ? 'result' : openEditAcc ? 'edit' : openDeleteBox ? 'delete' : 'detail';
    const TITLES = {
        detail: 'Cuenta',
        edit: 'Editar cuenta',
        delete: '¿Desvincular esta cuenta?',
        result: isSuccess ? 'Cuenta desvinculada' : 'No se pudo desvincular',
    };
    const footers = {
        detail: (
            <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" className="!text-status-crit-text dark:!text-red-400 hover:!bg-status-crit-soft dark:hover:!bg-red-500/10"
                    icon={TrashIcon} onClick={() => setOpenDeleteBox(true)}>
                    Desvincular
                </Button>
                <Button icon={PencilSquareIcon} onClick={() => handleOpenEditAcc()}>Editar</Button>
            </div>
        ),
        delete: (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpenDeleteBox(false)} disabled={loadingDelete}>Cancelar</Button>
                <Button variant="danger" icon={LinkSlashIcon} loading={loadingDelete} onClick={() => handleDeleteAcc(detailInfo.id)}>
                    Sí, desvincular
                </Button>
            </div>
        ),
        result: (
            <div className="flex sm:justify-end">
                <Button variant="secondary" className="w-full sm:w-auto" onClick={() => outSuccesFailed()}>
                    {isSuccess ? 'Cerrar' : 'Volver'}
                </Button>
            </div>
        ),
        edit: null, // el formulario de edición trae sus propias acciones
    };
    const automated = detailInfo?.automation?.configured === true;

    return (
        <Sheet open={Boolean(openAccDetail)} onClose={handleClosePopUp} title={TITLES[view]} footer={detailInfo ? footers[view] : null} size="lg">
            {detailInfo && (
                <div className="flex flex-col gap-4">
                    <div className="flex justify-center">
                        <AccCard
                            name={detailInfo.name}
                            accountTypesOptions={accountTypesOptions}
                            accountType={detailInfo.type.id}
                            banks={banks}
                            bankId={detailInfo.bank.id}
                            initia_balance_amount={findBalanceByAccountId(balance_by_account, detailInfo.id)}
                            lastFourDigits={detailInfo.last_four_digits}
                            currency={detailInfo.currency}
                            base={accountNetWorth(detailInfo.id)?.base_value}
                        />
                    </div>
                    <p className={`inline-flex items-center justify-center gap-1.5 text-xs font-medium ${automated ? 'text-money-in dark:text-money-in-dark' : 'text-ink-2 dark:text-gray-400'}`}>
                        {automated
                            ? <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
                            : <XCircleIcon className="w-4 h-4" aria-hidden="true" />}
                        Lectura automática de transacciones {automated ? 'activada' : 'desactivada'}
                    </p>

                    {view === 'result' ? (
                        <Alert2 />
                    ) : view === 'edit' ? (
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                            <EditAccounts
                                openEditAcc={openEditAcc}
                                setOpenEditAcc={setOpenEditAcc}
                                detailInfo={detailInfo}
                                setDetailInfo={setDetailInfo}
                                setOpenAccDetail={setOpenAccDetail}
                                setIsFailed={setIsFailed}
                                handleClosePopUp={handleClosePopUp}
                            />
                        </div>
                    ) : view === 'delete' ? (
                        <p className="rounded-2xl border border-status-crit/30 bg-status-crit-soft dark:bg-red-500/10 p-3 text-sm text-gray-800 dark:text-gray-200">
                            El saldo de esta cuenta dejará de contar en tu patrimonio. ¿Seguro que quieres desvincularla?
                        </p>
                    ) : null}
                </div>
            )}
        </Sheet>
    )
}


const mapStateToProps = state => ({
    banks: state.CashFlow.banks.items,
    accountTypesOptions: state.CashFlow.account_types,
    balance_by_account: state.Reports.balance_by_account,
    net_worth: state.Fx?.net_worth,

})

export default connect(mapStateToProps, {
    delete_account,
    get_user_accounts,
    setAlert,
    get_net_worth

})(AccountDetail)