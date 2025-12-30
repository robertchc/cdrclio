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
        headers: { ...corsHeaders(), "Content-Type": "text/plain" },
        body: "Method Not Allowed",
      };
    }

    const auth = event.headers.authorization || event.headers.Authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders(), "Content-Type": "text/plain" },
        body: "Missing or invalid Authorization header",
      };
    }

    const id = event.queryStringParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(), "Content-Type": "text/plain" },
        body: "Missing id parameter",
      };
    }

    // IMPORTANT: keep fields conservative; do NOT use nested braces here.
    // We'll fetch custom field definitions separately if needed.
    const fields =
      event.queryStringParameters?.fields ||
      "id,display_number,number,status,client,custom_field_values";

    // Strip anything after "custom_field_values" if the caller tries to pass nested fields.
    // This prevents Clio from rejecting it.
    const safeFields = fields.includes("custom_field_values")
      ? fields
          .replace(/custom_field_values\{.*$/i, "custom_field_values")
          .replace(/,+\s*$/, "")
      : fields;

    const url =
      `https://app.clio.com/api/v4/matters/${encodeURIComponent(id)}.json` +
      `?fields=${encodeURIComponent(safeFields)}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: auth,
        Accept: "application/json",
      },
    });

    const text = await resp.text();
    const contentType = resp.headers.get("content-type") || "application/json";

    return {
      statusCode: resp.status,
      headers: { ...corsHeaders(), "Content-Type": contentType },
      body: text,
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
