export function notFound(_req, res, _next) {
  return res.status(404).json({
    error: "Route not found",
  });
}
