exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "https://meek-seahorse-afd241.netlify.app",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Headers": "Authorization,Content-Type",
        },
        body: "",
      };
    }

    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const auth = event.headers.authorization || event.headers.Authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return { statusCode: 401, body: "Missing or invalid Authorization header" };
    }

    const query = event.queryStringParameters?.query || "";
    const fields = event.queryStringParameters?.fields || "id,display_number,client";

    const url =
      "https://app.clio.com/api/v4/matters" +
      `?query=${encodeURIComponent(query)}` +
      `&fields=${encodeURIComponent(fields)}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: auth,
        Accept: "application/json",
      },
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
      headers: { "Access-Control-Allow-Origin": "https://meek-seahorse-afd241.netlify.app" },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
