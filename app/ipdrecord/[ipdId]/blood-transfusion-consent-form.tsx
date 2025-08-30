"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

// --- Type Definitions ---
interface BloodTransfusionConsentData {
  patientNameHeader: string;
  ageSexHeader: string;
  roomWardNo: string;
  uhidNo: string;
  ipdNo: string;
  contactNo: string;
  underCareOfDoctor: string;
  admissionDate: string;
  patientName: string;
  drPrescribed: string;
  informedOfOptions: boolean;
  carefulScreening: boolean;
  educatedInLanguage: string;
  interpreterNameAndSignature: string;
  patientConsent: {
    herebyAccede: boolean;
    herebyRefuse: boolean;
  };
  incapableReason: string;
  signatureOfPatientName: string;
  patientSex: string;
  patientAge: string;
  patientDate: string;
  patientTime: string;
  signatureOfPatient: string;
  signatureOfConsentGiver: string;
  consentGiverName: string;
  consentGiverAge: string;
  consentGiverRelationship: string;
  consentGiverAddress: string;
  consentGiverTelephone: string;
  signatureOfWitness: string;
  witnessName: string;
  witnessAge: string;
  witnessTelephone: string;
  signatureOfTreatingDoctor: string;
  treatingDoctorName: string;
  treatingDoctorRegnNo: string;
  treatingDoctorDate: string;
  signatureOfSurgeon: string;
  surgeonName: string;
  surgeonRegnNo: string;
  surgeonDate: string;
}

// --- Initial State for the Form ---
const initialConsentData: BloodTransfusionConsentData = {
  patientNameHeader: "",
  ageSexHeader: "",
  roomWardNo: "",
  uhidNo: "",
  ipdNo: "",
  contactNo: "",
  underCareOfDoctor: "",
  admissionDate: "",
  patientName: "",
  drPrescribed: "",
  informedOfOptions: false,
  carefulScreening: false,
  educatedInLanguage: "",
  interpreterNameAndSignature: "",
  patientConsent: {
    herebyAccede: false,
    herebyRefuse: false,
  },
  incapableReason: "",
  signatureOfPatient: "",
  signatureOfPatientName: "",
  patientSex: "",
  patientAge: "",
  patientDate: "",
  patientTime: "",
  signatureOfConsentGiver: "",
  consentGiverName: "",
  consentGiverAge: "",
  consentGiverRelationship: "",
  consentGiverAddress: "",
  consentGiverTelephone: "",
  signatureOfWitness: "",
  witnessName: "",
  witnessAge: "",
  witnessTelephone: "",
  signatureOfTreatingDoctor: "",
  treatingDoctorName: "",
  treatingDoctorRegnNo: "",
  treatingDoctorDate: "",
  signatureOfSurgeon: "",
  surgeonName: "",
  surgeonRegnNo: "",
  surgeonDate: "",
};

