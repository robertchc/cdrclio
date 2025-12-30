// REPLACE your entire clioCustomFields function with this:
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

    const auth = event.headers.authorization || event.headers.Authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Missing Authorization" }),
      };
    }

    // Standard Clio V4 Custom Fields endpoint
    const url = "https://app.clio.com/api/v4/custom_fields.json?parent_type=matter&limit=200&fields=id,name,field_type";

    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth, Accept: "application/json" },
    });

    const json = await resp.json();

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        // SURGICAL FIX: Extract the internal data array 
        // so taskpane.js sees 'json.data' as the actual list of fields.
        data: json?.data || [], 
        error: json?.error || null,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(e) }),
    };
  }
};
