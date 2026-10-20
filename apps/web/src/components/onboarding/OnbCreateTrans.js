import { Fragment, useEffect, useState } from "react";
import { Link} from 'react-router-dom';
//components
import { formatDate, formatCurrency, formatedCurrToNumber, findElmentById, parseDatetimetoDateStrFormat } from '../helpers';
import 'react-datepicker/dist/react-datepicker.css'
import { ThreeDots } from 'react-loader-spinner';
import FormEditCreateTrans from "../transactions/FormEditCreateTrans";
import Alert from '../alert';
import { Emoji } from "emoji-picker-react";
//redux
import { connect } from 'react-redux'
import { get_user_categories, create_transaction, get_user_transactions, get_user_accounts,
    create_category
 } from '../../redux/actions/cashflow';
import { setAlert } from '../../redux/actions/alert';
import {CheckCircleIcon} from '@heroicons/react/24/outline';

const OnbCreateTrans = ({
    //actions
    create_transaction,
    get_user_transactions,
    get_user_categories,
    get_user_accounts,
    setAlert,
    create_category,
    //states
    bank_done,
    trans_done,
    user_categories,
    user_accounts,
    default_limit,
    
}) => {
    
  
    const [date, setDate] = useState(parseDatetimetoDateStrFormat(new Date(),'YYYY-MM-DD HH:mm:ss Z'));
        
    //create account
    const [loadingCreate, setLoadingCreate] = useState(false)
    const [createTransData, setCreatTransData] = useState({
        category_id : 0,
        account_id : 0,
        description: "",
        expense:true,
        amount:"$0",
    });

    useEffect(() => {
        get_user_accounts(0,20)
        get_user_categories(0,20)
        
    }, []);

    useEffect(() => {
        if (
            user_categories &&
            Array.isArray(user_categories.items) &&
            user_categories.items.length > 0 &&
            user_categories.items[0] !== null
        ) {
            setCreatTransData(prev => ({
                ...prev,
                category_id: user_categories.items[0].id
            }));
        }
    }, [user_categories]);

    useEffect(() => {
        if(
            user_accounts&&
            Array.isArray(user_accounts.items) &&
            user_accounts.items.length > 0 &&
            user_accounts.items[0] !== null
        ){
            /* console.log("user_accounts.items:",user_accounts.items) */
            setCreatTransData({ ...createTransData, account_id: user_accounts.items[0].id})
        }
    }, [user_accounts]);

    
    const onChangeCreate = (e) => {
        if (e.target.name === "expense"){
            setCreatTransData({ ...createTransData, [e.target.name]: !e.target.checked})
        }else if (e.target.name === "amount") {
            const formated_ammount = formatCurrency(formatedCurrToNumber(e.target.value)); // Remove non-numeric characters except for decimal point and minus sign
            setCreatTransData({ ...createTransData, [e.target.name]: formated_ammount });
        }else{
            if(e.target.name === "expense"){
                setCreatTransData({ ...createTransData, [e.target.name]: !createTransData.expense})
            }else{
                setCreatTransData({ ...createTransData, [e.target.name]: e.target.value})
            }
        }
    }

    const {
        category_id,
        account_id,
        description,
        expense,
        amount
    } = createTransData;

    const onSubmitCreate =  async (e) => {

        e.preventDefault();
        setLoadingCreate(true)
        let newCategoryId = category_id
        // category must be created first
        if (category_id<0){
            const newCategory = findElmentById(user_categories.items, category_id)
            const createCategoryResponse = await create_category(newCategory.name, parseFloat(0), newCategory.emoji)
            if (createCategoryResponse === false) {
                setAlert("Algo salio mal, la categoría no fue creada, intenta de nuevo!",true,"text-white","bg-red-500",3000)
                setLoadingCreate(false)
                return
            }
            newCategoryId = createCategoryResponse
            await get_user_categories(0,20)
            
        }
        // create transaction

        const createResponse = await create_transaction(
            parseInt(newCategoryId),
            parseInt(account_id), 
            description, expense, 
            parseFloat(formatedCurrToNumber(amount)),
            date)

        if (createResponse === true) {
            setLoadingCreate(false)
            const retrieve_transactions1 = await get_user_transactions((1-1) * default_limit, default_limit)
            const retrieve_transactions2 = await get_user_transactions((1-1) * default_limit, default_limit,"", "dash")
            setAlert('Transaccion creada', true, 'text-white','bg-green-500',4000)
        }else{
            setLoadingCreate(false)
            setAlert('No se pudo crear la transaccion, intenta de nuevo', true, 'text-white','bg-red-500',4000)
        }
        setCreatTransData({ ...createTransData, ["category_id"]: newCategoryId})

    }

    /* useEffect(() => {
        console.log(createTransData)
    }, [createTransData,date]); */

    return(

        <div>
            {(trans_done===false)?
            <div className="">

                <p className='text-gray-700 text-sm text-justify'>
                    Aquí podrás registrar tus ingresos o gastos, asignarlos a una categoría y vincularlos a una cuenta. Así sabrás desde el primer día en qué usas tu dinero, ver reportes automáticos y tomar mejores decisiones financieras.
                </p>

                <div className="border-t border-gray-300 h-2 mt-4"></div>
                
                {/* formulario */}
                <div className="p-2"></div>
                <FormEditCreateTrans
                editCreateData={createTransData}
                onChangeCreate={onChangeCreate}
                user_categories={user_categories}
                user_accounts={user_accounts}
                date={date}
                setDate={setDate}
            
                />
                {/* boton crear y cerrar */}
                {bank_done?
                    <div className="flex flex-col gap-2 mt-2">

                        <div className="flex justify-end">
                            {loadingCreate?
                            <div 
                            class="bg-[#5266EB] text-white px-4 py-2 rounded-lg w-28">
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
                            <button
                                onClick={onSubmitCreate}
                                className="bg-[#5266EB] text-white px-4 py-2 rounded-lg hover:bg-blue-600 w-28"
                            >
                                Crear
                            </button>
                            }
                        </div>
                        
                        <div className="rounded-md overflow-hidden">
                            <Alert/>
                        </div>

                    </div>:<></>     
                }
            </div>
            :
            <div className="flex flex-col justify-start items-center ">
          
              <div className='flex justify-center items-center pb-5'>
              <CheckCircleIcon className='h-16 w-16 text-green-600'/>
              </div>
              <p className="w-full pb-2 gap-2 text-md text-center flex flex-row justify-center items-center">
                <span>¡¡Ya registraste tu primera transacción en Topi!!</span> <Emoji unified="1f389" emojiStyle="apple" size={20} />
                </p>
              <p>
                Si quieres eliminar, editar o agregar transacciones manualmente, ve al menú de Topi y entra en la sección Transacciones.
              </p>

              <div className='my-4 h-[50px] flex items-center border border-gray-200 rounded-lg'>
                  <Link 
                  to="/transactions/" 
                  class="h-full w-full px-4 flex items-center text-gray-900 rounded-lg hover:bg-gray-100">
                    <svg class="shrink-0 w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 3v4a1 1 0 0 1-1 1H5m8-2h3m-3 3h3m-4 3v6m4-3H8M19 4v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1ZM8 12v6h8v-6H8Z"/>
                    </svg>

                    <span class="ml-3 font-Inter transition-all duration-300 group-hover:opacity-100 whitespace-nowrap">Ir a Transacciones</span>
                    
                  </Link>
              </div> 
            </div>
            }
            
        </div>

    )
}

const mapStateToProps = state => ({
    bank_done: state.CashFlow.first_steps.bank,
    trans_done: state.CashFlow.first_steps.trans,
    user_categories: state.CashFlow.user_categories,
    user_accounts: state.CashFlow.user_accounts,
    default_limit: state.CashFlow.user_transactions.default_limit
})

export default connect(mapStateToProps,{
    create_transaction,
    get_user_transactions,
    get_user_categories,
    get_user_accounts,
    create_category,
    setAlert,
}) (OnbCreateTrans)
