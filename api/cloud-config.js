export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ enabled: false, message: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL || "";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

  const jobDiscoveryEnabled = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);

  if (!url || !publishableKey) {
    return res.status(200).json({
      enabled: false,
      jobDiscoveryEnabled,
      message: "Cloud sync is not configured"
    });
  }

  return res.status(200).json({
    enabled: true,
    jobDiscoveryEnabled,
    url,
    publishableKey
  });
}
