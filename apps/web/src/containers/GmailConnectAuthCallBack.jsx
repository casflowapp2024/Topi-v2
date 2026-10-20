import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const GmailConnectAuthCallBack = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error_description");

    if (code) {
      // ✅ Redirect to a React route with the code in query
      navigate(`/glink-oauth-popup-success?code=${encodeURIComponent(code)}`);
    } else if (error) {
      navigate(`/glink-oauth-popup-success?error=${encodeURIComponent(error)}`);
    }
  }, []);

  return <p>Redirigiéndote a CashFlow…</p>;
};

export default GmailConnectAuthCallBack;