// --- Main Component ---
const BloodTransfusionConsentForm = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<BloodTransfusionConsentData>(initialConsentData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingSignature, setIsVerifyingSignature] = useState({
    signatureOfPatient: false,
    signatureOfConsentGiver: false,
    signatureOfWitness: false,
    signatureOfTreatingDoctor: false,
    signatureOfSurgeon: false,
  });

  const fetchConsentData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ipd_record")
        .select("blood_transfusion_consent_data")
        .eq("ipd_id", ipdId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.blood_transfusion_consent_data) {
        setFormData(data.blood_transfusion_consent_data as BloodTransfusionConsentData);
        toast.success("Consent form data loaded.");
      }
    } catch (error) {
      console.error("Failed to fetch consent data:", error);
      toast.error("Failed to load consent form data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchConsentData();
  }, [ipdId, fetchConsentData]);

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
      
      // Clear unsaved PINs before saving
      (Object.keys(dataToSave) as Array<keyof typeof dataToSave>).forEach(key => {
        const value = dataToSave[key as keyof BloodTransfusionConsentData];
        if (
          key.startsWith("signature") &&
          typeof value === 'string' &&
          value.length === 10 &&
          !value.startsWith('http')
        ) {
          (dataToSave as any)[key] = '';
        }
      });
      
      const { error } = await supabase.from("ipd_record").upsert(
        {
          ipd_id: ipdId,
          user_id: session.user.id,
          blood_transfusion_consent_data: dataToSave,
        },
        { onConflict: "ipd_id,user_id" }
      );

      if (error) throw error;
      toast.success("Consent form saved successfully!");
    } catch (error) {
      console.error("Failed to save consent form data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof BloodTransfusionConsentData) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCheckboxChange = (group: keyof BloodTransfusionConsentData, field: string) => {
    setFormData((prev) => {
      if (group === "patientConsent") {
        const newGroup = { ...prev[group] };
        for (const key in newGroup) {
          (newGroup as any)[key] = key === field;
        }
        return { ...prev, [group]: newGroup };
      }

      return { ...prev, [field]: !(prev as any)[field] };
    });
  };

  const checkAndSetSignature = useCallback(async (password: string, field: keyof BloodTransfusionConsentData) => {
    if (password.length !== 10) return;
    const signatureKey = field as keyof typeof isVerifyingSignature;
    setIsVerifyingSignature(prev => ({ ...prev, [signatureKey]: true }));
    try {
      const { data, error } = await supabase
        .from('signature')
        .select('signature_url')
        .eq('password', password)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;

      if (data?.signature_url) {
        setFormData(prev => ({ ...prev, [field]: data.signature_url }));
        toast.success(`Signature verified for ${field.replace("signatureOf", "").replace(/([A-Z])/g, ' $1').trim()}.`);
      } else {
        toast.error(`Invalid signature PIN for ${field.replace("signatureOf", "").replace(/([A-Z])/g, ' $1').trim()}.`);
      }
    } catch (error) {
      console.error("Error verifying signature:", error);
      toast.error("Could not verify signature.");
    } finally {
      const signatureKey = field as keyof typeof isVerifyingSignature;
      setIsVerifyingSignature(prev => ({ ...prev, [signatureKey]: false }));
    }
  }, []);
  
  const handleSignatureReset = (field: keyof BloodTransfusionConsentData) => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
      setFormData(prev => ({...prev, [field]: ''}));
      toast.info("Signature has been cleared.");
    }
  };

  const renderSignatureInput = (field: keyof BloodTransfusionConsentData) => {
    const signatureKey = field as keyof typeof isVerifyingSignature;
    const isVerifying = isVerifyingSignature[signatureKey];
    
    return (
      <div className="flex-grow p-1 border-b border-gray-300 focus:outline-none h-12 flex items-center justify-center">
        {isVerifying ? (
          <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
        ) : (typeof formData[field] === 'string' && (formData[field] as string).startsWith('http')) ? (
          <img
            src={formData[field] as string}
            alt="Signature"
            title="Click to remove signature"
            className="h-10 object-contain cursor-pointer hover:opacity-75"
            onClick={() => handleSignatureReset(field)}
          />
        ) : (
          <input
            type="password"
            value={formData[field] as string}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, [field]: e.target.value }));
              if (e.target.value.length === 10) {
                checkAndSetSignature(e.target.value, field);
              }
            }}
            className="w-full text-center focus:outline-none bg-transparent"
            maxLength={10}
            placeholder="Enter a Password"
            autoComplete="new-password"
          />
        )}
      </div>
    );
  };

  const inputClass = "flex-grow p-1 border-b border-gray-300 focus:outline-none bg-transparent";
  const labelClass = "font-semibold mr-2 whitespace-nowrap";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Consent Form...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl mx-auto font-sans text-xs">
      <div className="text-center mb-6">
        <h2 className="font-bold text-lg">CONSENT FORM - Transfusion of Blood or Blood Components</h2>
      </div>

      {/* Patient Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mb-6">
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Name of Patient:</label>
          <input type="text" value={formData.patientNameHeader} onChange={(e) => handleInputChange(e, "patientNameHeader")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Age/Sex:</label>
          <input type="text" value={formData.ageSexHeader} onChange={(e) => handleInputChange(e, "ageSexHeader")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Room/Ward No:</label>
          <input type="text" value={formData.roomWardNo} onChange={(e) => handleInputChange(e, "roomWardNo")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>UHID No:</label>
          <input type="text" value={formData.uhidNo} onChange={(e) => handleInputChange(e, "uhidNo")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>IPD No:</label>
          <input type="text" value={formData.ipdNo} onChange={(e) => handleInputChange(e, "ipdNo")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Contact No.:</label>
          <input type="text" value={formData.contactNo} onChange={(e) => handleInputChange(e, "contactNo")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Under Care of Doctor:</label>
          <input type="text" value={formData.underCareOfDoctor} onChange={(e) => handleInputChange(e, "underCareOfDoctor")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Admission Date:</label>
          <input type="text" value={formData.admissionDate} onChange={(e) => handleInputChange(e, "admissionDate")} className={inputClass} />
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2">
          Dr.{" "}
          <input type="text" value={formData.drPrescribed} onChange={(e) => handleInputChange(e, "drPrescribed")} className="w-1/2 p-1 border-b border-gray-300 focus:outline-none bg-transparent" />{" "}
          on examination and supported by investigations, has prescribed transfusion of blood/ blood components.
        </p>
        <p className="mb-2">I have been informed of the transfusion options available, which may include banked blood (allogenic) provided by voluntary replacement donors (relatives).</p>
        <p className="mb-2">I have been informed that despite careful screening in accordance with national regulations, there are instances of acquiring life threatening infections such as Hepatitis, AIDS, other viruses or diseases yet unknown. I am also explained that there is no practical way to eliminate all risks, as yet. I am also educated that unpredictable reactions to blood/ blood components transfusion may occur, which include but are not limited to fever, rash, shortness of breath, shock and in rare occasions- deaths.</p>
        <p className="mb-2">Expected benefits of blood/ blood components transfusion may include minimizing shock, brain and other organ damage, expediting recovery and limiting blood-loss etc. However, I am also informed that there are no guarantees offered as to the expected benefits. I have had opportunity to ask questions about blood/ blood components, alternate forms of treatment available or likely, the procedures to be used; risks of non-treatment and risks and hazards involved in either of the cases. I believe that I have sufficient knowledge to make an informed decision.</p>
      </div>

      <div className="flex items-center">
        <label className={labelClass}>I have been educated in language:</label>
        <input type="text" value={formData.educatedInLanguage} onChange={(e) => handleInputChange(e, "educatedInLanguage")} className={inputClass} />
        <span className="ml-2">which I can understand.</span>
      </div>

      <div className="flex items-center">
        <label className={labelClass}>(Name of the interpreter and signature, if involved:</label>
        <input type="text" value={formData.interpreterNameAndSignature} onChange={(e) => handleInputChange(e, "interpreterNameAndSignature")} className={inputClass} />
        <span>)</span>
      </div>

      <div className="flex items-center space-x-4 mt-2">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.patientConsent.herebyAccede}
            onChange={() => handleCheckboxChange("patientConsent", "herebyAccede")}
            className="mr-2"
          />
          I hereby accede to my consent to blood/ blood components transfusion.
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.patientConsent.herebyRefuse}
            onChange={() => handleCheckboxChange("patientConsent", "herebyRefuse")}
            className="mr-2"
          />
          I hereby refuse to blood/ blood components transfusion.
        </label>
      </div>
      
      <div className="py-2">
        <p className="mt-2 text-gray-500 italic text-sm">Consent/Refusal is signed by a person other than the patient as the patient is incapable of giving legal consent due to:</p>
        <input
          type="text"
          value={formData.incapableReason}
          onChange={(e) => handleInputChange(e, "incapableReason")}
          className={inputClass}
        />
      </div>

      <div className="mt-4">
        <h3 className="font-semibold text-sm flex items-center mb-2">
          Sign of the Patient
          {renderSignatureInput("signatureOfPatient")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
          <div className="flex items-center col-span-2">
            <label className={labelClass}>Name:</label>
            <input type="text" value={formData.signatureOfPatientName} onChange={(e) => handleInputChange(e, "signatureOfPatientName")} className={inputClass} />
          </div>
          <div className="flex items-center col-span-1">
            <label className={labelClass}>Sex:</label>
            <input type="text" value={formData.patientSex} onChange={(e) => handleInputChange(e, "patientSex")} className={inputClass} />
          </div>
          <div className="flex items-center col-span-1">
            <label className={labelClass}>Age:</label>
            <input type="text" value={formData.patientAge} onChange={(e) => handleInputChange(e, "patientAge")} className={inputClass} />
            <span className="ml-1">Years</span>
          </div>
          <div className="flex items-center col-span-2">
            <label className={labelClass}>Date:</label>
            <input type="date" value={formData.patientDate} onChange={(e) => handleInputChange(e, "patientDate")} className={inputClass} />
          </div>
          <div className="flex items-center col-span-2">
            <label className={labelClass}>Time:</label>
            <input type="time" value={formData.patientTime} onChange={(e) => handleInputChange(e, "patientTime")} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-semibold text-sm flex items-center mb-2">
          Signature of consent giver:
          {renderSignatureInput("signatureOfConsentGiver")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
          <div className="flex items-center col-span-2">
            <label className={labelClass}>Name:</label>
            <input type="text" value={formData.consentGiverName} onChange={(e) => handleInputChange(e, "consentGiverName")} className={inputClass} />
          </div>
          <div className="flex items-center col-span-1">
            <label className={labelClass}>Age:</label>
            <input type="text" value={formData.consentGiverAge} onChange={(e) => handleInputChange(e, "consentGiverAge")} className={inputClass} />
            <span className="ml-1">Years</span>
          </div>
          <div className="flex items-center col-span-full">
            <label className={labelClass}>Relationship with the patient:</label>
            <input type="text" value={formData.consentGiverRelationship} onChange={(e) => handleInputChange(e, "consentGiverRelationship")} className={inputClass} />
          </div>
          <div className="flex items-center col-span-full">
            <label className={labelClass}>Full Address:</label>
            <input type="text" value={formData.consentGiverAddress} onChange={(e) => handleInputChange(e, "consentGiverAddress")} className={inputClass} />
          </div>
          <div className="flex items-center col-span-full">
            <label className={labelClass}>Telephone/Mobile No.:</label>
            <input type="text" value={formData.consentGiverTelephone} onChange={(e) => handleInputChange(e, "consentGiverTelephone")} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-semibold text-sm flex items-center mb-2">
          Signature of Witness:
          {renderSignatureInput("signatureOfWitness")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
          <div className="flex items-center col-span-2">
            <label className={labelClass}>Name of the Witness:</label>
            <input type="text" value={formData.witnessName} onChange={(e) => handleInputChange(e, "witnessName")} className={inputClass} />
          </div>
          <div className="flex items-center col-span-1">
            <label className={labelClass}>Age:</label>
            <input type="text" value={formData.witnessAge} onChange={(e) => handleInputChange(e, "witnessAge")} className={inputClass} />
            <span className="ml-1">Years</span>
          </div>
          <div className="flex items-center col-span-2">
            <label className={labelClass}>Tel. / Cell No.:</label>
            <input type="text" value={formData.witnessTelephone} onChange={(e) => handleInputChange(e, "witnessTelephone")} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div>
          <h3 className="font-semibold text-sm flex items-center mb-2">
            Sign of the Treating Doctor:
            {renderSignatureInput("signatureOfTreatingDoctor")}
          </h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <label className={labelClass}>Full Name:</label>
              <input type="text" value={formData.treatingDoctorName} onChange={(e) => handleInputChange(e, "treatingDoctorName")} className={inputClass} />
            </div>
            <div className="flex items-center">
              <label className={labelClass}>Regn. No.:</label>
              <input type="text" value={formData.treatingDoctorRegnNo} onChange={(e) => handleInputChange(e, "treatingDoctorRegnNo")} className={inputClass} />
            </div>
            <div className="flex items-center">
              <label className={labelClass}>Date:</label>
              <input type="date" value={formData.treatingDoctorDate} onChange={(e) => handleInputChange(e, "treatingDoctorDate")} className={inputClass} />
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-sm flex items-center mb-2">
            Sign of the Surgeon:
            {renderSignatureInput("signatureOfSurgeon")}
          </h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <label className={labelClass}>Full Name:</label>
              <input type="text" value={formData.surgeonName} onChange={(e) => handleInputChange(e, "surgeonName")} className={inputClass} />
            </div>
            <div className="flex items-center">
              <label className={labelClass}>Regn. No.:</label>
              <input type="text" value={formData.surgeonRegnNo} onChange={(e) => handleInputChange(e, "surgeonRegnNo")} className={inputClass} />
            </div>
            <div className="flex items-center">
              <label className={labelClass}>Date:</label>
              <input type="date" value={formData.surgeonDate} onChange={(e) => handleInputChange(e, "surgeonDate")} className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"}`}
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            "Save Consent Form"
          )}
        </button>
      </div>
    </div>
  );
};

export default BloodTransfusionConsentForm;