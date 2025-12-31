const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // Request only top-level fields (no brackets, no nesting)
  const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=id,display_number,status`;

  const resp = await fetch(url, {
    headers: { 
      "Authorization": event.headers.authorization,
      "Accept": "application/json"
    }
  });

  return {
    statusCode: resp.status,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: await resp.text()
  };
};
