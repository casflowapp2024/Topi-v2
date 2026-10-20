import { useState, useEffect } from 'react'

//redux
import { connect } from 'react-redux'
import { get_user_accounts, update_account } from '../../redux/actions/cashflow';
import { setAlert } from '../../redux/actions/alert';
//components
import { findElmentById, formatCurrency, formatedCurrToNumber } from '../helpers';
import EditCreateFinAccountForm from './EditCreateFinAccountForm';
import { ThreeDots } from 'react-loader-spinner';
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
  });

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
      alert('Los Digitos de la cuenta deben ser números!!')
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
        email_id)

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

  useEffect(() => {
    console.log("updateAccountData: ", updateAccountData);
  }, [updateAccountData]);

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
              />

              <div className="w-ful mt-12 justify-items-center items-center flex flex-row justify-around" >
                {loadingUpdate ?
                  <div className='flex justify-center items-center'>
                    <ThreeDots
                      height="70"
                      width="70"
                      color="#5266EB"
                      ariaLabel="loading"
                    />
                  </div>
                  :
                  <>
                    <button
                      onClick={e => onSubmitUpdate(e)}
                      className='text-white bg-[#5266EB] hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800'>
                      Actualizar
                    </button>
                    <button
                      onClick={e => setOpenEditAcc(false)}
                      className='rounded-lg w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 dark:text-gray-300 transition-colors'>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                      </svg>

                    </button>
                  </>
                }

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