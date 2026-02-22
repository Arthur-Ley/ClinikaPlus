export function validateSignedUploadInput(payload) {
  const bucket = typeof payload?.bucket === "string" ? payload.bucket.trim() : "";
  const path = typeof payload?.path === "string" ? payload.path.trim() : "";

  if (!bucket || !path) {
    return {
      ok: false,
      message: "'bucket' and 'path' are required in the request body.",
    };
  }

  return {
    ok: true,
    data: { bucket, path },
  };
}
