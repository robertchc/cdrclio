const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: "Missing ID" };

  // 1. The specific Custom Field IDs you want to retrieve
  const cfIds = ["3528784956", "3528784941", "3528784971", "3528784986", "4815771545"];
  
  // 2. Build the URL. We use the picklist_option fix you researched.
  const params = new URLSearchParams();
  cfIds.forEach(cfId => params.append("custom_field_ids[]", cfId));
  
  // The 'fields' string is manually encoded to bypass Netlify/Clio parser issues
  params.append("fields", "id,display_number,status,client%7Bname%7D,practice_area%7Bname%7D,custom_field_values%7Bid,value,picklist_option,custom_field%7Bid%7D%7D");

  const url = `https://app.clio.com/api/v4/matters/${id}.json?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { 
        "Authorization": event.headers.authorization, 
        "Accept": "application/json" 
      },
    });

    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json" 
      },
      body: body,
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
