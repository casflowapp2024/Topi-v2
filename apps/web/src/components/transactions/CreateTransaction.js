import { useEffect, useState } from 'react'
//redux
import { connect } from 'react-redux'
import {
    get_user_categories, create_transaction, get_user_transactions, get_user_accounts,
    create_category
} from '../../redux/actions/cashflow';
import { setAlert } from '../../redux/actions/alert';
//components
import { formatDate, formatMoney, formatMoneyCompact, formatedCurrToNumber, findElmentById, parseDatetimetoDateStrFormat, isOpenAccount, isCreditAccount } from '../helpers';
import 'react-datepicker/dist/react-datepicker.css'
import FormEditCreateTrans from './FormEditCreateTrans';
import Alert from '../alert';
import Modal from '../ui/Modal';
import Button from '../ui/Button';


function CreateTransaction({
    //props
    openCreatePopUp,
    SetOpenCreatePopUp,
    currentFrontendPage,
    //states 
    user_categories,
    user_accounts,
    create_transaction,
    get_user_transactions,
    get_user_categories,
    get_user_accounts,
    setAlert,
    trans_filters_activated,
    default_limit,
    create_category,
    initialCategoryId,
    initialAccountId

}) {

    const [date, setDate] = useState(parseDatetimetoDateStrFormat(new Date(), 'YYYY-MM-DD HH:mm:ss Z'));

    //create account
    const [loadingCreate, setLoadingCreate] = useState(false)
    const [createTransData, setCreatTransData] = useState({
        category_id: 0,
        account_id: 0,
        description: "",
        expense: true,
        amount: "$0",
    });

    useEffect(() => {
        if (openCreatePopUp) {
            setCreatTransData(prev => ({
                ...prev,
                category_id: initialCategoryId || (user_categories?.items?.length > 0 ? user_categories.items[0].id : 0),
                account_id: initialAccountId || ((user_accounts?.items || []).find(isOpenAccount)?.id ?? 0),
                amount: "$0",
                installments: '',
            }));
        }
    }, [openCreatePopUp, initialCategoryId, initialAccountId]);

    useEffect(() => {
        get_user_accounts(0, 20)
        get_user_categories(0, 20)
    }, []);

    // Initialize default categories/accounts when they load if not already set
    useEffect(() => {
        if (openCreatePopUp) {
            if (user_categories?.items?.length > 0 && !createTransData.category_id && !initialCategoryId) {
                setCreatTransData(prev => ({ ...prev, category_id: user_categories.items[0].id }));
            }
        }
    }, [user_categories, openCreatePopUp]);

    useEffect(() => {
        if (openCreatePopUp) {
            const firstOpen = (user_accounts?.items || []).find(isOpenAccount);
            if (firstOpen && !createTransData.account_id && !initialAccountId) {
                setCreatTransData(prev => ({ ...prev, account_id: firstOpen.id }));
            }
        }
    }, [user_accounts, openCreatePopUp]);


    const onChangeCreate = (e) => {
        if (e.target.name === "expense") {
            setCreatTransData({ ...createTransData, [e.target.name]: !e.target.checked })
        } else {
            if (e.target.name === "expense") {
                setCreatTransData({ ...createTransData, [e.target.name]: !createTransData.expense })
            } else {
                setCreatTransData({ ...createTransData, [e.target.name]: e.target.value })
            }
        }
    }

    const onSubmitCreate = async (e) => {

        e.preventDefault();
        setLoadingCreate(true)
        let newCategoryId = createTransData.category_id
        // category must be created first
        if (createTransData.category_id < 0) {
            const newCategory = findElmentById(user_categories.items, createTransData.category_id)
            const createCategoryResponse = await create_category(newCategory.name, parseFloat(0), newCategory.emoji)
            if (createCategoryResponse === false) {
                setAlert("Algo salio mal, la categoría no fue creada, intenta de nuevo!", true, "text-white", "bg-red-500", 3000)
                setLoadingCreate(false)
                return
            }
            newCategoryId = createCategoryResponse
            await get_user_categories(0, 50)
            setCreatTransData({ ...createTransData, ["category_id"]: newCategoryId })
        }
        // create transaction

        console.log("creating", date)

        const createResponse = await create_transaction(
            parseInt(newCategoryId),
            parseInt(createTransData.account_id),
            createTransData.description,
            createTransData.expense,
            parseFloat(formatedCurrToNumber(createTransData.amount)),
            date,
            // cuotas solo en gastos con tarjeta
            createTransData.expense && isCreditAccount(findElmentById(user_accounts?.items || [], parseInt(createTransData.account_id)))
                ? createTransData.installments : undefined)

        if (createResponse === true) {

            await get_user_transactions((currentFrontendPage - 1) * default_limit, default_limit, trans_filters_activated.params)
            setAlert('Transaccion creada', true, 'text-white', 'bg-green-500', 4000)
            setLoadingCreate(false)
            setTimeout(() =>
                setCreatTransData({
                    ...createTransData,
                    description: "",
                    expense: true,
                    amount: "$0",
                    installments: '',
                }),
                300)

        } else {
            setLoadingCreate(false)
            setAlert('No se pudo crear la transaccion, intenta de nuevo', true, 'text-white', 'bg-red-500', 4000)
        }
    }

    const handleClosePopover = () => {
        SetOpenCreatePopUp(false);
    };

    /* useEffect(() => {

        console.log(createTransData)

    }, [createTransData,date]); */


    // Agregar es secundario (las transacciones llegan solas por correo): el modal es un formulario corto,
    // sin nada que lo haga más visible desde afuera.
    return (
        <Modal
            open={openCreatePopUp}
            onClose={handleClosePopover}
            title="Nuevo movimiento"
            size="lg"
            footer={<>
                <Button variant="ghost" onClick={handleClosePopover} disabled={loadingCreate}>Cancelar</Button>
                <Button type="submit" form="create-transaction-form" loading={loadingCreate}>Crear</Button>
            </>}
        >
            <form id="create-transaction-form" onSubmit={onSubmitCreate} noValidate>
                <FormEditCreateTrans
                    editCreateData={createTransData}
                    onChangeCreate={onChangeCreate}
                    user_categories={user_categories}
                    user_accounts={user_accounts}
                    date={date}
                    setDate={setDate}
                />
            </form>
            <div className="overflow-hidden rounded-2xl mt-3 empty:hidden">
                <Alert />
            </div>
        </Modal>
    )
}


const mapStateToProps = state => ({
    user_categories: state.CashFlow.user_categories,
    user_accounts: state.CashFlow.user_accounts,
    trans_filters_activated: state.CashFlow.trans_filters_activated,
    default_limit: state.CashFlow.user_transactions.default_limit
})

export default connect(mapStateToProps, {
    create_transaction,
    get_user_transactions,
    get_user_categories,
    get_user_accounts,
    create_category,
    setAlert,


})(CreateTransaction)