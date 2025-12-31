const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // We define the EXACT string Clio needs. 
  // No concatenation (+) to avoid hidden character issues.
  const fieldsString = "id,display_number,status,client{name},practice_area{name},custom_field_values{id,value,custom_field{id}}";

  // Use the browser-standard URL object to build the request.
  // This handles all quoting and escaping automatically.
  const clioUrl = new URL(`https://app.clio.com/api/v4/matters/${id}.json`);
  clioUrl.searchParams.set("fields", fieldsString);

  try {
    const resp = await fetch(clioUrl.toString(), {
      method: "GET",
      headers: { 
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      }
    });

    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: body
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
