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

    // We keep the fields string simple to avoid API rejections
    const fields = "id,display_number,status,client{name,first_name,last_name},practice_area{name},custom_field_values{id,value,picklist_option,custom_field{id}}";

    const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${encodeURIComponent(fields)}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": auth,
        "Accept": "application/json",
      },
    });

    // Return raw text to maintain the exact structure taskpane.js expects
    const text = await resp.text();

    return {
      statusCode: resp.status,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
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
