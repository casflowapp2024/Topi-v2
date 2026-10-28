import { useState, useRef, useEffect} from 'react';
//redux
import { connect } from 'react-redux';
import { setAlert } from "../../redux/actions/alert";
import { get_user_categories, create_category} from "../../redux/actions/cashflow";
import { get_banks, create_personal_bank, delete_personal_bank, update_personal_bank } from '../../redux/actions/cashflow';
//components
import { findElmentById } from '../helpers';
import EditCreateCategoryForm from '../expensePlan/EditCreateCategoryForm';
import EditCreateBankForm from './EditCreateBankForm';
import { ThreeDots } from 'react-loader-spinner';
import Alert2 from '../alert2';
import Alert from '../alert';
//ui
import { ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Emoji } from "emoji-picker-react";


const DropDownBanks = ({
     options, selected, onChange, placeholder,
     setAlert,
     create_personal_bank,
     delete_personal_bank,
     update_personal_bank,
     get_banks,
     default_banks
     
}) => {

    const [isOpen, setIsOpen] = useState(false);

    //create bank states
    const [createBox, setOpenCreateBox] = useState(false)
    
    //Delete bank states
    const [openBoxDeleteBank, setOpenBoxDeleteBank] = useState(false)
    const [bankToDelete, setBankToDelete] = useState(null)
    const [loading, setLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    //Update Bank states
    const [openBoxUpdateBank, setOpenBoxUpdateBank] = useState(false)
    const [bankToUpdate, setBankToUpdate] = useState(null)

    //-----------------------------------------------------------------------

    //handle close dropdown
    const handleOpenCloseWholeDropDown =  async () => {
        if (!isOpen){
            setIsOpen(true)
        }else{
            setIsOpen(false)
            setOpenCreateBox(false)
        }
    }

    //close category click outside
    const listDropRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click was on the filter button or inside the popup
            const isDropListOpen = event.target.closest('button[onClick*="handleOpenFilterPopUp"]');
            const isInsideList = listDropRef.current && listDropRef.current.contains(event.target);
            
            if (!isDropListOpen && !isInsideList) {
                event.stopPropagation();
                setIsOpen(false);
                setOpenCreateBox(false)
                setOpenBoxDeleteBank(false)
                setLoading(false)
                setIsSuccess(false)
                setBankToDelete(null)
                setOpenBoxDeleteBank(false)
                setBankToUpdate(null)
                setOpenBoxUpdateBank(false)
                setAlert('--',true,'text-black','bg-white',100)
            }
        };

        if (isOpen || createBox) {
            document.addEventListener('mousedown', handleClickOutside, true); // Use capture phase
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [isOpen, setIsOpen, createBox, setOpenCreateBox]);
  
    ////////////SELECT CATEGORY////////////
    const [selectedBank, setSelectedBank] = useState(
        {
            id:options[0].id,
            name:options[0].name,
        }
    );
    
    useEffect(() => {
        console.log(selected)
        if(selected){
            setSelectedBank(findElmentById(options,selected)
            )
        }
        }, [selected]);

    const handleSelect = (option) => {
        console.log("optionclicked: ",option)
 
        const syntheticEvent = {
                target: {
                id: 'bankId',
                name: 'bankId', // or use a `name` prop
                value: option,
                }
            };
        
        onChange(syntheticEvent);
        setIsOpen(false);
        setOpenCreateBox(false)
    };
    
    ///////////CREATE BANK FUNCTIONS////////////
    const handleCloseDetail = (e) => {
        setOpenCreateBox(false)
    }

    const onClickAddBank = () => {
        /* setIsOpen(false); */
        setOpenCreateBox(true);
        };
    
    const [loadingCreate, setLoadingCreate] = useState(false)
    const [createBankData, setCreateBankData] = useState({
      name :'',
      email : '',
    });
    const onChangeCreate = (e) => {       
        setCreateBankData({ ...createBankData, [e.target.name]: e.target.value})
        console.log(createBankData)
    }
    const {
      name,
      email,
    } = createBankData;


    const onSubmitEditCreate =  async (e) => {
        e.preventDefault();
        setLoadingCreate(true)
 
        const createResponse = await create_personal_bank(name, email)
        if (createResponse !== false) {
            const bankGot = await get_banks(0,50)
            setAlert("Banco creado!",true,"text-white","bg-green-500",3000)
            if (bankGot === true){
                setLoadingCreate(false)
                handleSelect(createResponse)
            }else{
                setLoadingCreate(false)
            }
            //handleCloseDetail()
        }else{
          setAlert("Algo salio mal, el banco no fue creado, intenta de nuevo!",true,"text-white","bg-red-500",3000)
          setLoadingCreate(false)
        }
    }
    

    ///////////Delete bank functions///////////
    const handleClickDeleteBank = (id) => {
        setBankToDelete(id)
        setOpenBoxDeleteBank(true)
    
    }

    const handleGoBackDelete = () => {
        setLoading(false)
        setIsSuccess(false)
        setBankToDelete(null)
        setOpenBoxDeleteBank(false)
        setAlert('--',true,'text-black','bg-white',100)
    }

    const handeleDelete = async (id) => {
        setLoading(true)
        const responseDelete = await delete_personal_bank(id)
        if (responseDelete === true) {
            await get_banks(0,50)
            setLoading(false)
            setIsSuccess(true)
            setAlert('Banco Eliminado',true,'text-red-600','white',false)
        }else{
            setLoading(false)
            setAlert('Algo salió mal, el banco no fue eliminado',false,'text-red-600','bg-gray-100',3000)
        }
    }

    ///////////Update Bank Functions///////////

    const handleClickUpdateBank = (id) => {
        setBankToUpdate(id)
        setOpenBoxUpdateBank(true)
        setUpdateBankData({
            name: findElmentById(options,id).name,
            email: findElmentById(options,id).email,
        })
    }

    const handleCloseUpdateBox = (e) => {
        setLoading(false)
        setIsSuccess(false)
        setBankToUpdate(null)
        setOpenBoxUpdateBank(false)
        setAlert('--',true,'text-black','bg-white',100)
    }
    
    const [updateBankData, setUpdateBankData] = useState({
      name :'',
      email : '',
    });

    const onChangeUpdate = (e) => {       
        setUpdateBankData({ ...updateBankData, [e.target.name]: e.target.value})
    }

    const onSubmitEditUpdate =  async (e) => {
        e.preventDefault();
        setLoading(true)
 
        const updateResponse = await update_personal_bank(updateBankData.name, updateBankData.email,bankToUpdate)
        if (updateResponse !== false) {
            await get_banks(0,50)
            setIsSuccess(true)
            setAlert("Banco Actualziado!",true,"text-white","bg-green-500",false)
            setLoading(false)
        }else{
          setAlert("Algo salio mal, el banco no fue actualziado, intenta de nuevo!",true,"text-white","bg-red-500",3000)
          setLoading(false)
        }
    }
    


    
    

  return (
      <div ref={listDropRef}  className="relative w-full">
        <button
            type="button"
            onClick={() => handleOpenCloseWholeDropDown()}
            className="w-full pl-2 pr-1 py-1 md:py-2 flex justify-between items-center text-gray-900  bg-gray-100 border border-gray-300 rounded-lg shadow-sm hover:border-blue-500 focus:outline-none text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >   
            <div className='flex flex-row gap-2 justify-start items-center text-sm'>
                {selectedBank?
                    <span>
                        {selectedBank.name}
                    </span>
                    :
                    <span className="text-gray-400">
                        {placeholder}       
                    </span>
                }
            </div>
            <ChevronDownIcon className="w-4 h-4 text-gray-900" />
        </button>

        {isOpen && (
            <>
                {/* LIST OF BANKS */}
                <ul className="absolute z-10 w-full text-sm  bg-white border border-gray-300 rounded-lg shadow-lg max-h-[210px] overflow-y-auto text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">   
                  
                {options?
                    <>
                        {options&&options.map((bank) => (
                        <>
                        {!bank.isDefault?
                        <li
                        key={bank.id}
                        value = {bank.id}
                        
                        className="flex gap-2 cursor-pointer hover:bg-gray-100  flex-row justify-between dark:hover:bg-gray-700"
                        >
                            <span 
                            onClick={() => handleSelect(bank.id)}
                            className='px-3 py-1.5 cursor-pointer w-full truncate'>
                                {bank.name}
                            </span>
                            <div className='flex flex-row gap-1 py-1'>
                                <div 
                                className='px-0.5 cursor-pointer border border-gray-100 text-blue-600 flex items-center justify-center rounded-md hover:bg-gray-300'
                                onClick={()=>handleClickUpdateBank(bank.id)}
                                >
                                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M21.2799 6.40005L11.7399 15.94C10.7899 16.89 7.96987 17.33 7.33987 16.7C6.70987 16.07 7.13987 13.25 8.08987 12.3L17.6399 2.75002C17.8754 2.49308 18.1605 2.28654 18.4781 2.14284C18.7956 1.99914 19.139 1.92124 19.4875 1.9139C19.8359 1.90657 20.1823 1.96991 20.5056 2.10012C20.8289 2.23033 21.1225 2.42473 21.3686 2.67153C21.6147 2.91833 21.8083 3.21243 21.9376 3.53609C22.0669 3.85976 22.1294 4.20626 22.1211 4.55471C22.1128 4.90316 22.0339 5.24635 21.8894 5.5635C21.7448 5.88065 21.5375 6.16524 21.2799 6.40005V6.40005Z" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M11 4H6C4.93913 4 3.92178 4.42142 3.17163 5.17157C2.42149 5.92172 2 6.93913 2 8V18C2 19.0609 2.42149 20.0783 3.17163 20.8284C3.92178 21.5786 4.93913 22 6 22H17C19.21 22 20 20.2 20 18V13" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                                
                                </div>

                                <div 
                                className='px-0.5 cursor-pointer  border border-gray-100 text-red-500 flex items-center justify-center rounded-md hover:bg-gray-300'
                                onClick={()=>handleClickDeleteBank(bank.id)}
                                >
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                    </svg>
                                </div>

                            </div>
                        </li>:<></>
                        }
                        </>
                        ))}
                    </>:
                    <></>
                } 
                <div className='mt-2 border-t-2 border-gray-300'>
                    <div 
                    className="cursor-pointer w-full flex flex-row gap-2 items-center py-1 px-2 border-b-2 border-gray-40 hover:bg-gray-200 dark:hover:bg-gray-700" 
                    key={0}
                    onClick={() => onClickAddBank(true)}
                    >
                        <PlusIcon className="w-4 h-4 text-[#5266EB]" />
                        <span className="text-[#5266EB]">
                            Crear banco
                        </span>
                    </div>

                    {default_banks.some(bank => !bank.userBank) ?
                    <>
                        <h3 className=' py-1 pl-2 text-gray-400 bg-gray-100 font-semibold'>Bancos Oficiales...</h3>

                        {default_banks&&default_banks.map((bank_def) => (
                        <>
                            {!bank_def.userBank?
                            <li
                            key={bank_def.id}
                            value = {bank_def.id}
                            onClick={() => handleSelect(bank_def.id)}
                            className="px-3 py-1 flex items-center gap-2 hover:bg-gray-100 cursor-pointer dark:hover:bg-gray-700"
                            >
                                <span>
                                    {bank_def.name}
                                </span>
                            </li>:<></>
                            }
                        </>
                        ))}
                    
                    </>:<></>
                    }

                </div>
                </ul>
                
                {/* DELELTE BOX */}
                {openBoxDeleteBank && bankToDelete && (

                    <div className='relative'>
                        <div className='absolute top-0 z-30 w-full bg-white border border-gray-300 rounded-lg shadow-lg min-h-[210px] text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'>
                            
                            {loading ?
                                
                               <div className='mt-20 flex justify-center items-center'>
                                    <ThreeDots
                                    height="40"
                                    width="40"
                                    color="#5266EB"
                                    ariaLabel="loading"
                                    />
                                </div>:
                                <>
                                 {isSuccess ?
                                <div className='flex flex-col justify-center items-center gap-2 p-4'>
                                    <Alert2/>
                                    <button 
                                    onClick={e=>handleGoBackDelete(e)} 
                                    className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                        </svg>
                                    </button>

                                </div>:
                                <>
                                    <div className='flex flex-col justify-center items-center gap-2 p-4'>
                                        <span className='p-2'>
                                            Seguro quieres eliminar el banco?:
                                        </span>
                                        <span className='font-semibold'>{findElmentById(options,bankToDelete).name}</span>
                                    </div>
                                    <div className='flex flex-col'>
                                        <div className=' flex flex-row gap-2 justify-end items-center p-4'>
                                            <button
                                            onClick={()=>handeleDelete(bankToDelete)}
                                            className='text-red-600 inline-flex items-center hover:text-white border border-red-600 hover:bg-red-600 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900'>
                                                Si, Eliminar!
                                            </button>
                                            <button 
                                            onClick={e=>handleGoBackDelete(e)} 
                                            className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                                </svg>
                                            </button>

                                        </div>
                                        <div className='rounded-b-md overflow-hidden'>
                                            <Alert/>
                                        </div>
                                    </div>
                                </>
                                }
                                </>
                            }
                           
                        </div>
                    </div>
                )
                }

                {/* UPDATE BOX */}
                {openBoxUpdateBank && bankToUpdate && (

                    <div className='relative'>
                        <div className='absolute top-0 z-30 w-full bg-white border border-gray-300 rounded-lg shadow-lg min-h-[210px] text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'>
                            
                            {loading ?
                                
                               <div className='mt-20 flex justify-center items-center'>
                                    <ThreeDots
                                    height="40"
                                    width="40"
                                    color="#5266EB"
                                    ariaLabel="loading"
                                    />
                                </div>:

                                <>

                                 {isSuccess ?
                                <div className='flex flex-col justify-center items-center gap-2 p-4'>
                                    <Alert2/>
                                    <button 
                                    onClick={e=>handleCloseUpdateBox(e)} 
                                    className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                        </svg>
                                    </button>

                                </div>:
                                <>
                                    <div className='p-4'>
                                        <EditCreateBankForm
                                        bankData = {updateBankData}
                                        onChangeCreate = {onChangeUpdate}
                                        loadingCreate = {loading}
                                        contextEditCreate = {"update"}
                                        onSubmitEditCreate = {onSubmitEditUpdate}
                                        handleCloseDetail = {handleCloseUpdateBox}
                                        windowContext = {"acc"}
                                        />
                                    </div>
                                    <div className='rounded-b-md overflow-hidden'>
                                        <Alert/>
                                    </div>
                                
                                </>
                                }
                                </>
                            }
                           
                        </div>
                    </div>
                )
                }



            </>
        )}

        {createBox && (
            <div className='absolute py-2 px-2 z-10 w-full text-sm bg-white border border-gray-300 rounded-lg shadow-lg overflow-y-auto text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'>      
                <EditCreateBankForm
                bankData = {createBankData}
                onChangeCreate = {onChangeCreate}
                loadingCreate = {loadingCreate}
                contextEditCreate = {"create"}
                onSubmitEditCreate = {onSubmitEditCreate}
                handleCloseDetail = {handleCloseDetail}
                windowContext = {"acc"}
                />
            </div>
        )}
      </div>

    )
  
}

const mapStateToProps = state => ({
    default_banks: state.CashFlow.banks.default
})

export default connect(mapStateToProps,{
  create_category,
  setAlert,
  create_personal_bank,
  delete_personal_bank,
  update_personal_bank,
  get_banks
}) (DropDownBanks)
