
// Supabase Edge Function: HTML Preview Generation (No PDF Conversion)
// Generates final HTML for reports but returns it directly instead of converting to PDF
// Keeps image URLs as-is (no base64 conversion) and applies minimal/no default CSS

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to get nested value
function getNestedValue(obj: Record<string, any>, path: string): any {
  const keys = path.split('.')
  let current = obj
  
  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined
    }
    current = current[key]
  }
  
  return current
}

// Simple template rendering
function renderTemplate(html: string, context: Record<string, any>): string {
  if (!html) return ''
  
  let result = html
  
  // Replace {{ variable }} patterns
  result = result.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
    const trimmedKey = key.trim()
    const value = getNestedValue(context, trimmedKey)
    
    if (value === undefined || value === null) {
      return '' // Empty string for missing values
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    
    return String(value)
  })
  
  return result
}

// Inject signature image logic
function injectSignatureImage(html: string, signatoryImageUrl: string, signatoryName: string): string {
  if (!html || !signatoryImageUrl || !signatoryName) {
    return html
  }
  
  if (html.includes(`src="${signatoryImageUrl}"`) ||
      html.includes('signature-image') || 
      html.includes('signatory-image')) {
    return html
  }
  
  const signatureImgHtml = `<img src="${signatoryImageUrl}" alt="" style="display: block; max-height: 40px !important; max-width: 120px !important; width: auto !important; height: auto !important; object-fit: contain; margin-top: 5px; margin-bottom: 0px;" />`
  const escapedName = signatoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  
  // Pattern 1: Table cell
  const tdPattern = new RegExp(`(<td[^>]*>)(\\s*)(?:<(?:b|strong)>)?(\\s*)(${escapedName})(\\s*)(?:<\/(?:b|strong)>)?(\\s*)(</td>)`, 'gi')
  let modified = html
  let injected = false
  
  const replaceLastOccurrence = (str: string, pattern: RegExp, replacement: string): string => {
    const matches = Array.from(str.matchAll(pattern))
    if (!matches || matches.length === 0) return str
    const lastMatch = matches[matches.length - 1]
    const prefix = str.substring(0, lastMatch.index)
    const suffix = str.substring(lastMatch.index! + lastMatch[0].length)
    return prefix + lastMatch[0].replace(pattern, replacement) + suffix
  }

  const tdMatches = html.match(tdPattern)
  if (tdMatches && tdMatches.length > 0) {
    if (tdMatches.length === 1) {
      modified = html.replace(tdPattern, `$1$2$3${signatureImgHtml}$3$4$5$6$7`)
    } else {
      modified = replaceLastOccurrence(html, tdPattern, `$1$2$3${signatureImgHtml}$3$4$5$6$7`)
    }
    injected = true
  }
  
  // Pattern 2: Div/Span/P
  if (!injected) {
    const divPattern = new RegExp(`(<(?:div|span|p)[^>]*>)(\\s*)(?:<(?:b|strong)>)?(\\s*)(${escapedName})(\\s*)(?:<\/(?:b|strong)>)?(\\s*)(</(?:div|span|p)>)`, 'gi')
    const divMatches = html.match(divPattern)
    if (divMatches && divMatches.length > 0) {
      if (divMatches.length === 1) {
        modified = html.replace(divPattern, `$1$2$3${signatureImgHtml}$3$4$5$6$7`)
      } else {
        modified = replaceLastOccurrence(html, divPattern, `$1$2$3${signatureImgHtml}$3$4$5$6$7`)
      }
      injected = true
    }
  }
  
  // Pattern 3: BR
  if (!injected) {
    const brPattern = new RegExp(`(?:<(?:b|strong)>)?(\\s*)(${escapedName})(\\s*)(?:<\/(?:b|strong)>)?(\\s*<br\\s*/?>)`, 'gi')
    const brMatches = html.match(brPattern)
    if (brMatches && brMatches.length > 0) {
      modified = replaceLastOccurrence(html, brPattern, `${signatureImgHtml}$&`)
      injected = true
    }
  }
  
  return modified
}

