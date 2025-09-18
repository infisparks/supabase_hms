"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw, Edit2 } from "lucide-react";
import PatientDetailsHeader from "./PatientDetailsHeader";
import PdfGenerator from "./PdfGenerator";
import SignatureCanvas from 'react-signature-canvas';

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

// --- Reusable Signature Modal Component ---
interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => void;
  title: string;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave, title }) => {
  const sigPad = useRef<SignatureCanvas | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
      onSave(sigPad.current.toDataURL());
    } else {
      toast.error("Please provide a signature.");
    }
  };

  const handleClear = () => {
    if (sigPad.current) {
      sigPad.current.clear();
      toast.info("Signature cleared.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-lg mx-4">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <SignatureCanvas
          ref={sigPad}
          penColor='black'
          canvasProps={{ width: 450, height: 200, className: 'sigCanvas border border-gray-400 rounded-md' }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
const SurgicalConsentForm = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<SurgicalConsentData>(initialSurgicalConsentData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const [modalState, setModalState] = useState({
    isOpen: false,
    field: '',
    title: ''
  });

  const handleOpenModal = (field: keyof SurgicalConsentData, title: string) => {
    setModalState({ isOpen: true, field, title });
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, field: '', title: '' });
  };

  const handleSaveSignature = (signatureDataUrl: string) => {
    setFormData((prev) => ({ ...prev, [modalState.field]: signatureDataUrl }));
    toast.success(`${modalState.title} signature saved successfully!`);
    handleCloseModal();
  };

  const handleClearSignature = (field: keyof SurgicalConsentData, name: string) => {
    setFormData((prev) => ({ ...prev, [field]: '' }));
    toast.info(`Signature for ${name} has been cleared.`);
  };

  const fetchConsentData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: consentData, error: consentError } = await supabase
        .from("ipd_record")
        .select("surgical_consent_data")
        .eq("ipd_id", ipdId)
        .single();

      if (consentError && consentError.code !== "PGRST116") throw consentError;

      if (consentData?.surgical_consent_data) {
        setFormData(consentData.surgical_consent_data as SurgicalConsentData);
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

      const { error } = await supabase.from("ipd_record").upsert(
        {
          ipd_id: ipdId,
          user_id: session.user.id,
          surgical_consent_data: formData,
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

  const renderSignatureField = (field: keyof SurgicalConsentData, name: string) => {
    const signatureUrl = formData[field];
    const hasSignature = !!signatureUrl;

    return (
      <div className="flex-grow flex items-center border border-gray-300 rounded-md p-1 min-h-[40px] relative">
        {hasSignature ? (
          <>
            <img src={signatureUrl as string} alt={`${name} Signature`} className="h-full max-h-[40px] object-contain" />
            <div className="absolute top-1 right-1 flex space-x-1 no-print">
              <button
                type="button"
                onClick={() => handleOpenModal(field, name)}
                className="bg-blue-500 text-white text-[10px] p-1 rounded-md opacity-75 hover:opacity-100 transition-opacity"
                title="Edit Signature"
              >
                <Edit2 size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleClearSignature(field, name)}
                className="bg-red-500 text-white text-[10px] p-1 rounded-md opacity-75 hover:opacity-100 transition-opacity"
                title="Clear Signature"
              >
                <span className="sr-only">Clear</span>
                &times;
              </button>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center w-full px-2">
            <span className="text-gray-500 italic text-sm">No signature</span>
            <button
              type="button"
              onClick={() => handleOpenModal(field, name)}
              className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors flex items-center gap-1"
            >
              <Edit2 size={12} /> Sign
            </button>
          </div>
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
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-xl max-w-4xl mx-auto font-sans text-xs">
      <div className="text-center mb-6">
        <h2 className="font-bold text-lg">CONSENT FORM</h2>
      </div>

      {/* Patient Details Section */}
      <PatientDetailsHeader ipdId={ipdId} />

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
          </h3>
          {renderSignatureField("signatureOfPatient", "Patient")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mt-4">
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
          </h3>
          {renderSignatureField("signatureOfConsentGiver", "Consent Giver")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mt-4">
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
          </h3>
          {renderSignatureField("signatureOfWitness", "Witness")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mt-4">
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
          </h3>
          {renderSignatureField("signatureOfAnesthesiologist", "Anesthesiologist")}
          <div className="space-y-2 mt-4">
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

      <div className="flex justify-end mt-6 no-pdf">
        <PdfGenerator contentRef={formRef as React.RefObject<HTMLDivElement>} fileName="SurgicalConsentForm" />
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

      <SignatureModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        onSave={handleSaveSignature}
        title={`Sign for ${modalState.title}`}
      />
    </div>
  );
};

export default SurgicalConsentForm;