"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import PdfGenerator from "./PdfGenerator"; // Import PdfGenerator

// --- Type Definitions ---
interface PatientFileData {
  patientName: string;
  sowodo: string;
  age: string;
  sex: string;
  dateOfAdmission: string;
  timeOfAdmission: string;
  uhidNo: string;
  ipdNo: string;
  address: string;
  contactNo: string;
  nameOfConsultant: string;
  department: string;
  bedNameAndNo: string;
  referredDr: string;
  dateOfDischarge: string;
  timeOfDischarge: string;
  conditionOnDischarge: {
    improved: boolean;
    dama: boolean;
    transferredToHigherCentre: boolean;
    death: boolean;
  };
  inCaseOfTransferred: string;
  dateAndTime: string;
  allergy: string;
  mlc: boolean;
  nonMlc: boolean;
}

interface IPDRegistrationData {
  uhid: string;
  under_care_of_doctor: string | null;
  admission_date: string | null;
  patient_detail: {
    name: string;
    number: string | null;
    age: number | null;
    gender: string | null;
  } | null;
  bed_management: { room_type: string; bed_number: number | string } | null;
}

// --- Initial State for the Form ---
const initialPatientFileData: PatientFileData = {
  patientName: "",
  sowodo: "",
  age: "",
  sex: "",
  dateOfAdmission: "",
  timeOfAdmission: "",
  uhidNo: "",
  ipdNo: "",
  address: "",
  contactNo: "",
  nameOfConsultant: "",
  department: "",
  bedNameAndNo: "",
  referredDr: "",
  dateOfDischarge: "",
  timeOfDischarge: "",
  conditionOnDischarge: {
    improved: false,
    dama: false,
    transferredToHigherCentre: false,
    death: false,
  },
  inCaseOfTransferred: "",
  dateAndTime: "",
  allergy: "",
  mlc: false,
  nonMlc: false,
};

