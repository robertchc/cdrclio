const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters;
  if (!id) return { statusCode: 400, body: "Missing ID" };

const fields = "id,display_number,custom_field_values{id,value,field_name,picklist_option{option}}";
const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;

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
