//import moment from "moment"
import moment from 'moment-timezone';
import axios from 'axios';
;


// ---------------------------------------------------------------- dinero
// Un único formateador de montos (multimoneda). Los montos se guardan exactos; aquí solo se
// redondea para mostrar, con los decimales de cada moneda (currencies.minor_units).
// Valores por defecto = semilla de la tabla currencies; setCurrencies los actualiza desde la API.
const CURRENCY_DEFAULTS = {
    COP: { code: 'COP', name: 'Peso colombiano', symbol: '$', minor_units: 0 },
    USD: { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', minor_units: 2 },
    EUR: { code: 'EUR', name: 'Euro', symbol: '€', minor_units: 2 },
    MXN: { code: 'MXN', name: 'Peso mexicano', symbol: 'MX$', minor_units: 2 },
    GBP: { code: 'GBP', name: 'Libra esterlina', symbol: '£', minor_units: 2 },
    BRL: { code: 'BRL', name: 'Real brasileño', symbol: 'R$', minor_units: 2 },
    CAD: { code: 'CAD', name: 'Dólar canadiense', symbol: 'CA$', minor_units: 2 },
};
let currencyInfo = { ...CURRENCY_DEFAULTS };
let baseCurrency = 'COP';

export const setCurrencies = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach(c => { currencyInfo[c.code] = { ...currencyInfo[c.code], ...c }; });
};
export const getCurrencies = () => Object.values(currencyInfo);
export const getCurrency = (code) => currencyInfo[code] || { code, name: code, symbol: code, minor_units: 2 };
export const setBaseCurrency = (code) => { if (code) baseCurrency = code; };
export const getBaseCurrency = () => baseCurrency;

// Monedas para un selector: COP primero, luego USD y EUR, luego el resto por nombre
export const currencyOptions = () => {
    const first = ['COP', 'USD', 'EUR'];
    const rest = getCurrencies().filter(c => !first.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return [...first.map(getCurrency), ...rest];
};

// Clase de la cuenta: deposit (ahorros, corriente) | investment | credit (tarjetas). La manda la API
// en account.type.class; sin ella sale del tipo (catálogo global: 3 = inversión, 4 = tarjeta).
export const classOfTypeId = (typeId, accountTypes) => {
    const known = (accountTypes || []).find(t => Number(t.id) === Number(typeId));
    if (known?.class) return known.class;
    const id = Number(typeId);
    return id === 3 ? 'investment' : id === 4 ? 'credit' : 'deposit';
};
export const accountClass = (account) => account?.type?.class || classOfTypeId(account?.type?.id ?? account?.type_id);
export const isCreditAccount = (account) => accountClass(account) === 'credit';
export const isInvestmentAccount = (account) => accountClass(account) === 'investment';
// Grupo de la cuenta en los reportes de la API (/analysis/...): savings | investments | credits
export const accountReportGroup = (account) =>
    ({ deposit: 'savings', investment: 'investments', credit: 'credits' })[accountClass(account)];

/**
 * formatMoney(amount, currency, { locale, decimals, compact })
 * amount: número o string decimal (como llega del API). currency: ISO 4217; por defecto la moneda
 * base del usuario. compact: 1,5 M / 250 mil para ejes y leyendas.
 */
export const formatMoney = (amount, currency = baseCurrency, { locale = 'es-CO', decimals, compact = false } = {}) => {
    const n = Number(amount);
    if (amount === null || amount === undefined || amount === '' || !Number.isFinite(n)) return '—';
    const digits = decimals ?? getCurrency(currency).minor_units;
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            notation: compact ? 'compact' : 'standard',
            minimumFractionDigits: compact ? 0 : digits,
            maximumFractionDigits: compact ? 1 : digits,
        }).format(n);
    } catch {
        return `${currency} ${n.toFixed(digits)}`;
    }
};

export const formatMoneyCompact = (amount, currency = baseCurrency) => formatMoney(amount, currency, { compact: true });

// Texto para lectores de pantalla: "100 dólares estadounidenses"
export const moneyAriaLabel = (amount, currency = baseCurrency) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '';
    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency', currency, currencyDisplay: 'name',
            maximumFractionDigits: getCurrency(currency).minor_units,
        }).format(n);
    } catch {
        return `${n} ${currency}`;
    }
};

