const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // Use encoded braces: { is %7B and } is %7D
  const fields = "id,display_number,number,status,client%7Bname,first_name,last_name%7D,practice_area%7Bname%7D,custom_field_values%7Bid,value,field_name,picklist_option%7Boption%7D%7D";

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
