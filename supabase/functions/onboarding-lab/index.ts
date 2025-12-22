
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse Input
    const { lab_id } = await req.json();
    if (!lab_id) {
      throw new Error('lab_id is required');
    }

    // 2. Init Supabase Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🚀 Starting ROBUST onboarding for Lab: ${lab_id}`);

    // --- Counters for Logging ---
    let stats = {
      analytesHydrated: 0,
      testsCreated: 0,
      testsSkipped: 0,
      templatesCloned: 0,
      packagesCreated: 0
    };

    // --- A. Hydrate Analytes (Safe Upsert) ---
    console.log('...Hydrating Analytes');
    const { data: globalAnalytes } = await supabaseClient.from('analytes').select('id').eq('is_global', true);

    if (globalAnalytes && globalAnalytes.length > 0) {
      stats.analytesHydrated = globalAnalytes.length;
      console.log(`   Found ${globalAnalytes.length} global analytes to sync.`);
      
      const labAnalytesPayload = globalAnalytes.map(ga => ({
        lab_id: lab_id,
        analyte_id: ga.id,
        is_active: true,
        visible: true // visible in catalog
      }));
      // On Conflict: Do nothing or Update? Upsert ensures they exist.
      const { error: laError } = await supabaseClient
        .from('lab_analytes')
        .upsert(labAnalytesPayload, { onConflict: 'lab_id,analyte_id', ignoreDuplicates: true });
      
      if (laError) console.error('Error hydrating analytes:', laError);
    }

    // --- B. Hydrate Test Groups (Check First) ---
    console.log('...Hydrating Test Groups');
    const { data: globalTestGroups } = await supabaseClient.from('global_test_catalog').select('*');

    if (globalTestGroups) {
      console.log(`   Found ${globalTestGroups.length} global test groups.`);
      
      for (const gtg of globalTestGroups) {
        // 1. Check Existence
        const { data: existingTg } = await supabaseClient
            .from('test_groups')
            .select('id')
            .eq('lab_id', lab_id)
            .eq('code', gtg.code)
            .maybeSingle();

        let testGroupId = existingTg?.id;

        if (!existingTg) {
           // Create test group with AI configuration from global catalog
           const { data: newTg, error: tgError } = await supabaseClient
            .from('test_groups')
            .insert({
              lab_id: lab_id,
              name: gtg.name,
              code: gtg.code,
              category: gtg.department_default || gtg.category || 'General',
              clinical_purpose: gtg.description || gtg.name,
              price: gtg.default_price || 0,
              turnaround_time: '24 Hours',
              sample_type: gtg.specimen_type_default || 'EDTA Blood', // Use specimen from global catalog
              is_active: true,
              to_be_copied: false,
              // AI Configuration from global catalog
              default_ai_processing_type: gtg.default_ai_processing_type || 'ocr_report',
              group_level_prompt: gtg.group_level_prompt || null,
              ai_config: gtg.ai_config || {}
            })
            .select('id')
            .single();

           if (tgError) {
             console.error(`Failed to create test group ${gtg.code}:`, tgError);
             continue;
           }
           testGroupId = newTg.id;
           stats.testsCreated++;
           const aiType = gtg.default_ai_processing_type || 'ocr_report';
           console.log(`   ✅ Created Test Group: ${gtg.code} (AI: ${aiType}, Specimen: ${gtg.specimen_type_default || 'EDTA Blood'})`);

           // Link Analytes (Only for NEW tests)
           const analyteIds = gtg.analytes; 
           if (Array.isArray(analyteIds) && analyteIds.length > 0) {
             const linksPayload = analyteIds.map((aid: string) => ({
               test_group_id: testGroupId,
               analyte_id: aid,
               is_visible: true
             }));
             await supabaseClient.from('test_group_analytes').insert(linksPayload);
           }
        } else {
           stats.testsSkipped++;
           // console.log(`   ⏩ Skipped existing Test Group: ${gtg.code}`);
        }

        // 2. Clone Template (Link if exists or create)
        if (gtg.default_template_id && testGroupId) {
             // Check if lab_template exists for this test_group
             const { data: existingTmpl } = await supabaseClient
                .from('lab_templates')
                .select('id')
                .eq('lab_id', lab_id)
                .eq('test_group_id', testGroupId)
                .maybeSingle();
             
             if (!existingTmpl) {
                 const { data: globalTmpl } = await supabaseClient
                    .from('global_template_catalog')
                    .select('*')
                    .eq('id', gtg.default_template_id)
                    .single();
                 
                 if (globalTmpl) {
                     await supabaseClient.from('lab_templates').insert({
                         lab_id: lab_id,
                         test_group_id: testGroupId,
                         template_name: `Report - ${gtg.name}`,
                         category: 'report',
                         gjs_html: globalTmpl.html_content,
                         gjs_css: globalTmpl.css_content,
                         is_default: false, // Critical to avoid Constraint Error
                         is_active: true
                     });
                     stats.templatesCloned++;
                     console.log(`   📄 Cloned Template for ${gtg.code}`);
                 }
             }
        }
      }
    }

    // --- C. Hydrate Packages (Check First) ---
    console.log('...Hydrating Packages');
    const { data: globalPackages } = await supabaseClient.from('global_package_catalog').select('*');
    
    if (globalPackages) {
      console.log(`   Found ${globalPackages.length} global packages.`);
      for (const gp of globalPackages) {
         const { data: existingPkg } = await supabaseClient
            .from('packages')
            .select('id')
            .eq('lab_id', lab_id)
            .eq('name', gp.name) // Assuming Name is unique identifier for package syncing
            .maybeSingle();

         if (!existingPkg) {
            const { data: newPkg, error: pkgError } = await supabaseClient
              .from('packages')
              .insert({
                lab_id: lab_id,
                name: gp.name,
                description: gp.description || gp.name,
                category: 'General',
                price: gp.base_price || 0,
                is_active: true
              })
              .select('id')
              .single();

            if (pkgError) {
               console.error(`Failed to create package ${gp.name}:`, pkgError);
               continue;
            }
            stats.packagesCreated++;

            // Link Test Groups
            const codes = gp.test_group_codes; 
            if (Array.isArray(codes) && codes.length > 0) {
               const { data: labTestGroups } = await supabaseClient
                 .from('test_groups')
                 .select('id')
                 .eq('lab_id', lab_id)
                 .in('code', codes);

               if (labTestGroups && labTestGroups.length > 0) {
                 const pkgLinks = labTestGroups.map(bg => ({
                   package_id: newPkg.id,
                   test_group_id: bg.id
                 }));
                 await supabaseClient.from('package_test_groups').insert(pkgLinks);
               }
            }
         }
      }
    }
    
    // --- D. Global Templates (Generic) ---
    // Skipping generic for now to reduce noise as per previous logic
    
    console.log(`✅ Onboarding Complete. Stats:`, stats);

    return new Response(
      JSON.stringify({ message: 'Onboarding complete', lab_id, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Onboarding error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
