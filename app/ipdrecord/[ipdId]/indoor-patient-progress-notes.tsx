// Filename: indoor-patient-progress-notes.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw, PlusCircle, MinusCircle } from 'lucide-react';

// --- Type Definitions ---
interface ProgressNoteRow {
  date: string;
  progressNote: string;
}

// --- Helper Function to Create Initial State ---
const createInitialRows = (count: number = 15): ProgressNoteRow[] => {
  return Array.from({ length: count }, () => ({
    date: '',
    progressNote: '',
  }));
};

// --- Main Progress Notes Component ---
const IndoorPatientProgressNotes = ({ ipdId }: { ipdId: string }) => {
  const [rows, setRows] = useState<ProgressNoteRow[]>(createInitialRows());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Data Fetching Function ---
  const fetchProgressNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('progress_notes')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.progress_notes) {
        const parsedRows = data.progress_notes as ProgressNoteRow[];
        if (Array.isArray(parsedRows) && parsedRows.length > 0) {
          setRows(parsedRows);
          toast.success("Previous progress notes loaded.");
        }
      }
    } catch (error) {
      console.error("Failed to fetch progress notes:", error);
      toast.error("Failed to load progress notes.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchProgressNotes();
  }, [ipdId, fetchProgressNotes]);

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

      const { error } = await supabase.from('ipd_record').upsert({
          ipd_id: ipdId,
          user_id: session.user.id,
          progress_notes: rows,
        }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("Progress notes saved successfully!");
    } catch (error) {
      console.error("Failed to save progress notes:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Input Change Handler ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index: number, field: keyof ProgressNoteRow) => {
    const { value } = e.target;
    setRows(prevRows => prevRows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  // --- Row Management Functions ---
  const addRow = () => {
    const newRow: ProgressNoteRow = { date: '', progressNote: '' };
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
        <p className="ml-4 text-xl text-gray-600">Loading Progress Notes...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto font-sans">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">Indoor Patients Progress Notes</h1>
      </div>

      <div className="border border-gray-400 rounded-md overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[150px_1fr] bg-gray-200 font-bold text-xs text-center">
          <div className="p-2 border-r border-b border-gray-400">Date</div>
          <div className="p-2 border-b border-gray-400">Progress Notes</div>
        </div>

        {/* Table Body */}
        <div>
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[150px_1fr] text-xs border-t border-gray-400">
              <input
                type="text"
                value={row.date}
                onChange={(e) => handleInputChange(e, index, 'date')}
                className="p-2 border-r border-gray-400 focus:outline-none w-full"
                placeholder="YYYY-MM-DD"
              />
              <textarea
                value={row.progressNote}
                onChange={(e) => handleInputChange(e, index, 'progressNote')}
                className="p-2 focus:outline-none w-full resize-none"
                rows={2}
              />
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
          {isSaving ? ( <> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </> ) : ( "Save Progress Notes" )}
        </button>
      </div>
    </div>
  );
};

export default IndoorPatientProgressNotes;
