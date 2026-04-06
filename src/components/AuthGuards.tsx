import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAuthSession, validateAuthSession } from "../services/authApi";

export function ProtectedRoute() {
  const location = useLocation();
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const session = getAuthSession();
      if (!session?.accessToken) {
        if (isMounted) {
          setAuthStatus("unauthenticated");
        }
        return;
      }

      const validatedSession = await validateAuthSession();
      if (isMounted) {
        setAuthStatus(validatedSession ? "authenticated" : "unauthenticated");
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (authStatus === "checking") {
    return null;
  }

  if (authStatus === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "unauthenticated">("checking");

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const session = getAuthSession();
      if (!session?.accessToken) {
        if (isMounted) {
          setAuthStatus("unauthenticated");
        }
        return;
      }

      const validatedSession = await validateAuthSession();
      if (isMounted) {
        setAuthStatus(validatedSession ? "authenticated" : "unauthenticated");
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (authStatus === "checking") {
    return null;
  }

  if (authStatus === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
