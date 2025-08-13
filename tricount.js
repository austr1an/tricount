let addMode = true;
let editEntryId = null;
let partition = {};
let LATEST_ID = parseInt(localStorage.getItem("LATEST_ID"));
if (isNaN(LATEST_ID)) LATEST_ID = -1;

let participants = JSON.parse(localStorage.getItem("participants") || "{}");
let entries = JSON.parse(localStorage.getItem("entries") || "{}");

// Initialize with former data

for (let id in participants) makeContributorView(id);

resetEntryForm();
renderBalances();
renderEntries();

// Storage manager

function save() {
    localStorage.setItem("participants", JSON.stringify(participants));
    localStorage.setItem("entries", JSON.stringify(entries));
    localStorage.setItem("LATEST_ID", LATEST_ID.toString());
}

function reset() {
    if (!confirm("Are you sure you want to reset the Tricount?")) return;
    localStorage.clear();
    participants = {};
    entries = {};

    // Reset views
    iRmParticipant.innerHTML = "";
    iPaidBy.innerHTML = "";
    iContributors.innerHTML = "";
    resetEntryForm();
    renderEntries();
    renderBalances();
}

iReset.onclick = reset;

// Id manager

function newId() {
    return (++LATEST_ID).toString();
}

// Participants

function addParticipant() {
    let name = iParticipant.value.trim();
    if (!name) return;
    let id = newId();
    participants[id] = name;
    partition[id] = 1;
    iParticipant.value = "";

    for (let eid in entries) if (!(id in entries[eid].partition)) entries[eid].partition[id] = 0;

    // Update views
    makeContributorView(id);

    renderBalances();
    renderContributions();
    save();
}

iButtonAddPart.onclick = addParticipant;
iParticipant.onkeyup = (e) => {
    if (e.key === "Enter") addParticipant();
};

function removeParticipant() {
    let id = iRmParticipant.value;
    if (!id) return;
    delete participants[id];
    delete partition[id];

    // Update views

    for (let el of Array.from(document.getElementsByClassName("dynParticipantRef_" + id)))
        el.remove();

    // Remove matching entries
    for (let eid in entries) {
        let entry = entries[eid];
        if (entry.contributors.includes(id))
            entry.contributors = entry.contributors.filter((cid) => cid !== id);
        if (id in entry.partition) delete entry.partition[id];
        if (id in entry.details) {
            entry.price -= entry.details[id];
            delete entry.details[id];
        }
        if (entry.paidBy === id) delete entries[eid];
    }
    renderEntries();
    renderBalances();
    resetEntryForm();
    save();
}

iButtonRmPart.onclick = removeParticipant;

// Entries

function getContributors() {
    return document.querySelectorAll(".contributor input");
}

function callEntry() {
    let title = iTitle.value.trim();
    let price = parseFloat(iPrice.value);
    let paidBy = iPaidBy.value;
    let method = iMethod.value;

    let contributors = Array.from(getContributors())
        .filter((i) => i.checked)
        .map((i) => i.name);

    let details = {};
    if (method == "detailed") {
        for (let id of contributors) {
            let detailedPrice = parseFloat(document.getElementById("iDynDetail_" + id).value);

            if (isNaN(detailedPrice)) return;
            details[id] = detailedPrice;
        }
    }

    if (!title || !price || !paidBy || !method || contributors.length === 0) return;

    let entry = {
        title,
        price,
        paidBy,
        method,
        contributors,
        partition,
        details,
    };

    if (addMode) {
        entries[newId()] = entry;
    } else {
        entries[editEntryId] = entry;
    }

    // Reset form
    resetEntryForm();

    // Update views
    renderEntries();
    renderBalances();

    // Save
    save();
}

iButtonCallEntry.onclick = callEntry;

function resetEntryForm() {
    iTitle.value = "";
    iPrice.value = "";
    iPrice.disabled = false;
    iPaidBy.value = iPaidBy.options[0]?.value || "";
    iMethod.value = "split";
    for (let input of getContributors()) input.checked = true;
    if (!addMode) switchMode();
    resetPartition();
    renderContributions();

    // Unselect entry if one is currently selected
    document.querySelector(".selected")?.classList.remove("selected");
}

