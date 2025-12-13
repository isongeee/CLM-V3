import { supabaseClient } from "../auth/supabaseClient.js";
import { showToast, setText } from "../auth/ui.js";

const params = new URLSearchParams(window.location.search);
const companyId = params.get("companyId");

if (!companyId) {
    window.location.assign("./index.html");
}

let currentPlanId = null;

async function loadSubscription() {
    const supabase = supabaseClient();

    // Get Company Name
    const { data: company } = await supabase.from('companies').select('name').eq('id', companyId).single();
    if (company) setText("#company-name", company.name);

    // Get Subscription
    const { data: sub, error } = await supabase.from('company_subscriptions').select('*, plans(name, price)').eq('company_id', companyId).single();

    const detailsEl = document.getElementById("subscription-details");

    if (!sub || error) {
        detailsEl.innerHTML = `<p>No active subscription.</p><p>Please select a plan to get started.</p>`;
        document.getElementById("btn-cancel-sub").hidden = true;
        document.getElementById("btn-change-plan").textContent = "Subscribe";
        return;
    }

    const { status, plans, current_period_end, cancel_at_period_end, plan_id } = sub;
    currentPlanId = plan_id;
    const planName = plans?.name || "Unknown Plan";
    const price = plans?.price || 0;

    const endDate = new Date(current_period_end).toLocaleDateString();

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 style="margin:0;">${planName} <span class="plan-badge">$${price}/mo</span></h3>
                <p class="muted">Status: <span class="status-badge status-${status}">${status}</span></p>
            </div>
        </div>
        <p>Current period ends: ${endDate}</p>
    `;

    if (cancel_at_period_end) {
        html += `<p class="status-past_due">Subscription will cancel at the end of the period.</p>`;
        document.getElementById("btn-cancel-sub").hidden = true;
    } else {
        document.getElementById("btn-cancel-sub").hidden = false;
    }

    document.getElementById("btn-change-plan").textContent = "Change Plan";

    detailsEl.innerHTML = html;
}

async function loadInvoices() {
    const supabase = supabaseClient();
    // Check if we have an Invoice table in public? User said "invoices" table in DB.
    // Assuming RLS allows select.

    const { data: invoices } = await supabase.from('invoices').select('*').eq('company_id', companyId).order('created_at', { ascending: false });

    const listEl = document.getElementById("invoice-list");
    if (!invoices || invoices.length === 0) {
        listEl.innerHTML = `<li class="muted">No invoices found.</li>`;
        return;
    }

    const html = invoices.map(inv => `
       <li class="invoice-item">
           <span>${new Date(inv.created_at).toLocaleDateString()}</span>
           <span>$${inv.amount_due}</span>
           <span class="status-badge status-${inv.status}">${inv.status}</span>
           ${inv.invoice_pdf_url ? `<a href="${inv.invoice_pdf_url}" target="_blank">Download</a>` : ''}
       </li>
   `).join("");
    listEl.innerHTML = html;
}

// Actions
document.getElementById('btn-change-plan').addEventListener('click', () => {
    document.getElementById('plan-modal').showModal();
    // Pre-select current plan if any
    if (currentPlanId) {
        const radio = document.querySelector(`input[name="plan"][value="${currentPlanId}"]`);
        if (radio) radio.checked = true;
    }
});

document.getElementById('change-plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const planId = formData.get('plan');
    if (!planId) return;

    try {
        const supabase = supabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        // Use create_subscription action which upserts (logic in edge function)
        // If switching from one to another, edge function logic handles it.
        const res = await fetch(`${supabase.supabaseUrl}/functions/v1/subscription-manager`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                action: 'create_subscription',
                company_id: companyId,
                plan_id: planId
            })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to change plan");

        showToast(result.message);
        document.getElementById('plan-modal').close();
        loadSubscription();

    } catch (err) {
        showToast(err.message);
    }
});

document.getElementById('btn-cancel-sub').addEventListener('click', async () => {
    if (!confirm("Are you sure you want to cancel?")) return;
    try {
        const supabase = supabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${supabase.supabaseUrl}/functions/v1/subscription-manager`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                action: 'cancel_subscription',
                company_id: companyId
            })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to cancel");
        showToast(result.message);
        loadSubscription();
    } catch (err) {
        showToast(err.message);
    }
});

document.getElementById('btn-update-payment').addEventListener('click', () => {
    showToast("Payment method update not implemented in sandbox.");
});


// Init
(async () => {
    const supabase = supabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.assign("../auth/login.html"); return; }

    await loadSubscription();
    await loadInvoices();
})();

document.getElementById('sign-out').addEventListener('click', async () => {
    const supabase = supabaseClient();
    await supabase.auth.signOut();
    return window.location.assign("../auth/login.html");
});
