const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { id, fields } = event.queryStringParameters;
    
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: "Missing ID" }) };

    // Clean the fields string to remove anything that isn't a letter, number, or comma
    const cleanFields = fields ? fields.replace(/[^a-z0-9,_]/gi, '') : "id,display_number";

    // Format the URL properly with the .json extension before the query
    const clioUrl = `https://app.clio.com/api/v4/matters/${id}.json?fields=${cleanFields}`;

    const response = await fetch(clioUrl, {
      method: "GET",
      headers: {
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      }
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
