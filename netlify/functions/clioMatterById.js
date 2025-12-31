const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id, fields } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  const defaultFields =
    "id,display_number,number,status,client{name},practice_area{name}," +
    "custom_field_values{id,value,picklist_option,custom_field{id}}";

  const url =
    `https://app.clio.com/api/v4/matters/${id}.json` +
    `?fields=${encodeURIComponent(fields || defaultFields)}`;

  const resp = await fetch(url, {
    headers: { Authorization: event.headers.authorization },
  });

  return {
    statusCode: resp.status,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: await resp.text(),
  };
};
