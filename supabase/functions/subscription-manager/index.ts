import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error("Missing Authorization header")
        }

        // Create a Supabase client with the Auth context of the logged in user.
        const supabaseClient = createClient(
            // Supabase API URL - env var exported by default.
            Deno.env.get('SUPABASE_URL') ?? '',
            // Supabase API NAME - env var exported by default.
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            // Create client with Auth context of the user that called the function.
            { global: { headers: { Authorization: authHeader } } }
        )

        // Also create admin client for privileged updates
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { action, company_id, plan_id, payment_method_id } = await req.json()

        if (!action || !company_id) {
            throw new Error("Missing required fields: action, company_id")
        }

        const { data: userData, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !userData?.user) {
            throw new Error("Unauthorized")
        }

        // Verify user is member and admin of the company
        const { data: membership, error: memError } = await supabaseClient
            .from('company_users')
            .select('is_admin')
            .eq('company_id', company_id)
            .eq('user_id', userData.user.id)
            .maybeSingle()

        // Note: company_users RLS may allow a member to see multiple rows; filter to the caller's user_id.

        if (memError || !membership) {
            throw new Error("Unauthorized: You are not a member of this company or RLS blocked access")
        }
        if (!membership.is_admin) {
            throw new Error("Unauthorized: Only admins can manage subscriptions")
        }

        let result;

        if (action === 'create_subscription') {
            const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', plan_id).single()
            if (!plan) throw new Error("Invalid plan")

            // Construct subscription data
            // Logic: Basic = 30 days trial. Real Estate = Immediate? Or trial? 
            // Prompt: "basic – 30 days free... real_estate – $24.99"
            // Prompt also said "you can also give this a trial if you want" for Real Estate.
            // I will assume Basic gets trial, Real Estate gets trial too for simplicity/friendliness? 
            // Or stick to: Basic=Trial, RealEstate=Active. 
            // Going with: Basic=Trial, RealState=Trial (14 days default from my migration insertion).

            const trialDays = plan.trial_days || 0
            const trialEndsAt = trialDays > 0 ? new Date(Date.now() + trialDays * 86400000).toISOString() : null
            const status = trialDays > 0 ? 'trialing' : 'active'
            const currentPeriodStart = new Date().toISOString()
            const currentPeriodEnd = new Date(Date.now() + 30 * 86400000).toISOString() // Monthly

            const { error } = await supabaseAdmin.from('company_subscriptions').upsert({
                company_id,
                plan_id,
                status,
                current_period_start: currentPeriodStart,
                current_period_end: currentPeriodEnd,
                trial_ends_at: trialEndsAt,
                payment_method_id
            })
            if (error) throw error

            await supabaseAdmin.from('billing_events').insert({
                company_id,
                event_type: 'subscription_created',
                description: `Subscribed to ${plan.name}`,
                metadata: { plan_id, status }
            })

            result = { success: true, message: `Subscription created. Status: ${status}` }

        } else if (action === 'change_plan') {
            const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', plan_id).single()
            if (!plan) throw new Error("Invalid plan")

            // For now, simple update. Real implementations handle pruning, billing cycles etc.
            const { error } = await supabaseAdmin.from('company_subscriptions').update({
                plan_id,
            }).eq('company_id', company_id)
            if (error) throw error

            await supabaseAdmin.from('billing_events').insert({
                company_id,
                event_type: 'plan_changed',
                description: `Changed plan to ${plan.name}`,
                metadata: { plan_id }
            })

            result = { success: true, message: "Plan changed" }

        } else if (action === 'cancel_subscription') {
            const { error } = await supabaseAdmin.from('company_subscriptions').update({
                cancel_at_period_end: true
            }).eq('company_id', company_id)
            if (error) throw error

            await supabaseAdmin.from('billing_events').insert({
                company_id,
                event_type: 'subscription_canceled',
                description: `Subscription canceled (at period end)`,
            })
            result = { success: true, message: "Subscription set to cancel at period end" }
        } else {
            throw new Error("Invalid action")
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
