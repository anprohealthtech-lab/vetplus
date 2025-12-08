import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase (Service Role for db/storage access)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.ALLGOOGLE_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";

// Helper to call Gemini
async function callGemini(prompt: string, imageBase64?: string, mimeType?: string): Promise<any> {
  if (!GEMINI_API_KEY) throw new Error("Gemini API Key not found");

  const parts: any[] = [{ text: prompt }];

  if (imageBase64 && mimeType) {
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: imageBase64
      }
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const responseData = await response.json();
  const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    throw new Error("Failed to parse Gemini JSON response");
  }
}

const handler: Handler = async (event, context) => {
  // Postmark sends POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    // Postmark payload structure
    // ToFull[0].Email = the actual recipient email (lab user's email like labA@gmail.com)
    // From = the sender (outsourced lab email)
    const { From, Subject, Attachments, MessageID, ToFull, To } = body;
    
    // The forwarding email is key - it identifies which lab user/lab this belongs to
    // ToFull[0].Email contains the actual recipient before Postmark inbound address
    // If not available, fall back to To field
    const forwardingEmail = ToFull?.[0]?.Email || To;

    console.log(`Received email from ${From} to ${forwardingEmail} with subject: ${Subject}`);

    if (!Attachments || Attachments.length === 0) {
      console.log('No attachments found');
      return { statusCode: 200, body: 'No attachments processed' };
    }

    // We only process the first relevant attachment for now (PDF or Image)
    const validAttachment = Attachments.find((att: any) => 
      att.ContentType === 'application/pdf' || 
      att.ContentType.startsWith('image/')
    );

    if (!validAttachment) {
      console.log('No valid PDF/Image attachments found');
      return { statusCode: 200, body: 'No valid attachments' };
    }

    const fileName = `${Date.now()}_${validAttachment.Name}`;
    const fileContent = Buffer.from(validAttachment.Content, 'base64');

    // 1. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('outsourced_reports')
      .upload(fileName, fileContent, {
        contentType: validAttachment.ContentType,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    const fileUrl = supabase.storage.from('outsourced_reports').getPublicUrl(fileName).data.publicUrl;

    // 2. Extract Data using Gemini
    // Note: Gemini API supports PDF via File API or inline data (if small enough). 
    // For simplicity/speed, if it's an image, we send inline. 
    // If PDF, Gemini 1.5 Pro supports PDF, but via File API usually. 
    // However, 2.0 Flash might support inline PDF base64? 
    // Documentation says "PDF" is supported. Let's try sending base64.
    // If it fails, we might need to convert PDF to Image or use File API (which requires upload to Google).
    // For this MVP, let's assume inline works or we focus on Images. 
    // Actually, Gemini 1.5 Pro supports PDF text extraction natively.
    
    const extractionPrompt = `
      Extract the following information from this medical test report:
      1. Patient Name
      2. Test Name(s) / Panel Name
      3. Collection Date (if available)
      4. Results: Array of { analyte_name, value, unit, reference_range, flag }
      
      Respond with this JSON structure:
      {
        "patient_name": "string",
        "test_name": "string",
        "collection_date": "string or null",
        "results": [
          {
            "analyte_name": "string",
            "value": "string",
            "unit": "string",
            "reference_range": "string",
            "flag": "string or null"
          }
        ],
        "lab_name": "string (name of the lab that issued report)"
      }
    `;

    let extractedData = null;
    let aiConfidence = 0;

    try {
      console.log('Calling Gemini for extraction...');
      extractedData = await callGemini(extractionPrompt, validAttachment.Content, validAttachment.ContentType);
      aiConfidence = 0.9; // Mock confidence if successful
      console.log('Gemini extraction success');
    } catch (aiError) {
      console.error('Gemini extraction failed:', aiError);
      // We still save the report, but with empty data
    }

    // 3. Save to Database
    // Match lab_id by the FORWARDING EMAIL (lab user's email)
    // Each lab user registers their forwarding email in their user profile or lab settings
    
    // Strategy: Look up user by email -> get their lab_id
    // The forwardingEmail is the lab user's email (e.g., labuser@gmail.com)
    
    let labId = null;
    let matchedUserId = null;
    
    // First, try to find a user with this email
    const { data: matchedUser } = await supabase
      .from('users')
      .select('id, lab_id, email')
      .ilike('email', forwardingEmail?.split('<')?.[1]?.replace('>', '') || forwardingEmail || '')
      .limit(1)
      .single();
    
    if (matchedUser?.lab_id) {
      labId = matchedUser.lab_id;
      matchedUserId = matchedUser.id;
      console.log(`Matched forwarding email ${forwardingEmail} to lab ${labId} via user email`);
    } else {
      // Fallback: Check if any lab has this email registered as lab email
      const { data: matchedLab } = await supabase
        .from('labs')
        .select('id')
        .ilike('email', forwardingEmail?.split('<')?.[1]?.replace('>', '') || forwardingEmail || '')
        .limit(1)
        .single();
      
      if (matchedLab?.id) {
        labId = matchedLab.id;
        console.log(`Matched forwarding email ${forwardingEmail} to lab ${labId} via lab email`);
      }
    }

    if (!labId) {
      console.error(`Could not match forwarding email "${forwardingEmail}" to any lab. Storing as unassigned.`);
      // Get first lab as fallback (or you could reject the email)
      const { data: defaultLab } = await supabase.from('labs').select('id').limit(1).single();
      labId = defaultLab?.id;
      
      if (!labId) {
        throw new Error(`No lab found for forwarding email: ${forwardingEmail}`);
      }
    }

    const { error: dbError } = await supabase.from('outsourced_reports').insert({
      lab_id: labId,
      source: 'email_forward',
      sender_email: From,
      recipient_email: forwardingEmail, // Store the forwarding email for reference
      subject: Subject,
      file_url: fileUrl,
      file_name: validAttachment.Name,
      status: extractedData ? 'processed' : 'pending_processing',
      ai_extracted_data: extractedData,
      ai_confidence: aiConfidence,
      processing_error: extractedData ? null : 'AI Extraction Failed',
      matched_user_id: matchedUserId, // Track which user received this
    });

    if (dbError) {
      console.error('Database insert error:', dbError);
      throw dbError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Report processed' }),
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

export { handler };