// Formato del campo de entrada de montos (InputMoneyInt2Decs): símbolo de la moneda y miles con
// coma, porque formatedCurrToNumber lo vuelve a leer quitando todo lo que no sea dígito, punto o signo.
export const formatMoneyInput = (amount, currency = baseCurrency) => {
    const n = Number(amount);
    const symbol = getCurrency(currency).symbol;
    if (!Number.isFinite(n)) return `${symbol}0`;
    const abs = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.abs(n));
    return `${n < 0 ? '-' : ''}${symbol}${abs}`;
};

export const formatedCurrToNumber = (formated) => {
    if (typeof formated !== 'string') return 0;
    const cleaned = formated.replace(/[^0-9.-]+/g, '');
    return parseFloat(cleaned || 0).toFixed(2);  // returns string like "2500.00"
};



export const capitalizeWords = (input) => {
        if (!input) return ''; // Handle empty or null input
        return input
            .split(' ') // Split the string into an array of words
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize the first letter of each word
            .join(' '); // Join the array back into a string
    }

export const firstCapitalWord = (input) => {
    if (!input) return ''; // Handle empty or null input
    return input.charAt(0).toUpperCase()  // Capitalize the first letter of each word
}

export const getPerc0 = (value1) => {
    var newValue = parseFloat(value1).toFixed(0)
    var percentage = newValue + '%'
    return percentage; // Adjust the class for zero values
  
  };

export const getPercPlus = (value1) => {
    var newValue = parseFloat(value1).toFixed(0)
    var percentage
    if (value1 > 0){
      var percentage = '+'+ newValue + '%'
    }else{
      var percentage =  newValue + '%'
    }
    return percentage; // Adjust the class for zero values
  
  };

export const getPerc2 = (value1) => {
    var newValue = parseFloat(value1)
    var percentage = newValue + '%'
    return percentage; // Adjust the class for zero values
  
  };

export const getColorByValue = (value) => {
        if (value >= 0){
            return '#16a34a'
        } else {
            return '#e11d48'
        }
    }

export const findElmentNameById = (elements, id) => {
    //console.log("findElmentNameById", elements, id)
    const element = elements.find(element => element.id === id);
    return element ? element.name : null; // Return the name if found, otherwise null
};

export const findCategoryById = (categories, id) => {
    //console.log("findElmentNameById", elements, id)
    const element = categories.find(element => element.id === id);
    return element ? element.name : null; // Return the name if found, otherwise null
};

export const findElmentById = (elements, id) => {
    const element = elements.find(element => element.id === id);
    return element ? element: null; // Return the name if found, otherwise null
};

export const findElmentByEmail = (elements, email) => {
    const element = elements.find(element => element.email === email);
    return element ? element: null; // Return the name if found, otherwise null
};

export const formatToCustomDate = (dateInput) => {
    const date = new Date(dateInput);

    const pad = (num) => String(num).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // Months are 0-indexed
    const day = pad(date.getDate());

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    // Get timezone offset in minutes and convert to ±HHMM
    const tzOffsetMinutes = date.getTimezoneOffset();
    const tzSign = tzOffsetMinutes > 0 ? '-' : '+';
    const tzHours = pad(Math.floor(Math.abs(tzOffsetMinutes) / 60));
    const tzMinutes = pad(Math.abs(tzOffsetMinutes) % 60);

    const timezone = `${tzSign}${tzHours}${tzMinutes}`;

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timezone}`;
}

export const formatToDateFilters = (dateInput) => {

    const [year1, month1, day1] = dateInput.split('-').map(Number);

  // Create date in local time (without timezone shift)
    const date = new Date(year1, month1 - 1, day1);

    const pad = (num) => String(num).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // Months are 0-indexed
    const day = pad(date.getDate());

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    // Get timezone offset in minutes and convert to ±HHMM
    const tzOffsetMinutes = date.getTimezoneOffset();
    const tzSign = tzOffsetMinutes > 0 ? '-' : '+';
    const tzHours = pad(Math.floor(Math.abs(tzOffsetMinutes) / 60));
    const tzMinutes = pad(Math.abs(tzOffsetMinutes) % 60);

    const timezone = `${tzSign}${tzHours}${tzMinutes}`;

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timezone}`;
}

