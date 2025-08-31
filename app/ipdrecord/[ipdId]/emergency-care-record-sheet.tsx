// Filename: emergency-care-record-sheet.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import PdfGenerator from "./PdfGenerator"; // Import PdfGenerator

// --- Type Definitions ---
interface TreatmentOrder {
  srNo: number;
  ordersBy: string;
  medicationName: string;
  dose: string;
  route: string;
  freq: string;
  adminRecordT: string; // Time for Administration Record
  adminRecordN: string; // Name of Station for Administration Record
  counterVerification: string;
}

interface InvestigationRow {
  srNo: number;
  investigation: string;
  result: string;
  remarks: string;
}

interface MedicationRow {
  srNo: number;
  medicationName: string;
  dose: string;
  route: string;
  freq: string;
  date: string;
  omitContinueWithholdReasons: string; // Omit (O), Continue (C) Withhold (WH) Reasons
}

interface EmergencyCareRecordData {
  // Top Left Section (from Image 1)
  admittedUnder: string;
  reference: string;

  // Top Right Section - Patient Identification & Attendant Details (from Image 1)
  handoverToPoliceYes: boolean;
  handoverToPoliceNo: boolean;
  informedDate: string;
  informedTime: string;
  nameOfPoliceStation: string;
  attendantFirstName: string;
  attendantMiddleName: string;
  attendantSurname: string;
  attendantAdd: string;
  broughtBy: string;
  broughtByRelation: string;
  uhid: string;
  ipOp: string;
  age: string;
  sexM: boolean;
  sexF: boolean;
  contactDate: string;
  contactTime: string;
  contactNo: string;
  pcName: string;
  pcNumber: string;
  subInspector: string;
  transferredToSicuMicrWard: string;
  transferredToCathlab: string;
  weight: string; // Wt field
  triageEmergency: boolean;
  triageUrgent: boolean;
  triageNonUrgent: boolean;
  emergencyNo: string; // EMERGENCY NO. field

  // Vital Signs (from Image 1)
  vitalsTemp: string;
  vitalsBp: string;
  vitalsSpo2: string;
  vitalsHgt: string;
  allergiesYes: boolean;
  allergiesNo: boolean;
  allergiesDetails: string;

  // Chief Complaints (from Image 1)
  chiefComplaints: string;

  // Investigations & Recent Investigations (from Image 1)
  investigationsAndRecentInvestigationsText: string; // Large textarea
  investigationsTable: InvestigationRow[];

  // Past Medical History (from Image 1)
  pastMedicalHistory: string; // Large textarea

  // General Physical Examination (from Image 1)
  generalPhysicalExamination: string; // Large textarea

  // Surgical History (from Image 1)
  surgicalHistory: string; // Large textarea
  historyGivenByName: string;
  historyGivenByRelation: string;

  // Medical Reconciliation (from Image 1)
  medicalReconciliation: string; // Large textarea
  medicationsTable: MedicationRow[];

  // Treatment Orders Table (from Image 2)
  treatmentOrders: TreatmentOrder[];

  // Bed Sore (from Image 2)
  bedSoreYes: boolean;
  bedSoreNo: boolean;
  bedSoreLocation: string;

  // Provisional Diagnosis / Advice on Transfer / Discharge (from Image 2)
  provisionalDiagnosisAdvice: string; // Large textarea

  // Diet / Fluid List (from Image 2)
  dietNbm: boolean;
  dietFd: boolean;
  dietDd: boolean;
  dietSrd: boolean;
  dietRental: boolean;
  dietRtOrPegFeeds: boolean;
  lastMealTime: string;
  opdTreatment: string;
  admissionCheckbox: boolean; // "Admission" checkbox
  admissionAdvised: boolean; // "ADVISED" checkbox
  admissionIcu: boolean; // "ICU" checkbox
  admissionRefusedByPatientAndRelatives: string; // Textarea for refusal

  // Patient & Family Education Documentation Information (from Image 2)
  patientFamilyEducationInfo: string; // Large textarea

  // Consent of Patient / Family (from Image 2)
  consentPositive: boolean;
  consentNegative: boolean;
  consentValuables: string;
  handedOverTo: string;
  handedOverToNameSign: string;
  patientRelativeNameConsent: string;
  patientRelativeRelationConsent: string;
  cmoName: string;
  cmoSign: string;
  regNoConsent: string;
  regDateConsent: string;
  regTimeConsent: string;
  regSignConsent: string;
  handoverGivenToFinal: string;
  handoverGivenToFinalSign: string;

  // Admitted Under / Reference (from Image 1, bottom repeated)
  admittedUnderBottom: string;
  referenceBottom: string;
}

// --- Helper Functions to Create Initial States ---
const createInitialTreatmentOrders = (count: number = 15): TreatmentOrder[] => {
  return Array.from({ length: count }, (_, i) => ({
    srNo: i + 1,
    ordersBy: '',
    medicationName: '',
    dose: '',
    route: '',
    freq: '',
    adminRecordT: '',
    adminRecordN: '',
    counterVerification: '',
  }));
};

const createInitialInvestigations = (count: number = 5): InvestigationRow[] => {
  return Array.from({ length: count }, (_, i) => ({
    srNo: i + 1,
    investigation: '',
    result: '',
    remarks: '',
  }));
};

