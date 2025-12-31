const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // Applying the "Secret" picklist_option field and the required structure
  // This helps the Clio parser correctly identify the end of the expansion block.
  const fields = [
    "id",
    "display_number",
    "status",
    "client{name}",
    "practice_area{name}",
    "custom_field_values{id,value,picklist_option,custom_field{id,name}}"
  ].join(",");

  const url = new URL(`https://app.clio.com/api/v4/matters/${id}.json`);
  url.searchParams.set("fields", fields);

  try {
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: { 
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      }
    });

    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: body
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
