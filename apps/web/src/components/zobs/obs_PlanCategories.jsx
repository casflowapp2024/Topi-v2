import Layout from "../../hocs/Layout"
//redux
import { connect, useSelector } from 'react-redux';
import { get_user_categories, create_category} from "../../redux/actions/cashflow";
import { get_expenses_report } from "../../redux/actions/reports";

import { Fragment, use, useEffect, useState } from "react";
import { CheckCircleIcon, ChevronRightIcon, EnvelopeIcon } from '@heroicons/react/20/solid'

//components
import SearchBar from "../navigation/SearchBar";
import CreateCategory from "../expensePlan/CreateCategory";
import EditCategory from "../expensePlan/EditCategory";
import { formatCurrency, capitalizeWords, getPerc2, findElmentById } from "../helpers";

//third components
import { PlusIcon, CreditCardIcon, DocumentCurrencyDollarIcon } from '@heroicons/react/20/solid'
import { ThreeDots } from 'react-loader-spinner';
import { Menu ,Popover, Transition, Dialog, DialogTitle, TransitionChild, DialogPanel } from '@headlessui/react'



const PlanCategories = ({
  isAuthenticated,
  get_user_categories, user_categories,
  create_category,
  get_expenses_report, expenses_report

}) => {

    //load categories

    const [loadedAccounts, setLoadedCategories] = useState(false)
    const [loadingPages, setLoadingPages] = useState(false)
    const [skipPage, setSkipPage] = useState(0)

    useEffect(() => {
      setLoadingPages(true)
      get_user_categories(0,20)
      get_expenses_report()
    }, []);


    useEffect (() => {
      setLoadingPages(false)
      setLoadedCategories(true)
    }, [user_categories]);


    //create category
  
    const [openCreateBox, setOpenCreateBox] = useState(false)


    //Edit Open
    const [openEditCat, setOpenEditCat] = useState(false)
    const [detailInfo, setDetailInfo] = useState(null)
    const userCategories = useSelector(state => state.CashFlow.user_categories)
    
    const handleOpenEditCat =  async (categoryId) => {
      console.log(categoryId)
        const selectedCat = findElmentById(user_categories.items, categoryId)
        setDetailInfo(selectedCat)
        setOpenEditCat(true)
        console.log('opening')
    }    

     const findCategoryInReportsById = (elements, id) => {
      const element = elements.find(element => element.category_id === id);
      return element ? element: null; // Return the name if found, otherwise null
    };

    const getExpensesCategoryByCategoryId = (elements, id) => {
      const element = elements.find(element => element.category_id === id);
      return element ? element.expenses : null; // Return the name if found, otherwise null
    };

    const getPerExpensesCategoryByCategoryId = (elements, id) => {
      const element = elements.find(element => element.category_id === id);
      return element ? element.usage : null; // Return the name if found, otherwise null
    };

    return(
      <>
        <Layout>

          <div className="top-0 text-gray-700 flex justify-center w-full">

            <div className="py-6 sm:w-[550px] lg:w-[670px] xl:w-[930px] top-0">
              <div className="text-gray-700 flex justify-center items-center w-full">
              
                <div className="flex flex-col justify-center w-full">
                  <SearchBar contexto="Categoria"/>

                  {/* botones */}
                  <div className="flex flex-row mt-5 w-full">
                    <h2 className="text-2xl mr-5">Plan de Gastos</h2>
                    <button className="text-sm px-4 flex flex-row items-center bg-slate-100 rounded-full border hover:border-[#5266EB] hover:bg-slate-200 group"
                    onClick={setOpenCreateBox}>
                      <PlusIcon className="w-4 h-4 mr-2 group-hover:text-[#5266EB]"/>
                      <span className="pr-2">
                        Crear Categoria
                      </span>
                    </button>

                  </div>

                  {/* lista */}
                  <div className="mt-2 w-full">
                    <>
                    {loadingPages?
                      <div 
                        class="h-[500px] w-full text-[#5266EB] text-center flex justify-center items-center">
                          <div className='flex justify-center items-center'>
                              <ThreeDots
                              height="20"
                              width="20"
                              color="white"
                              ariaLabel="loading"
                              />
                          </div>
                        </div>
                      :
                      <>
                      {user_categories?

                      <ul role="list" class="">
                        {user_categories.items&&user_categories.items.map((category) => (
                        <li key={category.id} class="my-2 py-2 sm:py-2 px-1 border border-gray-200 rounded-md bg-white">
                          <div className="flex flex-row ">
                            <div className="w-[80px] flex items-center justify-center">

                              <CreditCardIcon className="w-10 h-10 text-gray-200"/>

                            </div>
                            <div className="w-full">
                              <div className="flex flex-row justify-between">
                                  <h3 className="text-sm font-semibold text-gray-700 mb-1">{capitalizeWords(category.name)}</h3>
                                  <div className="flex flex-col items-center justify-end">
                                    
                                    <span className='font-light text-xs'>
                                        08/25/2025
                                    </span>
                                  
                                    
                                  </div>
                              </div>
                              <div class="flex flex-row items-center justify-between py-1">
                                  <div className='font-medium'>
                                      {expenses_report&&findCategoryInReportsById(expenses_report,category.id)!== null?
                                          <span className='text-sm'>{formatCurrency(getExpensesCategoryByCategoryId(expenses_report,category.id))}</span>
                                          :
                                          <span className='text-sm'>0</span>
                                      }
                                      <span className='text-[10px] text-gray-400'>/{formatCurrency(category.budget)}</span>
                                  </div>
                                  <span className="text-sm font-medium text-[#5266EB]">
                                    {expenses_report&&findCategoryInReportsById(expenses_report,category.id)!== null?
                                          <span className='text-sm'>{getPerExpensesCategoryByCategoryId(expenses_report,category.id)}%</span>
                                          :
                                          <span className='text-sm'>0%</span>
                                      }
                                  </span>
                                  
                              </div>
                              <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                  {expenses_report&&findCategoryInReportsById(expenses_report,category.id)!== null?
                                      <div
                                      className="bg-[#5266EB] h-full"
                                      style={{ width: getPerc2(getPerExpensesCategoryByCategoryId(expenses_report,category.id))}}
                                      ></div>
                                      :
                                      <div
                                      className="bg-[#5266EB] h-full"
                                      style={{ width: "0%"}}
                                      ></div>
                                  }
                              </div>
                              <button 
                              onClick={() => handleOpenEditCat(category.id)}
                              class="w-full mt-1 pr-2 text-xs flex justify-end font-medium text-gray-600 hover:underline dark:text-blue-500">
                                  <span className="text-right">Editar </span>
                                  {/* <ChevronRightIcon className='w-4 h-4'/> */}
                              </button>
                              
                            </div>


                          </div>
                        </li>
                        ))}
                      </ul>
                      
                      :
                      <div>
                        Crea alguna cuenta para llevar registro de tus balances... 

                      </div>
                      }
                        
                        </>


                      }
                    
                    </>
                    

                  </div>


                  <h2 className="text-2xl mr-5 mt-5">Presupuesto de Ingresos</h2>
                  <div className="mt-2 w-full">
                  {user_categories?

                    <ul role="list" class="">
                      {user_categories.items&&user_categories.items.map((category) => (
                      <li key={category.id} class="my-2 py-2 sm:py-2 px-1 border border-gray-200 rounded-md bg-white">
                        <div className="flex flex-row ">
                          <div className="w-[80px] flex items-center justify-center">

                            <CreditCardIcon className="w-10 h-10 text-gray-200"/>

                          </div>
                          <div className="w-full">
                            <div className="flex flex-row justify-between">
                                <h3 className="text-sm font-semibold text-gray-700 mb-1">{capitalizeWords(category.name)}</h3>
                                <div className="flex flex-col items-center justify-end">
                                  
                                  <span className='font-light text-xs'>
                                      08/25/2025
                                  </span>
                                  
                                </div>
                            </div>
                            <div class="flex flex-row items-center justify-between py-1">
                                <div className='font-medium'>
                                    {expenses_report&&findCategoryInReportsById(expenses_report,category.id)!== null?
                                        <span className='text-sm'>{formatCurrency(getExpensesCategoryByCategoryId(expenses_report,category.id))}</span>
                                        :
                                        <span className='text-sm'>0</span>
                                    }
                                    <span className='text-[10px] text-gray-400'>/{formatCurrency(category.budget)}</span>
                                </div>
                                <span className="text-sm font-medium text-[#5266EB]">
                                  {expenses_report&&findCategoryInReportsById(expenses_report,category.id)!== null?
                                        <span className='text-sm'>{getPerExpensesCategoryByCategoryId(expenses_report,category.id)}%</span>
                                        :
                                        <span className='text-sm'>0%</span>
                                    }
                                </span>
                                
                            </div>
                            <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                {expenses_report&&findCategoryInReportsById(expenses_report,category.id)!== null?
                                    <div
                                    className="bg-[#5266EB] h-full"
                                    style={{ width: getPerc2(getPerExpensesCategoryByCategoryId(expenses_report,category.id))}}
                                    ></div>
                                    :
                                    <div
                                    className="bg-[#5266EB] h-full"
                                    style={{ width: "0%"}}
                                    ></div>
                                }
                            </div>
                            <button 
                            onClick={() => handleOpenEditCat(category.id)}
                            class="w-full mt-1 pr-2 text-xs flex justify-end font-medium text-gray-600 hover:underline dark:text-blue-500">
                                <span className="text-right">Editar </span>
                                {/* <ChevronRightIcon className='w-4 h-4'/> */}
                            </button>
                            
                          </div>


                        </div>
                      </li>
                      ))}
                    </ul>
                    :<></>
                    }


                  </div>
                 


                </div>
            
              </div>
            </div>

              {/*Modal Create category*/}

              <CreateCategory
              openCreateBox={openCreateBox}
              setOpenCreateBox={setOpenCreateBox}
              
              />

              {/*Modal Edit category*/}
              {detailInfo?
              <EditCategory
              openEditCat = {openEditCat}
              setOpenEditCat = {setOpenEditCat}
              detailInfo = {detailInfo}
              setDetailInfo = {setDetailInfo}            
              />
              :
              <></>
              }
          </div>
              
        </Layout>
          
      </>
    )
}

const mapStateToProps = state => ({
  isAuthenticated: state.Auth.isAuthenticated,
  user_categories: state.CashFlow.user_categories,
  expenses_report: state.Reports.expenses_report,


})

export default connect(mapStateToProps,{
  get_user_categories,
  create_category,
  get_expenses_report
}) (PlanCategories)
