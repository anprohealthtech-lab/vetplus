const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-attachment-id, x-order-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

interface VisionRequest {
  attachmentId?: string;
  base64Image?: string;
  documentType?: string;
  testType?: string;
  aiProcessingType?: string;
  analysisType?: 'text' | 'objects' | 'colors' | 'all';
  orderId?: string;
  testGroupId?: string;
  analyteIds?: string[];
  batchId?: string;
  referenceImages?: Array<{
    url: string;
    type?: string;
    description?: string;
  }>;
  customInstruction?: string;
}

interface VisionResponse {
  fullText?: string;
  objects?: any[];
  colors?: any[];
  confidence?: number;
  error?: string;
}

interface TestContext {
  order?: {
    id: string;
    lab_id?: string | null;
    patient?: {
      id?: string;
      age?: number | null;
      gender?: string | null;
    } | null;
  };
  testGroup?: {
    id: string;
    name?: string | null;
    code?: string | null;
    lab_id?: string | null;
    ai_processing_type?: string | null;
    ai_prompt_override?: string | null;
  };
  analytes?: Array<{
    id?: string;
    name?: string | null;
    unit?: string | null;
    reference_range?: string | null;
    code?: string | null;
    ai_processing_type?: string | null;
    ai_prompt_override?: string | null;
  }>;
  labOverrides?: any[];
}

interface BatchImageReference {
  sequence: number;
  label?: string | null;
  attachmentId: string;
  fileUrl?: string | null;
  description?: string | null;
}

async function getTestContext(orderId?: string, testGroupId?: string, analyteIds?: string[]): Promise<TestContext> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return {};
  }

  const headers = {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'apikey': supabaseServiceKey,
    'Content-Type': 'application/json',
  };

  const context: TestContext = {};
  let labId: string | null = null;

  try {
    if (orderId) {
      const orderParams = new URLSearchParams({
        id: `eq.${orderId}`,
        select: 'id,lab_id,patient_id',
        limit: '1'
      });

      const orderResponse = await fetch(`${supabaseUrl}/rest/v1/orders?${orderParams.toString()}`, {
        headers,
      });

      if (orderResponse.ok) {
        const orders = await orderResponse.json();
        if (Array.isArray(orders) && orders.length > 0) {
          const orderRow = orders[0];
          context.order = {
            id: orderRow.id,
            lab_id: orderRow.lab_id,
            patient: orderRow.patient_id ? { id: orderRow.patient_id } : null,
          };
          labId = orderRow.lab_id || null;
        }
      } else {
        console.warn('Failed to fetch order context', await orderResponse.text());
      }
    }

    if (testGroupId) {
      const select = 'id,name,code,lab_id,ai_processing_type,ai_prompt_override,test_group_analytes(analyte_id,analytes(id,name,unit,reference_range,ai_processing_type,ai_prompt_override))';
      const tgParams = new URLSearchParams({
        id: `eq.${testGroupId}`,
        select,
        limit: '1'
      });

      const tgResponse = await fetch(`${supabaseUrl}/rest/v1/test_groups?${tgParams.toString()}`, {
        headers,
      });

      if (tgResponse.ok) {
        const groups = await tgResponse.json();
        if (Array.isArray(groups) && groups.length > 0) {
          const group = groups[0];
          context.testGroup = {
            id: group.id,
            name: group.name,
            code: group.code,
            lab_id: group.lab_id,
            ai_processing_type: group.ai_processing_type,
            ai_prompt_override: group.ai_prompt_override,
          };

          const analytesFromGroup = Array.isArray(group.test_group_analytes)
            ? group.test_group_analytes.map((tga: any) => ({
                id: tga.analytes?.id || tga.analyte_id,
                name: tga.analytes?.name,
                unit: tga.analytes?.unit,
                reference_range: tga.analytes?.reference_range,
                ai_processing_type: tga.analytes?.ai_processing_type,
                ai_prompt_override: tga.analytes?.ai_prompt_override,
              }))
            : [];

          if (analytesFromGroup.length) {
            context.analytes = analytesFromGroup;
          }

          if (!labId && group.lab_id) {
            labId = group.lab_id;
          }
        }
      } else {
        console.warn('Failed to fetch test group context', await tgResponse.text());
      }
    }

    const analyteIdSet = new Set<string>();
    if (Array.isArray(context.analytes)) {
      context.analytes.forEach((a) => {
        if (a?.id) analyteIdSet.add(a.id);
      });
    }
    if (Array.isArray(analyteIds)) {
      analyteIds.forEach((id) => {
        if (id) analyteIdSet.add(id);
      });
    }

    const analyteIdArray = Array.from(analyteIdSet);

    if (analyteIdArray.length && (!context.analytes || context.analytes.length < analyteIdArray.length)) {
      const analyteParams = new URLSearchParams({
        select: 'id,name,unit,reference_range,code',
        id: `in.(${analyteIdArray.join(',')})`
      });

      const analyteResponse = await fetch(`${supabaseUrl}/rest/v1/analytes?${analyteParams.toString()}`, {
        headers,
      });

      if (analyteResponse.ok) {
        const analyteRows = await analyteResponse.json();
        if (Array.isArray(analyteRows)) {
          const existing = new Map<string, any>();
          (context.analytes || []).forEach((a) => {
            if (a?.id) existing.set(a.id, a);
          });

          analyteRows.forEach((row: any) => {
            if (!row?.id) return;
            if (!existing.has(row.id)) {
              existing.set(row.id, {
                id: row.id,
                name: row.name,
                unit: row.unit,
                reference_range: row.reference_range,
                code: row.code,
              });
            } else {
              const current = existing.get(row.id);
              if (current) {
                current.name = current.name || row.name;
                current.unit = current.unit || row.unit;
                current.reference_range = current.reference_range || row.reference_range;
                current.code = current.code || row.code;
              }
            }
          });

          context.analytes = Array.from(existing.values());
        }
      } else {
        console.warn('Failed to fetch analyte context', await analyteResponse.text());
      }
    }

    if (labId && analyteIdArray.length) {
      const labParams = new URLSearchParams({
        select: '*',
        lab_id: `eq.${labId}`,
        analyte_id: `in.(${analyteIdArray.join(',')})`
      });

      const labResponse = await fetch(`${supabaseUrl}/rest/v1/lab_analytes?${labParams.toString()}`, {
        headers,
      });

      if (labResponse.ok) {
        const labRows = await labResponse.json();
        if (Array.isArray(labRows) && labRows.length) {
          context.labOverrides = labRows;
        }
      }
    }
  } catch (error) {
    console.error('Failed to build test context:', error);
  }

  return context;
}

