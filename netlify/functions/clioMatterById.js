const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters;
  
  // DOCUMENTATION: https://app.clio.com/api/v4/documentation#tag/Matters/operation/Matter#show
  // Must be /matters/{id}.json to get the Full view (including custom fields)
  const url = `https://app.clio.com/api/v4/matters/${id}.json`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { 
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      }
    });

    const json = await resp.json();

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(json) 
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
