// netlify/functions/matter-proxy.js

/**
 * Proxies Clio API calls from the task pane.
 * - Reads the access token from the HttpOnly cookie set by auth-callback
 * - Calls Clio's /api/v4/matters and returns a simplified array
 * - Returns 401 if not authenticated so the UI can trigger re-auth
 *
 * Requirements:
 *   - Your auth-callback must set cookie with: SameSite=None; Secure; HttpOnly; Path=/
 *   - Your Netlify site must deploy functions from: netlify/functions
 */

exports.handler = async (event) => {
  try {
    // Quick health check: /.netlify/functions/matter-proxy?ping=1
    if ((event.queryStringParameters || {}).ping === "1") {
      return json(200, { ok: true, now: Date.now() });
    }

    const cookieHeader =
      (event.headers && (event.headers.cookie || event.headers.Cookie)) || "";
    const token = getCookie(cookieHeader, "clio_token");

    if (!token) {
      return json(401, { error: "Unauthorized: missing access token cookie." });
    }

    // Fetch a few fields from Clio; tweak as needed
    const url =
      "https://app.clio.com/api/v4/matters?limit=25&fields=id,display_number,client{name},status,description";
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      // If token expired/invalid, tell the client to re-authenticate
      if (resp.status === 401) {
        return json(401, { error: "Token expired or invalid.", details: text });
      }
      return json(500, { error: "Clio API error.", status: resp.status, details: text });
    }

    const data = await resp.json();

    const matters = (data.data || []).map((m) => ({
      id: m.id,
      matterName: m.display_number,
      client: (m.client && m.client.name) || "N/A",
      status: m.status,
      description: m.description,
    }));

    return json(200, { matters });
  } catch (e) {
    console.error("matter-proxy error:", e);
    return json(500, { error: "Internal server error." });
  }
};

// helpers
function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      // same-origin fetch in taskpane; CORS not strictly needed, but harmless:
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function getCookie(cookieHeader, name) {
  const m = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
