import { useState, useEffect } from 'react';
//redux
import { connect } from 'react-redux';
//components
import { ThreeDots } from 'react-loader-spinner';


const EditCreateBankForm = ({
    bankData,
    onChangeCreate,
    loadingCreate,
    contextEditCreate,
    onSubmitEditCreate,
    handleCloseDetail,
    windowContext = ""
}) => {

    const [emails, setEmails] = useState(['']);

    useEffect(() => {
        if (bankData.email) {
            setEmails(bankData.email.split(',').map(e => e.trim()));
        } else {
            setEmails(['']);
        }
    }, [bankData.email]);

    const handleEmailChange = (index, value) => {
        const newEmails = [...emails];
        newEmails[index] = value;
        setEmails(newEmails);
        onChangeCreate({
            target: {
                name: 'email',
                value: newEmails.join(',')
            }
        });
    };

    const addEmailInput = () => {
        setEmails([...emails, '']);
    };

    const removeEmailInput = (index) => {
        const newEmails = emails.filter((_, i) => i !== index);
        setEmails(newEmails);
        onChangeCreate({
            target: {
                name: 'email',
                value: newEmails.join(',')
            }
        });
    };

    return(
      <>
      
        {/* FORMULARIO */}
        <div className="flex flex-col">
            <div className='flex flex-row gap-2 '>
                
                <div className={`${windowContext === "acc" ? '' : 'w-3/4'} flex flex-col`}>

                    
                    <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                        Banco</label>
                    

                    <input type="text" name="name" id="name" 
                    value={bankData.name}
                    onChange={e=>onChangeCreate(e)}
                    placeholder="Banco" required
                    className={` ${windowContext==="acc" ? 'p-1' : 'p-2.5'} w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white`}
                    />
                        
                    <div className="mt-4">
                        <label htmlFor="email" className={`${windowContext === "acc" ? 'text-sm' : 'text-sm'} mb-2 block font-medium text-gray-900 dark:text-white`}>
                            Email(s) de transacciones
                        </label>
                        {emails.map((email, index) => (
                            <div key={index} className="flex items-center mb-2">
                                <input
                                    type="text"
                                    name="email"
                                    value={email}
                                    onChange={(e) => handleEmailChange(index, e.target.value)}
                                    placeholder="email de transacciones"
                                    required
                                    className={` ${windowContext === "acc" ? 'p-1' : 'p-2.5'} w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white`}
                                />
                                {index > 0 && (
                                    <button onClick={() => removeEmailInput(index)} className="ml-2 text-red-500 hover:text-red-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                        <button onClick={addEmailInput} className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-500">
                            + Agregar otro email
                        </button>
                    </div>

                    

                </div>
            </div>
            
            <div className={`${windowContext === "acc" ? 'mt-6' : 'mt-2'}  flex justify-end gap-2 `}>
                
                {loadingCreate?
                <div
                className="bg-[#5266EB] text-white px-4 py-2 rounded-lg w-28">
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
                    <button 
                    onClick={e=>handleCloseDetail()} 
                    className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                        </svg>
                    </button>
                
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
  
}) (EditCreateBankForm)
