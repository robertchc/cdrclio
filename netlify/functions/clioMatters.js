const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { query } = event.queryStringParameters || {};
  if (!query) return { statusCode: 400, body: "Missing query" };

  // 1. Your researched Custom Field IDs
  const cfIds = ["3528784956", "3528784941", "3528784971", "3528784986", "4815771545"];
  
  // 2. The fields string (Encoded to prevent the bracket error)
  const fields = "id,display_number,status,client{name},practice_area{name},custom_field_values{id,value,picklist_option,custom_field{id}}";
  
  // 3. Construct the filter string for the IDs
  const cfFilter = cfIds.map(id => `custom_field_ids[]=${id}`).join('&');

  // 4. The Final URL
  const url = `https://app.clio.com/api/v4/matters.json` +
              `?query=${encodeURIComponent(query)}` +
              `&fields=${encodeURIComponent(fields)}` +
              `&${cfFilter}`;

  try {
    const resp = await fetch(url, {
      headers: { 
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      },
    });

    const body = await resp.text();

    return {
      statusCode: resp.status,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: body,
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
