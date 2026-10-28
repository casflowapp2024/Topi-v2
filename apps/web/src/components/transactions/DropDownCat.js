import { useState, useRef, useEffect} from 'react';
//redux
import { connect } from 'react-redux';
import { setAlert } from "../../redux/actions/alert";
import { get_user_categories, create_category} from "../../redux/actions/cashflow";
//components
import { findElmentById } from '../helpers';
import EditCreateCategoryForm from '../expensePlan/EditCreateCategoryForm';
import { CreateCategoryCall } from '../../apiCalls/categories/CreateCategoryCall';
import { categoriesApiErrors } from '../errosMaping';
//ui
import { ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Emoji } from "emoji-picker-react";


const DropDownCat = ({
     options, selected, onChange, placeholder,
     create_category, setAlert, get_user_categories,
     default_categories
     
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [createBox, setOpenCreateBox] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputRef = useRef(null);

    //handle close dropdown
    const handleToggleDropdown = () => {
        setIsOpen(prev => !prev);
        if (isOpen) { // If it's currently open and will be closed
            setOpenCreateBox(false);
            setSearchTerm(''); // Clear search on close
        }
    };

    // Auto-focus the search input when the dropdown opens
    useEffect(() => {
        if (isOpen && !createBox) {
            // Timeout ensures the input is rendered before we try to focus it
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 0);
        }
    }, [isOpen, createBox]);

    //close category click outside
    const listDropRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click was on the filter button or inside the popup
            const isDropListOpen = event.target.closest('button[onClick*="handleOpenFilterPopUp"]');
            const isInsideList = listDropRef.current && listDropRef.current.contains(event.target);
            
            if (!isDropListOpen && !isInsideList) {
                event.stopPropagation();
                setIsOpen(false);
                setOpenCreateBox(false);
                setSearchTerm(''); // Clear search on close
            }
        };

        if (isOpen || createBox) {
            document.addEventListener('mousedown', handleClickOutside, true); // Use capture phase
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [isOpen, createBox]);
  
    //SELECT CATEGORY
    const [selectedCat, setSelectedCat] = useState(
        {
            id:options[0].id,
            name:options[0].name,
            emoji:options[0].emoji,
        }
    );
    
    useEffect(() => {
        if(selected){
            setSelectedCat(findElmentById(options,selected)
            )
        }
        }, [selected]);

    const handleSelect = (option) => {
        const syntheticEvent = {
                target: {
                id: 'category_id',
                name: 'category_id', // or use a `name` prop
                value: option,
                }
            };
        
        onChange(syntheticEvent);
        setIsOpen(false);
        setOpenCreateBox(false);
        setSearchTerm('');
    };
    
    ///////////CREATE CATEGORY
    const onClickAddCat = () => {
        /* setIsOpen(false); */
        setOpenCreateBox(true);
        };

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

    /* 
    const [selectedEmoji, setSelectedEmoji] = useState("")
    const [loadingCreate, setLoadingCreate] = useState(false)
    const [createCategoryData, setCreateCategoryData] = useState({
      name :'',
      budget :0,
      isIncome: false,
    });
    const onChangeCreate = (e) => {
        if(e.target.name == "isIncome"){
            setCreateCategoryData({ ...createCategoryData, [e.target.name]: e.target.checked})
        }else{
            setCreateCategoryData({ ...createCategoryData, [e.target.name]: e.target.value})
        }
    } */

    /* const onSubmitEditCreate =  async (e) => {
        e.preventDefault();
        setLoadingCreate(true)
 
        const createResponse = await create_category(
            createCategoryData.name, 
            parseFloat(createCategoryData.budget), 
            selectedEmoji, 
            createCategoryData.isIncome)

        if (createResponse["res"] !== false) {
            await get_user_categories(0,20)
            setAlert("Categoría exitosamente creada!",true,"text-white","bg-green-500",3000)
            setLoadingCreate(false)
            handleSelect(createResponse["id"])
            //handleCloseDetail()
        }else{
            const error = createResponse["message"]
          setAlert(categoriesApiErrors[error],true,"text-white","bg-red-500",3000)
          setLoadingCreate(false)
        }
    } */
    
    //handle close edit
    const handleCloseDetail =  async () => {
        setOpenCreateBox(false)
    }

    // Filtering logic
    const filteredUserOptions = options.filter(category =>
        !category.isDefault && category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredDefaultOptions = default_categories.filter(category =>
        !category.userCat && category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
      <div ref={listDropRef}  className="relative w-full">
        <div
            onClick={!isOpen ? handleToggleDropdown : undefined}
            className="w-full pl-2 pr-1 py-1 md:py-2 flex justify-between items-center cursor-pointer text-gray-900 bg-gray-50 border border-gray-300 rounded-lg shadow-sm hover:border-topi-500 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
            {isOpen ? (
                <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar o crear categoría..."
                    className="w-full bg-transparent text-sm focus:outline-none dark:placeholder-gray-400"
                />
            ) : (
                <div className='flex flex-row gap-2 justify-start items-center text-sm cursor-pointer'>
                    {selectedCat && selectedCat.emoji ? (
                        <Emoji unified={(selectedCat.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                    ) : null}
                    <span>
                        {(selectedCat && selectedCat.name) || placeholder}
                    </span>
                </div>
            )}
            <ChevronDownIcon
                className={`w-4 h-4 shrink-0 text-gray-900 dark:text-gray-300 cursor-pointer transition-transform ${isOpen ? 'rotate-180' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleToggleDropdown(); }}
                aria-hidden="true"
            />
        </div>

        {isOpen && (
            <>
                
                <ul className="absolute z-10 mt-1 w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-lg shadow-lg max-h-[260px] overflow-y-auto dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">   
                <div 
                className="cursor-pointer w-full flex flex-row gap-2 items-center py-1 px-2 border-b border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700" 
                key={0}
                onClick={() => onClickAddCat(true)}
                >
                    <PlusIcon className="w-4 h-4 text-topi-600 dark:text-indigo-300" />
                    <span className="text-topi-600 dark:text-indigo-300">
                        Crear nueva Categoría
                    </span>
                </div>  
                {filteredUserOptions.length > 0 ?
                    <>
                        {filteredUserOptions.map((category) => (
                        <li
                        key={category.id}
                        value = {category.id}
                        onClick={() => handleSelect(category.id)}
                        className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                        >

                            <div className="w-[10%] f-full pt-1 pr-2 rounded-full md:w-6 h-6 flex justify-center items-center">
                                <Emoji unified={(category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                            </div>
                            <span>
                                {category.name}
                            </span>
                        </li>
                        ))}
                    </>:
                    <></>
                } 
                <div className='border-t border-gray-200 dark:border-gray-700'>

                    {filteredDefaultOptions.length > 0 && (
                        <h3 className=' py-1 pl-4 text-xs uppercase tracking-wide text-ink-2 bg-gray-50 font-semibold dark:bg-gray-900 dark:text-gray-400'>Recomendadas</h3>
                    )}

                    {filteredDefaultOptions.map((category) => (
                            <li
                            key={category.id}
                            value = {category.id}
                            onClick={() => handleSelect(category.id)}
                            className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            >
                                <div className="w-[10%] f-full pt-1 pr-2 rounded-full md:w-6 h-6 flex justify-center items-center">
                                    <Emoji unified={(category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                                </div>
                                <span>
                                    {category.name}
                                </span>
                            </li>))}


                </div>
                </ul>
            </>
        )}

        {createBox && (
            <div className='absolute mt-1 pt-8 px-2 z-10 h-[260px] w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-lg shadow-lg overflow-y-auto dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'>      
                <EditCreateCategoryForm
                categoryData = {formDataCreate}
                selectedEmoji = {selectedEmoji}
                setSelectedEmoji = {setSelectedEmoji}
                onChangeCreate = {onChangeCreate}
                loadingCreate = {loadingCreate}
                contextEditCreate = {contextEditCreate}
                onSubmitEditCreate = {onSubmitEditCreate}
                handleCloseDetail = {handleCloseDetail}
                windowContext = {"trans"}
                />
            </div>
        )}
      </div>

    )
  
}

const mapStateToProps = state => ({
    default_categories: state.CashFlow.user_categories.default
})

export default connect(mapStateToProps,{
  create_category,
  setAlert,
  get_user_categories
}) (DropDownCat)