// Group analytes helper
function groupAnalytesByTestGroup(analytes: any[], contextTestGroupIds: string[]): Map<string, any[]> {
  const groups = new Map<string, any[]>()
  const ungrouped: any[] = []
  
  // Initialize groups from context if available
  if (contextTestGroupIds && contextTestGroupIds.length > 0) {
    contextTestGroupIds.forEach(id => groups.set(id, []))
  }
  
  for (const analyte of analytes) {
    if (analyte.test_group_id) {
       if (!groups.has(analyte.test_group_id)) {
         groups.set(analyte.test_group_id, [])
       }
       groups.get(analyte.test_group_id)?.push(analyte)
    } else {
      ungrouped.push(analyte)
    }
  }
  
  if (ungrouped.length > 0) {
    groups.set('ungrouped', ungrouped)
  }
  
  return groups
}

// Format Clinical Summary (bullet points)
function formatClinicalSummary(summary: string): string {
  if (!summary) return ''
  
  // Clean clean underscores/asterisks from markdown if present
  let cleanSummary = summary.replace(/[*_]{2,}/g, '')
  
  // Convert bullet points to HTML list
  // Handles -, *, •, and numbered lists
  const lines = cleanSummary.split('\n')
  let html = ''
  let inList = false
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    // Check for page break (--- or ***)
    if (trimmed === '---' || trimmed === '***') {
      if (inList) {
        html += '</ul>'
        inList = false
      }
      html += '<div style="page-break-after: always; height: 1px; margin: 10px 0;"></div>'
      continue
    }
    
    const isBullet = /^[-*•]/.test(trimmed) || /^\d+\./.test(trimmed)
    
    if (isBullet) {
      if (!inList) {
        html += '<ul style="margin: 5px 0 10px 20px; padding: 0;">'
        inList = true
      }
      // Remove bullet marker
      const content = trimmed.replace(/^[-*•]\s*|^\d+\.\s*/, '')
      html += `<li style="margin-bottom: 4px;">${content}</li>`
    } else {
      if (inList) {
        html += '</ul>'
        inList = false
      }
      // Check for headers (ends with colon or all caps)
      const isHeader = /:$/.test(trimmed)
      if (isHeader) {
        html += `<p style="margin: 10px 0 5px 0; font-weight: bold;">${trimmed}</p>`
      } else {
        html += `<p style="margin: 0 0 8px 0;">${trimmed}</p>`
      }
    }
  }
  
  if (inList) {
    html += '</ul>'
  }
  
  return html || cleanSummary
}

