"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { RefreshCw, Phone, Stethoscope, Cake, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import the sheet components
import InvestigationSheetPage from "./investigation-sheet";
import DoctorVisitPage from "./doctor-visit";
import PatientChargesSheet from "./patient-charges-sheet";
import GlucoseMonitoringSheet from "./glucose-monitoring-sheet";
import IndoorPatientProgressNotes from "./indoor-patient-progress-notes";
import NursesNotesSheet from "./nurses-notes";
import VitalsSheet from "./vitals-sheet";
import AdmissionAssessmentForm from "./admission-assessment-form";
import DrugChartSheet from "./drug-chart";
import IVInfusionSheet from "./iv-infusion-sheet";
import ClinicalNotesSheet from "./clinical-notes-sheet";
import EmergencyCareRecordSheet from "./emergency-care-record-sheet"; 
import PatientFileForm from "./patient-file"; 
import BloodTransfusionConsentForm from "./blood-transfusion-consent-form"; 
import BloodTransfusionRecord from "./blood-transfusion-record"; 
import SurgicalConsentForm from "./surgical-consent-form"; 
import DischargeAgainstMedicalAdvice from "./discharge-against-medical-advice"; // <-- ADDED THE NEW COMPONENT
import discharge from "./discharge"
// --- Type Definitions ---
interface PatientDetails {
  uhid: string;
  name: string;
  number: string;
  roomType: string;
  bedNumber: number | string;
  ipdId: string;
  age: number | null;
  gender: string | null;
  consultantDoctor: string | null;
  admissionDate: string | null;
}

interface IPDRegistrationData {
  uhid: string;
  under_care_of_doctor: string | null;
  admission_date: string | null;
  patient_detail: { name: string; number: number | null; age: number | null; gender: string | null } | null;
  bed_management: { room_type: string; bed_number: number | string } | null;
}

