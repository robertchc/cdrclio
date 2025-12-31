const fetch = require("node-fetch");

exports.handler = async (event) => {
  // 1. Get the ID from the query string
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // 2. Define the exact fields Clio requires. 
  // We use the curly braces {} as specified in the Clio V4 Documentation.
  const fields = "id,display_number,number,status,client{name,first_name,last_name},practice_area{name},custom_field_values{id,value,picklist_option,custom_field{id}}";

  // 3. ENCODE the fields. 
  // This turns "}" into "%7D" so the server doesn't think the field name is "custom_field_values}"
  const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${encodeURIComponent(fields)}`;

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