iButtonCancel.onclick = resetEntryForm;

function renderContributions() {
    let price = parseFloat(iPrice.value);
    if (isNaN(price)) price = 0;

    for (let id in participants) {
        let contribution = document.querySelector(`#iDynContribLabel_${id} .contribution`);
        let checked = document.getElementById("iDynContrib_" + id).checked;

        switch (iMethod.value) {
            // Split equally
            case "split":
                let totalContributors = Array.from(getContributors()).filter(
                    (e) => e.checked
                ).length;
                contribution.innerText = checked
                    ? `$${(price / totalContributors).toFixed(2)}`
                    : "$0.00";

                break;

            // Split by parts
            case "parts":
                let parts = partition[id];
                let totalParts = Object.values(partition).reduce((a, b) => a + b, 0);

                if (totalParts <= 0) totalParts = 1;

                contribution.innerHTML = `
                    x${parts}
                    <button id="iDynPlus_${id}">+</button>
                    <button id="iDynMinus_${id}" ${parts <= 0 ? "disabled" : ""}>-</button>
                    $${((parts * price) / totalParts).toFixed(2)}
                `;

                document.getElementById("iDynPlus_" + id).onclick = changePartition;
                document.getElementById("iDynMinus_" + id).onclick = changePartition;

                break;

            // Detailed bill
            case "detailed":
                // If detailed bill views is already on, skip to keep balances
                if (contribution.children[0]?.tagName.toLowerCase() !== "input")
                    contribution.innerHTML = `$ <input type="number" name="iDynDetail_${id}" id="iDynDetail_${id}" value="0.00" />`;
                let input = contribution.children[0];
                input.onkeyup = renderContributions;
                input.disabled = !checked;
                if (!checked) input.value = "0.00";
                break;
        }
    }

    // Detailed bill: set total price
    if (iMethod.value == "detailed") {
        let totalPrice = 0;
        for (let id in participants) {
            let currentPrice = parseFloat(document.getElementById("iDynDetail_" + id).value);
            if (currentPrice) totalPrice += currentPrice;
            console.log(currentPrice, document.getElementById("iDynDetail_" + id).value);
        }

        iPrice.value = totalPrice.toFixed(2);
        console.log(totalPrice);
    }
}

iPrice.onkeyup = renderContributions;

function resetPartition() {
    partition = {};
    for (let id in participants) partition[id] = 1;
}

function initializeMethod() {
    iPrice.disabled = false;

    switch (iMethod.value) {
        case "parts":
            resetPartition();
            break;

        case "detailed":
            iPrice.disabled = true;
            break;
    }

    renderContributions();
}

iMethod.onchange = initializeMethod;

function changePartition(click) {
    let id = click.target.id.split("_")[1];
    let isPlus = click.target.id.startsWith("iDynPlus_");

    if (isPlus) partition[id]++;
    else partition[id]--;

    document.getElementById("iDynContrib_" + id).checked = partition[id] >= 1;

    renderContributions();
}

function switchMode() {
    addMode = !addMode;
    iTextEntryMode.innerText = addMode ? "New entry" : "Edit entry";
    iButtonCallEntry.innerText = addMode ? "Add" : "Update";
    iDeleteEntry.classList.toggle("nodisplay");
}

// Delete entry

function deleteEntry() {
    delete entries[editEntryId];
    resetEntryForm();
    renderEntries();
    renderBalances();
    save();
}

iDeleteEntry.onclick = deleteEntry;

// Rendering

function parseMethod(method) {
    switch (method) {
        case "split":
            return "Split equally";
        case "parts":
            return "Split by parts";
        case "detailed":
            return "Detailed bill";
    }
}

