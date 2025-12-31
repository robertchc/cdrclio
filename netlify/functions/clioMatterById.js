const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // We manually encode the brackets so they NEVER appear as "}" in the URL
  // This satisfies Clio while avoiding the parser error.
  const fields = "id,display_number,number,status,client%7Bname,first_name,last_name%7D,practice_area%7Bname%7D,custom_field_values%7Bid,value,picklist_option,custom_field%7Bid%7D%7D";

  const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=${fields}`;

  try {
    const resp = await fetch(url, {
      headers: { 
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      }
    });

    return {
      statusCode: resp.status,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: await resp.text()
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
