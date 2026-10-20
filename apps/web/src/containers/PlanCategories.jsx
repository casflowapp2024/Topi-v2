import Layout from "../hocs/Layout"
//redux
import { connect, useSelector } from 'react-redux';
import { get_user_categories, create_category } from "../redux/actions/cashflow";
import { get_expenses_report } from "../redux/actions/reports";

import { useEffect, useState } from "react";

//components
import CreateCategory from "../components/expensePlan/CreateCategory";
import EditCategory from "../components/expensePlan/EditCategory";
import SummaryCategories from "../components/zobs/SummaryCategories";
import { formatCurrency, capitalizeWords, findElmentById } from "../components/helpers";

//third components
import { PlusIcon } from '@heroicons/react/20/solid'
import { ThreeDots } from 'react-loader-spinner';
import { Emoji } from "emoji-picker-react";


const PlanCategories = ({
  get_user_categories, user_categories,
  create_category

}) => {

  //load categories

  const [loadedAccounts, setLoadedCategories] = useState(false)
  const [loadingPages, setLoadingPages] = useState(false)

  useEffect(() => {
    setLoadingPages(true)
    get_user_categories(0)
  }, []);


  useEffect(() => {
    setLoadingPages(false)
    setLoadedCategories(true)
  }, [user_categories]);


  //create category

  const [openCreateBox, setOpenCreateBox] = useState(false)


  //Edit Open
  const [openEditCat, setOpenEditCat] = useState(false)
  const [detailInfo, setDetailInfo] = useState(null)
  const userCategories = useSelector(state => state.CashFlow.user_categories)

  const handleOpenEditCat = async (categoryId) => {
    console.log(categoryId)
    const selectedCat = findElmentById(user_categories.items, categoryId)
    setDetailInfo(selectedCat)
    setOpenEditCat(true)
    console.log('opening')
  }

  const findCategoryInReportsById = (elements, id) => {
    const element = elements.find(element => element.category_id === id);
    return element ? element : null; // Return the name if found, otherwise null
  };

  const getExpensesCategoryByCategoryId = (elements, id) => {
    const element = elements.find(element => element.category_id === id);
    return element ? element.expenses : null; // Return the name if found, otherwise null
  };

  const getPerExpensesCategoryByCategoryId = (elements, id) => {
    const element = elements.find(element => element.category_id === id);
    return element ? element.usage : null; // Return the name if found, otherwise null
  };

  return (
    <>
      <Layout>

        <div className="top-0 text-gray-700 flex justify-center w-full">
          <div className="p-2 w-screen md:w-auto">
            <div className="md:w-[670px] xl:w-[930px] top-0">
              <div className="text-gray-700 flex justify-center items-center w-full">

                <div className="flex flex-col justify-center w-full">
                  <h2 className="text-2xl mr-5">Presupuestos</h2>

                  <SummaryCategories />



                  {/* botones */}
                  <div className="flex flex-col gap-4 md:gap-0 md:flex-row mt-4 w-full">
                    <button className=" md:h-auto h-10 text-sm px-4 flex flex-row items-center bg-slate-100 rounded-full border hover:border-[#5266EB] hover:bg-slate-200 group"
                      onClick={setOpenCreateBox}>
                      <PlusIcon className="w-4 h-4 mr-2 group-hover:text-[#5266EB]" />
                      <span className="pr-2">
                        Crear Categoria
                      </span>
                    </button>

                  </div>

                  {/* lista */}
                  <div className="px-2 mt-6 w-full">
                    <>
                      {loadingPages ?
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
                          {user_categories ?

                            <ul role="list" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                              {user_categories.items && user_categories.items.map((category) => (
                                <>
                                  {!category.isDefault ?
                                    <li
                                      key={category.id}
                                      onClick={() => handleOpenEditCat(category.id)}
                                      class="py-2  px-1 flex flex-col border border-gray-200 rounded-2xl bg-white hover:bg-gray-200 cursor-pointer">

                                      <div className="flex flex-row ">
                                        <div className="w-[65px] flex items-center justify-center">

                                          {/* <span className="text-[26px]">{category.emoji}</span> */}

                                          <Emoji unified={(category.emoji).toLowerCase()} emojiStyle="apple" size={24} />

                                        </div>
                                        <div className="flex flex-row justify-between">
                                          <div className="w-full">
                                            <div className="flex flex-row justify-between">
                                              <h3 className="text-sm font-semibold text-gray-700 mb-1">{capitalizeWords(category.name)}</h3>
                                            </div>
                                            <span className='text-[20px] text-[#5266EB]'>{formatCurrency(category.budget)}</span>

                                          </div>

                                        </div>
                                      </div>
                                    </li> : <></>
                                  }
                                </>
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
          {detailInfo ?
            <EditCategory
              openEditCat={openEditCat}
              setOpenEditCat={setOpenEditCat}
              detailInfo={detailInfo}
              setDetailInfo={setDetailInfo}
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
  user_categories: state.CashFlow.user_categories,
})

export default connect(mapStateToProps, {
  get_user_categories,
  create_category
})(PlanCategories)
