"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw, PlusCircle, Trash2 } from "lucide-react";
import PatientDetailsHeader from "./PatientDetailsHeader";
import PdfGenerator from "./PdfGenerator"; // Import PdfGenerator

// --- Type Definitions ---
interface MonitoringEntry {
  id: number; // For React key prop
  date: string;
  time: string;
  temp: string;
  pulse: string;
  respRate: string;
  bp: string;
  sao2: string;
  symptoms: string;
  sign: string;
}

interface BloodTransfusionData {
  patientNameHeader: string;
  ageSexHeader: string;
  roomWardNo: string;
  uhidNo: string;
  ipdNo: string;
  contactNo: string;
  underCareOfDoctor: string;
  admissionDate: string;
  date: string;
  time: string;
  ipNo: string;
  transfusionNo: string;
  patientName: string;
  age: string;
  sex: string;
  ward: string;
  doa: string;
  consultant: string;
  diagnosis: string;
  indicatorForTransfusion: string;
  componentTransfused: string;
  advisedBy: string;
  componentBroughtFrom: string;
  bagNo: string;
  batchNo: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  patientBloodGroup: string;
  donorBloodGroup: string;
  hivTestedOn: string;
  hiv: string;
  vdrl: string;
  hbsag: string;
  mp: string;
  hcv: string;
  atypicalAntibodies: string;
  reportCheckedBy: string;
  crossMatchCompatibility: string;
  verifiedBy: string;
  verifiedDate: string;
  verifiedTime: string;
  consentTakenBy: string;
  consentDate: string;
  consentTime: string;
  transfusionStartedBy: string;
  transfusionStartDate: string;
  transfusionStartTime: string;
  site: string;
  bloodBagSticker: string;
  monitoring: MonitoringEntry[];
  terminatedBy: string;
  terminatedDate: string;
  terminatedTime: string;
  transfusionReaction: string;
  reactionTemp: string;
  reactionP: string;
  reactionRR: string;
  reactionBP: string;
  reactionSaO2: string;
  nameOfDoctor: string;
  signatureOfDoctor: string;
  signDate: string;
  signTime: string;
}

// --- Helper Function to Create Initial State with 3 rows by default ---
const createInitialMonitoringRows = (count: number = 3): MonitoringEntry[] => {
  return Array.from({ length: count }, () => ({
    id: Date.now() + Math.random(), // Unique ID for key prop
    date: '',
    time: '',
    temp: '',
    pulse: '',
    respRate: '',
    bp: '',
    sao2: '',
    symptoms: '',
    sign: ''
  }));
};

// --- Initial State for the Form ---
const initialBloodTransfusionData: BloodTransfusionData = {
  patientNameHeader: "",
  ageSexHeader: "",
  roomWardNo: "",
  uhidNo: "",
  ipdNo: "",
  contactNo: "",
  underCareOfDoctor: "",
  admissionDate: "",
  date: "", time: "", ipNo: "", transfusionNo: "", patientName: "", age: "", sex: "", ward: "", doa: "", consultant: "", diagnosis: "", indicatorForTransfusion: "", componentTransfused: "", advisedBy: "", componentBroughtFrom: "", bagNo: "", batchNo: "", dateOfIssue: "", dateOfExpiry: "", patientBloodGroup: "", donorBloodGroup: "", hivTestedOn: "", hiv: "", vdrl: "", hbsag: "", mp: "", hcv: "", atypicalAntibodies: "", reportCheckedBy: "", crossMatchCompatibility: "", verifiedBy: "", verifiedDate: "", verifiedTime: "", consentTakenBy: "", consentDate: "", consentTime: "", transfusionStartedBy: "", transfusionStartDate: "", transfusionStartTime: "", site: "", bloodBagSticker: "",
  monitoring: createInitialMonitoringRows(), // Initialize with 3 rows
  terminatedBy: "", terminatedDate: "", terminatedTime: "", transfusionReaction: "", reactionTemp: "", reactionP: "", reactionRR: "", reactionBP: "", reactionSaO2: "", nameOfDoctor: "", signatureOfDoctor: "", signDate: "", signTime: "",
};

