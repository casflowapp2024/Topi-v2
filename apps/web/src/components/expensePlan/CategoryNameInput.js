import { inputClass } from "../ui/Field";
import { useState, useRef, useEffect } from 'react';
//redux
import { connect } from 'react-redux';
//components
import { Emoji } from "emoji-picker-react";



const CategoryNameInput = ({
  categoryData,
  onChangeCreate,
  setSelectedEmoji,
  default_categories

}) => {
  const [inputValue, setInputValue] = useState(categoryData.name || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(default_categories);
  const dropdownRef = useRef();

  // Filter options when input changes
  useEffect(() => {
    if (inputValue === '') {
      setFilteredOptions(default_categories);
    } else {
      setFilteredOptions(
        default_categories.filter(option =>
          option.name.toLowerCase().includes(inputValue.toLowerCase())
        )
      );
    }
    const syntheticEvent = {
                target: {
                id: 'name',
                name: 'name', // or use a `name` prop
                value: inputValue,
                }
            };
    onChangeCreate(syntheticEvent);

  }, [inputValue]);

  useEffect(() => {
    if (categoryData.name === '') {
      setInputValue('');
      setFilteredOptions(default_categories);
    }
  }, [categoryData.name]);



  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (value, emoji) => {
    setInputValue(value);
    setShowDropdown(false);
    setSelectedEmoji(emoji);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <input
        type="text"
        name="category"
        value={categoryData.name}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        placeholder="Categoría"
        className={inputClass()}
      />

      {showDropdown && filteredOptions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">
          <h3 className='text-xs py-1.5 pl-4 text-ink-2 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 font-semibold'>Recomendadas</h3>
          {filteredOptions.map((category, index) => (
            <>
            {!category.userCat?
              <li
              key={category.id}
              value = {category.id}
              onClick={() => handleSelect(category.name, category.emoji)}
              className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                  <div className="w-[10%] f-full pt-1 pr-2 rounded-full md:w-6 h-6 flex justify-center items-center">
                      <Emoji unified={(category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                  </div>
                  <span>
                      {category.name}
                  </span>
              </li>:<></>
            }
            </>
           
          ))}
        </ul>
      )}
    </div>
  );
}


const mapStateToProps = state => ({
  default_categories: state.CashFlow.user_categories.default
})

export default connect(mapStateToProps,{
  
}) (CategoryNameInput)