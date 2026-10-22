import { useState} from 'react'

function DropDownPeriod({
    optionsDict,
    balancePeriod,
    setBalancePeriod
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const options = Object.keys(optionsDict);
  

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  const handleOptionClick = (option) => {
    setBalancePeriod(option);
    setDropdownOpen(false);
  };

  return (
    <div className="relative border border-gray-300 rounded-2xl mr-4">
      {/* Dropdown button */}
      <button
        onClick={toggleDropdown}
        className="w-[158x] flex flex-row justify-between text-gray-700 bg-white hover:bg-gray-100 focus:ring-0 focus:outline-none focus:ring-blue-300 font-medium rounded-2xl text-xs p-2 text-center items-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 overflow-hidden"
        type="button"
      >
        {balancePeriod}
        <svg
          className="w-2.5 h-2.5 ms-1"
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
          id="dropdown"
          className="absolute right-0 z-10 border border-gray-300 bg-white divide-y divide-gray-100 rounded-xl shadow w-[128px] dark:bg-gray-700"
        >
          <ul className="py-2 text-xs text-gray-700 dark:text-gray-200" aria-labelledby="dropdownDefaultButton">
            {options.map((option, index) => (
              <li key={index}>
                <button
                  onClick={() => handleOptionClick(option)}
                  className="w-full text-left block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default DropDownPeriod;
