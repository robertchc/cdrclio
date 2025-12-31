const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { query } = event.queryStringParameters || {};
  if (!query) return { statusCode: 400, body: "Missing query" };

  // We keep search lightweight; the taskpane will follow up with clioMatterById for the full data
  const fields = "id,display_number,status,client%7Bname%7D";

  const url = `https://app.clio.com/api/v4/matters.json?query=${encodeURIComponent(query)}&fields=${fields}`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { 
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      },
    });

    return {
      statusCode: resp.status,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: await resp.text(),
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
