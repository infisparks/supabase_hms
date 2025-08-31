"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw, PlusCircle, MinusCircle } from 'lucide-react';
import PatientDetailsHeader from "./PatientDetailsHeader";
import PdfGenerator from "./PdfGenerator"; // Import PdfGenerator

// --- Type Definitions ---
interface GlucoseRow {
  date: string;
  time: string;
  bloodSugar: string;
  urineKetone: string;
  medication: string;
  dose: string;
  orderedBy: string;
  timeGiven: string;
  signId: string; // Will hold PIN or signature URL
}

// --- UPDATED: Helper Function to Create Initial State (3 rows) ---
const createInitialRows = (count: number = 3): GlucoseRow[] => {
  return Array.from({ length: count }, () => ({
    date: '', time: '', bloodSugar: '', urineKetone: '', medication: '',
    dose: '', orderedBy: '', timeGiven: '', signId: '',
  }));
};

// --- Main Glucose Monitoring Sheet Component ---
const GlucoseMonitoringSheet = ({ ipdId }: { ipdId: string }) => {
  const [rows, setRows] = useState<GlucoseRow[]>(createInitialRows());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [verifyingSignature, setVerifyingSignature] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null); // Create the ref

  // --- Data Fetching Function ---
  const fetchGlucoseData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('glucose_data')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.glucose_data) {
        const parsedRows = data.glucose_data as GlucoseRow[];
        if (Array.isArray(parsedRows) && parsedRows.length > 0) {
          setRows(parsedRows);
          toast.success("Previous glucose data loaded.");
        }
      }
    } catch (error) {
      console.error("Failed to fetch glucose data:", error);
      toast.error("Failed to load glucose data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchGlucoseData();
  }, [ipdId, fetchGlucoseData]);

  // --- Data Saving Function ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated.");
        setIsSaving(false);
        return;
      }

      // Clear any unsaved PINs before saving
      const rowsToSave = rows.map(row => {
        if (row.signId.length === 10 && !row.signId.startsWith('http')) {
          return { ...row, signId: '' };
        }
        return row;
      });

      const { error } = await supabase.from('ipd_record').upsert({
        ipd_id: ipdId,
        user_id: session.user.id,
        glucose_data: rowsToSave,
      }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("Glucose monitoring sheet saved successfully!");
    } catch (error) {
      console.error("Failed to save glucose data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Signature Verification Function ---
  const checkAndSetSignature = useCallback(async (password: string, index: number) => {
    if (password.length !== 10) return;
    setVerifyingSignature(index);
    try {
      const { data, error } = await supabase
        .from('signature')
        .select('signature_url')
        .eq('password', password)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.signature_url) {
        setRows(prevRows => prevRows.map((row, i) =>
          i === index ? { ...row, signId: data.signature_url } : row
        ));
        toast.success(`Signature verified for row ${index + 1}.`);
      } else {
        toast.error(`Invalid signature PIN for row ${index + 1}.`);
      }
    } catch (error) {
      console.error("Error verifying signature:", error);
      toast.error("Could not verify signature.");
    } finally {
      setVerifyingSignature(null);
    }
  }, []);

  // --- Input Change Handler ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number, field: keyof GlucoseRow) => {
    const { value } = e.target;
    const newRows = rows.map((row, i) => i === index ? { ...row, [field]: value } : row);
    setRows(newRows);

    if (field === 'signId' && value.length === 10) {
      checkAndSetSignature(value, index);
    }
  };

  // --- Reset Signature with Confirmation ---
  const handleSignatureReset = (index: number) => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
      setRows(prevRows => prevRows.map((row, i) =>
        i === index ? { ...row, signId: '' } : row
      ));
      toast.info(`Signature for row ${index + 1} has been cleared.`);
    }
  };

  // --- Row Management Functions ---
  const addRow = () => {
    const newRow: GlucoseRow = { date: '', time: '', bloodSugar: '', urineKetone: '', medication: '', dose: '', orderedBy: '', timeGiven: '', signId: '' };
    setRows(prevRows => [...prevRows, newRow]);
  };

  const removeRow = () => {
    if (rows.length > 1) {
      setRows(prevRows => prevRows.slice(0, -1));
    } else {
      toast.info("At least one row is required.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Glucose Sheet...</p>
      </div>
    );
  }

  const gridColumnsClass = "grid-cols-[1fr_1fr_1fr_1fr_2fr_1fr_1.5fr_1fr_1.5fr]";

  return (
    <div ref={formRef} className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto font-sans">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">Glucose Monitoring Sheet</h1>
      </div>

      <PatientDetailsHeader ipdId={ipdId} />

      <div className="border border-gray-400 rounded-md overflow-hidden">
        {/* Table Header */}
        <div className={`grid ${gridColumnsClass} bg-gray-200 font-bold text-xs text-center`}>
          <div className="p-2 border-r border-b border-gray-400">Date</div>
          <div className="p-2 border-r border-b border-gray-400">Time</div>
          <div className="p-2 border-r border-b border-gray-400">Blood Sugar (mg/dl)</div>
          <div className="p-2 border-r border-b border-gray-400">Urine Sugar Ketone</div>
          <div className="p-2 border-r border-b border-gray-400">Medication</div>
          <div className="p-2 border-r border-b border-gray-400">Dose</div>
          <div className="p-2 border-r border-b border-gray-400">Ordered By</div>
          <div className="p-2 border-r border-b border-gray-400">Time Given</div>
          <div className="p-2 border-b border-gray-400">Sign. & ID</div>
        </div>

        {/* Table Body */}
        <div>
          {rows.map((row, index) => (
            <div key={index} className={`grid ${gridColumnsClass} text-xs text-center border-t border-gray-400 min-h-[40px]`}>
              <input type="text" value={row.date} onChange={(e) => handleInputChange(e, index, 'date')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.time} onChange={(e) => handleInputChange(e, index, 'time')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.bloodSugar} onChange={(e) => handleInputChange(e, index, 'bloodSugar')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.urineKetone} onChange={(e) => handleInputChange(e, index, 'urineKetone')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.medication} onChange={(e) => handleInputChange(e, index, 'medication')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.dose} onChange={(e) => handleInputChange(e, index, 'dose')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.orderedBy} onChange={(e) => handleInputChange(e, index, 'orderedBy')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.timeGiven} onChange={(e) => handleInputChange(e, index, 'timeGiven')} className="p-2 border-r border-b border-gray-400 focus:outline-none w-full" />
              <div className="flex items-center justify-center">
                {verifyingSignature === index ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                ) : row.signId.startsWith('http') ? (
                  <img
                    src={row.signId}
                    alt="Signature"
                    title="Click to clear signature"
                    className="h-8 object-contain cursor-pointer p-1 hover:opacity-75"
                    onClick={() => handleSignatureReset(index)}
                  />
                ) : (
                  <input
                    type="password"
                    value={row.signId}
                    onChange={(e) => handleInputChange(e, index, 'signId')}
                    className="p-2 focus:outline-none w-full text-center"
                    maxLength={10}
                    placeholder="PIN"
                    autoComplete="new-password"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 no-pdf">
        <div className="flex gap-2">
          <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-blue-500 hover:bg-blue-600">
            <PlusCircle className="h-4 w-4" /> Add Row
          </button>
          <button onClick={removeRow} disabled={rows.length <= 1} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-400">
            <MinusCircle className="h-4 w-4" /> Remove Row
          </button>
        </div>
        <div className="flex space-x-4">
          <PdfGenerator contentRef={formRef as React.RefObject<HTMLDivElement>} fileName="GlucoseMonitoringSheet" />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isSaving ? (<> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </>) : ("Save Glucose Sheet")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlucoseMonitoringSheet;