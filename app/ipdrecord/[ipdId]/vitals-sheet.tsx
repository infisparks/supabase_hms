"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import PatientDetailsHeader from "./PatientDetailsHeader";
import PdfGenerator from "./PdfGenerator";

// --- Type Definitions ---
interface VitalsRow {
  time: string;
  temp: string;
  pulse: string;
  resp: string;
  bp: string;
  oral: string;
  iv: string;
  urine: string;
  stool: string;
  aspiration: string;
  insulin: string;
}

interface VitalsData {
  rows: VitalsRow[];
  totals: Omit<VitalsRow, 'time' | 'temp' | 'pulse' | 'resp' | 'bp'>;
}

// --- Helper Function to Create Initial State ---
const createInitialData = (): VitalsRow[] => {
  const times = [
    '8 am', '9 am', '10 am', '11 am', '12 Noon', '1 pm', '2 pm', '3 pm',
    '4 pm', '5 pm', '6 pm', '7 pm', '8 pm', '9 pm', '10 pm', '11 pm',
    '12 Night', '1 am', '2 am', '3 am', '4 am', '5 am', '6 am', '7 am'
  ];
  return times.map(time => ({
    time, temp: '', pulse: '', resp: '', bp: '', oral: '', iv: '',
    urine: '', stool: '', aspiration: '', insulin: ''
  }));
};

const initialTotals = {
  oral: '', iv: '', urine: '', stool: '', aspiration: '', insulin: ''
};

