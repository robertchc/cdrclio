const fetch = require("node-fetch");
exports.handler = async (event) => {
  const { query } = event.queryStringParameters;
  if (!query) return { statusCode: 400, body: "Missing search query" };
  
  // Add nested fields for custom_field_values - no spaces!
// Clio V4 REST uses dot notation for nesting, not braces or parentheses.
const fields = "id,display_number,client.name,practice_area.name,status,custom_field_values.id,custom_field_values.value,custom_field_values.field_name,custom_field_values.picklist_option.option";

const url = `https://app.clio.com/api/v4/matters.json?query=${encodeURIComponent(query)}&fields=${fields}`;
  
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
