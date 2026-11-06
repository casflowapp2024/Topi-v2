//components
import { get_user_categories, create_category } from "../../redux/actions/cashflow";
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import EditCreateCategoryForm from "./EditCreateCategoryForm";
import Alert from '../alert';
import { formatedCurrToNumber, formatMoney } from "../helpers";
import { categoriesApiErrors } from "../errosMaping";
//apiCall
import { CreateCategoryCall } from '../../apiCalls/categories/CreateCategoryCall'
//redux
import { connect } from 'react-redux';
import { setAlert } from "../../redux/actions/alert";

const CreateCategory = ({
  openCreateBox,
  setOpenCreateBox,
  get_user_categories,
  create_category,
  setAlert
}) => {

  const contextEditCreate = "create"

  const {
    loadingCreate,
    formDataCreate,
    setformDataCreate,
    selectedEmoji,
    setSelectedEmoji,
    onSubmitEditCreate,
    onChangeCreate,
    initialFormState, // Obtenemos el estado inicial para resetear
  } = CreateCategoryCall(create_category, get_user_categories, setAlert);


  const handleCloseDetail = async () => {
    setOpenCreateBox(false);
    setTimeout(() => {
      setformDataCreate(initialFormState); // Reiniciamos el estado del formulario
      setSelectedEmoji("");
      setAlert("...", true, "text-white", "bg-white", 300);
    }, 500);
  };


  return (
    <Modal open={openCreateBox} onClose={handleCloseDetail} title="Nuevo presupuesto"
      description="Una categoría con su monto mensual, de gastos o de ingresos."
      footer={<>
        <Button variant="ghost" onClick={() => handleCloseDetail()} disabled={loadingCreate}>Cancelar</Button>
        <Button loading={loadingCreate} onClick={onSubmitEditCreate}>Crear</Button>
      </>}>
      <EditCreateCategoryForm
        categoryData={formDataCreate}
        selectedEmoji={selectedEmoji}
        setSelectedEmoji={setSelectedEmoji}
        onChangeCreate={onChangeCreate}
        loadingCreate={loadingCreate}
        contextEditCreate={contextEditCreate}
        onSubmitEditCreate={onSubmitEditCreate}
        handleCloseDetail={handleCloseDetail}
        hideActions
      />
      <div className="overflow-hidden rounded-2xl mt-3 empty:hidden">
        <Alert />
      </div>
    </Modal>
  )
}

const mapStateToProps = state => ({

})

export default connect(mapStateToProps, {
  get_user_categories,
  create_category,
  setAlert
})(CreateCategory)
