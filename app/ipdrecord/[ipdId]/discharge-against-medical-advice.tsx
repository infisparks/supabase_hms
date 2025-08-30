"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

// --- Type Definitions ---
interface DischargeFormData {
  patientNameHeader: string;
  ageSex: string;
  roomWardNo: string;
  uhidNo: string;
  ipdNo: string;
  contactNo: string;
  underCareOfDoctor: string;
  admissionDate: string;
  patientName: string;
  specificRisks: string;
  specificRisks2: string;
  specificRisks3: string;
  signatureOfPatient: string;
  nameOfSignatory: string;
  relationship: string;
  signatoryDate: string;
  signatoryTime: string;
  addressOfSignatory1: string;
  addressOfSignatory2: string;
  addressOfSignatory3: string;
  signatureOfWitness: string;
  witnessName: string;
  witnessRelationship: string;
  witnessDate: string;
  witnessTime: string;
  witnessAddress1: string;
  witnessAddress2: string;
  witnessAddress3: string;
}

// --- Initial State for the Form ---
const initialDischargeData: DischargeFormData = {
  patientNameHeader: "",
  ageSex: "",
  roomWardNo: "",
  uhidNo: "",
  ipdNo: "",
  contactNo: "",
  underCareOfDoctor: "",
  admissionDate: "",
  patientName: "",
  specificRisks: "",
  specificRisks2: "",
  specificRisks3: "",
  signatureOfPatient: "",
  nameOfSignatory: "",
  relationship: "",
  signatoryDate: "",
  signatoryTime: "",
  addressOfSignatory1: "",
  addressOfSignatory2: "",
  addressOfSignatory3: "",
  signatureOfWitness: "",
  witnessName: "",
  witnessRelationship: "",
  witnessDate: "",
  witnessTime: "",
  witnessAddress1: "",
  witnessAddress2: "",
  witnessAddress3: "",
};

