import { useEffect, useState } from "react";
//redux
import { connect } from 'react-redux';
import { setAlert } from "../../redux/actions/alert";
import { register_email_conexion, get_automated_emails, link_emails_ask_url} from "../../redux/actions/conexions";
//components
import { findElmentByEmail } from "../helpers";
import { providers_atomated_email } from "../info_arrays";
import {
  CheckCircleIcon
} from '@heroicons/react/20/solid'
import { ThreeDots } from 'react-loader-spinner';
import Alert2 from "../alert2";

const OnbLinkAutomatedEmail = ({
    register_email_conexion,
    get_automated_emails,
    link_emails_ask_url,
    register_email_conexion,
    get_automated_emails,
    setAlert,
    automatedEmails
    
}) => {

    const [emailAutomated, setEmailAutomated] = useState('')
    const [provider, setProvider] = useState(providers_atomated_email[0].value)
    const [loadingLink, setLoadingLink] = useState(false)
    const [codeReceived, setCodeReceived] = useState("")
    const [linkSucess, setLikSucces] = useState(false)

    const onChangeForm = (e) => {
        if (e.target.name === "emailAutomated" ){
            console.log("changing emailAutomated", e.target.value)
            setEmailAutomated(e.target.value);
        }else{
            setProvider(e.target.value);
        }
    };

    const askForUrl =  async () => {
        console.log("asking for url", provider)
        const urlResponse = await link_emails_ask_url(provider)

        if (urlResponse !== false) {
            handleEmailLink(urlResponse)
        }else{
          setAlert("Algo salio mal intenta de nuevo!",true,"text-white","bg-red-500",3000)
        }
      }


    const onSubmitLink = (e) => {
         e.preventDefault();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailAutomated)) {
            alert("Ingresa un email válido.");
            return;
        }else{

            setLoadingLink(true)
            askForUrl()//original: askForUrl() ---- testing: registerCode()
            console.log('linkigPark', emailAutomated)
        }
        };



    const handleEmailLink = (url) => {
   
    const width = 500;
    const height = 600;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    const popup = window.open(
        url,
        "GoogleSignIn",
        `width=${width},height=${height},top=${top},left=${left}`
    );

    // Listen for a message from the popup
    window.addEventListener("message", function handleMessage(event) {
        
        const { code } = event.data;
        if (code) {
        console.log("Authorization code received:", code);

        setCodeReceived(code)

        // Clean up the listener
        window.removeEventListener("message", handleMessage);

        // Now you can exchange this code with your backend for tokens
        }
    });
    };

    useEffect(() => {
          if (codeReceived !== "") {
            registerCode();
          }
        }, [codeReceived]);


    const registerCode =  async () => {

        const registerResponse = await register_email_conexion(emailAutomated, codeReceived)
        const response_automated_emails = await get_automated_emails(0,20)
            console.log("response_automated_emails", response_automated_emails)
      
        if (registerResponse !== false) {

            setLoadingLink(false)
            setLikSucces(true)
            setAlert(`El correo ${{emailAutomated}} fue vinculado exitosamente con CashFlow!`,true,"text-white","bg-red-500",3000)

        }else{

          setAlert("Algo salio mal, el correo no fue vinculado, intenta de nuevo!",true,"text-white","bg-red-500",3000)
          setLoadingLink(false)
        }
      
      }

        
    return(

        <div>
            {linkSucess ?
            <div className='flex flex-col justify-center items-center pb-2'>
                <Alert2/>
            </div>
            :
            <>   
                { loadingLink ?
                <div className='flex flex-col justify-center items-center h-20'>
                    <ThreeDots
                        height="50"
                        width="50"
                        radius="9"
                        color="#5266EB"
                        ariaLabel="three-dots-loading"
                        wrapperStyle={{}}
                        wrapperClass=""
                        visible={true}
                    />
                    <div>
                        Vinculando correo <span className='font-semibold'>{emailAutomated}</span> a CashFlow...
                    </div>
                </div>
                :
                <form className='flex flex-col lg:flex-row gap-4 mt-4 justify-between'>

                    <div className="lg:w-1/4">
                        <label for="emailAutomated" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Proveedor de Email</label>
                        <select 
                        id="provider" 
                        name="provider"
                        value={provider.value}
                        onChange={e=>onChangeForm(e)}
                        required
                        class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500">
                            {providers_atomated_email && providers_atomated_email.map((provider) => (
                                <option key={provider.name} value={provider.value}>
                                {provider.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="lg:w-1/2">    
                        <label for="emailAutomated" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Email</label>
                        <input 
                        type="email" 
                        name="emailAutomated" 
                        id="emailAutomated"
                        value={emailAutomated}
                        onChange={e=>onChangeForm(e)}
                        class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500" 
                        placeholder="Email donde te notifican las transacciones de alguna cuenta o producto financiero" 
                        required/>           
                    </div>
                
                    <div className="flex justify-end items-end">
                        <button
                            onClick={onSubmitLink}
                            className="w-max h-min items-center justify-center bg-[#5266EB] text-white px-4 py-2.5 rounded-lg hover:bg-blue-600"
                        >
                            <span>Conectar</span>
                        
                        </button>
                    </div>
                </form>
                }
            </>
            }
        </div>

    )
}

const mapStateToProps = state => ({
    automatedEmails: state.Conexions.automated_emails.emails
})

export default connect(mapStateToProps,{
    register_email_conexion,
    get_automated_emails,
    link_emails_ask_url
}) (OnbLinkAutomatedEmail)
