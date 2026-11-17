import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import OAuthPopupCard from "./OAuthPopupCard";

const GmailConnectAuthCallBack = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    // Google manda solo `error` (p. ej. access_denied al cancelar); Microsoft además `error_description`
    const error = params.get("error_description") || params.get("error");

    if (code) {
      // ✅ Redirect to a React route with the code in query
      navigate(`/glink-oauth-popup-success?code=${encodeURIComponent(code)}`);
    } else if (error) {
      navigate(`/glink-oauth-popup-success?error=${encodeURIComponent(error)}`);
    }
  }, []);

  return <OAuthPopupCard state="loading" title="Conectando tu correo…" />;
};

export default GmailConnectAuthCallBack;
