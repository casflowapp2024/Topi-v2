import { useEffect, useState } from "react";
//redux
import { connect} from 'react-redux';
import { get_user_accounts } from "../redux/actions/cashflow";
import { get_financial_report } from "../redux/actions/reports";
import { setAlert } from "../redux/actions/alert";
//components
import Layout from "../hocs/Layout"
import AccountDetail from "../components/accounts/AccountDetail";
import AccountCreate from "../components/accounts/AccountCreate";
/* import LinkTransEmail from "../components/accounts/LinkTransEmail"; */
import { PlusIcon, CreditCardIcon, DocumentCurrencyDollarIcon } from '@heroicons/react/20/solid'
import { findElmentById } from "../components/helpers";
import { get_account_types } from "../redux/actions/cashflow";
import { get_automated_emails } from "../redux/actions/conexions";
import {get_savings_account} from "../redux/actions/reports";

const Accounts = ({

  get_user_accounts, user_accounts,
  get_financial_report, balance,
  get_account_types,
  get_automated_emails,
  banks,
  get_savings_account
    
}) => {

    /* const [loadedAccounts, setLoadedAccounts] = useState(false)
    const [loadingPages, setLoadingPages] = useState(false)
    const [skipPage, setSkipPage] = useState(0) */

    //////CARGAR FINANCIAL REPORTS PARA CUENTAS DE AHORRO///////////////

    useEffect (() => {
      /* setLoadingPages(false)
      setLoadedAccounts(true) */
      get_account_types(0,20)
      get_savings_account()
    
    }, [user_accounts]);

    //////////////////////////////////////////////////////////////////7
    //////CREAR CUENTAS//////////////////////////////77///////////////
    
    const [openCreateBox, setOpenCreateBox] = useState(false)
   
    ///////////////////////////////////////////////////////////////77
    /////////////OPEN DETAIL////////////////////////////////77777

      const [detailInfo, setDetailInfo] = useState(null)
      const [openAccDetail, setOpenAccDetail] = useState(false)

      const handleOpenAccDetail = (AccId) => {
          const selectedAcc = findElmentById(user_accounts.items, AccId)
          setDetailInfo(selectedAcc)
          setOpenAccDetail(true);
          //setTransCreated(false);
      }

    
    return(
      <>
        <Layout>
            <div className="top-0 text-gray-900 flex justify-center w-full">
            <div className="w-screen md:w-[500px] lg:w-[670px] xl:w-[930px] top-0">
              <div className="p-2">
                <div className="flex justify-center items-center w-full">
                
                  <div className="flex flex-col justify-center w-full">
                    {/* <SearchBar contexto="Cuentas"/> */}

                    {/* botones */}
                    <div className="flex flex-col gap-4 xl:gap-0 xl:flex-row justify-between mt-5 w-full">
                      <div className="flex flex-col gap-4 xl:gap-0 xl:flex-row">
                        <h2 className="text-2xl mr-5">Cuentas y Productos</h2>
                        <button className="xl:h-auto h-10 text-sm px-4 flex flex-row items-center bg-slate-100 rounded-full border hover:border-[#5266EB] hover:bg-slate-200 group"
                        onClick={setOpenCreateBox}>
                          <PlusIcon className="w-4 h-4 mr-2 group-hover:text-[#5266EB]"/>
                          <span className="pr-2">
                            Adicionar Producto
                          </span>
                        </button>
                      </div>


                    </div>

                    {/* cuentas */}
                    <div className="my-5 w-full bg-white border border-gray-200 rounded-2xl shadow">
                      <>

                        {user_accounts.items&&user_accounts.items.length>0?
                        <div>
                          <ul class="divide-y divide-gray-200 dark:divide-gray-700">

                            {user_accounts.items&&user_accounts.items.map((account) => (
                            <li 
                            key={account.id} 
                  
                            onClick={() => handleOpenAccDetail(account.id)}
                            class="p-4 cursor-pointer hover:bg-gray-200">
                                <div class="flex items-center">
                                    <div class="flex-shrink-0">
                                        <div className='w-8 h-8 flex justify-center items-center rounded-full bg-[#5266EB]'>
                                            {account.type.id === 1?
                                            <DocumentCurrencyDollarIcon className='h-6 w-6 text-white'/>
                                            :
                                            <CreditCardIcon className='h-6 w-6 text-white'/>

                                            }
                                        </div>
                                    </div>
                                    <div class="flex-1 min-w-0 ms-4">
                                        <p class="text-sm font-medium text-gray-900 truncate dark:text-white">
                                        {account.name}
                                        </p>
                                        <p class="text-sm text-gray-500 truncate dark:text-gray-400">
                                        ****{account.last_four_digits}
                                        </p>
                                    </div>
                                    <div class="flex flex-col items-right text-base font-semibold text-gray-900 dark:text-white">
                                      <span className="text-right">{account.bank.name}</span>
                                      <span className="text-right">{account.type.name}</span>
                                      
                                    </div>
                                </div>
                            </li>
                            ))}
                          </ul>

                        </div>
                        :
                        <div>
                          Crea alguna cuenta para llevar registro de tus balances... 

                        </div>
                        }
                          
                      
                      </>
                      

                    </div>

                    
                    {/* bANCOS */}
                    {/* <div className="my-3 mb-10 flex flex-col justify-between">
                        
                      <h2 className="text-2xl my-4">Bancos</h2>

                      <div className="flex flex-col items-start gap-2 w-full">

                        {banks&&banks.map((bank) => (
                          <>
                            {!bank.isDefault?

                            <div 
                                key={bank.id} 
                                className='pl-4 py-2 flex flex-row justify-between text-sm gap-4 w-full hover:bg-gray-100'>

                                <span className=''>
                                  {bank.name} - {bank.email}
                                </span>
                              
                                <button 
                                className='border border-red-600 text-red-600 flex items-center justify-center rounded-md hover:bg-gray-300'
                                //onClick={()=>onClickDeleteCloseOpen(bank)}
                                >
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                    </svg>
                                </button>
                            </div>:<></>
                            }
                          </>

                        ))}
                      </div>


                    </div> */}


                  </div>
              
                </div>
              </div>
            </div>
              
              {/*PopOver Create accounts*/}
              <AccountCreate
              openCreateBox={openCreateBox}
              setOpenCreateBox={setOpenCreateBox}
              />

              {/*PopOver Detail Accounts*/}
              <AccountDetail
              openAccDetail={openAccDetail}
              setOpenAccDetail={setOpenAccDetail}
              detailInfo={detailInfo}
              setDetailInfo={setDetailInfo}
              />

            </div>
        </Layout>
          
      </>
    )
}

const mapStateToProps = state => ({
  isAuthenticated: state.Auth.isAuthenticated,
  user_accounts: state.CashFlow.user_accounts,
  balance: state.Reports.balance,
  automated_emails: state.Conexions.automated_emails,
  banks: state.CashFlow.banks.items,

})

export default connect(mapStateToProps,{
  get_user_accounts,
  get_financial_report,
  get_account_types,
  get_automated_emails,
  setAlert,
  get_savings_account
}) (Accounts)
