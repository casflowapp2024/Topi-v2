//components
import { findElmentNameById } from "../../components/helpers";
import FormatMoneyShowDecs from "../../components/FormatMoneyShowDecs";

const AccCard = ({
    name,
    accountTypesOptions,
    accountType, 
    banks,
    bankId,
    initia_balance_amount,
    lastFourDigits,
    currency,
    base, // equivalente en la moneda base (si la cuenta es en otra moneda)
}) => {

    


    return(
        <div className="flex-shrink-0 block h-[150px] w-[270px] bg-gradient-to-r from-topi-100 to-gray-100 dark:from-topi-500/30 dark:to-gray-800 p-3 rounded-2xl shadow-sm text-gray-900 dark:text-gray-100" >
            <div className='h-1/2'>
                <h5 className=" text-md font-medium leading-tight ">
                    {name===""?
                    <>Nuevo Producto</>:
                    <>{name}</>
                    }
                </h5>
                <h6 className="mb-1 text-sm leading-tight text-gray-600 dark:text-gray-300">
                    {accountTypesOptions.items?
                    <>{findElmentNameById(accountTypesOptions.items,parseInt(accountType))}</>
                    :<></>
                    }              
                
                </h6>
                <h6 className="mb-2 text-sm leading-tight text-gray-600 dark:text-gray-300">   
                    {banks&&banks?
                    <>{findElmentNameById(banks,parseInt(bankId))}</>
                    :<></>
                    }            
                </h6>
                
            </div>
            <div className='h-1/2 flex items-end'>
                <div className='flex flex-col justify-end w-full'>
                
                    <div className=" text-xl text-end font-medium">
                        <FormatMoneyShowDecs
                            numb={initia_balance_amount}
                            currency={currency}
                            base={base}
                            showDecimals={true}
                            intClass="text-xl"
                            decClass="text-base"
                        />
                        
                        {/* <span>{initia_balance_amount}</span> */}

                    </div>
                    <span className=" text-[15px] text-end ">
                            ****{lastFourDigits}
                    </span>
                    
                </div>
            </div>
        </div> 
    )
}

export default AccCard
