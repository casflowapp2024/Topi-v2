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
}) => {

    


    return(
        <div className="flex-shrink-0 block h-[150px] w-[270px] bg-gradient-to-r from-[#9fa7da] from-0% to-gray-200 to-95% p-3 border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700" >
            <div className='h-1/2'>
                <h5 className=" text-md font-medium leading-tight ">
                    {name===""?
                    <>Nuevo Producto</>:
                    <>{name}</>
                    }
                </h5>
                <h6 className="mb-1 text-sm leading-tight text-[#3b3e44]">
                    {accountTypesOptions.items?
                    <>{findElmentNameById(accountTypesOptions.items,parseInt(accountType))}</>
                    :<></>
                    }              
                
                </h6>
                <h6 className="mb-2 text-sm leading-tight text-[#3b3e44]">   
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
