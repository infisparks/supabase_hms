export type AppointmentType = "visithospital" | "oncall"
export type Gender = "male" | "female" | "other"
export type AgeUnit = "year" | "month" | "day" // Consistent with 'year'

export interface IFormInput {
  name: string
  phone: string
  age?: number
  ageUnit: AgeUnit
  gender: string
  address?: string
  date: Date // For form, will be converted to string for DB
  time: string
  paymentMethod: "cash" | "online" | "mixed" | "card-credit" | "card-debit"
  cashAmount?: number
  onlineAmount?: number
  discount?: number
  doctor?: string // ID of the doctor
  specialist?: string
  referredBy?: string
  additionalNotes?: string
  appointmentType: AppointmentType
  opdType: string // "OPD" or "On-Call"
  modalities: ModalitySelection[] // Array of services
  visitType?: "first" | "followup" // For consultation
  study?: string // Specific study name
  onlineThrough?: "upi" | "card-debit" | "card-credit" | "netbanking" | "wallet"
  cashThrough?: "cash"
  uhid?: string // UHID can be pre-filled or generated
}

export interface ModalitySelection {
  id: string // Client-side unique ID for React keys
  type: "consultation" | "casualty" | "xray" | "pathology" | "ipd" | "radiology" | "custom" | "cardiology"
  charges: number
  doctor: string // CHANGED: Made doctor compulsory for all modalities here
  doctorId?: string // Optional: used for dropdown selection only
  doctor_name?: string // Added for easier bill generation
  specialist?: string // For consultation
  visitType?: "first" | "followup" // For consultation
  service?: string // For specific services/studies or custom service name
}

// Represents a patient record as fetched from Supabase's patient_detail table
export interface PatientDetail {
  patient_id: number // Supabase auto-incremented primary key
  name: string
  number: string // Phone number (string if stored as text, or number if stored as bigint/numeric)
  age?: number
  age_unit?: AgeUnit
  dob?: string // Date of birth (YYYY-MM-DD)
  gender?: string
  address?: string
  uhid: string // Unique Hospital ID
  created_at?: string // Kept as optional, as it might exist as auto-managed
  updated_at?: string // Kept as optional, as it might exist as auto-managed
}

// Represents a doctor record as fetched from Supabase's doctor table
export interface Doctor {
  opd_charge(index: number, arg1: string, opd_charge: any): unknown
  id: string // Doctor's unique ID
  dr_name: string // Doctor's name
  department: string
  specialist: string[]
  charges: {
    // Matches Supabase JSONB structure
    firstVisitCharge: number
    followUpCharge: number
    ipdCharges?: {
      casualty: number
      delux: number
      female: number
      icu: number
      male: number
      nicu: number
      suit: number
    }
  }[] // Array of charge objects (assuming structure)
}

// Represents an On-Call Appointment record from Supabase's opd_oncall table
export interface OnCallAppointment {
  oncall_id: string // Primary key of oncall appointment
  patient_id: number // Foreign key to patient_detail
  uhid: string // UHID associated with the on-call patient
  date: string // Date of on-call (YYYY-MM-DD)
  time: string // Time of on-call
  referredBy: string // Who referred the patient
  additional_notes: string
  entered_by?: string // User who entered (made optional as it might be system-set or absent)
  created_at?: string // Made optional
  // Optional: joined patient detail for display
  patient_detail?: PatientDetail // Changed this line
  // Added for bookOnCallToOPD to pre-fill service if available
  modality_type?: ModalitySelection["type"]
  service_name?: string
  specialist?: string
  visitType?: "first" | "followup"
}

// Represents an OPD Registration record from Supabase's opd_registration table
export interface OPDRegistration {
  opd_id: number // Primary key for OPD registration
  patient_id: number // Foreign key to patient_detail
  uhid: string // UHID of the patient
  bill_no: number // Bill number
  date: string // Date of registration (YYYY-MM-DD)
  refer_by?: string
  "additional Notes"?: string // Matches column name with space
  service_info: ModalitySelection[] // JSONB array of services
  payment_info: {
    // JSONB object of payment details
    paymentMethod: "cash" | "online" | "mixed" 
    totalCharges: number
    discount: number
    totalPaid: number
    cashAmount: number
    onlineAmount: number
    cashThrough?: string
    onlineThrough?: string
    createdAt: string // This might be auto-managed or not exist, remove from DB insert
  }
  created_at?: string // Made optional
}

// Structure for individual service options (e.g., in XRayStudyOptions)
export interface ServiceOption {
  service: string
  amount: number
}

// Options for various form fields
export const PaymentOptions = [
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },

  { value: "mixed", label: "Cash + Online" },
]

export const GenderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
]

export const ModalityOptions = [
  { value: "consultation", label: "Consultation" },
  { value: "xray", label: "X-Ray" },
  { value: "pathology", label: "Pathology" },
  { value: "ipd", label: "IPD" },
  { value: "radiology", label: "Radiology" },
  { value: "casualty", label: "Casualty" },
  { value: "cardiology", label: "Cardiology" },
  { value: "custom", label: "Custom Service" },
]

