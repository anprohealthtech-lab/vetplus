// Local storage utilities for LIMS data persistence

export interface Analyte {
  id: string;
  name: string;
  unit: string;
  referenceRange: string;
  lowCritical?: string;
  highCritical?: string;
  interpretation: {
    low: string;
    normal: string;
    high: string;
  };
  category: string;
  isActive: boolean;
  createdDate: string;
  aiProcessingType?: string;
  aiPromptOverride?: string;
  groupAiMode?: 'group_only' | 'individual' | 'both';
}

export interface TestGroup {
  id: string;
  name: string;
  code: string;
  category: string;
  clinicalPurpose: string;
  analytes: string[]; // Array of analyte IDs
  price: number;
  turnaroundTime: string;
  sampleType: string;
  requiresFasting: boolean;
  isActive: boolean;
  createdDate: string;
  default_ai_processing_type?: string;
  group_level_prompt?: string;
}

export interface Test {
  id: string;
  name: string;
  category: string;
  method: string;
  sampleType: string;
  price: number;
  turnaroundTime: string;
  referenceRange: string;
  units: string;
  description: string;
  isActive: boolean;
  requiresFasting: boolean;
  criticalValues: string;
  interpretation: string;
  createdDate: string;
}

export interface Result {
  id: string;
  orderId: string;
  patientName: string;
  patientId: string;
  testName: string;
  status: 'Entered' | 'Under Review' | 'Approved' | 'Reported';
  enteredBy: string;
  enteredDate: string;
  reviewedBy?: string;
  reviewedDate?: string;
  values: { parameter: string; value: string; unit: string; reference: string; flag?: string }[];
  attachmentId?: string; // Link to source document for OCR-extracted results
}

export interface Report {
  id: string;
  patientName: string;
  patientId: string;
  resultId?: string;
  tests: string[];
  generatedDate: string;
  status: 'Generated' | 'Delivered' | 'Printed';
  doctor: string;
  reportType: 'Standard' | 'Detailed' | 'Summary';
}

export interface Package {
  id: string;
  name: string;
  description: string;
  testGroupIds: string[]; // Array of TestGroup IDs
  price: number;
  discountPercentage?: number;
  isActive: boolean;
  createdDate: string;
  category: string;
  validityDays?: number;
}

// Storage keys
const STORAGE_KEYS = {
  ANALYTES: 'lims_analytes',
  TEST_GROUPS: 'lims_test_groups',
  TESTS: 'lims_tests',
  RESULTS: 'lims_results',
  PACKAGES: 'lims_packages',
};

// Generic storage functions
export const saveToStorage = <T>(key: string, data: T[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const loadFromStorage = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return [];
  }
};

// Analyte storage functions
export const saveAnalytes = (analytes: Analyte[]): void => {
  saveToStorage(STORAGE_KEYS.ANALYTES, analytes);
};

export const loadAnalytes = (): Analyte[] => {
  return loadFromStorage<Analyte>(STORAGE_KEYS.ANALYTES);
};

export const addAnalyte = (analyte: Omit<Analyte, 'id' | 'createdDate'>): Analyte => {
  const analytes = loadAnalytes();
  const newAnalyte: Analyte = {
    ...analyte,
    id: `ANL${String(Date.now()).slice(-6)}`,
    createdDate: new Date().toISOString().split('T')[0],
    aiProcessingType: analyte.aiProcessingType || 'ocr_report',
    aiPromptOverride: analyte.aiPromptOverride || undefined,
    groupAiMode: analyte.groupAiMode || 'individual',
  };
  
  const updatedAnalytes = [...analytes, newAnalyte];
  saveAnalytes(updatedAnalytes);
  return newAnalyte;
};

// Test Group storage functions
export const saveTestGroups = (testGroups: TestGroup[]): void => {
  saveToStorage(STORAGE_KEYS.TEST_GROUPS, testGroups);
};

export const loadTestGroups = (): TestGroup[] => {
  return loadFromStorage<TestGroup>(STORAGE_KEYS.TEST_GROUPS);
};

export const addTestGroup = (testGroup: Omit<TestGroup, 'id' | 'createdDate'>): TestGroup => {
  const testGroups = loadTestGroups();
  const newTestGroup: TestGroup = {
    ...testGroup,
    id: `TGP${String(Date.now()).slice(-6)}`,
    createdDate: new Date().toISOString().split('T')[0],
  };
  
  const updatedTestGroups = [...testGroups, newTestGroup];
  saveTestGroups(updatedTestGroups);
  return newTestGroup;
};

// Test storage functions
export const saveTests = (tests: Test[]): void => {
  saveToStorage(STORAGE_KEYS.TESTS, tests);
};

export const loadTests = (): Test[] => {
  return loadFromStorage<Test>(STORAGE_KEYS.TESTS);
};

export const addTest = (test: Omit<Test, 'id' | 'createdDate'>): Test => {
  const tests = loadTests();
  const newTest: Test = {
    ...test,
    id: `TST${String(Date.now()).slice(-6)}`,
    createdDate: new Date().toISOString().split('T')[0],
  };
  
  const updatedTests = [...tests, newTest];
  saveTests(updatedTests);
  return newTest;
};

