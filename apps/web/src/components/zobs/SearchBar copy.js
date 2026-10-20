import { Fragment, useEffect, useState, useRef } from 'react'
import {NavLink, Link, useNavigate, Await} from 'react-router-dom';
import { Menu ,Popover, Transition, Dialog, DialogTitle, TransitionChild, DialogPanel } from '@headlessui/react'
import moment from  'moment'
import { Navigate } from 'react-router'
//redux
import { connect, useSelector  } from 'react-redux'
import { logout } from '../../redux/actions/auth';
//components

//icons
import { UserCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { BellAlertIcon, ChatBubbleBottomCenterTextIcon} from '@heroicons/react/24/outline'


function SearchBar({
    contexto,
    user,
    logout,
 

}) {

    //Open User PopUp
    const [openUserPopUp, setOpenUserPopUp] = useState(false)
    const popupRef = useRef(null)

    const handleOpenUserPopUp = () => {
        setOpenUserPopUp(true);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popupRef.current && !popupRef.current.contains(event.target)) {
                setOpenUserPopUp(false);
            }
        };

        // Add event listener
        document.addEventListener('mousedown', handleClickOutside);

        // Cleanup the event listener
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    //logout
    const navigate = useNavigate();

    const handleLogout=()=>{
        //setOpenLogoutBox(false)
        logout()
        navigate("/")
    }

    


    
    return (
 
        <div className="flex flex-row gap-6">

            <div className="w-2/3">
                {/* <div className="w-full px-4 py-1 rounded-full border border-[#e9e8ee] flex flex-row items-center justify-start bg-white">
                    <MagnifyingGlassIcon className="w-5 h-5 mr-2 group-hover:text-[#5266EB]"/>
                    <input 
                    className="w-full h-8"
                    placeholder={`Busca ${contexto} o más ..`}
                    > 
                    </input>
                </div> */}

            </div>
            
            
            <div className="w-1/3 h-full px-1 py-1 flex flex-row gap-2 justify-between items-center bg-white rounded-full border border-[#e9e8ee] ">
                <div className='w-1/4 h-8 border border-gray-200 rounded-full cursor-pointer flex justify-center items-center'>
                    <BellAlertIcon className="w-5 h-5 group-hover:text-[#5266EB]"/>
                </div>
                <div className='w-1/4 h-8  rounded-full cursor-pointer flex justify-center items-center'>
                  
                </div>
                <div className='w-1/2 h-8 cursor-pointer flex items-center justify-end'>
                    <button
                        className={`cursor-pointer flex flex-row items-center ${openUserPopUp ? 'pointer-events-none' : ''}`}
                        onClick={handleOpenUserPopUp}
                    >
                        <UserCircleIcon className="w-[34px] h-full" />
                        <div className='flex flex-row text-[14px]'>
                            {user&&user.name?
                            <span className='pl-1 truncate'>{user.name}</span>:
                            <></>
                            }

                        </div>

                    </button>
                </div>
           
                <div className='relative top-4 left-1'>
                    <div className="flex justify-end">
                        {openUserPopUp && (
                            <div className="absolute top-full right-0 mt-2 w-64 text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg z-40"
                            ref={popupRef}
                            >
                                <div className="pt-4 px-4">
                                    <p >{user.name} {user.lastName}</p>
                                    <p className="text-xs">{user.email}</p>
                                </div>
                                <div className="py-2 border-b-2 border-[#e9e8ee]"/>
                                <div className="pt-4 mx-2 flex flex-col gap-1">
                                    <Link to="/settings/profile/" className="p-2 hover:bg-[#e9e8ee] rounded-md">Perfil</Link>
                                    {/* <Link to="/settings/notifications/" className=" p-2 hover:bg-[#e9e8ee] rounded-md">Notificaciones</Link>
                                    <Link to="/settings/security/" className=" p-2 hover:bg-[#e9e8ee] rounded-md">Seguridad</Link>
                                    <Link to="/settings/upgrade/" className=" p-2 hover:bg-[#e9e8ee] rounded-md">Membresia</Link> */}
                                </div>
                                <div className="py-2 border-b-2 border-[#e9e8ee]"/>
                                <div className="py-2 mx-2 flex flex-col">
                                    <button 
                                    onClick={handleLogout}
                                    className="p-2 hover:bg-[#e9e8ee] rounded-md text-left ">Cerrar Sesión</button>
                                </div>
                                    
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

    )
  }


  const mapStateToProps = state => ({
    user: state.Auth.user,
  })
  
  export default connect(mapStateToProps,{
    logout
  
  }) (SearchBar)