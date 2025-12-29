/* global document, Office */

const CLIENT_ID = "L7275gMi9MT75hiBh8SoUDSIXbt2SgSg6jSbpg1e";
const CLIENT_SECRET = "Si5nz9zY4MlWEkNkjHTHewdd4t2aPhC7UxdDjkcF";

const BASE_URL = "https://meek-seahorse-afd241.netlify.app";
const REDIRECT_URI = `${BASE_URL}/auth.html`; // Must match Clio portal exactly. :contentReference[oaicite:1]{index=1}
const DIALOG_START_URL = `${BASE_URL}/auth-start.html`; // Must be same domain as taskpane. :contentReference[oaicite:2]{index=2}

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    document.getElementById("app-body").style.display = "block";
    document.getElementById("searchButton").onclick = searchMatter;
  }
});

async function searchMatter() {
  const matterNumber = document.getElementById("matterNumber").value;
  if (!matterNumber) {
    alert("Please enter a matter number.");
    return;
  }

  try {
    const token = await authenticateClio();
    console.log("Access Token:", token);

    // Still mocked matter data for now (auth milestone only)
    const matterData = {
      "Matter Name": `Matter ${matterNumber}: Smith vs. Jones`,
      "Address": "123 Legal Ave, Suite 456",
      "Responsible Lawyer": "Jane Doe, Esq."
    };

    displayMatterDetails(matterData);
  } catch (error) {
    console.error("Authentication failed:", error);
    alert("Authentication failed. Please try again.");
  }
}

function displayMatterDetails(details) {
  const detailsSection = document.getElementById("details-section");
  detailsSection.innerHTML = "";

  for (const key in details) {
    if (Object.prototype.hasOwnProperty.call(details, key)) {
      const detailDiv = document.createElement("div");
      detailDiv.className = "detail-item";
      detailDiv.textContent = `${key}: ${details[key]}`;
      detailDiv.style.cursor = "pointer";
      detailDiv.style.padding = "5px";
      detailDiv.style.border = "1px solid #ccc";
      detailDiv.style.marginBottom = "5px";
      detailDiv.onclick = () => insertTextAtCursor(details[key]);
      detailsSection.appendChild(detailDiv);
    }
  }
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
    // Office requires: initial dialog URL must be same domain as the add-in page. :contentReference[oaicite:3]{index=3}
    Office.context.ui.displayDialogAsync(
      DIALOG_START_URL,
      { height: 60, width: 40 },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          reject(result.error);
          return;
        }

        const dialog = result.value;

        // Receive message from auth.html via Office.context.ui.messageParent(...)
        dialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
          try {
            const msg = String(arg.message || "");

            if (msg.startsWith("error:")) {
              throw new Error(msg);
            }

            // msg is expected to be the authorization code
            const code = msg;

            const tokenResponse = await exchangeCodeForToken(code);
            resolve(tokenResponse.access_token);
          } catch (e) {
            reject(e);
          } finally {
            dialog.close();
          }
        });

        // Recommended: handle dialog close / navigation failures explicitly. :contentReference[oaicite:4]{index=4}
        dialog.addEventHandler(Office.EventType.DialogEventReceived, (arg) => {
          // User closed the dialog or navigation failed.
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
      client_secret: CLIENT_SECRET
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Token exchange failed (${resp.status}). ${text}`);
  }

  return resp.json();
}

