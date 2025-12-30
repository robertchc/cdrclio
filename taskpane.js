/* global document, Office */

const CLIENT_ID = "L7275gMi9MT75hiBh8SoUDSIXbt2SgSg6jSbpg1e";
const CLIENT_SECRET = "Si5nz9zY4MlWEkNkjHTHewdd4t2aPhC7UxdDjkcF";
const BASE_URL = "https://meek-seahorse-afd241.netlify.app";
const REDIRECT_URI = `${BASE_URL}/auth.html`;
const DIALOG_START_URL = `${BASE_URL}/auth-start.html`;

const LIST_FN = `${BASE_URL}/.netlify/functions/clioMatters`;
const DETAIL_FN = `${BASE_URL}/.netlify/functions/clioMatterById`;
const CUSTOM_FIELDS_FN = `${BASE_URL}/.netlify/functions/clioCustomFields`;

let cachedAccessToken = null;
let currentMatter = null;
let customFieldsById = null;

// --- DATA LOADING ---

async function loadCustomFields(accessToken) {
    if (customFieldsById) return customFieldsById;
    try {
        const resp = await fetch(CUSTOM_FIELDS_FN, {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        const json = await resp.json();
        const rows = json.data || [];
        const map = Object.create(null);
        rows.forEach(cf => {
            if (cf?.id) map[String(cf.id)] = { name: cf.name, type: cf.field_type };
        });
        customFieldsById = map;
        return map;
    } catch (e) {
        console.error("Failed to load dictionary:", e);
        return {};
    }
}

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
        const lResp = await fetch(`${LIST_FN}?query=${encodeURIComponent(matterNumber)}`, {
            headers: { Authorization: `Bearer ${cachedAccessToken}` }
        });
        const lJson = await lResp.json();
        
        const matterId = (lJson.data && lJson.data.length > 0) ? lJson.data[0].id : null;

        if (!matterId) {
            showMessage(`No match found for ${matterNumber}`);
            return;
        }

        showMessage("Fetching details...");
        const dResp = await fetch(`${DETAIL_FN}?id=${matterId}`, {
            headers: { Authorization: `Bearer ${cachedAccessToken}` }
        });
        const dJson = await dResp.json();
        
        // SURGICAL FIX: Clio single resource responses wrap the fields in a 'data' property.
        // We must point to dJson.data to avoid 'undefined' errors.
        const matter = dJson.data;

        if (!matter) {
            showMessage("Error: Matter details could not be retrieved.");
            return;
        }

        // Show the raw data in the debug box so you can see if custom_field_values exists
        document.getElementById("debug-raw").textContent = JSON.stringify(matter, null, 2);
        
        const cfvs = matter.custom_field_values || [];
        
        // SURGICAL FIX: Find by ID string containing your specific hardcoded IDs.
        const getVal = (id) => {
            const found = cfvs.find(v => String(v.id).includes(id));
            if (!found) return "—";
            return found.value || (found.picklist_option ? found.picklist_option.option : "—");
        };

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

// These helper functions are now redundant but kept to avoid breaking your file structure
async function fetchFullMatterData(accessToken, query) {
    const listUrl = `${LIST_FN}?query=${encodeURIComponent(query)}`;
    const listResp = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const listJson = await listResp.json();
    const records = listJson?.data || [];
    if (!records.length) return null;

    const matterId = records[0].id;
    const detailUrl = `${DETAIL_FN}?id=${matterId}`;
    const detailResp = await fetch(detailUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const detailJson = await detailResp.json();
    return detailJson.data;
}

function renderFields() {
    document.querySelectorAll(".cdr-field").forEach((el) => {
        const key = el.getAttribute("data-field");
        const value = currentMatter?.[key] || "—";
        if (!el.dataset.label) el.dataset.label = el.textContent.trim();
        
        el.innerHTML = `<div class="cdr-field-label">${el.dataset.label}</div><div class="cdr-field-value">${value}</div>`;
        
        if (value === "—") el.classList.add("cdr-field-empty");
        else el.classList.remove("cdr-field-empty");
    });
}

function authenticateClio() {
    return new Promise((resolve, reject) => {
        Office.context.ui.displayDialogAsync(DIALOG_START_URL, { height: 60, width: 40 }, (result) => {
            if (result.status === Office.AsyncResultStatus.Failed) { reject(result.error); return; }
            const dialog = result.value;
            dialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
                try {
                    const resp = await fetch(`${BASE_URL}/.netlify/functions/clioToken`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code: arg.message, redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
                    });
                    const tokenData = await resp.json();
                    resolve(tokenData.access_token);
                } catch (e) { reject(e); } finally { dialog.close(); }
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
    msg.style.background = "#fff8dc";
    msg.textContent = text;
    details.prepend(msg);
}

function clearMessage() {
    const msg = document.getElementById("cdr-message");
    if (msg) msg.remove();
}

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
