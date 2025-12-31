const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // 1. We ask for custom_field_values WITHOUT specific ID filters.
  // 2. We use the flat expansion (no nested braces for custom_field).
  const fields = "id,display_number,status,client{name},practice_area{name},custom_field_values{id,value,picklist_option,custom_field}";
  
  const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;

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