// --- Main Vitals Sheet Component ---
const VitalsSheet = ({ ipdId }: { ipdId: string }) => {
  const [rows, setRows] = useState<VitalsRow[]>(createInitialData());
  const [totals, setTotals] = useState(initialTotals);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // --- Data Fetching Function ---
  const fetchVitalsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated.");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('ipd_record')
        .select('vitals_data')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.vitals_data) {
        const parsedData = data.vitals_data as VitalsData;
        if (Array.isArray(parsedData.rows) && parsedData.rows.length > 0 && parsedData.totals) {
          setRows(parsedData.rows);
          setTotals(parsedData.totals);
          toast.success("Previous vitals data loaded.");
        }
      }
    } catch (error) {
      console.error("Failed to fetch vitals data:", error);
      toast.error("Failed to load vitals data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchVitalsData();
  }, [ipdId, fetchVitalsData]);

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

      const dataToSave: VitalsData = { rows, totals };

      const { error } = await supabase.from('ipd_record').upsert({
        ipd_id: ipdId,
        user_id: session.user.id,
        vitals_data: dataToSave,
      }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("Vitals sheet saved successfully!");
    } catch (error) {
      console.error("Failed to save vitals data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Input Change Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number, field: keyof Omit<VitalsRow, 'time'>) => {
    const { value } = e.target;
    setRows(prevRows => prevRows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleTotalInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof totals) => {
    const { value } = e.target;
    setTotals(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading Vitals Sheet...</p>
      </div>
    );
  }

  const gridColumnsClass = "grid-cols-[80px_repeat(4,60px)_repeat(2,1fr)_repeat(3,1fr)_1fr]";
  const tableHeaderClass = "bg-gray-200 text-center font-bold text-xs p-2 border-r border-gray-300";
  const tableCellClass = "p-2 border-r border-gray-300 focus:outline-none text-xs";
  const tableCellLastClass = "p-2 focus:outline-none text-xs";

  return (
    <div ref={formRef} className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto font-sans">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">Vitals Sheet</h1>
      </div>

      <PatientDetailsHeader ipdId={ipdId} />

      <div className="border border-gray-400 rounded-md overflow-hidden">
        {/* Table Header */}
        <div className={`grid ${gridColumnsClass} bg-gray-200 font-bold text-xs text-center`}>
          <div className="p-2 border-r border-b border-gray-400 row-span-2 flex items-center justify-center">Time</div>
          <div className="p-2 border-r border-b border-gray-400 row-span-2 flex items-center justify-center">Temp.</div>
          <div className="p-2 border-r border-b border-gray-400 row-span-2 flex items-center justify-center">Pulse</div>
          <div className="p-2 border-r border-b border-gray-400 row-span-2 flex items-center justify-center">Resp.</div>
          <div className="p-2 border-r border-b border-gray-400 row-span-2 flex items-center justify-center">B.P.</div>
          <div className="p-2 border-r border-b border-gray-400 col-span-2">INTAKE</div>
          <div className="p-2 border-r border-b border-gray-400 col-span-3">OUTPUT</div>
          <div className="p-2 border-b border-gray-400 row-span-2 flex items-center justify-center">Insulin</div>
          <div className="p-2 border-r border-b border-gray-400">Oral</div>
          <div className="p-2 border-r border-b border-gray-400">I.V.</div>
          <div className="p-2 border-r border-b border-gray-400">Urine</div>
          <div className="p-2 border-r border-b border-gray-400">Stool</div>
          <div className="p-2 border-r border-b border-gray-400">Aspiration</div>
        </div>

        {/* Table Body */}
        <div>
          {rows.map((row, index) => (
            <div key={index} className={`grid ${gridColumnsClass} text-xs text-center border-t border-gray-400`}>
              <div className="p-2 border-r border-gray-400 bg-gray-50 font-semibold flex items-center justify-center">{row.time}</div>
              <input type="text" value={row.temp} onChange={(e) => handleInputChange(e, index, 'temp')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.pulse} onChange={(e) => handleInputChange(e, index, 'pulse')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.resp} onChange={(e) => handleInputChange(e, index, 'resp')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.bp} onChange={(e) => handleInputChange(e, index, 'bp')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.oral} onChange={(e) => handleInputChange(e, index, 'oral')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.iv} onChange={(e) => handleInputChange(e, index, 'iv')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.urine} onChange={(e) => handleInputChange(e, index, 'urine')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.stool} onChange={(e) => handleInputChange(e, index, 'stool')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.aspiration} onChange={(e) => handleInputChange(e, index, 'aspiration')} className="p-2 border-r border-gray-400 focus:outline-none w-full" />
              <input type="text" value={row.insulin} onChange={(e) => handleInputChange(e, index, 'insulin')} className="p-2 focus:outline-none w-full" />
            </div>
          ))}
          {/* Totals Row */}
          <div className={`grid ${gridColumnsClass} text-xs text-center border-t-2 border-gray-600 font-bold`}>
            <div className="p-2 border-r border-gray-400 col-span-5 flex items-center justify-end pr-4">Total in 24 Hrs.</div>
            <input type="text" value={totals.oral} onChange={(e) => handleTotalInputChange(e, 'oral')} className="p-2 border-r border-gray-400 focus:outline-none w-full font-bold" />
            <input type="text" value={totals.iv} onChange={(e) => handleTotalInputChange(e, 'iv')} className="p-2 border-r border-gray-400 focus:outline-none w-full font-bold" />
            <input type="text" value={totals.urine} onChange={(e) => handleTotalInputChange(e, 'urine')} className="p-2 border-r border-gray-400 focus:outline-none w-full font-bold" />
            <input type="text" value={totals.stool} onChange={(e) => handleTotalInputChange(e, 'stool')} className="p-2 border-r border-gray-400 focus:outline-none w-full font-bold" />
            <input type="text" value={totals.aspiration} onChange={(e) => handleTotalInputChange(e, 'aspiration')} className="p-2 border-r border-gray-400 focus:outline-none w-full font-bold" />
            <input type="text" value={totals.insulin} onChange={(e) => handleTotalInputChange(e, 'insulin')} className="p-2 focus:outline-none w-full font-bold" />
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6 space-x-4 no-pdf">
        <PdfGenerator contentRef={formRef as React.RefObject<HTMLDivElement>} fileName="VitalSheet" />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSaving ? (<> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </>) : ("Save Vitals Sheet")}
        </button>
      </div>
    </div>
  );
};

export default VitalsSheet;