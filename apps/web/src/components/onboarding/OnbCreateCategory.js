import { Fragment, useState, useEffect } from "react";
import { Link} from 'react-router-dom';
//components
import { get_user_categories, create_category} from "../../redux/actions/cashflow";
import Alert from '../alert';
import EditCreateCategoryForm from "../expensePlan/EditCreateCategoryForm";
import { formatedCurrToNumber, formatCurrency } from "../helpers";
import { getPerc0, getPerc2, capitalizeWords } from "../helpers";
import { Emoji } from "emoji-picker-react";
//redux
import { connect } from 'react-redux';
import { setAlert } from "../../redux/actions/alert";

import {CheckCircleIcon} from '@heroicons/react/24/outline';

const OnbCreateCategory = ({
    //actions
    get_user_categories, 
    create_category,
    setAlert,
    //state
    category_done,
}) => {

    const contextEditCreate = "create"
    const [selectedEmoji, setSelectedEmoji] = useState("")

    //create category
    const [loadingCreate, setLoadingCreate] = useState(false)
    const [createCategoryData, setCreateCategoryData] = useState({
      name :'',
      budget :'$0',
      isIncome: false,
    });
    const onChangeCreate = (e) => {
      if(e.target.name == "budget"){
        const formated_budget = formatCurrency(formatedCurrToNumber(e.target.value)); // Remove non-numeric characters except for decimal point and minus sign
        setCreateCategoryData({ ...createCategoryData, [e.target.name]: formated_budget });

      }else if(e.target.name == "isIncome"){
        setCreateCategoryData({ ...createCategoryData, [e.target.name]: e.target.checked})
      }else{
        setCreateCategoryData({ ...createCategoryData, [e.target.name]: e.target.value})
      }
    }

    const onSubmitEditCreate =  async (e) => {
        e.preventDefault();
        setLoadingCreate(true)
 
        const createResponse = await create_category(
                  createCategoryData.name, 
                  parseFloat(formatedCurrToNumber(createCategoryData.budget)), 
                  selectedEmoji, 
                  createCategoryData.isIncome)
      
        if (createResponse !== false) {

            const categoriesRetrieved = await get_user_categories(0,20)
            setLoadingCreate(false)
            setSelectedEmoji("")
            setCreateCategoryData({
              name :'',
              budget :'$0',
              isIncome: false,
            })
        }else{
          setAlert("Algo salio mal, la categoría no fue creada, intenta de nuevo!",true,"text-white","bg-red-500",3000)
          setLoadingCreate(false)
        }
      }
    /* useEffect (() => {
          //console.log(category_done)
          setAlert("Algo salio mal, la categoría no fue creada, intenta de nuevo!",true,"text-white","bg-red-500",3000)
        }, [category_done]); */
    
    const gastos = {
        title: "Seguimiento de Gastos",
        desc: "Controla tus gastos y crea presupuestos.",
        categories:[
            
            {name:"Transporte", emoji:"1f697", gastado:"$39,652", budget:"$200,000", perctg:18}
        ]
      }

    return(
      <>

      {(category_done===false)?
        <>
          <div className="flex flex-row items-center justify-around gap-6 ">
            <p className="w-1/2 text-gray-700 text-sm text-justify">
            Crea una categoría como Transporte, Entretenimiento y más para entender mejor tus gastos y asegurarte de no pasar el límite que te propusiste.
            </p>

            <div className="w-1/2">
              <ul role="list" className=" w-full">
                {gastos.categories.map((category) => (
                <li key={category.name} className="py-[5px] lg:px-1">
                    <div className="flex flex-row justify-start">
                    <Emoji unified={(category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                    <h3 className="pl-2 text-sm font-semibold text-gray-700 mb-1">{capitalizeWords(category.name)}</h3>
                    </div>
                    <div className="flex flex-row items-center justify-between py-1">
                    <div className='font-medium flex flex-col xl:flex-row items-center justify-start'>
                        <span className='text-[12px] xl:text-sm'>{category.gastado}</span>
                        <span className='text-[8px] xl:text-[10px] w-full text-left text-gray-400'>/{category.budget}</span>
                    </div>
                    <span className="text-[11px] xl:text-[14px] font-medium ">
                        {getPerc0(category.perctg)}
                    </span>
                    </div>
                    <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    {parseInt(category.perctg) >= 100 ? 
                    <div className="bg-[#3445b4] h-full" style={{ width: '100%' }}></div> 
                    :
                    <>
                        {parseInt(category.perctg) >= 80 ?
                        <div className="bg-[#5266EB] h-full" style={{ width: getPerc2(category.perctg) }}></div> :
                        <div
                            className="bg-[#808bd3] h-full"
                            style={{ width: getPerc2(category.perctg) }}
                        ></div>
                        }
                    </>
                    }
                    </div>
                </li>
                ))}
                </ul>
            </div>


          </div>
          
          <div className="border-t border-gray-300 h-2 mt-4"></div>
          <div className="mt-2 rounded-md overflow-hidden">
            <Alert/>
          </div>
          <EditCreateCategoryForm
            categoryData = {createCategoryData}
            selectedEmoji = {selectedEmoji}
            setSelectedEmoji = {setSelectedEmoji}
            onChangeCreate = {onChangeCreate}
            loadingCreate = {loadingCreate}
            contextEditCreate = {contextEditCreate}
            onSubmitEditCreate = {onSubmitEditCreate}
            handleCloseDetail = {null}
            windowContext = "onboarding"
          />
          
        </>:
        <div className="flex flex-col justify-start items-center ">
          
              <div className='flex justify-center items-center pb-5'>
              <CheckCircleIcon className='h-16 w-16 text-green-600'/>
              </div>

              <p className="gap-2 text-md text-center flex flex-row justify-center items-center">
                <span>¡Ya creaste una categoría!</span> <Emoji unified="1f389" emojiStyle="apple" size={20} />
              </p>
              <p className="pb-5 text-md text-center">
                  Ahora podrás asignar tus transacciones a ella para seguir de cerca tus gastos.
              </p>
              <p>
                Para editar o crear más, ve al menú de Topi → Presupuestos.
              </p>

              <div className='my-4 h-[50px] flex items-center border border-gray-200 rounded-lg'>
                  <Link 
                  to="/plan/" 
                  class="h-full w-full px-4 flex items-center text-gray-900 rounded-lg hover:bg-gray-100">
                  <svg class="shrink-0 w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8H5m12 0a1 1 0 0 1 1 1v2.6M17 8l-4-4M5 8a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.6M5 8l4-4 4 4m6 4h-4a2 2 0 1 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z"/>
                  </svg>

                    <span class="ml-3 font-Inter transition-all duration-300 group-hover:opacity-100 whitespace-nowrap">Ir a Presupuestos</span>
                    
                  </Link>
              </div> 
         
          
          
        </div>


      }
        
      </>
    )
}


const mapStateToProps = state => ({
  category_done: state.CashFlow.first_steps.cat,

})

export default connect(mapStateToProps,{
  get_user_categories,
  create_category,
  setAlert

}) (OnbCreateCategory)
