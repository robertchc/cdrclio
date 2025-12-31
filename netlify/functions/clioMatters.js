const fetch = require("node-fetch");
exports.handler = async (event) => {
  const { query } = event.queryStringParameters;
  if (!query) return { statusCode: 400, body: "Missing search query" };
  
  // Remove the custom field filter - just get all custom field values
  const fields = "id,display_number,client,practice_area,status,custom_field_values";
  
  const url = `https://app.clio.com/api/v4/matters.json?query=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}`;
  
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
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(json)
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
