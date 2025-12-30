const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters;
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // This URL structure comes directly from the Stack Overflow solution
  // It forces Clio to include the 'custom_field_values' which are hidden by default
  const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=id,display_number,client{name},custom_field_values{id,value,picklist_option{option}`;

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
