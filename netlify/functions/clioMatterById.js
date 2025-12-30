const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { id } = event.queryStringParameters;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: "No ID" }) };

    // This string must have NO spaces and perfectly balanced braces
    const fields = "id,display_number,status,client{name},practice_area{name},custom_field_values{id,value,picklist_option{option,name},custom_field{id,name}}";

    // We use a clean URL build
    const clioUrl = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;

    const response = await fetch(clioUrl, {
      method: "GET",
      headers: {
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      }
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
