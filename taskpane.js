/* global document, Office */

const CLIENT_ID = "L7275gMi9MT75hiBh8SoUDSIXbt2SgSg6jSbpg1e";
const CLIENT_SECRET = "Si5nz9zY4MlWEkNkjHTHewdd4t2aPhC7UxdDjkcF";
const BASE_URL = "https://meek-seahorse-afd241.netlify.app";

const DETAIL_FN = `${BASE_URL}/.netlify/functions/clioMatterById`;
const LIST_FN = `${BASE_URL}/.netlify/functions/clioMatters`;
const CUSTOM_FIELDS_FN = `${BASE_URL}/.netlify/functions/clioCustomFields`;
const TOKEN_FN = `${BASE_URL}/.netlify/functions/clioToken`;
const DIALOG_START_URL = `${BASE_URL}/auth-start.html`;

let cachedAccessToken = null;
let customFieldsById = null;
let currentMatter = null;

// --- INITIALIZATION ---
Office.onReady((info) => {
    if (info.host !== Office.HostType.Word) return;
    
    try {
        const appBody = document.getElementById("app-body");
        if (appBody) appBody.style.display = "block";

        const btn = document.getElementById("searchButton");
        if (btn) {
            btn.onclick = async () => {
                try {
                    await searchMatter();
                } catch (err) {
                    showMessage("Button Error: " + err.message);
                }
            };
        }

        document.querySelectorAll(".cdr-group-toggle").forEach((toggle) => {
            toggle.onclick = () => {
                toggle.classList.toggle("expanded");
                const content = toggle.nextElementSibling;
                if (content) content.classList.toggle("expanded");
            };
        });
        console.log("Office Ready and Button Wired");
    } catch (err) {
        console.error("Init Error:", err);
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
        if (!cachedAccessToken) {
            showMessage("Signing in to Clio...");
            cachedAccessToken = await authenticateClio();
        }

        if (!customFieldsById) {
            showMessage("Loading field names...");
            const cfResp = await fetch(CUSTOM_FIELDS_FN, {
                headers: { Authorization: `Bearer ${cachedAccessToken}` }
            });
            const cfJson = await cfResp.json();
            const rows = cfJson.data || [];
            customFieldsById = {};
            rows.forEach(r => { customFieldsById[String(r.id)] = r; });
        }

        showMessage("Searching...");
        const listUrl = `${LIST_FN}?query=${encodeURIComponent(matterNumber)}`;
        const lResp = await fetch(listUrl, { headers: { Authorization: `Bearer ${cachedAccessToken}` } });
        const lJson = await lResp.json();
        const matterId = lJson.data?.[0]?.id;

        if (!matterId) {
            showMessage("Matter not found.");
            return;
        }

        showMessage("Fetching details...");
        const dUrl = `${DETAIL_FN}?id=${matterId}`;
        const dResp = await fetch(dUrl, { headers: { Authorization: `Bearer ${cachedAccessToken}` } });
        const dJson = await dResp.json();
        
        const debugEl = document.getElementById("debug-raw");
        if (debugEl) debugEl.textContent = JSON.stringify(dJson, null, 2);

        currentMatter = buildFieldBag(dJson.data, customFieldsById);
        renderFields();
        clearMessage();
    } catch (err) {
        showMessage("Search Error: " + err.message);
    }
}

function buildFieldBag(matter, cfMap) {
    const bag = {};
    const cfvs = matter.custom_field_values || [];
    
    cfvs.forEach(cfv => {
        const name = cfv.custom_field?.name || (cfMap && cfMap[String(cfv.custom_field?.id)]?.name);
        if (name) {
            const key = name.toLowerCase().trim();
            let val = cfv.value;
            if (!val && cfv.picklist_option) val = cfv.picklist_option.option || cfv.picklist_option.name;
            if (val && typeof val === "object") val = val.name || val.display_name;
            bag[key] = val || "—";
        }
    });

    const get = (k) => bag[k.toLowerCase().trim()] || "—";

    return {
        client_name: matter.client?.name || "—",
        matter_number: matter.display_number || "—",
        practice_area: matter.practice_area?.name || "—",
        adverse_party_name: get("Adverse Party Name"),
        case_name: get("Case Name (a v. b)"),
        court_file_no: get("Court File No. (Pleadings)"),
        court_name: get("Court (pleadings)"),
        judge_name: get("Judge Name")
    };
}

function renderFields() {
    document.querySelectorAll(".cdr-field").forEach((el) => {
        const key = el.getAttribute("data-field");
        const val = currentMatter?.[key] || "—";
        if (!el.dataset.label) el.dataset.label = el.textContent.trim();
        el.innerHTML = `<div class="cdr-field-label">${el.dataset.label}</div><div class="cdr-field-value">${val}</div>`;
        if (val === "—") el.classList.add("cdr-field-empty");
        else el.classList.remove("cdr-field-empty");
    });
}

// --- HELPER FUNCTIONS (The ones usually missing) ---

function authenticateClio() {
    return new Promise((resolve, reject) => {
        Office.context.ui.displayDialogAsync(DIALOG_START_URL, { height: 60, width: 40 }, (result) => {
            if (result.status === Office.AsyncResultStatus.Failed) {
                reject(new Error(result.error.message));
                return;
            }
            const dialog = result.value;
            dialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
                try {
                    const resp = await fetch(TOKEN_FN, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code: arg.message, client_id: CLIENT_ID, client_secret: CLIENT_SECRET })
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
    msg.style = "padding:10px; background:#f0f7ff; border:1px solid #0078d4; margin-bottom:10px;";
    msg.textContent = text;
    details.prepend(msg);
}

function clearMessage() {
    const msg = document.getElementById("cdr-message");
    if (msg) msg.remove();
}
