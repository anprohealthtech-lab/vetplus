import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { action, resultIds, status, notes, priority } = await req.json()

    switch (action) {
      case 'bulk_verify': {
        // Bulk verification of multiple results
        const verificationPromises = resultIds.map(async (resultId: string) => {
          const { error } = await supabaseClient
            .from('test_results')
            .update({
              verification_status: status,
              verified_by: user.id,
              verified_at: new Date().toISOString(),
              verification_notes: notes
            })
            .eq('id', resultId)

          if (error) throw error

          // Create audit record
          return supabaseClient
            .from('verification_audit')
            .insert({
              test_result_id: resultId,
              action_type: status,
              performed_by: user.id,
              new_status: status,
              notes: notes
            })
        })

        await Promise.all(verificationPromises)

        return new Response(
          JSON.stringify({ success: true, message: `Bulk ${status} completed for ${resultIds.length} results` }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'update_priority': {
        // Update priority level for results
        const updatePromises = resultIds.map(async (resultId: string) => {
          const { error } = await supabaseClient
            .from('test_results')
            .update({
              priority_level: priority
            })
            .eq('id', resultId)

          if (error) throw error

          // Create audit record
          return supabaseClient
            .from('verification_audit')
            .insert({
              test_result_id: resultId,
              action_type: 'priority_changed',
              performed_by: user.id,
              notes: `Priority changed to level ${priority}`,
              metadata: { new_priority: priority }
            })
        })

        await Promise.all(updatePromises)

        return new Response(
          JSON.stringify({ success: true, message: `Priority updated for ${resultIds.length} results` }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'get_verification_history': {
        // Get verification history for a specific result
        const [resultId] = resultIds
        
        const { data: history, error } = await supabaseClient
          .from('verification_audit')
          .select(`
            *,
            performed_by_user:auth.users!performed_by(
              id,
              email,
              raw_user_meta_data
            )
          `)
          .eq('test_result_id', resultId)
          .order('performed_at', { ascending: false })

        if (error) throw error

        return new Response(
          JSON.stringify({ history }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'generate_verification_report': {
        // Generate verification performance report
        const { data: stats, error: statsError } = await supabaseClient
          .rpc('get_verification_performance', {
            start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date().toISOString()
          })

        if (statsError) throw statsError

        const { data: userStats, error: userStatsError } = await supabaseClient
          .from('verification_audit')
          .select(`
            performed_by,
            action_type,
            performed_at,
            auth.users!performed_by(email)
          `)
          .gte('performed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

        if (userStatsError) throw userStatsError

        // Process user statistics
        const userPerformance = userStats.reduce((acc: any, record: any) => {
          const userId = record.performed_by
          if (!acc[userId]) {
            acc[userId] = {
              email: record.auth?.users?.email || 'Unknown',
              approved: 0,
              rejected: 0,
              clarification: 0,
              total: 0
            }
          }
          
          acc[userId][record.action_type] = (acc[userId][record.action_type] || 0) + 1
          acc[userId].total += 1
          
          return acc
        }, {})

        return new Response(
          JSON.stringify({ 
            stats, 
            userPerformance: Object.values(userPerformance) 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'auto_approve_normal': {
        // Auto-approve results within normal ranges with no flags
        const { data: normalResults, error: findError } = await supabaseClient
          .from('view_results_pending')
          .select('id')
          .is('flags', null)
          .eq('urgency_level', 'normal')
          .lte('days_pending', 1) // Only recent results

        if (findError) throw findError

        if (normalResults && normalResults.length > 0) {
          const autoApprovePromises = normalResults.map(async (result: any) => {
            const { error } = await supabaseClient
              .from('test_results')
              .update({
                verification_status: 'approved',
                verified_by: user.id,
                verified_at: new Date().toISOString(),
                verification_notes: 'Auto-approved: Normal range, no flags'
              })
              .eq('id', result.id)

            if (error) throw error

            return supabaseClient
              .from('verification_audit')
              .insert({
                test_result_id: result.id,
                action_type: 'approved',
                performed_by: user.id,
                new_status: 'approved',
                notes: 'Auto-approved: Normal range, no flags',
                metadata: { auto_approved: true }
              })
          })

          await Promise.all(autoApprovePromises)

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Auto-approved ${normalResults.length} normal results`,
              count: normalResults.length 
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No results eligible for auto-approval',
            count: 0 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }
  } catch (error) {
    console.error('Verification function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