function renderEntries() {
    iEntries.innerHTML = "";

    for (let id in entries) {
        let entry = entries[id];
        let div = document.createElement("div");
        div.className = "entry";
        div.id = "iDynEntry_" + id;
        div.innerHTML = `
            <h4>${entry.title}</h4>
            <p>Paid by <strong>${participants[entry.paidBy]}</strong><br />
            ${parseMethod(entry.method)} between
            <strong>${entry.contributors.length}</strong> participants(s)</p>
            <p class="entry_price">$${entry.price.toFixed(2)}</p>
        `;
        iEntries.appendChild(div);

        div.onclick = () => {
            if (!div.classList.contains("selected")) {
                renderEditEntry(id);
            } else {
                div.classList.remove("selected");
                resetEntryForm();
            }
        };
    }
}

function renderEditEntry(id) {
    if (addMode) switchMode();

    document.getElementById("iDynEntry_" + editEntryId)?.classList.remove("selected");
    editEntryId = id;
    document.getElementById("iDynEntry_" + editEntryId)?.classList.add("selected");

    let entry = entries[id];
    iTitle.value = entry.title;
    iPrice.value = entry.price.toFixed(2);
    iPaidBy.value = entry.paidBy;
    iMethod.value = entry.method;
    partition = entry.partition;

    for (let input of getContributors()) {
        input.checked = entry.contributors.includes(input.name);
    }

    // First render to create input nodes
    renderContributions();

    // Detailed bill
    if (entry.method == "detailed") {
        iPrice.disabled = true;
        for (let id of entry.contributors)
            document.getElementById("iDynDetail_" + id).value = entry.details[id].toFixed(2);
    }

    // Another render to set iPrice correctly
    renderContributions();
}

function renderBalances() {
    // Total spent
    let totalSpent = 0;
    for (let eid in entries) {
        totalSpent += entries[eid].price;
    }

    iTotalSpent.innerText = `$${totalSpent.toFixed(2)}`;

    // Individual balances
    iBalances.innerHTML = "";

    for (let id in participants) {
        let name = participants[id];

        let paid = 0;
        let worth = 0;

        for (let eid in entries) {
            let entry = entries[eid];
            if (entry.paidBy === id) {
                paid += entry.price;
            }

            switch (entry.method) {
                case "split":
                    if (entry.contributors.includes(id))
                        worth += entry.price / entry.contributors.length;
                    break;
                case "parts":
                    let totalParts = Object.values(entry.partition).reduce((a, b) => a + b, 0);
                    if (totalParts <= 0) totalParts = 1;

                    worth += (entry.price * entry.partition[id]) / totalParts;
                    break;
                case "detailed":
                    if (entry.contributors.includes(id)) worth += entry.details[id];
                    break;
            }
        }

        let balance = paid - worth;

        iBalances.innerHTML += `
            <div class="balance">
                <h4>${name}</h4>
                <p>Paid: $${paid.toFixed(2)}<br />Worth: $${worth.toFixed(2)}</p>
                <p class="balance_price ${balance >= 0 ? "positive" : "negative"}">
                    $${balance.toFixed(2)}
                </p>
            </div>`;
    }
}

function makeContributorView(id) {
    // "Remove paticipant" and "Paid by"
    for (let select of [iRmParticipant, iPaidBy]) {
        let opt = document.createElement("option");
        opt.value = id;
        opt.textContent = participants[id];
        opt.className = "dynParticipantRef_" + id;
        select.appendChild(opt);
    }

    // Contributors list
    const label = document.createElement("label");
    label.id = "iDynContribLabel_" + id;
    label.htmlFor = "iDynContrib_" + id;
    label.className = "contributor dynParticipantRef_" + id;
    label.innerHTML = `
    <div>
        <input type="checkbox" id="iDynContrib_${id}" name="${id}" checked />
        ${participants[id]}
    </div>
    <p class="contribution">$0.00</p>
    `;

    iContributors.appendChild(label);

    label.onclick = (click) => {
        // plus or minus buttons
        if (click.target.tagName.toLowerCase() == "button") return;
        if (click.target.tagName.toLowerCase() == "input" && click.target.type == "number") return;

        switch (iMethod.value) {
            case "parts":
                partition[id] = document.getElementById("iDynContrib_" + id).checked ? 1 : 0;
                break;
        }
        renderContributions();
    };
}
