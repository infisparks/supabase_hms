// Filename: admission-assessment-form.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

// --- Type Definitions ---
interface AdmissionFormData {
  // Page 1
  dateOfAssessment: string;
  arrivalToUnitBy: string[];
  patientBelonging: string[];
  patientBelongingOther: string;
  informantName: string;
  relationShip: string;
  anyAllergies: string;
  allergiesYes: string;
  latexAllergy: string;
  medications: string;
  medicationsYes: string;
  food: string;
  foodYes: string;
  habits: string[];
  habitsOther: string;
  medicalHistory: string[];
  onAnyMedications: string;
  areYouPregnant: string;
  dueDate: string;
  lmp: string;
  majorIllnessSurgeryAccidents: string;
  majorIllnessDateEvent: string;
  anyImplants: string[];
  anyImplantsOther: string;
  activityExercise: string[];
  activityExerciseOther: string;
  difficultyWithADL: string;
  activitiesOfDailyLiving: string[];
  speech: string;
  speechOther: string;
  loc: string;
  locOther: string;
  painAssessmentScore: string;
  painLocation: string;
  gsc: string;
  // Page 2
  cardiovascularColor: string;
  cardiovascularRhythm: string;
  cardiovascularHeartSound: string;
  cardiovascularVicts: string;
  cardiovascularStoriheries: string;
  cardiovascularPedalPulseFelt: string;
  cardiovascularEdema: string;
  cardiovascularEdemaPresentSite: string;
  cardiovascularChestPain: string;
  cardiovascularDVT: string;
  respiratoryRespirations: string;
  respiratoryRr: string;
  respiratoryO2Saturation: string;
  respiratoryOnAuscultation: string;
  respiratoryUseOfAccessoryMuscles: string;
  respiratoryFood: string;
  respiratoryAbnormalBreathSound: string;
  respiratoryCough: string;
  respiratoryCoughType: string;
  respiratorySinceWhen: string;
  respiratorySecretions: string;
  respiratorySecretionsType: string;
  urinaryIfVoding: string;
  urinaryUrine: string;
  gastrointestinalAbdomen: string;
  gastrointestinalDiet: string;
  gastrointestinalBowlSounds: string;
  gastrointestinalLastBowlMovement: string;
  musculoskeletalRangeOfMotion: string;
  musculoskeletalPresentSwelling: string;
  musculoskeletalPresentSwellingSite: string;
  integumentaryColor: string;
  integumentaryVicts: string;
  integumentaryRedness: string;
  integumentaryPeelSore: string;
  integumentaryPressureSore: string;
  integumentaryHealing: string;
  integumentaryBradenRiskScore: string;
  ocTime: string;
  ocNameOfRN: string;
  ocSignature: string;
  ocLevelOfConsciousness: string;
  ocGcs: string;
}

// --- Helper Components for Form Fields ---
const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="border border-gray-300 p-4 rounded-md">
        <h2 className="font-bold text-lg mb-4 text-gray-700">{title}</h2>
        {children}
    </div>
);

const Checkbox: React.FC<{ name: string; value: string; label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ name, value, label, checked, onChange }) => (
    <label className="flex items-center space-x-2">
        <input type="checkbox" name={name} value={value} checked={checked} onChange={onChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span>{label}</span>
    </label>
);

const RadioButton: React.FC<{ name: string; value: string; label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ name, value, label, checked, onChange }) => (
    <label className="flex items-center space-x-2">
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span>{label}</span>
    </label>
);

const TextInput: React.FC<{ name: string; value: string; placeholder?: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; className?: string }> = ({ name, value, placeholder, onChange, className }) => (
    <input type="text" name={name} value={value || ''} onChange={onChange} placeholder={placeholder} className={`p-2 border rounded-md w-full ${className}`} />
);

