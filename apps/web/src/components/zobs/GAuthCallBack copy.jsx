import { useEffect, useState } from "react";

const GAuthCallback = () => {
  

  const [code, setCode] = useState(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      //console.log("Código de autenticación recibido:", code);
      setCode(code);

 
      if (code && window.opener) {
        window.opener.postMessage({ code }, window.origin);
      }
    } else if (params.get("error_description")) {
      const errorDescription = params.get("error_description");
  
      if (errorDescription.includes("409")) {
        // Notify opener about 409 error
        if (window.opener) {
          window.opener.postMessage({ error: 409 }, window.origin);
        }
      }
  
    }
    // Close the popup

    setTimeout(() => window.close(), 400);
   
  }, []);

  //?error_description=PreSignUp+failed+with+error+409.+&error=invalid_request

  return (
    <>
      {code?
        <p>Autenticación exitosa. Puedes cerrar esta ventana.</p>
        :
        <p>Autenticandote con google... </p>
      }
    </>
)
};

export default GAuthCallback;
