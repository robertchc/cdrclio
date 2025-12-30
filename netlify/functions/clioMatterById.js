const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { id } = event.queryStringParameters;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: "No ID" }) };

    // INDIVIDUAL REQUEST STRATEGY: 
    // We list every sub-property we need one by one.
    const fields = [
      "id",
      "display_number",
      "status",
      "client.name",
      "practice_area.name",
      "custom_field_values.id",
      "custom_field_values.value",
      "custom_field_values.picklist_option.option",
      "custom_field_values.picklist_option.name",
      "custom_field_values.custom_field.id",
      "custom_field_values.custom_field.name"
    ].join(",");

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
      statusCode: 200,
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
