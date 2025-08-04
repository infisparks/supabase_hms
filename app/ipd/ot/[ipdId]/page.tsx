// app/ipd/ot/[ipdId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Resolver, useForm, type SubmitHandler } from "react-hook-form"; // Removed Controller, as not directly used for non-checkbox inputs
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  RefreshCw,
  User,
  Phone,
  MapPin,
  Bed,
  Save,
  AlertTriangle,
  Stethoscope,
  Calendar,
  Pencil, // Added for edit icon hint
  CalendarDays, // Added for date picker icon
} from "lucide-react";
import { format, parseISO } from "date-fns";
import Layout from "@/components/global/Layout"; // Assuming this path is correct

// --- Type Definitions ---

// Re-using patient_detail and bed_management interfaces as they are from other files
interface PatientDetailSupabase {
  patient_id: number;
  name: string;
  number: number | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  age_unit: string | null;
  dob: string | null;
  uhid: string;
}

interface BedManagementSupabase {
  id: number;
  room_type: string;
  bed_number: number;
  bed_type: string;
  status: string;
}

// Minimal IPDRegistration for this page's fetch (expanded slightly for better data on card)
interface IPDRegistrationForOT {
  ipd_id: number;
  uhid: string;
  bed_id: number | null;
  admission_date: string | null;
  created_at: string;
  patient_detail: PatientDetailSupabase | null;
  bed_management: BedManagementSupabase | null;
  under_care_of_doctor: string | null;
}

// Interface for fetching existing OT data
interface OtDetailsSupabase {
  id: string; // UUID of the OT record
  ipd_id: number;
  patient_id: number | null; // Nullable if not always provided/used from patient_detail
  uhid: string;
  ot_type: "Major" | "Minor";
  ot_notes: string | null;
  ot_date: string; // ISO string
  created_at: string;
}

interface OTFormInputs {
  otType: "Major" | "Minor" | undefined; // Undefined for no selection, per React Hook Form / yup setup
  otNotes: string | null;
  otDate: string; // Added for custom OT date
}

// --- Validation Schema ---
const otSchema = yup.object().shape({
  otType: yup.string()
    .oneOf(["Major", "Minor"], "Please select either Major OT or Minor OT")
    .required("OT Type is required"), // required() works well with undefined
  otNotes: yup.string().nullable(),
  otDate: yup.string().required("OT Date is required"), // Added validation for OT date
});

