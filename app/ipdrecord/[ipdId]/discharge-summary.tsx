"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import PdfGenerator from "./PdfGenerator"; // <-- IMPORT THE NEW COMPONENT

// --- Type Definitions ---
interface DischargeSummaryData {
  // Page 1
  typeOfDischarge: string;
  patientName: string;
  ageSex: string;
  uhidIpdNumber: string;
  consultantInCharge: string;
  detailedAddress: string;
  detailedAddress2: string;
  admissionDateAndTime: string;
  dischargeDateAndTime: string;
  finalDiagnosis: string;
  finalDiagnosis2: string;
  procedure: string;
  procedure2: string;
  provisionalDiagnosis: string;
  historyOfPresentIllness: string;
  investigations: string;
  treatmentGiven: string;
  hospitalCourse: string;

  // Page 2
  surgeryProcedureDetails: string;
  conditionAtDischarge: string;
  dischargeMedications: string;
  followUp: string;
  dischargeInstruction: string;
  reportImmediatelyIf: string;
  summaryPreparedBy: string;
  summaryVerifiedBy: string;
  summaryExplainedBy: string;
  summaryExplainedTo: string;
  emergencyContact: string;
  date: string;
  time: string;
}

// --- Initial State for the Form ---
const initialDischargeSummaryData: DischargeSummaryData = {
  // Page 1
  typeOfDischarge: "",
  patientName: "",
  ageSex: "",
  uhidIpdNumber: "",
  consultantInCharge: "",
  detailedAddress: "",
  detailedAddress2: "",
  admissionDateAndTime: "",
  dischargeDateAndTime: "",
  finalDiagnosis: "",
  finalDiagnosis2: "",
  procedure: "",
  procedure2: "",
  provisionalDiagnosis: "",
  historyOfPresentIllness: "",
  investigations: "",
  treatmentGiven: "",
  hospitalCourse: "",

  // Page 2
  surgeryProcedureDetails: "",
  conditionAtDischarge: "",
  dischargeMedications: "",
  followUp: "",
  dischargeInstruction: "",
  reportImmediatelyIf: "",
  summaryPreparedBy: "",
  summaryVerifiedBy: "",
  summaryExplainedBy: "",
  summaryExplainedTo: "",
  emergencyContact: "",
  date: "",
  time: "",
};

