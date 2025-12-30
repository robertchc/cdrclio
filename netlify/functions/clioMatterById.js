const fetch = require("node-fetch");

exports.handler = async (event) => {
  const id = event.queryStringParameters.id;
  // We use the absolute path for a single resource. 
  // We remove ALL field parameters to force Clio to give us the default FULL object.
  const url = `https://app.clio.com/api/v4/matters/${id}.json`;

  console.log("Fetching absolute resource:", url);

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { 
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      }
    });

    const data = await resp.json();

    return {
      statusCode: 200,
      headers: { 
        "Access-Control-Allow-Origin": "*", 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
