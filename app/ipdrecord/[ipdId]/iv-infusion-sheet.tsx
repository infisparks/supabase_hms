"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw, PlusCircle, MinusCircle } from 'lucide-react';
import PatientDetailsHeader from "./PatientDetailsHeader";
import PdfGenerator from "./PdfGenerator"; // Import PdfGenerator

// --- Type Definitions ---
interface IVInfusionRow {
  srNo: number;
  time: string;
  ivFluids: string;
  volume: string;
  drugsAdded: string;
  dose: string;
  infusionRate: string;
  drSign: string;     // Will hold PIN or signature URL
  start: string;
  end: string;
  given: string;      // Will hold PIN or signature URL
  checked: string;    // Will hold PIN or signature URL
}

// New interface for the footer data
interface IVInfusionFooterData {
  lineCare: string;
  nonDrugOrders: string;
  investigation: string;
  reference: string;
}

// Update the main data interface to include the footer data
interface IVInfusionData {
  stat_rows: IVInfusionRow[];
  order_rows: IVInfusionRow[];
  footer?: IVInfusionFooterData;
}

type SignatureField = 'drSign' | 'given' | 'checked';

// --- Helper Function to Create Initial State ---
const createInitialData = (count: number = 4): IVInfusionRow[] => {
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

const initialFooterData: IVInfusionFooterData = {
  lineCare: '',
  nonDrugOrders: '',
  investigation: '',
  reference: '',
};

// --- Main IV Infusion Sheet Component ---
const IVInfusionSheet = ({ ipdId }: { ipdId: string }) => {
  const [statRows, setStatRows] = useState<IVInfusionRow[]>(createInitialData());
  const [orderRows, setOrderRows] = useState<IVInfusionRow[]>(createInitialData());
  const [footerData, setFooterData] = useState<IVInfusionFooterData>(initialFooterData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [verifyingSignature, setVerifyingSignature] = useState<{ table: 'stat' | 'order', index: number, field: SignatureField } | null>(null);
  const formRef = useRef<HTMLDivElement>(null); // Create the ref

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
        const parsedData = data.iv_infusion_data as IVInfusionData;
        if (parsedData.stat_rows) setStatRows(parsedData.stat_rows);
        if (parsedData.order_rows) setOrderRows(parsedData.order_rows);
        if (parsedData.footer) setFooterData(parsedData.footer);
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

  // --- Signature Verification ---
  const checkAndSetSignature = useCallback(async (password: string, index: number, field: SignatureField, table: 'stat' | 'order') => {
    if (password.length !== 10) return;
    setVerifyingSignature({ table, index, field });
    try {
      const { data, error } = await supabase.from('signature').select('signature_url').eq('password', password).single();
      if (error && error.code !== 'PGRST116') throw error;

      if (data?.signature_url) {
        const setRows = table === 'stat' ? setStatRows : setOrderRows;
        setRows(prevRows => prevRows.map((row, i) => i === index ? { ...row, [field]: data.signature_url } : row));
        toast.success(`Signature verified for row ${index + 1}.`);
      } else {
        toast.error(`Invalid PIN for row ${index + 1}.`);
      }
    } catch (error) {
      console.error("Error verifying signature:", error);
      toast.error("Could not verify signature.");
    } finally {
      setVerifyingSignature(null);
    }
  }, []);

  // --- Data Saving Function ---
  const handleSave = async () => {
    setIsSaving(true);
    const signatureFields: SignatureField[] = ['drSign', 'given', 'checked'];

    // Function to clean unsaved PINs from rows
    const cleanRows = (rows: IVInfusionRow[]) => {
      return rows.map(row => {
        const newRow = { ...row };
        signatureFields.forEach(field => {
          if (newRow[field] && newRow[field].length === 10 && !newRow[field].startsWith('http')) {
            newRow[field] = '';
          }
        });
        return newRow;
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated.");
        setIsSaving(false);
        return;
      }

      const dataToSave: IVInfusionData = {
        stat_rows: cleanRows(statRows),
        order_rows: cleanRows(orderRows),
        footer: footerData,
      };

      const { error } = await supabase.from('ipd_record').upsert({
        ipd_id: ipdId,
        user_id: session.user.id,
        iv_infusion_data: dataToSave,
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
    const setRows = table === 'stat' ? setStatRows : setOrderRows;
    const signatureFields: SignatureField[] = ['drSign', 'given', 'checked'];

    setRows(prevRows => prevRows.map((row, i) => i === index ? { ...row, [field]: value } : row));

    if (signatureFields.includes(field as SignatureField) && value.length === 10) {
      checkAndSetSignature(value, index, field as SignatureField, table);
    }
  };

  const handleSignatureReset = (index: number, field: SignatureField, table: 'stat' | 'order') => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
      const setRows = table === 'stat' ? setStatRows : setOrderRows;
      setRows(prevRows => prevRows.map((row, i) => i === index ? { ...row, [field]: '' } : row));
      toast.info(`Signature for row ${index + 1} has been cleared.`);
    }
  };

  const handleFooterChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof IVInfusionFooterData) => {
    const { value } = e.target;
    setFooterData(prev => ({ ...prev, [field]: value }));
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

  const gridColumnsClass = "grid-cols-[40px_70px_1fr_60px_1fr_60px_1fr_80px_60px_60px_60px_60px]";

  const renderSignatureCell = (row: IVInfusionRow, index: number, field: SignatureField, tableType: 'stat' | 'order') => {
    const signatureKey = `${tableType}-${index}-${field}`;
    const isVerifying = verifyingSignature?.table === tableType && verifyingSignature?.index === index && verifyingSignature?.field === field;
    const signatureUrl = row[field];

    return (
      <div className="flex items-center justify-center h-full">
        {isVerifying ? (
          <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
        ) : signatureUrl.startsWith('http') ? (
          <img
            src={signatureUrl}
            alt="Signature"
            title="Click to remove signature"
            className="h-6 object-contain cursor-pointer"
            onClick={() => handleSignatureReset(index, field, tableType)}
          />
        ) : (
          <input
            type="password"
            value={signatureUrl}
            onChange={(e) => handleInputChange(e, index, field, tableType)}
            className="p-1 focus:outline-none w-full h-full text-center bg-transparent"
            maxLength={10}
            placeholder="Enter PIN"
          />
        )}
      </div>
    );
  };

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
          <div key={index} className={`grid ${gridColumnsClass} text-xs text-center border-t border-gray-400 min-h-[30px]`}>
            <div className="p-1 border-r border-gray-400 bg-gray-50 flex items-center justify-center">{row.srNo}</div>
            <input type="text" value={row.time} onChange={(e) => handleInputChange(e, index, 'time', tableType)} className="p-1 border-r border-gray-400 focus:outline-none w-full" />
            <input type="text" value={row.ivFluids} onChange={(e) => handleInputChange(e, index, 'ivFluids', tableType)} className="p-1 border-r border-gray-400 focus:outline-none w-full" />
            <input type="text" value={row.volume} onChange={(e) => handleInputChange(e, index, 'volume', tableType)} className="p-1 border-r border-gray-400 focus:outline-none w-full" />
            <input type="text" value={row.drugsAdded} onChange={(e) => handleInputChange(e, index, 'drugsAdded', tableType)} className="p-1 border-r border-gray-400 focus:outline-none w-full" />
            <input type="text" value={row.dose} onChange={(e) => handleInputChange(e, index, 'dose', tableType)} className="p-1 border-r border-gray-400 focus:outline-none w-full" />
            <input type="text" value={row.infusionRate} onChange={(e) => handleInputChange(e, index, 'infusionRate', tableType)} className="p-1 border-r border-gray-400 focus:outline-none w-full" />
            <div className="border-r border-gray-400">{renderSignatureCell(row, index, 'drSign', tableType)}</div>
            <input type="text" value={row.start} onChange={(e) => handleInputChange(e, index, 'start', tableType)} className="p-1 border-r border-gray-400 focus:outline-none w-full" />
            <input type="text" value={row.end} onChange={(e) => handleInputChange(e, index, 'end', tableType)} className="p-1 border-r border-gray-400 focus:outline-none w-full" />
            <div className="border-r border-gray-400">{renderSignatureCell(row, index, 'given', tableType)}</div>
            <div>{renderSignatureCell(row, index, 'checked', tableType)}</div>
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
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-xl max-w-full mx-auto font-sans text-xs">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">IV Infusion Therapy Sheet</h1>
        <p className="text-sm text-gray-500">
          <span className="font-semibold">Medford Multi Speciality Hospital</span>
        </p>
      </div>

      <PatientDetailsHeader ipdId={ipdId} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {renderTable(statRows, 'stat')}
          {renderTable(orderRows, 'order')}
        </div>
        <div className="md:col-span-1 border border-gray-400 rounded-md p-4 bg-gray-50">
          <h3 className="font-bold text-center mb-4 text-sm">GUIDELINES FOR MONITORING POST ADMINISTRATION SIDE EFFECTS</h3>
          <ul className="space-y-4">
            <li>
              <span className="font-semibold">CONCENTRATED POTASSIUM CHLORIDE INFUSIONS</span><br />
              <span className="text-gray-600">SIDE EFFECTS: PARASTHESIA OF EXTREMITIES, AREFLEXIA, ECG CHANGES (TALL T WAVES), FLACCID PARALYSIS, RESPIRATORY PARALYSIS, DIFFICULTY IN CARDIAC ARRHYTHMIAS, CARDIAC ARREST</span>
            </li>
            <li>
              <span className="font-semibold">NARCOTICS</span><br />
              <span className="text-gray-600">SIDE EFFECTS: MARKED SEDATION, DROWSINESS, VERTIGO, VOMITING, RESPIRATORY DEPRESSION, APNEA, ALTERED SENSORIUM</span>
            </li>
            <li><span className="font-semibold">ANTIBIOTICS</span><br /><span className="text-gray-600">EPIGASTRIC DISCOMFORT, DIARRHEA, JAUNDICE, CHOLESTASIS, PSEUDOMEMBRANOUS COLITIS</span></li>
            <li><span className="font-semibold">OXYGEN</span><br /><span className="text-gray-600">SORE THROAT, COUGHING, VOMITING</span></li>
            <li><span className="font-semibold">FLOMISTINE</span><br /><span className="text-gray-600">RUNNY STUFFY NOSE, SORE THROAT, VOMITING, NOSE BLEED</span></li>
          </ul>
        </div>
      </div>

      <div className="flex justify-end items-center mt-6 space-x-4">
        <PdfGenerator contentRef={formRef as React.RefObject<HTMLDivElement>} fileName="IVInfusionSheet" />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold ${isSaving ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSaving ? (<> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </>) : ("Save All Infusion Data")}
        </button>
      </div>

      {/* Footer Section with editable fields */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 text-sm">
        <div className="flex flex-col items-center">
          <label className="font-semibold">Line Care / ET Care:</label>
          <input
            type="text"
            value={footerData.lineCare}
            onChange={(e) => handleFooterChange(e, 'lineCare')}
            className="w-full p-2 mt-2 border-t border-gray-400 focus:outline-none text-center bg-transparent"
          />
        </div>
        <div className="flex flex-col items-center">
          <label className="font-semibold">Non Drug Orders:</label>
          <input
            type="text"
            value={footerData.nonDrugOrders}
            onChange={(e) => handleFooterChange(e, 'nonDrugOrders')}
            className="w-full p-2 mt-2 border-t border-gray-400 focus:outline-none text-center bg-transparent"
          />
        </div>
        <div className="flex flex-col items-center">
          <label className="font-semibold">Investigation:</label>
          <input
            type="text"
            value={footerData.investigation}
            onChange={(e) => handleFooterChange(e, 'investigation')}
            className="w-full p-2 mt-2 border-t border-gray-400 focus:outline-none text-center bg-transparent"
          />
        </div>
        <div className="flex flex-col items-center">
          <label className="font-semibold">Reference:</label>
          <input
            type="text"
            value={footerData.reference}
            onChange={(e) => handleFooterChange(e, 'reference')}
            className="w-full p-2 mt-2 border-t border-gray-400 focus:outline-none text-center bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};

export default IVInfusionSheet;