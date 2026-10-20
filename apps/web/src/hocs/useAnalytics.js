import { useEffect } from "react";
import { useSelector } from "react-redux";

export default function useAnalytics() {
  const user = useSelector((state) => state.Auth.user_extra_data);
  const trackingId = process.env.REACT_APP_GA_TRACKING_ID;

  // Effect to initialize the Google Analytics script
  useEffect(() => {
    if (!trackingId) return;

    // Prevent adding the script multiple times
    if (document.querySelector(`script[src*="${trackingId}"]`)) {
      return;
    }

    const script1 = document.createElement("script");
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
    document.head.appendChild(script1);

    const script2 = document.createElement("script");
    script2.id = "ga-config";
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${trackingId}');
    `;
    document.head.appendChild(script2);
  }, [trackingId]);

  // Effect to set the user_id once the user is logged in
  useEffect(() => {
    // When the user logs in, send a 'config' update with the user_id.
    // This associates all subsequent events in this session with this user.
    if (user && user.user_id && trackingId && window.gtag) {
      // 1. Set the user_id using the 'config' command (This is correct)
      // 1. Explicitly set user properties using the 'set' command.
      // This ensures they apply to all subsequent events on this page.
      window.gtag("set", "user_properties", {
        user_db_id: user.user_id,
        user_id: user.user_id,
      });
      // 2. Set the user_id using the 'config' command
      window.gtag("config", trackingId, {
        user_id: user.user_id,
      });
      // 2. Explicitly log a custom event to confirm the user ID is now attached.
      // This is a "best practice" event to fire immediately after login.
      window.gtag("event", "login_complete", {
        method: "loggin", // or 'google', etc.
      });
    }
  }, [user, trackingId]);
}
