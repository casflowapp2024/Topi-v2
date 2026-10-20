/* This example requires Tailwind CSS v2.0+ */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom';

//redux
import { connect } from 'react-redux'
import { load_user, logout, request_init_categories } from '../../redux/actions/auth';

//icons
import {
  Bars3Icon,

} from '@heroicons/react/24/solid'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { ReactComponent as Cflogo } from '../../assets/logos/T1.svg'

import {
  CreditCardIcon,
  TagIcon,
  BanknotesIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

//365486 AZUL
//7FC7D9 CIELO
//E5E1DA BLANCO
//DCF2F1

function Sidebar({

  logout,
  load_user, user,
  user_accounts,
  isAuthenticated,
  user_transactions,
  user_categories,
  request_init_categories
}) {


  //LOGOUT

  const navigate = useNavigate();
  const handleLogout = () => {
    //setOpenLogoutBox(false)
    logout()
    navigate("/")
  }


  const [countUserTransactions, setCountUserTransactions] = useState(0)

  useEffect(() => {
    if (user_transactions.items) {
      //count user transactions that should verify
      const count = user_transactions.news
      setCountUserTransactions(count)
    }
  }, [user_transactions])



  //MOBIL
  const [menuMobilOpen, setMenuMobileOpen] = useState(false)

  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebar = document.querySelector('.mobile-sidebar');
      if (sidebar && !sidebar.contains(event.target) && menuMobilOpen) {
        setMenuMobileOpen(false);
      }
    };

    if (menuMobilOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuMobilOpen]);

  useEffect(() => {
    if (user_categories.length === 0) {
      request_init_categories()
    }
  }, [user_categories]);

  return (

    <>
      <div className="group fixed z-30 h-screen transition-all duration-300 w-[64px] hover:w-[265px] bg-slate-50 border-r-2 border-[#e9e8ee] overflow-hidden -translate-x-full md:translate-x-0" aria-label="Sidebar">

        <div className='absolute top-0 font-medium py-4'>
          <Link to="/dashboard" className="pl-[14px] flex flex-row items-center gap-2 text-xl font-semibold text-[#5266EB]">
            <Cflogo className='w-8 h-8' />
            <span className="font-Inter transition-all duration-300 opacity-0 group-hover:opacity-100">
              Topi
            </span>
          </Link>
        </div>
        {/* Navigation */}
        <ul class="flex flex-col  ">
          {/* arriba */}
          <div className='absolute top-[80px] w-[265px]'>
            {/* <li className='h-[50px] flex items-center'>
              <Link
                to="/dashboard"
                className="h-full w-full px-4 flex items-center text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <svg class="shrink-0 w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6.025A7.5 7.5 0 1 0 17.975 14H10V6.025Z" />
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 3c-.169 0-.334.014-.5.025V11h7.975c.011-.166.025-.331.025-.5A7.5 7.5 0 0 0 13.5 3Z" />
                </svg>
                <span className="ml-3 font-Inter transition-all duration-300 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  Dashboard
                </span>
              </Link>
            </li>
            <li className='h-[50px] flex items-center'>
              <Link
                to="/transactions/"
                class="h-full w-full px-4 flex items-center text-gray-900 rounded-lg hover:bg-gray-100">
                <svg class="shrink-0 w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 3v4a1 1 0 0 1-1 1H5m8-2h3m-3 3h3m-4 3v6m4-3H8M19 4v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1ZM8 12v6h8v-6H8Z" />
                </svg>

                <span class="ml-3 font-Inter transition-all duration-300 opacity-0 group-hover:opacity-100 whitespace-nowrap">Transacciones</span>
                {countUserTransactions > 0 ?
                  <span class="w-[85px] text-center truncate px-1 ms-1 text-sm font-medium text-[#5266EB] bg-blue-50 rounded-full dark:bg-gray-700 dark:text-gray-300">{countUserTransactions} Nuevas</span>
                  : <></>
                }
              </Link>
            </li> */}
            {/* <li className='h-[50px] flex items-center'>
              <Link
                to="/accounts/"
                class=" h-full w-full px-4 flex items-center text-gray-900 rounded-lg hover:bg-gray-100">
                <svg class="shrink-0 w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M3 21h18M4 18h16M6 10v8m4-8v8m4-8v8m4-8v8M4 9.5v-.955a1 1 0 0 1 .458-.84l7-4.52a1 1 0 0 1 1.084 0l7 4.52a1 1 0 0 1 .458.84V9.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5Z" />
                </svg>

                <span class="ml-3 font-Inter transition-all duration-300 opacity-0 group-hover:opacity-100 whitespace-nowrap">Cuentas y Productos</span>
                {user_accounts.items ?
                  <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-gray-900 bg-gray-200 rounded-full dark:bg-blue-900 dark:text-blue-300">{user_accounts.total}</span>
                  : <></>
                }
              </Link>
            </li> */}
            {/* <li className='h-[50px] flex items-center'>
              <Link
                to="/plan/"
                class="h-full w-full px-4 flex items-center text-gray-900 rounded-lg hover:bg-gray-100">

                <div className="shrink-0 w-6 h-6 text-gray-900 dark:text-white">
                  <TagIcon />
                </div>

                <span class="ml-3 font-Inter transition-all duration-300 opacity-0 group-hover:opacity-100 whitespace-nowrap">Presupuestos</span>
                {user_categories.items ?
                  <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-gray-900 bg-gray-200 rounded-full dark:bg-blue-900 dark:text-blue-300">{user_categories.total}</span>
                  : <></>
                }
              </Link>
            </li> */}
          </div>


          {/* abajo */}
          <div className='absolute bottom-0 py-4 w-[260px] border-t border-gray-300'>
            <li className='h-[50px] flex items-center'>
              <Link
                to="/settings/"
                class="h-full w-full px-4 flex items-center text-gray-900 rounded-lg hover:bg-gray-100">
                <Cog6ToothIcon className='shrink-0 w-6 h-6' />
                <span class="ml-3 font-Inter transition-all duration-300 opacity-0 group-hover:opacity-100 whitespace-nowrap">Usuario</span>
              </Link>
            </li>
            <li className='h-[50px] flex items-center cursor-pointer'>
              <div class="h-full w-full px-4 flex items-center text-gray-900 rounded-lg hover:bg-gray-100"
                onClick={handleLogout}
              >
                <svg class="shrink-0 w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 18V6h-5v12h5Zm0 0h2M4 18h2.5m3.5-5.5V12M6 6l7-2v16l-7-2V6Z" />
                </svg>
                <span class="ml-3 font-Inter transition-all duration-300 opacity-0 group-hover:opacity-100 whitespace-nowrap">Cerrar Sesión</span>
              </div>
            </li>
          </div>
        </ul>
      </div>

      {/* mobile top */}
      <div className='block md:hidden z-50 fixed bg-white w-screen border-b border-[#5266EB]'>
        <div className="flex flex-row items-center justify-between p-4  text-xl font-semibold">
          <Link to="/dashboard" className='flex flex-row justify-start items-center gap-1 text-[#5266EB]'>
            <Cflogo className='w-6 h-6' />
            <span className='font-Inter text-base'>Topi</span>
          </Link>
          <button
            onClick={() => setMenuMobileOpen(true)}>
            <Bars3Icon
              className='w-5 h-5 text-[#5266EB]'
            />

          </button>
        </div>
      </div>

      {/* Navigation mobil */}
      <div class={`${menuMobilOpen === false ? 'hidden' : ''} fixed z-50 top-0 right-0 w-[80%] h-screen bg-white transform transition-transform duration-300 ease-in-out ${menuMobilOpen ? 'translate-x-0' : 'translate-x-full'} mobile-sidebar`}>
        <div class="flex flex-col h-full">
          <div className="flex justify-between items-center p-4 border-b">
            <span className='font-Inter text-base'></span>
            <button onClick={() => setMenuMobileOpen(false)}>
              <svg class="w-5 h-5 text-[#5266EB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-3 py-4">
            <ul class="space-y-4">
              {/* arriba */}
              {/* <li>
                <Link to="/dashboard" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                  <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6.025A7.5 7.5 0 1 0 17.975 14H10V6.025Z" />
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 3c-.169 0-.334.014-.5.025V11h7.975c.011-.166.025-.331.025-.5A7.5 7.5 0 0 0 13.5 3Z" />
                  </svg>
                  <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Dashboard</span>
                </Link>
              </li>
              <li>
                <Link to="/transactions/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                  <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 3v4a1 1 0 0 1-1 1H5m8-2h3m-3 3h3m-4 3v6m4-3H8M19 4v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1ZM8 12v6h8v-6H8Z" />
                  </svg>
                  <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Transacciones</span>
                  {countUserTransactions > 0 ?
                    <span class="w-[85px] text-center truncate px-1 ms-1 text-sm font-medium text-blue-800 bg-blue-100 rounded-full dark:bg-gray-700 dark:text-gray-300">{countUserTransactions} N</span>
                    : <></>
                  }
                </Link>
              </li> */}
              {/* <li>
                <Link to="/accounts/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                  <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M3 21h18M4 18h16M6 10v8m4-8v8m4-8v8m4-8v8M4 9.5v-.955a1 1 0 0 1 .458-.84l7-4.52a1 1 0 0 1 1.084 0l7 4.52a1 1 0 0 1 .458.84V9.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5Z" />
                  </svg>

                  <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Cuentas y Productos</span>
                  {user_accounts.items ?
                    <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-gray-800 bg-gray-200 rounded-full dark:bg-blue-900 dark:text-blue-300">{user_accounts.total}</span>
                    : <></>
                  }
                </Link>
              </li> */}
              {/* <li>
                <Link to="/plan/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">

                  <div className="shrink-0 w-6 h-6 text-gray-900 dark:text-white">
                    <TagIcon />
                  </div>

                  <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Presupuestos</span>
                  {user_categories.items ?
                    <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-gray-800 bg-gray-200 rounded-full dark:bg-blue-900 dark:text-blue-300">{user_categories.total}</span>
                    : <></>
                  }
                </Link>
              </li> */}
            </ul>
          </div>
          <div class="border-t border-[#e9e8ee] px-3 py-4">
            <ul class="space-y-4">
              <li>
                <Link to="/settings/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">

                  <Cog6ToothIcon className='w-6 h-6' />
                  {/* <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.948 8.948 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                        </svg> */}
                  <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Usuario</span>
                </Link>
              </li>
              <li>
                <div class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group cursor-pointer"
                  onClick={handleLogout}
                >
                  <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 18V6h-5v12h5Zm0 0h2M4 18h2.5m3.5-5.5V12M6 6l7-2v16l-7-2V6Z" />
                  </svg>
                  <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Cerrar Sesión</span>
                </div>
              </li>
              <li className='h-16'>

              </li>
            </ul>
          </div>
        </div>
      </div>
    </>

  )
}

const mapStateToProps = state => ({
  isAuthenticated: state.Auth.isAuthenticated,
  user_accounts: state.CashFlow.user_accounts,
  user: state.Auth.user,
  user_transactions: state.CashFlow.user_transactions,
  user_categories: state.CashFlow.user_categories,
})

export default connect(mapStateToProps, {
  logout,
  load_user,
  request_init_categories

})(Sidebar)