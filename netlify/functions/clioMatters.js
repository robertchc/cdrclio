const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { query } = event.queryStringParameters;
  if (!query) return { statusCode: 400, body: "Missing search query" };

  // Define the IDs of the custom fields you actually care about
  // This matches your taskpane's requirements (Case Name, adverse party, etc.)
  const customFieldIds = ["3528784956", "3528784941", "3528784971", "3528784986", "4815771545"];
  
  // Build the field list: we want the id, number, and the specific custom field values
  const fields = "id,display_number,client{name},custom_field_values{id,value,field_name,picklist_option{option}}";
  
  // Create the filter string for the custom field IDs
  const cfFilter = customFieldIds.map(id => `custom_field_ids[]=${id}`).join('&');

  // Combine into the final URL
  const url = `https://app.clio.com/api/v4/matters.json?query=${encodeURIComponent(query)}&fields=${fields}&${cfFilter}`;

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
