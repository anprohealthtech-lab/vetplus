// Supabase Edge Function: Process Notification Queue
// Processes failed/pending WhatsApp notifications and retries sending

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WHATSAPP_API_BASE = Deno.env.get('WHATSAPP_API_BASE_URL') || 'https://app.limsapp.in/whatsapp'

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Parse request body for optional lab_id filter
    let labId: string | undefined
    let limit = 10
    
    try {
      const body = await req.json()
      labId = body.labId
      limit = body.limit || 10
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log('📲 Processing notification queue...')
    console.log('Lab filter:', labId || 'All labs')
    console.log('Limit:', limit)

    // Fetch pending notifications that are ready for retry
    let query = supabaseClient
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(limit)

    if (labId) {
      query = query.eq('lab_id', labId)
    }

    const { data: items, error: fetchError } = await query

    if (fetchError) {
      throw new Error(`Failed to fetch queue items: ${fetchError.message}`)
    }

    if (!items?.length) {
      console.log('📭 No pending notifications to process')
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0, 
          sent: 0, 
          failed: 0,
          message: 'No pending notifications' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📬 Found ${items.length} pending notifications`)

    // Use existing Netlify function for sending reports
    const NETLIFY_SEND_REPORT_URL = 'https://app.limsapp.in/.netlify/functions/send-report-url'

    // Helper function to send WhatsApp via Netlify function
    const sendWhatsApp = async (item: any): Promise<boolean> => {
      try {
        // Get lab's country code
        const { data: labData } = await supabaseClient
          .from('labs')
          .select('whatsapp_user_id, country_code')
          .eq('id', item.lab_id)
          .single()
        
        const whatsappUserId = labData?.whatsapp_user_id
        const countryCode = labData?.country_code || '+91' // Default to India
        
        if (!whatsappUserId) {
          console.error('❌ No whatsapp_user_id configured for lab:', item.lab_id)
          return false
        }
        
        console.log('✅ Found lab whatsapp_user_id:', whatsappUserId)
        console.log('🌍 Using country code:', countryCode)

        let cleanPhone = item.recipient_phone.replace(/\D/g, '')
        
        // Remove leading 0 (common for local numbers)
        if (cleanPhone.startsWith('0')) {
          cleanPhone = cleanPhone.substring(1)
        }
        
        // Format phone number with lab's country code
        let formattedPhone: string
        const countryCodeDigits = countryCode.replace(/\D/g, '')
        
        if (cleanPhone.length === 10) {
          // 10 digit number - add country code
          formattedPhone = countryCode + cleanPhone
        } else if (cleanPhone.startsWith(countryCodeDigits) && cleanPhone.length === (10 + countryCodeDigits.length)) {
          // Already has country code digits - just add +
          formattedPhone = '+' + cleanPhone
        } else if (cleanPhone.length > 10) {
          // Assume it has country code, just add +
          formattedPhone = '+' + cleanPhone
        } else {
          // Fallback - add country code
          formattedPhone = countryCode + cleanPhone
        }

        console.log(`📤 Sending to ${formattedPhone} (original: ${item.recipient_phone})`)

        if (item.attachment_url) {
          // Send document via Netlify function
          console.log(`   Using Netlify function: ${NETLIFY_SEND_REPORT_URL}`)
          console.log(`   File URL: ${item.attachment_url}`)
          
          // Extract filename from URL
          const urlParts = item.attachment_url.split('/')
          const fileName = urlParts[urlParts.length - 1]
          
          const requestBody = {
            userId: whatsappUserId,
            fileUrl: item.attachment_url,
            fileName: fileName,
            caption: item.message_content || '',
            phoneNumber: formattedPhone,
            templateData: {
              PatientName: item.recipient_name || 'Patient'
            }
          }
          
          console.log('📋 Request payload:', JSON.stringify(requestBody, null, 2))
          
          const response = await fetch(NETLIFY_SEND_REPORT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          })
          
          const responseText = await response.text()
          
          if (!response.ok) {
            console.error(`❌ Netlify function error: ${response.status} ${response.statusText}`)
            console.error(`   Response: ${responseText}`)
            return false
          }
          
          try {
            const result = JSON.parse(responseText)
            console.log(`✅ WhatsApp sent successfully:`, result)
          } catch {
            console.log(`✅ WhatsApp sent (raw response): ${responseText}`)
          }
          return true
        } else {
          // For text-only messages, we don't have a Netlify function yet
          // This case is rare - most notifications include reports
          console.warn('⚠️ Text-only messages not implemented via Netlify function')
          return false
        }
      } catch (error) {
        console.error(`❌ WhatsApp send exception:`, error)
        return false
      }
    }

    let successCount = 0
    let failCount = 0

    for (const item of items) {
      console.log(`\n📤 Processing: ${item.id} (${item.trigger_type} → ${item.recipient_type})`)

      // Mark as sending
      await supabaseClient
        .from('notification_queue')
        .update({ 
          status: 'sending',
          attempts: item.attempts + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)

      try {
        const sent = await sendWhatsApp(item)

        if (sent) {
          // Mark as sent
          await supabaseClient
            .from('notification_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id)

          // Update tracking fields on related records
          if (item.report_id) {
            const updateField = item.recipient_type === 'doctor' 
              ? { doctor_informed_at: new Date().toISOString(), doctor_informed_via: 'whatsapp' }
              : { whatsapp_sent_at: new Date().toISOString(), whatsapp_sent_to: item.recipient_phone, whatsapp_sent_via: 'api' }
            
            await supabaseClient.from('reports').update(updateField).eq('id', item.report_id)
          }
          if (item.invoice_id) {
            await supabaseClient
              .from('invoices')
              .update({
                whatsapp_sent_at: new Date().toISOString(),
                whatsapp_sent_to: item.recipient_phone,
                whatsapp_sent_via: 'api'
              })
              .eq('id', item.invoice_id)
          }

          console.log(`✅ Sent successfully`)
          successCount++

        } else {
          // Mark as failed or pending for retry
          const newStatus = item.attempts + 1 >= 3 ? 'failed' : 'pending'
          await supabaseClient
            .from('notification_queue')
            .update({
              status: newStatus,
              last_error: 'Send request returned non-OK status',
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id)

          console.log(`❌ Failed to send (attempt ${item.attempts + 1}/3)`)
          failCount++
        }

      } catch (sendError) {
        // Mark as failed or pending for retry
        const newStatus = item.attempts + 1 >= 3 ? 'failed' : 'pending'
        await supabaseClient
          .from('notification_queue')
          .update({
            status: newStatus,
            last_error: String(sendError),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)

        console.error(`❌ Error sending:`, sendError)
        failCount++
      }
    }

    console.log(`\n📊 Queue processing complete: ${successCount} sent, ${failCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: items.length,
        sent: successCount,
        failed: failCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Queue processor error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Queue processing failed', 
        details: String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
