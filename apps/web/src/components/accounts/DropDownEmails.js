//redux
import { connect } from 'react-redux';

//react
import { useEffect, useState, useRef } from 'react';

//components
import LinkTransEmailForm from '../conexions/LinkTransEmailForm';
import Alert from '../alert';
//ui
import { ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';


const DropDownEmails = ({ 
    options, 
    selected,
    setValueEmail
    }) => {

    console.log(options)

    const placeholder = 'Selecciona el email donde te notifican las transacciones de esta cuenta'

    //dropdown

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [conectBox, setConectBox] = useState(false);
    
    const handleSelect = (option) => {
        console.log(option)
        setValueEmail(option);
        setIsOpen(false);
        setConectBox(false)
    };

    useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setConectBox(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const onClickAddEmail = () => {
        setIsOpen(false);
        setConectBox(true);
        };

    const handleCloseOpenDropDown =  async () => {
        if (isOpen||conectBox){
            setIsOpen(false)
            setConectBox(false)
        }else{
            setIsOpen(true)
        }
    }

    useEffect(() => {
        console.log("selected",selected)
    }, [selected]);



    return (
        <>
            <div ref={dropdownRef}  className="relative w-full mb-2">
            
                {(selected !== null)&&(selected !== undefined) ?
                    <>
                        <div
                            type="button"
                            onClick={() => handleCloseOpenDropDown()}
                            className="w-full px-2 py-2 flex justify-between items-center text-xs text-gray-500  bg-gray-100 border border-gray-300 rounded-lg shadow-sm hover:border-blue-500 focus:outline-none text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <div className="flex items-center gap-2">
                                {selected.email || placeholder}
                            </div>
                            <ChevronDownIcon className="w-4 h-4 text-gray-900" />
                        </div>
            
                        {isOpen && (
                            <>
                                
                                <ul className="absolute z-40 w-full text-sm bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">   
                                <div 
                                className="cursor-pointer w-full flex flex-row gap-2 items-center py-1 px-2 border-b-2 border-gray-40 hover:bg-gray-200 dark:hover:bg-gray-700" 
                                onClick={() => onClickAddEmail(true)}
                                >
                                    <PlusIcon className="w-4 h-4 text-[#5266EB]" />
                                    <span className="text-[#5266EB]">
                                        Vincula nuevo email a CashFlow
                                    </span>
                                </div>  
                                {options!==null%options&&options?
                                    <>
                                        {options&&options.map((option) => (
                                            <li
                                            key={option.id}
                                            onClick={() => handleSelect(option)}
                                            className="px-3 py-1 flex items-center gap-2 hover:bg-gray-100 cursor-pointer dark:hover:bg-gray-700"
                                            >
                                            {option.email}
                                            </li>
                                        ))}
                                    </>:
                                    <div>
                                        <li className="px-4 py-1 text-gray-500">
                                            Aún no has vinculado ningún correo...
                                        </li>
                                    </div>
                                } 
                                </ul>
                            </>
                        )}
            
                        {conectBox && (
                            <div className='absolute p-4 z-10 w-full text-sm bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100'>
            
                            <LinkTransEmailForm
                            closedForm= {conectBox}
                            onCloseForm={null}
                            onSelectValue = {handleSelect}
                            contextWindow='accounts'
                            />
            
            
                            </div>
                        )}
                    </>:<></>
                }

            </div>
            
        </>
    );
}

const mapStateToProps = state => ({

})

export default connect(mapStateToProps,{


  }) (DropDownEmails)



