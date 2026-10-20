import { useState, useEffect, useRef } from "react";
//redux

//components
import EmojiPicker, { Emoji } from "emoji-picker-react";
import { CursorArrowRaysIcon } from '@heroicons/react/20/solid'
import { emojis_cats } from "../info_arrays";

function DropDownEmoji({
  selectedEmoji,
  setSelectedEmoji,
  windowContext=""
}) {

  /* const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener("resize", handleResize);
    
    // Limpieza del listener
    return () => window.removeEventListener("resize", handleResize);
  }, []); */

  /* let emojiWidth = 600
  let emojiHeight = 320

  if (windowContext === "trans") {
    if (windowSize.width < 640) {
      emojiWidth = 326;
    } else {
      emojiWidth = 250;
    }

    emojiHeight = 248;
  } */

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);
  const dropAccountsRef = useRef(null)
  const handleEmojiClick = (emojiData) => {
    setSelectedEmoji(emojiData.unified); // Store Unicode identifier
    console.log("Emoji Selected:", emojiData.unified); // Debugging log
    setDropdownOpen(false);
  };

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

  let EmojiPickerWidth = "100%";
  /* if (windowContext === "onboarding") {
    EmojiPickerWidth = "896px";} */


  return (
    <div className="w-full relative" ref={dropAccountsRef}>
      {/* Dropdown button */}
      <div className="flex flex-row justify-between items-center">
        <div className=" flex flex-col  items-center justify-center border border-1 rounded-md">
          <span className="text-4xl p-4"> 
          {selectedEmoji ? 
            <Emoji unified={selectedEmoji} emojiStyle="apple" size={52} />
            : 
            <>❔</>
          }
          </span>
          <button
            id="dropdownEmojiButton"
            onClick={toggleDropdown}
            className="w-full p-1 font-medium border-t border-gray-200 text-sm flex justify-around hover:bg-gray-200"
            type="button"
          >
            <span className="text-[10px] text-gray-400">Selecciona el Icono</span>
            <CursorArrowRaysIcon className="w-4 h-4 text-gray-400"/>
            
          </button>
        </div>
      </div>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div id="dropdownEmoji" className={`${windowContext === "trans" ? '' : ''} fixed z-30 inset-0 justify-center`}>
          <div className="bg-transparent rounded-xl p-1 shadow-lg flex flex-col">
            <div className="z-50 w-full bg-white flex justify-end border-t border-x rounded-t-xl border-gray-200 overflow-hidden">
              <button
              className="p-1 pr-3 bg-white  text-gray-500 hover:text-black"
              onClick={toggleDropdown}
              >
                ✕
              </button>
            </div>
            <div className="-my-2">
              <EmojiPicker 
              emojiStyle="apple" 
              onEmojiClick={handleEmojiClick} 
              height={580}
              width={EmojiPickerWidth}
              allowExpandReactions={false}
              previewConfig={{
                showPreview: false
              }}
              categories={emojis_cats}
              
              />
            </div>

            
          </div>
        </div>
      )}
    </div>
  );
}

export default DropDownEmoji;



