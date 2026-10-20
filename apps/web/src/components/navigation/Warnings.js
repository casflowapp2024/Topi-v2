import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom';

//redux
import { connect } from 'react-redux'
import { logout } from '../../redux/actions/auth';
import { open_settings_modal } from '../../redux/actions/ui';
//components

//icons


function Warnings({
    automated_emails,
    open_settings_modal

}) {

    const [allWarnigns, setAllWarnings] = useState([])
    //Warnings emails
    const [warningsEmails, setWarningsEmails] = useState([])

    useEffect(() => {
        //fetch warnings emails from backend
        if (automated_emails && automated_emails.emails) {
            const warnings = automated_emails.emails.filter(email => email.error !== null); //cambiar a email.error !== null para produccion
            setWarningsEmails(warnings);
        }
    }, [automated_emails]);


    useEffect(() => {

        if (warningsEmails.length > 0) {
            setAllWarnings(warningsEmails);
        } else {
            //testing
            setAllWarnings([]); //quitar para produccion
        }

    }, [warningsEmails]);





    return (
        <>
            <>
                {allWarnigns.length > 0 &&
                    <div className="bg-yellow-50 border-b-2 border-yellow-300 text-yellow-800 px-4 py-1 overflow-hidden whitespace-nowrap" role="alert">
                        <div className="animate-marquee inline-block">
                            <strong className="font-bold">Atención!</strong>
                            {warningsEmails.length > 0 &&
                                <>
                                    <button
                                        onClick={() => open_settings_modal('connections')}
                                        className="mx-2 hover:underline text-left"
                                    >
                                        Algunas conexiones de correo electrónico para automatización están fallando!
                                        <span className="pl-2 underline font-bold">Revisa la configuración aquí</span>
                                        <span className="mx-4"></span>
                                    </button>
                                </>
                            }
                        </div>
                    </div>
                }
            </>

        </>


    )
}


const mapStateToProps = state => ({
    automated_emails: state.Conexions.automated_emails,
})

export default connect(mapStateToProps, {
    logout,
    open_settings_modal

})(Warnings)