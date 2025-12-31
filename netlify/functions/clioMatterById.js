const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  const cfIds = ["3528784956", "3528784941", "3528784971", "3528784986", "4815771545"];
  
  // Use LITERAL brackets. Clio's v4 API specifically requires these 
  // to be interpreted as expansion operators, not encoded text.
  const fields = "id,display_number,status,client{name},practice_area{name},custom_field_values{id,value,picklist_option,custom_field{id}}";
  
  let url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;
  
  // Append the custom field filters
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
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: body,
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
