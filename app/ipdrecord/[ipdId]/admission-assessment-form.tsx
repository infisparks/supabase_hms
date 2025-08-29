"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

// --- Type Definitions ---
interface PatientAdmissionData {
  // Patient Header
  patientName: string;
  ageSex: string;
  roomWardNo: string;
  uhidNo: string;
  ipdNo: string;
  doa: string;
  consultant: string;

  // Date of Assessment (1)
  assessmentDate1: string;
  arrivalBy: { walking: boolean; wheelchair: boolean; stretcher: boolean; };
  admittedFrom: { home: boolean; clinic: boolean; nursingHome: boolean; casualty: boolean; };
  belongingsHandedToRelative: { yes: boolean; no: boolean; };
  informantName: string;
  relationship: string;

  // Date of Assessment (2)
  assessmentDate2: string;
  allergies: { yes: boolean; no: boolean; };
  allergiesIfYes: string;
  latexAllergy: { yes: boolean; no: boolean; };
  medications: { yes: boolean; no: boolean; };
  medicationsIfYes: string;
  food: { yes: boolean; no: boolean; };
  habits: { alcohol: boolean; smoking: boolean; };
  medicalHistory: {
    noProblems: boolean; hypertension: boolean; ischemicHeartDisease: boolean;
    kidneyBladderProblem: boolean; stroke: boolean; stomachBowelProblems: boolean;
    diabetes: boolean; recentExposureToContagiousDisease: boolean;
  };

  // Pregnancy & Illness
  onAnyMedications: { yes: boolean; no: boolean; };
  areYouPregnant: { notApplicable: boolean; yes: boolean; no: boolean; };
  lmp: string;
  majorIllness: string;
  majorIllnessDate: string;

  // Implants & Activity
  anyImplants: { prosthesis: boolean; pacemaker: boolean; aicd: boolean; anyOther: boolean; };
  activityExercise: { walking: boolean; walker: boolean; cane: boolean; other: boolean; };
  requiresAssistingDevices: { yes: boolean; no: boolean; };
  difficultyWithADL: { no: boolean; yes: boolean; };
  adlBathing: boolean; adlToileting: boolean; adlActivitiesDailyLiving: boolean;
  adlClimbingStairs: boolean; adlWalking: boolean; adlFeeding: boolean;
  adlHouseChores: boolean;

  // Neurologic
  neurologicSpeech: { clear: boolean; slurred: boolean; };
  loc: { oriented: boolean; drowsy: boolean; sedated: boolean; unresponsive: boolean;
    afterLimited: boolean; disoriented: boolean; other: boolean; hearingImpairment: boolean; noLimitations: boolean;
  };
  gcs: string;
  painAssessmentScore: string;
  painLocation: string;

  // Cardiovascular Assessments
  cardioColour: { pink: boolean; pale: boolean; cyanotic: boolean; };
  cardioVitalsRhythm: { rhythm: boolean; }; // Vitals
  cardioVitalsBP: { bp: string; }; // Vitals
  cardioSteth: { warm: boolean; cold: boolean; };
  cardioPedalPulse: { feeble: boolean; absent: boolean; };
  cardioEdema: { absent: boolean; present: boolean; ifPresentSite: string; };
  cardioChestPain: { absent: boolean; present: boolean; };
  cardioDVT: { none: boolean; low: boolean; med: boolean; high: boolean; };

  // Respiratory Assessment
  respirations: { regular: boolean; labored: boolean; nonLabored: boolean; useOfAccessoryMuscles: boolean; };
  respiratoryRate: string;
  o2Saturation: string;
  onAuscultation: { airEntry: boolean; equal: boolean; unequal: boolean; };
  respiratoryFood: { no: boolean; yes: boolean; };
  respiratoryFoodIfYes: string;
  abnormalBreathSound: string;
  cough: { absent: boolean; present: boolean; productive: boolean; nonProductive: boolean; };
  coughSinceWhen: string;
  secretions: { frequent: boolean; occasional: boolean; purulent: boolean; mucopurulent: boolean; };

  // Urinary System
  urinaryVoiding: { no: boolean; yes: boolean; };
  urinaryIfVoiding: { anuric: boolean; incontinent: boolean; catheter: boolean; avFistulaOther: string; };
  urinarySection: { urine: string; clear: boolean; cloudy: boolean; sediments: boolean; yellow: boolean; uLine: boolean; concentrated: boolean; other: boolean; };

  // Gastrointestinal System
  abdomen: { soft: boolean; tender: boolean; guarding: boolean; spasmodic: boolean; };
  diet: { normal: boolean; lfd: boolean; srd: boolean; diabeticDiet: boolean; };
  bowelSounds: { present: boolean; absent: boolean; };
  lastBowelMovement: string;

  // Musculoskeletal Assessment
  rangeOfMotionToAllExtremities: { yes: boolean; no: boolean; };
  musculoSpecify: string;
  presentSwellingTenderess: { yes: boolean; no: boolean; };
  musculoIfPresent: string;

  // Integumentary System
  integumentColour: { cool: boolean; warm: boolean; };
  integumentVitals: string; // Vitals input
  integumentCrurn: { intact: boolean; redness: boolean; peelSore: boolean; };
  integumentCrurnHeel: { intact: boolean; redness: boolean; peelSore: boolean; };
  leftArm: string;
  rightArm: string;
  leftLeg: string;
  rightLeg: string;
  pressureSoreSize: string;
  pressureSoreHealing: { healing: boolean; nonHealing: boolean; };
  bradenScore: string;

  // Footer
  footerAt: string;
  footerTime: string;
  footerRnName: string;
  footerRnSign: string; // Will hold PIN or signature URL
  footerOC: boolean;
  footerGCS: boolean;
  footerDVT: boolean;
}

