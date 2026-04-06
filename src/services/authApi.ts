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

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(json?.error || "Request failed.");
  }

  return json as TResponse;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
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

export async function getCurrentUser(accessToken: string): Promise<CurrentUserResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(json?.error || "Failed to load current user.");
  }

  return json as CurrentUserResponse;
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

  if (pendingSessionValidation) {
    return pendingSessionValidation;
  }

  pendingSessionValidation = (async () => {
    try {
      const response = await getCurrentUser(existingSession.accessToken);
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
      clearAuthSession();
      return null;
    } finally {
      pendingSessionValidation = null;
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
