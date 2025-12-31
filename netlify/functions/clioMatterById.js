const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // Formulation: id,display_number,status,client{name},practice_area{name},custom_field_values{id,value,custom_field{id}}
  // Encoded: { = %7B | } = %7D
  const fields = "id,display_number,status,client%7Bname%7D,practice_area%7Bname%7D,custom_field_values%7Bid,value,custom_field%7Bid%7D%7D";

  const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;

  try {
    const resp = await fetch(url, {
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
