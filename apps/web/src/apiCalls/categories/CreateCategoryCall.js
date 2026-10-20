import { useState } from "react";

import { formatedCurrToNumber, formatCurrency} from "../../components/helpers";
import { categoriesApiErrors } from "../../components/errosMaping";

// Define el estado inicial del formulario
const initialFormState = {
  name: "",
  budget: "$0",
  isIncome: false,
};

// El custom hook ahora acepta las funciones de Redux como argumentos
export const CreateCategoryCall = (
  create_category,
  get_user_categories,
  setAlert
) => {
  const [loadingCreate, setloadingCreate] = useState(false);
  const [formDataCreate, setformDataCreate] = useState(initialFormState);
  const [selectedEmoji, setSelectedEmoji] = useState("");

  const onSubmitEditCreate = async (e) => {
    e.preventDefault();
    setloadingCreate(true);

    const createResponse = await create_category(
      formDataCreate.name,
      parseFloat(formatedCurrToNumber(formDataCreate.budget)),
      selectedEmoji,
      formDataCreate.isIncome
    );

    if (createResponse.res !== false) {
      await get_user_categories(0, 20);
      setAlert("Categoría exitosamente creada!",true,"text-white","bg-green-500", 3000 );

      // Reinicia el estado del formulario después de 400ms
      setTimeout(() => {
        setformDataCreate(initialFormState);
        setSelectedEmoji("");
        setloadingCreate(false);
      }, 400);
    } else {
      const error = createResponse.message;
      setAlert(categoriesApiErrors[error],true,"text-white","bg-red-500",3000);
      setloadingCreate(false);
    }
  };

  // También podemos mover onChangeCreate al hook
  const onChangeCreate = (e) => {
    if(e.target.name == "budget"){
      const formated_budget = formatCurrency(formatedCurrToNumber(e.target.value)); // Remove non-numeric characters except for decimal point and minus sign
      setformDataCreate({ ...formDataCreate, [e.target.name]: formated_budget });

    }else if(e.target.name == "isIncome"){
      setformDataCreate({ ...formDataCreate, [e.target.name]: e.target.checked})
    }else{
      setformDataCreate({ ...formDataCreate, [e.target.name]: e.target.value})
    }
    
  }

  // Devolvemos el estado, los setters y la función principal
  return {
    loadingCreate,
    formDataCreate,
    setformDataCreate,
    selectedEmoji,
    setSelectedEmoji,
    onSubmitEditCreate,
    onChangeCreate,
    initialFormState, // Opcional: para usar en handleCloseDetail
  };
};