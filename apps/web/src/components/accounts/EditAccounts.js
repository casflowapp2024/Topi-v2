import { useState } from 'react'

//redux
import { connect } from 'react-redux'
import { get_user_accounts, update_account } from '../../redux/actions/cashflow';
import { setAlert } from '../../redux/actions/alert';
//components
import { findElmentById, formatedCurrToNumber } from '../helpers';
import EditCreateFinAccountForm from './EditCreateFinAccountForm';
import AccountCurrencyTools from './AccountCurrencyTools';
import Button from '../ui/Button';
import { CheckIcon } from '@heroicons/react/20/solid';
import Alert2 from '../alert2';
/* This example requires Tailwind CSS v2.0+ */


function EditAccounts({
  openEditAcc,
  setOpenEditAcc,
  detailInfo,
  setDetailInfo,
  setOpenAccDetail,
  get_user_accounts,
  user_accounts,
  update_account,
  accountTypesOptions,
  banks,
  setAlert,
  setIsFailed,
  handleClosePopUp,
  automatedEmails
}) {
  //edit transaction
  const [loadingUpdate, setLoadingUpdate] = useState(false)
  const [updatedSuccess, setUpdatedSuccess] = useState(false)
  const [updateAccountData, setUpdateAccData] = useState({
    name: detailInfo.name,
    last_four_digits: detailInfo.last_four_digits,
    bankId: detailInfo.bank.id,
    accountType: detailInfo.type.id,
    initia_balance_amount: detailInfo.initial_balance,
    automated: detailInfo.email.active,
    gmailPersonalEmail: detailInfo.email,
    currency: detailInfo.currency || 'COP',
  });
  // moneda al abrir: solo se manda si cambió (y solo se puede sin movimientos)
  const [originalCurrency, setOriginalCurrency] = useState(detailInfo.currency || 'COP');
  // el asistente de moneda ya la cambió en la API: el formulario la toma como la de partida
  const onCurrencyChanged = (currency) => {
    setOriginalCurrency(currency);
    setUpdateAccData(prev => ({ ...prev, currency }));
  };

  const onChangeCreate = (e) => {
    const { name, type, checked, value } = e.target;
    console.log(updateAccountData)

    if (e.target.name === "initia_balance_amount") {
      const formated_ammount = e.target.value; // Remove non-numeric characters except for decimal point and minus sign
      setUpdateAccData({ ...updateAccountData, [e.target.name]: formated_ammount });
    } else {
      setUpdateAccData({
        ...updateAccountData,
        [name]: type === "checkbox" ? checked : value

      });
    }

    //changing detailInfo

    if (name === "name") {

      setDetailInfo(prev => ({
        ...prev,
        name: value
      }))
    }

    if (name === "last_four_digits") {
      setDetailInfo(prev => ({
        ...prev,
        last_four_digits: value
      }))
    }

    if (name === "initia_balance_amount") {

      const number_value = parseFloat(formatedCurrToNumber(e.target.value))
      setDetailInfo(prev => ({
        ...prev,
        initial_balance: number_value
      }))
    }

    if (name === "bankId") {
      setDetailInfo(prev => ({
        ...prev,
        bank: {
          ...prev.bank,
          id: value,
          name: findElmentById(banks, parseInt(value)).name
        }
      }))
    }

    if (name === "accountType") {
      setDetailInfo(prev => ({
        ...prev,
        type: {
          ...prev.type,
          id: value,
          name: findElmentById(accountTypesOptions.items, parseInt(value)).name
        }
      }))
    }

    setUpdateAccData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const verifyData = (id) => {
    console.log(parseInt(id))
    if (parseInt(id) >= 0) {
      return true
    } else {
      setAlert('Los últimos dígitos de la cuenta deben ser solo números.', false, 'text-white', 'bg-red-500', 4000)
      return false
    }
  }

  const onSubmitUpdate = async (e) => {
    e.preventDefault();
    setLoadingUpdate(true)
    const passData = verifyData(updateAccountData.last_four_digits)
    console.log(passData)

    if (passData === true) {
      if (updateAccountData.automated === false) {
        updateAccountData.gmailPersonalEmail = null
      }
      let email_id = ""

      if (updateAccountData.gmailPersonalEmail && updateAccountData.gmailPersonalEmail.id) {
        email_id = parseInt(updateAccountData.gmailPersonalEmail.id)
      }

      const updated = await update_account(
        parseInt(detailInfo.id),
        updateAccountData.name,
        parseInt(updateAccountData.accountType),
        updateAccountData.last_four_digits,
        parseInt(updateAccountData.bankId),
        parseFloat(formatedCurrToNumber(updateAccountData.initia_balance_amount)),
        email_id,
        updateAccountData.currency !== originalCurrency ? updateAccountData.currency : undefined)

      console.log("updated: ", updated)

      if (updated === 200) {
        setIsFailed(false)
        get_user_accounts(0, 20)
        setUpdatedSuccess(true)
        setAlert("Cuenta actualizada con exito!!", true, "", "", 2500)
        setLoadingUpdate(false)
        setTimeout(() => {
          handleClosePopUp()
        }, 2000)
        setTimeout(() => {
          handleClosePopUp()
          setUpdatedSuccess(false)
          setOpenEditAcc(false)
        }, 2500)

      } else {
        setIsFailed(true)
        setLoadingUpdate(false)
        if (updated === 409) {
          setAlert("Está cuenta ya existe!", false, "text-white", "bg-red-500", 4000)
        } else if (updated === 400) {
          setAlert("La cuenta no fue actualizada, no hay data para actualizar!", false, "text-white", "bg-red-500", 4000)
        } else {
          setAlert("La cuenta no fue actualizada, intenta de nuevo!", false, "text-white", "bg-red-500", 4000)
        }


      }
    } else {
      setLoadingUpdate(false)
    }
  }


  return (

    <>
      {detailInfo ?
        <>
          {updatedSuccess ?
            <>
              <Alert2 />
            </>
            :
            <>
              <EditCreateFinAccountForm
                createAccountData={updateAccountData}
                setCreateAccountData={setUpdateAccData}
                onChangeCreate={onChangeCreate}
                banks={banks}
                accountTypesOptions={accountTypesOptions}
                automatedEmails={automatedEmails}
                currencyLocked={Boolean(detailInfo.has_transactions)}
              />
              <AccountCurrencyTools account={detailInfo} setDetailInfo={setDetailInfo} onCurrencyChanged={onCurrencyChanged} />

              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpenEditAcc(false)} disabled={loadingUpdate}>Cancelar</Button>
                <Button icon={CheckIcon} loading={loadingUpdate} onClick={e => onSubmitUpdate(e)}>Guardar cambios</Button>
              </div>
            </>
          }
        </>
        :
        <></>
      }


    </>
  )
}


const mapStateToProps = state => ({
  user_categories: state.CashFlow.user_categories,
  user_accounts: state.CashFlow.user_accounts,
  accountTypesOptions: state.CashFlow.account_types,
  banks: state.CashFlow.banks.items,
  automatedEmails: state.Conexions.automated_emails.emails
})

export default connect(mapStateToProps, {
  get_user_accounts,
  update_account,
  setAlert

})(EditAccounts)