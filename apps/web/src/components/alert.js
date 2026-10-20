import {Fragment} from 'react'
import {connect} from 'react-redux'

import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid'

function Alert ({ alert }) {

    const displayAlert = () => {
        if (alert !== null){
            const colorText = alert.colorText
            const colorBg = alert.colorBg
            const isSuccess = alert.isSuccess
            return (
                <>
                    <div className={`${colorBg}`}>
                        <div className="flex flex-row justify-start items-center ">
                            <div className='px-2'>
                                {isSuccess === true?
                                <CheckCircleIcon className={`h-5 w-5 ${colorText}`}/>
                                :
                                <XCircleIcon className={`h-5 w-5 ${colorText}`}  />
                                }
                                
                            </div>
                            <div className="ml-1">
                                <p className={`font-medium ${colorText}`}>{alert.msg}</p>
                            </div>
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

export default connect(mapStateToProps)(Alert)