export const AgeUnitOptions = [
  { value: "year", label: "Years" },
  { value: "month", label: "Months" },
  { value: "day", label: "Days" },
]

export const OnlineThroughOptions = [
  { value: "upi", label: "UPI" },
  { value: "card-debit", label: "Debit Card" },
  { value: "card-credit", label: "Credit Card" },
  { value: "netbanking", label: "Net Banking" },
  { value: "wallet", label: "Digital Wallet" },
]

export const CashThroughOptions = [{ value: "cash", label: "Cash" }]

// Specific service lists
export const CardiologyStudyOptions: ServiceOption[] = [
  { service: "ECG", amount: 300 },
  { service: "ECHO Cardiography", amount: 1500 },
  { service: "TMT", amount: 2000 },
  { service: "Holter Monitoring", amount: 2500 },
  { service: "Angiography", amount: 10000 },
  { service: "Angioplasty", amount: 50000 },
]

export const XRayStudyOptions: ServiceOption[] = [
  { service: "CHEST PA", amount: 300 },
  { service: "CHEST AP,PA,LAT,OBL", amount: 400 },
  { service: "ABDOMEN AP", amount: 350 },
  { service: "SKULL AP/LAT", amount: 400 },
  { service: "MASTOID", amount: 450 },
  { service: "ADENOID", amount: 350 },
  { service: "NASAL BONE", amount: 300 },
  { service: "NASOPHRANX", amount: 350 },
  { service: "TM JOINT LAT", amount: 400 },
  { service: "TM JOINT AP/LAT", amount: 450 },
  { service: "CERVICA SPINE AP/LAT", amount: 500 },
  { service: "DORSAL SPINE AP/LAT", amount: 500 },
  { service: "LUMBAR SPINE AP/LAT", amount: 500 },
  { service: "LUMBAR SPINE FLX/EXT", amount: 550 },
  { service: "SACRUM-COCCYX AP/LAT", amount: 450 },
  { service: "PBH-AP", amount: 400 },
  { service: "PBH AP/LAT", amount: 450 },
  { service: "PBH AP/LAT VIEW (BOTH LAT)", amount: 500 },
  { service: "FEMUR AP/LAT", amount: 400 },
  { service: "BOTH FEMUR AP/LAT", amount: 600 },
  { service: "KNEE JOINT AP/LAT", amount: 350 },
  { service: "BOTH KNEE JOINT AP/LAT", amount: 550 },
  { service: "LEG AP/LAT", amount: 350 },
  { service: "BOTH LEG AP/LAT", amount: 550 },
  { service: "ANKLE AP/LAT", amount: 300 },
  { service: "BOTH ANKLE AP/LAT", amount: 500 },
  { service: "FOOT AP/LAT", amount: 300 },
  { service: "BOTH FOOT AP/LAT", amount: 500 },
  { service: "TOE AP/LAT", amount: 250 },
  { service: "HAND AP/LAT", amount: 300 },
  { service: "ELBOW AP/LAT", amount: 300 },
  { service: "FOREARM AP/LAT", amount: 350 },
  { service: "FINGER AP/LAT", amount: 250 },
  { service: "KUB", amount: 400 },
  { service: "PNS", amount: 350 },
  { service: "PNS (CALDWELL / WATERS)", amount: 400 },
  { service: "HSG", amount: 1500 },
  { service: "IVP", amount: 2000 },
  { service: "BMFT", amount: 1800 },
  { service: "BM SWALLOW", amount: 1200 },
  { service: "IgE LEVEL", amount: 800 },
  { service: "2D ECHO OPD with Consultation", amount: 1500 },
  { service: "2D ECHO IPD with Consultation", amount: 1800 },
  { service: "2D ECHO OPD without Consultation", amount: 1200 },
  { service: "2D ECHO IPD without Consultation", amount: 1500 },
]

