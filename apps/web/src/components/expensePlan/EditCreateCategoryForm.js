import { useEffect } from 'react'


//redux
import { connect } from 'react-redux';
//components
import { ThreeDots } from 'react-loader-spinner';
import DropDownEmoji from './DropDownEmoji';
import CategoryNameInput from './CategoryNameInput';

const EditCreateCategoryForm = ({
    categoryData,
    selectedEmoji,
    setSelectedEmoji,
    onChangeCreate,
    loadingCreate,
    contextEditCreate,
    onSubmitEditCreate,
    handleCloseDetail,
    windowContext = ""
}) => {

    useEffect(() => {
            console.log(categoryData)
        }, [categoryData])
    return(
      <>
      
        {/* FORMULARIO */}
        <div className="flex flex-col mt-2">

            <div className='flex flex-row gap-2 '>
                <div className={` ${windowContext === "trans" ? '' : 'w-1/4'}  flex flex-col justify-center items-center`}>
                <div className='w-full'>
                    <DropDownEmoji
                    selectedEmoji={selectedEmoji}
                    setSelectedEmoji={setSelectedEmoji}
                    windowContext = {windowContext}
                    />
                </div>
                </div>
                <div className={`${windowContext === "trans" ? '' : 'w-3/4'} flex flex-col`}>

                    {
                        windowContext === "trans"?
                        <></>:
                    <label for="name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                        Categoría</label>
                    }

                    {
                        windowContext === "trans"?
                        <input type="text" name="name" id="name" 
                        value={categoryData.name}
                        onChange={e=>onChangeCreate(e)}
                        placeholder="Categoría" required
                        className={` ${windowContext==="trans" ? 'p-1' : 'p-2.5'} w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white`}
                        />:
                        <>
                            
                            <CategoryNameInput
                            categoryData = {categoryData}
                            onChangeCreate = {onChangeCreate}
                            setSelectedEmoji = {setSelectedEmoji}
                            />
                        </>
                    }
                
                    
                    
                    <label For="budget" 
                    className={`${windowContext === "trans" ? 'text-xs' : 'text-sm'} mt-4 mb-2 block font-medium text-gray-900 dark:text-white`}>
                        Presupuesto Mensual </label>
                    <input type="text" name="budget" id="budget" 
                        value={categoryData.budget}
                        onChange={e=>onChangeCreate(e)}
                        placeholder="0" required
                        className={` ${windowContext==="trans" ? 'p-1' : 'p-2.5'} w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white`}
                    />

                    <div className='flex flex-row gap-2 mt-3 items-center'>
                        <input
                            type="checkbox"
                            id="isIncome"
                            name="isIncome"
                            checked={categoryData.isIncome}
                            onChange={e =>onChangeCreate(e)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label
                            htmlFor="isIncome"
                            className="ml-2 text-sm text-gray-900 dark:text-gray-300"
                        >
                            {windowContext === 'trans'?
                            <span className='text-xs'>Ingresos</span>:
                            <span>Esta categoría corresponde a ingresos (como salario o ganancias)</span>
                            }
                            
                        </label>
                    </div>
                </div>
            </div>
            
            <div className={`${windowContext === "trans" ? 'mt-8' : 'mt-2'}  flex justify-end gap-2 `}>
                
                {loadingCreate?
                <div 
                class="bg-[#5266EB] text-white px-4 py-2 rounded-lg w-28">
                    <div className='flex justify-center items-center'>
                        <ThreeDots
                        height="20"
                        width="20"
                        color="white"
                        ariaLabel="loading"
                        />
                    </div>
                </div>
                :
                <>
                {contextEditCreate === "create"?
                    <button
                        onClick={onSubmitEditCreate}
                        className="bg-[#5266EB] text-white px-4 py-2 rounded-lg hover:bg-blue-600 w-28"
                    >
                        Crear
                    </button>:
                    <button
                        onClick={onSubmitEditCreate}
                        className="bg-[#5266EB] text-white px-4 py-2 rounded-lg hover:bg-blue-600 w-28"
                    >
                        Actualizar
                    </button>
            
                }

                {windowContext !== "onboarding"?
                    <button 
                    onClick={e=>handleCloseDetail()} 
                    className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                        </svg>
                    </button>
                    :<></>
                }
                
                </>
                }
            </div>
        </div>

      </>
    )
}

const mapStateToProps = state => ({
})

export default connect(mapStateToProps,{
  
}) (EditCreateCategoryForm)
