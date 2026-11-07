import { useState } from 'react'
import Modal from '../ui/Modal'
//redux
import { connect } from 'react-redux'
//components



function UpdateSetts({
    editField,
    openUpdateSettsBox,
    setOpenUpdateSettsBox,
    setAlert,
}) {
    const [gmailPersonalEmail, setGmailPersonalEmail] = useState('')
    const [loadingUpdate, setLoadingUpdate] = useState(false)
    const [linkSucess, setLikSucces] = useState(false)

    const handleClosePopUp = async () => {
        setOpenUpdateSettsBox(false)
        setTimeout(() => {
            setLoadingUpdate(false)
            setLikSucces(false)
            //setAlert('...',true,'text-white','bg-white',100)

        }, 300)
    }

    const onChangeGmail = (e) => {
        setGmailPersonalEmail(e.target.value);
    };

    const onSubmitLink = (e) => {
        setLoadingUpdate(true)

        console.log('linkig', gmailPersonalEmail)
    };



    return (
        <Modal open={Boolean(openUpdateSettsBox)} onClose={handleClosePopUp} title={`Actualizar ${editField || ''}`.trim()} />
    )
}


const mapStateToProps = state => ({


})

export default connect(mapStateToProps, {


})(UpdateSetts)