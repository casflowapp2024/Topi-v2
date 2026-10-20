
import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from "react";
//redux
import { connect } from 'react-redux'
//componentes
import { Emoji } from 'emoji-picker-react';
import { formatCurrency, formatDate } from '../helpers';
import { delete_automated_email, get_automated_emails } from '../../redux/actions/conexions';
import LinkTransEmailForm from '../conexions/LinkTransEmailForm';
import ConexionErrorDisplay from './ConexionErrorDisplay';
import { setAlert } from '../../redux/actions/alert';
import { ThreeDots } from 'react-loader-spinner';
import { PlusIcon, PencilIcon, DeviceTabletIcon } from '@heroicons/react/20/solid'
import { update_user_extra_data, get_user_extra_data } from '../../redux/actions/auth';
import Alert from '../alert';

const ConexionesSetts = ({
    user_extra,
    get_automated_emails,
    delete_automated_email,
    setAlert,
    automated_emails,
    user_accounts,
    whatsappNumber,
    update_user_extra_data,
    get_user_extra_data
}) => {

    ////STATES
    const [openCreateBox, setOpenCreateBox] = useState(false)
    const [loading, setLoading] = useState(false)

    const [openDeleteEmail, setOpenDeleteEmail] = useState(false)
    const [emailSelected, setEmailSelected] = useState({})
    const [accountsRelatedEmail, setAccountsRelatedEmail] = useState({})
    const [loadingDelete, setLoadingDelete] = useState(false)

    //close category click outside
    const listDropRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click was on the filter button or inside the popup
            //const isDropListOpen = event.target.closest('button[onClick*="handleOpenFilterPopUp"]');
            const isInsideList = listDropRef.current && listDropRef.current.contains(event.target);

            if (!isInsideList) {
                event.stopPropagation();
                setOpenCreateBox(false);
                setAlert('--', true, 'text-black', 'bg-white', 100)
            }
        };

        if (openCreateBox) {
            document.addEventListener('mousedown', handleClickOutside, true); // Use capture phase
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [openCreateBox, setOpenCreateBox]);

    ///// CREATE EMAIL POPUP /////

    const handleCloseCreatePopUp = (e) => {
        setOpenCreateBox(false)
    }

    ///// DELETE EMAIL POPUP /////
    const onClickDeleteCloseOpen = (email) => {
        setOpenDeleteEmail(!openDeleteEmail)
        if (email === null) {
            setEmailSelected({})
            setAccountsRelatedEmail({})
        } else {
            console.log(email)
            setEmailSelected(email)
            const id_email = email.id
            const filtered = user_accounts.items.filter(item => item.email?.id === id_email);
            setAccountsRelatedEmail(filtered)
        }
    };

    const handleDeleteEmail = async () => {

        let id = emailSelected.id
        console.log(id)

        setLoadingDelete(true)
        const deleteResponse = await delete_automated_email(id);
        console.log(deleteResponse)
        // The code below will only execute after the transaction is deleted
        get_automated_emails(0, 20)
        if (deleteResponse === true) {

            setLoadingDelete(false)
            setOpenDeleteEmail(false)
            setEmailSelected({})
            setAccountsRelatedEmail({})
            setAlert('Cuenta Eliminada', true, 'text-red-600', 'white', 4000)

        } else {
            setLoadingDelete(false)
            setAlert('Algo salió mal la cuenta no fue eliminada', false, 'text-red-600', 'bg-gray-200', false)

        }
    }

    const listDropRef2 = useRef(null)
    useEffect(() => {
        const handleClickOutside2 = (event) => {
            // Check if the click was on the filter button or inside the popup
            //const isDropListOpen = event.target.closest('button[onClick*="handleOpenFilterPopUp"]');
            const isInsideList = listDropRef2.current && listDropRef2.current.contains(event.target);

            if (!isInsideList) {
                event.stopPropagation();
                setOpenDeleteEmail(false)
                setEmailSelected({})
                setLoadingDelete(false)
                setAlert('--', true, 'text-black', 'bg-white', 100)
            }
        };

        if (openDeleteEmail) {
            document.addEventListener('mousedown', handleClickOutside2, true); // Use capture phase
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside2, true);
        };
    }, [openDeleteEmail, setOpenDeleteEmail]);


    ///// UPDATE EMAILS //////


    ///// EMAILS ERRORS /////

    const [openErrorPopup, setOpenErrorPopup] = useState(false)
    const [emailErrorSelected, setEmailErrorSelected] = useState(null)


    ///WHATSAPP STATES
    const [openWhatsappForm, setOpenWhatsappForm] = useState(false)
    const [selectedCountry, setSelectedCountry] = useState('')
    const [phoneNumber, setPhoneNumber] = useState("")


    const whatsappFormRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click was on the filter button or inside the popup
            //const isDropListOpen = event.target.closest('button[onClick*="handleOpenFilterPopUp"]');
            const isInsideFormWhap = whatsappFormRef.current && whatsappFormRef.current.contains(event.target);

            if (!isInsideFormWhap) {
                event.stopPropagation();
                setOpenWhatsappForm(false);
                setAlert('--', true, 'text-black', 'bg-white', 100)
            }
        };

        if (openWhatsappForm) {
            document.addEventListener('mousedown', handleClickOutside, true); // Use capture phase
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [openWhatsappForm, setOpenWhatsappForm]);


    const handleSaveWhatsapp = async () => {

        setLoading(true)
        const saveResponse = await update_user_extra_data(
            user_extra.utc_offset,
            phoneNumber,
            user_extra.birthday,
            user_extra.local_currency,
            user_extra.language)

        if (saveResponse !== false) {

            await get_user_extra_data()
            setAlert("Whatsapp exitosamente guardado!", true, "text-white", "bg-green-500", 3000)
            setOpenWhatsappForm(false)
            setLoading(false)

        } else {

            setAlert("Algo salio mal, el numero no fue guardado, intenta de nuevo!", true, "text-white", "bg-red-500", 3000)
            setLoading(false)
        }


        console.log("")
    }



    return (
        <div className='flex flex-col gap-8 relative'>

            <section>
                <div className="flex flex-row gap-8 xl:gap-4 justify-start items-center mb-5">
                    <h3 className='font-medium dark:text-white'>Emails Vinculados</h3>
                    <button className="h-auto text-sm px-4 flex flex-row items-center bg-slate-100 dark:bg-slate-800 dark:text-gray-200 rounded-full border border-[#5266EB] hover:bg-slate-200 dark:hover:bg-slate-700 group transition-colors duration-300"
                        onClick={() => setOpenCreateBox(true)}>
                        <PlusIcon className="w-4 h-4 mr-2 group-hover:text-[#5266EB] dark:group-hover:text-blue-400" />
                        <span className="pr-2">
                            Conectar nuevo Email
                        </span>
                    </button>
                </div>


                {automated_emails && automated_emails.emails && automated_emails.emails.map((email) => (
                    <div
                        key={email.id}
                        className={` rounded-xl pl-4 py-2 flex flex-row justify-between text-sm gap-4 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors duration-200`}
                    >

                        <div
                            className={`${email.error !== null ? "cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900/30" : ""} ' rounded-xl p-1 flex flex-row gap-2 items-center md:w-1/3`}
                            onClick={() => {
                                if (email.error !== null) {
                                    setOpenErrorPopup(true)
                                    setEmailErrorSelected(email)
                                }
                            }}
                        >
                            <span className=''>
                                {email.provider} -
                            </span>
                            <span className=''>{(email.email)}</span>
                            {email.error !== null &&

                                <p className="text-xs text-center bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 p-0.5 px-1 inline-block rounded-md overflow-hidden">
                                    <span className="inline-flex items-center gap-2">
                                        <Emoji unified="26a0-fe0f" emojiStyle="apple" size={18} />

                                    </span>
                                </p>

                            }
                        </div>



                        <button
                            className='border border-red-600 text-red-600 flex items-center justify-center rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors duration-200'
                            onClick={() => onClickDeleteCloseOpen(email)}
                            style={{ width: '40px', height: '40px' }}
                        >
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                            </svg>
                        </button>

                        <div className='md:w-1/4'></div>
                    </div>
                ))}

                {/* POPUP CREATE EMAIL */}

                <div className='relative'>
                    {openCreateBox ?
                        <>
                            <div className='absolute top-0 w-full z-20 border border-gray-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-[#151C2C] shadow-xl'>
                                <div ref={listDropRef} className='p-4 flex flex-col'>

                                    <LinkTransEmailForm
                                        closedForm={openCreateBox}
                                        onCloseForm={handleCloseCreatePopUp}
                                        onSelectValue={null}
                                        contextWindow="settings"
                                    />
                                </div>
                            </div>
                            <div className='z-10 fixed top-0 md:top-0 inset-0 bg-gray-400 opacity-60 transition-opacity'>
                            </div>
                        </> : <></>
                    }
                </div>


                {/* POPUP DELETE EMAIL */}

                <div className='relative'>
                    {openDeleteEmail ?
                        <>
                            <div ref={listDropRef2} className='absolute top-0 w-full z-20 border border-gray-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-[#151C2C] shadow-xl'>
                                <div className='p-4 flex flex-col'>
                                    <div className="flex flex-row justify-between items-center">
                                        <h2 as="h3" className="text-lg font-medium leading-6 text-zinc-900 dark:text-white">
                                            Eliminar Vinculo a email - {emailSelected.email}
                                        </h2>
                                        <div type="button"
                                            onClick={() => onClickDeleteCloseOpen(null)}
                                            class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 inline-flex dark:hover:bg-gray-600 dark:hover:text-white" data-modal-toggle="readProductModal">
                                            <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                            <span class="sr-only">Close modal</span>
                                        </div>
                                    </div>
                                    <p className='text-gray-500 dark:text-gray-400 text-justify mt-2'>
                                        Si eliminas esta conexion ya no se hará lectura automatica de transacciones en las siguientes cuentas:
                                    </p>
                                    <ul className='pl-4'>
                                        {accountsRelatedEmail && accountsRelatedEmail.map((account) => (
                                            <li
                                                key={account.id}
                                                className='py-2 flex flex-row justify-start text-sm gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-300 rounded-md px-2 transition-colors duration-200'>

                                                <span className=''>
                                                    {account.name} -
                                                </span>
                                                <span className=''>{(account.bank.name)} - </span>
                                                <span className=''>{(account.last_four_digits)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className='text-gray-500 dark:text-gray-400 text-justify mt-2'>
                                        Estas seguro que quieres eliminar la conexión?
                                    </p>
                                    <div className='flex flex-row justify-end'>
                                        {loadingDelete ?
                                            <div
                                                className='flex justify-center h-[42px] w-[114px] text-red-600 items-center border border-red-600  font-medium rounded-lg text-center dark:border-red-500 dark:text-red-500 '
                                            >
                                                <ThreeDots
                                                    height="30"
                                                    width="30"
                                                    color="#dc2626"
                                                    ariaLabel="loading"
                                                />
                                            </div> :

                                            <button
                                                onClick={() => handleDeleteEmail()}
                                                className='text-red-600 inline-flex items-center hover:text-white border border-red-600 hover:bg-red-600 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900'>
                                                Si, Eliminar!
                                            </button>

                                        }

                                    </div>
                                </div>
                            </div>
                            <div className='z-10 fixed top-0 md:top-0 inset-0 bg-gray-400 dark:bg-black opacity-60 dark:opacity-70 transition-opacity'>
                            </div>
                        </> : <></>
                    }
                </div>
            </section>



            <section>
                <div className="flex flex-col justify-start items-left mb-5">
                    <h3 className="font-medium dark:text-white">WhatsApp</h3>
                    <p className='pt-2 pb-4 text-gray-700 dark:text-gray-400'>Este número se usará para enviarte recordatorios financieros personalizados si lo deseas.</p>

                    {whatsappNumber ? (
                        <div className="flex flex-row items-center gap-4">
                            <span className="text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-full shadow-sm transition-colors duration-300">
                                {whatsappNumber.countryCode} {whatsappNumber}
                            </span>
                            <button
                                onClick={() => setOpenWhatsappForm(true)}
                                className="text-sm px-4 py-2 bg-slate-100 dark:bg-slate-800 dark:text-gray-200 border border-[#5266EB] rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex flex-row items-center group transition-colors duration-300"
                            >
                                <PencilIcon className="w-4 h-4 mr-2 group-hover:text-[#5266EB] dark:group-hover:text-blue-400" />
                                Editar
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setOpenWhatsappForm(true)}
                            className="xl:h-auto h-10 text-sm px-4 flex flex-row items-center bg-slate-100 dark:bg-slate-800 dark:text-gray-200 border border-[#5266EB] rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 group transition-colors duration-300 w-fit"
                        >
                            <PlusIcon className="w-4 h-4 mr-2 group-hover:text-[#5266EB] dark:group-hover:text-blue-400" />
                            <span className="pr-2">Configurar número</span>
                        </button>
                    )}

                    <div className='mt-2 rounded-md overflow-hidden'>
                        <Alert />
                    </div>

                </div>

                {/* POPUP LINK WHATSAPP */}
                <div className=''>
                    {openWhatsappForm && (

                        <>
                            <div className="absolute top-[140px] w-full z-20 border border-gray-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-[#151C2C] shadow-xl">
                                <div className="p-4 flex flex-col gap-1" ref={whatsappFormRef}>
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Número de WhatsApp</label>
                                    <div className="flex flex-row gap-2 items-center">
                                        {/* Country selector */}
                                        <select
                                            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 transition-colors duration-300 select-none outline-none focus:ring-1 focus:ring-[#5266EB]"
                                            value={selectedCountry}
                                            onChange={(e) => setSelectedCountry(e.target.value)}
                                        >
                                            <option value="+1">🇺🇸 +1</option>
                                            <option value="+34">🇪🇸 +34</option>
                                            <option value="+57">🇨🇴 +57</option>
                                            <option value="+52">🇲🇽 +52</option>
                                            {/* Agrega más según necesidad */}
                                        </select>
                                        <input
                                            type="tel"
                                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-300 focus:outline-none focus:ring-1 focus:ring-[#5266EB]"
                                            placeholder="123456789"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                        />
                                    </div>
                                    <div className='mt-2 rounded-md overflow-hidden'>
                                        <Alert />
                                    </div>
                                    {loading ?

                                        <div className="flex justify-end gap-2 mt-4">

                                            <div
                                                onClick={handleSaveWhatsapp}
                                                className="w-[80px] flex justify-center text-sm px-4 py-2 bg-[#5266EB] text-white rounded-md hover:bg-blue-600"
                                            >
                                                <ThreeDots
                                                    height="20"
                                                    width="30"
                                                    radius="9"
                                                    color="#ffffff"
                                                    ariaLabel="three-dots-loading"
                                                    wrapperStyle={{}}
                                                    wrapperClass=""
                                                    visible={true}
                                                />
                                            </div>
                                        </div>
                                        :
                                        <div className="flex justify-end gap-2 mt-4">
                                            <div type="button"
                                                onClick={() => setOpenWhatsappForm(false)}
                                                class="border text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 inline-flex dark:hover:bg-gray-600 dark:hover:text-white" data-modal-toggle="readProductModal">
                                                <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                                <span class="sr-only">Close modal</span>
                                            </div>
                                            <button
                                                onClick={handleSaveWhatsapp}
                                                className="w-[80px] text-sm px-4 py-2 bg-[#5266EB] text-white rounded-md hover:bg-blue-600"
                                            >
                                                Guardar
                                            </button>
                                        </div>
                                    }
                                </div>

                            </div>
                            <div className="z-10 fixed inset-0 bg-gray-400 dark:bg-black opacity-60 dark:opacity-70 transition-opacity" />
                        </>

                    )}
                </div>
            </section>

            <ConexionErrorDisplay
                openErrorPopup={openErrorPopup}
                setOpenErrorPopup={setOpenErrorPopup}
                emailErrorSelected={emailErrorSelected}
            />


        </div>
    );
};

const mapStateToProps = state => ({
    user_extra: state.Auth.user_extra_data,
    automated_emails: state.Conexions.automated_emails,
    user_accounts: state.CashFlow.user_accounts,
    whatsappNumber: state.Auth.user_extra_data.whatsapp

})

export default connect(mapStateToProps, {
    get_automated_emails,
    delete_automated_email,
    update_user_extra_data,
    get_user_extra_data,
    setAlert
})(ConexionesSetts)