export const getTimezonesWithOffsets = () => {
  const timezones = moment.tz.names();

  const formattedTimezones = timezones.map(tz => {
    const offset = moment.tz(tz).utcOffset(); // in minutes
    const hours = Math.floor(offset / 60);
    const minutes = offset % 60;
    const sign = offset >= 0 ? '+' : '-';
    const paddedHours = String(Math.abs(hours)).padStart(2, '0');
    const paddedMinutes = String(Math.abs(minutes)).padStart(2, '0');
    const label = `(UTC${sign}${paddedHours}:${paddedMinutes}) ${tz.replace(/_/g, ' ')}`;

    return {
      label,
      value: tz
    };
  });

  // Optional: sort by offset
  formattedTimezones.sort((a, b) => {
    return moment.tz(a.value).utcOffset() - moment.tz(b.value).utcOffset();
  });

  return formattedTimezones;
};

export const request_url_conection = async () => {
  const config = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      Accept: "application/json",
    },
  };

  try {
    const res = await axios.get(
      `${process.env.REACT_APP_API_URL}/email/auth-url?provider=gmail`,
      config
    );

    console.log(res.data);
    if (res.status === 200) {
      return res.data.data.url;
    } else {
      return false;
    }
  } catch (err) {
    console.error("Error fetching auth URL:", err);
    return false;
  }
};



//dates
export const formatDate = (inputDateString) => {
  // The format "YYYY-MM-DD HH:mm:ss ZZ" is what parseDatetimetoDateStrFormat produces.
  const date = moment(inputDateString, "YYYY-MM-DD HH:mm:ss ZZ", true);
  return date.isValid() ? date.format("YYYY-MM-DD") : "Invalid date";
};

export const formatDateTimeWithZone = (inputDateString) => {
  // Let moment handle parsing, it's much more reliable across browsers.
  const date = moment(inputDateString);
  if (!date.isValid()) {
    return "Invalid date";
  }
  // Format to the desired output.
  return date.format("YYYY-MM-DD HH:mm:ss ZZ");
};

export function parseDatetoDatetimeBrow(dateStr, format = "DD-MM-YYYY") {
  // Using moment.js for robust parsing is crucial for cross-browser compatibility,
  // especially with Safari's strict Date parsing.
  if (!dateStr) {
    return new Date(NaN); // Return an invalid date for invalid input
  }

  // Map the custom format to a moment-compatible format.
  const momentFormat = format === "YYYY-MM-DD HH:mm:ss Z" ? "YYYY-MM-DD HH:mm:ss ZZ" : format;

  // Use moment for parsing. The `true` enables strict parsing.
  const mDate = moment(dateStr, momentFormat, true);

  if (mDate.isValid()) {
    return mDate.toDate();
  }

  // Fallback for other formats that moment can parse without a specific format string.
  const fallbackDate = moment(dateStr);
  if (fallbackDate.isValid()) {
    return fallbackDate.toDate();
  }

  // If all parsing fails, return an invalid date.
  return new Date(NaN);
}

export function parseDatetimetoDateStrFormat(jsDate, formatRequired = "DD-MM-YYYY") {
  // Ensure jsDate is a valid Date object from the browser.
  if (!(jsDate instanceof Date) || isNaN(jsDate.getTime())) {
    console.log("js Date is not Date")
    return "Invalid Date";
  }

  const mDate = moment(jsDate);

  // The 'ZZ' token gives the offset without a colon (e.g., +0530), which is what the old `parseDatetoDatetimeBrow` expected.
  const momentFormat = formatRequired === "YYYY-MM-DD HH:mm:ss Z" ? "YYYY-MM-DD HH:mm:ss ZZ" : formatRequired;

  return mDate.format(momentFormat);
}

  // Helper function for deep object comparison
  export function deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
  
    if (
      typeof obj1 !== 'object' || obj1 === null ||
      typeof obj2 !== 'object' || obj2 === null
    ) {
      return false;
    }
  
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
  
    if (keys1.length !== keys2.length) return false;
  
    for (let key of keys1) {
      if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false;
    }
  
    return true;
  }