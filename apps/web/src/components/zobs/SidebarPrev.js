/* This example requires Tailwind CSS v2.0+ */
import { useEffect, useState } from 'react'
import { Link, useNavigate} from 'react-router-dom';

//redux
import { connect } from 'react-redux'
import { load_user, logout, request_init_categories } from '../../redux/actions/auth';

//icons
import {
  Bars3Icon,
  

} from '@heroicons/react/24/solid'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import {ReactComponent as Cflogo} from '../../assets/logos/CFlogo0.svg'


//365486 AZUL
//7FC7D9 CIELO
//E5E1DA BLANCO
//DCF2F1

function Sidebar({
  
  logout,
  load_user,user,
  user_accounts,
  isAuthenticated,
  user_transactions,
  user_categories,
  request_init_categories
}) {

  
//LOGOUT

  const navigate = useNavigate();
  const handleLogout=()=>{
      //setOpenLogoutBox(false)
      logout()
      navigate("/")
  }


  const [countUserTransactions, setCountUserTransactions] = useState(0)

    useEffect(() => {
      if (user_transactions.items){
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

  useEffect (() => {
      if (user_categories.length === 0) {
        request_init_categories()
      }
      }, [user_categories]);

  return (
    
      <>
        <div className="z-30 w-72 fixed h-screen flex flex-col py-2 bg-slate-50 border-r-2 border-[#e9e8ee] overflow-y-auto transition-transform -translate-x-full md:translate-x-0" aria-label="Sidebar">
          {/* Header */}
          <div className="flex flex-row items-center gap-1 p-4  text-xl font-semibold text-[#5266EB]">
            {/* <OfficeBuildingIcon className="w-6 h-6" /> */}
            <Cflogo className='w-7 h-7'/>
            <span className='font-Inter'>CashFlow</span>
          </div>

          {/* Navigation */}
          <div class="flex-grow">
            <div class="h-full px-3 py-4 overflow-y-auto bg-gray-50 dark:bg-gray-800">
              <ul class="relative flex flex-col h-full">
                {/* arriba */}
                <div className='space-y-4 font-medium'>

                  <li>
                      <Link to="/dashboard" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6.025A7.5 7.5 0 1 0 17.975 14H10V6.025Z"/>
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 3c-.169 0-.334.014-.5.025V11h7.975c.011-.166.025-.331.025-.5A7.5 7.5 0 0 0 13.5 3Z"/>
                      </svg>


                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Dashboard</span>
                      </Link>
                  </li>
                  <li>
                      <Link to="/transactions/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 3v4a1 1 0 0 1-1 1H5m8-2h3m-3 3h3m-4 3v6m4-3H8M19 4v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1ZM8 12v6h8v-6H8Z"/>
                      </svg>

                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Transacciones</span>
                        {countUserTransactions>0?
                        <span class="w-[85px] text-center truncate px-1 ms-1 text-sm font-medium text-[#5266EB] bg-blue-50 rounded-full dark:bg-gray-700 dark:text-gray-300">{countUserTransactions} Nuevas</span>
                        :<></>
                        }
                      </Link>
                  </li>
                  <li>
                      <Link to="/accounts/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M3 21h18M4 18h16M6 10v8m4-8v8m4-8v8m4-8v8M4 9.5v-.955a1 1 0 0 1 .458-.84l7-4.52a1 1 0 0 1 1.084 0l7 4.52a1 1 0 0 1 .458.84V9.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5Z"/>
                    </svg>

                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Cuentas y Productos</span>
                        {user_accounts.items?
                        <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-gray-900 bg-gray-200 rounded-full dark:bg-blue-900 dark:text-blue-300">{user_accounts.total}</span>
                        :<></>
                        }
                      </Link>
                  </li>
                  <li>
                      <Link to="/plan/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8H5m12 0a1 1 0 0 1 1 1v2.6M17 8l-4-4M5 8a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.6M5 8l4-4 4 4m6 4h-4a2 2 0 1 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z"/>
                      </svg>

                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Presupuestos</span>
                        {user_categories.items?
                        <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-gray-900 bg-gray-200 rounded-full dark:bg-blue-900 dark:text-blue-300">{user_categories.total}</span>
                        :<></>
                        }
                      </Link>
                  </li>
                  {/* <div className="flex flex-row items-center gap-1 py-2 border-b-2 border-[#e9e8ee]"></div> */}
                  {/* <li>
                      <Link to="/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.122 17.645a7.185 7.185 0 0 1-2.656 2.495 7.06 7.06 0 0 1-3.52.853 6.617 6.617 0 0 1-3.306-.718 6.73 6.73 0 0 1-2.54-2.266c-2.672-4.57.287-8.846.887-9.668A4.448 4.448 0 0 0 8.07 6.31 4.49 4.49 0 0 0 7.997 4c1.284.965 6.43 3.258 5.525 10.631 1.496-1.136 2.7-3.046 2.846-6.216 1.43 1.061 3.985 5.462 1.754 9.23Z"/>
                      </svg>
                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Mejora tu Membresía</span>
                      </Link>
                  </li> */}
                </div>


                {/* abajo */}
                <div className='absolute bottom-0 space-y-4 font-medium'>
                  <div className="flex flex-row items-center gap-1 py-2 border-b-2 border-[#e9e8ee]"></div>
                  {/* <li>
                      <Link to="/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13H7a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12M9 3v14m7 0v4"/>
                    </svg>


                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Documentacion</span>
                      </Link>
                  </li> */}
                  <li class="px-2">
                    {/* <div class="flex flex-row items-center h-8">
                      <div class="text-sm font-light tracking-wide text-gray-500">Configuración</div>
                    </div> */}
                  </li>
                  <li>
                      <Link to="/settings/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                        <Cog6ToothIcon className='w-6 h-6'/>
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
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 18V6h-5v12h5Zm0 0h2M4 18h2.5m3.5-5.5V12M6 6l7-2v16l-7-2V6Z"/>
                      </svg>

                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Cerrar Sesión</span>
                      </div>
                  </li>
                </div>
              </ul>
            </div>
          </div>
        </div>
        
        {/* mobile top */}
        <div className='block md:hidden z-50 fixed bg-white w-screen border-b border-[#5266EB]'>
          <div className="flex flex-row items-center justify-between p-4  text-xl font-semibold">
            <div className='flex flex-row justify-start items-center gap-1 text-[#5266EB]'>
              <Cflogo className='w-6 h-6'/>
              <Link to="/dashboard" className='font-Inter text-base'>CashFlow</Link>
            </div>
            <button
            onClick={()=>setMenuMobileOpen(true)}>
              <Bars3Icon
              className='w-5 h-5 text-[#5266EB]'
              />
              
            </button>
          </div>
        </div>

        {/* Navigation mobil */}
        <div class={`${menuMobilOpen===false?'hidden':''} fixed z-50 top-0 right-0 w-[80%] h-screen bg-white transform transition-transform duration-300 ease-in-out ${menuMobilOpen ? 'translate-x-0' : 'translate-x-full'} mobile-sidebar`}>
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
                  <li>
                      <Link to="/dashboard" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6.025A7.5 7.5 0 1 0 17.975 14H10V6.025Z"/>
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 3c-.169 0-.334.014-.5.025V11h7.975c.011-.166.025-.331.025-.5A7.5 7.5 0 0 0 13.5 3Z"/>
                      </svg>
                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Dashboard</span>
                      </Link>
                  </li>
                  <li>
                      <Link to="/transactions/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 3v4a1 1 0 0 1-1 1H5m8-2h3m-3 3h3m-4 3v6m4-3H8M19 4v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1ZM8 12v6h8v-6H8Z"/>
                      </svg>
                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Transacciones</span>
                        {countUserTransactions>0?
                        <span class="w-[85px] text-center truncate px-1 ms-1 text-sm font-medium text-blue-800 bg-blue-100 rounded-full dark:bg-gray-700 dark:text-gray-300">{countUserTransactions} N</span>
                        :<></>
                        }
                      </Link>
                  </li>
                  <li>
                      <Link to="/accounts/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M3 21h18M4 18h16M6 10v8m4-8v8m4-8v8m4-8v8M4 9.5v-.955a1 1 0 0 1 .458-.84l7-4.52a1 1 0 0 1 1.084 0l7 4.52a1 1 0 0 1 .458.84V9.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5Z"/>
                    </svg>

                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Cuentas y Productos</span>
                        {user_accounts.items?
                        <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-gray-800 bg-gray-200 rounded-full dark:bg-blue-900 dark:text-blue-300">{user_accounts.items.length}</span>
                        :<></>
                        }
                      </Link>
                  </li>
                  <li>
                      <Link to="/plan/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      <svg class="w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8H5m12 0a1 1 0 0 1 1 1v2.6M17 8l-4-4M5 8a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.6M5 8l4-4 4 4m6 4h-4a2 2 0 1 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z"/>
                      </svg>

                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Presupuestos</span>
                        {user_categories.items?
                        <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-gray-800 bg-gray-200 rounded-full dark:bg-blue-900 dark:text-blue-300">{user_categories.items.length}</span>
                        :<></>
                        }
                      </Link>
                  </li>
                </ul>
              </div>
              <div class="border-t border-[#e9e8ee] px-3 py-4">
                <ul class="space-y-4">
                  <li>
                      <Link to="/settings/" class="flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
                      
                        <Cog6ToothIcon className='w-6 h-6'/>
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
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 18V6h-5v12h5Zm0 0h2M4 18h2.5m3.5-5.5V12M6 6l7-2v16l-7-2V6Z"/>
                      </svg>
                        <span class="flex-1 ms-3 whitespace-nowrap font-Inter">Cerrar Sesión</span>
                      </div>
                  </li>
                  <li className='h-6'>

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

export default connect(mapStateToProps,{
  logout,
  load_user,
  request_init_categories

}) (Sidebar)