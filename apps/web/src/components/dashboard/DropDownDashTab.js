import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
//redux
import { connect } from 'react-redux';
//ui
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import {
    HomeIcon,
    BanknotesIcon,
    CreditCardIcon,
    ArrowsRightLeftIcon
} from '@heroicons/react/20/solid';


const DropDownDashTab = ({
    activeTab,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    //handle close dropdown
    const handleOpenCloseWholeDropDown = async () => {
        if (!isOpen) {
            setIsOpen(true)
        } else {
            setIsOpen(false)
        }
    }

    //close click outside
    const listDropRef = useRef(null)
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if the click was on the filter button or inside the popup
            const isDropListOpen = event.target.closest('button[onClick*="handleOpenFilterPopUp"]');
            const isInsideList = listDropRef.current && listDropRef.current.contains(event.target);

            if (!isDropListOpen && !isInsideList) {
                event.stopPropagation();
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside, true); // Use capture phase
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [isOpen, setIsOpen]);


    const tabNames = {
        general: { name: 'General', icon: HomeIcon },
        budgets: { name: 'Presupuestos', icon: BanknotesIcon },
        accounts: { name: 'Cuentas', icon: CreditCardIcon },
        transactions: { name: 'Transacciones', icon: ArrowsRightLeftIcon },
    };

    const selectedTab = tabNames[activeTab] || tabNames.general;
    const Icon = selectedTab.icon;

    const handleSelect = () => {
        setIsOpen(false); // Close dropdown on selection
    };
    return (
        <div ref={listDropRef} className="relative w-full">
            <button
                type="button"
                onClick={() => handleOpenCloseWholeDropDown()}
                className="w-[155px] pl-3 flex flex-row gap-2 items-center justify-between bg-[#5266EB] text-white shadow-lg cursor-pointer py-2 px-2 border border-gray-200 rounded-2xl"
            >
                <div className='flex items-center gap-2 text-sm'>
                    <Icon className="w-4 h-4" />
                    <span>
                        {selectedTab.name}
                    </span>
                </div>
                <ChevronDownIcon className="w-3 h-3 text-white" />
            </button>

            {isOpen && (
                <>

                    <ul className="absolute z-10 w-full text-sm bg-white border border-gray-300 rounded-2xl shadow-lg max-h-[260px] overflow-y-auto py-1">

                        <Link to="/dashboard" onClick={handleSelect}>
                            <li
                                key="general"
                                className="px-3 py-2 flex items-center gap-2 hover:bg-gray-100 cursor-pointer text-gray-700"
                            >
                                <HomeIcon className="w-4 h-4 text-gray-400" />
                                <span>
                                    General
                                </span>
                            </li>
                        </Link>

                        <Link to="/dashboard/budgets" onClick={handleSelect}>
                            <li
                                key="budgets"
                                className="px-3 py-2 flex items-center gap-2 hover:bg-gray-100 cursor-pointer text-gray-700"
                            >
                                <BanknotesIcon className="w-4 h-4 text-gray-400" />
                                <span>
                                    Presupuestos
                                </span>
                            </li>
                        </Link>
                        <Link to="/dashboard/accounts" onClick={handleSelect}>
                            <li
                                key="accounts"
                                className="px-3 py-2 flex items-center gap-2 hover:bg-gray-100 cursor-pointer text-gray-700"
                            >
                                <CreditCardIcon className="w-4 h-4 text-gray-400" />
                                <span>
                                    Cuentas
                                </span>
                            </li>
                        </Link>
                        <Link to="/dashboard/transactions" onClick={handleSelect}>
                            <li
                                key="transactions"
                                className="px-3 py-2 flex items-center gap-2 hover:bg-gray-100 cursor-pointer text-gray-700"
                            >
                                <ArrowsRightLeftIcon className="w-4 h-4 text-gray-400" />
                                <span>
                                    Transacciones
                                </span>
                            </li>
                        </Link>


                    </ul>
                </>
            )}
        </div>

    )

}

const mapStateToProps = state => ({

})

export default connect(mapStateToProps, {

})(DropDownDashTab)
