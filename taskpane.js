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
        // 1. Get the list from clioMatters
        const lResp = await fetch(`${LIST_FN}?query=${encodeURIComponent(matterNumber)}`, {
            headers: { Authorization: `Bearer ${cachedAccessToken}` }
        });
        const lJson = await lResp.json();
        
        // 2. CRITICAL: Safely get the ID from the first record
        const matterId = lJson.data && lJson.data.length > 0 ? lJson.data[0].id : null;

        if (!matterId) {
            showMessage(`No match found for ${matterNumber}`);
            return;
        }

        showMessage("Fetching details...");
        // 3. Call clioMatterById
        const dResp = await fetch(`${DETAIL_FN}?id=${matterId}`, {
            headers: { Authorization: `Bearer ${cachedAccessToken}` }
        });
        const dJson = await dResp.json();
        
        // 4. Update the UI with whatever came back
        const matter = dJson.data;
        document.getElementById("debug-raw").textContent = JSON.stringify(matter, null, 2);
        
        // Brute force map the IDs we know
        const cfvs = matter.custom_field_values || [];
        const getVal = (id) => {
            const f = cfvs.find(v => String(v.id).includes(id));
            return f ? (f.value || f.picklist_option?.option || "—") : "—";
        };

        currentMatter = {
            client_name: matter.client?.name || "—",
            matter_number: matter.display_number || "—",
            case_name: getVal("3528784956"), // Hardcoded ID
            adverse_party_name: getVal("3528784941") // Hardcoded ID
        };

        renderFields();
        clearMessage();

    } catch (err) {
        showMessage("Taskpane Error: " + err.message);
    }
}

async function fetchFullMatterData(accessToken, query) {
    // 1. Get the list of matches
    const listUrl = `${LIST_FN}?query=${encodeURIComponent(query)}`;
    const listResp = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const listJson = await listResp.json();
    const records = listJson?.data || [];
    if (!records.length) return null;

    // 2. Take the first result and get the deep details
    const matterId = records[0].id;
    const detailUrl = `${DETAIL_FN}?id=${matterId}`;
    const detailResp = await fetch(detailUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const detailJson = await detailResp.json();
    return detailJson.data;
}

function processMatterResults(matter) {
    // 1. Update the Debug Window
    updateDebugWindow(matter, customFieldsById);

    // 2. Map to UI
    currentMatter = buildFieldBag(matter, customFieldsById);
    renderFields();
}

function buildFieldBag(matter, cfMap) {
    if (!matter) return null;
    const custom = {};
    const cfvs = matter.custom_field_values || [];

    cfvs.forEach(cfv => {
        const rawId = String(cfv.id || "");
        const cleanId = rawId.includes("-") ? rawId.split("-")[1] : rawId;
        const name = cfMap[cleanId]?.name;

        if (name) {
            const key = name.toLowerCase().trim();
            let val = cfv.value;
            if (!val && cfv.picklist_option) val = cfv.picklist_option.option;
            if (val && typeof val === "object") val = val.name || val.display_name;
            custom[key] = String(val || "").trim();
        }
    });

    const get = (n) => custom[n.toLowerCase().trim()] || "—";

    return {
        client_name: matter.client?.name || "—",
        matter_number: matter.display_number || "—",
        practice_area: matter.practice_area?.name || "—",
        matter_status: matter.status || "—",
        adverse_party_name: get("Adverse Party Name"),
        case_name: get("Case Name (a v. b)"),
        court_file_no: get("Court File No. (Pleadings)"),
        court_name: get("Court (pleadings)"),
        judge_name: get("Judge Name")
    };
}

function updateDebugWindow(matter, cfMap) {
    const debugEl = document.getElementById("debug-raw");
    if (!debugEl) return;

    let log = `MATTER: ${matter.display_number}\n`;
    log += `----------------------------------\n`;

    (matter.custom_field_values || []).forEach(cfv => {
        const cleanId = String(cfv.id).split('-')[1] || cfv.id;
        const name = cfMap[cleanId]?.name || `ID: ${cleanId}`;
        let val = cfv.value || cfv.picklist_option?.option || "—";
        log += `${name}: ${val}\n`;
    });

    debugEl.textContent = log;
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

// --- AUTH & HELPERS ---

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

// --- INITIALIZE ---
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