// --- Main Component ---
const BloodTransfusionRecord = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<BloodTransfusionData>(initialBloodTransfusionData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingSignature, setIsVerifyingSignature] = useState(false);
  const formRef = useRef<HTMLDivElement>(null); // Create the ref

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ipd_record")
        .select("blood_transfusion_data")
        .eq("ipd_id", ipdId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.blood_transfusion_data) {
        const fetchedData = data.blood_transfusion_data as BloodTransfusionData;
        // Check if monitoring data exists and is not empty, otherwise use initial rows
        if (fetchedData.monitoring && fetchedData.monitoring.length > 0) {
          setFormData(fetchedData);
        } else {
          setFormData({ ...fetchedData, monitoring: createInitialMonitoringRows() });
        }
        toast.success("Blood transfusion record loaded.");
      } else {
        // If no data exists, set initial data with default rows
        setFormData(initialBloodTransfusionData);
      }
    } catch (error) {
      console.error("Failed to fetch blood transfusion data:", error);
      toast.error("Failed to load blood transfusion record.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchData();
  }, [ipdId, fetchData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated.");
        setIsSaving(false);
        return;
      }

      const dataToSave = { ...formData };
      if (typeof dataToSave.signatureOfDoctor === 'string' && dataToSave.signatureOfDoctor.length === 10 && !dataToSave.signatureOfDoctor.startsWith('http')) {
        dataToSave.signatureOfDoctor = '';
      }

      const { error } = await supabase.from("ipd_record").upsert(
        {
          ipd_id: ipdId,
          user_id: session.user.id,
          blood_transfusion_data: dataToSave,
        },
        { onConflict: "ipd_id,user_id" }
      );

      if (error) throw error;
      toast.success("Blood transfusion record saved successfully!");
    } catch (error) {
      console.error("Failed to save data:", error);
      toast.error("Failed to save record.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof BloodTransfusionData) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleMonitoringChange = (index: number, field: keyof MonitoringEntry, value: string) => {
    const updatedMonitoring = [...formData.monitoring];
    updatedMonitoring[index] = { ...updatedMonitoring[index], [field]: value };
    setFormData(prev => ({ ...prev, monitoring: updatedMonitoring }));
  };

  const addMonitoringRow = () => {
    setFormData(prev => ({
      ...prev,
      monitoring: [
        ...prev.monitoring,
        { id: Date.now(), date: '', time: '', temp: '', pulse: '', respRate: '', bp: '', sao2: '', symptoms: '', sign: '' }
      ]
    }));
  };

  const removeMonitoringRow = (index: number) => {
    if (window.confirm("Are you sure you want to remove this monitoring entry?")) {
      const updatedMonitoring = formData.monitoring.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, monitoring: updatedMonitoring }));
    }
  };

  const checkAndSetSignature = useCallback(async (password: string) => {
    if (password.length !== 10) return;
    setIsVerifyingSignature(true);
    try {
      const { data, error } = await supabase
        .from('signature')
        .select('signature_url')
        .eq('password', password)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.signature_url) {
        setFormData(prev => ({ ...prev, signatureOfDoctor: data.signature_url }));
        toast.success(`Doctor's signature verified.`);
      } else {
        toast.error(`Invalid signature PIN.`);
      }
    } catch (error) {
      console.error("Error verifying signature:", error);
      toast.error("Could not verify signature.");
    } finally {
      setIsVerifyingSignature(false);
    }
  }, []);

  const handleSignatureReset = () => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
      setFormData(prev => ({ ...prev, signatureOfDoctor: '' }));
      toast.info("Signature has been cleared.");
    }
  };

  const renderSignatureInput = () => (
    <div className="flex-grow p-1 border-b border-gray-300 focus:outline-none h-12 flex items-center justify-center">
      {isVerifyingSignature ? (
        <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
      ) : typeof formData.signatureOfDoctor === 'string' && formData.signatureOfDoctor?.startsWith('http') ? (
        <img
          src={formData.signatureOfDoctor}
          alt="Signature"
          title="Click to remove signature"
          className="h-10 object-contain cursor-pointer hover:opacity-75"
          onClick={handleSignatureReset}
        />
      ) : (
        <input
          type="password"
          value={formData.signatureOfDoctor as string}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, signatureOfDoctor: e.target.value }));
            if (e.target.value.length === 10) {
              checkAndSetSignature(e.target.value);
            }
          }}
          className="w-full text-center focus:outline-none bg-transparent"
          maxLength={10}
          placeholder="Enter PIN"
          autoComplete="new-password"
        />
      )}
    </div>
  );

  const inputClass = "flex-grow p-1 border-b border-gray-300 focus:outline-none bg-transparent";
  const labelClass = "font-semibold mr-2 whitespace-nowrap text-gray-700";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Record...</p>
      </div>
    );
  }

  return (
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-xl max-w-6xl mx-auto font-sans text-xs">
      <div className="text-center mb-6 border-b pb-4">
        <h2 className="font-bold text-lg uppercase text-gray-800">Blood Transfusion Record</h2>
      </div>

      {/* --- Main Details Section --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-3 mb-6">
        <div className="flex items-center"><label className={labelClass}>Date:</label><input type="date" value={formData.date} onChange={(e) => handleInputChange(e, "date")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Time:</label><input type="time" value={formData.time} onChange={(e) => handleInputChange(e, "time")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>IP No.:</label><input type="text" value={formData.ipNo} onChange={(e) => handleInputChange(e, "ipNo")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Transfusion No.:</label><input type="text" value={formData.transfusionNo} onChange={(e) => handleInputChange(e, "transfusionNo")} className={inputClass} /></div>
        <div className="flex items-center col-span-2"><label className={labelClass}>Patient's Name:</label><input type="text" value={formData.patientName} onChange={(e) => handleInputChange(e, "patientName")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Age:</label><input type="text" value={formData.age} onChange={(e) => handleInputChange(e, "age")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Sex:</label><input type="text" value={formData.sex} onChange={(e) => handleInputChange(e, "sex")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Ward:</label><input type="text" value={formData.ward} onChange={(e) => handleInputChange(e, "ward")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>D.O.A:</label><input type="date" value={formData.doa} onChange={(e) => handleInputChange(e, "doa")} className={inputClass} /></div>
        <div className="flex items-center col-span-2"><label className={labelClass}>Consultant:</label><input type="text" value={formData.consultant} onChange={(e) => handleInputChange(e, "consultant")} className={inputClass} /></div>
        <div className="flex items-center col-span-2"><label className={labelClass}>Diagnosis:</label><input type="text" value={formData.diagnosis} onChange={(e) => handleInputChange(e, "diagnosis")} className={inputClass} /></div>
        <div className="flex items-center col-span-2"><label className={labelClass}>Indicator For Transfusion:</label><input type="text" value={formData.indicatorForTransfusion} onChange={(e) => handleInputChange(e, "indicatorForTransfusion")} className={inputClass} /></div>
        <div className="flex items-center col-span-2"><label className={labelClass}>Component Transfused:</label><input type="text" value={formData.componentTransfused} onChange={(e) => handleInputChange(e, "componentTransfused")} className={inputClass} /></div>
        <div className="flex items-center col-span-2"><label className={labelClass}>Advised By:</label><input type="text" value={formData.advisedBy} onChange={(e) => handleInputChange(e, "advisedBy")} className={inputClass} /></div>
      </div>

      {/* --- Blood Bag & Screening Section --- */}
      <div className="border-t border-b py-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-3">
        <div className="flex items-center col-span-2"><label className={labelClass}>Component Brought From:</label><input type="text" value={formData.componentBroughtFrom} onChange={(e) => handleInputChange(e, "componentBroughtFrom")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Bag No.:</label><input type="text" value={formData.bagNo} onChange={(e) => handleInputChange(e, "bagNo")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Batch No.:</label><input type="text" value={formData.batchNo} onChange={(e) => handleInputChange(e, "batchNo")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Date of Issue:</label><input type="date" value={formData.dateOfIssue} onChange={(e) => handleInputChange(e, "dateOfIssue")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Date of Expiry:</label><input type="date" value={formData.dateOfExpiry} onChange={(e) => handleInputChange(e, "dateOfExpiry")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Patient's Blood Group:</label><input type="text" value={formData.patientBloodGroup} onChange={(e) => handleInputChange(e, "patientBloodGroup")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Blood Group of The Donor:</label><input type="text" value={formData.donorBloodGroup} onChange={(e) => handleInputChange(e, "donorBloodGroup")} className={inputClass} /></div>
        <div className="flex items-center col-span-2"><label className={labelClass}>HIV Tested On:</label><input type="text" value={formData.hivTestedOn} onChange={(e) => handleInputChange(e, "hivTestedOn")} className={inputClass} /></div>

        {/* Screening Tests */}
        <div className="flex items-center"><label className={labelClass}>HIV:</label><input type="text" value={formData.hiv} onChange={(e) => handleInputChange(e, "hiv")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>VDRL:</label><input type="text" value={formData.vdrl} onChange={(e) => handleInputChange(e, "vdrl")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>HBsAg:</label><input type="text" value={formData.hbsag} onChange={(e) => handleInputChange(e, "hbsag")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>MP:</label><input type="text" value={formData.mp} onChange={(e) => handleInputChange(e, "mp")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>HCV:</label><input type="text" value={formData.hcv} onChange={(e) => handleInputChange(e, "hcv")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Atypical Antibodies:</label><input type="text" value={formData.atypicalAntibodies} onChange={(e) => handleInputChange(e, "atypicalAntibodies")} className={inputClass} /></div>
      </div>

      {/* --- Verification Section --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 mb-6">
        <div className="flex items-center col-span-2"><label className={labelClass}>Bag and compatibility report checked by (Doctor):</label><input type="text" value={formData.reportCheckedBy} onChange={(e) => handleInputChange(e, "reportCheckedBy")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Cross Match Compatibility:</label><input type="text" value={formData.crossMatchCompatibility} onChange={(e) => handleInputChange(e, "crossMatchCompatibility")} className={inputClass} /></div>

        <div className="flex items-center"><label className={labelClass}>Verified By:</label><input type="text" value={formData.verifiedBy} onChange={(e) => handleInputChange(e, "verifiedBy")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Date:</label><input type="date" value={formData.verifiedDate} onChange={(e) => handleInputChange(e, "verifiedDate")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Time:</label><input type="time" value={formData.verifiedTime} onChange={(e) => handleInputChange(e, "verifiedTime")} className={inputClass} /></div>

        <div className="flex items-center"><label className={labelClass}>Consent Taken By:</label><input type="text" value={formData.consentTakenBy} onChange={(e) => handleInputChange(e, "consentTakenBy")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Date:</label><input type="date" value={formData.consentDate} onChange={(e) => handleInputChange(e, "consentDate")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Time:</label><input type="time" value={formData.consentTime} onChange={(e) => handleInputChange(e, "consentTime")} className={inputClass} /></div>

        <div className="flex items-center"><label className={labelClass}>Transfusion Started By:</label><input type="text" value={formData.transfusionStartedBy} onChange={(e) => handleInputChange(e, "transfusionStartedBy")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Date:</label><input type="date" value={formData.transfusionStartDate} onChange={(e) => handleInputChange(e, "transfusionStartDate")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Time:</label><input type="time" value={formData.transfusionStartTime} onChange={(e) => handleInputChange(e, "transfusionStartTime")} className={inputClass} /></div>

        <div className="flex items-center col-span-3"><label className={labelClass}>Site:</label><input type="text" value={formData.site} onChange={(e) => handleInputChange(e, "site")} className={inputClass} /></div>
      </div>

      {/* --- Blood Bag Sticker Section --- */}
      <div className="mb-6">
        <label className={`${labelClass} mb-2 block`}>Blood Bag Sticker To Be Pasted Here:</label>
        <textarea value={formData.bloodBagSticker} onChange={(e) => handleInputChange(e, "bloodBagSticker")} className="w-full p-2 border border-gray-300 rounded-md resize-none h-24 bg-gray-50" />
      </div>

      {/* --- Monitoring Table Section --- */}
      <div className="mb-6">
        <h3 className="font-bold text-md mb-2 text-gray-800">Monitoring</h3>
        <div className="border border-gray-400 rounded-md overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[100px_100px_1fr_1fr_1fr_1fr_1fr_2fr_1fr_50px] bg-gray-200 font-bold text-xs text-center">
            <div className="p-2 border-r border-b border-gray-400">Date</div>
            <div className="p-2 border-r border-b border-gray-400">Time</div>
            <div className="p-2 border-r border-b border-gray-400">Temp.</div>
            <div className="p-2 border-r border-b border-gray-400">Pulse/min</div>
            <div className="p-2 border-r border-b border-gray-400">Resp. Rate</div>
            <div className="p-2 border-r border-b border-gray-400">B.P.</div>
            <div className="p-2 border-r border-b border-gray-400">SaO2</div>
            <div className="p-2 border-r border-b border-gray-400">Symptoms</div>
            <div className="p-2 border-r border-b border-gray-400">Sign.</div>
            <div className="p-2 border-b border-gray-400">Actions</div>
          </div>
          {/* Table Body */}
          <div>
            {formData.monitoring.map((row, index) => (
              <div key={row.id} className="grid grid-cols-[100px_100px_1fr_1fr_1fr_1fr_1fr_2fr_1fr_50px] text-xs border-t border-gray-400 min-h-[52px]">
                <input type="date" value={row.date} onChange={(e) => handleMonitoringChange(index, 'date', e.target.value)} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
                <input type="time" value={row.time} onChange={(e) => handleMonitoringChange(index, 'time', e.target.value)} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
                <input type="text" value={row.temp} onChange={(e) => handleMonitoringChange(index, 'temp', e.target.value)} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
                <input type="text" value={row.pulse} onChange={(e) => handleMonitoringChange(index, 'pulse', e.target.value)} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
                <input type="text" value={row.respRate} onChange={(e) => handleMonitoringChange(index, 'respRate', e.target.value)} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
                <input type="text" value={row.bp} onChange={(e) => handleMonitoringChange(index, 'bp', e.target.value)} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
                <input type="text" value={row.sao2} onChange={(e) => handleMonitoringChange(index, 'sao2', e.target.value)} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
                <textarea value={row.symptoms} onChange={(e) => handleMonitoringChange(index, 'symptoms', e.target.value)} className="p-2 border-r border-gray-400 focus:outline-none w-full resize-none" rows={2} />
                <input type="text" value={row.sign} onChange={(e) => handleMonitoringChange(index, 'sign', e.target.value)} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
                <div className="flex items-center justify-center border-l border-gray-400">
                  <button onClick={() => removeMonitoringRow(index)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={addMonitoringRow} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold text-xs bg-blue-500 hover:bg-blue-600">
          <PlusCircle size={14} /> Add Monitoring Entry
        </button>
      </div>

      {/* --- Termination & Reaction Section --- */}
      <div className="border-t pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 mb-4">
          <div className="flex items-center"><label className={labelClass}>Terminated By:</label><input type="text" value={formData.terminatedBy} onChange={(e) => handleInputChange(e, "terminatedBy")} className={inputClass} /></div>
          <div className="flex items-center"><label className={labelClass}>Date:</label><input type="date" value={formData.terminatedDate} onChange={(e) => handleInputChange(e, "terminatedDate")} className={inputClass} /></div>
          <div className="flex items-center"><label className={labelClass}>Time:</label><input type="time" value={formData.terminatedTime} onChange={(e) => handleInputChange(e, "terminatedTime")} className={inputClass} /></div>
        </div>
        <div className="mb-4">
          <label className={`${labelClass} mb-2 block`}>Transfusion Reaction if Any:</label>
          <textarea value={formData.transfusionReaction} onChange={(e) => handleInputChange(e, "transfusionReaction")} className="w-full p-2 border border-gray-300 rounded-md resize-none h-16 bg-gray-50" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 mb-6">
          <div className="flex items-center"><label className={labelClass}>Temp.:</label><input type="text" value={formData.reactionTemp} onChange={(e) => handleInputChange(e, "reactionTemp")} className={inputClass} /></div>
          <div className="flex items-center"><label className={labelClass}>P:</label><input type="text" value={formData.reactionP} onChange={(e) => handleInputChange(e, "reactionP")} className={inputClass} /></div>
          <div className="flex items-center"><label className={labelClass}>RR:</label><input type="text" value={formData.reactionRR} onChange={(e) => handleInputChange(e, "reactionRR")} className={inputClass} /></div>
          <div className="flex items-center"><label className={labelClass}>BP:</label><input type="text" value={formData.reactionBP} onChange={(e) => handleInputChange(e, "reactionBP")} className={inputClass} /></div>
          <div className="flex items-center"><label className={labelClass}>SaO2:</label><input type="text" value={formData.reactionSaO2} onChange={(e) => handleInputChange(e, "reactionSaO2")} className={inputClass} /></div>
        </div>
      </div>

      {/* --- Final Signature Section --- */}
      <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-3 items-end">
        <div className="flex items-center col-span-2"><label className={labelClass}>Name of Doctor:</label><input type="text" value={formData.nameOfDoctor} onChange={(e) => handleInputChange(e, "nameOfDoctor")} className={inputClass} /></div>
        <div className="flex items-center col-span-2"><label className={labelClass}>Sign:</label>{renderSignatureInput()}</div>
        <div className="flex items-center"><label className={labelClass}>Date:</label><input type="date" value={formData.signDate} onChange={(e) => handleInputChange(e, "signDate")} className={inputClass} /></div>
        <div className="flex items-center"><label className={labelClass}>Time:</label><input type="time" value={formData.signTime} onChange={(e) => handleInputChange(e, "signTime")} className={inputClass} /></div>
      </div>

      <div className="flex justify-end mt-8 no-pdf">
        <PdfGenerator contentRef={formRef as React.RefObject<HTMLDivElement>} fileName="BloodTransfusionRecord" />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"}`}
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" /> Saving Record...
            </>
          ) : (
            "Save Record"
          )}
        </button>
      </div>
    </div>
  );
};

export default BloodTransfusionRecord;