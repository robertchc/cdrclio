const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const id = event.queryStringParameters.id;
    // We add a random number to the URL (?_cb=) to force Clio to bypass its cache
    // We also explicitly ask for the custom_field_values in the fields list 
    // to leave Clio no choice but to send them.
    const url = `https://app.clio.com/api/v4/matters/${id}.json?fields=id,display_number,client{name},custom_field_values{id,value,picklist_option{option}}&_cb=${Date.now()}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: { 
        "Authorization": event.headers.authorization,
        "Accept": "application/json"
      }
    });

    const data = await resp.json();

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