// --- Initial State for the Form ---
const initialPatientAdmissionData: PatientAdmissionData = {
  // Patient Header
  patientName: '',
  ageSex: '',
  roomWardNo: '',
  uhidNo: '',
  ipdNo: '',
  doa: '',
  consultant: '',

  // Date of Assessment (1)
  assessmentDate1: '',
  arrivalBy: { walking: false, wheelchair: false, stretcher: false, },
  admittedFrom: { home: false, clinic: false, nursingHome: false, casualty: false, },
  belongingsHandedToRelative: { yes: false, no: false, },
  informantName: '',
  relationship: '',

  // Date of Assessment (2)
  assessmentDate2: '',
  allergies: { yes: false, no: false, },
  allergiesIfYes: '',
  latexAllergy: { yes: false, no: false, },
  medications: { yes: false, no: false, },
  medicationsIfYes: '',
  food: { yes: false, no: false, },
  habits: { alcohol: false, smoking: false, },
  medicalHistory: {
    noProblems: false, hypertension: false, ischemicHeartDisease: false,
    kidneyBladderProblem: false, stroke: false, stomachBowelProblems: false,
    diabetes: false, recentExposureToContagiousDisease: false,
  },

  // Pregnancy & Illness
  onAnyMedications: { yes: false, no: false, },
  areYouPregnant: { notApplicable: false, yes: false, no: false, },
  lmp: '',
  majorIllness: '',
  majorIllnessDate: '',

  // Implants & Activity
  anyImplants: { prosthesis: false, pacemaker: false, aicd: false, anyOther: false, },
  activityExercise: { walking: false, walker: false, cane: false, other: false, },
  requiresAssistingDevices: { yes: false, no: false, },
  difficultyWithADL: { no: false, yes: false, },
  adlBathing: false, adlToileting: false, adlActivitiesDailyLiving: false,
  adlClimbingStairs: false, adlWalking: false, adlFeeding: false,
  adlHouseChores: false,

  // Neurologic
  neurologicSpeech: { clear: false, slurred: false, },
  loc: { oriented: false, drowsy: false, sedated: false, unresponsive: false,
    afterLimited: false, disoriented: false, other: false, hearingImpairment: false, noLimitations: false
  },
  gcs: '',
  painAssessmentScore: '',
  painLocation: '',

  // Cardiovascular Assessments
  cardioColour: { pink: false, pale: false, cyanotic: false, },
  cardioVitalsRhythm: { rhythm: false, },
  cardioVitalsBP: { bp: '', },
  cardioSteth: { warm: false, cold: false, },
  cardioPedalPulse: { feeble: false, absent: false, },
  cardioEdema: { absent: false, present: false, ifPresentSite: '', },
  cardioChestPain: { absent: false, present: false, },
  cardioDVT: { none: false, low: false, med: false, high: false, },

  // Respiratory Assessment
  respirations: { regular: false, labored: false, nonLabored: false, useOfAccessoryMuscles: false, },
  respiratoryRate: '',
  o2Saturation: '',
  onAuscultation: { airEntry: false, equal: false, unequal: false, },
  respiratoryFood: { no: false, yes: false, },
  respiratoryFoodIfYes: '',
  abnormalBreathSound: '',
  cough: { absent: false, present: false, productive: false, nonProductive: false, },
  coughSinceWhen: '',
  secretions: { frequent: false, occasional: false, purulent: false, mucopurulent: false, },

  // Urinary System
  urinaryVoiding: { no: false, yes: false, },
  urinaryIfVoiding: { anuric: false, incontinent: false, catheter: false, avFistulaOther: '', },
  urinarySection: { urine: '', clear: false, cloudy: false, sediments: false, yellow: false, uLine: false, concentrated: false, other: false, },

  // Gastrointestinal System
  abdomen: { soft: false, tender: false, guarding: false, spasmodic: false, },
  diet: { normal: false, lfd: false, srd: false, diabeticDiet: false, },
  bowelSounds: { present: false, absent: false, },
  lastBowelMovement: '',

  // Musculoskeletal Assessment
  rangeOfMotionToAllExtremities: { yes: false, no: false, },
  musculoSpecify: '',
  presentSwellingTenderess: { yes: false, no: false, },
  musculoIfPresent: '',

  // Integumentary System
  integumentColour: { cool: false, warm: false, },
  integumentVitals: '',
  integumentCrurn: { intact: false, redness: false, peelSore: false, },
  integumentCrurnHeel: { intact: false, redness: false, peelSore: false, },
  leftArm: '',
  rightArm: '',
  leftLeg: '',
  rightLeg: '',
  pressureSoreSize: '',
  pressureSoreHealing: { healing: false, nonHealing: false, },
  bradenScore: '',

  // Footer
  footerAt: '',
  footerTime: '',
  footerRnName: '',
  footerRnSign: '',
  footerOC: false,
  footerGCS: false,
  footerDVT: false,
};

