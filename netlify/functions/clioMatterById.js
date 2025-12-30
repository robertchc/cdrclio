const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { id } = event.queryStringParameters;
    const auth = event.headers.authorization;
    
    // Removing the ?fields= part entirely. 
    // This solves the 'InvalidFields' error and gets the missing data.
    const url = `https://app.clio.com/api/v4/matters/${id}.json`;

    const resp = await fetch(url, {
      headers: { "Authorization": auth, "Accept": "application/json" }
    });

    const data = await resp.json();

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
