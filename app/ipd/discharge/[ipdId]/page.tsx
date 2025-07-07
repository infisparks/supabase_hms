"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // Assuming you have a supabase client initialized here
import {
  ArrowLeft,
  Save,
  UserCheck,
  FileText,
  Calendar,
  User,
  Phone,
  MapPin,
  Bed,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw, // Added for loading spinner
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import "react-toastify/dist/ReactToastify.css";

// Interface for discharge summary data stored in Supabase
interface DischargeSummarySupabase {
  id?: string; // UUID for the summary record itself
  ipd_id: number;
  patient_id: string; // Foreign key
  uhid: string; // Foreign key
  final_diagnosis: string | null;
  procedures: string | null;
  provisional_diagnosis: string | null;
  history_of_present_illness: string | null;
  investigations: string | null;
  treatment_given: string | null;
  hospital_course: string | null;
  surgery_procedure_details: string | null;
  condition_at_discharge: string | null;
  discharge_medication: string | null;
  follow_up: string | null;
  discharge_instructions: string | null;
  last_updated: string | null;
}

// Interface for the form state (camelCase for React usage)
interface DischargeDataForm {
  finalDiagnosis: string;
  procedures: string;
  provisionalDiagnosis: string;
  historyOfPresentIllness: string;
  investigations: string;
  treatmentGiven: string;
  hospitalCourse: string;
  surgeryProcedureDetails: string;
  conditionAtDischarge: string;
  dischargeMedication: string;
  followUp: string;
  dischargeInstructions: string;
}

// Patient record interface, now fetched from ipd_registration + patient_detail + bed_management
interface PatientRecord {
  patientId: string; // From patient_detail
  uhid: string; // From patient_detail
  ipdId: string; // From ipd_registration
  name: string; // From patient_detail
  mobileNumber: string; // From patient_detail
  address?: string; // From patient_detail
  age?: number | null; // From patient_detail
  gender?: string | null; // From patient_detail
  relativeName?: string | null; // From ipd_registration
  relativePhone?: number | null; // From ipd_registration
  relativeAddress?: string | null; // From ipd_registration
  roomType?: string | null; // From bed_management via ipd_registration.bed_id
  bedNumber?: number | null; // From bed_management via ipd_registration.bed_id
  bedId?: number | null; // The actual bed_id to update bed status
  admitDate?: string | null; // From ipd_registration.admission_date or created_at
  dischargeDate?: string | null; // From ipd_registration.discharge_date
}

export default function DischargeSummaryPage() {
  const { ipdId } = useParams() as { ipdId: string }; // Only need ipdId for this page
  const router = useRouter();

  /* State for basic IPD + patient info */
  const [patientRecord, setPatientRecord] = useState<PatientRecord | null>(null);

  /* State for our discharge-summary form */
  const [dischargeData, setDischargeData] = useState<DischargeDataForm>({
    finalDiagnosis: "",
    procedures: "",
    provisionalDiagnosis: "",
    historyOfPresentIllness: "",
    investigations: "",
    treatmentGiven: "",
    hospitalCourse: "",
    surgeryProcedureDetails: "",
    conditionAtDischarge: "",
    dischargeMedication: "",
    followUp: "",
    dischargeInstructions: "",
  });

  /* UI loading/saving flags */
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true); // Set to true initially for data fetch

  /* Info about when the summary was last saved */
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  /* Refs for enabling Ctrl+B → **bold** in <textarea> */
  const textRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Helper function to format room type
  const formatRoomType = (roomType: string | null) => {
    if (!roomType) return "N/A";
    const upperCaseTypes = ["icu", "nicu"];
    const lowerType = roomType.toLowerCase();
    if (upperCaseTypes.includes(lowerType)) {
      return roomType.toUpperCase();
    }
    return roomType.charAt(0).toUpperCase() + roomType.slice(1).toLowerCase();
  };

  /* ─── Fetch IPD and Patient Data ───────────────────────────────── */
  const fetchPatientAndIpdData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ipdData, error: ipdError } = await supabase
        .from("ipd_registration")
        .select(
          `
          ipd_id,
          admission_date,
          created_at,
          discharge_date,
          uhid,
          relative_name,
          relative_ph_no,
          relative_address,
          bed_id,
          patient_detail (
            patient_id,
            name,
            number,
            age,
            gender,
            address
          ),
          bed_management (
            room_type,
            bed_number
          )
          `
        )
        .eq("ipd_id", ipdId)
        .single();

      if (ipdError) {
        console.error("Error fetching IPD data:", ipdError);
        toast.error("Failed to load IPD patient data.");
        setLoading(false);
        return;
      }

      // Check if patient_detail and bed_management are arrays and get the first element
      const patientDetail = Array.isArray(ipdData.patient_detail) ? ipdData.patient_detail[0] : ipdData.patient_detail;
      const bedManagement = Array.isArray(ipdData.bed_management) ? ipdData.bed_management[0] : ipdData.bed_management;

      if (!ipdData || !patientDetail) {
        toast.error("Patient or IPD record not found.");
        setLoading(false);
        return;
      }

      const patient: PatientRecord = {
        patientId: patientDetail.patient_id,
        uhid: ipdData.uhid,
        ipdId: String(ipdData.ipd_id), // Ensure it's string for useParams consistency
        name: patientDetail.name,
        mobileNumber: String(patientDetail.number || ""),
        address: patientDetail.address,
        age: patientDetail.age,
        gender: patientDetail.gender,
        relativeName: ipdData.relative_name,
        relativePhone: ipdData.relative_ph_no,
        relativeAddress: ipdData.relative_address,
        roomType: bedManagement?.room_type || null,
        bedNumber: bedManagement?.bed_number || null,
        bedId: ipdData.bed_id, // Keep bed_id to update its status later
        admitDate: ipdData.admission_date || ipdData.created_at,
        dischargeDate: ipdData.discharge_date,
      };
      setPatientRecord(patient);

      // Fetch existing discharge summary if available
      const { data: summaryData, error: summaryError } = await supabase
        .from("discharge_summaries")
        .select("*")
        .eq("ipd_id", ipdId)
        .single();

      if (summaryError && summaryError.code !== 'PGRST116') { // PGRST116 is "no rows found"
        console.error("Error fetching discharge summary:", summaryError);
        toast.error("Failed to load existing discharge summary.");
      } else if (summaryData) {
        // Map fetched data to form state (snake_case to camelCase)
        setDischargeData({
          finalDiagnosis: summaryData.final_diagnosis || "",
          procedures: summaryData.procedures || "",
          provisionalDiagnosis: summaryData.provisional_diagnosis || "",
          historyOfPresentIllness: summaryData.history_of_present_illness || "",
          investigations: summaryData.investigations || "",
          treatmentGiven: summaryData.treatment_given || "",
          hospitalCourse: summaryData.hospital_course || "",
          surgeryProcedureDetails: summaryData.surgery_procedure_details || "",
          conditionAtDischarge: summaryData.condition_at_discharge || "",
          dischargeMedication: summaryData.discharge_medication || "",
          followUp: summaryData.follow_up || "",
          dischargeInstructions: summaryData.discharge_instructions || "",
        });
        setLastSaved(summaryData.last_updated);
      }
    } catch (err) {
      console.error("Caught error in fetchPatientAndIpdData:", err);
      toast.error("An unexpected error occurred while loading patient data.");
    } finally {
      setLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) {
      fetchPatientAndIpdData();
    }
  }, [ipdId, fetchPatientAndIpdData]);


  /* ─── "Ctrl+B → **bold**" textarea helper ───────────────────────────────── */
  const makeBold = (
    field: keyof DischargeDataForm,
    ta: HTMLTextAreaElement
  ) => {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.substring(start, end);
    if (!sel) return;
    const newText =
      ta.value.substring(0, start) +
      "**" +
      sel +
      "**" +
      ta.value.substring(end);
    setDischargeData((d) => ({
      ...d,
      [field]: newText,
    }));
    // after inserting, restore focus & cursor
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(
        start + sel.length + 4,
        start + sel.length + 4
      );
    }, 0);
  };

  const handleKey = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    fieldName: keyof DischargeDataForm
  ) => {
    if (e.ctrlKey && e.key === "b") {
      e.preventDefault();
      const ta = textRefs.current[fieldName];
      if (ta) {
        makeBold(fieldName, ta);
      }
    }
  };

  const handleChange = (fieldName: keyof DischargeDataForm, val: string) => {
    setDischargeData((d) => ({
      ...d,
      [fieldName]: val,
    }));
  };

  /* ─── "Save Draft" → write discharge summary into discharge_summaries table ─────────── */
  const saveDraft = async () => {
    if (!patientRecord) {
      toast.error("Patient record not loaded. Cannot save.");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: DischargeSummarySupabase = {
        ipd_id: parseInt(patientRecord.ipdId),
        patient_id: patientRecord.patientId,
        uhid: patientRecord.uhid,
        final_diagnosis: dischargeData.finalDiagnosis || null,
        procedures: dischargeData.procedures || null,
        provisional_diagnosis: dischargeData.provisionalDiagnosis || null,
        history_of_present_illness: dischargeData.historyOfPresentIllness || null,
        investigations: dischargeData.investigations || null,
        treatment_given: dischargeData.treatmentGiven || null,
        hospital_course: dischargeData.hospitalCourse || null,
        surgery_procedure_details: dischargeData.surgeryProcedureDetails || null,
        condition_at_discharge: dischargeData.conditionAtDischarge || null,
        discharge_medication: dischargeData.dischargeMedication || null,
        follow_up: dischargeData.followUp || null,
        discharge_instructions: dischargeData.dischargeInstructions || null,
        last_updated: now,
      };

      // Check if a summary already exists for this ipd_id
      const { data: existingSummary, error: fetchError } = await supabase
        .from("discharge_summaries")
        .select("id")
        .eq("ipd_id", patientRecord.ipdId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        throw fetchError;
      }

      if (existingSummary) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("discharge_summaries")
          .update(payload)
          .eq("id", existingSummary.id);
        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("discharge_summaries")
          .insert(payload);
        if (insertError) throw insertError;
      }

      setLastSaved(now);
      toast.success("Discharge note saved!");
    } catch (err: any) {
      console.error("Save failed:", err);
      toast.error("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ─── "Complete Discharge" → update discharge_date in ipd_registration, free bed, and save summary ─ */
  const finalDischarge = async () => {
    if (!patientRecord) {
      toast.error("Patient record not loaded. Cannot discharge.");
      return;
    }
    if (!patientRecord.roomType || !patientRecord.bedNumber || !patientRecord.bedId) {
      toast.error("Missing bed/ward information. Please ensure patient is assigned a bed.");
      return;
    }
    setLoading(true); // Use loading for the final discharge process
    try {
      const now = new Date().toISOString();
      
      // 1. Update discharge_date in ipd_registration
      const { error: ipdUpdateError } = await supabase
        .from("ipd_registration")
        .update({ discharge_date: now })
        .eq("ipd_id", parseInt(patientRecord.ipdId)); // Ensure ipdId is number for DB
      if (ipdUpdateError) throw ipdUpdateError;

      // 2. Save the discharge summary text (same logic as saveDraft, but ensure it's saved)
      const payload: DischargeSummarySupabase = {
        ipd_id: parseInt(patientRecord.ipdId),
        patient_id: patientRecord.patientId,
        uhid: patientRecord.uhid,
        final_diagnosis: dischargeData.finalDiagnosis || null,
        procedures: dischargeData.procedures || null,
        provisional_diagnosis: dischargeData.provisionalDiagnosis || null,
        history_of_present_illness: dischargeData.historyOfPresentIllness || null,
        investigations: dischargeData.investigations || null,
        treatment_given: dischargeData.treatmentGiven || null,
        hospital_course: dischargeData.hospitalCourse || null,
        surgery_procedure_details: dischargeData.surgeryProcedureDetails || null,
        condition_at_discharge: dischargeData.conditionAtDischarge || null,
        discharge_medication: dischargeData.dischargeMedication || null,
        follow_up: dischargeData.followUp || null,
        discharge_instructions: dischargeData.dischargeInstructions || null,
        last_updated: now,
      };

      const { data: existingSummary, error: fetchError } = await supabase
        .from("discharge_summaries")
        .select("id")
        .eq("ipd_id", parseInt(patientRecord.ipdId)) // Ensure ipdId is number for DB
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingSummary) {
        const { error: updateError } = await supabase
          .from("discharge_summaries")
          .update(payload)
          .eq("id", existingSummary.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("discharge_summaries")
          .insert(payload);
        if (insertError) throw insertError;
      }

      // 3. Free up the bed in bed_management
      const { error: bedUpdateError } = await supabase
        .from("bed_management")
        .update({ status: "Available" })
        .eq("id", patientRecord.bedId);
      if (bedUpdateError) throw bedUpdateError;
      
      toast.success("Patient discharged successfully!");
      // Redirect to billing or a confirmation page
      router.push(`/ipd/billing/${patientRecord.ipdId}`); // Adjust this route as needed
    } catch (err: any) {
      console.error("Error during final discharge:", err);
      toast.error("Error during discharge: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Render Loading State ───────────────────────────────── */
  if (loading && !patientRecord) { // Only show full-page loader if no record is loaded yet
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
        <div className="text-center">
          <RefreshCw className="h-16 w-16 text-teal-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Loading patient record...</p>
        </div>
      </div>
    );
  }

  // If loading is false and patientRecord is still null (e.g., ipdId was invalid)
  if (!patientRecord) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <AlertTriangle className="h-20 w-20 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Patient Record Not Found</h2>
          <p className="text-gray-600 mb-6">The IPD record for ID "{ipdId}" could not be loaded. It may not exist or an error occurred.</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg shadow hover:bg-teal-700 transition-colors"
          >
            <ArrowLeft size={20} className="inline-block mr-2" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  /* ─── Helper to render a single field with (Ctrl+B) hint ───────────────────── */
  const Field = (
    key: keyof DischargeDataForm,
    label: string,
    rows = 4,
    placeholder = "Type here…"
  ) => (
    <div className="space-y-2">
      <label htmlFor={key} className="block text-sm font-medium text-gray-700">
        {label}
        <span className="text-xs text-gray-500 ml-2">(Ctrl+B for bold)</span>
      </label>
      <textarea
        id={key} // Added ID for accessibility and htmlFor
        ref={(el) => {
          textRefs.current[key as string] = el;
        }}
        rows={rows}
        value={dischargeData[key] || ""} // Use dischargeData state
        placeholder={placeholder}
        onKeyDown={(e) => handleKey(e, key)}
        onChange={(e) => handleChange(key, e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y min-h-[50px] shadow-sm"
      />
    </div>
  );

  /* ─── Full JSX ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-teal-50">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="bg-white border-b border-teal-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <button
            onClick={() => router.push(`/ipd/billing/${patientRecord.ipdId}`)} // Adjusted route based on new structure
            className="flex items-center text-teal-600 hover:text-teal-800 font-medium transition-colors"
          >
            <ArrowLeft size={18} className="mr-2" /> Back to Billing
          </button>

          <div className="flex items-center gap-4">
            {lastSaved && (
              <div className="flex items-center text-sm text-gray-500">
                <Clock size={14} className="mr-1" />
                Last saved:{" "}
                {format(parseISO(lastSaved), "MMM dd, yyyy 'at' HH:mm")}
              </div>
            )}

            <button
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={saveDraft}
              disabled={saving || loading} // Disable if overall loading or saving is in progress
            >
              {saving ? (
                <span className="animate-spin border-2 border-white border-t-transparent h-4 w-4 rounded-full mr-2" />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              {saving ? "Saving…" : "Save Info"}
            </button>

            {!patientRecord.dischargeDate && (
              <button
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={finalDischarge}
                disabled={loading || saving} // Disable if overall loading or saving is in progress
              >
                {loading ? (
                  <span className="animate-spin border-2 border-white border-t-transparent h-4 w-4 rounded-full mr-2" />
                ) : (
                  <UserCheck size={16} className="mr-2" />
                )}
                {loading ? "Discharging…" : "Discharge Patient"}
              </button>
            )}
              {patientRecord.dischargeDate && (
              <button
                className="flex items-center px-4 py-2 bg-gray-400 text-white rounded-lg shadow-sm cursor-not-allowed"
                disabled // Keep disabled as the patient is already discharged
              >
                <CheckCircle size={16} className="mr-2" />
                Already Discharged
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* ─── Patient Summary Card ─────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-8 border border-gray-100">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {patientRecord.name}
                  </h1>
                  <p className="text-teal-50">
                    UHID: {patientRecord.uhid}
                  </p>
                </div>

                <div className="mt-2 md:mt-0 flex flex-col md:items-end">
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-sm">
                    <Bed size={14} className="mr-2" />
                    {formatRoomType(patientRecord.roomType || "")} •{" "}
                    {patientRecord.bedNumber ? `Bed ${patientRecord.bedNumber}` : "No Bed"}
                  </div>

                  <div className="mt-2 text-teal-50 text-sm">
                    {patientRecord.dischargeDate ? (
                      <span className="inline-flex items-center">
                        <CheckCircle size={14} className="mr-1" /> Discharged:{" "}
                        {format(
                          parseISO(patientRecord.dischargeDate),
                          "dd MMM yyyy 'at' HH:mm"
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center">
                        <Calendar size={14} className="mr-1" /> Admitted:{" "}
                        {patientRecord.admitDate
                          ? format(
                              parseISO(patientRecord.admitDate),
                              "dd MMM yyyy"
                            )
                          : "Unknown"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ─── Patient Details ─────────────────────────── */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <User size={18} className="mr-2 text-teal-600" /> Patient
                    Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-start">
                      <Phone
                        size={16}
                        className="mr-2 text-gray-400 mt-0.5"
                      />
                      <div>
                        <p className="text-sm text-gray-500">Mobile</p>
                        <p className="font-medium">
                          {patientRecord.mobileNumber || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <MapPin
                        size={16}
                        className="mr-2 text-gray-400 mt-0.5"
                      />
                      <div>
                        <p className="text-sm text-gray-500">Address</p>
                        <p className="font-medium">
                          {patientRecord.address || "Not provided"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-sm text-gray-500">Age</p>
                        <p className="font-medium">
                          {patientRecord.age || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Gender</p>
                        <p className="font-medium">
                          {patientRecord.gender || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── Relative Details ────────────────────────── */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <User size={18} className="mr-2 text-teal-600" /> Relative
                    Details
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">
                        {patientRecord.relativeName || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">
                        {patientRecord.relativePhone || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="font-medium">
                        {patientRecord.relativeAddress || "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ─── Discharge Status ───────────────────────── */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <FileText size={18} className="mr-2 text-teal-600" />{" "}
                    Discharge Status
                  </h3>
                  <div className="space-y-3">
                    {patientRecord.dischargeDate ? (
                      <div className="flex items-center p-3 bg-green-50 rounded-lg">
                        <CheckCircle
                          size={20}
                          className="text-green-600 mr-3"
                        />
                        <div>
                          <p className="font-medium text-green-800">
                            Patient Discharged
                          </p>
                          <p className="text-sm text-green-600">
                            {format(
                              parseISO(patientRecord.dischargeDate),
                              "MMM dd, yyyy 'at' HH:mm"
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center p-3 bg-yellow-50 rounded-lg">
                        <AlertTriangle
                          size={20}
                          className="text-yellow-600 mr-3"
                        />
                        <div>
                          <p className="font-medium text-yellow-800">
                            Pending Discharge
                          </p>
                          <p className="text-sm text-yellow-600">
                            Complete the form to discharge
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Discharge Summary Form ───────────────────────── */}
          <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <FileText size={24} className="mr-3" /> Discharge Summary
              </h2>
              <p className="text-blue-50 mt-1">
                Fill in all medical discharge details below
              </p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {Field(
                    "finalDiagnosis",
                    "Final Diagnosis (primary first)",
                    3
                  )}
                  {Field(
                    "procedures",
                    "Procedures (dates, complications)",
                    4
                  )}
                  {Field(
                    "provisionalDiagnosis",
                    "Provisional Diagnosis",
                    3
                  )}
                  {Field(
                    "historyOfPresentIllness",
                    "History of Present Illness",
                    4
                  )}
                  {Field("investigations", "Investigations", 4)}
                  {Field("treatmentGiven", "Treatment Given", 4)}
                </div>

                <div className="space-y-6">
                  {Field("hospitalCourse", "Hospital Course", 4)}
                  {Field(
                    "surgeryProcedureDetails",
                    "Surgery / Procedure Details",
                    4
                  )}
                  {Field("conditionAtDischarge", "Condition at Discharge", 3)}
                  {Field("dischargeMedication", "Discharge Medication", 4)}
                  {Field("followUp", "Follow-up", 3)}
                  {Field(
                    "dischargeInstructions",
                    "Discharge Instructions (diet, activity, etc.)",
                    4
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}