const createInitialMedications = (count: number = 6): MedicationRow[] => {
  return Array.from({ length: count }, (_, i) => ({
    srNo: i + 1,
    medicationName: '',
    dose: '',
    route: '',
    freq: '',
    date: '',
    omitContinueWithholdReasons: '',
  }));
};

const initialEmergencyCareRecord: EmergencyCareRecordData = {
  admittedUnder: '',
  reference: '',

  handoverToPoliceYes: false,
  handoverToPoliceNo: false,
  informedDate: '',
  informedTime: '',
  nameOfPoliceStation: '',
  attendantFirstName: '',
  attendantMiddleName: '',
  attendantSurname: '',
  attendantAdd: '',
  broughtBy: '',
  broughtByRelation: '',
  uhid: '',
  ipOp: '',
  age: '',
  sexM: false,
  sexF: false,
  contactDate: '',
  contactTime: '',
  contactNo: '',
  pcName: '',
  pcNumber: '',
  subInspector: '',
  transferredToSicuMicrWard: '',
  transferredToCathlab: '',
  weight: '',
  triageEmergency: false,
  triageUrgent: false,
  triageNonUrgent: false,
  emergencyNo: '',

  vitalsTemp: '',
  vitalsBp: '',
  vitalsSpo2: '',
  vitalsHgt: '',
  allergiesYes: false,
  allergiesNo: false,
  allergiesDetails: '',

  chiefComplaints: '',
  investigationsAndRecentInvestigationsText: '',
  investigationsTable: createInitialInvestigations(),
  pastMedicalHistory: '',
  generalPhysicalExamination: '',
  surgicalHistory: '',
  historyGivenByName: '',
  historyGivenByRelation: '',
  medicalReconciliation: '',
  medicationsTable: createInitialMedications(),

  treatmentOrders: createInitialTreatmentOrders(),

  bedSoreYes: false,
  bedSoreNo: false,
  bedSoreLocation: '',

  provisionalDiagnosisAdvice: '',

  dietNbm: false,
  dietFd: false,
  dietDd: false,
  dietSrd: false,
  dietRental: false,
  dietRtOrPegFeeds: false,
  lastMealTime: '',
  opdTreatment: '',
  admissionCheckbox: false,
  admissionAdvised: false,
  admissionIcu: false,
  admissionRefusedByPatientAndRelatives: '',

  patientFamilyEducationInfo: '',

  consentPositive: false,
  consentNegative: false,
  consentValuables: '',
  handedOverTo: '',
  handedOverToNameSign: '',
  patientRelativeNameConsent: '',
  patientRelativeRelationConsent: '',
  cmoName: '',
  cmoSign: '',
  regNoConsent: '',
  regDateConsent: '',
  regTimeConsent: '',
  regSignConsent: '',
  handoverGivenToFinal: '',
  handoverGivenToFinalSign: '',

  admittedUnderBottom: '',
  referenceBottom: '',
};

