import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "./helpers"; // your existing helper

// FormatMoneyShowDecs.jsx
const InputMoneyInt2Decs = ({
  name,
  id,
  onChangeCreate,
  number, // float or numeric string
}) => {
  const [integerPart, setIntegerPart] = useState("");
  const [decimalPart, setDecimalPart] = useState("");
  const [showDecimals, setShowDecimals] = useState(false);

  // --- Seed state from `number` on mount and when it changes ---

  useEffect(() => {

    //is string or number
    if (typeof number === 'string') {
      //console.log("InputMoneyInt2Decs is string: ", number);
      if (number === "") return;
      if (number === "$0") {
      setIntegerPart("$0");
      setDecimalPart("");
      setShowDecimals(false);
      }else return

    }else if (typeof number === 'number') {

      const n = Number(number);
      //console.log("InputMoneyInt2Decs is number N: ", n);
      
      const isNeg = n < 0;
      const abs = Math.abs(n);

      // two decimals, then split
      const [intStr, decStrRaw] = abs.toFixed(2).split(".");
      //console.log("InputMoneyInt2Decs intStr: ", intStr, " decStrRaw: ", decStrRaw);
      // format the integer with your helper (which handles $ and grouping)
      // to keep the sign, pass a negative integer if original number was negative
      const formattedInt = formatCurrency(isNeg ? -Number(intStr) : Number(intStr));
      
      setIntegerPart(formattedInt);

      if (decStrRaw && decStrRaw !== "00") {
        setDecimalPart(decStrRaw);
        setShowDecimals(true);
      } else {
        setDecimalPart("");
        setShowDecimals(false);
      }
    } else return
  }, [number]);


  const decimalRef = useRef(null);

  const handleIntegerChange = (e) => {
    const input = e.target;
    const originalValue = input.value;
    const originalSelectionStart = input.selectionStart;

    // Count non-digit characters before the cursor in the original value
    const nonDigitsBeforeCursor = (originalValue.substring(0, originalSelectionStart).match(/[^0-9]/g) || []).length;

    let val = originalValue.replace(/[^0-9.-]+/g, '');

    if (val.includes('.')) {
      const [int, dec] = val.split('.');
      setIntegerPart(`${formatCurrency(int)}` || '$0');
      setDecimalPart(dec?.slice(0, 2) || '');
      setShowDecimals(true);

      setTimeout(() => {
        decimalRef.current?.focus();
      }, 10);
    } else {
      const newFormattedValue = `${formatCurrency(val)}` || '$0';
      setIntegerPart(newFormattedValue);

      // After state update, calculate and set the new cursor position
      requestAnimationFrame(() => {
        const nonDigitsInNew = (newFormattedValue.substring(0, originalSelectionStart).match(/[^0-9]/g) || []).length;
        const cursorOffset = nonDigitsInNew - nonDigitsBeforeCursor;
        const newCursorPos = originalSelectionStart + cursorOffset;
        
        // Ensure cursor position is valid
        const finalCursorPos = Math.max(0, Math.min(newCursorPos, newFormattedValue.length));
        input.setSelectionRange(finalCursorPos, finalCursorPos);
      });
    }
  };

    const handleDecimalChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
        setDecimalPart(val);
    };

    const integerRef = useRef(null);
    const handleBackspace = (e) => {
    if (e.key === 'Backspace' && decimalPart === '') {
        setShowDecimals(false);
        setTimeout(() => {
        integerRef.current?.focus();
        }, 10);
    }
    };

    const handleUpdateAmountValue = () => {
        //console.log("amount value: ",integerPart, decimalPart);
        const syntheticEvent = {
                target: {
                id: id,
                name: name, // or use a `name` prop
                value: `${integerPart}${decimalPart ? `.${decimalPart}` : ''}`,
                }
            };
        
        onChangeCreate(syntheticEvent);
    };

    const handleFocus = (e) => {
        // If the current value is "$0", treat it as a placeholder and clear it.
        // This allows the user to start typing a new number without fighting the "0".
        if (e.target.value === "$0" || e.target.value === "" || e.target.value === null) {
            setIntegerPart("$");
            setDecimalPart("");
        }
    };

    useEffect(() => {
        handleUpdateAmountValue(); 
    }, [integerPart, decimalPart]);

  return (
    <div className="flex flex-row items-center justify-end mt-2 text-sm">
      <input
        ref={integerRef}
        type="text"
        value={integerPart}
        onChange={handleIntegerChange}
        onFocus={handleFocus}
        className={`${showDecimals ? "rounded-l-md w-[85%]" : "rounded-lg w-full"} bg-gray-100 px-2 py-1 md:py-2 border border-gray-300 text-right`}
      />

      {showDecimals && (
        <>
          <span className="px-1 select-none">.</span>
          <input
            ref={decimalRef}
            type="text"
            value={decimalPart}
            onChange={handleDecimalChange}
            onKeyDown={handleBackspace}
            className="bg-gray-100 px-1 py-1 md:py-2 rounded-r-md border border-gray-300 w-[15%]"
          />
        </>
      )}
    </div>
  );
};

export default InputMoneyInt2Decs;
