// FormatMoneyShowDecs.jsx
const FormatMoneyShowDecs = ({
  numb = 0,
  showDecimals = true,
  intClass = "",   // e.g. "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
  decClass = "",   // e.g. "text-base sm:text-lg md:text-xl lg:text-2xl"
  sizeInt = 24,    // used only if intClass not provided
  sizeDec = 16,    // used only if decClass not provided
  currencySymbol = "$",
  //negativeClass = "text-red-500", // optional styling for negative numbers
}) => {
  const n = Number(numb) || 0;
  const isNegative = n < 0;
  const absN = Math.abs(n);

  // Build parts from the absolute value, then prefix the sign manually
  const [rawInt, rawDec] = absN.toFixed(2).split(".");
  const intWithGrouping = rawInt.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <span className="inline-flex items-baseline">
      {/* Sign first, if negative */}
      {isNegative && (
        <span aria-hidden="true">-</span> //className={negativeClass}
      )}

      {/* Integer + currency symbol */}
      <span
        className={intClass}
        style={!intClass ? { fontSize: `${sizeInt}px`, lineHeight: 1 } : undefined}
      >
        {currencySymbol}
        {intWithGrouping}
        {showDecimals && "."}
      </span>

      {/* Decimals */}
      {showDecimals && (
        <span
          className={decClass}
          style={!decClass ? { fontSize: `${sizeDec}px`, lineHeight: 1 } : undefined}
        >
          {rawDec}
        </span>
      )}
    </span>
  );
};

export default FormatMoneyShowDecs;
