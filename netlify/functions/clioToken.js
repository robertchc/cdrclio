exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { code, redirect_uri, client_id, client_secret } = JSON.parse(event.body || "{}");

    if (!code || !redirect_uri || !client_id || !client_secret) {
      return { statusCode: 400, body: "Missing required fields" };
    }

    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", redirect_uri);
    params.set("client_id", client_id);
    params.set("client_secret", client_secret);

    const resp = await fetch("https://app.clio.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const text = await resp.text();

    return {
      statusCode: resp.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://meek-seahorse-afd241.netlify.app",
      },
      body: text,
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
