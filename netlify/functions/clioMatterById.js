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

    /**
     * SURGICAL FIX: 
     * We allow the nested braces {...} for custom_field_values. 
     * This ensures we get the 'custom_field: { id }' so the taskpane 
     * can match values to their names.
     */
    const fields = event.queryStringParameters?.fields || 
                   "id,display_number,status,client,practice_area{name},custom_field_values{id,value,picklist_option,custom_field{id}}";

    const url = `https://app.clio.com/api/v4/matters/${encodeURIComponent(id)}.json?fields=${encodeURIComponent(fields)}`;

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
