// PatientDetailsHeader.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

// --- Type Definitions ---
interface PatientDetails {
  patientName: string;
  ageSex: string;
  roomWardNo: string;
  uhidNo: string;
  ipdNo: string;
  contactNo: string;
  underCareOfDoctor: string;
  admissionDate: string;
}

interface IPDRegistrationData {
  uhid: string;
  under_care_of_doctor: string | null;
  admission_date: string | null;
  patient_detail: { name: string; number: string | null; age: number | null; gender: string | null } | null;
  bed_management: { room_type: string; bed_number: number | string } | null;
}

// --- Main Component ---
const PatientDetailsHeader = ({ ipdId }: { ipdId: string }) => {
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPatientDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: ipdData, error: ipdError } = await supabase
        .from('ipd_registration')
        .select(`
          uhid,
          patient_detail (name, number, age, gender),
          bed_management (room_type, bed_number),
          under_care_of_doctor,
          admission_date
        `)
        .eq('ipd_id', ipdId)
        .single<IPDRegistrationData>();

      if (ipdError) throw ipdError;

      const formattedData: PatientDetails = {
        patientName: ipdData?.patient_detail?.name || "",
        ageSex: ipdData?.patient_detail?.age && ipdData?.patient_detail?.gender
          ? `${ipdData.patient_detail.age}/${ipdData.patient_detail.gender.charAt(0)}`
          : "",
        roomWardNo: `${ipdData?.bed_management?.room_type || ""}/${ipdData?.bed_management?.bed_number || ""}`,
        uhidNo: ipdData?.uhid || "",
        ipdNo: ipdId,
        contactNo: ipdData?.patient_detail?.number || "",
        underCareOfDoctor: ipdData?.under_care_of_doctor || "",
        admissionDate: ipdData?.admission_date ? format(parseISO(ipdData.admission_date), 'yyyy-MM-dd') : "",
      };
      setPatientDetails(formattedData);
    } catch (error) {
      console.error("Failed to fetch patient details:", error);
      setPatientDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchPatientDetails();
  }, [ipdId, fetchPatientDetails]);

  const inputClass = "flex-grow p-1 border-b border-gray-300 focus:outline-none bg-transparent";
  const labelClass = "font-semibold mr-2 whitespace-nowrap";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[10vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <p className="ml-4 text-sm text-gray-600">Loading Patient Details...</p>
      </div>
    );
  }

  if (!patientDetails) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[10vh]">
        <p className="ml-4 text-sm text-red-600">Could not load patient details.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mb-6">
      <div className="flex items-center col-span-2">
        <label className={labelClass}>Name of Patient:</label>
        <input type="text" value={patientDetails.patientName} className={inputClass} readOnly />
      </div>
      <div className="flex items-center col-span-2">
        <label className={labelClass}>Age/Sex:</label>
        <input type="text" value={patientDetails.ageSex} className={inputClass} readOnly />
      </div>
      <div className="flex items-center col-span-2">
        <label className={labelClass}>Room/Ward No:</label>
        <input type="text" value={patientDetails.roomWardNo} className={inputClass} readOnly />
      </div>
      <div className="flex items-center col-span-2">
        <label className={labelClass}>UHID No:</label>
        <input type="text" value={patientDetails.uhidNo} className={inputClass} readOnly />
      </div>
      <div className="flex items-center col-span-2">
        <label className={labelClass}>IPD No:</label>
        <input type="text" value={patientDetails.ipdNo} className={inputClass} readOnly />
      </div>
      <div className="flex items-center col-span-2">
        <label className={labelClass}>Contact No.:</label>
        <input type="text" value={patientDetails.contactNo} className={inputClass} readOnly />
      </div>
      <div className="flex items-center col-span-2">
        <label className={labelClass}>Under Care of Doctor:</label>
        <input type="text" value={patientDetails.underCareOfDoctor} className={inputClass} readOnly />
      </div>
      <div className="flex items-center col-span-2">
        <label className={labelClass}>Admission Date:</label>
        <input type="text" value={patientDetails.admissionDate} className={inputClass} readOnly />
      </div>
    </div>
  );
};

export default PatientDetailsHeader;