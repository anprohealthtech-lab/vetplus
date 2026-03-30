$Target = "upstream/main"
$argsToPass = $args
$exclusions = @(
    ':(exclude)src/App.tsx',
    ':(exclude)src/components/Auth/Login.tsx',
    ':(exclude)src/components/Auth/ProtectedPatientRoute.tsx',
    ':(exclude)src/components/Layout/Header.tsx',
    ':(exclude)src/components/Layout/Sidebar.tsx',
    ':(exclude)src/pages/PatientLogin.tsx',
    ':(exclude)src/pages/PatientPortal.tsx',
    ':(exclude)src/utils/patientAuth.ts',
    ':(exclude)src/utils/supabase.ts',
    ':(exclude)src/index.css',
    ':(exclude)src/components/Settings/LabBillingItemSettings.tsx',
    ':(exclude)src/components/Settings/PatientPortalSettings.tsx',
    ':(exclude)src/components/Settings/PriceMasterSettings.tsx',
    ':(exclude)src/pages/B2BLogin.tsx',
    ':(exclude)src/pages/B2BPortal.tsx'
)

# Any other arguments passed to the script (like --stat, --name-only, etc)
$argsToPass = $args

Write-Host "Comparing src folder against $Target (excluding branding files)..." -ForegroundColor Cyan

# Execute git diff
git diff $Target $argsToPass -- src/ $exclusions
