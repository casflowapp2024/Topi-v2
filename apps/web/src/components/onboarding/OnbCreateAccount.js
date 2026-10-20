import { Fragment, useEffect, useState } from "react";
import { Link} from 'react-router-dom';

//redux
import { connect } from 'react-redux';
import { get_user_accounts, create_f_account } from "../../redux/actions/cashflow";
import { create_personal_bank, get_banks } from "../../redux/actions/cashflow";
import { get_automated_emails } from "../../redux/actions/conexions";
import { setAlert } from "../../redux/actions/alert";
//components
import { ThreeDots } from 'react-loader-spinner';
import Alert from '../alert';
import Alert2 from "../alert2";
import AccCard from "../accounts/AccCard";
import EditCreateFinAccountForm from "../accounts/EditCreateFinAccountForm";
import {findElmentById, formatedCurrToNumber } from "../helpers";
import {  CheckCircleIcon } from '@heroicons/react/24/outline';
import { Emoji } from "emoji-picker-react";

const OnbCreateAccount = ({
    //redux actions
    get_user_accounts, 
    create_f_account,
    setAlert,
    create_personal_bank,
    get_banks,
    //redux state
    fin_account_done,
    banks, 
    accountTypesOptions,
    get_automated_emails,
    automatedEmails,
    
}) => {

    const [loadingCreate, setLoadingCreate] = useState(false)
    const [accCreated, setAccCreated] = useState(false)
    const [isFailed, setIsFailed] = useState(false)
    const [createAccountData, setCreateAccountData] = useState({
        name :'',
        last_four_digits:'',
        accountType:1,
        bankId:null,
        initia_balance_amount:"$0",
        automated : true,
        gmailPersonalEmail:'',
      });
  
    const onChangeCreate = (e) => {
        const { name, type, checked, value } = e.target;
        console.log("name",name,value)    
        setCreateAccountData({
            ...createAccountData,
            [name]: type === "checkbox" ? checked : value
        });
        };
  
    //handle off automated
    useEffect(() => {
        get_automated_emails(0,20)
    }, []);

    useEffect(() => {
        if (banks && banks.length === 0) {
            const selectedBank = banks.find(bank => bank.id === parseInt(createAccountData.bankId))
            console.log("selectedBank",selectedBank)
            if ((!createAccountData.automated) || (!selectedBank.is_automated)) {
                setCreateAccountData((prevData) => ({
                ...prevData,
                automated: false,
                otherPersonalEmail: "",
                appPassword: "",
                gmailPersonalEmail: "",
                automationTime: ""
                }));
            }
        }
    }, [createAccountData.automated,createAccountData.bankId]);


    const verifyData = (id) => {
        if (parseInt(id)>=0){
               
            return true
        }else{
            console.log("id",id) 
            alert('Los Digitos de la cuenta deben ser números!!')
            return false
        }
    }
  
    const onSubmitCreate =  async (e) => {
        e.preventDefault();
        setLoadingCreate(true)
       
        const passData = verifyData(createAccountData.last_four_digits)
        //crear cuenta primero
        if ((passData === true)) {
            if (createAccountData.automated === false){
          createAccountData.gmailPersonalEmail = null
            }

            let email_id = ""
            if (createAccountData.gmailPersonalEmail&&createAccountData.gmailPersonalEmail.id){
            email_id = parseInt(createAccountData.gmailPersonalEmail.id)
            }
            let newBankId = createAccountData.bankId
            console.log(createAccountData)
            // bank must be created first
            if (createAccountData.bankId<0){
                const newBank = findElmentById(banks, createAccountData.bankId)
                const createBankResponse = await create_personal_bank(newBank.name, newBank.email)
                if (createBankResponse === false) {
                    setAlert("Algo salio mal, el banco no fue creado, intenta de nuevo!",true,"text-white","bg-red-500",3000)
                    setLoadingCreate(false)
                    return
                }
                newBankId = createBankResponse
                await get_banks(0,50)
                setCreateAccountData({ ...createAccountData, ["bankId"]: newBankId})
            }

            const created = await create_f_account(
                createAccountData.name, 
                createAccountData.last_four_digits, 
                parseInt(createAccountData.accountType),
                parseInt(newBankId), 
                parseFloat(formatedCurrToNumber(createAccountData.initia_balance_amount)),
                email_id
                )

            if (created === 201) {
                setIsFailed(false)
                get_user_accounts(0,20)
                setLoadingCreate(false)
                setAccCreated(true)
                //setAlert("Cuenta Adicionada con exito!!",true,"","",4000)

            }else{
                setIsFailed(true)
                setLoadingCreate(false)
                if (created === 409){                  
                    setAlert("Está cuenta ya existe!",false,"text-white","bg-red-500",4000)
                }else{
                    setAlert("Algo salió mal la cuenta no fue creada, intenta de nuevo!",false,"text-white","bg-red-500",4000)
                }
                
            }

        } else {
            setLoadingCreate(false)
        }
    }

    useEffect(() => {
    if (banks && banks.length > 0 && !createAccountData.bankId) {
        setCreateAccountData(prev => ({
            ...prev,
            bankId: banks[0].id
        }));
    }
    }, [banks]);
        
    /* useEffect(() => {
          if (createAccountData) {
            // Aquí puedes realizar alguna acción cuando se abra el popover
            console.log(createAccountData);
          }
        }, [createAccountData]);
 */

    useEffect(() => {

        if (automatedEmails&&automatedEmails.emails) {
            // Aquí puedes realizar alguna acción cuando se abra el popover
            setCreateAccountData((prevData) => ({
                ...prevData,
                gmailPersonalEmail: automatedEmails.emails[0],
                }));
          }
            // Aquí puedes realizar alguna acción cuando se abra el popover
       
        }, []);
    
        
    return(

        <div>

            {!fin_account_done?
            <>

                <div className="w-full">
                            {loadingCreate?
                                <div className="h-auto">
                                    
                                    {/* card */}
                                    <div className="flex justify-center items-center mb-3">
                                        <AccCard
                                        name={createAccountData.name}
                                        accountTypesOptions = {accountTypesOptions}
                                        accountType = {createAccountData.accountType}  
                                        banks = {banks}
                                        bankId = {createAccountData.bankId}
                                        initia_balance_amount = {parseFloat(formatedCurrToNumber(createAccountData.initia_balance_amount))}
                                        last_four_digits = {createAccountData.last_four_digits}
                                        />             
                                    </div>
                                    <div>
                                        <div className='flex justify-center items-center'>
                                            <ThreeDots
                                            height="70"
                                            width="70"
                                            color="#5266EB"
                                            ariaLabel="loading"
                                            />
                                        </div>
                                        <h4 className="pb-5 text-xl text-center">
                                            Espera un momento, Estamos creando tu producto...
                                        </h4>
                                    </div>
                                </div>
                                :
                                <>  
                                    
                                    <>
                                        {/* card */}
                                        <p className='text-gray-700 text-sm text-justify mb-4'>
                                        Vincula tus cuentas de ahorro o tarjetas de crédito y descubre con Topi dónde entra y sale tu dinero, cuánto debes y cuánto has ahorrado. ¡Fácil y sin complicaciones!
                                        </p>
                                        <div className="border-t border-gray-300 h-2 mt-4"></div> 
                                        <div className="flex flex-col gap-4 w-full justify-center items-center">
                                                <AccCard
                                                name={createAccountData.name}
                                                accountTypesOptions = {accountTypesOptions}
                                                accountType = {createAccountData.accountType}  
                                                banks = {banks}
                                                bankId = {createAccountData.bankId}
                                                initia_balance_amount = {parseFloat(formatedCurrToNumber(createAccountData.initia_balance_amount))}
                                                lastFourDigits = {createAccountData.last_four_digits}
                                                />   
                                                         
                                            {/* FORMULARIO */}
                                            <form className="flex flex-col w-full">
            
            
                                                <EditCreateFinAccountForm
                                                createAccountData = {createAccountData}
                                                setCreateAccountData = {setCreateAccountData}
                                                onChangeCreate = {onChangeCreate}
                                                banks = {banks}
                                                accountTypesOptions = {accountTypesOptions}
                                                automatedEmails = {automatedEmails.emails}
                                                contexWindow = "onboarding"

            
                                                />
                                            
                                                <div className="flex justify-end gap-2 mt-2">
                                                    
                                                    <button
                                                        onClick={onSubmitCreate}
                                                        className="bg-[#5266EB] text-white px-4 py-2 rounded-lg hover:bg-blue-600 w-28"
                                                    >
                                                        Crear
                                                    </button>
            
                                                    
                                                    
                                                </div>
            
                                            </form>  
                                        </div>
                                    </>
                                    
                                </>
                            }
                </div>
                {isFailed?
                <div className="rounded-md overflow-hidden">
                    <Alert/>
                </div>

                :
                <></>
                }
            
            </>:

            /* STEP DONE */
            <div className="flex flex-col justify-start items-center ">
          
                <div className='flex justify-center items-center pb-4'>
                <CheckCircleIcon className='h-16 w-16 text-green-600'/>
                </div>
                <p className="w-full pb-2 gap-2 text-md text-center flex flex-row justify-left items-center">
                <span>¡Listo!</span> <Emoji unified="1f389" emojiStyle="apple" size={20} /> Ahora podrás:
                </p>
                <ul className="w-full pb-2 pl-4" >
                    <li>→ Relacionar cada transacción a tu cuenta o tarjeta.</li>
                    <li>→ Ver tus balances por producto en tiempo real.</li>
                </ul>
                <p>
                Para editar, eliminar o agregar más, ve al menú de Topi y entra en Cuentas y Productos.
                </p>

                <div className='my-4 h-[50px] flex items-center border border-gray-200 rounded-lg'>
                    <Link 
                    to="/accounts/" 
                    class="h-full w-full px-4 flex items-center text-gray-900 rounded-lg hover:bg-gray-100">
                    <svg class="shrink-0 w-6 h-6 text-gray-900 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M3 21h18M4 18h16M6 10v8m4-8v8m4-8v8m4-8v8M4 9.5v-.955a1 1 0 0 1 .458-.84l7-4.52a1 1 0 0 1 1.084 0l7 4.52a1 1 0 0 1 .458.84V9.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5Z"/>
                        </svg>

                        <span class="ml-3 font-Inter transition-all duration-300 group-hover:opacity-100 whitespace-nowrap">Ir a Cuentas y Productos</span>
        
                        <span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-gray-900 bg-gray-200 rounded-full dark:bg-blue-900 dark:text-blue-300">{1}</span>
                        
                    </Link>
                </div> 



                <p className="text-md text-center bg-yellow-50 border border-yellow-200 rounded-xl p-3 inline-block">
                <span className="inline-flex items-center gap-2">
                    <Emoji unified="1f4a1" emojiStyle="apple" size={20} />
                    <span>
                    Cuando completes el último paso, podrás leer automáticamente las
                    transacciones que llegan a tu correo de la cuenta que creaste!
                    </span>
                </span>
                </p>

            
          
          
            </div>
            
            
            }


            
        </div>

    )
}

const mapStateToProps = state => ({
    fin_account_done: state.CashFlow.first_steps.bank,
    banks: state.CashFlow.banks.items,
    accountTypesOptions: state.CashFlow.account_types,
    automatedEmails: state.Conexions.automated_emails

})

export default connect(mapStateToProps,{
    get_user_accounts, 
    create_f_account,
    setAlert,
    get_automated_emails,
    create_personal_bank,
    get_banks,
}) (OnbCreateAccount)
