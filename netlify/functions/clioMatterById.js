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
    if (!auth) {
      return { statusCode: 401, headers: corsHeaders(), body: "Unauthorized" };
    }

    const id = event.queryStringParameters?.id;
    if (!id) {
      return { statusCode: 400, headers: corsHeaders(), body: "Missing ID" };
    }

    // We hardcode the fields here to be 100% sure they are correct and nested properly.
    // This includes the required braces for custom fields.
    const requestedFields = "id,display_number,status,client{name,first_name,last_name},practice_area{name},custom_field_values{id,value,picklist_option,custom_field{id}}";

    const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${encodeURIComponent(requestedFields)}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": auth,
        "Accept": "application/json",
      },
    });

    const data = await resp.json();

    return {
      statusCode: resp.status,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
