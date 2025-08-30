"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

// Assuming supabase is configured and available globally or imported
// from a different file as in the original code.
// For this single file component, we will assume it's imported or globally available
// as the user's prompt suggests.
const supabase = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } } }),
  },
  from: (tableName) => {
    // Mocking a signature table for verification
    if (tableName === "signature") {
      return {
        select: (field) => ({
          eq: (key, value) => ({
            single: async () => {
              // Mock a successful PIN verification
              if (value === "1234567890") {
                return {
                  data: { signature_url: "https://via.placeholder.com/150/0000FF/FFFFFF?text=Signed" },
                  error: null,
                };
              }
              return { data: null, error: { code: "PGRST116" } };
            },
          }),
        }),
      };
    }
    // Mocking the original ipd_record table logic
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              blood_transfusion_data: null, // Initial data will be null, so form will be empty.
            },
            error: null,
          }),
        }),
      }),
      upsert: () => ({
        onConflict: () => ({
          error: null,
        }),
      }),
    };
  },
};

// --- Type Definitions ---
interface MonitoringRow {
  date: string;
  time: string;
  temp: string;
  pulse: string;
  respRate: string;
  bp: string;
  saO2: string;
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
  hbsAg: string;
  mp: string;
  hcv: string;
  atypicalAntibodies: string;
  bagCompatibilityCheckedBy: string;
  crossMatchDate: string;
  crossMatchTime: string;
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
  terminatedBy: string;
  terminatedDate: string;
  terminatedTime: string;
  transfusionReaction: string;
  finalTemp: string;
  finalP: string;
  finalRR: string;
  finalBP: string;
  finalSaO2: string;
  nameOfDoctor: string;
  doctorSign: string;
  doctorDate: string;
  doctorTime: string;
  monitoringTable: MonitoringRow[];
}

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
  date: "",
  time: "",
  ipNo: "",
  transfusionNo: "",
  patientName: "",
  age: "",
  sex: "",
  ward: "",
  doa: "",
  consultant: "",
  diagnosis: "",
  indicatorForTransfusion: "",
  componentTransfused: "",
  advisedBy: "",
  componentBroughtFrom: "",
  bagNo: "",
  batchNo: "",
  dateOfIssue: "",
  dateOfExpiry: "",
  patientBloodGroup: "",
  donorBloodGroup: "",
  hivTestedOn: "",
  hiv: "",
  vdrl: "",
  hbsAg: "",
  mp: "",
  hcv: "",
  atypicalAntibodies: "",
  bagCompatibilityCheckedBy: "",
  crossMatchDate: "",
  crossMatchTime: "",
  verifiedBy: "",
  verifiedDate: "",
  verifiedTime: "",
  consentTakenBy: "",
  consentDate: "",
  consentTime: "",
  transfusionStartedBy: "",
  transfusionStartDate: "",
  transfusionStartTime: "",
  site: "",
  terminatedBy: "",
  terminatedDate: "",
  terminatedTime: "",
  transfusionReaction: "",
  finalTemp: "",
  finalP: "",
  finalRR: "",
  finalBP: "",
  finalSaO2: "",
  nameOfDoctor: "",
  doctorSign: "",
  doctorDate: "",
  doctorTime: "",
  monitoringTable: [
    {
      date: "",
      time: "",
      temp: "",
      pulse: "",
      respRate: "",
      bp: "",
      saO2: "",
      symptoms: "",
      sign: "",
    },
  ],
};