export const PathologyStudyOptions: ServiceOption[] = [
  { service: "Absolute Eosinophils count blood", amount: 200 },
  { service: "Acid Phosphatase total Serum", amount: 250 },
  { service: "ALBUMIN 24 HRS URINE", amount: 300 },
  { service: "ALBUMIN", amount: 150 },
  { service: "Albumin or Creatinine Ratio", amount: 350 },
  { service: "ALKALINE PO4", amount: 200 },
  { service: "Alfa Feto Protein Serum", amount: 800 },
  { service: "AMYLASE", amount: 300 },
  { service: "ANA ELISA", amount: 900 },
  { service: "Anti Cardiolipin IgG", amount: 1200 },
  { service: "Anti Cardiolipin IgM", amount: 1200 },
  { service: "Anti ds DNA", amount: 1000 },
  { service: "Anti D Titre Rh Titre", amount: 800 },
  { service: "HBsAg Vidas", amount: 400 },
  { service: "Australia Antigen", amount: 350 },
  { service: "BETA HCG (LMP REQUIRE)", amount: 600 },
  { service: "Bile salt and pigments urine qualitative", amount: 250 },
  { service: "BILIRUBIN", amount: 200 },
  { service: "PAP", amount: 800 },
  { service: "BT and CT", amount: 200 },
  { service: "BUN", amount: 150 },
  { service: "CA 125", amount: 1200 },
  { service: "CALCIUM", amount: 200 },
  { service: "COMPLETE BLOOD COUNT (HAEMOGRAM) CBC", amount: 300 },
  { service: "CHOLESTEROL", amount: 150 },
  { service: "Cholesterol LDL Direct", amount: 250 },
  { service: "CK MB", amount: 400 },
  { service: "CMV IgG", amount: 800 },
  { service: "CMV IgM", amount: 800 },
  { service: "Coombs Direct", amount: 350 },
  { service: "Coombs Indirect", amount: 350 },
  { service: "CPK", amount: 400 },
  { service: "CREATININ", amount: 150 },
  { service: "CRP (C-Reactive Protein)", amount: 350 },
  { service: "Dengue IgG", amount: 600 },
  { service: "Dengue IgM", amount: 600 },
  { service: "ELECTROLYTES", amount: 400 },
  { service: "Electrolytes Urine", amount: 450 },
  { service: "ESR", amount: 100 },
  { service: "Faeces Examination", amount: 150 },
  { service: "FDP D Dimer", amount: 1200 },
  { service: "Fibrinogen", amount: 800 },
  { service: "Free T3", amount: 350 },
  { service: "Free T4", amount: 350 },
  { service: "Free T3 or Free T4 or TSH", amount: 900 },
  { service: "G6PD Qualitative", amount: 600 },
  { service: "G6PD Quantitative", amount: 800 },
  { service: "Glucose Fasting", amount: 100 },
  { service: "Glycosylated Haemoglobin", amount: 500 },
  { service: "GTT 3 Readings", amount: 350 },
  { service: "Haemoglobin and PCV", amount: 150 },
  { service: "HBc Total Antibody", amount: 800 },
  { service: "HBc IgM Antibody", amount: 800 },
  { service: "HBe Antibody", amount: 800 },
  { service: "HBeAg", amount: 800 },
  { service: "HBsAg Antibody", amount: 400 },
  { service: "HBV DNA Quantitative Viral Load", amount: 3500 },
  { service: "HBV DNA Qualitative", amount: 2500 },
  { service: "HDL Cholesterol", amount: 200 },
  { service: "HIV IandII", amount: 400 },
  { service: "Malarial Antibody", amount: 600 },
  { service: "Malaria Antigen", amount: 400 },
  { service: "MP (Malarial Parasite)", amount: 150 },
  { service: "PAP Smear", amount: 800 },
  { service: "Peripheral Smear Examination", amount: 200 },
  { service: "Platelet Count", amount: 100 },
  { service: "Potassium", amount: 150 },
  { service: "PREGNANCY TEST", amount: 150 },
  { service: "PROLACTIN", amount: 500 },
  { service: "PSA", amount: 800 },
  { service: "RA Test", amount: 250 },
  { service: "RBC", amount: 100 },
  { service: "Reticulocyte Count", amount: 150 },
  { service: "Rh Antibody Titre", amount: 600 },
  { service: "SEMEN", amount: 300 },
  { service: "SGOT", amount: 150 },
  { service: "SGPT", amount: 150 },
  { service: "Sodium", amount: 150 },
  { service: "Sputum Routine Comprehensive", amount: 250 },
  { service: "Stool Occult blood", amount: 200 },
  { service: "Sugar urine", amount: 100 },
  { service: "T3 T4 TSH", amount: 800 },
  { service: "T3", amount: 300 },
  { service: "T4", amount: 300 },
  { service: "Thyroid Antibodies ATAB", amount: 1200 },
  { service: "TIBC Direct", amount: 600 },
  { service: "Torch 4 IgG Toxoplasma CMV Rubella HSV 2", amount: 2500 },
  { service: "Torch 8 IgG or IgM Toxoplasma CMV Rubella HSV 2", amount: 4500 },
  { service: "Triple Test I Trimester (8-13 WEEKS)", amount: 2000 },
  { service: "Triple Test II Trimester (14-22 WEEKS)", amount: 2000 },
  { service: "Urea", amount: 150 },
  { service: "Urea Clearance Test", amount: 350 },
  { service: "URIC ACID", amount: 150 },
  { service: "URINE ROUTINE", amount: 150 },
  { service: "VDRL", amount: 200 },
  { service: "VITAMIN B12", amount: 800 },
  { service: "VITAMIN D3", amount: 1200 },
  { service: "Western Blot Test", amount: 3500 },
  { service: "WIDAL TEST", amount: 250 },
  { service: "IRON", amount: 300 },
  { service: "FERRITIN", amount: 800 },
  { service: "ANA Immunofluorescence", amount: 1500 },
  { service: "LDH", amount: 400 },
  { service: "Acid phosphatase With prostatic fraction", amount: 500 },
  { service: "Ammonia", amount: 600 },
  { service: "Apolipoproteins A1 and B", amount: 1200 },
  { service: "Anti Thrombin Antigen", amount: 1500 },
  { service: "Beta 2 Microglobulin", amount: 1200 },
  { service: "BICARBONATE", amount: 300 },
  { service: "BLOOD C/S", amount: 600 },
  { service: "Blood Group", amount: 100 },
  { service: "C peptide", amount: 1200 },
  { service: "CA15.3", amount: 1500 },
  { service: "CA19.9", amount: 1500 },
  { service: "Calcitonin", amount: 1800 },
  { service: "CEA", amount: 1200 },
  { service: "CORTISOL", amount: 800 },
  { service: "Culture and susceptibity", amount: 600 },
  { service: "Deoxypyridinoline Urine", amount: 1500 },
  { service: "E2", amount: 800 },
  { service: "Folic Acid", amount: 800 },
  { service: "Free PSA", amount: 1200 },
  { service: "Free PSA : PSA ratio", amount: 1500 },
  { service: "FSH", amount: 600 },
  { service: "GGT", amount: 400 },
  { service: "HB ELECTRO", amount: 800 },
  { service: "HOMOCYSTEINE", amount: 1500 },
  { service: "HS-CRP", amount: 800 },
  { service: "INSULIN FASTING", amount: 800 },
  { service: "LDL Cholesterol", amount: 250 },
  { service: "Luteinizing Hormone", amount: 600 },
  { service: "Lipoprotein A", amount: 1200 },
  { service: "Micro Albumin", amount: 600 },
  { service: "Osmolarity", amount: 600 },
  { service: "Osteocalcin", amount: 1500 },
  { service: "PHOSPHORUS", amount: 200 },
  { service: "Post Prandial Sugar", amount: 100 },
  { service: "PROTEIN ELECTRO", amount: 1200 },
  { service: "Proteins", amount: 200 },
  { service: "ParaThyroid Hormone", amount: 1500 },
  { service: "Testosterone", amount: 800 },
  { service: "Thyroglobulin", amount: 1200 },
  { service: "Thyroid peoxidase Antibody", amount: 1200 },
  { service: "TOTAL PROTEIN", amount: 200 },
  { service: "TRIGLYCERIDES", amount: 200 },
  { service: "Thyroid Stimulating Hormone", amount: 400 },
  { service: "Urine Magnesium", amount: 400 },
  { service: "Chlorides", amount: 200 },
  { service: "TESTOSTERONE FREE", amount: 1200 },
  { service: "Alkaline Phosphatase with bone fraction", amount: 600 },
  { service: "VLDL Cholesterol", amount: 250 },
  { service: "Urine PH", amount: 100 },
  { service: "Urine Citrate", amount: 400 },
  { service: "HDL Cholesterol Ratio", amount: 300 },
  { service: "Albumin / Globulin Ratio", amount: 300 },
  { service: "KFT", amount: 600 },
  { service: "Haemoglobin", amount: 100 },
  { service: "HAEMOGRAM", amount: 300 },
  { service: "HBA1C - Glycated Haemoglobin", amount: 500 },
  { service: "PROTH TIME (NA CI)", amount: 300 },
  { service: "PTT (NA CITRATE)", amount: 300 },
  { service: "MALARIAL ANTIGEN", amount: 400 },
  { service: "BTCT", amount: 200 },
  { service: "Peripheral Smear with GBP", amount: 300 },
  { service: "HB (Haemoglobin)", amount: 100 },
  { service: "HIV", amount: 400 },
  { service: "HCV", amount: 400 },
  { service: "ASO", amount: 400 },
  { service: "THYPHI IGG IGM", amount: 600 },
  { service: "DENGUE NS1", amount: 600 },
  { service: "DENGUE IGG/IGM", amount: 1000 },
  { service: "DENGUE PROFILE", amount: 1500 },
  { service: "BLOOD SUGAR FASTING", amount: 100 },
  { service: "BLOOD SUGAR PP", amount: 100 },
  { service: "BLOOD SUGAR RANDOM", amount: 100 },
  { service: "OGTT", amount: 350 },
  { service: "BLOOD URINE", amount: 250 },
  { service: "RA FACTOR", amount: 250 },
  { service: "CPK MB", amount: 400 },
  { service: "PHERIPHERAL SMEAR", amount: 200 },
  { service: "STOOL ROUTINE", amount: 150 },
  { service: "MANTOUX TEST", amount: 200 },
  { service: "LIPID PROFILE", amount: 600 },
  { service: "RENAL PROFILE", amount: 800 },
  { service: "ANC PROFILE", amount: 1500 },
  { service: "FEVER PROFILE", amount: 1200 },
  { service: "ANC+TSH", amount: 1800 },
  { service: "SPUTUM AFB ROUTINE", amount: 250 },
  { service: "URINE C/S", amount: 600 },
  { service: "STOOL C/S", amount: 600 },
  { service: "SPUTUM C/S", amount: 600 },
  { service: "AFB CULTURE ALL SAMPLE", amount: 800 },
  { service: "PUS C/S", amount: 600 },
  { service: "ALBUMIN SPOT URINE", amount: 200 },
  { service: "APTT", amount: 300 },
  { service: "ADA", amount: 800 },
  { service: "AMH", amount: 1800 },
  { service: "AMO (TPO)", amount: 1200 },
  { service: "ANAEMIA PROFILE (MINI)", amount: 1200 },
  { service: "ANA (IFA)", amount: 1500 },
  { service: "ALPHA FETO PROTEIN", amount: 800 },
  { service: "ANTI HCV", amount: 400 },
  { service: "ANTI CCP", amount: 1500 },
  { service: "FASTING C PEPTIDE", amount: 1200 },
  { service: "C3 LEVEL", amount: 800 },
  { service: "CHIKUNGUNIYA IGM", amount: 800 },
  { service: "CD3/CD4/CD8/CD45", amount: 3500 },
  { service: "FSH/LH/PROLC/TSH", amount: 2000 },
  { service: "FSH LH PROLACTIN TESTES", amount: 1800 },
  { service: "VITAMIN D13", amount: 1200 },
  { service: "TSH", amount: 400 },
  { service: "HLAB27", amount: 2500 },
  { service: "HAV IgG", amount: 800 },
  { service: "HAVIgM", amount: 800 },
  { service: "HEVIgM", amount: 800 },
  { service: "IRON STUDIES", amount: 1200 },
  { service: "PTH", amount: 1500 },
  { service: "LH", amount: 600 },
  { service: "PSA TOTAL", amount: 800 },
  { service: "TESTOSTERONE TOTAL", amount: 800 },
  { service: "TBGOLD", amount: 1500 },
  { service: "TORCH 8", amount: 4500 },
  { service: "TPHA", amount: 600 },
  { service: "TRIPLE MARKER(18- 13 WEEK)", amount: 2000 },
  { service: "HEV IgG", amount: 800 },
  { service: "TRIPLE MARKER(14- 22 WEEK)", amount: 2000 },
  { service: "VITAMIN D3 PLUS", amount: 1500 },
  { service: "FSH/LH/PROLACTIN", amount: 1500 },
  { service: "IL-6", amount: 1800 },
  { service: "HIV DUO ELISA", amount: 800 },
  { service: "HIV 1/2", amount: 400 },
  { service: "MP", amount: 150 },
  { service: "SPUTUM FOR AFB/1 SAMPLE", amount: 250 },
  { service: "IgE LEVEL", amount: 800 },
  { service: "LIVER FUNCTION TEST", amount: 600 },
  { service: "THYROID FUNCTION TEST", amount: 800 },
  { service: "CARDIAC PANEL TEST", amount: 1500 },
  { service: "HEMATOLOGY", amount: 600 },
  { service: "DENGUE IgG AND IgM WITH NS1", amount: 1500 },
  { service: "TYPHOID IGG AND IGM", amount: 800 },
  { service: "COMPLETE BLOOD COUNT WITH ESR AND MALARIAL PARASITE", amount: 400 },
  { service: "URINE ROUTINE EXAMINATION", amount: 150 },
  { service: "BLOOD GLUCOSE RANDOM", amount: 100 },
  { service: "COMPLETE BLOOD COUNT WITH ESR & MALARIAL PARASITE", amount: 400 },
  { service: "V.D.R.L TEST", amount: 200 },
  { service: "BIOCHEMISTRY", amount: 800 },
  { service: "HBsAg (ANC Elisa)", amount: 400 },
  { service: "HBsAg (Elisa)", amount: 400 },
  { service: "PROTHROMBIN TIME ESTIMATION", amount: 300 },
  { service: "STOOL REPORT", amount: 150 },
  { service: "BLOOD UREA", amount: 150 },
  { service: "PRO BNP", amount: 2500 },
  { service: "ABG", amount: 800 },
  { service: "FNAC", amount: 1200 },
  { service: "MAGNESIUM", amount: 300 },
  { service: "HLAB27 PCR", amount: 3000 },
  { service: "CREATININE", amount: 150 },
  { service: "IL6", amount: 1800 },
  { service: "VIT B6", amount: 1200 },
  { service: "HIV I & II (WESTERN BLOOD)", amount: 3500 },
  { service: "TROP I", amount: 800 },
  { service: "TROP T", amount: 800 },
  { service: "BODY PROFILE", amount: 2000 },
  { service: "3 H", amount: 1500 },
  { service: "BLOOD SUGAR FBS PPBS", amount: 200 },
  { service: "HISTOPATH - Small Sample", amount: 1200 },
  { service: "HISTOPATH - Medium Sample", amount: 1800 },
  { service: "HISTOPATH - Large Sample", amount: 2500 },
  { service: "LIPASE", amount: 600 },
]

