// Redirects user to Clio's OAuth 2.0 authorization screen

exports.handler = async function () {
  const clientId = process.env.CLIO_CLIENT_ID;
  const redirectUri = process.env.CLIO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return {
      statusCode: 500,
      body: "Missing CLIO_CLIENT_ID or CLIO_REDIRECT_URI environment variables",
    };
  }

  const state = Math.random().toString(36).slice(2);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "matters:read",
    state,
    redirect_on_decline: "true",
  });

  const authorizeUrl = `https://app.clio.com/oauth/authorize?${params.toString()}`;

  return {
    statusCode: 302,
    headers: {
      Location: authorizeUrl,
      "Cache-Control": "no-store",
    },
    body: "",
  };
};
