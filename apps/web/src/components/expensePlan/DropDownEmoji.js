import { useState, useRef } from "react";
//redux

//components
import EmojiPicker, { Emoji } from "emoji-picker-react";
import { CursorArrowRaysIcon } from '@heroicons/react/20/solid'
import { emojis_cats } from "../info_arrays";
import Modal from "../ui/Modal";

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
    setDropdownOpen(false);
  };



  return (
    <div className="w-full relative" ref={dropAccountsRef}>
      {/* Dropdown button */}
      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-col items-center justify-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
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
            className="w-full p-1.5 font-medium border-t border-gray-200 dark:border-gray-700 text-sm flex justify-around items-center hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-topi-500"
            type="button"
          >
            <span className="text-[11px] text-ink-2 dark:text-gray-400">Elegir ícono</span>
            <CursorArrowRaysIcon className="w-4 h-4 text-gray-400"/>
            
          </button>
        </div>
      </div>

      {/* Selector en un diálogo de la app: centrado y por encima de la barra de navegación; hoja inferior en
          móvil (plan/30). Antes era un panel fijo de ancho completo que quedaba debajo de la barra. */}
      <Modal open={dropdownOpen} onClose={() => setDropdownOpen(false)} title="Elige un ícono" size="md" bodyClassName="p-0">
        <EmojiPicker
          emojiStyle="apple"
          onEmojiClick={handleEmojiClick}
          height={420}
          width="100%"
          allowExpandReactions={false}
          previewConfig={{ showPreview: false }}
          categories={emojis_cats}
        />
      </Modal>
    </div>
  );
}

export default DropDownEmoji;