export const IPDServiceOptions: ServiceOption[] = [
  { service: "Ryles tube insertion", amount: 500 },
  { service: "Foleys catheration", amount: 600 },
  { service: "Air bed", amount: 300 },
  { service: "Central line", amount: 2000 },
  { service: "Thrombolization", amount: 5000 },
  { service: "Blood transfusion", amount: 1500 },
  { service: "Infusion pump", amount: 800 },
  { service: "Intubation", amount: 1500 },
  { service: "ECG", amount: 300 },
  { service: "RBS", amount: 100 },
  { service: "2Decho", amount: 1200 },
  { service: "2Decho with opinion", amount: 1800 },
  { service: "mgso4 per dressing", amount: 400 },
  { service: "Normal dressing", amount: 300 },
  { service: "Big dressing", amount: 600 },
  { service: "USG charges", amount: 800 },
  { service: "Doppler charges", amount: 1200 },
  { service: "Dialysis catheter insertion", amount: 3000 },
  { service: "Arterial line", amount: 1500 },
  { service: "ICD Charges", amount: 2500 },
  { service: "Tracheostomy tube insertion", amount: 3500 },
  { service: "Insicion and drainage", amount: 1200 },
  { service: "Temporary pacemaker", amount: 8000 },
  { service: "Pacing daily charges", amount: 1000 },
  { service: "Nebulization per day", amount: 300 },
  { service: "Phototherapy", amount: 800 },
  { service: "Umbilical line", amount: 1500 },
  { service: "Consultant Delivery Receiving Baby Charges", amount: 5000 },
  { service: "Delivery charges as per package", amount: 15000 },
  { service: "LSCS CHARGES AS PER PACKAGE", amount: 25000 },
  { service: "EMERGENCY LSCS", amount: 30000 },
  { service: "Dialysis Per Day in ICU", amount: 4000 },
  { service: "Test IPD Service", amount: 500 },
  { service: "DOPPLER - OBS", amount: 1200 },
  { service: "Doppler - Arterial", amount: 1500 },
  { service: "USG - WHOLE ABDOMEN", amount: 1000 },
  { service: "USG - KUB", amount: 800 },
  { service: "USG - PELVIS", amount: 800 },
  { service: "USG - LOCAL PARTS", amount: 600 },
  { service: "USG- OBS", amount: 800 },
  { service: "USG- ANOMALY SCAN", amount: 1500 },
  { service: "USG - NT SCAN", amount: 1200 },
  { service: "DOPPLER - VENOUS", amount: 1500 },
  { service: "DOPPLER - RENAL", amount: 1500 },
  { service: "FOLLICULAR STUDY", amount: 1200 },
  { service: "USG - NT Scan - twin", amount: 1800 },
  { service: "USG - Follicle Study", amount: 1200 },
  { service: "USG - Bilateral", amount: 1000 },
]