// Result storage functions
export const saveResults = (results: Result[]): void => {
  saveToStorage(STORAGE_KEYS.RESULTS, results);
};

export const loadResults = (): Result[] => {
  return loadFromStorage<Result>(STORAGE_KEYS.RESULTS);
};

export const addResult = (result: Omit<Result, 'id'>): Result => {
  const results = loadResults();
  const newResult: Result = {
    ...result,
    id: `RES${String(Date.now()).slice(-6)}`,
  };
  
  const updatedResults = [...results, newResult];
  saveResults(updatedResults);
  return newResult;
};

// Package storage functions
export const savePackages = (packages: Package[]): void => {
  saveToStorage(STORAGE_KEYS.PACKAGES, packages);
};

export const loadPackages = (): Package[] => {
  return loadFromStorage<Package>(STORAGE_KEYS.PACKAGES);
};

export const addPackage = (packageData: Omit<Package, 'id' | 'createdDate'>): Package => {
  const packages = loadPackages();
  const newPackage: Package = {
    ...packageData,
    id: `PKG${String(Date.now()).slice(-6)}`,
    createdDate: new Date().toISOString().split('T')[0],
  };
  
  const updatedPackages = [...packages, newPackage];
  savePackages(updatedPackages);
  return newPackage;
};

// Initialize with mock data if storage is empty
export const initializeStorage = (): void => {
  const analytes = loadAnalytes();
  const testGroups = loadTestGroups();
  const tests = loadTests();
  const packages = loadPackages();

  // Initialize analytes if empty
  if (analytes.length === 0) {
    const mockAnalytes: Analyte[] = [
      // CBC Analytes
      {
        id: 'ANL001',
        name: 'Hemoglobin',
        unit: 'g/dL',
        referenceRange: 'M: 13.5-17.5, F: 12.0-16.0',
        lowCritical: '7.0',
        highCritical: '20.0',
        interpretation: {
          low: 'Anemia, blood loss, nutritional deficiency',
          normal: 'Normal oxygen-carrying capacity',
          high: 'Polycythemia, dehydration, smoking'
        },
        category: 'Hematology',
        isActive: true,
        createdDate: '2024-01-01',
        aiProcessingType: 'ocr_report',
      },
      {
        id: 'ANL002',
        name: 'WBC Count',
        unit: '/μL',
        referenceRange: '4,000-11,000',
        lowCritical: '2,000',
        highCritical: '30,000',
        interpretation: {
          low: 'Immunosuppression, bone marrow disorder',
          normal: 'Normal immune function',
          high: 'Infection, inflammation, leukemia'
        },
        category: 'Hematology',
        isActive: true,
        createdDate: '2024-01-01',
        aiProcessingType: 'ocr_report',
      },
      {
        id: 'ANL003',
        name: 'Platelet Count',
        unit: '/μL',
        referenceRange: '150,000-450,000',
        lowCritical: '50,000',
        highCritical: '1,000,000',
        interpretation: {
          low: 'Bleeding risk, thrombocytopenia',
          normal: 'Normal clotting function',
          high: 'Thrombosis risk, myeloproliferative disorder'
        },
        category: 'Hematology',
        isActive: true,
        createdDate: '2024-01-01',
        aiProcessingType: 'ocr_report',
      },
      // Liver Function Analytes
      {
        id: 'ANL004',
        name: 'SGOT (AST)',
        unit: 'U/L',
        referenceRange: '10-40',
        lowCritical: '',
        highCritical: '200',
        interpretation: {
          low: 'Not clinically significant',
          normal: 'Normal liver function',
          high: 'Liver damage, muscle damage, heart attack'
        },
        category: 'Biochemistry',
        isActive: true,
        createdDate: '2024-01-01',
        aiProcessingType: 'ocr_report',
      },
      {
        id: 'ANL005',
        name: 'SGPT (ALT)',
        unit: 'U/L',
        referenceRange: '7-56',
        lowCritical: '',
        highCritical: '200',
        interpretation: {
          low: 'Not clinically significant',
          normal: 'Normal liver function',
          high: 'Liver damage, hepatitis, medication toxicity'
        },
        category: 'Biochemistry',
        isActive: true,
        createdDate: '2024-01-01',
        aiProcessingType: 'ocr_report',
      },
      // Lipid Profile Analytes
      {
        id: 'ANL006',
        name: 'Total Cholesterol',
        unit: 'mg/dL',
        referenceRange: '<200',
        lowCritical: '',
        highCritical: '300',
        interpretation: {
          low: 'Low cardiovascular risk',
          normal: 'Desirable level',
          high: 'Increased cardiovascular risk'
        },
        category: 'Biochemistry',
        isActive: true,
        createdDate: '2024-01-01',
        aiProcessingType: 'ocr_report',
      },
      {
        id: 'ANL007',
        name: 'HDL Cholesterol',
        unit: 'mg/dL',
        referenceRange: 'M: >40, F: >50',
        lowCritical: '20',
        highCritical: '',
        interpretation: {
          low: 'Increased cardiovascular risk',
          normal: 'Protective against heart disease',
          high: 'Very protective, excellent'
        },
        category: 'Biochemistry',
        isActive: true,
        createdDate: '2024-01-01',
        aiProcessingType: 'ocr_report',
      },
      {
        id: 'ANL008',
        name: 'LDL Cholesterol',
        unit: 'mg/dL',
        referenceRange: '<100',
        lowCritical: '',
        highCritical: '190',
        interpretation: {
          low: 'Low cardiovascular risk',
          normal: 'Optimal level',
          high: 'Increased cardiovascular risk'
        },
        category: 'Biochemistry',
        isActive: true,
        createdDate: '2024-01-01',
        aiProcessingType: 'ocr_report',
      },
    ];
    saveAnalytes(mockAnalytes);
  }

  // Initialize test groups if empty
  if (testGroups.length === 0) {
    const mockTestGroups: TestGroup[] = [
      {
        id: 'TGP001',
        name: 'Complete Blood Count (CBC)',
        code: 'CBC',
        category: 'Hematology',
        clinicalPurpose: 'Evaluate overall health and detect blood disorders, infections, anemia, and leukemia',
        analytes: ['ANL001', 'ANL002', 'ANL003'],
        price: 350,
        turnaroundTime: '2-4 hours',
        sampleType: 'EDTA Blood',
        requiresFasting: false,
        isActive: true,
        createdDate: '2024-01-01',
      },
      {
        id: 'TGP002',
        name: 'Liver Function Test (LFT)',
        code: 'LFT',
        category: 'Biochemistry',
        clinicalPurpose: 'Assess liver health and detect liver diseases, hepatitis, and drug toxicity',
        analytes: ['ANL004', 'ANL005'],
        price: 450,
        turnaroundTime: '4-6 hours',
        sampleType: 'Serum',
        requiresFasting: false,
        isActive: true,
        createdDate: '2024-01-01',
      },
      {
        id: 'TGP003',
        name: 'Lipid Profile',
        code: 'LIPID',
        category: 'Biochemistry',
        clinicalPurpose: 'Assess cardiovascular risk and monitor cholesterol levels',
        analytes: ['ANL006', 'ANL007', 'ANL008'],
        price: 500,
        turnaroundTime: '4-6 hours',
        sampleType: 'Serum',
        requiresFasting: true,
        isActive: true,
        createdDate: '2024-01-01',
      },
    ];
    saveTestGroups(mockTestGroups);
  }

  if (tests.length === 0) {
    const mockTests: Test[] = [
      {
        id: 'TST001',
        name: 'Complete Blood Count (CBC)',
        category: 'Hematology',
        method: 'Automated Cell Counter',
        sampleType: 'EDTA Blood',
        price: 350,
        turnaroundTime: '2-4 hours',
        referenceRange: 'Age/Gender specific',
        units: 'Various',
        description: 'Complete blood count with differential',
        isActive: true,
        requiresFasting: false,
        criticalValues: 'WBC <2.0 or >30.0',
        interpretation: 'Evaluates overall health and detects blood disorders',
        createdDate: '2024-01-01',
      },
      {
        id: 'TST002',
        name: 'Lipid Profile',
        category: 'Biochemistry',
        method: 'Enzymatic',
        sampleType: 'Serum',
        price: 450,
        turnaroundTime: '4-6 hours',
        referenceRange: 'Multiple parameters',
        units: 'mg/dL',
        description: 'Cholesterol and triglyceride levels',
        isActive: true,
        requiresFasting: true,
        criticalValues: 'Total Cholesterol >300',
        interpretation: 'Assesses cardiovascular risk',
        createdDate: '2024-01-01',
      },
    ];
    saveTests(mockTests);
  }

  // Initialize reports if empty

  // Initialize packages if empty
  if (packages.length === 0) {
    const mockPackages: Package[] = [
      {
        id: 'PKG001',
        name: 'Basic Health Checkup',
        description: 'Comprehensive basic health screening package including blood work and essential tests',
        testGroupIds: ['TGP001', 'TGP002'], // CBC + LFT
        price: 750,
        discountPercentage: 10,
        category: 'Preventive Care',
        validityDays: 30,
        isActive: true,
        createdDate: '2024-01-01',
      },
      {
        id: 'PKG002',
        name: 'Executive Health Package',
        description: 'Complete executive health screening with cardiovascular and metabolic assessments',
        testGroupIds: ['TGP001', 'TGP002', 'TGP003'], // CBC + LFT + Lipid Profile
        price: 1200,
        discountPercentage: 15,
        category: 'Executive Care',
        validityDays: 45,
        isActive: true,
        createdDate: '2024-01-01',
      },
      {
        id: 'PKG003',
        name: 'Cardiac Risk Assessment',
        description: 'Specialized package for cardiovascular health evaluation',
        testGroupIds: ['TGP003'], // Lipid Profile
        price: 600,
        discountPercentage: 5,
        category: 'Cardiac Care',
        validityDays: 30,
        isActive: true,
        createdDate: '2024-01-01',
      },
    ];
    savePackages(mockPackages);
  }
};