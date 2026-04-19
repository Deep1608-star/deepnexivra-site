export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    project: "Deep Nexivra",
    message: "API is working"
  });
}