// --- Main Component ---
const DischargeAgainstMedicalAdvice = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<DischargeFormData>(initialDischargeData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingSignature, setIsVerifyingSignature] = useState({
    signatureOfPatient: false,
    signatureOfWitness: false,
  });

  const fetchDischargeData = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated. Cannot save data.");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("ipd_record")
        .select("discharge_data")
        .eq("ipd_id", ipdId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.discharge_data) {
        setFormData(data.discharge_data as DischargeFormData);
        toast.success("Discharge data loaded.");
      }
    } catch (error) {
      console.error("Failed to fetch discharge data:", error);
      toast.error("Failed to load discharge form data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchDischargeData();
  }, [ipdId, fetchDischargeData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated. Cannot save data.");
        setIsSaving(false);
        return;
      }

      const dataToSave = { ...formData };

      (Object.keys(dataToSave) as Array<keyof typeof dataToSave>).forEach((key) => {
        const value = dataToSave[key];
        if (key.startsWith("signature") && typeof value === "string" && value.length === 10 && !value.startsWith("http")) {
          (dataToSave as any)[key] = "";
        }
      });

      const { error } = await supabase.from("ipd_record").upsert(
        {
          ipd_id: ipdId,
          user_id: session.user.id,
          discharge_data: dataToSave,
        },
        { onConflict: "ipd_id,user_id" }
      );

      if (error) throw error;
      toast.success("Discharge form saved successfully!");
    } catch (error) {
      console.error("Failed to save discharge data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof DischargeFormData) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const checkAndSetSignature = useCallback(
    async (password: string, field: keyof DischargeFormData) => {
      if (password.length !== 10) return;
      const signatureKey = field as keyof typeof isVerifyingSignature;
      setIsVerifyingSignature((prev) => ({ ...prev, [signatureKey]: true }));
      try {
        const { data, error } = await supabase.from("signature").select("signature_url").eq("password", password).single();

        if (error && error.code !== "PGRST116") throw error;

        if (data?.signature_url) {
          setFormData((prev) => ({ ...prev, [field]: data.signature_url }));
          toast.success(`Signature verified for ${field.replace("signatureOf", "").replace(/([A-Z])/g, " $1").trim()}.`);
        } else {
          toast.error(`Invalid signature PIN for ${field.replace("signatureOf", "").replace(/([A-Z])/g, " $1").trim()}.`);
        }
      } catch (error) {
        console.error("Error verifying signature:", error);
        toast.error("Could not verify signature.");
      } finally {
        const signatureKey = field as keyof typeof isVerifyingSignature;
        setIsVerifyingSignature((prev) => ({ ...prev, [signatureKey]: false }));
      }
    },
    []
  );

  const handleSignatureReset = (field: keyof DischargeFormData) => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
      setFormData((prev) => ({ ...prev, [field]: "" }));
      toast.info("Signature has been cleared.");
    }
  };

  const renderSignatureInput = (field: keyof DischargeFormData) => {
    const signatureKey = field as keyof typeof isVerifyingSignature;
    const isVerifying = isVerifyingSignature[signatureKey];

    return (
      <div className="flex-grow p-1 border-b border-gray-300 focus:outline-none h-12 flex items-center justify-center">
        {isVerifying ? (
          <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
        ) : typeof formData[field] === "string" && formData[field]?.startsWith("http") ? (
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
              setFormData((prev) => ({ ...prev, [field]: e.target.value }));
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
        <p className="ml-4 text-xl text-gray-600">Loading Discharge Form...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl mx-auto font-sans text-xs">
      <div className="text-center mb-6">
        <h2 className="font-bold text-lg">DISCHARGE AGAINST MEDICAL ADVICE</h2>
      </div>

      {/* Patient Details Header Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mb-6">
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Name of Patient:</label>
          <input type="text" value={formData.patientNameHeader} onChange={(e) => handleInputChange(e, "patientNameHeader")} className={inputClass} />
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
        <p>
          Being about to leave from <span className="font-bold">Medford Multi Speciality Hospital</span>, I{" "}
          <input type="text" value={formData.patientName} onChange={(e) => handleInputChange(e, "patientName")} className="w-1/3 p-1 border-b border-gray-300 focus:outline-none bg-transparent mx-1" />{" "}
          acknowledge that this action is against advice of the attending physician(s) and/or hospital authorities.
        </p>

        <div className="flex flex-wrap items-center">
          <p className="font-semibold">1. I have been informed about the possible dangers to my health that may result from his / her leaving the hospital at this time, including (Name specific risks) i.e. </p>
          <input type="text" value={formData.specificRisks} onChange={(e) => handleInputChange(e, "specificRisks")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
          <input type="text" value={formData.specificRisks2} onChange={(e) => handleInputChange(e, "specificRisks2")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
          <input type="text" value={formData.specificRisks3} onChange={(e) => handleInputChange(e, "specificRisks3")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
        </div>

        <p>it has been explained to me in my own language which I understand best.</p>

        <p className="font-semibold">
          2. I understand the risk and accept the consequences on my/the patient's departure from
          <span className="font-bold"> Medford Multi Speciality Hospital</span> and hereby release all healthcare providers, including the hospital and its staff from any liability that may arise due to discontinuation of treatment.
        </p>

        {/* Patient Signature Section */}
        <div className="mt-4">
          <div className="flex items-center mb-2">
            <label className={labelClass}>Signature of Patient OR Authorised Person :</label>
            {renderSignatureInput("signatureOfPatient")}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
            <div className="flex items-center col-span-2">
              <label className={labelClass}>Name of Signatory:</label>
              <input type="text" value={formData.nameOfSignatory} onChange={(e) => handleInputChange(e, "nameOfSignatory")} className={inputClass} />
            </div>
            <div className="flex items-center col-span-full">
              <label className={labelClass}>Relationship (If signed by other than patient):</label>
              <input type="text" value={formData.relationship} onChange={(e) => handleInputChange(e, "relationship")} className={inputClass} />
            </div>
            <div className="flex items-center col-span-2">
              <label className={labelClass}>Date:</label>
              <input type="date" value={formData.signatoryDate} onChange={(e) => handleInputChange(e, "signatoryDate")} className={inputClass} />
            </div>
            <div className="flex items-center col-span-2">
              <label className={labelClass}>Time:</label>
              <input type="time" value={formData.signatoryTime} onChange={(e) => handleInputChange(e, "signatoryTime")} className={inputClass} />
            </div>
            <div className="mt-4 col-span-full">
              <div className="flex items-center w-full">
                <label className={labelClass}>Address of Signatory :</label>
                <input type="text" value={formData.addressOfSignatory1} onChange={(e) => handleInputChange(e, "addressOfSignatory1")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent" />
              </div>
              <input type="text" value={formData.addressOfSignatory2} onChange={(e) => handleInputChange(e, "addressOfSignatory2")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
              <input type="text" value={formData.addressOfSignatory3} onChange={(e) => handleInputChange(e, "addressOfSignatory3")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
            </div>
          </div>
        </div>

        {/* Witness Signature Section */}
        <div className="mt-4">
          <h3 className="font-bold text-sm mb-2">WITNESS :</h3>
          <div className="flex items-center mb-2">
            <label className={labelClass}>Signature of witnessed Person :</label>
            {renderSignatureInput("signatureOfWitness")}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
            <div className="flex items-center col-span-2">
              <label className={labelClass}>Name of Signatory:</label>
              <input type="text" value={formData.witnessName} onChange={(e) => handleInputChange(e, "witnessName")} className={inputClass} />
            </div>
            <div className="flex items-center col-span-full">
              <label className={labelClass}>Relationship with the patient:</label>
              <input type="text" value={formData.witnessRelationship} onChange={(e) => handleInputChange(e, "witnessRelationship")} className={inputClass} />
            </div>
            <div className="flex items-center col-span-2">
              <label className={labelClass}>Date:</label>
              <input type="date" value={formData.witnessDate} onChange={(e) => handleInputChange(e, "witnessDate")} className={inputClass} />
            </div>
            <div className="flex items-center col-span-2">
              <label className={labelClass}>Time:</label>
              <input type="time" value={formData.witnessTime} onChange={(e) => handleInputChange(e, "witnessTime")} className={inputClass} />
            </div>
            <div className="mt-4 col-span-full">
              <div className="flex items-center w-full">
                <label className={labelClass}>Address of Signatory :</label>
                <input type="text" value={formData.witnessAddress1} onChange={(e) => handleInputChange(e, "witnessAddress1")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent" />
              </div>
              <input type="text" value={formData.witnessAddress2} onChange={(e) => handleInputChange(e, "witnessAddress2")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
              <input type="text" value={formData.witnessAddress3} onChange={(e) => handleInputChange(e, "witnessAddress3")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
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
            "Save Form"
          )}
        </button>
      </div>
    </div>
  );
};

export default DischargeAgainstMedicalAdvice;