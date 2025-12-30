const fetch = require("node-fetch"); // Ensure node-fetch is in your package.json

exports.handler = async (event, context) => {
  try {
    const { id, fields } = event.queryStringParameters;
    
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Matter ID is required" }) };
    }

    // We take the long fields string from the Taskpane and pass it to Clio
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
      statusCode: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
