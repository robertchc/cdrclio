const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { id } = event.queryStringParameters;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: "No ID provided" }) };

    // PERFECTLY BALANCED BRACES - NO SPACES
    const fieldString = "id,display_number,status,client{name},practice_area{name},custom_field_values{id,value,picklist_option{option,name},custom_field{id,name}}";
    
    // Constructing the URL explicitly to avoid template literal issues
    const clioUrl = "https://app.clio.com/api/v4/matters/" + id + ".json?fields=" + fieldString;

    const response = await fetch(clioUrl, {
      method: "GET",
      headers: {
        "Authorization": event.headers.authorization || event.headers.Authorization,
        "Accept": "application/json"
      }
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
