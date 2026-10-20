import { Fragment, useEffect, useState } from 'react'
import {NavLink, Link, useNavigate, Await} from 'react-router-dom';
import { Menu ,Popover, Transition, Dialog, DialogTitle, TransitionChild, DialogPanel } from '@headlessui/react'
import moment from  'moment'
//redux
import { connect, useSelector  } from 'react-redux'
import { get_user_transactions, update_transaction } from '../../redux/actions/cashflow';

//components
import { formatDate, findElmentById, formatCurrency, capitalizeWords } from '../helpers';
import DatePicker from 'react-datepicker';
/* This example requires Tailwind CSS v2.0+ */
import {
  TrashIcon,
  XMarkIcon,
  PencilSquareIcon
} from '@heroicons/react/20/solid'


function EditTransaction({
    openEditTrans,
    setOpenEditTrans,
    detailInfo,
    setDetailInfo,
    get_user_transactions,
    user_transactions,
    update_transaction,
    user_accounts,
    user_categories
}) {

    //GENERALES
    useEffect(() => {
        

    }, [detailInfo])

    //edit transaction
    const [loadingUpdate, setLoadingUpdate] = useState(false)
    const [updateTransData, setUpdateTransData] = useState({
      category_id :detailInfo.category.id,
      account_id :detailInfo.account.id,
      description: detailInfo.description,
      expense:detailInfo.expense,
      amount:detailInfo.amount,
    });
    const [date, setDate] = useState(formatDate(detailInfo.date));

    const onChangeUpdate = (e) => {

        if (e.target.name == "expense"){
            setUpdateTransData({ ...updateTransData, [e.target.name]: e.target.value === "true"})
        }else{
            setUpdateTransData({ ...updateTransData, [e.target.name]: e.target.value})
        }
      console.log(updateTransData)
      console.log(date)
    }

    const {
        category_id,
        account_id,
        description,
        expense,
        amount,
    } = updateTransData;

    const onSubmitUpdate =  async (e) => {
        e.preventDefault();
        setLoadingUpdate(true)
            
        const createResponse = await update_transaction(
            parseInt(detailInfo.id),
            parseInt(category_id), 
            parseInt(account_id), 
            description, expense, 
            parseFloat(amount),
            formatDate(date))

        if (createResponse === true) {
            get_user_transactions(0,20)
            setTimeout(() => {
                setLoadingUpdate(false);
                setOpenEditTrans(false)
              }, 1000)
            
            alert('Transaccion actualizada')
        }else{
            setLoadingUpdate(false)
            alert('No se pudo actualizar la transaccion, intenta de nuevo')
        }
        
      }

      useEffect(() => {
        const selectedTransaction = findElmentById(user_transactions.items, detailInfo.id)
        setDetailInfo(selectedTransaction)
      }, [user_transactions]);

      
      
    
    return (
       
    <>
    {/*Este es el modal para abrir el Box de editar transaccion */}
        {detailInfo?
        <div className='h-[350px]'>
            <div className="h-[280px] w-full flex flex-col rounded-lg justify-items-end items-left" >
                <div className='flex flex-row justify-start items-baseline'>
                    <span className='text-sm font-light'>Fecha:</span>
                    <DatePicker
                    dateFormat="dd-MM-yyyy"
                    selected={date}
                    onChange={(date) => setDate(date)}
                    className="ml-1 pl-1 text-sm border rounded-md  shadow-sm font-Inter w-full "
                    />
                </div>
                <div className='flex flex-row justify-start items-baseline pt-[2px]'>
                    <span className='text-sm font-light'>Cuenta:</span>
                    <select
                        id="account_id"
                        name="account_id"
                        value={account_id}
                        onChange={e=>onChangeUpdate(e)}
                        className="ml-1 pl-1 text-sm border rounded-md  shadow-sm font-Inter w-[201px]"
                        required
                        >{user_accounts.items&&user_accounts.items.map((account,index) => (
                            <option key={account.id} value={account.id}>
                            {account.name} ***{account.last_four_digits}
                            </option>
                            
                        ))}
                    </select>
                </div>
                <div className='text-sm w-full flex flex-row justify-center py-2'>
                    
                    <ul class="w-1/3 text-sm font-medium text-gray-900 dark:bg-gray-700 dark:text-white">
                        <li class="w-full">
                            <div class="flex items-center">
                                <input id="expense-ganancia" type="radio" value={false} name="expense" 
                                onChange={e=>onChangeUpdate(e)}
                                checked={expense === false}
                                class="w-4 h-4 text-green-600 bg-gray-100 "/>
                                <label for="expense-ganancia" class="w-full ms-1 text-xs text-gray-700 dark:text-gray-300">Ganancia</label>
                            </div>
                        </li>
                        <li class="w-full ">
                            <div class="flex items-center">
                                <input id="expense-gasto" type="radio" value={true} name="expense" 
                                onChange={e=>onChangeUpdate(e)}
                                checked={expense === true}
                                class="w-4 h-4 text-rose-600 bg-gray-100"/>
                                
                                <label for="expense-gasto" class="w-full ms-1 text-xs text-gray-700 dark:text-gray-300">Gasto</label>
                            </div>
                        </li>
                    </ul>
                    
                    <input type="number" name="amount" id="amount" 
                        value={amount}
                        onChange={e=>onChangeUpdate(e)}
                        required
                        className="w-2/3 ml-1 p-1 text-sm border rounded-md  shadow-sm font-Inter"
                    />
                    
                </div>
                <div className='flex flex-row justify-start items-baseline pt-[2px]'>
                    <span className='text-sm font-light leading-tight '>Categoría:</span>
                    <select
                    id="category_id"
                    name="category_id"
                    value={category_id}
                    onChange={e=>onChangeUpdate(e)}
                    className="ml-1 pl-1 text-sm border rounded-md  shadow-sm font-Inter w-[186px]"
                    required
                    >{user_categories.items&&user_categories.items.map((category,index) => (
                        <option key={category.id} value={category.id}>
                        {category.name}
                        </option>
                        
                    ))}
                    </select>
                </div>
                <span className='text-sm font-light pt-[0.5px]'>Decripción:</span>
                <input type="text" name="description" id="description" 
                    value={description}
                    onChange={e=>onChangeUpdate(e)}
                    placeholder="descripcion" required
                    className="w-full border border-gray-300 rounded-lg pl-2 p-1"
                />

                <div className='flex flex-col justify-end text-transparent'>
                    <div className='mt-8 text-xs flex flex-col justify-items-end '>
                        <span className='font-light text-end '>Balance antes de Operación</span>
                        <span className='font-medium text-end  '>balance_before </span>
                    </div>
                    <div className='text-xs flex flex-col justify-items-end'>
                        <span className='font-light leading-tight  text-end'>Balance despúes de Operación</span>
                        <span className='font-medium text-end '> balance_after </span>
                    </div>     
                </div>
            </div>
            <div className="w-full justify-items-center items-center flex flex-row justify-around" >
                <button
                onClick={e => onSubmitUpdate(e)} 
                className='px-2 rounded-md bg-zinc-600 text-zinc-300 shadow-sm shadow-zinc-300 h-12 flex justify-center items-center border border-zinc-700 hover:bg-blue-400 transition-transform'>
                    Actualizar
                </button>
                <button 
                onClick={e=>setOpenEditTrans(false)} 
                className='rounded-full bg-zinc-400 w-12 shadow-sm shadow-zinc-400 h-12 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                    </svg>

                </button>
            
                                
            </div>
        </div>
        :
        <></>
        }    
                        
                    
    </>
    )
  }


  const mapStateToProps = state => ({
    user_categories: state.CashFlow.user_categories,
    user_accounts: state.CashFlow.user_accounts,
    user_transactions: state.CashFlow.user_transactions
  })
  
  export default connect(mapStateToProps,{
    get_user_transactions,
    update_transaction
  
  }) (EditTransaction)