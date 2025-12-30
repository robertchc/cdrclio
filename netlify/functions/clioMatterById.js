const ALLOWED_ORIGIN = "https://meek-seahorse-afd241.netlify.app";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
    "Vary": "Origin",
  };
}

// Netlify Function: clioMatterById.js
exports.handler = async (event) => {
  const { id, fields } = event.queryStringParameters;
  
  // This is the critical part: 
  // We must forward the 'fields' string exactly as the Taskpane sent it.
  const clioUrl = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;

  const response = await fetch(clioUrl, {
    headers: {
      Authorization: event.headers.authorization,
      "Content-Type": "application/json"
    }
  });
  
  // ... rest of your return logic
}

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
