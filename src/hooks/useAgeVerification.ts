import { useState, useEffect } from "react";

export const useAgeVerification = () => {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user has already verified
    const verified = localStorage.getItem("toonlyreels_age_verified");
    setIsVerified(verified === "true");
  }, []);

  const verify = () => {
    localStorage.setItem("toonlyreels_age_verified", "true");
    localStorage.setItem("toonlyreels_verification_date", new Date().toISOString());
    setIsVerified(true);
  };

  const reset = () => {
    localStorage.removeItem("toonlyreels_age_verified");
    localStorage.removeItem("toonlyreels_verification_date");
    setIsVerified(false);
  };

  return { isVerified, verify, reset };
};
