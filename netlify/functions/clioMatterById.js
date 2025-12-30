const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { id } = event.queryStringParameters;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: "No ID" }) };

    // NO BRACKETS. Just the top-level keys.
    const fields = "id,display_number,status,client,practice_area,custom_field_values";

    const clioUrl = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;

    const response = await fetch(clioUrl, {
      method: "GET",
      headers: {
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      }
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
