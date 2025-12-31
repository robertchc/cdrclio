const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  
  // We are going to use the simplest possible expansion to see if it works.
  const fields = "id,display_number,custom_field_values%7Bid,value%7D";
  const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;

  // LOG THE URL - This will show up in your Netlify Function Logs
  console.log("FULL REQUEST URL:", url);

  try {
    const resp = await fetch(url, {
      headers: { "Authorization": event.headers.authorization, "Accept": "application/json" }
    });

    const body = await resp.text();

    // If Clio returns an error, we wrap it with the URL we sent
    // so you can see it in your Word Taskpane.
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: JSON.parse(body),
          debug_url_sent: url
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: body
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
