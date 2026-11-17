import { useEffect, useState } from "react";
import OAuthPopupCard from "./OAuthPopupCard";

// Última parada de la ventana emergente del OAuth: entrega el código (o el error) a la ventana de Topi que la abrió
// y se cierra. El código nunca se muestra ni se escribe en la consola.
const GlinkOauthPopupSuccess = () => {
  const [state, setState] = useState("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (!window.opener) {
      setState(code ? "orphan" : "error");
      return;
    }
    if (code) {
      window.opener.postMessage({ code }, window.origin);
      setState("done");
      const timer = setTimeout(() => window.close(), 900);
      return () => clearTimeout(timer);
    }
    window.opener.postMessage({ error: error || "access_denied" }, window.origin);
    setState("error");
  }, []);

  if (state === "done") {
    return <OAuthPopupCard state="done" title="¡Listo! Tu correo quedó conectado" detail="Esta ventana se cierra sola." />;
  }
  if (state === "error") {
    return <OAuthPopupCard state="error" title="No se completó la conexión"
      detail="No diste el permiso o algo falló. Cierra esta ventana e inténtalo de nuevo desde Topi." />;
  }
  if (state === "orphan") {
    return <OAuthPopupCard state="orphan" title="Vuelve a Topi para terminar"
      detail="Perdimos la ventana de Topi que abrió esta conexión. Vuelve y toca Conectar otra vez." />;
  }
  return <OAuthPopupCard state="loading" title="Conectando tu correo…" />;
};

export default GlinkOauthPopupSuccess;
