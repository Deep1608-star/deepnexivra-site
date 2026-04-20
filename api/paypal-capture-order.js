async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "Failed to get PayPal access token");
  }

  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const { orderID } = req.body || {};

  if (!orderID) {
    return res.status(400).json({ ok: false, message: "Missing orderID" });
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const captureResponse = await fetch(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        }
      }
    );

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      throw new Error(captureData.message || "Failed to capture PayPal order");
    }

    return res.status(200).json({
      ok: true,
      status: captureData.status,
      data: captureData
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message
    });
  }
}