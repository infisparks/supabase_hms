// Filename: drug-chart.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw, PlusCircle, MinusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// --- Type Definitions ---
interface DrugChartRow {
  srNo: number;
  duration: string;
  dosage: string;
  drugName: string;
  route: string;
  frequency: string;
  instructions: string;
  stat: string;
  hourly: Record<string, string>; // Maps time (e.g., '12am') to a value
  remarks: string;
}

// --- Helper Function to Create Initial State ---
const createInitialData = (count: number = 26): DrugChartRow[] => {
  const hourlyTimes = ['12am', '2am', '4am', '6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm'];
  const initialHourly = hourlyTimes.reduce((acc, time) => ({ ...acc, [time]: '' }), {});
  return Array.from({ length: count }, (_, i) => ({
    srNo: i + 1,
    duration: '',
    dosage: '',
    drugName: '',
    route: '',
    frequency: '',
    instructions: '',
    stat: '',
    hourly: { ...initialHourly },
    remarks: ''
  }));
};

// --- Main Drug Chart Component ---
const DrugChartSheet = ({ ipdId }: { ipdId: string }) => {
  const [rows, setRows] = useState<DrugChartRow[]>(createInitialData());
  const [headerInfo, setHeaderInfo] = useState({
    allergy: '',
    diagnosis: '',
    bloodProduct: '',
    nutrition: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Data Fetching Function ---
  const fetchDrugChartData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('drug_chart_data, drug_chart_header')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        if (data.drug_chart_data) {
          setRows(data.drug_chart_data as DrugChartRow[]);
        }
        if (data.drug_chart_header) {
          setHeaderInfo(data.drug_chart_header);
        }
        toast.success("Previous drug chart data loaded.");
      }
    } catch (error) {
      console.error("Failed to fetch drug chart data:", error);
      toast.error("Failed to load drug chart data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);
  
  // --- Authentication and Data Fetching Effect ---
  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && ipdId) {
        fetchDrugChartData();
      } else {
        setIsLoading(false);
        toast.error("User not authenticated. Please log in.");
      }
    };
    
    checkAuthAndFetch();
  }, [ipdId, fetchDrugChartData]);

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
        drug_chart_data: rows,
        drug_chart_header: headerInfo,
      }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("Drug chart saved successfully!");
    } catch (error) {
      console.error("Failed to save drug chart data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Input Change Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number, field: keyof DrugChartRow) => {
    const { value } = e.target;
    setRows(prevRows =>
      prevRows.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    );
  };

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof headerInfo) => {
    const { value } = e.target;
    setHeaderInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleHourlyChange = (e: React.ChangeEvent<HTMLInputElement>, index: number, time: string) => {
    const { value } = e.target;
    setRows(prevRows =>
      prevRows.map((row, i) =>
        i === index ? { ...row, hourly: { ...row.hourly, [time]: value } } : row
      )
    );
  };

  // --- Row Management Functions ---
  const addRow = () => {
    const hourlyTimes = ['12am', '2am', '4am', '6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm'];
    const newHourly = hourlyTimes.reduce((acc, time) => ({ ...acc, [time]: '' }), {});
    const newRow: DrugChartRow = {
      srNo: rows.length + 1,
      duration: '',
      dosage: '',
      drugName: '',
      route: '',
      frequency: '',
      instructions: '',
      stat: '',
      hourly: newHourly,
      remarks: ''
    };
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
        <p className="ml-4 text-xl text-gray-600">Loading Drug Chart...</p>
      </div>
    );
  }

  const hourlyTimes = ['12 am', '2 am', '4 am', '6 am', '8 am', '10 am', '12 pm', '2 pm', '4 pm', '6 pm', '8 pm', '10 pm'];
  const gridColumnsClass = `grid-cols-[40px_60px_60px_1fr_60px_60px_1fr_60px_repeat(12,40px)_1fr]`;

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-full mx-auto font-sans text-xs">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">Daily Drug Chart</h1>
        <p className="text-sm text-gray-500">
          <span className="font-semibold">Medford Multi Speciality Hospital</span>
        </p>
      </div>
      
      {/* Header Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="flex items-center">
          <label className="font-semibold mr-2 w-1/3">Allergy & Diagnosis:</label>
          <input type="text" value={headerInfo.allergy} onChange={(e) => handleHeaderChange(e, 'allergy')} className="flex-grow p-1 border-b border-gray-400 focus:outline-none" />
        </div>
        <div className="flex items-center">
          <label className="font-semibold mr-2 w-1/3">Blood Product:</label>
          <input type="text" value={headerInfo.bloodProduct} onChange={(e) => handleHeaderChange(e, 'bloodProduct')} className="flex-grow p-1 border-b border-gray-400 focus:outline-none" />
        </div>
        <div className="flex items-center">
          <label className="font-semibold mr-2 w-1/3">Nutrition:</label>
          <input type="text" value={headerInfo.nutrition} onChange={(e) => handleHeaderChange(e, 'nutrition')} className="flex-grow p-1 border-b border-gray-400 focus:outline-none" />
        </div>
      </div>
      
      {/* Table Header */}
      <div className="border border-gray-400 rounded-md overflow-hidden">
        <div className={`grid ${gridColumnsClass} bg-gray-200 font-bold text-center`}>
          <div className="p-1 border-r border-b border-gray-400">Sr. No.</div>
          <div className="p-1 border-r border-b border-gray-400">Duration</div>
          <div className="p-1 border-r border-b border-gray-400">Dosage</div>
          <div className="p-1 border-r border-b border-gray-400">Name of The Drug</div>
          <div className="p-1 border-r border-b border-gray-400">Route</div>
          <div className="p-1 border-r border-b border-gray-400">Frequency</div>
          <div className="p-1 border-r border-b border-gray-400">Special Instructions</div>
          <div className="p-1 border-r border-b border-gray-400">Stat</div>
          {hourlyTimes.map(time => (
            <div key={time} className="p-1 border-r border-b border-gray-400">{time}</div>
          ))}
          <div className="p-1 border-b border-gray-400">Remarks</div>
        </div>

        {/* Table Body */}
        <div>
          {rows.map((row, index) => (
            <div key={index} className={`grid ${gridColumnsClass} text-xs text-center border-t border-gray-400`}>
              <div className="p-1 border-r border-gray-400 bg-gray-50">{row.srNo}</div>
              <input type="text" value={row.duration} onChange={(e) => handleInputChange(e, index, 'duration')} className="p-1 border-r border-gray-400 focus:outline-none" />
              <input type="text" value={row.dosage} onChange={(e) => handleInputChange(e, index, 'dosage')} className="p-1 border-r border-gray-400 focus:outline-none" />
              <input type="text" value={row.drugName} onChange={(e) => handleInputChange(e, index, 'drugName')} className="p-1 border-r border-gray-400 focus:outline-none" />
              <input type="text" value={row.route} onChange={(e) => handleInputChange(e, index, 'route')} className="p-1 border-r border-gray-400 focus:outline-none" />
              <input type="text" value={row.frequency} onChange={(e) => handleInputChange(e, index, 'frequency')} className="p-1 border-r border-gray-400 focus:outline-none" />
              <input type="text" value={row.instructions} onChange={(e) => handleInputChange(e, index, 'instructions')} className="p-1 border-r border-gray-400 focus:outline-none" />
              <input type="text" value={row.stat} onChange={(e) => handleInputChange(e, index, 'stat')} className="p-1 border-r border-gray-400 focus:outline-none" />
              {hourlyTimes.map(time => (
                <input
                  key={time}
                  type="text"
                  value={row.hourly[time.replace(/\s/g, '')] || ''}
                  onChange={(e) => handleHourlyChange(e, index, time.replace(/\s/g, ''))}
                  className="p-1 border-r border-gray-400 focus:outline-none"
                />
              ))}
              <input type="text" value={row.remarks} onChange={(e) => handleInputChange(e, index, 'remarks')} className="p-1 focus:outline-none" />
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
          {isSaving ? ( <> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </> ) : ( "Save Drug Chart" )}
        </button>
      </div>

      {/* Static Footer Section */}
      <Card className="mt-8 bg-gray-50 shadow-sm border-gray-300">
        <CardHeader className="p-4 border-b border-gray-300">
          <h3 className="font-semibold text-sm">Medication Administration Timings</h3>
        </CardHeader>
        <CardContent className="p-4 text-xs space-y-1 text-gray-600">
          <p>12 Hourly- 10 am / 10 pm &nbsp;&nbsp;&nbsp;&nbsp; 4 Hourly- 6 am / 10 am / 2 pm / 6 pm / 10 pm / 2 am</p>
          <p>6 Hourly- 4 am / 10 am / 4 pm / 10 pm &nbsp;&nbsp;&nbsp;&nbsp; Once a day- 10 am or 2 pm or 6 pm or as per timings prescribed the doctor</p>
          <p>8 Hourly- 6 am / 2 pm / 10 pm</p>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-8 text-sm">
        <div className="border-t border-gray-400 pt-2 text-center">Chart Filled By:</div>
        <div className="border-t border-gray-400 pt-2 text-center">Chart Audited By:</div>
        <div className="border-t border-gray-400 pt-2 text-center">Consultant Sign:</div>
      </div>

    </div>
  );
};

export default DrugChartSheet;