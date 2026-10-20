import { Fragment, useState, useEffect } from "react";
import { Link} from 'react-router-dom';
//components
import { get_user_categories, create_category} from "../../redux/actions/cashflow";
import Alert from '../alert';
import EditCreateCategoryForm from "../expensePlan/EditCreateCategoryForm";
import LinkTransEmailForm from '../conexions/LinkTransEmailForm';
import { formatedCurrToNumber, formatCurrency } from "../helpers";
import { getPerc0, getPerc2, capitalizeWords } from "../helpers";
import { Emoji } from "emoji-picker-react";
//redux
import { connect } from 'react-redux';
import { setAlert } from "../../redux/actions/alert";
import { linkEmailToFirstAccount } from "./onbActions";
import {CheckCircleIcon} from '@heroicons/react/24/outline';

const OnbLinkEmail = ({
    //actions
    get_user_categories, 
    create_category,
    setAlert,
    //state
    email_done,
}) => {


    useState(() => {
      if (email_done){
        linkEmailToFirstAccount();
      } 
    }, [email_done])


    return(
      <>
      {(email_done===false)?
        <>
          <p className='text-gray-700 text-sm text-justify my-4'>
              Conecta tu correo y olvídate de registrar manualmente tus transacciones. Topi lo hará automáticamente para que tus finanzas estén siempre organizadas y al día.
          </p>
          <div className="border-t border-gray-300 h-2"></div>
          <LinkTransEmailForm
            closedForm ={null}
            onCloseForm={null}
            onSelectValue = {null}
            contextWindow = "onboarding"
            />
          <div className="mt-2 rounded-md overflow-hidden">
            <Alert/>
          </div>
          
        </>:
        <div className="flex flex-col justify-start items-center ">
          
              <div className='flex justify-center items-center pb-5'>
              <CheckCircleIcon className='h-16 w-16 text-green-600'/>
              </div>
              <p className="pb-5 text-md text-center">
                  ¡Vinculaste tu email a Topi! Ahora la lectura de tus transacciones desde el correo será automática.
              </p>
              <p className="text-md text-center bg-yellow-50 border border-yellow-200 rounded-xl p-3 inline-block">
                <span className="inline-flex items-center gap-2">
                    <Emoji unified="1f4a1" emojiStyle="apple" size={20} />
                    <span>
                    Para vincular la atomatización de lecutra de transacciones de tu cuenta de banco o tarjeta asocia este email en la seccion de cuentas y productos!
                    </span>
                </span>
                </p>
        </div>


      }
        
      </>
    )
}


const mapStateToProps = state => ({
  email_done: state.CashFlow.first_steps.email,

})

export default connect(mapStateToProps,{
  get_user_categories,
  create_category,
  setAlert

}) (OnbLinkEmail)