// --- Emergency Care Record Component ---
const EmergencyCareRecordSheet = ({ ipdId }: { ipdId: string }) => {
  const [recordData, setRecordData] = useState<EmergencyCareRecordData>(initialEmergencyCareRecord);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null); // Create the ref for the form content

  // --- Data Fetching Function ---
  const fetchEmergencyCareRecord = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('emergency_care_data')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found

      if (data?.emergency_care_data) {
        setRecordData(data.emergency_care_data as EmergencyCareRecordData);
        toast.success("Previous emergency care data loaded.");
      } else {
        setRecordData(initialEmergencyCareRecord); // Reset if no data found
      }
    } catch (error) {
      console.error("Failed to fetch emergency care record:", error);
      toast.error("Failed to load emergency care record.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  // --- Authentication and Data Fetching Effect ---
  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && ipdId) {
        fetchEmergencyCareRecord();
      } else {
        setIsLoading(false);
        toast.error("User not authenticated. Please log in.");
      }
    };
    checkAuthAndFetch();
  }, [ipdId, fetchEmergencyCareRecord]);

  // --- Data Saving Function ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated. Cannot save data.");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from('ipd_record').upsert({
        ipd_id: ipdId,
        user_id: session.user.id,
        emergency_care_data: recordData,
      }, { onConflict: 'ipd_id' }); // Only ipd_id for conflict here, assuming user_id isn't part of the unique key

      if (error) throw error;
      toast.success("Emergency care record saved successfully!");
    } catch (error) {
      console.error("Failed to save emergency care record:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- General Input Change Handler ---
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    field: keyof EmergencyCareRecordData
  ) => {
    const { value, type, checked } = e.target as HTMLInputElement;
    setRecordData(prevData => ({
      ...prevData,
      [field]: type === 'checkbox' ? checked : value
    }));
  };

  // --- Checkbox/Radio Group Change Handler ---
  const handleGroupChange = (
    groupName: 'handoverPolice' | 'sex' | 'triage' | 'allergies' | 'bedSore' | 'diet',
    field: keyof EmergencyCareRecordData,
    value: boolean
  ) => {
    setRecordData(prevData => {
      const newState = { ...prevData };
      if (groupName === 'handoverPolice') {
        newState.handoverToPoliceYes = field === 'handoverToPoliceYes' ? value : !value;
        newState.handoverToPoliceNo = field === 'handoverToPoliceNo' ? value : !value;
      } else if (groupName === 'sex') {
        newState.sexM = field === 'sexM' ? value : !value;
        newState.sexF = field === 'sexF' ? value : !value;
      } else if (groupName === 'triage') {
        newState.triageEmergency = field === 'triageEmergency' ? value : false;
        newState.triageUrgent = field === 'triageUrgent' ? value : false;
        newState.triageNonUrgent = field === 'triageNonUrgent' ? value : false;
      } else if (groupName === 'allergies') {
        newState.allergiesYes = field === 'allergiesYes' ? value : false;
        newState.allergiesNo = field === 'allergiesNo' ? value : false;
      } else if (groupName === 'bedSore') {
        newState.bedSoreYes = field === 'bedSoreYes' ? value : false;
        newState.bedSoreNo = field === 'bedSoreNo' ? value : false;
      } else if (groupName === 'diet') {
        // For diet, individual checkboxes are allowed
        (newState as any)[field] = value;
      }
      return newState;
    });
  };

  // --- Table Row Change Handlers ---
  const handleTreatmentOrderChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: keyof TreatmentOrder
  ) => {
    const { value } = e.target;
    setRecordData(prevData => {
      const updatedOrders = [...prevData.treatmentOrders];
      updatedOrders[index] = { ...updatedOrders[index], [field]: value };
      return { ...prevData, treatmentOrders: updatedOrders };
    });
  };

  const handleInvestigationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: keyof InvestigationRow
  ) => {
    const { value } = e.target;
    setRecordData(prevData => {
      const updatedInvestigations = [...prevData.investigationsTable];
      updatedInvestigations[index] = { ...updatedInvestigations[index], [field]: value };
      return { ...prevData, investigationsTable: updatedInvestigations };
    });
  };

  const handleMedicationChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number,
    field: keyof MedicationRow
  ) => {
    const { value } = e.target;
    setRecordData(prevData => {
      const updatedMedications = [...prevData.medicationsTable];
      updatedMedications[index] = { ...updatedMedications[index], [field]: value };
      return { ...prevData, medicationsTable: updatedMedications };
    });
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Emergency Care Record...</p>
      </div>
    );
  }
  
  // Dynamic grid column definitions for tables
  const investigationCols = "grid-cols-[30px_2.5fr_1fr_1fr]"; // Adjusted proportions
  const medicationCols = "grid-cols-[30px_2.5fr_50px_50px_50px_60px_1fr]"; // Adjusted proportions
  const treatmentOrderCols = "grid-cols-[30px_100px_1fr_50px_50px_50px_100px_100px_1fr]"; // Explicitly for Admin Record T/N and Counter Verification


  return (
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-full mx-auto font-sans text-[10px] print:p-0 print:shadow-none">
      <div ref={contentRef}> {/* Wrap the entire form content with the ref */}
        {/* Hospital Header and Title */}
        <div className="flex justify-between items-start mb-2">
          <div className="text-left leading-tight">
            <h1 className="font-bold text-lg uppercase">MEDFORD MULTI SPECIALITY HOSPITAL</h1>
            <p className="text-[9px] text-gray-600">
              From Care To Cure. Your Bridge To Healthcare
            </p>
            <p className="mt-2 text-[9px]">
              1st Floor, Neel Blue Bells, By Bypass Y-Junction, Kausar Ambra, Thane – 400 612<br/>
              Mob: 9769 0000 91 / 9769 0000 92 / 9769 0000 93<br/>
              <a href="http://www.medfordhealthcare.com" className="text-blue-600 underline">www.medfordhealthcare.com</a><br/>
              Follow Us On [f] [in] {/* Placeholder for social media icons */}
            </p>
          </div>
          <div className="text-right flex flex-col items-end">
              {/* Logo placeholder if available */}
              <div className="border border-black p-1 mb-2 text-center text-[8px] font-semibold w-[60px] h-[60px] flex items-center justify-center">
                NABH<br/>CERTIFIED
              </div>
              <h2 className="font-bold text-2xl uppercase border-b-2 border-black pb-1">EMERGENCY CARE RECORD</h2>
              <div className="flex items-center mt-1">
                  <span className="font-bold mr-2">TRIAGE:</span>
                  <label className="flex items-center mr-1">
                      <input type="radio" name="triage" value="Emergency" checked={recordData.triageEmergency} onChange={() => handleGroupChange('triage', 'triageEmergency', true)} className="mr-[2px]" />
                      EMERGENCY
                  </label>
                  <label className="flex items-center mr-1">
                      <input type="radio" name="triage" value="Urgent" checked={recordData.triageUrgent} onChange={() => handleGroupChange('triage', 'triageUrgent', true)} className="mr-[2px]" />
                      URGENT
                  </label>
                  <label className="flex items-center">
                      <input type="radio" name="triage" value="Non Urgent" checked={recordData.triageNonUrgent} onChange={() => handleGroupChange('triage', 'triageNonUrgent', true)} className="mr-[2px]" />
                      NON URGENT
                  </label>
              </div>
               <div className="flex items-center mt-1 w-full">
                  <label className="font-semibold whitespace-nowrap mr-1">EMERGENCY NO.:</label>
                  <input type="text" value={recordData.emergencyNo} onChange={(e) => handleInputChange(e, 'emergencyNo')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
              </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 mb-2">
          {/* Left Column (Image 1 top-left sections + Vitals, Complaints, etc.) */}
          <div>
              {/* Handover to Police */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <div className="flex items-center">
                      <label className="font-semibold mr-2">Handover to police for P.M.:</label>
                      <label className="flex items-center mr-2">
                          <input type="radio" name="handoverPolice" value="Yes" checked={recordData.handoverToPoliceYes} onChange={() => handleGroupChange('handoverPolice', 'handoverToPoliceYes', true)} className="mr-[2px]" />
                          Yes
                      </label>
                      <label className="flex items-center">
                          <input type="radio" name="handoverPolice" value="No" checked={recordData.handoverToPoliceNo} onChange={() => handleGroupChange('handoverPolice', 'handoverToPoliceNo', true)} className="mr-[2px]" />
                          No
                      </label>
                  </div>
                  {recordData.handoverToPoliceYes && (
                      <div className="space-y-1">
                          <p className="text-[9px] italic">If yes, fill the following details:</p>
                          <div className="flex items-center">
                              <label className="font-semibold mr-1">Informed Date:</label>
                              <input type="date" value={recordData.informedDate} onChange={(e) => handleInputChange(e, 'informedDate')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none mr-1" />
                              <label className="font-semibold mr-1">Time:</label>
                              <input type="time" value={recordData.informedTime} onChange={(e) => handleInputChange(e, 'informedTime')} className="w-20 p-[2px] border-b border-gray-300 focus:outline-none mr-1" />
                              <span className="mr-1">am / pm</span>
                          </div>
                          <div className="flex items-center">
                              <label className="font-semibold mr-1">Name of Police Station:</label>
                              <input type="text" value={recordData.nameOfPoliceStation} onChange={(e) => handleInputChange(e, 'nameOfPoliceStation')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                          </div>
                      </div>
                  )}
              </div>

              {/* Patient & Attendant Details (Part 2, from Image 1) */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <div className="grid grid-cols-3 gap-x-2">
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">First Name:</label>
                          <input type="text" value={recordData.attendantFirstName} onChange={(e) => handleInputChange(e, 'attendantFirstName')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Middle Name:</label>
                          <input type="text" value={recordData.attendantMiddleName} onChange={(e) => handleInputChange(e, 'attendantMiddleName')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Surname:</label>
                          <input type="text" value={recordData.attendantSurname} onChange={(e) => handleInputChange(e, 'attendantSurname')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                  </div>
                  <div className="flex items-center">
                      <label className="font-semibold mr-1">Add:</label>
                      <input type="text" value={recordData.attendantAdd} onChange={(e) => handleInputChange(e, 'attendantAdd')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-2">
                      <div className="flex items-center">
                          <label className="font-semibold mr-1">Brought By:</label>
                          <input type="text" value={recordData.broughtBy} onChange={(e) => handleInputChange(e, 'broughtBy')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center">
                          <label className="font-semibold mr-1">Relation:</label>
                          <input type="text" value={recordData.broughtByRelation} onChange={(e) => handleInputChange(e, 'broughtByRelation')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                  </div>
                   <div className="grid grid-cols-4 gap-x-2 items-center">
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">UHID:</label>
                          <input type="text" value={recordData.uhid} onChange={(e) => handleInputChange(e, 'uhid')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">IP/OP:</label>
                          <input type="text" value={recordData.ipOp} onChange={(e) => handleInputChange(e, 'ipOp')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                       <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Age:</label>
                          <input type="text" value={recordData.age} onChange={(e) => handleInputChange(e, 'age')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Sex:</label>
                          <label className="flex items-center mr-1">
                              <input type="radio" name="sex" value="M" checked={recordData.sexM} onChange={() => handleGroupChange('sex', 'sexM', true)} className="mr-[2px]" />
                              M
                          </label>
                          <label className="flex items-center">
                              <input type="radio" name="sex" value="F" checked={recordData.sexF} onChange={() => handleGroupChange('sex', 'sexF', true)} className="mr-[2px]" />
                              F
                          </label>
                      </div>
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 items-center">
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Date:</label>
                          <input type="date" value={recordData.contactDate} onChange={(e) => handleInputChange(e, 'contactDate')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Time:</label>
                          <input type="time" value={recordData.contactTime} onChange={(e) => handleInputChange(e, 'contactTime')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none mr-1" />
                           <span className="mr-1">am / pm</span>
                      </div>
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Contact No.:</label>
                          <input type="text" value={recordData.contactNo} onChange={(e) => handleInputChange(e, 'contactNo')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                  </div>
                  <div className="flex items-center">
                      <label className="font-semibold mr-1">P.C. Name:</label>
                      <input type="text" value={recordData.pcName} onChange={(e) => handleInputChange(e, 'pcName')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                   <div className="flex items-center">
                      <label className="font-semibold mr-1">P.C Number:</label>
                      <input type="text" value={recordData.pcNumber} onChange={(e) => handleInputChange(e, 'pcNumber')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                   <div className="flex items-center">
                      <label className="font-semibold mr-1">Sub-Inspector:</label>
                      <input type="text" value={recordData.subInspector} onChange={(e) => handleInputChange(e, 'subInspector')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
              </div>

              {/* Transferred To */}
              <div className="flex items-center border border-gray-300 p-2 space-y-1 mb-2">
                  <label className="font-semibold mr-1 whitespace-nowrap">Transferred to : SICU / MICU / WARD -</label>
                  <input type="text" value={recordData.transferredToSicuMicrWard} onChange={(e) => handleInputChange(e, 'transferredToSicuMicrWard')} className="w-1/3 p-[2px] border-b border-gray-300 focus:outline-none mr-2" />
                  <span className="mr-1">/</span>
                  <input type="text" value={recordData.transferredToCathlab} onChange={(e) => handleInputChange(e, 'transferredToCathlab')} className="w-1/4 p-[2px] border-b border-gray-300 focus:outline-none mr-2" />
                  <label className="font-semibold mr-1 whitespace-nowrap">Wt :</label>
                  <input type="text" value={recordData.weight} onChange={(e) => handleInputChange(e, 'weight')} className="w-1/4 p-[2px] border-b border-gray-300 focus:outline-none" />
              </div>

              {/* Vitals Section */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <h2 className="font-bold mb-1 uppercase">Vitals:</h2>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div className="flex items-center">
                          <label className="font-semibold w-24">Temperature:</label>
                          <input type="text" value={recordData.vitalsTemp} onChange={(e) => handleInputChange(e, 'vitalsTemp')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center">
                          <label className="font-semibold w-16">BP:</label>
                          <input type="text" value={recordData.vitalsBp} onChange={(e) => handleInputChange(e, 'vitalsBp')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center">
                          <label className="font-semibold w-16">SPO2:</label>
                          <input type="text" value={recordData.vitalsSpo2} onChange={(e) => handleInputChange(e, 'vitalsSpo2')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center">
                          <label className="font-semibold w-16">HGT:</label>
                          <input type="text" value={recordData.vitalsHgt} onChange={(e) => handleInputChange(e, 'vitalsHgt')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                  </div>
                  <div className="flex items-start mt-2">
                      <label className="font-semibold mr-2">ALLERGIES:</label>
                      <label className="flex items-center mr-2">
                          <input type="radio" name="allergies" value="Yes" checked={recordData.allergiesYes} onChange={() => handleGroupChange('allergies', 'allergiesYes', true)} className="mr-[2px]" />
                          YES
                      </label>
                      <label className="flex items-center mr-2">
                          <input type="radio" name="allergies" value="No" checked={recordData.allergiesNo} onChange={() => handleGroupChange('allergies', 'allergiesNo', true)} className="mr-[2px]" />
                          NO
                      </label>
                      {recordData.allergiesYes && (
                          <>
                              <label className="font-semibold mr-1">IF YES, DETAILS:</label>
                              <textarea value={recordData.allergiesDetails} onChange={(e) => handleInputChange(e, 'allergiesDetails')} className="flex-grow h-8 p-[2px] border-b border-gray-300 focus:outline-none resize-none" />
                          </>
                      )}
                  </div>
              </div>

              {/* Chief Complaints */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <label htmlFor="chiefComplaints" className="font-semibold block mb-1 uppercase">Chief Complaints:</label>
                  <textarea
                      id="chiefComplaints"
                      value={recordData.chiefComplaints}
                      onChange={(e) => handleInputChange(e, 'chiefComplaints')}
                      className="w-full h-16 p-[2px] border-none focus:outline-none resize-none"
                  ></textarea>
              </div>

              {/* Investigations & Recent Investigations Textarea */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <label htmlFor="investigationsAndRecentInvestigationsText" className="font-semibold block mb-1 uppercase">Investigations & Recent Investigations:</label>
                  <textarea
                      id="investigationsAndRecentInvestigationsText"
                      value={recordData.investigationsAndRecentInvestigationsText}
                      onChange={(e) => handleInputChange(e, 'investigationsAndRecentInvestigationsText')}
                      className="w-full h-16 p-[2px] border-none focus:outline-none resize-none"
                  ></textarea>
              </div>

              {/* Past Medical History */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <label htmlFor="pastMedicalHistory" className="font-semibold block mb-1 uppercase">PAST MEDICAL HISTORY : DM / HTN / IHD / CVA / COPD / ASTHMA / OTHERS. IF OTHERS, DETAILS :</label>
                  <textarea
                      id="pastMedicalHistory"
                      value={recordData.pastMedicalHistory}
                      onChange={(e) => handleInputChange(e, 'pastMedicalHistory')}
                      className="w-full h-16 p-[2px] border-none focus:outline-none resize-none"
                  ></textarea>
              </div>

               {/* General Physical Examination */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <label htmlFor="generalPhysicalExamination" className="font-semibold block mb-1 uppercase">GENERAL PHYSICAL EXAMINATION:</label>
                  <textarea
                      id="generalPhysicalExamination"
                      value={recordData.generalPhysicalExamination}
                      onChange={(e) => handleInputChange(e, 'generalPhysicalExamination')}
                      className="w-full h-16 p-[2px] border-none focus:outline-none resize-none"
                  ></textarea>
              </div>

              {/* Surgical History & History Given By */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <label htmlFor="surgicalHistory" className="font-semibold block mb-1 uppercase">SURGICAL HISTORY:</label>
                  <textarea
                      id="surgicalHistory"
                      value={recordData.surgicalHistory}
                      onChange={(e) => handleInputChange(e, 'surgicalHistory')}
                      className="w-full h-10 p-[2px] border-none focus:outline-none resize-none"
                  ></textarea>
                  <div className="flex items-center mt-1">
                      <label className="font-semibold mr-1 whitespace-nowrap">HISTORY GIVEN BY : PATIENT / SURROGATE. IF SURROGATE, NAME :</label>
                      <input type="text" value={recordData.historyGivenByName} onChange={(e) => handleInputChange(e, 'historyGivenByName')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none mr-2" />
                      <label className="font-semibold mr-1">RELATION :</label>
                      <input type="text" value={recordData.historyGivenByRelation} onChange={(e) => handleInputChange(e, 'historyGivenByRelation')} className="w-1/4 p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
              </div>

               {/* Medical Reconciliation & Medications Table */}
              <div className="border border-gray-300 rounded-md overflow-hidden mb-2">
                  <label htmlFor="medicalReconciliation" className="font-bold text-center p-1 bg-blue-100 uppercase block">MEDICAL RECONCILIATION :</label>
                  <textarea
                      id="medicalReconciliation"
                      value={recordData.medicalReconciliation}
                      onChange={(e) => handleInputChange(e, 'medicalReconciliation')}
                      className="w-full h-10 p-[2px] border-b border-gray-300 focus:outline-none resize-none"
                  ></textarea>
                  <div className={`grid ${medicationCols} bg-gray-200 font-bold text-center`}>
                      <div className="p-1 border-r border-b border-gray-300">Sr. No.</div>
                      <div className="p-1 border-r border-b border-gray-300">Medication Name (Generic) IN CAPITALS</div>
                      <div className="p-1 border-r border-b border-gray-300">Dose</div>
                      <div className="p-1 border-r border-b border-gray-300">Route</div>
                      <div className="p-1 border-r border-b border-gray-300">Freq.</div>
                      <div className="p-1 border-r border-b border-gray-300">Date</div>
                      <div className="p-1 border-b border-gray-300 text-[8px]">Omit (O), Continue (C) Withhold (WH) Reasons</div>
                  </div>
                  {recordData.medicationsTable.map((row, index) => (
                      <div key={index} className={`grid ${medicationCols} text-center border-t border-gray-300`}>
                          <div className="p-1 border-r border-gray-300 bg-gray-50">{row.srNo}</div>
                          <input type="text" value={row.medicationName} onChange={(e) => handleMedicationChange(e, index, 'medicationName')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <input type="text" value={row.dose} onChange={(e) => handleMedicationChange(e, index, 'dose')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <input type="text" value={row.route} onChange={(e) => handleMedicationChange(e, index, 'route')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <input type="text" value={row.freq} onChange={(e) => handleMedicationChange(e, index, 'freq')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <input type="date" value={row.date} onChange={(e) => handleMedicationChange(e, index, 'date')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <textarea value={row.omitContinueWithholdReasons} onChange={(e) => handleMedicationChange(e, index, 'omitContinueWithholdReasons')} className="p-1 focus:outline-none resize-none h-auto min-h-[30px]" rows={1}/>
                      </div>
                  ))}
              </div>

              {/* Admitted Under / Reference (bottom repeated) */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <div className="flex items-center">
                      <label className="font-semibold w-24">Admitted Under:</label>
                      <input type="text" value={recordData.admittedUnderBottom} onChange={(e) => handleInputChange(e, 'admittedUnderBottom')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                  <div className="flex items-center">
                      <label className="font-semibold w-24">Reference:</label>
                      <input type="text" value={recordData.referenceBottom} onChange={(e) => handleInputChange(e, 'referenceBottom')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
              </div>

          </div>

          {/* Right Column (Image 2 sections) */}
          <div>
              {/* Treatment Orders Table */}
              <div className="border border-gray-300 rounded-md overflow-hidden mb-2">
                  <h2 className="font-bold text-center p-1 bg-blue-100 uppercase">Treatment Orders</h2>
                  <div className={`grid ${treatmentOrderCols} bg-gray-200 font-bold text-center`}>
                      <div className="p-1 border-r border-b border-gray-300">Sr. No.</div>
                      <div className="p-1 border-r border-b border-gray-300">Orders By</div>
                      <div className="p-1 border-r border-b border-gray-300">Medication Name</div>
                      <div className="p-1 border-r border-b border-gray-300">Dose</div>
                      <div className="p-1 border-r border-b border-gray-300">Route</div>
                      <div className="p-1 border-r border-b border-gray-300">Freq.</div>
                      <div className="p-1 border-r border-b border-gray-300 text-[8px]">Administration Record (Time & Name of Station)</div>
                      <div className="p-1 border-b border-gray-300">Counter Verification</div>
                  </div>
                  {recordData.treatmentOrders.map((order, index) => (
                      <div key={index} className={`grid ${treatmentOrderCols} text-center border-t border-gray-300`}>
                          <div className="p-1 border-r border-gray-300 bg-gray-50">{order.srNo}</div>
                          <input type="text" value={order.ordersBy} onChange={(e) => handleTreatmentOrderChange(e, index, 'ordersBy')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <input type="text" value={order.medicationName} onChange={(e) => handleTreatmentOrderChange(e, index, 'medicationName')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <input type="text" value={order.dose} onChange={(e) => handleTreatmentOrderChange(e, index, 'dose')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <input type="text" value={order.route} onChange={(e) => handleTreatmentOrderChange(e, index, 'route')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <input type="text" value={order.freq} onChange={(e) => handleTreatmentOrderChange(e, index, 'freq')} className="p-1 border-r border-gray-300 focus:outline-none" />
                          <div className="flex items-center border-r border-gray-300">
                              <span className="w-4 border-r border-gray-300 h-full flex items-center justify-center p-[2px]">T</span>
                              <input type="text" value={order.adminRecordT} onChange={(e) => handleTreatmentOrderChange(e, index, 'adminRecordT')} className="w-1/2 p-[2px] border-r border-gray-300 focus:outline-none" />
                              <span className="w-4 border-r border-gray-300 h-full flex items-center justify-center p-[2px]">N</span>
                              <input type="text" value={order.adminRecordN} onChange={(e) => handleTreatmentOrderChange(e, index, 'adminRecordN')} className="w-1/2 p-[2px] focus:outline-none" />
                          </div>
                          <input type="text" value={order.counterVerification} onChange={(e) => handleTreatmentOrderChange(e, index, 'counterVerification')} className="p-1 focus:outline-none" />
                      </div>
                  ))}
              </div>

              {/* Bed Sore */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <div className="flex items-center">
                      <label className="font-semibold mr-2">BED SORE :</label>
                      <label className="flex items-center mr-2">
                          <input type="radio" name="bedSore" value="Yes" checked={recordData.bedSoreYes} onChange={() => handleGroupChange('bedSore', 'bedSoreYes', true)} className="mr-[2px]" />
                          Y
                      </label>
                      <label className="flex items-center mr-2">
                          <input type="radio" name="bedSore" value="No" checked={recordData.bedSoreNo} onChange={() => handleGroupChange('bedSore', 'bedSoreNo', true)} className="mr-[2px]" />
                          N
                      </label>
                      {recordData.bedSoreYes && (
                          <>
                              <label className="font-semibold mr-1">If Yes, Location:</label>
                              <input type="text" value={recordData.bedSoreLocation} onChange={(e) => handleInputChange(e, 'bedSoreLocation')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                          </>
                      )}
                  </div>
              </div>

              {/* Provisional Diagnosis / Advice on Transfer / Discharge */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <label htmlFor="provisionalDiagnosisAdvice" className="font-semibold block mb-1 uppercase">PROVISIONAL DIAGNOSIS / ADVICE ON TRANSFER / DISCHARGE :</label>
                  <textarea
                      id="provisionalDiagnosisAdvice"
                      value={recordData.provisionalDiagnosisAdvice}
                      onChange={(e) => handleInputChange(e, 'provisionalDiagnosisAdvice')}
                      className="w-full h-20 p-[2px] border-none focus:outline-none resize-none"
                  ></textarea>
              </div>

              {/* Diet / Fluid List */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <label className="font-semibold block mb-1 uppercase">DIET : NBM / FD / DD / SRD / RENTAL / RT OR PEG FEEDS</label>
                  <div className="flex flex-wrap items-center gap-x-2">
                      <label className="flex items-center">
                          <input type="checkbox" checked={recordData.dietNbm} onChange={(e) => handleGroupChange('diet', 'dietNbm', e.target.checked)} className="mr-[2px]" /> NBM
                      </label>
                      <label className="flex items-center">
                          <input type="checkbox" checked={recordData.dietFd} onChange={(e) => handleGroupChange('diet', 'dietFd', e.target.checked)} className="mr-[2px]" /> FD
                      </label>
                      <label className="flex items-center">
                          <input type="checkbox" checked={recordData.dietDd} onChange={(e) => handleGroupChange('diet', 'dietDd', e.target.checked)} className="mr-[2px]" /> DD
                      </label>
                      <label className="flex items-center">
                          <input type="checkbox" checked={recordData.dietSrd} onChange={(e) => handleGroupChange('diet', 'dietSrd', e.target.checked)} className="mr-[2px]" /> SRD
                      </label>
                      <label className="flex items-center">
                          <input type="checkbox" checked={recordData.dietRental} onChange={(e) => handleGroupChange('diet', 'dietRental', e.target.checked)} className="mr-[2px]" /> RENTAL
                      </label>
                      <label className="flex items-center">
                          <input type="checkbox" checked={recordData.dietRtOrPegFeeds} onChange={(e) => handleGroupChange('diet', 'dietRtOrPegFeeds', e.target.checked)} className="mr-[2px]" /> RT OR PEG FEEDS
                      </label>
                  </div>
                  <div className="flex items-center mt-1">
                      <label className="font-semibold w-24">LAST MEAL TIME :</label>
                      <input type="text" value={recordData.lastMealTime} onChange={(e) => handleInputChange(e, 'lastMealTime')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                  <div className="flex items-center mt-1">
                      <label className="font-semibold w-24">OPD TREATMENT :</label>
                      <input type="text" value={recordData.opdTreatment} onChange={(e) => handleInputChange(e, 'opdTreatment')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                   <div className="flex items-center mt-1">
                      <label className="flex items-center mr-2">
                          <input type="checkbox" checked={recordData.admissionCheckbox} onChange={(e) => handleInputChange(e, 'admissionCheckbox')} className="mr-[2px]" />
                          ADMISSION
                      </label>
                      <label className="flex items-center mr-2">
                          <input type="checkbox" checked={recordData.admissionAdvised} onChange={(e) => handleInputChange(e, 'admissionAdvised')} className="mr-[2px]" />
                          ADVISED
                      </label>
                      <label className="flex items-center">
                          <input type="checkbox" checked={recordData.admissionIcu} onChange={(e) => handleInputChange(e, 'admissionIcu')} className="mr-[2px]" />
                          ICU
                      </label>
                  </div>
                   <div className="flex items-center mt-1">
                      <label className="font-semibold mr-1">ADMISSION REFUSED BY PATIENT & RELATIVES :</label>
                      <input type="text" value={recordData.admissionRefusedByPatientAndRelatives} onChange={(e) => handleInputChange(e, 'admissionRefusedByPatientAndRelatives')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
              </div>

              {/* Patient & Family Education Documentation Information */}
              <div className="border border-gray-300 p-2 space-y-1 mb-2">
                  <label htmlFor="patientFamilyEducationInfo" className="font-semibold block mb-1 uppercase">PATIENT & FAMILY EDUCATION DOCUMENTATION INFORMATION</label>
                  <textarea
                      id="patientFamilyEducationInfo"
                      value={recordData.patientFamilyEducationInfo}
                      onChange={(e) => handleInputChange(e, 'patientFamilyEducationInfo')}
                      placeholder="(disease process, treatment plan, life style modification, plan management, rehabilitation, etc)"
                      className="w-full h-16 p-[2px] border-none focus:outline-none resize-none"
                  ></textarea>
              </div>

              {/* Consent of Patient / Family */}
              <div className="border border-gray-300 p-2 space-y-1">
                  <h3 className="font-bold text-sm mb-1 uppercase text-center">CONSENT OF PATIENT / FAMILY</h3>
                  <div className="flex items-center mb-1">
                      <label className="flex items-center mr-4">
                          <input type="checkbox" checked={recordData.consentPositive} onChange={(e) => handleInputChange(e, 'consentPositive')} className="mr-[2px]" />
                          POSITIVE
                      </label>
                      <label className="flex items-center">
                          <input type="checkbox" checked={recordData.consentNegative} onChange={(e) => handleInputChange(e, 'consentNegative')} className="mr-[2px]" />
                          NEGATIVE
                      </label>
                  </div>
                  <div className="flex items-center">
                      <label className="font-semibold mr-1">Valuables :</label>
                      <input type="text" value={recordData.consentValuables} onChange={(e) => handleInputChange(e, 'consentValuables')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                  <div className="flex items-center mt-1">
                      <label className="font-semibold mr-1">Handed Over To:</label>
                      <input type="text" value={recordData.handedOverTo} onChange={(e) => handleInputChange(e, 'handedOverTo')} className="w-1/2 p-[2px] border-b border-gray-300 focus:outline-none mr-2" />
                      <label className="font-semibold mr-1">Name & Sign.</label>
                      <input type="text" value={recordData.handedOverToNameSign} onChange={(e) => handleInputChange(e, 'handedOverToNameSign')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                   <div className="flex items-center mt-1">
                      <label className="font-semibold mr-1">Patient / Relative Name :</label>
                      <input type="text" value={recordData.patientRelativeNameConsent} onChange={(e) => handleInputChange(e, 'patientRelativeNameConsent')} className="w-1/2 p-[2px] border-b border-gray-300 focus:outline-none mr-2" />
                      <label className="font-semibold mr-1">Relation :</label>
                      <input type="text" value={recordData.patientRelativeRelationConsent} onChange={(e) => handleInputChange(e, 'patientRelativeRelationConsent')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                  <div className="flex items-center mt-1">
                      <label className="font-semibold mr-1">CMO Name :</label>
                      <input type="text" value={recordData.cmoName} onChange={(e) => handleInputChange(e, 'cmoName')} className="w-1/2 p-[2px] border-b border-gray-300 focus:outline-none mr-2" />
                      <label className="font-semibold mr-1">Sign :</label>
                      <input type="text" value={recordData.cmoSign} onChange={(e) => handleInputChange(e, 'cmoSign')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-4 gap-x-2 items-center mt-1">
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Reg. No. :</label>
                          <input type="text" value={recordData.regNoConsent} onChange={(e) => handleInputChange(e, 'regNoConsent')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Date :</label>
                          <input type="date" value={recordData.regDateConsent} onChange={(e) => handleInputChange(e, 'regDateConsent')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Time :</label>
                          <input type="time" value={recordData.regTimeConsent} onChange={(e) => handleInputChange(e, 'regTimeConsent')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                      <div className="flex items-center col-span-1">
                          <label className="font-semibold mr-1">Sign :</label>
                          <input type="text" value={recordData.regSignConsent} onChange={(e) => handleInputChange(e, 'regSignConsent')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                      </div>
                  </div>
                  <div className="flex items-center mt-1">
                      <label className="font-semibold mr-1">Handover Given To :</label>
                      <input type="text" value={recordData.handoverGivenToFinal} onChange={(e) => handleInputChange(e, 'handoverGivenToFinal')} className="w-1/2 p-[2px] border-b border-gray-300 focus:outline-none mr-2" />
                      <label className="font-semibold mr-1">Sign :</label>
                      <input type="text" value={recordData.handoverGivenToFinalSign} onChange={(e) => handleInputChange(e, 'handoverGivenToFinalSign')} className="flex-grow p-[2px] border-b border-gray-300 focus:outline-none" />
                  </div>
              </div>

          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 mt-6 print:hidden">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            "Save Emergency Care Record"
          )}
        </button>
        <PdfGenerator contentRef={contentRef as React.RefObject<HTMLDivElement>} fileName="EmergencyCareRecordSheet"  />
      </div>

    </div>
  );
};

export default EmergencyCareRecordSheet;