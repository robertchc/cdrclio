const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { query } = event.queryStringParameters || {};
  if (!query) return { statusCode: 400, body: "Missing query" };

  // Keep search lightweight: just get the ID and display number
  const url = `https://app.clio.com/api/v4/matters.json?query=${encodeURIComponent(query)}&fields=id,display_number`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { 
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      },
    });

    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: body,
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
