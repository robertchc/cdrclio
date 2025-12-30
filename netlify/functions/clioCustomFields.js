const ALLOWED_ORIGIN = "https://meek-seahorse-afd241.netlify.app";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
    "Vary": "Origin",
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders(), body: "" };
    }

    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, status: 405, error: "Method Not Allowed" }),
      };
    }

    const auth = event.headers.authorization || event.headers.Authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, status: 401, error: "Missing or invalid Authorization header" }),
      };
    }

    const url =
      "https://app.clio.com/api/v4/custom_fields.json" +
      "?parent_type=matter" +
      "&limit=200" +
      "&fields=" +
      encodeURIComponent("id,name,field_type");

    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth, Accept: "application/json" },
    });

    const text = await resp.text();

    // Try to parse JSON; if it fails, keep raw text.
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    // Always return JSON to the client (so your taskpane can display it)
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        clio_content_type: resp.headers.get("content-type") || null,
        preview: text.slice(0, 800),
        data: parsed?.data || null,
        error: parsed?.error || null,
      }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        status: 500,
        error: String(e),
      }),
    };
  }
};
