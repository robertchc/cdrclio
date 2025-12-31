const fetch = require("node-fetch");
exports.handler = async (event) => {
  const { query } = event.queryStringParameters;
  if (!query) return { statusCode: 400, body: "Missing search query" };
  
  const customFieldIds = ["3528784956", "3528784941", "3528784971", "3528784986", "4815771545"];
  
  // Simplified fields - no nesting yet
  const fields = "id,display_number,client,practice_area,status,custom_field_values";
  
  const cfFilter = customFieldIds.map(id => `custom_field_ids[]=${id}`).join('&');
  const url = `https://app.clio.com/api/v4/matters.json?query=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&${cfFilter}`;
  
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
