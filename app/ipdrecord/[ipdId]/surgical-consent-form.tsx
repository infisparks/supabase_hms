"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

// --- Type Definitions ---
interface SurgicalConsentData {
  patientName: string;
  ageSex: string;
  roomWardNo: string;
  uhidNo: string;
  ipdNo: string;
  contactNo: string;
  underCareOfDoctor: string;
  admissionDate: string;
  doctor: string;
  procedure: string;
  conductedExam: string;
  ableToConsent: string;
  awareOfRisks: string;
  anesthetist: string;
  anesthesiaRisk: string;
  summaryGiven: string;
  highRisk: string;
  language: string;
  interpreter: string;
  authorizeDoctor: string;
  refuseToAnesthetize: string;
  medicalConsequences: string;
  signatureOfPatient: string;
  patientNameSign: string;
  patientDate: string;
  patientTime: string;
  patientSex: string;
  patientAge: string;
  incapableReason: string;
  signatureOfConsentGiver: string;
  consentGiverName: string;
  consentGiverRelationship: string;
  consentGiverAddress: string;
  consentGiverAge: string;
  consentGiverTelephone: string;
  signatureOfWitness: string;
  witnessName: string;
  witnessAge: string;
  witnessTelephone: string;
  signatureOfAnesthesiologist: string;
  anesthesiologistName: string;
  anesthesiologistRegnNo: string;
  anesthesiologistDate: string;
}

// --- Initial State for the Form ---
const initialSurgicalConsentData: SurgicalConsentData = {
  patientName: "",
  ageSex: "",
  roomWardNo: "",
  uhidNo: "",
  ipdNo: "",
  contactNo: "",
  underCareOfDoctor: "",
  admissionDate: "",
  doctor: "",
  procedure: "",
  conductedExam: "",
  ableToConsent: "",
  awareOfRisks: "",
  anesthetist: "",
  anesthesiaRisk: "",
  summaryGiven: "",
  highRisk: "",
  language: "",
  interpreter: "",
  authorizeDoctor: "",
  refuseToAnesthetize: "",
  medicalConsequences: "",
  signatureOfPatient: "",
  patientNameSign: "",
  patientDate: "",
  patientTime: "",
  patientSex: "",
  patientAge: "",
  incapableReason: "",
  signatureOfConsentGiver: "",
  consentGiverName: "",
  consentGiverRelationship: "",
  consentGiverAddress: "",
  consentGiverAge: "",
  consentGiverTelephone: "",
  signatureOfWitness: "",
  witnessName: "",
  witnessAge: "",
  witnessTelephone: "",
  signatureOfAnesthesiologist: "",
  anesthesiologistName: "",
  anesthesiologistRegnNo: "",
  anesthesiologistDate: "",
};

