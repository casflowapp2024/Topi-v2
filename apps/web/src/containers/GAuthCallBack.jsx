import { connect } from 'react-redux';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { load_user, login_with_code } from '../redux/actions/auth';
import { Oval} from 'react-loader-spinner';
import {ReactComponent as Cflogo} from '../assets/logos/T1.svg'
const GAuthCallback = ({
  //actions
  load_user,
  login_with_code,
  //state
  isAuthenticated,
  

}) => {
  

  const [loading, setLoading] = useState(true);
  const [error , setError] = useState(null);
  const [code, setCode] = useState(null);
  
 

  const navigate = useNavigate();

  const triger_go_to_dashboard =  async () => {
        setTimeout(() => {
              navigate("/dashboard")
            }, 1200)
      }

  useEffect(() => {
    if(error !== null){
        setLoading(false)}
    if(isAuthenticated){
        setLoading(false);
        triger_go_to_dashboard()
    }
    }, [isAuthenticated, error]);


  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      //console.log("Código de autenticación recibido:", code);
      setCode(code);
      login_with_code(code)
    } else if (params.get("error_description")) {
      const errorDescription = params.get("error_description");
      setError(errorDescription);
    }
    // Close the popup
   
  }, []);

  //?error_description=PreSignUp+failed+with+error+409.+&error=invalid_request

  return (
    <>
      {!loading?
        <div 
        className="w-screen h-screen flex items-center justify-center bg-gradient-to-r from-[#3a3e54] from-0% to-[#5266EB]  to-95%">
          {error?
          <div className='flex flex-col justify-center items-center gap-3 transition animate-fade-in'
            style={{animationDelay: `${1 * 100}ms`}}>
            <div className='flex flex-col justify-center items-center rounded-full p-1 bg-red-500 shadow-lg'>
              <Cflogo className='w-[80px] h-[80px]'/>
            </div>
            <div className='text-white font-medium mt-4 text-center'>
              Ha ocurrido un error, intenta de nuevo mas tarde.
            </div>
          </div>
          :
          <div className='flex flex-col justify-center items-center rounded-full p-1 bg-green-500 shadow-lg transition animate-fade-in'
            style={{animationDelay: `${1 * 100}ms`}}>
            <Cflogo className='w-[80px] h-[80px]'/>
          </div>
        }
          
        </div>
        :
        <div 
        className="w-screen h-screen flex items-center justify-center bg-gradient-to-r from-[#3a3e54] from-0% to-[#5266EB]  to-95%">
          {loading && <div className="">
        
                  <Oval
                      height={80} 
                      width={80}
                      color="white"
                      wrapperStyle={{}}
                      wrapperClass=""
                      visible={true}
                      ariaLabel='oval-loading'
                      secondaryColor="white"
                      strokeWidth={2}
                      strokeWidthSecondary={2}
                  />
              
            </div>}
        </div>
      }
    </>
)
};


const mapStateToProps = state => ({
    isAuthenticated: state.Auth.isAuthenticated,

})

export default connect(mapStateToProps,{
    load_user,
    login_with_code

}) (GAuthCallback)