const fetch = require("node-fetch");

/**
 * Handles the OAuth redirect from Clio.
 * Exchanges the `code` for an access token and stores it in a secure HTTP-only cookie.
 * Closes the popup window upon success using a <script> tag.
 */
exports.handler = async function (event) {
  // Use environment variables from Netlify build settings
  // These must be set in your Netlify dashboard: CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, CLIO_REDIRECT_URI
  const { CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, CLIO_REDIRECT_URI } = process.env;

  if (!CLIO_CLIENT_ID || !CLIO_CLIENT_SECRET || !CLIO_REDIRECT_URI) {
    return {
      statusCode: 500,
      body: "Missing required environment variables for Clio API.",
    };
  }

  const code = event.queryStringParameters.code;
  if (!code) {
    // If we don't have a code, authorization was denied or failed by the user.
    return {
      statusCode: 400,
      body: "Missing authorization code. Authorization failed or was denied.",
    };
  }

  const tokenUrl = "https://app.clio.com/oauth/token";

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CLIO_CLIENT_ID,
        client_secret: CLIO_CLIENT_SECRET,
        redirect_uri: CLIO_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Token request failed. Clio response: ${error}`);
      throw new Error(`Token request failed: ${response.statusText}`);
    }

    const tokenData = await response.json();
    const accessToken = tokenData.access_token;

    // --- SUCCESS RESPONSE: Set Cookie and Close Window ---
    
    // Set the secure HTTP-only cookie. SameSite=Lax is used for security.
    const cookieHeader = `clio_token=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${tokenData.expires_in}`;

    const successHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Success</title></head>
      <body>
        <p>Authentication successful. Closing window...</p>
        <script>
          // This closes the popup, which triggers the 'popup.closed' check in the task pane.
          window.close();
        </script>
      </body>
      </html>
    `;

    return {
      statusCode: 200,
      headers: {
        "Set-Cookie": cookieHeader,
        "Content-Type": "text/html",
      },
      body: successHtml,
    };
  } catch (error) {
    console.error(`OAuth processing error: ${error.message}`);
    return {
      statusCode: 500,
      body: `OAuth processing error: ${error.message}`,
    };
  }
};
