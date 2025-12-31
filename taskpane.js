/* global document, Office */

const CLIENT_ID = "L7275gMi9MT75hiBh8SoUDSIXbt2SgSg6jSbpg1e";
const CLIENT_SECRET = "Si5nz9zY4MlWEkNkjHTHewdd4t2aPhC7UxdDjkcF";
const BASE_URL = "https://meek-seahorse-afd241.netlify.app";
const REDIRECT_URI = `${BASE_URL}/auth.html`;
const DIALOG_START_URL = `${BASE_URL}/auth-start.html`;

const LIST_FN = `${BASE_URL}/.netlify/functions/clioMatters`;

let cachedAccessToken = null;
let currentMatter = null;

/**
 * CORE LOGIC: Search for a matter and extract custom fields in one go
 */
async function searchMatter() {
    const input = document.getElementById("matterNumber");
    const matterNumber = (input?.value || "").trim();
    if (!matterNumber) return showMessage("Please enter a matter number.");

    try {
        if (!cachedAccessToken) {
            showMessage("Signing in...");
            cachedAccessToken = await authenticateClio();
        }

        showMessage("Searching...");
        
        // Use the query syntax you researched to get fields in the list call
        const response = await fetch(`${LIST_FN}?query=${encodeURIComponent(matterNumber)}`, {
            headers: { Authorization: `Bearer ${cachedAccessToken}` }
        });
        
        const json = await response.json();
        
        // Since we are using /matters.json, we look at the first item in the data array
        const matter = (json.data && json.data.length > 0) ? json.data[0] : null;

        if (!matter) {
            showMessage(`No match found for ${matterNumber}`);
            // Display raw response for debugging
            document.getElementById("debug-raw").textContent = JSON.stringify(json, null, 2);
            return;
        }

        // Show the matter data in the debug window
        document.getElementById("debug-raw").textContent = JSON.stringify(matter, null, 2);
        
        const cfvs = matter.custom_field_values || [];
        
        /**
         * Helper to extract values from the Custom Field Array.
         * Matches IDs regardless of prefix (e.g., "3528784956")
         */
        const getVal = (id) => {
            const found = cfvs.find(v => String(v.id).includes(id));
            if (!found) return "—";
            // Return standard value, or the specific text from a picklist/dropdown
            return found.value || (found.picklist_option ? found.picklist_option.option : "—");
        };

        // Map the API response to the Taskpane's data-field keys
        currentMatter = {
            client_name: matter.client?.name || "—",
            matter_number: matter.display_number || "—",
            practice_area: matter.practice_area?.name || "—",
            matter_status: matter.status || "—",
            case_name: getVal("3528784956"),
            adverse_party_name: getVal("3528784941"),
            court_file_no: getVal("3528784971"),
            court_name: getVal("3528784986"),
            judge_name: getVal("4815771545")
        };

        renderFields();
        clearMessage();

    } catch (err) {
        showMessage("Taskpane Error: " + err.message);
        console.error(err);
    }
}

/**
 * UI RENDERING: Updates the HTML elements with the matter data
 */
function renderFields() {
    document.querySelectorAll(".cdr-field").forEach((el) => {
        const key = el.getAttribute("data-field");
        const value = currentMatter?.[key] || "—";
        
        if (!el.dataset.label) el.dataset.label = el.textContent.trim();
        
        el.innerHTML = `
            <div class="cdr-field-label">${el.dataset.label}</div>
            <div class="cdr-field-value">${value}</div>
        `;
        
        if (value === "—") el.classList.add("cdr-field-empty");
        else el.classList.remove("cdr-field-empty");
    });
}

/**
 * AUTHENTICATION: Handles the Clio OAuth2 flow via Netlify
 */
function authenticateClio() {
    return new Promise((resolve, reject) => {
        Office.context.ui.displayDialogAsync(DIALOG_START_URL, { height: 60, width: 40 }, (result) => {
            if (result.status === Office.AsyncResultStatus.Failed) { 
                reject(result.error); 
                return; 
            }
            const dialog = result.value;
            dialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
                try {
                    const resp = await fetch(`${BASE_URL}/.netlify/functions/clioToken`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            code: arg.message, 
                            redirect_uri: REDIRECT_URI, 
                            client_id: CLIENT_ID, 
                            client_secret: CLIENT_SECRET 
                        }),
                    });
                    const tokenData = await resp.json();
                    resolve(tokenData.access_token);
                } catch (e) { 
                    reject(e); 
                } finally { 
                    dialog.close(); 
                }
            });
        });
    });
}

function showMessage(text) {
    const details = document.getElementById("details-section");
    if (!details) return;
    clearMessage();
    const msg = document.createElement("div");
    msg.id = "cdr-message";
    msg.style.padding = "10px";
    msg.style.marginBottom = "10px";
    msg.style.background = "#fff8dc";
    msg.style.borderLeft = "4px solid #ffeb3b";
    msg.textContent = text;
    details.prepend(msg);
}

function clearMessage() {
    const msg = document.getElementById("cdr-message");
    if (msg) msg.remove();
}

/**
 * INITIALIZATION: Hook up the search button
 */
Office.onReady((info) => {
    if (info.host !== Office.HostType.Word) return;
    
    document.getElementById("app-body").style.display = "block";
    document.getElementById("searchButton").onclick = searchMatter;

    document.querySelectorAll(".cdr-group-toggle").forEach((toggle) => {
        toggle.onclick = () => {
            toggle.classList.toggle("expanded");
            const content = toggle.nextElementSibling;
            if (content) content.classList.toggle("expanded");
        };
    });
});
