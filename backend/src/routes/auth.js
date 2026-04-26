import { Router } from "express";
import { env } from "../config/env.js";
import { supabase } from "../lib/supabase.js";
import { supabaseAuth } from "../lib/supabaseAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRouter = Router();
const APP_USERS_SCHEMA = "subsystem3";
const DEFAULT_ROLE = "pharmacist";
const AUTH_CONNECTIVITY_ERROR_CODES = new Set([
  "ABORT_ERR",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

function getUserMetadata(user) {
  if (user?.user_metadata && typeof user.user_metadata === "object") {
    return user.user_metadata;
  }

  if (user?.raw_user_meta_data && typeof user.raw_user_meta_data === "object") {
    return user.raw_user_meta_data;
  }

  return {};
}

function isAuthConnectivityError(error) {
  const code = error?.cause?.code || error?.code || "";
  return AUTH_CONNECTIVITY_ERROR_CODES.has(code) || error?.message === "fetch failed";
}

function sendAuthServiceUnavailable(res) {
  return res.status(503).json({
    error: "Authentication service is temporarily unavailable. Please try again in a moment.",
  });
}

function isAuthDatabaseErrorMessage(message) {
  const normalized = typeof message === "string" ? message.toLowerCase() : "";
  return normalized.includes("database error saving new user");
}

async function loadAppUserProfile(userId) {
  const { data } = await supabase
    .schema(APP_USERS_SCHEMA)
    .from("tbl_users")
    .select("first_name, last_name, email, role")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, dob, password } = req.body ?? {};
    const trimmedEmail = typeof email === "string" ? email.trim() : "";

    if (!trimmedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const redirectOrigin = env.corsOrigin.split(",")[0]?.trim() || "http://localhost:5173";
    let signUpResult;

    try {
      signUpResult = await supabaseAuth.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${redirectOrigin}/login`,
          data: {
            first_name: typeof firstName === "string" ? firstName.trim() : "",
            last_name: typeof lastName === "string" ? lastName.trim() : "",
            phone: typeof phone === "string" ? phone.trim() : "",
            dob: typeof dob === "string" ? dob.trim() : "",
          },
        },
      });
    } catch (error) {
      if (isAuthConnectivityError(error)) {
        return sendAuthServiceUnavailable(res);
      }

      throw error;
    }

    const { data, error } = signUpResult;

    if (error) {
      if (isAuthDatabaseErrorMessage(error.message)) {
        return res.status(500).json({
          error:
            "Supabase signup is failing because the auth user sync trigger is misconfigured. Apply backend/src/db/auth_user_profile_sync.sql in the Supabase SQL editor, then try again.",
        });
      }

      return res.status(400).json({ error: error.message });
    }

    if (!data.user) {
      return res.status(500).json({ error: "Sign-up did not complete. Please try again." });
    }

    if ((data.user.identities ?? []).length === 0) {
      return res.status(409).json({
        error: "This email is already registered. Please sign in or reset your password.",
      });
    }

    const metadata = getUserMetadata(data.user);
    const { error: profileError } = await supabase
      .schema(APP_USERS_SCHEMA)
      .from("tbl_users")
      .upsert(
        {
          user_id: data.user.id,
          first_name: typeof metadata.first_name === "string" ? metadata.first_name.trim() : "",
          last_name: typeof metadata.last_name === "string" ? metadata.last_name.trim() : "",
          email: trimmedEmail,
          phone: typeof metadata.phone === "string" ? metadata.phone.trim() : "",
          dob: typeof metadata.dob === "string" ? metadata.dob.trim() : null,
          role: DEFAULT_ROLE,
        },
        { onConflict: "user_id" }
      );

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    return res.status(201).json({
      message: data.session
        ? "Account created successfully."
        : "Confirmation email sent. Please verify your email before signing in.",
      needsEmailConfirmation: !data.session,
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    const trimmedEmail = typeof email === "string" ? email.trim() : "";

    if (!trimmedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    let signInResult;

    try {
      signInResult = await supabaseAuth.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
    } catch (error) {
      if (isAuthConnectivityError(error)) {
        return sendAuthServiceUnavailable(res);
      }

      throw error;
    }

    const { data, error } = signInResult;

    if (error || !data.user || !data.session) {
      return res.status(401).json({ error: error?.message || "Invalid credentials." });
    }

    const profile = await loadAppUserProfile(data.user.id);
    const metadata = getUserMetadata(data.user);

    return res.status(200).json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: profile?.email || data.user.email,
        firstName: profile?.first_name || (typeof metadata.first_name === "string" ? metadata.first_name.trim() : ""),
        lastName: profile?.last_name || (typeof metadata.last_name === "string" ? metadata.last_name.trim() : ""),
        role: profile?.role || DEFAULT_ROLE,
      },
    });
  })
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email, redirectTo } = req.body ?? {};
    const trimmedEmail = typeof email === "string" ? email.trim() : "";

    if (!trimmedEmail) {
      return res.status(400).json({ error: "Email is required." });
    }

    const safeRedirectTo =
      typeof redirectTo === "string" && redirectTo.trim()
        ? redirectTo.trim()
        : `${(env.corsOrigin.split(",")[0] || "http://localhost:5173").trim()}/reset-password`;

    let resetResult;

    try {
      resetResult = await supabaseAuth.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: safeRedirectTo,
      });
    } catch (error) {
      if (isAuthConnectivityError(error)) {
        return sendAuthServiceUnavailable(res);
      }

      throw error;
    }

    const { error } = resetResult;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: `Password reset link has been sent to ${trimmedEmail}.`,
    });
  })
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const authorizationHeader = req.headers.authorization || "";
    const token = authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return res.status(401).json({ error: "Missing access token." });
    }

    let userResult;

    try {
      userResult = await supabaseAuth.auth.getUser(token);
    } catch (error) {
      if (isAuthConnectivityError(error)) {
        return sendAuthServiceUnavailable(res);
      }

      throw error;
    }

    const { data, error } = userResult;

    if (error || !data.user) {
      return res.status(401).json({ error: error?.message || "Invalid session." });
    }

    const profile = await loadAppUserProfile(data.user.id);
    const metadata = getUserMetadata(data.user);

    return res.status(200).json({
      user: {
        id: data.user.id,
        email: profile?.email || data.user.email,
        firstName: profile?.first_name || (typeof metadata.first_name === "string" ? metadata.first_name.trim() : ""),
        lastName: profile?.last_name || (typeof metadata.last_name === "string" ? metadata.last_name.trim() : ""),
        role: profile?.role || DEFAULT_ROLE,
      },
    });
  })
);
