// Filename: clinical-notes-sheet.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

// --- Type Definitions ---
interface ClinicalNotesData {
  mainComplaintsDuration: string;
  pastHistory: string;
  familySocialHistory: string;
  generalPhysicalExamination: string;
  systemicExaminationCardiovascular: string;
  respiratory: string;
  perAbdomen: string;
  neurology: string;
  skeletal: string;
  otherFindings: string;
  summary: string;
  provisionalDiagnosis1: string;
  provisionalDiagnosis2: string;
  provisionalDiagnosis3: string;
  otherNotes: string;
}

// --- Initial State for Clinical Notes ---
const initialClinicalNotes: ClinicalNotesData = {
  mainComplaintsDuration: '',
  pastHistory: '',
  familySocialHistory: '',
  generalPhysicalExamination: '',
  systemicExaminationCardiovascular: '',
  respiratory: '',
  perAbdomen: '',
  neurology: '',
  skeletal: '',
  otherFindings: '',
  summary: '',
  provisionalDiagnosis1: '',
  provisionalDiagnosis2: '',
  provisionalDiagnosis3: '',
  otherNotes: '',
};

// --- Clinical Notes Sheet Component ---
const ClinicalNotesSheet = ({ ipdId }: { ipdId: string }) => {
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNotesData>(initialClinicalNotes);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Data Fetching Function ---
  const fetchClinicalNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('clinical_notes_data')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found

      if (data?.clinical_notes_data) {
        setClinicalNotes(data.clinical_notes_data as ClinicalNotesData);
        toast.success("Previous clinical notes loaded.");
      }
    } catch (error) {
      console.error("Failed to fetch clinical notes:", error);
      toast.error("Failed to load clinical notes.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  // --- Authentication and Data Fetching Effect ---
  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && ipdId) {
        fetchClinicalNotes();
      } else {
        setIsLoading(false);
        toast.error("User not authenticated. Please log in.");
      }
    };
    checkAuthAndFetch();
  }, [ipdId, fetchClinicalNotes]);

  // --- Data Saving Function ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated. Cannot save data.");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from('ipd_record').upsert({
        ipd_id: ipdId,
        user_id: session.user.id,
        clinical_notes_data: clinicalNotes,
      }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("Clinical notes saved successfully!");
    } catch (error) {
      console.error("Failed to save clinical notes:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Input Change Handler ---
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: keyof ClinicalNotesData
  ) => {
    const { value } = e.target;
    setClinicalNotes(prevNotes => ({ ...prevNotes, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Clinical Notes...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-full mx-auto font-sans text-sm">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">Clinical Notes</h1>
        <p className="text-sm text-gray-500">
          <span className="font-semibold">Medford Multi Speciality Hospital</span>
        </p>
      </div>

      {/* The patient header block has been removed from here */}

      {/* Clinical Notes Sections */}
      <div className="space-y-4">
        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="mainComplaintsDuration" className="font-semibold block mb-1">Main Complaints & Duration:</label>
          <textarea
            id="mainComplaintsDuration"
            value={clinicalNotes.mainComplaintsDuration}
            onChange={(e) => handleInputChange(e, 'mainComplaintsDuration')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="pastHistory" className="font-semibold block mb-1">Past History:</label>
          <textarea
            id="pastHistory"
            value={clinicalNotes.pastHistory}
            onChange={(e) => handleInputChange(e, 'pastHistory')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="familySocialHistory" className="font-semibold block mb-1">Family & Social History:</label>
          <textarea
            id="familySocialHistory"
            value={clinicalNotes.familySocialHistory}
            onChange={(e) => handleInputChange(e, 'familySocialHistory')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="generalPhysicalExamination" className="font-semibold block mb-1">General Physical Examination:</label>
          <textarea
            id="generalPhysicalExamination"
            value={clinicalNotes.generalPhysicalExamination}
            onChange={(e) => handleInputChange(e, 'generalPhysicalExamination')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="systemicExaminationCardiovascular" className="font-semibold block mb-1">Systemic Examination Cardiovascular:</label>
          <textarea
            id="systemicExaminationCardiovascular"
            value={clinicalNotes.systemicExaminationCardiovascular}
            onChange={(e) => handleInputChange(e, 'systemicExaminationCardiovascular')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="respiratory" className="font-semibold block mb-1">Respiratory:</label>
          <textarea
            id="respiratory"
            value={clinicalNotes.respiratory}
            onChange={(e) => handleInputChange(e, 'respiratory')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>
        
        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="perAbdomen" className="font-semibold block mb-1">Per Abdomen:</label>
          <textarea
            id="perAbdomen"
            value={clinicalNotes.perAbdomen}
            onChange={(e) => handleInputChange(e, 'perAbdomen')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        {/* Second page sections */}
        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="neurology" className="font-semibold block mb-1">Neurology:</label>
          <textarea
            id="neurology"
            value={clinicalNotes.neurology}
            onChange={(e) => handleInputChange(e, 'neurology')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="skeletal" className="font-semibold block mb-1">Skeletal:</label>
          <textarea
            id="skeletal"
            value={clinicalNotes.skeletal}
            onChange={(e) => handleInputChange(e, 'skeletal')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="otherFindings" className="font-semibold block mb-1">Other:</label>
          <textarea
            id="otherFindings"
            value={clinicalNotes.otherFindings}
            onChange={(e) => handleInputChange(e, 'otherFindings')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="summary" className="font-semibold block mb-1">Summary:</label>
          <textarea
            id="summary"
            value={clinicalNotes.summary}
            onChange={(e) => handleInputChange(e, 'summary')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <span className="font-semibold block mb-1">Provisional Diagnosis:</span>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <input
                type="text"
                value={clinicalNotes.provisionalDiagnosis1}
                onChange={(e) => handleInputChange(e, 'provisionalDiagnosis1')}
                className="w-full p-2 border-b border-gray-200 focus:outline-none"
              />
            </li>
            <li>
              <input
                type="text"
                value={clinicalNotes.provisionalDiagnosis2}
                onChange={(e) => handleInputChange(e, 'provisionalDiagnosis2')}
                className="w-full p-2 border-b border-gray-200 focus:outline-none"
              />
            </li>
            <li>
              <input
                type="text"
                value={clinicalNotes.provisionalDiagnosis3}
                onChange={(e) => handleInputChange(e, 'provisionalDiagnosis3')}
                className="w-full p-2 border-b border-gray-200 focus:outline-none"
              />
            </li>
          </ol>
        </div>

        <div className="border border-gray-300 rounded-md p-3">
          <label htmlFor="otherNotes" className="font-semibold block mb-1">Other:</label>
          <textarea
            id="otherNotes"
            value={clinicalNotes.otherNotes}
            onChange={(e) => handleInputChange(e, 'otherNotes')}
            className="w-full h-24 p-2 border-none focus:outline-none resize-none"
          ></textarea>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSaving ? ( <> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </> ) : ( "Save Clinical Notes" )}
        </button>
      </div>
    </div>
  );
};

export default ClinicalNotesSheet;