// --- Main Page Component ---
const IPDRecordPage = () => {
  const { ipdId } = useParams();
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("discharge-against-medical-advice"); // <-- SET THE NEW TAB AS DEFAULT

  const tabs = [
    { value: "discharge-against-medical-advice", label: "Discharge AMA" }, // <-- ADDED THE NEW TAB
    { value: "surgical-consent", label: "Surgical Consent" },
    { value: "blood-transfusion-record", label: "Transfusion Record" },
    { value: "blood-transfusion-consent", label: "Blood Consent" },
    { value: "patient-file", label: "Patient File" },
    { value: "charge", label: "Charges" },
    { value: "glucose", label: "Glucose" },
    { value: "admission", label: "Admission" },
    { value: "investigation", label: "Investigation" },
    { value: "clinic", label: "Clinic" },
    { value: "progress", label: "Progress" },
    { value: "nurse", label: "Nurse" },
    { value: "vital", label: "Vitals" },
    { value: "doctor", label: "Doctor" },
    { value: "drug-chart", label: "Drug Chart" },
    { value: "iv-infusion", label: "IV Infusion" },
    { value: "clinical-notes", label: "Clinical Notes" },
    { value: "discharge", label: "Discharge" },
    { value: "emergency-care", label: "Emergency Care" },
  ];

  // Function to fetch the IPD record and patient details
  const fetchDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

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

      const patientDetail = ipdData.patient_detail;
      const bedManagement = ipdData.bed_management;

      const formattedPatientDetails: PatientDetails = {
        uhid: ipdData.uhid,
        name: patientDetail?.name || 'Unknown Patient',
        number: patientDetail?.number ? String(patientDetail.number) : 'N/A',
        roomType: bedManagement?.room_type || 'N/A',
        bedNumber: bedManagement?.bed_number || 'N/A',
        ipdId: ipdId as string,
        age: patientDetail?.age || null,
        gender: patientDetail?.gender || null,
        consultantDoctor: ipdData.under_care_of_doctor || null,
        admissionDate: ipdData.admission_date || null,
      };
      setPatientDetails(formattedPatientDetails);
    } catch (error) {
      console.error("Failed to fetch IPD record or patient details:", error);
      toast.error("Failed to load IPD record.");
      setPatientDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchDetails();
  }, [ipdId, fetchDetails]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <Card className="mb-6 shadow-md">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-blue-50 space-y-2 md:space-y-0">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-700">
            <span className="text-blue-600 font-bold">Patient Details</span>
          </CardTitle>
          {patientDetails && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <Badge variant="secondary" className="bg-blue-200 text-blue-800">Patient: {patientDetails.name}</Badge>
              <Badge variant="secondary" className="bg-orange-200 text-orange-800 flex items-center gap-1"><Phone className="h-3 w-3" /> Mobile: {patientDetails.number}</Badge>
              <Badge variant="secondary" className="bg-gray-200 text-gray-800">UHID: {patientDetails.uhid}</Badge>
              {patientDetails.age && (<Badge variant="secondary" className="bg-purple-200 text-purple-800 flex items-center gap-1"><Cake className="h-3 w-3" /> Age: {patientDetails.age} {patientDetails.gender ? `(${patientDetails.gender.charAt(0)})` : ''}</Badge>)}
              {patientDetails.consultantDoctor && (<Badge variant="secondary" className="bg-indigo-200 text-indigo-800 flex items-center gap-1"><Stethoscope className="h-3 w-3" /> Doctor: {patientDetails.consultantDoctor}</Badge>)}
              <Badge variant="secondary" className="bg-green-200 text-green-800">Room: {patientDetails.roomType} - Bed: {patientDetails.bedNumber}</Badge>
              {patientDetails.admissionDate && (<Badge variant="secondary" className="bg-teal-200 text-teal-800 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Admitted: {format(parseISO(patientDetails.admissionDate), 'dd MMM, yyyy')}</Badge>)}
              <Badge variant="secondary" className="bg-red-200 text-red-800">IPD ID: {ipdId}</Badge>
            </div>
          )}
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 h-auto gap-1 p-2 rounded-lg shadow-md">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:bg-gray-100">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="discharge-against-medical-advice" className="mt-6">
          <DischargeAgainstMedicalAdvice ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="surgical-consent" className="mt-6">
          <SurgicalConsentForm ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="blood-transfusion-record" className="mt-6">
          <BloodTransfusionRecord ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="blood-transfusion-consent" className="mt-6">
          <BloodTransfusionConsentForm ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="patient-file" className="mt-6">
          <PatientFileForm ipdId={ipdId as string} />
        </TabsContent>
        
        <TabsContent value="admission" className="mt-6">
          <AdmissionAssessmentForm ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="charge" className="mt-6">
          <PatientChargesSheet ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="glucose" className="mt-6">
          <GlucoseMonitoringSheet ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="investigation" className="mt-6">
          <InvestigationSheetPage ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          <IndoorPatientProgressNotes ipdId={ipdId as string} />
        </TabsContent>
        
        <TabsContent value="nurse" className="mt-6">
          <NursesNotesSheet ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="vital" className="mt-6">
          <VitalsSheet ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="doctor" className="mt-6">
          <DoctorVisitPage ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="drug-chart" className="mt-6">
          <DrugChartSheet ipdId={ipdId as string} />
        </TabsContent>
        
        <TabsContent value="iv-infusion" className="mt-6">
          <IVInfusionSheet ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="clinical-notes" className="mt-6">
          <ClinicalNotesSheet ipdId={ipdId as string} />
        </TabsContent>

        <TabsContent value="emergency-care" className="mt-6">
          <EmergencyCareRecordSheet ipdId={ipdId as string} />
        </TabsContent>

        {/* Placeholder Tabs for other content */}
        {tabs.filter(t => !["admission", "charge", "glucose", "investigation", "progress", "nurse", "vital", "doctor", "drug-chart", "iv-infusion", "clinical-notes", "emergency-care", "patient-file", "blood-transfusion-consent", "blood-transfusion-record", "surgical-consent", "discharge-against-medical-advice"].includes(t.value)).map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            <Card className="bg-white shadow-md p-6">
              <CardTitle className="text-lg font-semibold text-gray-800">
                {tab.label}
              </CardTitle>
              <CardContent className="mt-4 text-gray-600">
                <p>Content for the "{tab.label}" section will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default IPDRecordPage;