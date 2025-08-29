"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw, PlusCircle, MinusCircle } from 'lucide-react';

// --- Type Definitions ---
interface ChargeRow {
  date: string;
  procedure: string;
  classType: string;
  timeFrom: string;
  timeTo: string;
  doneBy: string;
  unit: string;
  vehNo: string;
  userIdSign: string; // Will hold PIN or signature URL
}

// --- UPDATED: Helper Function to Create Initial State (3 rows) ---
const createInitialRows = (count: number = 3): ChargeRow[] => {
  return Array.from({ length: count }, () => ({
    date: '',
    procedure: '',
    classType: '',
    timeFrom: '',
    timeTo: '',
    doneBy: '',
    unit: '',
    vehNo: '',
    userIdSign: '',
  }));
};

// --- Main Patient Charges Sheet Component ---
const PatientChargesSheet = ({ ipdId }: { ipdId: string }) => {
  const [rows, setRows] = useState<ChargeRow[]>(createInitialRows());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [verifyingSignature, setVerifyingSignature] = useState<number | null>(null);

  // --- Data Fetching Function ---
  const fetchChargesData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('charges_data')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.charges_data) {
        const parsedRows = data.charges_data as ChargeRow[];
        if (Array.isArray(parsedRows) && parsedRows.length > 0) {
          setRows(parsedRows);
          toast.success("Previous charges data loaded.");
        }
      }
    } catch (error) {
      console.error("Failed to fetch charges data:", error);
      toast.error("Failed to load charges data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchChargesData();
  }, [ipdId, fetchChargesData]);

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

      const rowsToSave = rows.map(row => {
          if (row.userIdSign.length === 10 && !row.userIdSign.startsWith('http')) {
              return { ...row, userIdSign: '' }; // Clear any unsaved PINs
          }
          return row;
      });

      const { error } = await supabase.from('ipd_record').upsert({
          ipd_id: ipdId,
          user_id: session.user.id,
          charges_data: rowsToSave,
        }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("Patient charges sheet saved successfully!");
    } catch (error) {
      console.error("Failed to save charges data:", error);
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
          i === index ? { ...row, userIdSign: data.signature_url } : row
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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number, field: keyof ChargeRow) => {
    const { value } = e.target;
    const newRows = rows.map((row, i) => i === index ? { ...row, [field]: value } : row);
    setRows(newRows);

    if (field === 'userIdSign' && value.length === 10) {
        checkAndSetSignature(value, index);
    }
  };

  // --- Reset Signature with Confirmation ---
  const handleSignatureReset = (index: number) => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
      setRows(prevRows => prevRows.map((row, i) =>
        i === index ? { ...row, userIdSign: '' } : row
      ));
      toast.info(`Signature for row ${index + 1} has been cleared.`);
    }
  };

  // --- Row Management Functions ---
  const addRow = () => {
    const newRow: ChargeRow = { date: '', procedure: '', classType: '', timeFrom: '', timeTo: '', doneBy: '', unit: '', vehNo: '', userIdSign: '' };
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
        <p className="ml-4 text-xl text-gray-600">Loading Charges Sheet...</p>
      </div>
    );
  }

  // Define grid columns for reuse to ensure consistency
  const gridColumnsClass = "grid-cols-[100px_minmax(0,3fr)_minmax(0,1fr)_90px_90px_minmax(0,1.5fr)_minmax(0,0.5fr)_minmax(0,1fr)_minmax(0,1fr)]";

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto font-sans">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">Patient Charges Sheets</h1>
      </div>

      <div className="border border-gray-400 rounded-md overflow-hidden">
        {/* Table Header Wrapper */}
        <div className="bg-gray-200 font-bold text-xs text-center">
            {/* Main Header */}
            <div className={`grid ${gridColumnsClass}`}>
              <div className="p-2 border-r border-b border-gray-400 flex items-center justify-center">Date</div>
              <div className="p-2 border-r border-b border-gray-400 flex items-center justify-center">Procedure/Medical Cases/Others</div>
              <div className="p-2 border-r border-b border-gray-400 flex items-center justify-center">Class</div>
              <div className="p-2 border-r border-b border-gray-400 col-span-2">Time</div>
              <div className="p-2 border-r border-b border-gray-400 flex items-center justify-center">Done By</div>
              <div className="p-2 border-r border-b border-gray-400 flex items-center justify-center">Unit</div>
              <div className="p-2 border-r border-b border-gray-400 flex items-center justify-center">Veh. No.</div>
              <div className="p-2 border-b border-gray-400 flex items-center justify-center">User ID Sign.</div>
            </div>
            {/* Sub Header for Time */}
            <div className={`grid ${gridColumnsClass}`}>
                <div className="py-2 px-1 border-r border-b border-gray-400"></div>
                <div className="py-2 px-1 border-r border-b border-gray-400"></div>
                <div className="py-2 px-1 border-r border-b border-gray-400"></div>
                <div className="py-2 px-1 border-r border-b border-gray-400 flex items-center justify-center">From</div>
                <div className="py-2 px-1 border-r border-b border-gray-400 flex items-center justify-center">To</div>
                <div className="py-2 px-1 border-r border-b border-gray-400"></div>
                <div className="py-2 px-1 border-r border-b border-gray-400"></div>
                <div className="py-2 px-1 border-r border-b border-gray-400"></div>
                <div className="py-2 px-1 border-b border-gray-400"></div>
            </div>
        </div>

        {/* Table Body */}
        <div>
          {rows.map((row, index) => (
            <div key={index} className={`grid ${gridColumnsClass} text-xs text-center border-t border-gray-400 min-h-[40px]`}>
              <input type="text" value={row.date} placeholder="Date" onChange={(e) => handleInputChange(e, index, 'date')} className="p-2 border-r border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full" />
              <input type="text" value={row.procedure} onChange={(e) => handleInputChange(e, index, 'procedure')} className="p-2 border-r border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full" />
              <input type="text" value={row.classType} onChange={(e) => handleInputChange(e, index, 'classType')} className="p-2 border-r border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full" />
              <input type="text" value={row.timeFrom} placeholder="HH:MM" onChange={(e) => handleInputChange(e, index, 'timeFrom')} className="p-2 border-r border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full" />
              <input type="text" value={row.timeTo} placeholder="HH:MM" onChange={(e) => handleInputChange(e, index, 'timeTo')} className="p-2 border-r border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full" />
              <input type="text" value={row.doneBy} onChange={(e) => handleInputChange(e, index, 'doneBy')} className="p-2 border-r border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full" />
              <input type="text" value={row.unit} onChange={(e) => handleInputChange(e, index, 'unit')} className="p-2 border-r border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full" />
              <input type="text" value={row.vehNo} onChange={(e) => handleInputChange(e, index, 'vehNo')} className="p-2 border-r border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full" />
              <div className="flex items-center justify-center">
                 {verifyingSignature === index ? (
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                 ) : row.userIdSign.startsWith('http') ? (
                    <img 
                        src={row.userIdSign} 
                        alt="Signature"
                        title="Click to remove signature"
                        className="h-8 object-contain cursor-pointer p-1 hover:opacity-75"
                        onClick={() => handleSignatureReset(index)}
                    />
                 ) : (
                    <input
                        type="password"
                        value={row.userIdSign}
                        onChange={(e) => handleInputChange(e, index, 'userIdSign')}
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

      <div className="flex justify-between items-center mt-6">
        <div className="flex gap-2">
            <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-blue-500 hover:bg-blue-600 transition-colors duration-200 text-sm font-semibold">
                <PlusCircle className="h-4 w-4" /> Add Row
            </button>
            <button onClick={removeRow} disabled={rows.length <= 1} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors duration-200 text-sm font-semibold disabled:bg-gray-400">
                <MinusCircle className="h-4 w-4" /> Remove Row
            </button>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSaving ? ( <> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </> ) : ( "Save Charges Sheet" )}
        </button>
      </div>
    </div>
  );
};

export default PatientChargesSheet;