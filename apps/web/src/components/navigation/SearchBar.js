import { useEffect, useState, useRef } from 'react'
import {useNavigate} from 'react-router-dom';

//redux
import { connect  } from 'react-redux'
import { logout } from '../../redux/actions/auth';
//components

//icons
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'


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
            
            
            <div className="w-1/3  ">
                
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