export const RadiologyServiceOptions: ServiceOption[] = [
  { service: "USG - Whole Abdomen", amount: 1000 },
  { service: "USG - KUB", amount: 800 },
  { service: "USG - Pelvis", amount: 800 },
  { service: "USG - Local parts", amount: 600 },
  { service: "USG - Obs", amount: 800 },
  { service: "USG - Anomaly Scan", amount: 1500 },
  { service: "USG - NT Scan", amount: 1200 },
  { service: "USG - NT Scan - twin", amount: 1800 },
  { service: "USG - Follicle Study", amount: 1200 },
  { service: "USG - Bilateral", amount: 1000 },
  { service: "Doppler - Obs", amount: 1200 },
  { service: "Doppler - Arterial", amount: 1500 },
  { service: "Doppler - Venous", amount: 1500 },
  { service: "Doppler - Renal", amount: 1500 },
  { service: "USG guided Pleural taping - Dr. Noman/Dr. Salman 1st Visit", amount: 2500 },
  { service: "USG guided Pleural taping - Dr. Noman/Dr. Salman 2nd Visit", amount: 2000 },
  { service: "USG guided Pleural taping - Dr. Noman/Dr. Salman 3rd Visit", amount: 1800 },
  { service: "USG guided Ascitic tapping - Dr. Noman/Dr. Salman", amount: 2500 },
  { service: "USG guided Pigtail catheterization - Dr. Noman/Dr. Salman", amount: 3500 },
  { service: "Follicular Study - Dr. Noman/Dr. Salman", amount: 1500 },
  { service: "FNAC - Dr. Noman/Dr. Salman", amount: 1800 },
  { service: "Mammography - Dr. Noman/Dr. Salman", amount: 2500 },
  { service: "FNAC - DR SHOEB ANSARI", amount: 1800 },
  { service: "MAMMOGRAPHY - DR SHOEB ANSARI", amount: 2500 },
]