// --- Main Component ---
const AdmissionAssessmentForm = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<AdmissionFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAdmissionData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('admission_form_data')
        .eq('ipd_id', ipdId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data?.admission_form_data) {
        setFormData(data.admission_form_data as AdmissionFormData);
        toast.success("Previous admission data loaded.");
      } else {
        setFormData({} as AdmissionFormData);
      }
    } catch (error) {
      console.error("Failed to fetch admission data:", error);
      toast.error("Failed to load admission data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchAdmissionData();
  }, [ipdId, fetchAdmissionData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated.");
        setIsSaving(false);
        return;
      }
      const { error } = await supabase.from('ipd_record').upsert({
          ipd_id: ipdId,
          user_id: session.user.id,
          admission_form_data: formData,
        }, { onConflict: 'ipd_id,user_id' });
      if (error) throw error;
      toast.success("Admission form saved successfully!");
    } catch (error) {
      console.error("Failed to save admission data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value } as AdmissionFormData));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked } = e.target;
    setFormData(prev => {
        const prevValues = (prev?.[name as keyof AdmissionFormData] as string[]) || [];
        if (checked) {
            return { ...prev, [name]: [...prevValues, value] } as AdmissionFormData;
        } else {
            return { ...prev, [name]: prevValues.filter(v => v !== value) } as AdmissionFormData;
        }
    });
  };

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Admission Form...</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto font-sans text-sm">
        <div className="text-center mb-6">
            <h1 className="font-bold text-2xl uppercase">Patient Admission Assessment Form (Nursing)</h1>
        </div>
        
        <div className="space-y-6">
            <FormSection title="Date of Assessment">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
                    <TextInput name="dateOfAssessment" value={formData.dateOfAssessment} onChange={handleInputChange} placeholder="Date of Assessment" />
                    <div className="col-span-1 lg:col-span-2">
                        <p className="font-semibold">Arrival to unit by:</p>
                        <div className="flex flex-wrap gap-4 mt-2">
                            {['Walking', 'Wheel Chair', 'Stretcher', 'Home', 'Clinic', 'Nursing Home', 'Casualty'].map(item => (
                                <Checkbox key={item} name="arrivalToUnitBy" value={item} checked={(formData.arrivalToUnitBy || []).includes(item)} onChange={handleCheckboxChange} label={item} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center mt-4">
                    <div>
                        <p className="font-semibold">Patient Belonging Handed To Relative:</p>
                        <div className="flex flex-wrap gap-4 mt-2">
                            {['Watch', 'Jewellery'].map(item => (
                                <Checkbox key={item} name="patientBelonging" value={item} checked={(formData.patientBelonging || []).includes(item)} onChange={handleCheckboxChange} label={item} />
                            ))}
                            <TextInput name="patientBelongingOther" value={formData.patientBelongingOther} onChange={handleInputChange} placeholder="Any Other" className="flex-grow" />
                        </div>
                    </div>
                    <TextInput name="informantName" value={formData.informantName} onChange={handleInputChange} placeholder="Informant Name" />
                    <TextInput name="relationShip" value={formData.relationShip} onChange={handleInputChange} placeholder="Relation Ship" />
                </div>
            </FormSection>

            <FormSection title="Date of Assessment">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <p className="font-semibold w-32">Any Allergies:</p>
                        <RadioButton name="anyAllergies" value="No" checked={formData.anyAllergies === 'No'} onChange={handleInputChange} label="No" />
                        <RadioButton name="anyAllergies" value="Yes" checked={formData.anyAllergies === 'Yes'} onChange={handleInputChange} label="Yes" />
                        {formData.anyAllergies === 'Yes' && <TextInput name="allergiesYes" value={formData.allergiesYes} onChange={handleInputChange} placeholder="If Yes," className="flex-grow" />}
                        <p className="font-semibold ml-auto">Latex Allergy:</p>
                        <RadioButton name="latexAllergy" value="Yes" checked={formData.latexAllergy === 'Yes'} onChange={handleInputChange} label="Yes" />
                        <RadioButton name="latexAllergy" value="No" checked={formData.latexAllergy === 'No'} onChange={handleInputChange} label="No" />
                    </div>
                    {/* ... other radio button groups */}
                </div>
            </FormSection>

            {/* ... other sections */}
        </div>

        <div className="flex justify-end mt-8">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
            >
              {isSaving ? ( <> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </> ) : ( "Save Admission Form" )}
            </button>
        </div>
    </div>
  );
};

export default AdmissionAssessmentForm;