const BloodTransfusionRecord = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<BloodTransfusionData>(initialBloodTransfusionData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingSignature, setIsVerifyingSignature] = useState(false);

  const fetchTransfusionData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ipd_record")
        .select("blood_transfusion_data")
        .eq("ipd_id", ipdId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.blood_transfusion_data) {
        setFormData(data.blood_transfusion_data as BloodTransfusionData);
        toast.success("Blood transfusion record loaded.");
      }
    } catch (error) {
      console.error("Failed to fetch blood transfusion data:", error);
      toast.error("Failed to load blood transfusion record.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchTransfusionData();
  }, [ipdId, fetchTransfusionData]);

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
      if (typeof dataToSave.doctorSign === "string" && dataToSave.doctorSign.length === 10 && !dataToSave.doctorSign.startsWith("http")) {
        dataToSave.doctorSign = "";
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
      console.error("Failed to save blood transfusion data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof BloodTransfusionData) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleMonitoringChange = (e: React.ChangeEvent<HTMLInputElement>, rowIndex: number, field: keyof MonitoringRow) => {
    const { value } = e.target;
    setFormData((prev) => {
      const newTable = [...prev.monitoringTable];
      newTable[rowIndex] = { ...newTable[rowIndex], [field]: value };
      return { ...prev, monitoringTable: newTable };
    });
  };

  const addRow = () => {
    setFormData((prev) => ({
      ...prev,
      monitoringTable: [
        ...prev.monitoringTable,
        {
          date: "",
          time: "",
          temp: "",
          pulse: "",
          respRate: "",
          bp: "",
          saO2: "",
          symptoms: "",
          sign: "",
        },
      ],
    }));
  };

  const removeRow = () => {
    if (formData.monitoringTable.length > 1) {
      setFormData((prev) => ({
        ...prev,
        monitoringTable: prev.monitoringTable.slice(0, -1),
      }));
    }
  };

  const checkAndSetSignature = useCallback(
    async (password: string) => {
      if (password.length !== 10) return;
      setIsVerifyingSignature(true);
      try {
        const { data, error } = await supabase.from("signature").select("signature_url").eq("password", password).single();

        if (error && error.code !== "PGRST116") throw error;

        if (data?.signature_url) {
          setFormData((prev) => ({ ...prev, doctorSign: data.signature_url }));
          toast.success("Signature verified for Doctor.");
        } else {
          toast.error("Invalid signature PIN for Doctor.");
        }
      } catch (error) {
        console.error("Error verifying signature:", error);
        toast.error("Could not verify signature.");
      } finally {
        setIsVerifyingSignature(false);
      }
    },
    []
  );

  const handleSignatureReset = () => {
    // Note: window.confirm() won't work in the platform's sandbox.
    // For a real app, replace with a custom modal.
    if (window.confirm("Are you sure you want to remove this signature?")) {
      setFormData((prev) => ({ ...prev, doctorSign: "" }));
      toast.info("Signature has been cleared.");
    }
  };

  const renderSignatureInput = () => {
    if (isVerifyingSignature) {
      return (
        <div className="flex-grow p-1 border-b border-gray-300 focus:outline-none h-12 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      );
    } else if (typeof formData.doctorSign === "string" && formData.doctorSign.startsWith("http")) {
      return (
        <div className="flex-grow p-1 border-b border-gray-300 focus:outline-none h-12 flex items-center">
          <img
            src={formData.doctorSign}
            alt="Doctor's Signature"
            title="Click to remove signature"
            className="h-10 object-contain cursor-pointer hover:opacity-75"
            onClick={handleSignatureReset}
          />
        </div>
      );
    } else {
      return (
        <div className="flex-grow p-1 border-b border-gray-300 focus:outline-none h-12 flex items-center">
          <input
            type="password"
            value={formData.doctorSign}
            onChange={(e) => {
              const value = e.target.value;
              setFormData((prev) => ({ ...prev, doctorSign: value }));
              if (value.length === 10) {
                checkAndSetSignature(value);
              }
            }}
            className="w-full text-center focus:outline-none bg-transparent"
            maxLength={10}
            placeholder="Enter a Password"
            autoComplete="new-password"
          />
        </div>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Blood Transfusion Record...</p>
      </div>
    );
  }

  const inputClass = "flex-grow p-1 border-b border-gray-300 focus:outline-none bg-transparent";
  const labelClass = "font-semibold mr-2 whitespace-nowrap";
  const sectionClass = "border-b border-gray-300 py-2 flex items-center";
  const tableHeaderClass = "bg-gray-200 text-center font-bold text-xs p-2 border-r border-gray-300";
  const tableCellClass = "p-2 border-r border-gray-300 focus:outline-none text-xs";
  const tableCellLastClass = "p-2 focus:outline-none text-xs";

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-6xl mx-auto font-sans text-xs">
      <div className="text-center mb-6">
        <h2 className="font-bold text-lg">BLOOD TRANSFUSION RECORD</h2>
      </div>

      {/* Patient Details Header Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mb-6">
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Name of Patient:</label>
          <input type="text" value={formData.patientNameHeader} onChange={(e) => handleInputChange(e, "patientNameHeader")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Age/Sex:</label>
          <input type="text" value={formData.ageSexHeader} onChange={(e) => handleInputChange(e, "ageSexHeader")} className={inputClass} />
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
        <div className={sectionClass}>
          <label className={labelClass}>Date:</label>
          <input type="text" value={formData.date} onChange={(e) => handleInputChange(e, "date")} className={inputClass} />
        </div>
        <div className={sectionClass}>
          <label className={labelClass}>Time:</label>
          <input type="text" value={formData.time} onChange={(e) => handleInputChange(e, "time")} className={inputClass} />
        </div>
        <div className={sectionClass}>
          <label className={labelClass}>IP No:</label>
          <input type="text" value={formData.ipNo} onChange={(e) => handleInputChange(e, "ipNo")} className={inputClass} />
        </div>
        <div className={sectionClass}>
          <label className={labelClass}>Transfusion No:</label>
          <input type="text" value={formData.transfusionNo} onChange={(e) => handleInputChange(e, "transfusionNo")} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mt-4">
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Patients Name:</label>
          <input type="text" value={formData.patientName} onChange={(e) => handleInputChange(e, "patientName")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-1">
          <label className={labelClass}>Age:</label>
          <input type="text" value={formData.age} onChange={(e) => handleInputChange(e, "age")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-1">
          <label className={labelClass}>Sex:</label>
          <input type="text" value={formData.sex} onChange={(e) => handleInputChange(e, "sex")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>Ward:</label>
          <input type="text" value={formData.ward} onChange={(e) => handleInputChange(e, "ward")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-2">
          <label className={labelClass}>D.O.A.:</label>
          <input type="text" value={formData.doa} onChange={(e) => handleInputChange(e, "doa")} className={inputClass} />
        </div>
        <div className="flex items-center col-span-4">
          <label className={labelClass}>Consultant:</label>
          <input type="text" value={formData.consultant} onChange={(e) => handleInputChange(e, "consultant")} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-4">
        <div className="flex items-center">
          <label className={labelClass}>Diagnosis:</label>
          <input type="text" value={formData.diagnosis} onChange={(e) => handleInputChange(e, "diagnosis")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Indicator For Transfusion:</label>
          <input type="text" value={formData.indicatorForTransfusion} onChange={(e) => handleInputChange(e, "indicatorForTransfusion")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Component Transfused:</label>
          <input type="text" value={formData.componentTransfused} onChange={(e) => handleInputChange(e, "componentTransfused")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Advised By:</label>
          <input type="text" value={formData.advisedBy} onChange={(e) => handleInputChange(e, "advisedBy")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Component Brought From:</label>
          <input type="text" value={formData.componentBroughtFrom} onChange={(e) => handleInputChange(e, "componentBroughtFrom")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Bag No:</label>
          <input type="text" value={formData.bagNo} onChange={(e) => handleInputChange(e, "bagNo")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Batch No:</label>
          <input type="text" value={formData.batchNo} onChange={(e) => handleInputChange(e, "batchNo")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Date of Issue:</label>
          <input type="text" value={formData.dateOfIssue} onChange={(e) => handleInputChange(e, "dateOfIssue")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Date of Expiry:</label>
          <input type="text" value={formData.dateOfExpiry} onChange={(e) => handleInputChange(e, "dateOfExpiry")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Patient's Blood Group:</label>
          <input type="text" value={formData.patientBloodGroup} onChange={(e) => handleInputChange(e, "patientBloodGroup")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Blood Group of The Donor:</label>
          <input type="text" value={formData.donorBloodGroup} onChange={(e) => handleInputChange(e, "donorBloodGroup")} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>HIV Tested on:</label>
          <input type="text" value={formData.hivTestedOn} onChange={(e) => handleInputChange(e, "hivTestedOn")} className={inputClass} />
        </div>
      </div>

      {/* Lab Report Table */}
      <div className="border border-gray-300 mt-4 rounded-md overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <div className="p-2 border-r border-b border-gray-300 font-semibold">HIV</div>
          <div className="p-2 border-r border-b border-gray-300"><input type="text" value={formData.hiv} onChange={(e) => handleInputChange(e, 'hiv')} className="w-full bg-transparent focus:outline-none" /></div>
          <div className="p-2 border-r border-b border-gray-300 font-semibold">VDRL</div>
          <div className="p-2 border-b border-gray-300"><input type="text" value={formData.vdrl} onChange={(e) => handleInputChange(e, 'vdrl')} className="w-full bg-transparent focus:outline-none" /></div>
          <div className="p-2 border-r border-b border-gray-300 font-semibold">HBsAg.</div>
          <div className="p-2 border-r border-b border-gray-300"><input type="text" value={formData.hbsAg} onChange={(e) => handleInputChange(e, 'hbsAg')} className="w-full bg-transparent focus:outline-none" /></div>
          <div className="p-2 border-r border-b border-gray-300 font-semibold">MP.</div>
          <div className="p-2 border-b border-gray-300"><input type="text" value={formData.mp} onChange={(e) => handleInputChange(e, 'mp')} className="w-full bg-transparent focus:outline-none" /></div>
          <div className="p-2 border-r border-b border-gray-300 font-semibold">HCV</div>
          <div className="p-2 border-r border-b border-gray-300"><input type="text" value={formData.hcv} onChange={(e) => handleInputChange(e, 'hcv')} className="w-full bg-transparent focus:outline-none" /></div>
          <div className="p-2 border-r border-b border-gray-300 font-semibold">Atypical Antibodies.</div>
          <div className="p-2 border-b border-gray-300"><input type="text" value={formData.atypicalAntibodies} onChange={(e) => handleInputChange(e, 'atypicalAntibodies')} className="w-full bg-transparent focus:outline-none" /></div>
        </div>
      </div>

      {/* Compatibility Report Section (outside table) */}
      <div className="flex items-center justify-between gap-4 mt-4">
        <div className="flex items-center flex-grow">
          <label className={labelClass}>
            Bag and compatibility report checked by :
          </label>
          <input
            type="text"
            value={formData.bagCompatibilityCheckedBy}
            onChange={(e) => handleInputChange(e, 'bagCompatibilityCheckedBy')}
            className={inputClass}
          />
        </div>
        <div className="flex items-center flex-grow">
          <label className={labelClass}>
            Cross Match Compatibility :
          </label>
          <input
            type="text"
            value={formData.crossMatchTime}
            onChange={(e) => handleInputChange(e, 'crossMatchTime')}
            className={inputClass}
          />
        </div>
      </div>


      {/* Verification & Consent Table - Updated to 3 columns and added "Doctor" row */}
      <div className="border border-gray-300 mt-4 rounded-md overflow-hidden">
        <div className="grid grid-cols-3 border-b border-gray-300">
          <div className={tableCellClass + " p-2 flex items-center"}>
            <label className="font-semibold mr-1">Doctor:</label>
            <input type="text" value={formData.crossMatchDate} onChange={(e) => handleInputChange(e, 'crossMatchDate')} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellClass + " p-2 flex items-center"}>
            <label className="mr-1 font-semibold">Date:</label>
            <input type="text" value={formData.crossMatchDate} onChange={(e) => handleInputChange(e, 'crossMatchDate')} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellLastClass + " p-2 flex items-center"}>
            <label className="mr-1 font-semibold">Time:</label>
            <input type="text" value={formData.crossMatchTime} onChange={(e) => handleInputChange(e, 'crossMatchTime')} className="w-full bg-transparent focus:outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-3 border-b border-gray-300">
          <div className={tableCellClass + " p-2 flex items-center"}>
            <label className="font-semibold mr-1 whitespace-nowrap">Verified By:</label>
            <input type="text" value={formData.verifiedBy} onChange={(e) => handleInputChange(e, 'verifiedBy')} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellClass + " p-2 flex items-center"}>
            <label className="mr-1 font-semibold">Date:</label>
            <input type="text" value={formData.verifiedDate} onChange={(e) => handleInputChange(e, 'verifiedDate')} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellLastClass + " p-2 flex items-center"}>
            <label className="mr-1 font-semibold">Time:</label>
            <input type="text" value={formData.verifiedTime} onChange={(e) => handleInputChange(e, 'verifiedTime')} className="w-full bg-transparent focus:outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-3 border-b border-gray-300">
          <div className={tableCellClass + " p-2 flex items-center"}>
            <label className="font-semibold mr-1 whitespace-nowrap">Consent Taken By:</label>
            <input type="text" value={formData.consentTakenBy} onChange={(e) => handleInputChange(e, 'consentTakenBy')} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellClass + " p-2 flex items-center"}>
            <label className="mr-1 font-semibold">Date:</label>
            <input type="text" value={formData.consentDate} onChange={(e) => handleInputChange(e, 'consentDate')} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellLastClass + " p-2 flex items-center"}>
            <label className="mr-1 font-semibold">Time:</label>
            <input type="text" value={formData.consentTime} onChange={(e) => handleInputChange(e, 'consentTime')} className="w-full bg-transparent focus:outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-3 border-b border-gray-300">
          <div className={tableCellClass + " p-2 flex items-center"}>
            <label className="font-semibold mr-1 whitespace-nowrap">Transfusion Started By:</label>
            <input type="text" value={formData.transfusionStartedBy} onChange={(e) => handleInputChange(e, 'transfusionStartedBy')} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellClass + " p-2 flex items-center"}>
            <label className="mr-1 font-semibold">Date:</label>
            <input type="text" value={formData.transfusionStartDate} onChange={(e) => handleInputChange(e, 'transfusionStartDate')} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellLastClass + " p-2 flex items-center"}>
            <label className="mr-1 font-semibold">Time:</label>
            <input type="text" value={formData.transfusionStartTime} onChange={(e) => handleInputChange(e, 'transfusionStartTime')} className="w-full bg-transparent focus:outline-none" />
          </div>
        </div>
        <div className="flex border-b border-gray-300">
          <div className={"font-semibold p-2"}>Site:</div>
          <div className={"flex-grow p-2"}><input type="text" value={formData.site} onChange={(e) => handleInputChange(e, 'site')} className="w-full bg-transparent focus:outline-none" /></div>
        </div>
      </div>

      <p className="text-center mt-6 mb-8 text-sm font-semibold">Blood Bag Sticker To Be Pasted Here.</p>

      {/* Combined Monitoring and Termination Table */}
      <div className="border border-gray-300 mt-6 rounded-md overflow-hidden">
        <div className="bg-gray-200 text-center font-bold text-sm p-2 border-b border-gray-300">
          Monitoring
        </div>
        <div className="flex justify-end p-2">
          <button
            onClick={addRow}
            className="bg-blue-500 text-white text-xs px-2 py-1 rounded-md mr-2 hover:bg-blue-600 transition-colors duration-200"
          >
            + Row
          </button>
          <button
            onClick={removeRow}
            className="bg-red-500 text-white text-xs px-2 py-1 rounded-md hover:bg-red-600 transition-colors duration-200"
          >
            - Row
          </button>
        </div>

        {/* Monitoring Table Header */}
        <div className="grid grid-cols-9 font-bold text-center text-xs bg-gray-200">
          <div className={tableHeaderClass}>Date</div>
          <div className={tableHeaderClass}>Time</div>
          <div className={tableHeaderClass}>Temp.</div>
          <div className={tableHeaderClass}>Pulse/min</div>
          <div className={tableHeaderClass}>Resp. Rate</div>
          <div className={tableHeaderClass}>B.P.</div>
          <div className={tableHeaderClass}>SaO2</div>
          <div className={tableHeaderClass}>Symptoms</div>
          <div className={tableHeaderClass + " border-r-0"}>Sign.</div>
        </div>

        {/* Monitoring Rows */}
        {formData.monitoringTable.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-9 text-center text-xs border-t border-gray-300"
          >
            <input type="text" value={row.date} onChange={(e) => handleMonitoringChange(e, index, 'date')} className={tableCellClass} />
            <input type="text" value={row.time} onChange={(e) => handleMonitoringChange(e, index, 'time')} className={tableCellClass} />
            <input type="text" value={row.temp} onChange={(e) => handleMonitoringChange(e, index, 'temp')} className={tableCellClass} />
            <input type="text" value={row.pulse} onChange={(e) => handleMonitoringChange(e, index, 'pulse')} className={tableCellClass} />
            <input type="text" value={row.respRate} onChange={(e) => handleMonitoringChange(e, index, 'respRate')} className={tableCellClass} />
            <input type="text" value={row.bp} onChange={(e) => handleMonitoringChange(e, index, 'bp')} className={tableCellClass} />
            <input type="text" value={row.saO2} onChange={(e) => handleMonitoringChange(e, index, 'saO2')} className={tableCellClass} />
            <input type="text" value={row.symptoms} onChange={(e) => handleMonitoringChange(e, index, 'symptoms')} className={tableCellClass} />
            <input type="text" value={row.sign} onChange={(e) => handleMonitoringChange(e, index, 'sign')} className={tableCellLastClass} />
          </div>
        ))}

        {/* Termination Section aligned with Monitoring Columns */}
        <div className="grid grid-cols-9 border-t border-gray-300">
          {/* Terminated By - spans cols 1 to 5 */}
          <div className={tableCellClass + " p-2 flex items-center col-span-5"}>
            <label className="font-semibold mr-1 whitespace-nowrap">Terminated By:</label>
            <input
              type="text"
              value={formData.terminatedBy}
              onChange={(e) => handleInputChange(e, "terminatedBy")}
              className="w-full bg-transparent focus:outline-none"
            />
          </div>

          {/* Date - spans cols 6 to 7 */}
          <div className={tableCellClass + " p-2 flex items-center col-span-2"}>
            <label className="font-semibold mr-1">Date:</label>
            <input
              type="text"
              value={formData.terminatedDate}
              onChange={(e) => handleInputChange(e, "terminatedDate")}
              className="w-full bg-transparent focus:outline-none"
            />
          </div>

          {/* Time - spans cols 8 to 9 */}
          <div className={tableCellLastClass + " p-2 flex items-center col-span-2"}>
            <label className="font-semibold mr-1">Time:</label>
            <input
              type="text"
              value={formData.terminatedTime}
              onChange={(e) => handleInputChange(e, "terminatedTime")}
              className="w-full bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* Transfusion Reaction Row */}
        <div className="grid grid-cols-1 border-t border-gray-300">
          <div className={tableCellLastClass + " p-2 flex items-center"}>
            <label className="font-semibold mr-1 whitespace-nowrap">Transfusion Reaction if Any:</label>
            <input
              type="text"
              value={formData.transfusionReaction}
              onChange={(e) => handleInputChange(e, "transfusionReaction")}
              className="w-full bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* Final Readings Table */}
        <div className="grid grid-cols-5 border-t border-gray-300">
          <div className={tableHeaderClass}>Temp.</div>
          <div className={tableHeaderClass}>P:</div>
          <div className={tableHeaderClass}>RR:</div>
          <div className={tableHeaderClass}>BP:</div>
          <div className={tableHeaderClass + " border-r-0"}>SaO2</div>
          <div className={tableCellClass}>
            <input type="text" value={formData.finalTemp} onChange={(e) => handleInputChange(e, "finalTemp")} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellClass}>
            <input type="text" value={formData.finalP} onChange={(e) => handleInputChange(e, "finalP")} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellClass}>
            <input type="text" value={formData.finalRR} onChange={(e) => handleInputChange(e, "finalRR")} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellClass}>
            <input type="text" value={formData.finalBP} onChange={(e) => handleInputChange(e, "finalBP")} className="w-full bg-transparent focus:outline-none" />
          </div>
          <div className={tableCellLastClass}>
            <input type="text" value={formData.finalSaO2} onChange={(e) => handleInputChange(e, "finalSaO2")} className="w-full bg-transparent focus:outline-none" />
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 gap-x-4 mt-4">
        <div className="flex items-center">
          <label className={labelClass}>Name of Doctor:</label>
          <input type="text" value={formData.nameOfDoctor} onChange={(e) => handleInputChange(e, 'nameOfDoctor')} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Sign:</label>
          {renderSignatureInput()}
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Date:</label>
          <input type="text" value={formData.doctorDate} onChange={(e) => handleInputChange(e, 'doctorDate')} className={inputClass} />
        </div>
        <div className="flex items-center">
          <label className={labelClass}>Time:</label>
          <input type="text" value={formData.doctorTime} onChange={(e) => handleInputChange(e, 'doctorTime')} className={inputClass} />
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
            "Save Record"
          )}
        </button>
      </div>
    </div>
  );
};

export default BloodTransfusionRecord;