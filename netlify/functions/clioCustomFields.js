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

    // Keep it simple: just what we need to map IDs to names.
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
    const contentType = resp.headers.get("content-type") || "application/json";

    // ---- LOGGING (what we actually need) ----
    console.log("clioCustomFields status:", resp.status);
    console.log("clioCustomFields content-type:", contentType);
    console.log("clioCustomFields body (first 800):", text.slice(0, 800));
    // ----------------------------------------

    return {
      statusCode: resp.status,
      headers: { ...corsHeaders(), "Content-Type": contentType },
      body: text,
    };
  } catch (e) {
    console.log("clioCustomFields error:", String(e));
    return {
      statusCode: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
