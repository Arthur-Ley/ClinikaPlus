export function getHealth(_req, res) {
  return res.status(200).json({
    ok: true,
    service: "clinikaplus-backend",
    timestamp: new Date().toISOString(),
  });
}