async function getBatchImageContext(batchId?: string): Promise<BatchImageReference[]> {
  if (!batchId) return [];

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return [];
  }

  const headers = {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'apikey': supabaseServiceKey,
    'Content-Type': 'application/json',
  };

  try {
    const params = new URLSearchParams({
      batch_id: `eq.${batchId}`,
      select: 'id,batch_sequence,image_label,imagekit_url,processed_url,file_url,description',
      order: 'batch_sequence.asc'
    });

    const response = await fetch(`${supabaseUrl}/rest/v1/attachments?${params.toString()}`, {
      headers,
    });

    if (!response.ok) {
      console.warn('Failed to fetch batch image context', await response.text());
      return [];
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((row: any) => ({
      sequence: row.batch_sequence || 0,
      label: row.image_label || null,
      attachmentId: row.id,
      fileUrl: row.imagekit_url || row.processed_url || row.file_url || null,
      description: row.description || null,
    }));
  } catch (error) {
    console.error('Failed to load batch image context:', error);
  }

  return [];
}

function buildContextAwarePrompt(aiProcessingType: string | undefined, context: TestContext, customInstruction?: string): string | undefined {
  if (customInstruction && customInstruction.trim().length > 0) {
    return customInstruction.trim();
  }

  const analyteNames = (context.analytes || [])
    .map((a) => a?.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);

  if (!analyteNames.length) {
    return undefined;
  }

  const analyteList = analyteNames.join(', ');
  const baseInstruction = `Extract or identify results for the following analytes: ${analyteList}. Return structured data with values and units where applicable.`;

  switch (aiProcessingType) {
    case 'vision_color':
      return `${baseInstruction} Focus on color-based interpretations (e.g., urine strips, reagent cards).`; 
    case 'vision_card':
      return `${baseInstruction} Determine presence/absence or band intensity for card-based rapid tests.`;
    case 'ocr_report':
      return `${baseInstruction} Use OCR to capture numeric values from tables or printed reports.`;
    default:
      return baseInstruction;
  }
}

