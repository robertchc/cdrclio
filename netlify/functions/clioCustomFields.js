const fetch = require("node-fetch");

const ALLOWED_ORIGIN = "https://meek-seahorse-afd241.netlify.app";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    const auth = event.headers.authorization || event.headers.Authorization;
    if (!auth) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: "Missing Authorization header" }) };
    }

    const url = "https://app.clio.com/api/v4/custom_fields.json?limit=200&fields=id,name,field_type";

    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth, Accept: "application/json" },
    });

    const json = await resp.json();

    return {
      statusCode: resp.status,
      headers,
      body: JSON.stringify({
        ok: resp.ok,
        data: Array.isArray(json?.data) ? json.data : []
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
