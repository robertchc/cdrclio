const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // 1. The specific IDs you researched
  const cfIds = ["3528784956", "3528784941", "3528784971", "3528784986", "4815771545"];
  
  // 2. Build the query string manually to ensure NO double-encoding
  // We use the exact picklist_option fix you found.
  const fields = "id,display_number,status,client{name},practice_area{name},custom_field_values{id,value,picklist_option,custom_field{id}}";
  
  let url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${encodeURIComponent(fields)}`;
  
  // 3. Append the IDs using the array syntax you discovered
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
      headers: { "Access-Control-Allow-Origin": "*" },
      body: body,
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