export const Casualty: ServiceOption[] = [
  { service: "Room Charges/Nursing Charges", amount: 200 },
  { service: "Room charges on sunday", amount: 300 },
  { service: "HGT", amount: 100 },
  { service: "NEB", amount: 100 },
  { service: "IM", amount: 100 },
  { service: "IV", amount: 200 },
  { service: "Casualty per hour", amount: 150 },
  { service: "RST Wash", amount: 1500 },
  { service: "Stomach wash", amount: 1500 },
  { service: "RT Insertion", amount: 1200 },
  { service: "Foleys cathether", amount: 200 },
  { service: "Foleys removal", amount: 300 },
  { service: "Enema", amount: 250 },
  { service: "Oxygen per hour", amount: 150 },
  { service: "Oxygen 6 hours", amount: 500 },
  { service: "Oxygen 12 hours", amount: 1000 },
  { service: "Oxygen", amount: 1800 },
  { service: "ECG", amount: 350 },
  { service: "Dressing (small)", amount: 300 },
  { service: "Dressing (medium)", amount: 400 },
  { service: "Dressing (large)", amount: 500 },
  { service: "Suppository charge", amount: 300 },
  { service: "Suture remove with nursing charge", amount: 200 },
  { service: "Per suture", amount: 200 },
  { service: "NST Charge", amount: 500 },
  { service: "UPT Charge", amount: 100 },
  { service: "FT Insection", amount: 0 },
  { service: "BCG", amount: 350 },
  { service: "Plaster remove", amount: 0 },
  { service: "Ambulance Charges - 1st Visit", amount: 0 },
  { service: "Ambulance Charges - 2nd Visit", amount: 0 },
  { service: "Ambulance Charges - 3rd Visit", amount: 0 },
  { service: "Plaster Charges-POP/SCAB/Cast Charges", amount: 0 },
  { service: "CMO Charges", amount: 0 },
  { service: "Dialysis Kit - Dr Sameer Vyahalkar", amount: 0 },
  { service: "Dialysis Kit - Dr Nikhil Shinde", amount: 0 },
  { service: "Dialysis Kit - Dr Shakil Shaikh", amount: 0 },
  { service: "Dialysis Bed - Dr Shakil Shaikh", amount: 0 },
  { service: "Dialysis Bed - Dr Nikhil Shinde", amount: 0 },
  { service: "Dialysis Bed - Dr Sameer Vyahalkar", amount: 0 },
  { service: "Slab  Below Knee", amount: 0 },
  { service: "Slab  Below Elbow", amount: 0 },
  { service: "Slab  Above Knee", amount: 0 },
  { service: "Slab  Above Elbow", amount: 0 },
  { service: "POP Cast  Below Knee", amount: 0 },
  { service: "POP Cast  Below Elbow", amount: 0 },
  { service: "POP Cast  Above Knee", amount: 0 },
  { service: "POP Cast  Above Elbow", amount: 0 },
  { service: "Registration Charges - Ward", amount: 0 },
  { service: "Registration Charges -ICU", amount: 0 },
  { service: "Registration Charges -NICU", amount: 0 },
  { service: "Registration Charges -T.S", amount: 0 },
  { service: "Registration Charges -Delux", amount: 0 },
  { service: "ICU -  Bed / Nursing", amount: 0 },
  { service: "GW  - Female -  Bed / Nursing", amount: 0 },
  { service: "GW  - Male -  Bed / Nursing", amount: 0 },
  { service: "GW  - Paediatric  Bed / Nursing", amount: 0 },
  { service: "GW  - Maternity  Bed / Nursing", amount: 0 },
  { service: "GW-Mother Bed", amount: 0 },
  { service: "NICU -  Bed / Nursing", amount: 0 },
  { service: "Deluxe -  Bed / Nursing", amount: 0 },
  { service: "Twin Sharing -  Bed / Nursing", amount: 0 },
  { service: "Suite Room -  Bed / Nursing", amount: 0 },
  { service: "Suite Room -  Bed / Nursing With Consultant", amount: 0 },
  { service: "Consultant - GW", amount: 0 },
  { service: "Consultant - ICU", amount: 0 },
  { service: "Consultant - NICU", amount: 0 },
  { service: "Consultant - Paed", amount: 0 },
  { service: "Consultant - Maternity", amount: 0 },
  { service: "Consultant - Deluxe", amount: 0 },
  { service: "Consultant - Twin Sharing", amount: 0 },
  { service: "Consultant - Suite Room", amount: 0 },
  { service: "Other Consultant - Dr Azhar Khan", amount: 0 },
  { service: "Other Consultant - Dr Rameez Akhtar", amount: 0 },
  { service: "Other Consultant - Dr Pushparaj Moolya", amount: 0 },
  { service: "Other Consultant - Dr Aditya Phadke", amount: 0 },
  { service: "Other Consultant - Dr Vimlesh Pandey", amount: 0 },
  { service: "Other Consultant - Dr Alkesh Patil", amount: 0 },
  { service: "Other Consultant - Dr Mazhar Turabi", amount: 0 },
  { service: "Other Consultant - Dr Bhavik Khandelwal", amount: 0 },
  { service: "Other Consultant - Dr Nishat Afreen", amount: 0 },
  { service: "Other Consultant - Dr Kanak Mishra", amount: 0 },
  { service: "Other Consultant - Dr Qasim Khan", amount: 0 },
  { service: "Other Consultant - Dr Akil Khan", amount: 0 },
  { service: "Other Consultant - Dr Shaheba Khan", amount: 0 },
  { service: "Other Consultant - Dr Sonali Mutha", amount: 0 },
  { service: "Consultant - Dr DeepKumar Mahajan", amount: 0 },
  { service: "Consultant - Dr Rajesh Patil", amount: 0 },
  { service: "Consultant - Dr Sameer Vyhalkar", amount: 0 },
  { service: "Consultant - Dr Pooja", amount: 0 },
  { service: "Consultant - Dr Muzammil", amount: 0 },
  { service: "Consultant - Dr Vrushali", amount: 0 },
  { service: "Consultant - Dr Shweta Nakhwa", amount: 0 },
  { service: "Consultant - Dr Sadaf", amount: 0 },
  { service: "Consultant - Dr Sachin Gupta", amount: 0 },
  { service: "Consultant - Dr Sadique Khan", amount: 0 },
  { service: "Consultant - Dr Dilawar Tonkwala", amount: 0 },
  { service: "Consultant - Dr Datta Sonawne(Deluxe)", amount: 0 },
  { service: "Consultant - Dr Humaira Punawala", amount: 0 },
  { service: "Consultant - Dr Shrikant", amount: 0 },
  { service: "Consultant - Dr Khalid Ansari", amount: 0 },
  { service: "Consultant - Dr Pravin", amount: 0 },
  { service: "Consultant - Dr Tahoora", amount: 0 },
  { service: "Consultant - Dr Zeeshan Asar", amount: 0 },
  { service: "Dr Osman Mapkar (First Visit)", amount: 0 },
  { service: "Emergency / Trial Charges", amount: 0 },
  { service: "Monitor", amount: 0 },
  { service: "Ventilator", amount: 0 },
  { service: "Venti Bipap", amount: 0 },
  { service: "Bi-PAP", amount: 0 },
  { service: "Bubble C- PAP", amount: 0 },
  { service: "Surgeon Charges", amount: 0 },
  { service: "Anaesthetist - Dr Wasid Ahmed", amount: 0 },
  { service: "Anaesthetist - Dr Manish Arora", amount: 0 },
  { service: "Anaesthetist - Dr Hemant Warade", amount: 0 },
  { service: "Foley's Cathether Insertion", amount: 0 },
  { service: "Tracheostomy Tube Insertion", amount: 0 },
  { service: "ICD Insertion", amount: 0 },
  { service: "HD Catheter", amount: 0 },
  { service: "RT Wash", amount: 0 },
  { service: "AV Fistula", amount: 0 },
  { service: "Thrombolysis", amount: 0 },
  { service: "Central Line", amount: 0 },
  { service: "Plaster", amount: 0 },
  { service: "Endoscopy", amount: 0 },
  { service: "Ascitic Tapping", amount: 0 },
  { service: "Plueral Tapping", amount: 0 },
  { service: "Plaster Removal", amount: 0 },
  { service: "Intubation", amount: 0 },
  { service: "Lumbar Puncture", amount: 0 },
  { service: "Dialysis", amount: 0 },
  { service: "Bronchoscopy", amount: 0 },
  { service: "Nail Remover", amount: 0 },
  { service: "Pump Catheter Remover", amount: 0 },
  { service: "Amputation", amount: 0 },
  { service: "Debridement", amount: 0 },
  { service: "Personal Delivery", amount: 0 },
  { service: "Paediatrician - FTND Visit", amount: 0 },
  { service: "Paediatrician - LSCS Visit", amount: 0 },
  { service: "LSCS Procedure - Surgeon Charges", amount: 0 },
  { service: "FTND Procedure - Surgeon Charges", amount: 0 },
  { service: "Labour Room Charges", amount: 0 },
  { service: "Hospital Stay", amount: 0 },
  { service: "Medicines Charges", amount: 0 },
  { service: "OT Charges", amount: 0 },
  { service: "OT Assistance Charges", amount: 0 },
  { service: "Maurtery Sheet", amount: 0 },
  { service: "Enema Charges", amount: 0 },
  { service: "Syringe Pump 1", amount: 0 },
  { service: "Umbilical Line", amount: 0 },
  { service: "Airbed", amount: 0 },
  { service: "Oxygen - Nasal Cannula", amount: 0 },
  { service: "SSPT", amount: 0 },
  { service: "NST", amount: 0 },
  { service: "TSPT", amount: 0 },
  { service: "DSPT", amount: 0 },
  { service: "Blood Transfusion Charges", amount: 0 },
  { service: "2D Echo With Consultation", amount: 0 },
  { service: "Dressing - Dr Qasim Khan", amount: 0 },
  { service: "LSCS Dressing", amount: 0 },
  { service: "Mash Tacker", amount: 0 },
  { service: "Induction Charges", amount: 0 },
  { service: "Implant", amount: 0 },
  { service: "Dialysis Amount", amount: 0 },
  { service: "CMO Emergency Charges", amount: 0 },
]
