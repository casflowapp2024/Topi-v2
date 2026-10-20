import { useState, useEffect, useRef } from "react";

function DropDownAccount({
  user_accounts,
  accountsSelected = [], // Default value for selected accounts
  setAccountsSelected, // Callback to update selected accounts
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  const handleAccountSelection = (accountId, isSelected) => {
    setAccountsSelected((prevSelected) => {
      if (!isSelected && prevSelected.length === 1) {
        // Prevent deselecting the last remaining option
        /* alert("At least one account must be selected."); */
        return prevSelected; // No change to the state
      }
      if (isSelected) {
        // Add account ID if not already selected
        return prevSelected.includes(accountId) ? prevSelected : [...prevSelected, accountId];
      } else {
        // Remove account ID if deselected
        return prevSelected.filter((id) => id !== accountId);
      }
    });
  };

  //close dropdown
    const dropAccountsRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropAccountsRef.current && !dropAccountsRef.current.contains(event.target)) {
              setDropdownOpen(false);
            }
        };

        // Add event listener
        document.addEventListener('mousedown', handleClickOutside);

        // Cleanup the event listener
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


  return (
    <div className="relative" ref={dropAccountsRef}>
      {/* Dropdown button */}
      <button
        id="dropdownHelperButton"
        onClick={toggleDropdown}
        className="text-white bg-[#5266EB] hover:bg-[#3a4ab2] font-medium rounded-2xl text-sm px-5 py-2.5 text-center inline-flex items-center dark:bg-blue-600 dark:hover:bg-blue-700"
        type="button"
      >
        Seleccionar
        <svg
          className="w-2.5 h-2.5 ms-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 10 6"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m1 1 4 4 4-4"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div
          id="dropdownHelper"
          className="absolute z-10 right-0 w-64 border border-gray-200 bg-white divide-y divide-gray-100 rounded-2xl shadow-sm dark:bg-gray-700 dark:divide-gray-600"
          
        >
          <ul
            className="p-3 space-y-1 text-sm text-gray-700 dark:text-gray-200"
            aria-labelledby="dropdownHelperButton"
          >
            {user_accounts&&
              user_accounts.map((option) => (
                <li key={option.id}>
                  <div className="flex items-center p-2 border-b border-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-sm">
                    <input
                      id={`helper-checkbox-${option.id}`}
                      type="checkbox"
                      value={option.id}
                      className="w-4 h-4 text-[#5266EB] bg-gray-100 border-gray-300 rounded-sm"
                      checked={accountsSelected.includes(option.id)} // Properly bind checked state
                      onChange={(e) =>
                        handleAccountSelection(option.id, e.target.checked)
                      }
                    />
                    <label
                      htmlFor={`helper-checkbox-${option.id}`}
                      className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
                    >
                      <div>{option.name}</div>
                      <p className="text-xs font-normal text-gray-500 dark:text-gray-300">
                        {option.bank.name} - {option.type.name}
                      </p>
                    </label>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default DropDownAccount;




