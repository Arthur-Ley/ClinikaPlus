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
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthSession());
}
