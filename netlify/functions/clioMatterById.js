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
    const id = event.queryStringParameters?.id;

    if (!id || !auth) {
      return { statusCode: 400, headers: corsHeaders(), body: "Missing ID or Auth" };
    }

    // REVERTED: Using the flat string that worked before. 
    // No nested braces {} which Clio might have been rejecting.
    const fields = "id,display_number,number,status,client,practice_area,custom_field_values";

    const url = `https://app.clio.com/api/v4/matters/${encodeURIComponent(id)}.json?fields=${encodeURIComponent(fields)}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": auth,
        "Accept": "application/json",
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