// --- Main Component ---
const PatientFileForm = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<PatientFileData>(initialPatientFileData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null); // Create the ref

  const fetchAndSetPatientData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch existing patient file data
      const { data: fileData, error: fileError } = await supabase
        .from("ipd_record")
        .select("patient_file_data")
        .eq("ipd_id", ipdId)
        .single();

      // Fetch patient details from ipd_registration
      const { data: regData, error: regError } = await supabase
        .from("ipd_registration")
        .select(
          `
          uhid,
          patient_detail (name, number, age, gender),
          bed_management (room_type, bed_number),
          under_care_of_doctor,
          admission_date
        `
        )
        .eq("ipd_id", ipdId)
        .single<IPDRegistrationData>();

      if (regError) throw regError;

      // Combine fetched data with default values
      const fetchedInitialData = {
        patientName: regData?.patient_detail?.name || "",
        age: regData?.patient_detail?.age?.toString() || "",
        sex: regData?.patient_detail?.gender || "",
        dateOfAdmission: regData?.admission_date || "",
        uhidNo: regData?.uhid || "",
        ipdNo: ipdId,
        contactNo: regData?.patient_detail?.number || "",
        nameOfConsultant: regData?.under_care_of_doctor || "",
        bedNameAndNo: `${regData?.bed_management?.room_type || ""}/${regData?.bed_management?.bed_number || ""}`,
      };

      // Start with the initial state and merge fetched data on top
      const mergedData = {
        ...initialPatientFileData,
        ...fetchedInitialData
      };


      if (fileData?.patient_file_data) {
        // If file data exists, merge it over the mergedData
        setFormData({ ...mergedData, ...fileData.patient_file_data });
        toast.success("Patient file data loaded.");
      } else {
        // Otherwise, just use the mergedData
        setFormData(mergedData);
      }
    } catch (error) {
      console.error("Failed to fetch patient file data:", error);
      toast.error("Failed to load patient file data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchAndSetPatientData();
  }, [ipdId, fetchAndSetPatientData]);

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

      const { error } = await supabase.from("ipd_record").upsert(
        {
          ipd_id: ipdId,
          user_id: session.user.id,
          patient_file_data: formData,
        },
        { onConflict: "ipd_id,user_id" }
      );

      if (error) throw error;
      toast.success("Patient file saved successfully!");
    } catch (error) {
      console.error("Failed to save patient file data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof PatientFileData) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCheckboxChange = (group: keyof PatientFileData, field: string) => {
    setFormData((prev) => {
      if (group === "conditionOnDischarge") {
        const newGroup = { ...prev[group] };
        for (const key in newGroup) {
          (newGroup as any)[key] = key === field;
        }
        return { ...prev, [group]: newGroup };
      }

      return { ...prev, [field]: !(prev as any)[field] };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Patient File...</p>
      </div>
    );
  }

  const inputContainerClass = "flex items-center border-b border-gray-300 py-1";
  const labelClass = "font-semibold mr-2";
  const inputClass = "flex-grow p-1 focus:outline-none bg-transparent";

  return (
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-xl max-w-4xl mx-auto font-sans text-xs">
      <div className="text-center mb-6">
        <h2 className="font-bold text-lg">INDOOR PATIENT FILE</h2>
      </div>

      <div className="space-y-4">
        {/* Patient Name */}
        <div className={inputContainerClass}>
          <label className={labelClass}>Patient Name:</label>
          <input type="text" value={formData.patientName} onChange={(e) => handleInputChange(e, "patientName")} className={inputClass} />
        </div>
        {/* S/o. W/o. D/o. */}
        <div className={inputContainerClass}>
          <label className={labelClass}>S/o. W/o. D/o.:</label>
          <input type="text" value={formData.sowodo} onChange={(e) => handleInputChange(e, "sowodo")} className={inputClass} />
        </div>
        {/* Age, Sex, Admission Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
          <div className={inputContainerClass + " md:col-span-1"}>
            <label className={labelClass}>Age:</label>
            <input type="text" value={formData.age} onChange={(e) => handleInputChange(e, "age")} className={inputClass} />
          </div>
          <div className={inputContainerClass + " md:col-span-1"}>
            <label className={labelClass}>Sex:</label>
            <input type="text" value={formData.sex} onChange={(e) => handleInputChange(e, "sex")} className={inputClass} />
          </div>
          <div className={inputContainerClass + " md:col-span-2"}>
            <label className={labelClass}>Date of Admission:</label>
            <input type="date" value={formData.dateOfAdmission} onChange={(e) => handleInputChange(e, "dateOfAdmission")} className={inputClass} />
          </div>
          <div className={inputContainerClass + " md:col-span-4"}>
            <label className={labelClass}>Time of Admission:</label>
            <input type="time" value={formData.timeOfAdmission} onChange={(e) => handleInputChange(e, "timeOfAdmission")} className={inputClass} />
          </div>
        </div>
        {/* UHID, IPD, Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
          <div className={inputContainerClass + " md:col-span-1"}>
            <label className={labelClass}>UHID No:</label>
            <input type="text" value={formData.uhidNo} onChange={(e) => handleInputChange(e, "uhidNo")} className={inputClass} />
          </div>
          <div className={inputContainerClass + " md:col-span-1"}>
            <label className={labelClass}>IPD No:</label>
            <input type="text" value={formData.ipdNo} onChange={(e) => handleInputChange(e, "ipdNo")} className={inputClass} />
          </div>
          <div className={inputContainerClass + " md:col-span-2"}>
            <label className={labelClass}>Address:</label>
            <input type="text" value={formData.address} onChange={(e) => handleInputChange(e, "address")} className={inputClass} />
          </div>
        </div>
        {/* Contact No */}
        <div className={inputContainerClass}>
          <label className={labelClass}>Contact No:</label>
          <input type="text" value={formData.contactNo} onChange={(e) => handleInputChange(e, "contactNo")} className={inputClass} />
        </div>
        {/* Consultant and Department */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          <div className={inputContainerClass}>
            <label className={labelClass}>Name of Consultant:</label>
            <input type="text" value={formData.nameOfConsultant} onChange={(e) => handleInputChange(e, "nameOfConsultant")} className={inputClass} />
          </div>
          <div className={inputContainerClass}>
            <label className={labelClass}>Department:</label>
            <input type="text" value={formData.department} onChange={(e) => handleInputChange(e, "department")} className={inputClass} />
          </div>
        </div>
        {/* Bed and Referred Dr */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          <div className={inputContainerClass}>
            <label className={labelClass}>Bed Name & No:</label>
            <input type="text" value={formData.bedNameAndNo} onChange={(e) => handleInputChange(e, "bedNameAndNo")} className={inputClass} />
          </div>
          <div className={inputContainerClass}>
            <label className={labelClass}>Referred Dr:</label>
            <input type="text" value={formData.referredDr} onChange={(e) => handleInputChange(e, "referredDr")} className={inputClass} />
          </div>
        </div>
        {/* Discharge Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          <div className={inputContainerClass}>
            <label className={labelClass}>Date of Discharge:</label>
            <input type="date" value={formData.dateOfDischarge} onChange={(e) => handleInputChange(e, "dateOfDischarge")} className={inputClass} />
          </div>
          <div className={inputContainerClass}>
            <label className={labelClass}>Time of Discharge:</label>
            <input type="time" value={formData.timeOfDischarge} onChange={(e) => handleInputChange(e, "timeOfDischarge")} className={inputClass} />
          </div>
        </div>
        {/* Condition on Discharge */}
        <div className="py-2">
          <label className="font-semibold mb-2">Condition on Discharge:</label>
          <div className="flex flex-wrap gap-4 mt-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.conditionOnDischarge.improved}
                onChange={() => handleCheckboxChange("conditionOnDischarge", "improved")}
                className="mr-2"
              />
              Improved
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.conditionOnDischarge.dama}
                onChange={() => handleCheckboxChange("conditionOnDischarge", "dama")}
                className="mr-2"
              />
              DAMA
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.conditionOnDischarge.transferredToHigherCentre}
                onChange={() => handleCheckboxChange("conditionOnDischarge", "transferredToHigherCentre")}
                className="mr-2"
              />
              Transferred To Higher Centre
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.conditionOnDischarge.death}
                onChange={() => handleCheckboxChange("conditionOnDischarge", "death")}
                className="mr-2"
              />
              Death
            </label>
          </div>
        </div>
        {/* Transferred To */}
        <div className={inputContainerClass}>
          <label className={labelClass}>In case of Transferred To Center:</label>
          <input type="text" value={formData.inCaseOfTransferred} onChange={(e) => handleInputChange(e, "inCaseOfTransferred")} className={inputClass} />
        </div>
        {/* Date & Time, Allergy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          <div className={inputContainerClass}>
            <label className={labelClass}>Date & Time:</label>
            <input type="datetime-local" value={formData.dateAndTime} onChange={(e) => handleInputChange(e, "dateAndTime")} className={inputClass} />
          </div>
          <div className={inputContainerClass}>
            <label className={labelClass}>Allergy:</label>
            <input type="text" value={formData.allergy} onChange={(e) => handleInputChange(e, "allergy")} className={inputClass} />
          </div>
        </div>
        {/* MLC/NON MLC */}
        <div className="flex items-center space-x-8 py-2">
          <label className="flex items-center">
            <input type="checkbox" checked={formData.mlc} onChange={() => handleCheckboxChange("mlc", "mlc")} className="mr-2" />
            MLC
          </label>
          <label className="flex items-center">
            <input type="checkbox" checked={formData.nonMlc} onChange={() => handleCheckboxChange("nonMlc", "nonMlc")} className="mr-2" />
            NON MLC
          </label>
        </div>
      </div>

      <div className="flex justify-end mt-6 space-x-4 no-pdf">
        <PdfGenerator contentRef={formRef as React.RefObject<HTMLDivElement>} fileName="PatientFileForm" />
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
            "Save Patient File"
          )}
        </button>
      </div>
    </div>
  );
};

export default PatientFileForm;