export default function OTPage() {
  const { ipdId } = useParams() as { ipdId: string };
  const router = useRouter();

  const [patientRecord, setPatientRecord] = useState<IPDRegistrationForOT | null>(null);
  const [existingOtRecord, setExistingOtRecord] = useState<OtDetailsSupabase | null>(null); // State for fetched OT data
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Get current date in YYYY-MM-DD format for default value
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<OTFormInputs>({
    resolver: yupResolver(otSchema) as Resolver<OTFormInputs>,
    defaultValues: {
      otType: undefined,
      otNotes: null,
      otDate: getCurrentDate(), // Set current date as default
    },
    // IMPORTANT: Enable re-initialization if existingOtRecord changes after initial load
    // This allows the form to populate if data loads after the form renders
    mode: "onBlur", // or "onChange", or "onTouched"
  });

  const selectedOtType = watch("otType");

  // Function to handle checkbox changes for otType
  const handleOtTypeChange = (type: "Major" | "Minor") => {
    setValue("otType", selectedOtType === type ? undefined : type);
  };

  // --- Data Fetching: Patient Details and Existing OT Record ---
  const fetchPatientAndOtData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch IPD registration and patient details
      const { data: ipdData, error: ipdError } = await supabase
        .from("ipd_registration")
        .select(
          `
          ipd_id,
          uhid,
          bed_id,
          admission_date,
          created_at,
          under_care_of_doctor,
          patient_detail (patient_id, name, number, age, gender, address, age_unit, dob, uhid),
          bed_management (id, room_type, bed_number, bed_type, status)
          `
        )
        .eq("ipd_id", ipdId)
        .single<IPDRegistrationForOT>();

      if (ipdError) {
        console.error("Error fetching patient data for OT:", ipdError);
        toast.error("Failed to load patient data for OT form.");
        setPatientRecord(null);
        setExistingOtRecord(null);
        return;
      }
      if (!ipdData) {
        toast.error("IPD record not found for this ID.");
        setPatientRecord(null);
        setExistingOtRecord(null);
        return;
      }
      setPatientRecord(ipdData);

      // 2. Fetch existing OT details for this ipdId
      const { data: otData, error: otError } = await supabase
        .from("ot_details")
        .select("*")
        .eq("ipd_id", ipdId)
        .single<OtDetailsSupabase>(); // Use .single() due to UNIQUE constraint on ipd_id

      if (otError && otError.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error("Error fetching existing OT details:", otError);
        toast.error("Failed to load existing OT details.");
        setExistingOtRecord(null);
      } else if (otData) {
        // If data found, set it and pre-fill the form
        setExistingOtRecord(otData);
        // Format the existing OT date to YYYY-MM-DD for the date input
        const existingOtDate = otData.ot_date ? otData.ot_date.split('T')[0] : getCurrentDate();
        reset({
          otType: otData.ot_type,
          otNotes: otData.ot_notes,
          otDate: existingOtDate,
        });
        toast.info("Existing OT details loaded for editing.");
      } else {
        setExistingOtRecord(null); // No existing record
        reset({ 
          otType: undefined, 
          otNotes: null,
          otDate: getCurrentDate(), // Reset to current date for new entry
        }); // Ensure form is clear for new entry
      }

    } catch (err) {
      console.error("Caught error in fetchPatientAndOtData:", err);
      toast.error("An unexpected error occurred while loading data.");
    } finally {
      setLoading(false);
    }
  }, [ipdId, reset]); // Add reset to dependency array to avoid stale closures

  useEffect(() => {
    if (ipdId) {
      fetchPatientAndOtData();
    }
  }, [ipdId, fetchPatientAndOtData]);

  // --- Handle OT form submission (INSERT or UPDATE) ---
  const onSubmit: SubmitHandler<OTFormInputs> = async (formData) => {
    if (!patientRecord) {
      toast.error("Patient record not loaded. Cannot save OT details.");
      return;
    }
    setSaving(true);
    try {
      // Convert the date string to ISO format for database storage
      // Use the date as-is without timezone conversion to avoid date shifting
      const otDateISO = formData.otDate + 'T00:00:00.000Z';
      
      const payload = {
        ipd_id: patientRecord.ipd_id,
        uhid: patientRecord.uhid,
        ot_type: formData.otType,
        ot_notes: formData.otNotes,
        ot_date: otDateISO, // Use the selected date instead of current timestamp
        // created_at will default in DB for new inserts. For updates, it stays the same.
      };

      let error = null;
      if (existingOtRecord) {
        // If existing record, perform UPDATE
        const { error: updateError } = await supabase
          .from("ot_details")
          .update(payload)
          .eq("id", existingOtRecord.id); // Update by unique 'id' of the OT record
        error = updateError;
      } else {
        // If no existing record, perform INSERT
        const { error: insertError } = await supabase
          .from("ot_details")
          .insert(payload);
        error = insertError;
      }

      if (error) throw error;

      toast.success(existingOtRecord ? "OT details updated successfully!" : "OT details saved successfully!");
      // Re-fetch data to update the UI with the latest saved/updated record
      await fetchPatientAndOtData(); // This will refresh existingOtRecord and reset the form
      // No explicit reset needed here, as fetchPatientAndOtData() handles it.
      // router.push(`/ipd/management`); // You might want to stay on the page after update, or go back to management
    } catch (err: any) {
      console.error("Error saving OT details:", err);
      toast.error("Failed to save OT details: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper function to format room type display (e.g., "icu" -> "ICU")
  const formatRoomType = useCallback((roomType: string | null) => {
    if (!roomType) return "N/A";
    const upperCaseTypes = ["icu", "nicu"];
    const lowerType = roomType.toLowerCase();
    if (upperCaseTypes.includes(lowerType)) {
      return roomType.toUpperCase();
    }
    return roomType.charAt(0).toUpperCase() + roomType.slice(1).toLowerCase();
  }, []);

  // --- Loading and Error States ---
  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
          <div className="text-center">
            <RefreshCw className="h-16 w-16 text-teal-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Loading OT patient data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!patientRecord) {
    return (
      <Layout>
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
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-teal-50">
        {/* Header Section */}
        <header className="bg-white border-b border-teal-100 shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <button
              onClick={() => router.push(`/ipd/management`)}
              className="flex items-center text-teal-600 hover:text-teal-800 font-medium transition-colors"
            >
              <ArrowLeft size={18} className="mr-2" /> Back to IPD Management
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              OT Details for IPD: {ipdId}
              {existingOtRecord && (
                <span className="ml-3 text-base text-gray-500 flex items-center">
                  <Pencil size={16} className="mr-1" /> Editing
                </span>
              )}
            </h1>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Patient Summary Card */}
            <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-8 border border-gray-100">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{patientRecord.patient_detail?.name || "N/A"}</h2>
                    <p className="text-teal-50">UHID: {patientRecord.uhid || "Not assigned"}</p>
                    <p className="text-teal-50 mt-1">
                      Under care of Dr.: <span className="font-semibold">{patientRecord.under_care_of_doctor || "N/A"}</span>
                    </p>
                  </div>
                  <div className="mt-2 md:mt-0 flex flex-col md:items-end">
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-sm">
                      <Bed size={14} className="mr-2" />
                      {formatRoomType(patientRecord.bed_management?.room_type || "")} •{" "}
                      {patientRecord.bed_management?.bed_number ? `Bed ${patientRecord.bed_management.bed_number}` : "No Bed"}
                    </div>
                    <div className="mt-2 text-teal-50 text-sm">
                      <Calendar size={14} className="mr-1" /> Admitted:{" "}
                      {patientRecord.admission_date
                        ? format(parseISO(patientRecord.admission_date), "dd MMM,yyyy")
                        : "Unknown"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Patient Details Sub-card */}
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <User size={18} className="mr-2 text-teal-600" /> Patient Details
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-start">
                        <Phone size={16} className="mr-2 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Mobile</p>
                          <p className="font-medium">{patientRecord.patient_detail?.number ? String(patientRecord.patient_detail.number) : "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <MapPin size={16} className="mr-2 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-medium">{patientRecord.patient_detail?.address || "Not provided"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-sm text-gray-500">Age</p>
                          <p className="font-medium">
                            {patientRecord.patient_detail?.age || "N/A"} {patientRecord.patient_detail?.age_unit || "years"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Gender</p>
                          <p className="font-medium">{patientRecord.patient_detail?.gender || "Not provided"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* OT Form Card */}
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <Stethoscope size={18} className="mr-2 text-teal-600" /> OT Details
                    </h3>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">OT Type <span className="text-red-500">*</span></label>
                        <div className="flex space-x-4">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="majorOt"
                              checked={selectedOtType === "Major"}
                              onChange={() => handleOtTypeChange("Major")}
                              className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                            />
                            <label htmlFor="majorOt" className="ml-2 text-sm text-gray-900">Major OT</label>
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="minorOt"
                              checked={selectedOtType === "Minor"}
                              onChange={() => handleOtTypeChange("Minor")}
                              className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                            />
                            <label htmlFor="minorOt" className="ml-2 text-sm text-gray-900">Minor OT</label>
                          </div>
                        </div>
                        {errors.otType && (
                          <p className="text-red-500 text-xs mt-1">{errors.otType.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="otDate" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <CalendarDays size={16} className="mr-2 text-teal-600" />
                          OT Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          id="otDate"
                          {...register("otDate")}
                          className={`w-full px-3 py-2 border rounded-lg shadow-sm
                            ${errors.otDate ? "border-red-500" : "border-gray-300"}
                            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent`}
                        />
                        {errors.otDate && (
                          <p className="text-red-500 text-xs mt-1">{errors.otDate.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="otNotes" className="block text-sm font-medium text-gray-700 mb-2">
                          OT Notes/Procedure Details (Optional)
                        </label>
                        <textarea
                          id="otNotes"
                          rows={6}
                          {...register("otNotes")}
                          placeholder="Enter details about the operation/procedure here..."
                          className={`w-full px-3 py-2 border rounded-lg shadow-sm
                            ${errors.otNotes ? "border-red-500" : "border-gray-300"}
                            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y`}
                        />
                        {errors.otNotes && (
                          <p className="text-red-500 text-xs mt-1">{errors.otNotes.message}</p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={Boolean(saving || loading)} // Explicit boolean cast for disabled prop
                        className={`w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-lg font-medium text-white
                          ${Boolean(saving || loading) ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700"}
                          transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500`}
                      >
                        {saving ? (
                          <span className="animate-spin border-2 border-white border-t-transparent h-5 w-5 rounded-full mr-2" />
                        ) : (
                          <Save size={20} className="mr-2" />
                        )}
                        {existingOtRecord ? (saving ? "Updating..." : "Update OT Details") : (saving ? "Saving..." : "Save OT Details")}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </Layout>
  );
}