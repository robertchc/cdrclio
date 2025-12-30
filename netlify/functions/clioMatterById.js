const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters;
  if (!id) return { statusCode: 400, body: "Missing ID" };

  const url = `https://app.clio.com/api/v4/matters/${id}.json`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { "Authorization": event.headers.authorization }
    });

    const json = await resp.json();

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        debug_info: {
            status: resp.status,
            url_requested: url,
            clio_version: resp.headers.get("X-Clio-API-Version")
        },
        raw_response: json
      })
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
