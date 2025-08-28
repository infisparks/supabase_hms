// Filename: iv-infusion-sheet.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw, PlusCircle, MinusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// --- Type Definitions ---
interface IVInfusionRow {
  srNo: number;
  time: string;
  ivFluids: string;
  volume: string;
  drugsAdded: string;
  dose: string;
  infusionRate: string;
  drSign: string;
  start: string;
  end: string;
  given: string;
  checked: string;
}

// --- Helper Function to Create Initial State ---
const createInitialData = (count: number = 10): IVInfusionRow[] => {
  return Array.from({ length: count }, (_, i) => ({
    srNo: i + 1,
    time: '',
    ivFluids: '',
    volume: '',
    drugsAdded: '',
    dose: '',
    infusionRate: '',
    drSign: '',
    start: '',
    end: '',
    given: '',
    checked: '',
  }));
};

// --- Main IV Infusion Sheet Component ---
const IVInfusionSheet = ({ ipdId }: { ipdId: string }) => {
  const [statRows, setStatRows] = useState<IVInfusionRow[]>(createInitialData(11));
  const [orderRows, setOrderRows] = useState<IVInfusionRow[]>(createInitialData(15));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Data Fetching Function ---
  const fetchInfusionData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ipd_record')
        .select('iv_infusion_data')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.iv_infusion_data) {
        const { stat_rows, order_rows } = data.iv_infusion_data as { stat_rows: IVInfusionRow[], order_rows: IVInfusionRow[] };
        if (stat_rows) setStatRows(stat_rows);
        if (order_rows) setOrderRows(order_rows);
        toast.success("Previous IV Infusion data loaded.");
      }
    } catch (error) {
      console.error("Failed to fetch IV Infusion data:", error);
      toast.error("Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }, [ipdId]);

  useEffect(() => {
    if (ipdId) fetchInfusionData();
  }, [ipdId, fetchInfusionData]);

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
        iv_infusion_data: { stat_rows: statRows, order_rows: orderRows },
      }, { onConflict: 'ipd_id,user_id' });

      if (error) throw error;
      toast.success("IV Infusion sheet saved successfully!");
    } catch (error) {
      console.error("Failed to save IV Infusion data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Input Change Handler ---
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: keyof IVInfusionRow,
    table: 'stat' | 'order'
  ) => {
    const { value } = e.target;
    if (table === 'stat') {
      setStatRows(prevRows => prevRows.map((row, i) => i === index ? { ...row, [field]: value } : row));
    } else {
      setOrderRows(prevRows => prevRows.map((row, i) => i === index ? { ...row, [field]: value } : row));
    }
  };

  // --- Row Management Functions ---
  const addRow = (table: 'stat' | 'order') => {
    const newRow: IVInfusionRow = {
      srNo: (table === 'stat' ? statRows.length : orderRows.length) + 1,
      time: '', ivFluids: '', volume: '', drugsAdded: '', dose: '',
      infusionRate: '', drSign: '', start: '', end: '', given: '', checked: ''
    };
    if (table === 'stat') {
      setStatRows(prevRows => [...prevRows, newRow]);
    } else {
      setOrderRows(prevRows => [...prevRows, newRow]);
    }
  };

  const removeRow = (table: 'stat' | 'order') => {
    if (table === 'stat') {
      if (statRows.length > 1) setStatRows(prevRows => prevRows.slice(0, -1));
      else toast.info("At least one row is required.");
    } else {
      if (orderRows.length > 1) setOrderRows(prevRows => prevRows.slice(0, -1));
      else toast.info("At least one row is required.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading IV Infusion Sheet...</p>
      </div>
    );
  }
  
  // UPDATED: The table grid layout has been corrected for better alignment.
  const gridColumnsClass = "grid-cols-[40px_70px_1fr_60px_1fr_60px_1fr_80px_60px_60px_60px_60px]";

  const renderTable = (rows: IVInfusionRow[], tableType: 'stat' | 'order') => (
    <div className="border border-gray-400 rounded-md overflow-hidden mb-8">
      <h2 className="text-center font-bold text-lg p-2 bg-blue-100 uppercase">{`IV Infusion Therapy Stat ${tableType === 'order' ? 'Order' : ''}`}</h2>
      <div className={`grid ${gridColumnsClass} bg-gray-200 font-bold text-xs text-center`}>
        <div className="p-1 border-r border-b border-gray-400">Sr. No.</div>
        <div className="p-1 border-r border-b border-gray-400">Time</div>
        <div className="p-1 border-r border-b border-gray-400">IV Fluids</div>
        <div className="p-1 border-r border-b border-gray-400">Volume</div>
        <div className="p-1 border-r border-b border-gray-400">Drugs Added</div>
        <div className="p-1 border-r border-b border-gray-400">Dose</div>
        <div className="p-1 border-r border-b border-gray-400">Infusion Rate</div>
        <div className="p-1 border-r border-b border-gray-400">Dr. Sign</div>
        <div className="p-1 border-r border-b border-gray-400">Start</div>
        <div className="p-1 border-r border-b border-gray-400">End</div>
        <div className="p-1 border-r border-b border-gray-400">Given</div>
        <div className="p-1 border-b border-gray-400">Checked</div>
      </div>
      <div>
        {rows.map((row, index) => (
          <div key={index} className={`grid ${gridColumnsClass} text-xs text-center border-t border-gray-400`}>
            <div className="p-1 border-r border-gray-400 bg-gray-50">{row.srNo}</div>
            <input type="text" value={row.time} onChange={(e) => handleInputChange(e, index, 'time', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.ivFluids} onChange={(e) => handleInputChange(e, index, 'ivFluids', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.volume} onChange={(e) => handleInputChange(e, index, 'volume', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.drugsAdded} onChange={(e) => handleInputChange(e, index, 'drugsAdded', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.dose} onChange={(e) => handleInputChange(e, index, 'dose', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.infusionRate} onChange={(e) => handleInputChange(e, index, 'infusionRate', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.drSign} onChange={(e) => handleInputChange(e, index, 'drSign', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.start} onChange={(e) => handleInputChange(e, index, 'start', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.end} onChange={(e) => handleInputChange(e, index, 'end', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.given} onChange={(e) => handleInputChange(e, index, 'given', tableType)} className="p-1 border-r border-gray-400 focus:outline-none" />
            <input type="text" value={row.checked} onChange={(e) => handleInputChange(e, index, 'checked', tableType)} className="p-1 focus:outline-none" />
          </div>
        ))}
      </div>
      <div className="flex justify-start gap-2 p-2 bg-gray-100 border-t border-gray-400">
        <button onClick={() => addRow(tableType)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-white bg-blue-500 hover:bg-blue-600">
          <PlusCircle className="h-3 w-3" /> Add Row
        </button>
        <button onClick={() => removeRow(tableType)} disabled={rows.length <= 1} className="flex items-center gap-1 px-2 py-1 rounded-lg text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-400">
          <MinusCircle className="h-3 w-3" /> Remove Row
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-full mx-auto font-sans text-xs">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">IV Infusion Therapy Sheet</h1>
        <p className="text-sm text-gray-500">
          <span className="font-semibold">Medford Multi Speciality Hospital</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {renderTable(statRows, 'stat')}
          {renderTable(orderRows, 'order')}
        </div>
        <div className="md:col-span-1 border border-gray-400 rounded-md p-4 bg-gray-50">
          <h3 className="font-bold text-center mb-4 text-sm">GUIDELINES FOR MONITORING POST ADMINISTRATION SIDE EFFECTS</h3>
          <ul className="space-y-4">
            <li>
              <span className="font-semibold">CONCENTRATED POTASSIUM CHLORIDE INFUSIONS</span><br/>
              <span className="text-gray-600">SIDE EFFECTS: PARASTHESIA OF EXTREMITIES, AREFLEXIA, ECG CHANGES (TALL T WAVES), FLACCID PARALYSIS, RESPIRATORY PARALYSIS, DIFFICULTY IN CARDIAC ARRHYTHMIAS, CARDIAC ARREST</span>
            </li>
            <li>
              <span className="font-semibold">NARCOTICS</span><br/>
              <span className="text-gray-600">SIDE EFFECTS: MARKED SEDATION, DROWSINESS, VERTIGO, VOMITING, RESPIRATORY DEPRESSION, APNEA, ALTERED SENSORIUM</span>
            </li>
            <li><span className="font-semibold">ANTIBIOTICS</span><br/><span className="text-gray-600">EPIGASTRIC DISCOMFORT, DIARRHEA, JAUNDICE, CHOLESTASIS, PSEUDOMEMBRANOUS COLITIS</span></li>
            <li><span className="font-semibold">OXYGEN</span><br/><span className="text-gray-600">SORE THROAT, COUGHING, VOMITING</span></li>
            <li><span className="font-semibold">FLOMISTINE</span><br/><span className="text-gray-600">RUNNY STUFFY NOSE, SORE THROAT, VOMITING, NOSE BLEED</span></li>
          </ul>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6">
        <div className="flex gap-2">
          {/* Add/Remove buttons for each table are inside the renderTable function */}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSaving ? ( <> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </> ) : ( "Save All Infusion Data" )}
        </button>
      </div>
      
      {/* Footer Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 text-sm">
        <div className="border-t border-gray-400 pt-2 text-center">Line Care / ET Care:</div>
        <div className="border-t border-gray-400 pt-2 text-center">Non Drug Orders:</div>
        <div className="border-t border-gray-400 pt-2 text-center">Investigation:</div>
        <div className="border-t border-gray-400 pt-2 text-center">Reference:</div>
      </div>
    </div>
  );
};

export default IVInfusionSheet;