const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  const cfIds = ["3528784956", "3528784941", "3528784971", "3528784986", "4815771545"];
  
  // 1. REMOVE THE NESTING. We ask for custom_field_values as a flat object.
  // We removed the {id, value, ...} part entirely.
  const fields = "id,display_number,status,client{name},practice_area{name},custom_field_values";
  
  let url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;
  
  // 2. Use your custom_field_ids discovery to filter the list
  cfIds.forEach(cfId => {
    url += `&custom_field_ids[]=${cfId}`;
  });

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { 
        "Authorization": event.headers.authorization, 
        "Accept": "application/json" 
      },
    });

    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: body,
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