// --- Main Component ---
const SurgicalConsentForm = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<SurgicalConsentData>(initialSurgicalConsentData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingSignature, setIsVerifyingSignature] = useState({
    signatureOfPatient: false,
    signatureOfConsentGiver: false,
    signatureOfWitness: false,
    signatureOfAnesthesiologist: false,
  });

  const fetchConsentData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ipd_record")
        .select("surgical_consent_data")
        .eq("ipd_id", ipdId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.surgical_consent_data) {
        setFormData(data.surgical_consent_data as SurgicalConsentData);
        toast.success("Surgical consent data loaded.");
      }
    } catch (error) {
      console.error("Failed to fetch surgical consent data:", error);
      toast.error("Failed to load surgical consent form data.");
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
      
      (Object.keys(dataToSave) as Array<keyof typeof dataToSave>).forEach(key => {
        const value = dataToSave[key];
        if (key.startsWith("signature") && typeof value === 'string' && value.length === 10 && !value.startsWith('http')) {
          (dataToSave as any)[key] = '';
        }
      });
      
      const { error } = await supabase.from("ipd_record").upsert(
        {
          ipd_id: ipdId,
          user_id: session.user.id,
          surgical_consent_data: dataToSave,
        },
        { onConflict: "ipd_id,user_id" }
      );

      if (error) throw error;
      toast.success("Surgical consent form saved successfully!");
    } catch (error) {
      console.error("Failed to save surgical consent data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof SurgicalConsentData) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };
  
  const checkAndSetSignature = useCallback(async (password: string, field: keyof SurgicalConsentData) => {
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
  
  const handleSignatureReset = (field: keyof SurgicalConsentData) => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
      setFormData(prev => ({...prev, [field]: ''}));
      toast.info("Signature has been cleared.");
    }
  };

  const renderSignatureInput = (field: keyof SurgicalConsentData) => {
    const signatureKey = field as keyof typeof isVerifyingSignature;
    const isVerifying = isVerifyingSignature[signatureKey];
    
    return (
      <div className="flex-grow p-1 border-b border-gray-300 focus:outline-none h-12 flex items-center justify-center">
        {isVerifying ? (
          <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
        ) : typeof formData[field] === 'string' && formData[field]?.startsWith('http') ? (
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
        <h2 className="font-bold text-lg">CONSENT FORM</h2>
      </div>

      {/* Patient Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mb-6">
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Name of Patient:</label>
          <input type="text" value={formData.patientName} onChange={(e) => handleInputChange(e, "patientName")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Age/Sex:</label>
          <input type="text" value={formData.ageSex} onChange={(e) => handleInputChange(e, "ageSex")} className={inputClass} />
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

      <div className="space-y-4">
        {/* Consent Text Section */}
        <div className="mt-4 space-y-2 text-gray-800">
          <p>Dr. <input type="text" value={formData.doctor} onChange={(e) => handleInputChange(e, "doctor")} className="w-1/4 p-1 border-b border-gray-300 focus:outline-none bg-transparent" /> conducted examination and has advised me to undergo a procedure(s) / surgery and treatment ( <input type="text" value={formData.procedure} onChange={(e) => handleInputChange(e, "procedure")} className="w-1/4 p-1 border-b border-gray-300 focus:outline-none bg-transparent" /> ) for which I am required to be anesthetized.</p>
          <p>I have willfully consented to undergo the procedure, knowing well the risks involved.</p>
          <p>Dr. <input type="text" value={formData.anesthetist} onChange={(e) => handleInputChange(e, "anesthetist")} className="w-1/4 p-1 border-b border-gray-300 focus:outline-none bg-transparent" />, Anesthesiologist, did evaluate me for risks involved in anesthetizing me to undergo above procedure. I have willfully consented to be anesthetized. However, in the opinion of anesthethesiologist there is significant risk has no the risk factor and the consequences have been discussed in details with me, in the language and manner that I could understand. Summary of which is given here-below: </p>
          <p className="mt-2">I have been advised that high risk(s) involved in the above procedures are: </p>
          <textarea value={formData.highRisk} onChange={(e) => handleInputChange(e, "highRisk")} className="w-full p-2 border border-gray-300 focus:outline-none rounded-md resize-none h-16" />
          
          <div className="flex items-center">
            <label className={labelClass}>I have been educated in language:</label>
            <input type="text" value={formData.language} onChange={(e) => handleInputChange(e, "language")} className={inputClass} />
            <span className="ml-2">which I can well understand.</span>
          </div>
          <div className="flex items-center">
            <label className={labelClass}>(Name of the interpreter, if involved:</label>
            <input type="text" value={formData.interpreter} onChange={(e) => handleInputChange(e, "interpreter")} className={inputClass} />
            <span>)</span>
          </div>

          <p className="mt-2">I authorize Dr. <input type="text" value={formData.authorizeDoctor} onChange={(e) => handleInputChange(e, "authorizeDoctor")} className="w-1/4 p-1 border-b border-gray-300 focus:outline-none bg-transparent" /> or associates and such / assistants as may be selected by him / her to anesthetize me for the procedure.</p>
          <p className="mt-2">Therefore, I also consent and authorize rendering of such other care and treatment as my clinician or his designee reasonably believes necessary should one or more of these or other unforeseeable events occur.</p>
          
          <p className="flex items-center space-x-4 mt-2">
            I refuse to authorize Dr. <input type="text" value={formData.refuseToAnesthetize} onChange={(e) => handleInputChange(e, "refuseToAnesthetize")} className="w-1/4 p-1 border-b border-gray-300 focus:outline-none bg-transparent" /> to anesthetize me for the procedure.
          </p>
          <p>I fully understand and accept responsibility of medical consequences of such refusal.</p>
        </div>

        {/* Signature of Patient Section */}
        <div className="mt-4">
          <h3 className="font-semibold text-sm flex items-center mb-2">
            Sign of the Patient
            {renderSignatureInput("signatureOfPatient")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
            <div className="flex items-center col-span-2">
              <label className={labelClass}>Name:</label>
              <input type="text" value={formData.patientNameSign} onChange={(e) => handleInputChange(e, "patientNameSign")} className={inputClass} />
            </div>
            <div className="flex items-center col-span-2">
              <label className={labelClass}>Age/Sex:</label>
              <input type="text" value={formData.patientAge} onChange={(e) => handleInputChange(e, "patientAge")} className={inputClass} />
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
          <p className="mt-2 text-gray-500 italic text-[10px]">Consent/Refusal is signed by a person other than the patient as the patient is incapable of giving legal consent due to: </p>
          <input type="text" value={formData.incapableReason} onChange={(e) => handleInputChange(e, "incapableReason")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent" />
        </div>

        {/* Signature of Consent Giver Section */}
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
            <div className="flex items-center col-span-2">
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

        {/* Signature of Witness Section */}
        <div className="mt-4">
          <h3 className="font-semibold text-sm flex items-center mb-2">
            Signature of Witness:
            {renderSignatureInput("signatureOfWitness")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
            <div className="flex items-center col-span-2">
              <label className={labelClass}>Name of the witness:</label>
              <input type="text" value={formData.witnessName} onChange={(e) => handleInputChange(e, "witnessName")} className={inputClass} />
            </div>
            <div className="flex items-center col-span-2">
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

        {/* Anesthesiologist Section */}
        <div className="mt-4">
          <h3 className="font-semibold text-sm flex items-center mb-2">
            Sign of Anesthesiologist:
            {renderSignatureInput("signatureOfAnesthesiologist")}
          </h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <label className={labelClass}>Full Name:</label>
              <input type="text" value={formData.anesthesiologistName} onChange={(e) => handleInputChange(e, "anesthesiologistName")} className={inputClass} />
            </div>
            <div className="flex items-center">
              <label className={labelClass}>Regn. No.:</label>
              <input type="text" value={formData.anesthesiologistRegnNo} onChange={(e) => handleInputChange(e, "anesthesiologistRegnNo")} className={inputClass} />
            </div>
            <div className="flex items-center">
              <label className={labelClass}>Date:</label>
              <input type="date" value={formData.anesthesiologistDate} onChange={(e) => handleInputChange(e, "anesthesiologistDate")} className={inputClass} />
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

export default SurgicalConsentForm;