// --- Main Component ---
const PatientAdmissionAssessmentSheet = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<PatientAdmissionData>(initialPatientAdmissionData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingSignature, setIsVerifyingSignature] = useState(false);

  // --- Data Fetching Function ---
  const fetchAssessmentData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('admission_assessment_data')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.admission_assessment_data) {
        setFormData(data.admission_assessment_data as PatientAdmissionData);
        toast.success("Previous assessment data loaded.");
      }
    } catch (error) {
      console.error("Failed to fetch assessment data:", error);
      toast.error("Failed to load assessment data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchAssessmentData();
  }, [ipdId, fetchAssessmentData]);

  // --- Signature Verification Function ---
  const checkAndSetSignature = useCallback(async (password: string) => {
    if (password.length !== 10) return;
    setIsVerifyingSignature(true);
    try {
      const { data, error } = await supabase
        .from('signature')
        .select('signature_url')
        .eq('password', password)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;

      if (data?.signature_url) {
        setFormData(prev => ({ ...prev, footerRnSign: data.signature_url }));
        toast.success(`Signature verified successfully.`);
      } else {
        toast.error(`Invalid signature PIN.`);
      }
    } catch (error) {
      console.error("Error verifying signature:", error);
      toast.error("Could not verify signature.");
    } finally {
        setIsVerifyingSignature(false);
    }
  }, []);

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

      const dataToSave = { ...formData };
      // Clear unsaved PIN before saving
      if (dataToSave.footerRnSign.length === 10 && !dataToSave.footerRnSign.startsWith('http')) {
        dataToSave.footerRnSign = '';
      }

      const { error } = await supabase.from('ipd_record').upsert({
        ipd_id: ipdId,
        user_id: session.user.id,
        admission_assessment_data: dataToSave,
      }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("Assessment form saved successfully!");
    } catch (error) {
      console.error("Failed to save assessment data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Input Change Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, field: keyof PatientAdmissionData) => {
    const { value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    // @ts-ignore - 'checked' exists on HTMLInputElement
    const checked = e.target.checked;
    
    const finalValue = isCheckbox ? checked : value;
    
    setFormData(prevData => ({ ...prevData, [field]: finalValue }));

    if (field === 'footerRnSign' && typeof value === 'string' && value.length === 10) {
        checkAndSetSignature(value);
    }
  };
  
  const handleSignatureReset = () => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
        setFormData(prev => ({...prev, footerRnSign: ''}));
        toast.info("Signature has been cleared.");
    }
  };


  const handleCheckboxChange = (group: keyof PatientAdmissionData, field: string, checked: boolean) => {
    setFormData(prevData => {
      const newGroup = { ...(prevData[group] as any) };
      // For groups where multiple selections are allowed
      const multiSelectGroups = ['arrivalBy', 'admittedFrom', 'habits', 'medicalHistory', 'anyImplants', 'activityExercise', 'respirations', 'cardioColour', 'cardioSteth', 'cardioPedalPulse', 'cardioChestPain', 'cardioDVT', 'secretions', 'abdomen', 'diet', 'bowelSounds', 'integumentColour', 'integumentCrurn', 'integumentCrurnHeel', 'urinarySection', 'urinaryIfVoiding', 'loc', 'cough'];
      
      if (multiSelectGroups.includes(group)) {
        newGroup[field] = checked;
      } else { // For groups that act like radios but are checkboxes
          for (let key in newGroup) {
              (newGroup as any)[key] = (key === field) ? checked : false;
          }
      }
      return { ...prevData, [group]: newGroup };
    });
  };

  const handleRadioChange = (group: keyof PatientAdmissionData, field: string, value: boolean) => {
    setFormData(prevData => {
      const newGroup = { ...(prevData[group] as any) };
      for (const key in newGroup) {
        if(typeof newGroup[key] === 'boolean'){
            newGroup[key] = false;
        }
      }
      newGroup[field] = value;
      return { ...prevData, [group]: newGroup };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Assessment Form...</p>
      </div>
    );
  }

  const sectionClass = "border border-gray-300 rounded-md p-4 mb-4";
  const labelClass = "font-semibold mb-1";
  const inputClass = "w-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";
  const checkboxGroupClass = "grid grid-cols-2 lg:grid-cols-4 gap-2";

  const renderRadioGroup = (group: keyof PatientAdmissionData, options: string[], labels: string[]) => (
    <div className="flex items-center space-x-4 mt-2">
      {options.map((option, index) => (
        <label key={option} className="flex items-center">
          <input
            type="radio"
            name={String(group)}
            checked={(formData[group] as any)[option]}
            onChange={() => handleRadioChange(group, option, true)}
            className="mr-2"
          />
          {labels[index]}
        </label>
      ))}
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-full mx-auto font-sans text-xs">
      {/* Patient Header */}
      <div className="border border-gray-300 p-4 rounded-md mb-4">
        <h2 className="font-bold text-xl uppercase mb-2">Patient Admission Assessment Form (NURSING)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center">
            <span className="font-semibold w-24">Patient Name:</span>
            <input type="text" value={formData.patientName} onChange={(e) => handleInputChange(e, 'patientName')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-16">Age / Sex:</span>
            <input type="text" value={formData.ageSex} onChange={(e) => handleInputChange(e, 'ageSex')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-24">Room / Ward No:</span>
            <input type="text" value={formData.roomWardNo} onChange={(e) => handleInputChange(e, 'roomWardNo')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-16">UHID No:</span>
            <input type="text" value={formData.uhidNo} onChange={(e) => handleInputChange(e, 'uhidNo')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-16">IPD No:</span>
            <input type="text" value={formData.ipdNo} onChange={(e) => handleInputChange(e, 'ipdNo')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-16">D.O.A:</span>
            <input type="date" value={formData.doa} onChange={(e) => handleInputChange(e, 'doa')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
          <div className="flex items-center col-span-full md:col-span-2">
            <span className="font-semibold w-24">Consultant:</span>
            <input type="text" value={formData.consultant} onChange={(e) => handleInputChange(e, 'consultant')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
        </div>
      </div>
      
      {/* Date of Assessment Section 1 */}
      <div className={sectionClass}>
        <label className={labelClass}>Date of Assessment:</label>
        <input type="date" value={formData.assessmentDate1} onChange={(e) => handleInputChange(e, 'assessmentDate1')} className={inputClass + " mb-2"} />
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          <div>
            <span className={labelClass}>Arrival to unit by:</span>
            <div className="space-y-1 mt-1">
              <label className="flex items-center">
                <input type="checkbox" checked={formData.arrivalBy.walking} onChange={(e) => handleCheckboxChange('arrivalBy', 'walking', e.target.checked)} className="mr-2" /> Walking
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={formData.arrivalBy.wheelchair} onChange={(e) => handleCheckboxChange('arrivalBy', 'wheelchair', e.target.checked)} className="mr-2" /> Wheel Chair
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={formData.arrivalBy.stretcher} onChange={(e) => handleCheckboxChange('arrivalBy', 'stretcher', e.target.checked)} className="mr-2" /> Stretcher
              </label>
            </div>
          </div>
          <div>
            <span className={labelClass}>Admitted from:</span>
            <div className="space-y-1 mt-1">
              <label className="flex items-center">
                <input type="checkbox" checked={formData.admittedFrom.home} onChange={(e) => handleCheckboxChange('admittedFrom', 'home', e.target.checked)} className="mr-2" /> Home
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={formData.admittedFrom.clinic} onChange={(e) => handleCheckboxChange('admittedFrom', 'clinic', e.target.checked)} className="mr-2" /> Clinic
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={formData.admittedFrom.nursingHome} onChange={(e) => handleCheckboxChange('admittedFrom', 'nursingHome', e.target.checked)} className="mr-2" /> Nursing Home
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={formData.admittedFrom.casualty} onChange={(e) => handleCheckboxChange('admittedFrom', 'casualty', e.target.checked)} className="mr-2" /> Casualty
              </label>
            </div>
          </div>
          <div>
            <span className={labelClass}>Patient Belonging Handed to Relative:</span>
            <div className="space-y-1 mt-1">
              <label className="flex items-center">
                <input type="radio" name="belongings" checked={formData.belongingsHandedToRelative.yes} onChange={() => handleRadioChange('belongingsHandedToRelative', 'yes', true)} className="mr-2" /> Yes
              </label>
              <label className="flex items-center">
                <input type="radio" name="belongings" checked={formData.belongingsHandedToRelative.no} onChange={() => handleRadioChange('belongingsHandedToRelative', 'no', true)} className="mr-2" /> No
              </label>
            </div>
          </div>
          <div>
            <div className="flex items-center mb-2">
              <span className="font-semibold w-24">Informant Name:</span>
              <input type="text" value={formData.informantName} onChange={(e) => handleInputChange(e, 'informantName')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
            </div>
            <div className="flex items-center">
              <span className="font-semibold w-24">Relationship:</span>
              <input type="text" value={formData.relationship} onChange={(e) => handleInputChange(e, 'relationship')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Date of Assessment Section 2 */}
      <div className={sectionClass}>
        <label className={labelClass}>Date of Assessment:</label>
        <input type="date" value={formData.assessmentDate2} onChange={(e) => handleInputChange(e, 'assessmentDate2')} className={inputClass + " mb-2"} />
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          <div>
            <span className={labelClass}>Any Allergies:</span>
            <div className="space-y-1 mt-1">
              <label className="flex items-center">
                <input type="radio" name="allergies" checked={formData.allergies.yes} onChange={() => handleRadioChange('allergies', 'yes', true)} className="mr-2" /> Yes
              </label>
              <label className="flex items-center">
                <input type="radio" name="allergies" checked={formData.allergies.no} onChange={() => handleRadioChange('allergies', 'no', true)} className="mr-2" /> No
              </label>
              {formData.allergies.yes && (
                <textarea value={formData.allergiesIfYes} onChange={(e) => handleInputChange(e, 'allergiesIfYes')} placeholder="If yes, provide details..." className="w-full h-10 p-1 border border-gray-300 rounded focus:outline-none resize-none" />
              )}
            </div>
          </div>
          <div>
            <span className={labelClass}>Latex Allergy:</span>
            <div className="space-y-1 mt-1">
              <label className="flex items-center">
                <input type="radio" name="latexAllergy" checked={formData.latexAllergy.yes} onChange={() => handleRadioChange('latexAllergy', 'yes', true)} className="mr-2" /> Yes
              </label>
              <label className="flex items-center">
                <input type="radio" name="latexAllergy" checked={formData.latexAllergy.no} onChange={() => handleRadioChange('latexAllergy', 'no', true)} className="mr-2" /> No
              </label>
            </div>
          </div>
          <div>
            <span className={labelClass}>Medications:</span>
            <div className="space-y-1 mt-1">
              <label className="flex items-center">
                <input type="radio" name="medications" checked={formData.medications.yes} onChange={() => handleRadioChange('medications', 'yes', true)} className="mr-2" /> Yes
              </label>
              <label className="flex items-center">
                <input type="radio" name="medications" checked={formData.medications.no} onChange={() => handleRadioChange('medications', 'no', true)} className="mr-2" /> No
              </label>
              {formData.medications.yes && (
                <textarea value={formData.medicationsIfYes} onChange={(e) => handleInputChange(e, 'medicationsIfYes')} placeholder="If yes, provide details..." className="w-full h-10 p-1 border border-gray-300 rounded focus:outline-none resize-none" />
              )}
            </div>
          </div>
          <div>
            <span className={labelClass}>Food:</span>
            {renderRadioGroup('food', ['yes', 'no'], ['Yes', 'No'])}
            <span className={labelClass}>Habits:</span>
            <div className="space-y-1 mt-1">
              <label className="flex items-center">
                <input type="checkbox" checked={formData.habits.alcohol} onChange={(e) => handleCheckboxChange('habits', 'alcohol', e.target.checked)} className="mr-2" /> Alcohol
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={formData.habits.smoking} onChange={(e) => handleCheckboxChange('habits', 'smoking', e.target.checked)} className="mr-2" /> Smoking
              </label>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div className="col-span-full">
            <span className={labelClass}>Medical History:</span>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-1">
              {Object.keys(formData.medicalHistory).map(key => (
                <label key={key} className="flex items-center capitalize">
                  <input type="checkbox" checked={(formData.medicalHistory as any)[key]} onChange={(e) => handleCheckboxChange('medicalHistory', key, e.target.checked)} className="mr-2" />
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pregnancy & Major Illness */}
      <div className={sectionClass}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className={labelClass}>On Any Medications:</span>
            {renderRadioGroup('onAnyMedications', ['yes', 'no'], ['Yes', 'No'])}
          </div>
          <div className="col-span-3">
            <span className={labelClass}>Are You Pregnant:</span>
            <div className="flex items-center space-x-4 mt-2">
              <label className="flex items-center">
                <input type="radio" name="pregnant" checked={formData.areYouPregnant.notApplicable} onChange={() => handleRadioChange('areYouPregnant', 'notApplicable', true)} className="mr-2" /> Not Applicable
              </label>
              <label className="flex items-center">
                <input type="radio" name="pregnant" checked={formData.areYouPregnant.yes} onChange={() => handleRadioChange('areYouPregnant', 'yes', true)} className="mr-2" /> Yes
              </label>
              <label className="flex items-center">
                <input type="radio" name="pregnant" checked={formData.areYouPregnant.no} onChange={() => handleRadioChange('areYouPregnant', 'no', true)} className="mr-2" /> No
              </label>
              <span className="font-semibold">LMP:</span>
              <input type="text" value={formData.lmp} onChange={(e) => handleInputChange(e, 'lmp')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
            </div>
          </div>
          <div className="col-span-full mt-2">
            <div className="flex items-center">
              <span className="font-semibold w-40">Major Illness / Surgery / Accidents:</span>
              <input type="text" value={formData.majorIllness} onChange={(e) => handleInputChange(e, 'majorIllness')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
            </div>
            <div className="flex items-center mt-2">
              <span className="font-semibold w-40">Date / Event:</span>
              <input type="text" value={formData.majorIllnessDate} onChange={(e) => handleInputChange(e, 'majorIllnessDate')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Implants & Activity */}
      <div className={sectionClass}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-full">
            <span className={labelClass}>Any Implants:</span>
            <div className="flex items-center space-x-4 mt-1">
              <label className="flex items-center"><input type="checkbox" checked={formData.anyImplants.prosthesis} onChange={(e) => handleCheckboxChange('anyImplants', 'prosthesis', e.target.checked)} className="mr-2" /> Prosthesis</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.anyImplants.pacemaker} onChange={(e) => handleCheckboxChange('anyImplants', 'pacemaker', e.target.checked)} className="mr-2" /> Pacemaker</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.anyImplants.aicd} onChange={(e) => handleCheckboxChange('anyImplants', 'aicd', e.target.checked)} className="mr-2" /> AICD</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.anyImplants.anyOther} onChange={(e) => handleCheckboxChange('anyImplants', 'anyOther', e.target.checked)} className="mr-2" /> Any Other</label>
            </div>
          </div>
          <div className="col-span-full">
            <span className={labelClass}>Activity & Exercise:</span>
            <div className="flex items-center space-x-4 mt-1">
              <label className="flex items-center"><input type="checkbox" checked={formData.activityExercise.walking} onChange={(e) => handleCheckboxChange('activityExercise', 'walking', e.target.checked)} className="mr-2" /> Walking</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.activityExercise.walker} onChange={(e) => handleCheckboxChange('activityExercise', 'walker', e.target.checked)} className="mr-2" /> Walker</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.activityExercise.cane} onChange={(e) => handleCheckboxChange('activityExercise', 'cane', e.target.checked)} className="mr-2" /> Cane</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.activityExercise.other} onChange={(e) => handleCheckboxChange('activityExercise', 'other', e.target.checked)} className="mr-2" /> Other</label>
            </div>
          </div>
          <div className="col-span-full">
            <span className={labelClass}>Requires Assisting Devices:</span>
            {renderRadioGroup('requiresAssistingDevices', ['yes', 'no'], ['Yes', 'No'])}
          </div>
          <div className="col-span-full">
            <span className={labelClass}>Difficulty with *ADL:</span>
            {renderRadioGroup('difficultyWithADL', ['no', 'yes'], ['No', 'Yes'])}
            <div className="flex flex-wrap items-center space-x-4 mt-2">
              <span className="font-semibold mr-2">Activities of Daily Living:</span>
              <label className="flex items-center"><input type="checkbox" checked={formData.adlBathing} onChange={(e) => setFormData({...formData, adlBathing: e.target.checked})} className="mr-2" /> Bathing</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.adlToileting} onChange={(e) => setFormData({...formData, adlToileting: e.target.checked})} className="mr-2" /> Toileting</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.adlClimbingStairs} onChange={(e) => setFormData({...formData, adlClimbingStairs: e.target.checked})} className="mr-2" /> Climbing Stairs</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.adlWalking} onChange={(e) => setFormData({...formData, adlWalking: e.target.checked})} className="mr-2" /> Walking</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.adlFeeding} onChange={(e) => setFormData({...formData, adlFeeding: e.target.checked})} className="mr-2" /> Feeding</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.adlHouseChores} onChange={(e) => setFormData({...formData, adlHouseChores: e.target.checked})} className="mr-2" /> House Chores</label>
            </div>
          </div>
        </div>
      </div>

      {/* Neurologic Assessment */}
      <div className={sectionClass}>
        <h3 className="font-semibold uppercase mb-2">Neurologic Assessment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center mb-2">
              <span className="font-semibold w-24">Speech:</span>
              <div className="flex-grow flex space-x-4">
                <label className="flex items-center"><input type="radio" name="speech" checked={formData.neurologicSpeech.clear} onChange={() => handleRadioChange('neurologicSpeech', 'clear', true)} className="mr-2" /> Clear</label>
                <label className="flex items-center"><input type="radio" name="speech" checked={formData.neurologicSpeech.slurred} onChange={() => handleRadioChange('neurologicSpeech', 'slurred', true)} className="mr-2" /> Slurred</label>
              </div>
            </div>
            <div className="flex items-center mb-2">
              <span className="font-semibold w-24">*LOC</span>
              <div className="flex-grow grid grid-cols-2 gap-2">
                <label className="flex items-center"><input type="checkbox" checked={formData.loc.oriented} onChange={(e) => handleCheckboxChange('loc', 'oriented', e.target.checked)} className="mr-2" /> Oriented</label>
                <label className="flex items-center"><input type="checkbox" checked={formData.loc.drowsy} onChange={(e) => handleCheckboxChange('loc', 'drowsy', e.target.checked)} className="mr-2" /> Drowsy</label>
                <label className="flex items-center"><input type="checkbox" checked={formData.loc.afterLimited} onChange={(e) => handleCheckboxChange('loc', 'afterLimited', e.target.checked)} className="mr-2" /> After / Limited</label>
                <label className="flex items-center"><input type="checkbox" checked={formData.loc.sedated} onChange={(e) => handleCheckboxChange('loc', 'sedated', e.target.checked)} className="mr-2" /> Sedated</label>
                <label className="flex items-center"><input type="checkbox" checked={formData.loc.disoriented} onChange={(e) => handleCheckboxChange('loc', 'disoriented', e.target.checked)} className="mr-2" /> Disoriented</label>
                <label className="flex items-center"><input type="checkbox" checked={formData.loc.unresponsive} onChange={(e) => handleCheckboxChange('loc', 'unresponsive', e.target.checked)} className="mr-2" /> Unresponsive</label>
                <label className="flex items-center"><input type="checkbox" checked={formData.loc.noLimitations} onChange={(e) => handleCheckboxChange('loc', 'noLimitations', e.target.checked)} className="mr-2" /> No Limitations</label>
                <label className="flex items-center"><input type="checkbox" checked={formData.loc.other} onChange={(e) => handleCheckboxChange('loc', 'other', e.target.checked)} className="mr-2" /> Other</label>
                <label className="flex items-center col-span-2"><input type="checkbox" checked={formData.loc.hearingImpairment} onChange={(e) => handleCheckboxChange('loc', 'hearingImpairment', e.target.checked)} className="mr-2" /> Hearing Impairment</label>
              </div>
            </div>
            <div className="flex items-center">
              <span className="font-semibold w-24">*GCS:</span>
              <input type="text" value={formData.gcs} onChange={(e) => handleInputChange(e, 'gcs')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
            </div>
          </div>
        </div>
        <div className="flex items-center mt-4">
          <span className="font-semibold w-48">Pain Assessment Score (From 0-10):</span>
          <input type="text" value={formData.painAssessmentScore} onChange={(e) => handleInputChange(e, 'painAssessmentScore')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none mr-4" />
          <span className="font-semibold w-16">Location:</span>
          <input type="text" value={formData.painLocation} onChange={(e) => handleInputChange(e, 'painLocation')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
        </div>
      </div>

      {/* Cardiovascular Assessments */}
      <div className={sectionClass}>
        <h3 className="font-semibold uppercase mb-2">Cardiovascular Assessments</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-full">
            <span className={labelClass}>Colour:</span>
            {renderRadioGroup('cardioColour', ['pink', 'pale', 'cyanotic'], ['Pink', 'Pale', 'Cyanotic'])}
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-12">Vitals:</span>
            <span className="font-semibold mr-1">Rhythm</span>
            <input type="checkbox" checked={formData.cardioVitalsRhythm.rhythm} onChange={(e) => setFormData({...formData, cardioVitalsRhythm: { rhythm: e.target.checked }})} className="mr-4" />
            <span className="font-semibold mr-1">BP</span>
            <input type="text" value={formData.cardioVitalsBP.bp} onChange={(e) => setFormData({...formData, cardioVitalsBP: { bp: e.target.value }})} className="w-20 border-b border-gray-300 focus:outline-none" />
          </div>
          <div>
            <span className={labelClass}>Stethories:</span>
            {renderRadioGroup('cardioSteth', ['warm', 'cold'], ['Warm', 'Cold'])}
          </div>
          <div>
            <span className={labelClass}>Pedal Pulse Felt:</span>
            {renderRadioGroup('cardioPedalPulse', ['feeble', 'absent'], ['Feeble', 'Absent'])}
          </div>
          <div className="col-span-full">
            <span className={labelClass}>Edema:</span>
            <div className="flex items-center space-x-4 mt-1">
              <label className="flex items-center"><input type="radio" name="edema" checked={formData.cardioEdema.absent} onChange={() => handleRadioChange('cardioEdema', 'absent', true)} className="mr-2" /> Absent</label>
              <label className="flex items-center"><input type="radio" name="edema" checked={formData.cardioEdema.present} onChange={() => handleRadioChange('cardioEdema', 'present', true)} className="mr-2" /> Present</label>
              {formData.cardioEdema.present && (
                <div className="flex-grow flex items-center">
                  <span className="font-semibold mr-2">If Present Site:</span>
                  <input type="text" value={formData.cardioEdema.ifPresentSite} onChange={(e) => setFormData({...formData, cardioEdema: {...formData.cardioEdema, ifPresentSite: e.target.value}})} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
                </div>
              )}
            </div>
          </div>
          <div className="col-span-full">
            <span className={labelClass}>Chest Pain:</span>
            {renderRadioGroup('cardioChestPain', ['absent', 'present'], ['Absent', 'Present'])}
          </div>
          <div className="col-span-full">
            <span className={labelClass}>DVT:</span>
            {renderRadioGroup('cardioDVT', ['none', 'low', 'med', 'high'], ['None', 'Low', 'Med', 'High'])}
          </div>
        </div>
      </div>
      
      {/* Respiratory Assessment */}
      <div className={sectionClass}>
        <h3 className="font-semibold uppercase mb-2">Respiratory Assessment</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-full">
            <span className={labelClass}>Respirations:</span>
            <div className="flex items-center space-x-4 mt-1">
              {Object.keys(formData.respirations).map(key => (
                <label key={key} className="flex items-center capitalize">
                  <input type="checkbox" checked={(formData.respirations as any)[key]} onChange={(e) => handleCheckboxChange('respirations', key, e.target.checked)} className="mr-2" />
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          <div className="flex items-center">
            <span className="font-semibold w-16">RR:</span>
            <input type="text" value={formData.respiratoryRate} onChange={(e) => handleInputChange(e, 'respiratoryRate')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none mr-1" />
            <span className="font-semibold">br/min</span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-24">O2 Saturation:</span>
            <input type="text" value={formData.o2Saturation} onChange={(e) => handleInputChange(e, 'o2Saturation')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
            <span className="font-semibold ml-1">%</span>
          </div>
          <div className="col-span-2">
            <span className={labelClass}>On auscultation:</span>
            <div className="flex items-center space-x-4 mt-1">
              <span className="font-semibold">Air Entry</span>
              <label className="flex items-center"><input type="checkbox" checked={formData.onAuscultation.equal} onChange={(e) => handleCheckboxChange('onAuscultation', 'equal', e.target.checked)} className="mr-2" /> Equal</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.onAuscultation.unequal} onChange={(e) => handleCheckboxChange('onAuscultation', 'unequal', e.target.checked)} className="mr-2" /> Unequal</label>
            </div>
          </div>
        </div>
        <div className="flex items-center mt-2">
          <span className="font-semibold w-16">Food:</span>
          {renderRadioGroup('respiratoryFood', ['no', 'yes'], ['No', 'Yes'])}
          {formData.respiratoryFood.yes && (
            <div className="flex-grow flex items-center ml-4">
              <span className="font-semibold mr-2">If Yes:</span>
              <input type="text" value={formData.respiratoryFoodIfYes} onChange={(e) => handleInputChange(e, 'respiratoryFoodIfYes')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
            </div>
          )}
        </div>
        <div className="flex items-center mt-2">
          <span className="font-semibold w-40">Abnormal Breath Sound:</span>
          <input type="text" value={formData.abnormalBreathSound} onChange={(e) => handleInputChange(e, 'abnormalBreathSound')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
        </div>
        <div className="flex items-center mt-2">
          <span className="font-semibold w-16">Cough:</span>
          <div className="flex-grow flex space-x-4">
            {Object.keys(formData.cough).map(key => (
              <label key={key} className="flex items-center capitalize">
                <input type="checkbox" checked={(formData.cough as any)[key]} onChange={(e) => handleCheckboxChange('cough', key, e.target.checked)} className="mr-2" />
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
            ))}
          </div>
          <span className="font-semibold w-24">Since When:</span>
          <input type="text" value={formData.coughSinceWhen} onChange={(e) => handleInputChange(e, 'coughSinceWhen')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
        </div>
        <div className="flex items-center mt-2">
          <span className="font-semibold w-16">Secretions:</span>
          <div className="flex-grow flex space-x-4">
            {Object.keys(formData.secretions).map(key => (
              <label key={key} className="flex items-center capitalize">
                <input type="checkbox" checked={(formData.secretions as any)[key]} onChange={(e) => handleCheckboxChange('secretions', key, e.target.checked)} className="mr-2" />
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Urinary System */}
      <div className={sectionClass}>
        <h3 className="font-semibold uppercase mb-2">Urinary System</h3>
        <div className="flex items-center mt-2">
          <span className="font-semibold w-24">If Voiding:</span>
          {renderRadioGroup('urinaryVoiding', ['no', 'yes'], ['No', 'Yes'])}
          {formData.urinaryVoiding.yes && (
            <div className="flex-grow flex items-center ml-4 flex-wrap">
              <label className="flex items-center"><input type="checkbox" checked={formData.urinaryIfVoiding.anuric} onChange={(e) => handleCheckboxChange('urinaryIfVoiding', 'anuric', e.target.checked)} className="mr-2" /> Anuric</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.urinaryIfVoiding.incontinent} onChange={(e) => handleCheckboxChange('urinaryIfVoiding', 'incontinent', e.target.checked)} className="mr-2" /> Incontinent</label>
              <label className="flex items-center"><input type="checkbox" checked={formData.urinaryIfVoiding.catheter} onChange={(e) => handleCheckboxChange('urinaryIfVoiding', 'catheter', e.target.checked)} className="mr-2" /> Catheter</label>
              <div className="flex items-center ml-2">
                <span className="font-semibold mr-1">AV Fistula Other:</span>
                <input type="text" value={formData.urinaryIfVoiding.avFistulaOther} onChange={(e) => setFormData({...formData, urinaryIfVoiding: {...formData.urinaryIfVoiding, avFistulaOther: e.target.value}})} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center mt-2 flex-wrap">
          <span className="font-semibold w-16">Urine:</span>
          {Object.keys(formData.urinarySection).filter(k => k !== 'urine').map(key => (
            <label key={key} className="flex items-center mr-4 capitalize">
              <input type="checkbox" checked={(formData.urinarySection as any)[key]} onChange={(e) => handleCheckboxChange('urinarySection', key, e.target.checked)} className="mr-2" />
              {key}
            </label>
          ))}
        </div>
      </div>

      {/* Gastrointestinal System */}
      <div className={sectionClass}>
        <h3 className="font-semibold uppercase mb-2">Gastrointestinal System</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className={labelClass}>Abdomen:</span>
            <div className="flex items-center space-x-4 mt-1">
              {Object.keys(formData.abdomen).map(key => (
                <label key={key} className="flex items-center capitalize">
                  <input type="checkbox" checked={(formData.abdomen as any)[key]} onChange={(e) => handleCheckboxChange('abdomen', key, e.target.checked)} className="mr-2" />
                  {key}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className={labelClass}>Diet:</span>
            <div className="flex items-center space-x-4 mt-1">
              {Object.keys(formData.diet).map(key => (
                <label key={key} className="flex items-center capitalize">
                  <input type="checkbox" checked={(formData.diet as any)[key]} onChange={(e) => handleCheckboxChange('diet', key, e.target.checked)} className="mr-2" />
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center mt-4">
          <span className="font-semibold w-24">Bowel Sounds:</span>
          {renderRadioGroup('bowelSounds', ['present', 'absent'], ['Present', 'Absent'])}
          <span className="font-semibold ml-4 mr-2">Last Bowel Movement (Date / Time):</span>
          <input type="text" value={formData.lastBowelMovement} onChange={(e) => handleInputChange(e, 'lastBowelMovement')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
        </div>
      </div>
      
      {/* Musculoskeletal Assessment */}
      <div className={sectionClass}>
        <h3 className="font-semibold uppercase mb-2">Musculoskeletal Assessment</h3>
        <div className="flex items-center mt-2">
          <span className="font-semibold w-48">Range of Motion To All Extremities:</span>
          {renderRadioGroup('rangeOfMotionToAllExtremities', ['yes', 'no'], ['Yes', 'No'])}
          <span className="font-semibold ml-4 mr-2">Specify:</span>
          <input type="text" value={formData.musculoSpecify} onChange={(e) => handleInputChange(e, 'musculoSpecify')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
        </div>
        <div className="flex items-center mt-2">
          <span className="font-semibold w-48">Present Swelling / Tenderness:</span>
          {renderRadioGroup('presentSwellingTenderess', ['yes', 'no'], ['Yes', 'No'])}
          <span className="font-semibold ml-4 mr-2">If Present:</span>
          <input type="text" value={formData.musculoIfPresent} onChange={(e) => handleInputChange(e, 'musculoIfPresent')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
        </div>
      </div>

      {/* Integumentary System */}
      <div className={sectionClass}>
        <h3 className="font-semibold uppercase mb-2">Integumentary System</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className={labelClass}>Colour:</span>
            {renderRadioGroup('integumentColour', ['cool', 'warm'], ['Cool', 'Warm'])}
          </div>
          <div>
            <div className="flex items-center">
              <span className="font-semibold w-16">Vitals:</span>
              <input type="text" value={formData.integumentVitals} onChange={(e) => handleInputChange(e, 'integumentVitals')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
            </div>
            <div className="flex items-center mt-2">
              <span className="font-semibold w-16">Heel:</span>
              {renderRadioGroup('integumentCrurnHeel', ['intact', 'redness', 'peelSore'], ['Intact', 'Redness', 'Peel/Sore'])}
            </div>
            <div className="flex items-center mt-2">
              <span className="font-semibold w-16">Crurn:</span>
              {renderRadioGroup('integumentCrurn', ['intact', 'redness', 'peelSore'], ['Intact', 'Redness', 'Peel/Sore'])}
            </div>
          </div>
          <div className="col-span-full">
            <span className={labelClass}>L/R</span>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center">
                  <span className="font-semibold w-16">Left Arm:</span>
                  <input type="text" value={formData.leftArm} onChange={(e) => handleInputChange(e, 'leftArm')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none mr-4" />
                </div>
                <div className="flex items-center">
                  <span className="font-semibold w-16">Right Arm:</span>
                  <input type="text" value={formData.rightArm} onChange={(e) => handleInputChange(e, 'rightArm')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none mr-4" />
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center">
                  <span className="font-semibold w-16">Left Leg:</span>
                  <input type="text" value={formData.leftLeg} onChange={(e) => handleInputChange(e, 'leftLeg')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none mr-4" />
                </div>
                <div className="flex items-center">
                  <span className="font-semibold w-16">Right Leg:</span>
                  <input type="text" value={formData.rightLeg} onChange={(e) => handleInputChange(e, 'rightLeg')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none mr-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center mt-4">
          <span className="font-semibold w-24">Pressure Sore:</span>
          <span className="font-semibold mr-2">Size:</span>
          <input type="text" value={formData.pressureSoreSize} onChange={(e) => handleInputChange(e, 'pressureSoreSize')} className="w-1/3 p-1 border-b border-gray-300 focus:outline-none mr-4" />
          <span className="font-semibold mr-2">Healing / Non Healing:</span>
          {renderRadioGroup('pressureSoreHealing', ['healing', 'nonHealing'], ['Healing', 'Non Healing'])}
        </div>
        <div className="mt-4">
          <span className="font-semibold">Moist Braden Risk Assessment Score (ICUs Only)</span>
          <input type="text" value={formData.bradenScore} onChange={(e) => handleInputChange(e, 'bradenScore')} className="w-full p-1 border-b border-gray-300 focus:outline-none" />
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-4 border border-gray-300 rounded-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center">
            <span className="font-semibold w-16">At:</span>
            <input type="text" value={formData.footerAt} onChange={(e) => handleInputChange(e, 'footerAt')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-16">Time:</span>
            <input type="time" value={formData.footerTime} onChange={(e) => handleInputChange(e, 'footerTime')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-24">Name of RN:</span>
            <input type="text" value={formData.footerRnName} onChange={(e) => handleInputChange(e, 'footerRnName')} className="flex-grow p-1 border-b border-gray-300 focus:outline-none" />
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-24">Signature:</span>
            <div className="flex-grow flex items-center justify-center p-1 border-b border-gray-300 h-12">
                 {isVerifyingSignature ? (
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                 ) : formData.footerRnSign.startsWith('http') ? (
                    <img 
                        src={formData.footerRnSign} 
                        alt="Signature"
                        title="Click to remove signature"
                        className="h-10 object-contain cursor-pointer hover:opacity-75"
                        onClick={handleSignatureReset}
                    />
                 ) : (
                    <input
                        type="password"
                        value={formData.footerRnSign}
                        onChange={(e) => handleInputChange(e, 'footerRnSign')}
                        className="w-full text-center focus:outline-none bg-transparent"
                        maxLength={10}
                        placeholder="Enter 10-digit PIN"
                        autoComplete="new-password"
                    />
                 )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4 mt-4">
          <label className="flex items-center"><input type="checkbox" checked={formData.footerOC} onChange={(e) => handleInputChange(e, 'footerOC')} className="mr-2" /> OC: Level of Consciousness</label>
          <label className="flex items-center"><input type="checkbox" checked={formData.footerGCS} onChange={(e) => handleInputChange(e, 'footerGCS')} className="mr-2" /> GCS: Glasgowcoma Scale</label>
          <label className="flex items-center"><input type="checkbox" checked={formData.footerDVT} onChange={(e) => handleInputChange(e, 'footerDVT')} className="mr-2" /> DVT: Deep Vein Thrombosis</label>
        </div>
      </div>
      
      {/* Save Button */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSaving ? ( <> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </> ) : ( "Save Assessment Form" )}
        </button>
      </div>
    </div>
  );
};

export default PatientAdmissionAssessmentSheet;