/**
 * Call Google Cloud Vision AI Text Detection
 */
async function getVisionText(base64Image: string, apiKey: string): Promise<any> {
  // Validate base64 image
  if (!base64Image || base64Image.length === 0) {
    throw new Error('Invalid base64 image data');
  }

  // Remove data URL prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
  
  // Check if base64 is valid
  try {
    atob(cleanBase64);
  } catch (error) {
    throw new Error('Invalid base64 encoding');
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: cleanBase64,
            },
            features: [
              { type: 'DOCUMENT_TEXT_DETECTION' },
              { type: 'TEXT_DETECTION' }
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Vision API Error Details:', errorText);
    throw new Error(`Vision API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  const annotations = result.responses[0];
  
  // Check for API errors in response
  if (annotations.error) {
    throw new Error(`Vision API response error: ${annotations.error.message}`);
  }
  
  return {
    fullText: annotations.fullTextAnnotation?.text || '',
    textAnnotations: annotations.textAnnotations || [],
    confidence: annotations.textAnnotations?.[0]?.confidence || 0,
  };
}

/**
 * Call Google Cloud Vision AI Object Detection
 */
async function getVisionObjects(base64Image: string, apiKey: string): Promise<any> {
  // Validate base64 image
  if (!base64Image || base64Image.length === 0) {
    throw new Error('Invalid base64 image data');
  }

  // Remove data URL prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: cleanBase64,
            },
            features: [
              { type: 'OBJECT_LOCALIZATION', maxResults: 20 },
              { type: 'LABEL_DETECTION', maxResults: 20 }
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Vision API Error Details:', errorText);
    throw new Error(`Vision API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  const annotations = result.responses[0];
  
  // Check for API errors in response
  if (annotations.error) {
    throw new Error(`Vision API response error: ${annotations.error.message}`);
  }
  
  return {
    objects: annotations.localizedObjectAnnotations || [],
    labels: annotations.labelAnnotations || [],
    objectCount: annotations.localizedObjectAnnotations?.length || 0,
    labelCount: annotations.labelAnnotations?.length || 0,
  };
}

/**
 * Call Google Cloud Vision AI Color Detection
 */
async function getVisionColors(base64Image: string, apiKey: string): Promise<any> {
  // Validate base64 image
  if (!base64Image || base64Image.length === 0) {
    throw new Error('Invalid base64 image data');
  }

  // Remove data URL prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: cleanBase64,
            },
            features: [
              { type: 'IMAGE_PROPERTIES' }
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Vision API Error Details:', errorText);
    throw new Error(`Vision API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  const annotations = result.responses[0];
  
  // Check for API errors in response
  if (annotations.error) {
    throw new Error(`Vision API response error: ${annotations.error.message}`);
  }
  
  const colors = annotations.imagePropertiesAnnotation?.dominantColors?.colors || [];
  
  return {
    dominantColors: colors.map((colorInfo: any) => ({
      color: {
        red: colorInfo.color.red || 0,
        green: colorInfo.color.green || 0,
        blue: colorInfo.color.blue || 0
      },
      score: colorInfo.score || 0,
      pixelFraction: colorInfo.pixelFraction || 0,
      hexColor: rgbToHex(
        colorInfo.color.red || 0,
        colorInfo.color.green || 0,
        colorInfo.color.blue || 0
      )
    })),
    colorCount: colors.length
  };
}

/**
 * Helper function to convert RGB to HEX
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Get image from Supabase Storage
 */
async function getImageFromStorage(attachmentId: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }

  // Get attachment record
  const attachmentResponse = await fetch(
    `${supabaseUrl}/rest/v1/attachments?id=eq.${attachmentId}&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!attachmentResponse.ok) {
    throw new Error('Failed to fetch attachment record');
  }

  const attachments = await attachmentResponse.json();
  if (!attachments || attachments.length === 0) {
    throw new Error('Attachment not found');
  }

  const attachment = attachments[0];

  const candidateUrls = Array.from(new Set([
    typeof attachment.imagekit_url === 'string' ? attachment.imagekit_url.trim() : null,
    typeof attachment.processed_url === 'string' ? attachment.processed_url.trim() : null,
  ].filter((url) => url && url.length > 0))) as string[];

  for (const candidate of candidateUrls) {
    try {
      const processedResponse = await fetch(candidate);
      if (!processedResponse.ok) {
        continue;
      }

      const processedBuffer = await processedResponse.arrayBuffer();
      if (processedBuffer.byteLength === 0) {
        continue;
      }

      const processedBase64 = btoa(String.fromCharCode(...new Uint8Array(processedBuffer)));
      return processedBase64;
    } catch (error) {
      console.warn(`Failed to fetch processed attachment from ${candidate}`, error);
    }
  }

  // Download file from Supabase Storage
  const fileResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/attachments/${attachment.file_path}`,
    {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    }
  );

  if (!fileResponse.ok) {
    throw new Error('Failed to download file from storage');
  }

  const fileBlob = await fileResponse.blob();
  const arrayBuffer = await fileBlob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  return base64;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check for API key first - try ALLGOOGLE_KEY first, then fallback to GOOGLE_CLOUD_API_KEY
    const visionApiKey = Deno.env.get('ALLGOOGLE_KEY') || Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!visionApiKey) {
      console.error('Google API key not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Google API key not configured',
          details: 'Please set ALLGOOGLE_KEY or GOOGLE_CLOUD_API_KEY in Supabase secrets'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const {
      attachmentId,
      base64Image,
      documentType,
      testType,
      analysisType = 'all',
      aiProcessingType,
      orderId,
      testGroupId,
      analyteIds,
      batchId,
      referenceImages,
      customInstruction
    }: VisionRequest = await req.json();

    if (!attachmentId && !base64Image) {
      return new Response(
        JSON.stringify({ error: 'Missing attachmentId or base64Image' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Starting Vision AI processing for ${aiProcessingType || documentType || testType || 'unknown'} type`);

    // Get image data
    let imageData = base64Image;
    if (attachmentId && !base64Image) {
      imageData = await getImageFromStorage(attachmentId);
    }

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: 'No image data available' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const testContext = await getTestContext(orderId, testGroupId, analyteIds);
    const batchContext = await getBatchImageContext(batchId);
    const effectiveProcessingType = aiProcessingType || testContext.testGroup?.ai_processing_type || documentType || testType;
    const contextPrompt = buildContextAwarePrompt(
      typeof effectiveProcessingType === 'string' ? effectiveProcessingType : undefined,
      testContext,
      customInstruction
    );

    const batchReferenceImages = batchContext
      .filter((reference) => !!reference.fileUrl)
      .map((reference) => ({
        url: reference.fileUrl as string,
        type: 'batch',
        description: reference.description || reference.label || undefined,
      }));

    const combinedReferenceImages = [
      ...(Array.isArray(referenceImages) ? referenceImages : []),
      ...batchReferenceImages,
    ];

    if (contextPrompt) {
      console.log('Context-aware prompt generated for Vision OCR run:', contextPrompt);
    }

    const visionResults: VisionResponse = {};

    // Determine which Vision AI features to use based on document/test type
    const needsText = analysisType === 'all' || analysisType === 'text' ||
                     aiProcessingType === 'ocr_report' ||
                     ['instrument-screen', 'printed-report', 'handwritten', 'test-request-form'].includes(documentType || '');
    
    const needsObjects = analysisType === 'all' || analysisType === 'objects' ||
                        aiProcessingType === 'vision_card' ||
                        ['blood-group', 'covid-test', 'malaria-test', 'pregnancy-test', 'dengue-test'].includes(testType || '');
    
    const needsColors = analysisType === 'all' || analysisType === 'colors' ||
                       aiProcessingType === 'vision_color' ||
                       ['urine-strip', 'blood-group', 'pipette-validation'].includes(testType || documentType || '');

    // Execute Vision AI calls based on requirements
    if (needsText) {
      try {
        console.log('Performing text extraction with Vision AI...');
        const textResult = await getVisionText(imageData, visionApiKey);
        visionResults.fullText = textResult.fullText;
        visionResults.confidence = textResult.confidence;
        console.log(`Text extraction completed. Extracted ${textResult.fullText.length} characters`);
      } catch (error) {
        console.error('Text extraction failed:', error);
        visionResults.error = `Text extraction failed: ${error.message}`;
      }
    }

    if (needsObjects) {
      try {
        console.log('Performing object detection with Vision AI...');
        const objectResult = await getVisionObjects(imageData, visionApiKey);
        visionResults.objects = objectResult.objects;
        console.log(`Object detection completed. Found ${objectResult.objectCount} objects`);
      } catch (error) {
        console.error('Object detection failed:', error);
        if (!visionResults.error) visionResults.error = `Object detection failed: ${error.message}`;
      }
    }

    if (needsColors) {
      try {
        console.log('Performing color analysis with Vision AI...');
        const colorResult = await getVisionColors(imageData, visionApiKey);
        visionResults.colors = colorResult.dominantColors;
        console.log(`Color analysis completed. Found ${colorResult.colorCount} dominant colors`);
      } catch (error) {
        console.error('Color analysis failed:', error);
        if (!visionResults.error) visionResults.error = `Color analysis failed: ${error.message}`;
      }
    }

    // Add metadata
    const responseData = {
      ...visionResults,
      originalBase64Image: imageData,
      testContext,
      batchContext,
      referenceImages: combinedReferenceImages,
      promptUsed: contextPrompt,
      metadata: {
        documentType: documentType || testType || aiProcessingType,
        aiProcessingType: aiProcessingType || null,
        analysisType,
        featuresUsed: {
          text: needsText,
          objects: needsObjects,
          colors: needsColors
        },
        processingTimestamp: new Date().toISOString(),
        attachmentId: attachmentId || null,
        orderId: orderId || null,
        testGroupId: testGroupId || testContext.testGroup?.id || null,
        analyteIds: Array.isArray(analyteIds) ? analyteIds : (testContext.analytes?.map((a) => a.id).filter(Boolean) || []),
        batchId: batchId || null,
        referenceImageCount: combinedReferenceImages.length,
        contextPrompt,
      }
    };

    // Update attachment with AI processing metadata if attachmentId provided
    if (attachmentId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseServiceKey) {
        try {
          await fetch(
            `${supabaseUrl}/rest/v1/attachments?id=eq.${attachmentId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ai_processed: !visionResults.error,
                ai_confidence: visionResults.confidence || null,
                processing_status: visionResults.error ? 'failed' : 'processed',
                ai_processed_at: new Date().toISOString(),
                ai_processing_type: aiProcessingType || documentType || testType,
                ai_metadata: {
                  vision_features_used: {
                    text: needsText,
                    objects: needsObjects,
                    colors: needsColors
                  },
                  text_length: visionResults.fullText?.length || 0,
                  objects_count: visionResults.objects?.length || 0,
                  colors_count: visionResults.colors?.length || 0,
                  error: visionResults.error || null,
                  order_id: orderId || null,
                  test_group_id: testGroupId || testContext.testGroup?.id || null,
                  batch_id: responseData.metadata?.batchId || batchId || null,
                  context_prompt: contextPrompt || null,
                  reference_image_count: combinedReferenceImages.length,
                  analyte_ids: Array.isArray(responseData.metadata?.analyteIds)
                    ? responseData.metadata.analyteIds
                    : [],
                }
              })
            }
          );
          console.log(`Updated attachment ${attachmentId} with AI processing metadata`);
        } catch (updateError) {
          console.error('Failed to update attachment metadata:', updateError);
          // Don't fail the request if metadata update fails
        }
      }
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Vision OCR function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Vision processing failed', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});