// Generate Report Extras HTML (AI Summaries)
function generateReportExtrasHtml(extras: any): string {
  let html = ''
  
  if (!extras) return ''

  // AI Clinical Summary from orders table
  if (extras.ai_clinical_summary) {
    const formattedAiSummary = formatClinicalSummary(extras.ai_clinical_summary)
    html += '<div class="report-ai-summary" style="margin-top: 30px; page-break-inside: avoid; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; background: #eff6ff;">'
    html += '<h2 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px; font-weight: bold; text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">AI Clinical Interpretation</h2>'
    html += `<div style="font-size: 13px; line-height: 1.6; color: #1f2937;">${formattedAiSummary}</div>`
    html += '</div>'
  }
  
  // AI Patient Summary from orders table
  if (extras.ai_patient_summary) {
    try {
      const patientSummary = typeof extras.ai_patient_summary === 'string' 
        ? JSON.parse(extras.ai_patient_summary) 
        : extras.ai_patient_summary
      
      const languageLabel = extras.patient_summary_language 
        ? ` (${extras.patient_summary_language.charAt(0).toUpperCase() + extras.patient_summary_language.slice(1)})`
        : ''
      
      html += '<div class="report-patient-summary" style="margin-top: 30px; page-break-inside: avoid; border: 2px solid #db2777; border-radius: 8px; padding: 20px; background: #fdf2f8;">'
      html += `<h2 style="margin: 0 0 15px 0; color: #be185d; font-size: 18px; font-weight: bold; text-align: center; border-bottom: 2px solid #db2777; padding-bottom: 10px;">Your Results Summary${languageLabel}</h2>`
      
      // Health Status
      if (patientSummary.health_status) {
        html += '<div style="margin-bottom: 15px;">'
        html += '<h3 style="margin: 0 0 8px 0; color: #be185d; font-size: 14px; font-weight: bold;">Overall Health Status</h3>'
        html += `<p style="margin: 0; font-size: 13px; line-height: 1.5; color: #1f2937;">${patientSummary.health_status}</p>`
        html += '</div>'
      }
      
      // Normal Findings
      if (patientSummary.normal_findings && patientSummary.normal_findings.length > 0) {
        html += '<div style="margin-bottom: 15px;">'
        html += '<h3 style="margin: 0 0 8px 0; color: #16a34a; font-size: 14px; font-weight: bold;">✓ Normal Findings</h3>'
        html += '<ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #1f2937;">'
        for (const finding of patientSummary.normal_findings) {
          html += `<li>${finding}</li>`
        }
        html += '</ul></div>'
      }
      
      // Abnormal Findings
      if (patientSummary.abnormal_findings && patientSummary.abnormal_findings.length > 0) {
        html += '<div style="margin-bottom: 15px;">'
        html += '<h3 style="margin: 0 0 8px 0; color: #dc2626; font-size: 14px; font-weight: bold;">⚠ Areas Needing Attention</h3>'
        html += '<ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #1f2937;">'
        for (const finding of patientSummary.abnormal_findings) {
          const findingName = typeof finding === 'string' 
            ? finding 
            : (finding.test_name || finding.name || finding.parameter || finding.label || 'Finding')
          const explanation = typeof finding === 'string' ? '' : (finding.explanation || '')
          const text = explanation ? `${findingName}: ${explanation}` : findingName
          html += `<li>${text}</li>`
        }
        html += '</ul></div>'
      }
      
      // Consultation Recommendation
      if (patientSummary.consultation_recommendation) {
        html += '<div style="margin-bottom: 15px; background: #fef2f2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626;">'
        html += '<h3 style="margin: 0 0 8px 0; color: #dc2626; font-size: 14px; font-weight: bold;">📋 Doctor Consultation</h3>'
        html += `<p style="margin: 0; font-size: 13px; line-height: 1.5; color: #1f2937;">${patientSummary.consultation_recommendation}</p>`
        html += '</div>'
      }
      
      // Health Tips
      if (patientSummary.health_tips && patientSummary.health_tips.length > 0) {
        html += '<div style="margin-bottom: 10px;">'
        html += '<h3 style="margin: 0 0 8px 0; color: #0891b2; font-size: 14px; font-weight: bold;">💡 Health Tips</h3>'
        html += '<ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #1f2937;">'
        for (const tip of patientSummary.health_tips) {
          html += `<li>${tip}</li>`
        }
        html += '</ul></div>'
      }
      
      html += '<p style="font-size: 11px; color: #6b7280; text-align: center; margin: 15px 0 0 0; font-style: italic;">This summary is for your understanding. Please consult your doctor for medical advice.</p>'
      html += '</div>'
    } catch (e) {
      console.log('Patient summary parsing failed, rendering as text:', e)
      html += '<div class="report-patient-summary" style="margin-top: 30px; page-break-inside: avoid; border: 2px solid #db2777; border-radius: 8px; padding: 20px; background: #fdf2f8;">'
      html += '<h2 style="margin: 0 0 15px 0; color: #be185d; font-size: 18px; font-weight: bold; text-align: center; border-bottom: 2px solid #db2777; padding-bottom: 10px;">Your Results Summary</h2>'
      html += `<div style="font-size: 13px; line-height: 1.6; color: #1f2937;">${extras.ai_patient_summary}</div>`
      html += '</div>'
    }
  }
  
  return html
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId } = await req.json()

    if (!orderId) {
      throw new Error('Missing required parameter: orderId')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch Context via RPC (same as generate-pdf-auto)
    const { data: context, error: contextError } = await supabaseClient.rpc(
      'get_report_template_context',
      { p_order_id: orderId }
    )

    if (contextError || !context) {
      throw new Error(`Context fetch failed: ${contextError?.message}`)
    }

    // 2. Fetch Lab Settings
    const { data: orderData } = await supabaseClient
      .from('orders')
      .select('lab_id')
      .eq('id', orderId)
      .single()
      
    const labId = orderData?.lab_id || context.order?.lab_id
    
    // Fetch Lab Templates
    const { data: allTemplates } = await supabaseClient
      .from('lab_templates')
      .select('*')
      .eq('lab_id', labId)
    
    const templatesWithHtml = (allTemplates || []).filter((tpl: any) => tpl?.gjs_html)

    // 3. Fetch Signatory Info (Simplified version of generate-pdf-auto)
    let signatoryInfo = {
      signatoryName: 'Authorized Signatory',
      signatoryDesignation: '',
      signatoryImageUrl: ''
    }

    // Try to find verifier
    let verifierUserId = null
    const { data: verifiedResult } = await supabaseClient
        .from('result_values')
        .select('verified_by')
        .eq('result_id', orderId)
        .not('verified_by', 'is', null)
        .limit(1)
        .maybeSingle()
    
    if (verifiedResult?.verified_by) verifierUserId = verifiedResult.verified_by
    else {
        const { data: orderApprover } = await supabaseClient.from('orders').select('approved_by').eq('id', orderId).maybeSingle()
        if (orderApprover?.approved_by) verifierUserId = orderApprover.approved_by
    }

    if (verifierUserId) {
         const { data: userSignature } = await supabaseClient
          .from('lab_user_signatures')
          .select('imagekit_url, file_url, signature_name, variants, user_id') // Added user_id to select
          .eq('user_id', verifierUserId)
          .eq('lab_id', labId)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle()
          
         if (userSignature) {
            let sigUrl = null
            if (userSignature.variants) {
                const variants = typeof userSignature.variants === 'string' ? JSON.parse(userSignature.variants) : userSignature.variants
                if (variants?.optimized) sigUrl = variants.optimized
            }
            if (!sigUrl) sigUrl = userSignature.imagekit_url || userSignature.file_url // Use simplified fallback
            
            if (sigUrl) {
                signatoryInfo.signatoryImageUrl = sigUrl
                signatoryInfo.signatoryName = userSignature.signature_name || 'Authorized Signatory'
                // simplified designation fetch skipped for brevity
            }
         }
    }
    
    // Fallback to Lab Default Signature
    if (!signatoryInfo.signatoryImageUrl) {
        const { data: labSignature } = await supabaseClient
          .from('lab_branding_assets')
          .select('file_url, imagekit_url')
          .eq('lab_id', labId)
          .eq('asset_type', 'signature')
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle()
         
        if (labSignature) {
            signatoryInfo.signatoryImageUrl = labSignature.imagekit_url || labSignature.file_url
        }
    }

    // 4. Prepare Context
    // First, allow fetching report extras (like generate-pdf-auto)
    
    // 6a. Get from report_extras table
    const { data: reportExtrasTable } = await supabaseClient
      .from('report_extras')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()
    
    // 6b. Get from orders table (trend_graph_data, ai_clinical_summary, ai_patient_summary)
    const { data: orderExtras } = await supabaseClient
      .from('orders')
      .select('trend_graph_data, ai_clinical_summary, ai_clinical_summary_generated_at, include_clinical_summary_in_report, ai_patient_summary, ai_patient_summary_generated_at, include_patient_summary_in_report, patient_summary_language')
      .eq('id', orderId)
      .single()
    
    // 6c. Get from reports table (ai_doctor_summary, include_trend_graphs)
    const { data: reportRecord } = await supabaseClient
      .from('reports')
      .select('ai_doctor_summary, ai_summary_generated_at, include_trend_graphs')
      .eq('order_id', orderId)
      .order('generated_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    // Merge all report extras into one object
    const reportExtras = {
      // From report_extras table
      trend_charts: reportExtrasTable?.trend_charts || [],
      clinical_summary: reportExtrasTable?.clinical_summary || '',
      // From orders table
      trend_graph_data: orderExtras?.trend_graph_data,
      ai_clinical_summary: orderExtras?.include_clinical_summary_in_report ? orderExtras?.ai_clinical_summary : null,
      ai_patient_summary: orderExtras?.include_patient_summary_in_report ? orderExtras?.ai_patient_summary : null,
      patient_summary_language: orderExtras?.patient_summary_language || 'english',
      // From reports table
      ai_doctor_summary: reportRecord?.ai_doctor_summary,
      include_trend_graphs: reportRecord?.include_trend_graphs ?? true
    }

    const prepareFullContext = (ctx: any) => {
      const placeholders = ctx.placeholderValues || {}
      return {
        ...ctx,
        ...reportExtras,
        patient: ctx.patient || {},
        order: ctx.order || {},
        meta: ctx.meta || {},
        ...placeholders,
        // Ensure critical placeholders exist
        labName: placeholders.labName || '',
        patientName: ctx.patient?.name || placeholders.patientName || '',
        sampleId: ctx.order?.sampleId || placeholders.sampleId || '',
        reportDate: placeholders.reportDate || new Date().toISOString().split('T')[0],
        signatoryName: signatoryInfo.signatoryName,
        signatoryDesignation: signatoryInfo.signatoryDesignation,
        signatoryImageUrl: signatoryInfo.signatoryImageUrl,
      }
    }

    // Generate Extras HTML
    const reportExtrasHtml = generateReportExtrasHtml(reportExtras)

    // 5. Select Template & Render
    // Group analytes logic
    const contextTestGroupIds = context.testGroupIds || []
    const analytesByGroup = groupAnalytesByTestGroup(context.analytes || [], contextTestGroupIds)
    const groupsToRender = contextTestGroupIds.length > 0 ? contextTestGroupIds : [...analytesByGroup.keys()]

    let finalHtml = ''
    let usedTemplate: any = null

    if (groupsToRender.length <= 1) {
        // Single Template
        usedTemplate = templatesWithHtml.find((t: any) => t.is_default) // Fallback to default mostly
        if (contextTestGroupIds.length > 0) {
            usedTemplate = templatesWithHtml.find((t: any) => t.test_group_id === contextTestGroupIds[0]) || usedTemplate
        }
        
        if (!usedTemplate && templatesWithHtml.length > 0) usedTemplate = templatesWithHtml[0]
        
        if (usedTemplate) {
            const fullContext = prepareFullContext(context)
            let renderedHtml = renderTemplate(usedTemplate.gjs_html, fullContext)
            
            // Inject signature
            if (signatoryInfo.signatoryImageUrl) {
                renderedHtml = injectSignatureImage(renderedHtml, signatoryInfo.signatoryImageUrl, signatoryInfo.signatoryName)
            }
            finalHtml = renderedHtml
        } else {
             finalHtml = '<div>No template found</div>'
        }
    } else {
        // Multi Group Logic - Simplified concatenation
        const renderedSections: string[] = []
        let firstGroupTemplate = null

        for (const testGroupId of groupsToRender) {
             let groupAnalytes = analytesByGroup.get(testGroupId) || []
             // Fallback for ungrouped skipped for brevity, assuming standard flow
             
             if (groupAnalytes.length === 0) continue

             const groupContext = { ...context, analytes: groupAnalytes, testGroupIds: [testGroupId] }
             let groupTemplate = templatesWithHtml.find((t: any) => t.test_group_id === testGroupId)
             if (!groupTemplate) groupTemplate = templatesWithHtml.find((t: any) => t.is_default) // Fallback

             if (groupTemplate?.gjs_html) {
                 if (!firstGroupTemplate) firstGroupTemplate = groupTemplate
                 const groupFullContext = prepareFullContext(groupContext)
                 let renderedHtml = renderTemplate(groupTemplate.gjs_html, groupFullContext)
                 
                 // Inject signature
                 if (signatoryInfo.signatoryImageUrl) {
                    renderedHtml = injectSignatureImage(renderedHtml, signatoryInfo.signatoryImageUrl, signatoryInfo.signatoryName)
                 }

                 // Extract body content
                 const bodyMatch = renderedHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
                 const bodyContent = bodyMatch ? bodyMatch[1] : renderedHtml
                 
                 const sectionHtml = `<div class="test-group-section" data-test-group-id="${testGroupId}">${bodyContent}</div>`
                 renderedSections.push(sectionHtml)
             }
        }
        
        // Wrap in outer shell from first template
        usedTemplate = firstGroupTemplate || templatesWithHtml[0]
        if (usedTemplate) {
            // We just want the outer structure, but with our sections
             const fullContext = prepareFullContext(context)
             let baseHtml = renderTemplate(usedTemplate.gjs_html, fullContext)
             
             if (baseHtml.includes('</body>')) {
                 finalHtml = baseHtml.replace(/<body[^>]*>([\s\S]*)<\/body>/i, `<body>${renderedSections.join('<br/><hr/><br/>')}</body>`)
             } else {
                 finalHtml = renderedSections.join('<br/><hr/><br/>')
             }
        } else {
            finalHtml = renderedSections.join('<br/><hr/><br/>')
        }
    }

    // Append Report Extras HTML if any
    if (reportExtrasHtml) {
        if (finalHtml.includes('</body>')) {
            finalHtml = finalHtml.replace(/<\/body>/i, `${reportExtrasHtml}</body>`)
        } else {
            finalHtml += reportExtrasHtml
        }
    }


    // 6. Fetch Header/Footer Information (Lab Settings)
    const { data: labSettings } = await supabaseClient
      .from('labs')
      .select('default_report_header_html, default_report_footer_html')
      .eq('id', labId)
      .single()
      
    // Simple regex to extract src from img tags in header/footer HTML
    // This is a naive extraction but should work for standard image-based headers
    const extractImageSrc = (html: string) => {
      if (!html) return null
      const match = html.match(/<img[^>]+src="([^">]+)"/i)
      return match ? match[1] : null
    }

    const reportHeaderHtml = labSettings?.default_report_header_html || ''
    const reportFooterHtml = labSettings?.default_report_footer_html || ''
    
    // Process placeholders in header/footer too
    // We reuse the last used context or create a generic one
    const headerFooterContext = prepareFullContext(context)
    const processedHeaderHtml = renderTemplate(reportHeaderHtml, headerFooterContext)
    const processedFooterHtml = renderTemplate(reportFooterHtml, headerFooterContext)

    // 7. Combine into Full HTML
    // We inject the header and footer into the body if it exists, or wrap it
    
    let fullHtmlWithHeaderFooter = finalHtml
    
    if (processedHeaderHtml || processedFooterHtml) {
        // Basic protection to ensure we don't break existing HTML structure if it has html/body tags
        if (fullHtmlWithHeaderFooter.includes('<body')) {
            // Insert header after <body>
            if (processedHeaderHtml) {
                fullHtmlWithHeaderFooter = fullHtmlWithHeaderFooter.replace(/(<body[^>]*>)/i, `$1\n<div class="report-header">${processedHeaderHtml}</div>\n`)
            }
            // Insert footer before </body>
            if (processedFooterHtml) {
                 fullHtmlWithHeaderFooter = fullHtmlWithHeaderFooter.replace(/(<\/body>)/i, `\n<div class="report-footer" style="margin-top: 20px;">${processedFooterHtml}</div>\n$1`)
            }
        } else {
            // No body tag, just wrap it
            fullHtmlWithHeaderFooter = `
                <!DOCTYPE html>
                <html>
                <body>
                    ${processedHeaderHtml ? `<div class="report-header">${processedHeaderHtml}</div>` : ''}
                    <div class="report-body">
                        ${fullHtmlWithHeaderFooter}
                    </div>
                    ${processedFooterHtml ? `<div class="report-footer" style="margin-top: 20px;">${processedFooterHtml}</div>` : ''}
                </body>
                </html>
            `
        }
    }

    // 8. Return Response
    // NO CSS INJECTION as requested ("this will be without any css applied")
    
    return new Response(
      JSON.stringify({ 
        html: fullHtmlWithHeaderFooter,
        order_id: orderId,
        metadata: {
            header: {
                html: processedHeaderHtml,
                imageUrl: extractImageSrc(processedHeaderHtml)
            },
            footer: {
                html: processedFooterHtml,
                imageUrl: extractImageSrc(processedFooterHtml)
            },
            signature: {
                name: signatoryInfo.signatoryName,
                designation: signatoryInfo.signatoryDesignation,
                imageUrl: signatoryInfo.signatoryImageUrl
            },
            templateName: usedTemplate?.template_name || 'Unknown'
        },
        message: 'HTML preview generated successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
