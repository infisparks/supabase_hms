"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw, PlusCircle, MinusCircle } from 'lucide-react';

// --- Type Definitions ---
interface NursesNoteRow {
  date: string;
  medicationTreatment: string;
  nursesObservation: string;
  signature: string; // This will hold either the PIN or the signature image URL
}

// --- Helper Function to Create Initial State ---
const createInitialRows = (count: number = 3): NursesNoteRow[] => { // UPDATED: Default row count is now 3
  return Array.from({ length: count }, () => ({
    date: '',
    medicationTreatment: '',
    nursesObservation: '',
    signature: '',
  }));
};

// --- Main Nurses Notes Component ---
const NursesNotesSheet = ({ ipdId }: { ipdId: string }) => {
  const [rows, setRows] = useState<NursesNoteRow[]>(createInitialRows());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [verifyingSignature, setVerifyingSignature] = useState<number | null>(null);

  // --- Data Fetching Function ---
  const fetchNursesNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('nurses_notes')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.nurses_notes) {
        const parsedRows = data.nurses_notes as NursesNoteRow[];
        if (Array.isArray(parsedRows) && parsedRows.length > 0) {
          setRows(parsedRows);
          toast.success("Previous nurses' notes loaded.");
        }
      }
    } catch (error) {
      console.error("Failed to fetch nurses' notes:", error);
      toast.error("Failed to load nurses' notes.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchNursesNotes();
  }, [ipdId, fetchNursesNotes]);

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
        if (row.signature.length === 10 && !row.signature.startsWith('http')) {
            return { ...row, signature: '' }; 
        }
        return row;
      });

      const { error } = await supabase.from('ipd_record').upsert({
          ipd_id: ipdId,
          user_id: session.user.id,
          nurses_notes: rowsToSave,
        }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("Nurses' notes saved successfully!");
    } catch (error) {
      console.error("Failed to save nurses' notes:", error);
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
          i === index ? { ...row, signature: data.signature_url } : row
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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index: number, field: keyof NursesNoteRow) => {
    const { value } = e.target;
    const newRows = rows.map((row, i) => i === index ? { ...row, [field]: value } : row);
    setRows(newRows);
    
    if (field === 'signature' && value.length === 10) {
      checkAndSetSignature(value, index);
    }
  };
  
  // --- Reset Signature with Confirmation ---
  const handleSignatureReset = (index: number) => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
      setRows(prevRows => prevRows.map((row, i) =>
        i === index ? { ...row, signature: '' } : row
      ));
      toast.info(`Signature for row ${index + 1} has been cleared.`);
    }
  };


  // --- Row Management Functions ---
  const addRow = () => {
    const newRow: NursesNoteRow = { date: '', medicationTreatment: '', nursesObservation: '', signature: '' };
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
        <p className="ml-4 text-xl text-gray-600">Loading Nurses' Notes...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto font-sans">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">Nurses Notes</h1>
      </div>

      <div className="border border-gray-400 rounded-md overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[150px_2fr_3fr_1fr] bg-gray-200 font-bold text-xs text-center">
          <div className="p-2 border-r border-b border-gray-400">Date</div>
          <div className="p-2 border-r border-b border-gray-400">Medication / Treatment</div>
          <div className="p-2 border-r border-b border-gray-400">Nurse's Observation</div>
          <div className="p-2 border-b border-gray-400">Signature</div>
        </div>

        {/* Table Body */}
        <div>
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[150px_2fr_3fr_1fr] text-xs border-t border-gray-400 min-h-[52px]">
              <input
                type="text"
                value={row.date}
                onChange={(e) => handleInputChange(e, index, 'date')}
                className="p-2 border-r border-gray-400 focus:outline-none w-full"
                placeholder="YYYY-MM-DD"
              />
              <textarea
                value={row.medicationTreatment}
                onChange={(e) => handleInputChange(e, index, 'medicationTreatment')}
                className="p-2 border-r border-gray-400 focus:outline-none w-full resize-none"
                rows={2}
              />
              <textarea
                value={row.nursesObservation}
                onChange={(e) => handleInputChange(e, index, 'nursesObservation')}
                className="p-2 border-r border-gray-400 focus:outline-none w-full resize-none"
                rows={2}
              />
              <div className="flex items-center justify-center">
                 {verifyingSignature === index ? (
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                 ) : row.signature.startsWith('http') ? (
                    <img 
                        src={row.signature} 
                        alt="Signature"
                        title="Click to remove signature"
                        className="h-10 object-contain cursor-pointer p-1 hover:opacity-75 transition-opacity"
                        onClick={() => handleSignatureReset(index)}
                    />
                 ) : (
                    <input
                        type="password"
                        value={row.signature}
                        onChange={(e) => handleInputChange(e, index, 'signature')}
                        className="p-2 focus:outline-none w-full text-center"
                        maxLength={10}
                        placeholder="Enter 10-digit PIN"
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
            <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-blue-500 hover:bg-blue-600">
                <PlusCircle className="h-4 w-4" /> Add Row
            </button>
            <button onClick={removeRow} disabled={rows.length <= 1} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-400">
                <MinusCircle className="h-4 w-4" /> Remove Row
            </button>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSaving ? ( <> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </> ) : ( "Save Nurses' Notes" )}
        </button>
      </div>
    </div>
  );
};

export default NursesNotesSheet;