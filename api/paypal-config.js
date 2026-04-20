export default async function handler(req, res) {
  return res.status(200).json({
    clientId: process.env.PAYPAL_CLIENT_ID || ""
  });
}