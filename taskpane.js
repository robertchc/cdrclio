/* global document, Office */

const CLIENT_ID = "L7275gMi9MT75hiBh8SoUDSIXbt2aPhC7UxdDjkcF".includes("Si5n")
  ? "L7275gMi9MT75hiBh8SoUDSIXbt2SgSg6jSbpg1e"
  : "L7275gMi9MT75hiBh8SoUDSIXbt2SgSg6jSbpg1e"; // guard against accidental paste errors

const CLIENT_SECRET = "Si5nz9zY4MlWEkNkjHTHewdd4t2aPhC7UxdDjkcF";

const BASE_URL = "https://meek-seahorse-afd241.netlify.app";
const REDIRECT_URI = `${BASE_URL}/auth.html`;
const DIALOG_START_URL = `${BASE_URL}/auth-start.html`;

let cachedAccessToken = null;

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    const appBody = document.getElementById("app-body");
    if (appBody) appBody.style.display = "block";

    const btn = document.getElementById("searchButton");
    if (btn) btn.onclick = searchMatter;
  }
});

async function searchMatter() {
  const input = document.getElementById("matterNumber");
  const matterNumber = (input?.value || "").trim();

  if (!matterNumber) {
    showMessage("Please enter a matter number.");
    return;
  }

  try {
    // Authenticate once per session unless token fails
    if (!cachedAccessToken) {
      showMessage("Signing in to Clio...");
      cachedAccessToken = await authenticateClio();
      console.log("Access Token:", cachedAccessToken);
    }

    showMessage("Searching Clio...");

    const clientName = await fetchClientNameByMatterNumber(cachedAccessToken, matterNumber);

    if (!clientName) {
      clearDetails();
      showMessage(`No exact match found for matter # ${matterNumber}.`);
      return;
    }

    clearMessage();
    displayClientName(clientName);
  } catch (error) {
    console.error("Search failed:", error);

    // If token expired/invalid, force re-auth on next attempt
    cachedAccessToken = null;

    clearDetails();
    showMessage("Search failed (see console for details).");
  }
}

function displayClientName(fullName) {
  const detailsSection = document.getElementById("details-section");
  if (!detailsSection) return;

  detailsSection.innerHTML = "";

  const row = document.createElement("div");
  row.className = "detail-item";
  row.textContent = `Client Name: ${fullName}`;
  row.style.cursor = "pointer";
  row.style.padding = "5px";
  row.style.border = "1px solid #ccc";
  row.style.marginBottom = "5px";

  row.onclick = () => insertTextAtCursor(fullName);

  detailsSection.appendChild(row);
}

function insertTextAtCursor(text) {
  Office.context.document.setSelectedDataAsync(
    text,
    { coercionType: Office.CoercionType.Text },
    function (result) {
      if (result.status === Office.AsyncResultStatus.Failed) {
        console.error("Insertion failed: " + result.error.message);
      }
    }
  );
}

function authenticateClio() {
  return new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(
      DIALOG_START_URL,
      { height: 60, width: 40 },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          reject(result.error);
          return;
        }

        const dialog = result.value;

        dialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
          try {
            const msg = String(arg.message || "");

            if (msg.startsWith("error:")) {
              throw new Error(msg);
            }

            // msg should be the authorization code
            const code = msg;

            const tokenResponse = await exchangeCodeForToken(code);
            resolve(tokenResponse.access_token);
          } catch (e) {
            reject(e);
          } finally {
            dialog.close();
          }
        });

        dialog.addEventHandler(Office.EventType.DialogEventReceived, (arg) => {
          reject(new Error(`Dialog closed or failed. Code: ${arg.error}`));
        });
      }
    );
  });
}

async function exchangeCodeForToken(code) {
  const resp = await fetch(`${BASE_URL}/.netlify/functions/clioToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Token exchange failed (${resp.status}). ${text}`);
  }

  return resp.json();
}

async function fetchClientNameByMatterNumber(accessToken, matterNumber) {
  const fields = "id,display_number,client";

  const url = `${BASE_URL}/.netlify/functions/clioMatters?query=${encodeURIComponent(
    matterNumber
  )}&fields=${encodeURIComponent(fields)}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Matters lookup failed (${resp.status}). ${text}`);
  }

  const json = await resp.json();
  const records = Array.isArray(json?.data) ? json.data : [];

  const match = records.find(
    (m) => String(m?.display_number || "").trim() === matterNumber
  );

  if (!match) return null;

  const client = match.client || {};
  if (client.name) return String(client.name).trim();

  const first = String(client.first_name || "").trim();
  const last = String(client.last_name || "").trim();
  const combined = `${first} ${last}`.trim();

  return combined || null;
}


/* ---------- UI helpers (no alerts; Word may block alert()) ---------- */

function clearDetails() {
  const detailsSection = document.getElementById("details-section");
  if (detailsSection) detailsSection.innerHTML = "";
}

function clearMessage() {
  const msg = document.getElementById("cdr-message");
  if (msg) msg.remove();
}

function showMessage(text) {
  const detailsSection = document.getElementById("details-section");
  if (!detailsSection) return;

  clearMessage();

  const msg = document.createElement("div");
  msg.id = "cdr-message";
  msg.style.padding = "8px";
  msg.style.border = "1px solid #ddd";
  msg.style.background = "#f7f7f7";
  msg.style.marginTop = "10px";
  msg.textContent = text;

  // Put the message above any results
  detailsSection.prepend(msg);
}
