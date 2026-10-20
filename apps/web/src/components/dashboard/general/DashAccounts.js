//redux
import { connect } from 'react-redux';

//components
import FormatMoneyShowDecs from '../../FormatMoneyShowDecs';

const DashAccounts = ({
    user_accounts,
    balance_by_account
}) => {

    const findAccountInSavingsById = (elements, id) => {
        const element = elements.find(element => element.account_id === id);
        return element ? element : null; // Return the name if found, otherwise null
    };

    const findBalanceByAccountId = (elements, id) => {
        const element = elements.find(element => element.account_id === id);
        return element ? element.balance : null; // Return the name if found, otherwise null
    };

    return (

        <div className="flex overflow-x-auto h-[165px] text-gray-700 gap-4">
            {/* <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:flex lg:flex-row xl:gap-x-8 lg:overflow-hidden"> */}
            {user_accounts?.items?.length > 0 &&
                user_accounts.items.map((user_account, index) => (
                    <div key={user_account.id} className="flex-shrink-0 block w-[270px] bg-gradient-to-r from-[#9fa7da] from-0% to-gray-200 to-95% dark:from-[#2e3768] dark:to-gray-800 p-3 border border-transparent dark:border-gray-700 rounded-lg shadow transition-colors duration-300" >
                        <div className='h-1/2'>
                            <h5 className=" text-md font-medium leading-tight text-gray-900 dark:text-gray-100">
                                {user_account.name}
                            </h5>
                            <h6 className="mb-2 text-sm leading-tight text-[#365486] dark:text-[#7f8df2]">
                                {user_account.type.name}
                            </h6>
                            <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                                {user_account.description}
                            </p>

                        </div>
                        <div className='h-1/3'>
                            <div className='flex flex-col justify-end w-full'>

                                <div className=" text-xl text-end font-medium text-gray-900 dark:text-gray-100">
                                    {balance_by_account && findAccountInSavingsById(balance_by_account, user_account.id) !== null ?

                                        <FormatMoneyShowDecs
                                            numb={findBalanceByAccountId(balance_by_account, user_account.id)}
                                            showDecimals={true}
                                            intClass="text-xl"
                                            decClass="text-sm"
                                        />
                                        :
                                        <></>
                                    }
                                </div>
                                <span className=" text-[15px] text-end text-gray-600 dark:text-gray-400">
                                    ****{user_account.last_four_digits}
                                </span>

                            </div>
                        </div>
                        <div className='h-auto flex items-end text-xs font-medium'>
                            {/* <button
                    type="button"
                    className=" py-1   leading-normal text-[#5266EB] hover:underline"
                    >
                    Ver detalle
                    </button> */}

                        </div>
                    </div>
                ))}
            {/* </div> */}

        </div>

    );
};

const mapStateToProps = state => ({
    user_accounts: state.CashFlow.user_accounts,
    balance_by_account: state.Reports.balance_by_account

})

export default connect(mapStateToProps, {

})(DashAccounts)