// --- Main Component ---
const DischargeSummary = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<DischargeSummaryData>(initialDischargeSummaryData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null); // <-- ADD A REF TO THE FORM CONTAINER

  const fetchDischargeData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ipd_record")
        .select("discharge_summary_data")
        .eq("ipd_id", ipdId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.discharge_summary_data) {
        setFormData(data.discharge_summary_data as DischargeSummaryData);
        toast.success("Discharge summary data loaded.");
      }
    } catch (error) {
      console.error("Failed to fetch discharge summary data:", error);
      toast.error("Failed to load discharge summary form data.");
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
          discharge_summary_data: formData,
        },
        { onConflict: "ipd_id,user_id" }
      );

      if (error) throw error;
      toast.success("Discharge summary saved successfully!");
    } catch (error) {
      console.error("Failed to save discharge summary data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof DischargeSummaryData) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Discharge Summary...</p>
      </div>
    );
  }

  const inputClass = "flex-grow p-1 border-b border-gray-300 focus:outline-none bg-transparent";
  const labelClass = "font-semibold mr-2 whitespace-nowrap ";
  const sectionClass = "py-2 flex items-center";
  const dividerClass = "border-b-2 border-gray-400 my-4";
  const textareaClass = "w-full mt-2 h-24 p-1 border border-gray-300 rounded-md focus:outline-none resize-none";
  const tableInputClass = "w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent text-center";

  return (
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-xl max-w-4xl mx-auto font-sans text-xs">
      <div className="text-center mb-6">
        <h2 className="font-bold text-lg">DISCHARGE SUMMARY</h2>
      </div>

      {/* Page 1 - Top Section */}
      <div className="space-y-4">
        <div className={sectionClass}>
          <label className={labelClass}>(Type of Discharge : Regular / Discharge On Request / DAMA / Transfer)</label>
          <input type="text" value={formData.typeOfDischarge} onChange={(e) => handleInputChange(e, "typeOfDischarge")} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex items-center">
            <label className={labelClass}>Patient Name:</label>
            <input type="text" value={formData.patientName} onChange={(e) => handleInputChange(e, "patientName")} className={inputClass} />
          </div>
          <div className="flex items-center">
            <label className={labelClass}>Age / Sex:</label>
            <input type="text" value={formData.ageSex} onChange={(e) => handleInputChange(e, "ageSex")} className={inputClass} />
          </div>
          <div className="flex items-center">
            <label className={labelClass}>UHID / IPD Number:</label>
            <input type="text" value={formData.uhidIpdNumber} onChange={(e) => handleInputChange(e, "uhidIpdNumber")} className={inputClass} />
          </div>
          <div className="flex items-center">
            <label className={labelClass}>Consultant In-Charge:</label>
            <input type="text" value={formData.consultantInCharge} onChange={(e) => handleInputChange(e, "consultantInCharge")} className={inputClass} />
          </div>
        </div>
        <div className={sectionClass}>
          <label className={labelClass}>Detailed Address:</label>
          <div className="flex-grow">
            <input type="text" value={formData.detailedAddress} onChange={(e) => handleInputChange(e, "detailedAddress")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent" />
            <input type="text" value={formData.detailedAddress2} onChange={(e) => handleInputChange(e, "detailedAddress2")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex items-center">
            <label className={labelClass}>Admission Date & Time:</label>
            <input type="text" value={formData.admissionDateAndTime} onChange={(e) => handleInputChange(e, "admissionDateAndTime")} className={inputClass} />
          </div>
          <div className="flex items-center">
            <label className={labelClass}>Discharge Date & Time:</label>
            <input type="text" value={formData.dischargeDateAndTime} onChange={(e) => handleInputChange(e, "dischargeDateAndTime")} className={inputClass} />
          </div>
        </div>
        <div className={sectionClass}>
          <label className={labelClass}>Final Diagnosis (list primary diagnosis FIRST):</label>
          <div className="flex-grow">
            <input type="text" value={formData.finalDiagnosis} onChange={(e) => handleInputChange(e, "finalDiagnosis")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent" />
            <input type="text" value={formData.finalDiagnosis2} onChange={(e) => handleInputChange(e, "finalDiagnosis2")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
          </div>
        </div>
        <div className={sectionClass}>
          <label className={labelClass}>Procedure (list dates, complications):</label>
          <div className="flex-grow">
            <input type="text" value={formData.procedure} onChange={(e) => handleInputChange(e, "procedure")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent" />
            <input type="text" value={formData.procedure2} onChange={(e) => handleInputChange(e, "procedure2")} className="w-full p-1 border-b border-gray-300 focus:outline-none bg-transparent mt-2" />
          </div>
        </div>
        <div className="py-2">
          <label className={labelClass}>Provisional Diagnosis:</label>
          <textarea value={formData.provisionalDiagnosis} onChange={(e) => handleInputChange(e, "provisionalDiagnosis")} className={textareaClass} />
        </div>
        <div className="py-2">
          <label className={labelClass}>History of Present Illness:</label>
          <textarea value={formData.historyOfPresentIllness} onChange={(e) => handleInputChange(e, "historyOfPresentIllness")} className={textareaClass} />
        </div>
        <div className="py-2">
          <label className={labelClass}>Investigations:</label>
          <textarea value={formData.investigations} onChange={(e) => handleInputChange(e, "investigations")} className={textareaClass} />
        </div>
        <div className="py-2">
          <label className={labelClass}>Treatment Given:</label>
          <textarea value={formData.treatmentGiven} onChange={(e) => handleInputChange(e, "treatmentGiven")} className={textareaClass} />
        </div>
        <div className="py-2">
          <label className={labelClass}>Hospital Course:</label>
          <textarea value={formData.hospitalCourse} onChange={(e) => handleInputChange(e, "hospitalCourse")} className={textareaClass} />
        </div>
      </div>
      
      <div className={dividerClass}></div>

      {/* Page 2 - Bottom Section */}
      <div className="space-y-4">
        <div className="py-2">
          <label className={labelClass}>Surgery / Procedure Details:</label>
          <textarea value={formData.surgeryProcedureDetails} onChange={(e) => handleInputChange(e, "surgeryProcedureDetails")} className={textareaClass} />
        </div>
        <div className="py-2">
          <label className={labelClass}>Condition at time of Discharge:</label>
          <textarea value={formData.conditionAtDischarge} onChange={(e) => handleInputChange(e, "conditionAtDischarge")} className={textareaClass} />
        </div>
        <div className="py-2">
          <label className={labelClass}>Discharge Medications:</label>
          <textarea value={formData.dischargeMedications} onChange={(e) => handleInputChange(e, "dischargeMedications")} className={textareaClass} />
        </div>
        <div className="py-2">
          <label className={labelClass}>Follow Up:</label>
          <textarea value={formData.followUp} onChange={(e) => handleInputChange(e, "followUp")} className={textareaClass} />
        </div>
        <div className="py-2">
          <label className={labelClass}>Discharge Instruction (diet, activity, discharged to home / nursing facility, etc.):</label>
          <textarea value={formData.dischargeInstruction} onChange={(e) => handleInputChange(e, "dischargeInstruction")} className={textareaClass} />
        </div>
        <div className={sectionClass}>
          <label className={labelClass}>Report immediately to hospital if you notice:</label>
          <input type="text" value={formData.reportImmediatelyIf} onChange={(e) => handleInputChange(e, "reportImmediatelyIf")} className={inputClass} />
        </div>
      </div>
      
      {/* Final Signatures Section */}
      <div className="border border-gray-300 rounded-md mt-6 overflow-hidden">
        <div className="grid grid-cols-4 border-b border-gray-300">
          <div className="p-2 border-r border-gray-300 font-bold">Summary Prepared by</div>
          <div className="p-2 border-r border-gray-300">
            <input type="text" value={formData.summaryPreparedBy} onChange={(e) => handleInputChange(e, "summaryPreparedBy")} className={tableInputClass} />
          </div>
          <div className="p-2 border-r border-gray-300 font-bold">Summary Verified by</div>
          <div className="p-2">
            <input type="text" value={formData.summaryVerifiedBy} onChange={(e) => handleInputChange(e, "summaryVerifiedBy")} className={tableInputClass} />
          </div>
        </div>
        <div className="grid grid-cols-4">
          <div className="p-2 border-r border-gray-300 font-bold">Summary Explained To</div>
          <div className="p-2 border-r border-gray-300">
            <input type="text" value={formData.summaryExplainedBy} onChange={(e) => handleInputChange(e, "summaryExplainedBy")} className={tableInputClass} />
          </div>
          <div className="p-2 border-r border-gray-300 font-bold">Summary Explained To</div>
          <div className="p-2">
            <input type="text" value={formData.summaryExplainedTo} onChange={(e) => handleInputChange(e, "summaryExplainedTo")} className={tableInputClass} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="flex items-center">
          <label className={labelClass}>Emergency Contact No. of The Hospital</label>
          <input type="text" value={formData.emergencyContact} onChange={(e) => handleInputChange(e, "emergencyContact")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Date:</label>
          <input type="date" value={formData.date} onChange={(e) => handleInputChange(e, "date")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Time:</label>
          <input type="time" value={formData.time} onChange={(e) => handleInputChange(e, "time")} className={inputClass} />
        </div>
      </div>

      <div className="flex justify-end mt-6 space-x-4">
        <PdfGenerator contentRef={formRef as React.RefObject<HTMLDivElement>} fileName="DischargeSummary" />
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
            "Save Discharge Summary"
          )}
        </button>
      </div>
    </div>
  );
};

export default DischargeSummary;