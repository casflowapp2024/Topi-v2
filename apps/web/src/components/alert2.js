import {Fragment} from 'react'
import {connect} from 'react-redux'

import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid'

function Alert2 ({ alert }) {

    const displayAlert = () => {
        if (alert !== null){
            const isSuccess = alert.isSuccess
            return (
                <>
                    <div>
                        <div className="flex flex-col justify-start items-center ">
                            {isSuccess===true?
                            <>
                                <div className='flex justify-center items-center pb-5'>
                                <CheckCircleIcon className='h-10 w-10 text-green-600'/>
                                </div>
                                <h4 className="pb-5 text-xl text-center">
                                    {alert.msg}
                                </h4>
                            </>:
                            <>
                                <div className='flex justify-center items-center pb-5'>
                                <XCircleIcon className='h-10 w-10 text-red-600'/>
                                </div>
                                <h4 className="pb-5 text-xl text-center">
                                    {alert.msg}
                                </h4>
                            </>
                            }
                            
                        </div>
                    </div>
                </>

            )
        } else {
            return(
                <Fragment></Fragment>
            )
        }
    }

    return (
        <Fragment>
            {displayAlert()}
        </Fragment>
    )
}

const mapStateToProps = state => ({
    alert: state.Alert.alert
})

export default connect(mapStateToProps)(Alert2)