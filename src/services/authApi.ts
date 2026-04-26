export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role: string;
  };
};

export type CurrentUserResponse = {
  user: LoginResponse["user"];
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const AUTH_STORAGE_KEY = "clinikaplus.auth";
let pendingSessionValidation: Promise<LoginResponse | null> | null = null;
let pendingSessionValidationToken: string | null = null;
let authFetchInterceptorInstalled = false;

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isApiRequestUrl(value: string): boolean {
  if (value.startsWith("/api")) {
    return true;
  }

  if (isAbsoluteUrl(API_BASE_URL) && value.startsWith(API_BASE_URL)) {
    return true;
  }

  return false;
}

function isPublicAuthRequest(value: string): boolean {
  const authPaths = ["/auth/login", "/auth/register", "/auth/forgot-password"];
  return authPaths.some((path) => value.includes(path));
}

function toLoginRedirectUrl(): string {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const encodedCurrentPath = encodeURIComponent(currentPath);
  return `/login?redirect=${encodedCurrentPath}`;
}

async function postJson<TResponse>(path: string, body: unknown, maxRetries = 3): Promise<TResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(json?.error || `Server error: ${response.status}`);
      }

      return json as TResponse;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on 4xx errors (client errors)
      if (lastError.message.includes("Server error: 4")) {
        throw lastError;
      }

      // If this is the last attempt, throw
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff: 300ms, 600ms)
      await new Promise(resolve => setTimeout(resolve, 300 * attempt));
    }
  }

  throw lastError || new Error("Request failed.");
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  // Clear any pending validation before starting a new login
  pendingSessionValidation = null;
  pendingSessionValidationToken = null;
  clearAuthSession();
  
  return postJson<LoginResponse>("/auth/login", payload);
}

export async function register(payload: RegisterPayload): Promise<{
  message: string;
  needsEmailConfirmation: boolean;
}> {
  return postJson<{ message: string; needsEmailConfirmation: boolean }>("/auth/register", payload);
}

export async function requestPasswordReset(email: string, redirectTo: string): Promise<{ message: string }> {
  return postJson<{ message: string }>("/auth/forgot-password", { email, redirectTo });
}

export async function getCurrentUser(accessToken: string, maxRetries = 3): Promise<CurrentUserResponse> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
  
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });
  
      clearTimeout(timeoutId);
  
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
  
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error(json?.error || `Server error: ${response.status}`);
      }
  
      return json as CurrentUserResponse;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
  
      // Don't retry on 401 (unauthorized)
      if (lastError.message === "Unauthorized") {
        throw lastError;
      }
  
      // Don't retry on 4xx errors (client errors)
      if (lastError.message.includes("Server error: 4")) {
        throw lastError;
      }
  
      // If this is the last attempt, throw
      if (attempt === maxRetries) {
        throw lastError;
      }
  
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 300 * attempt));
    }
  }
  
  throw lastError || new Error("Failed to load current user.");
}

export function saveAuthSession(session: LoginResponse): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthSession(): LoginResponse | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LoginResponse;
    if (!parsed?.accessToken || !parsed?.user?.id) {
      clearAuthSession();
      return null;
    }
    return parsed;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthSession());
}

export async function validateAuthSession(): Promise<LoginResponse | null> {
  const existingSession = getAuthSession();
  if (!existingSession?.accessToken) {
    clearAuthSession();
    return null;
  }

  if (pendingSessionValidation && pendingSessionValidationToken === existingSession.accessToken) {
    return pendingSessionValidation;
  }

  const tokenToValidate = existingSession.accessToken;
  pendingSessionValidationToken = tokenToValidate;

  pendingSessionValidation = (async () => {
    try {
      const response = await getCurrentUser(tokenToValidate);
      const nextSession: LoginResponse = {
        ...existingSession,
        user: {
          ...existingSession.user,
          ...response.user,
        },
      };

      saveAuthSession(nextSession);
      return nextSession;
    } catch {
      const latestSession = getAuthSession();
      if (!latestSession || latestSession.accessToken === tokenToValidate) {
        clearAuthSession();
      }
      return null;
    } finally {
      if (pendingSessionValidationToken === tokenToValidate) {
        pendingSessionValidation = null;
        pendingSessionValidationToken = null;
      }
    }
  })();

  return pendingSessionValidation;
}

export function installAuthFetchInterceptor(): void {
  if (authFetchInterceptorInstalled || typeof window === "undefined") {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const isApiRequest = isApiRequestUrl(requestUrl);
    const isPublicAuth = isPublicAuthRequest(requestUrl);
    const session = getAuthSession();
    const headers = new Headers(
      init?.headers ??
      (input instanceof Request ? input.headers : undefined),
    );

    if (isApiRequest && !isPublicAuth && session?.accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${session.accessToken}`);
    }

    const response = await originalFetch(input, {
      ...init,
      headers,
    });

    if (isApiRequest && !isPublicAuth && response.status === 401) {
      clearAuthSession();
      if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
        window.location.replace(toLoginRedirectUrl());
      }
    }

    return response;
  };

  authFetchInterceptorInstalled = true;
}
