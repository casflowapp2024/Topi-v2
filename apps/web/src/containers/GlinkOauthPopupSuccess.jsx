import { useEffect, useState } from "react";

const GlinkOauthPopupSuccess = () => {

  const [codeReceived, setCodeReceived] = useState("nada")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    console.log("code:",code)
    setCodeReceived(code)

    if (window.opener) {
      if (code) {
        window.opener.postMessage({ code }, window.origin);
      } else if (error) {
        window.opener.postMessage({ error }, window.origin);
      }
    }

    // Optional: Close popup automatically
    setTimeout(() => window.close(), 400);
  }, []);

  return (

    <p>Conexión completada.</p>
  );
};

export default GlinkOauthPopupSuccess;
