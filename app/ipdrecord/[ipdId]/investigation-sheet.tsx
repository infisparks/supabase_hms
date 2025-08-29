"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

interface InvestigationFormData {
  investigations: string[];
  investigations2: string[];
  microbiology: { date: string; site: string; organism: string; sensitivity: string }[];
  imaging: { date: string; organism: string }[];
  miscellaneous: { date: string; organism: string }[];
  fixedColumns: string[];
  investigationValues: { [key: string]: string[] };
}

const defaultFormData: InvestigationFormData = {
  investigations: Array(33).fill(''),
  investigations2: Array(15).fill(''),
  microbiology: Array(1).fill({ date: '', site: '', organism: '', sensitivity: '' }),
  imaging: Array(1).fill({ date: '', organism: '' }),
  miscellaneous: Array(1).fill({ date: '', organism: '' }),
  fixedColumns: Array(4).fill(''),
  investigationValues: {
    'HB': Array(4).fill(''), 'WBC': Array(4).fill(''), 'PLATELET': Array(4).fill(''), 'CRP': Array(4).fill(''),
    'ESR': Array(4).fill(''), 'PT': Array(4).fill(''), 'PTT': Array(4).fill(''), 'INR': Array(4).fill(''),
    'S.CREATININE': Array(4).fill(''), 'FIBRINOGEN': Array(4).fill(''), 'FDP': Array(4).fill(''),
    'BILIRUBIN': Array(4).fill(''), 'SGOT': Array(4).fill(''), 'SGPT': Array(4).fill(''),
    'ALK.PHOSPHATE': Array(4).fill(''), 'TOTAL PROTEIN': Array(4).fill(''), 'ALBUMIN': Array(4).fill(''),
    'GLOBULIN': Array(4).fill(''), 'SODIUM': Array(4).fill(''), 'POTASSIUM': Array(4).fill(''),
    'CHLORIDE': Array(4).fill(''), 'BUN': Array(4).fill(''), 'BS': Array(4).fill(''),
    'PPBS': Array(4).fill(''), 'CALCIUM': Array(4).fill(''), 'PHOSPHORUS': Array(4).fill(''),
    'URIC ACID': Array(4).fill(''), 'LACTATE': Array(4).fill(''), 'MAGNESIUM': Array(4).fill(''),
    'CKMB': Array(4).fill(''), 'CPK': Array(4).fill(''), 'LDH': Array(4).fill(''),
    'CHOLESTEROL': Array(4).fill(''), 'TRIGLYCERIDE': Array(4).fill(''), 'LDL': Array(4).fill(''),
    'TROP T / TROP I': Array(4).fill(''), 'BNNP': Array(4).fill(''), 'HIV': Array(4).fill(''),
    'HBsAg': Array(4).fill(''), 'HCV': Array(4).fill(''), 'HU': Array(4).fill(''), 'PH': Array(4).fill(''),
    'PC02': Array(4).fill(''), 'PA02': Array(4).fill(''), 'Hco3': Array(4).fill(''),
    'SAT': Array(4).fill(''), 'MODE': Array(4).fill(''), 'TV': Array(4).fill(''), 'RR': Array(4).fill(''),
    'FI02': Array(4).fill(''), 'PEEP / EPAP': Array(4).fill(''), 'IPAD': Array(4).fill(''),
  }
};

const InvestigationSheetPage = ({ ipdId }: { ipdId: string }) => {
  const [formData, setFormData] = useState<InvestigationFormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const investigationItems = [
    'HB', 'WBC', 'PLATELET', 'CRP', 'ESR', 'PT', 'PTT', 'INR', 'S.CREATININE', 'FIBRINOGEN', 'FDP', 'BILIRUBIN', 'SGOT', 'SGPT', 'ALK.PHOSPHATE', 'TOTAL PROTEIN', 'ALBUMIN', 'GLOBULIN', 'SODIUM', 'POTASSIUM', 'CHLORIDE', 'BUN', 'BS', 'PPBS', 'CALCIUM', 'PHOSPHORUS', 'URIC ACID', 'LACTATE', 'MAGNESIUM', 'CKMB', 'CPK', 'LDH', 'CHOLESTEROL', 'TRIGLYCERIDE', 'LDL', 'TROP T / TROP I', 'BNNP', 'HIV', 'HBsAg', 'HCV', 'HU', 'PH', 'PC02', 'PA02', 'Hco3', 'SAT', 'MODE', 'TV', 'RR', 'FI02', 'PEEP / EPAP', 'IPAD'
  ];

  const fetchInvestigationData = async () => {
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
        .select('investigation_data')
        .eq('ipd_id', ipdId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.investigation_data) {
        const parsedData = JSON.parse(data.investigation_data);
        setFormData(parsedData);
        toast.success("Previous data loaded successfully.");
      } else {
        // If no data is found, reset to the default form data
        setFormData(defaultFormData);
      }
    } catch (error) {
      console.error("Failed to fetch investigation data:", error);
      toast.error("Failed to load previous data.");
    } finally {
      setIsLoading(false);
    }
  };

  // ... (rest of the functions like handleSave, handleDynamicInputChange, etc., remain unchanged)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("User not authenticated. Please log in to save.");
        setIsSaving(false);
        return;
      }
      const userId = session.user.id;
      const investigationData = JSON.stringify(formData);
      const { error } = await supabase
        .from('ipd_record')
        .upsert({
          ipd_id: ipdId,
          user_id: userId,
          investigation_data: investigationData,
        }, { onConflict: 'ipd_id,user_id' });
      if (error) {
        throw error;
      }
      toast.success("Investigation sheet saved successfully!");
    } catch (error) {
      console.error("Failed to save investigation data:", error);
      toast.error("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDynamicInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number, section: keyof InvestigationFormData, field?: string) => {
    const { value } = e.target;
    setFormData((prevData) => {
      const newSectionData = [...(prevData[section] as any[])];
      if (field) {
        newSectionData[index] = { ...newSectionData[index], [field]: value };
      } else {
        newSectionData[index] = value;
      }
      return {
        ...prevData,
        [section]: newSectionData,
      };
    });
  };

  const handleMainTableChange = (e: React.ChangeEvent<HTMLInputElement>, investigation: string, colIndex: number) => {
    const { value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      investigationValues: {
        ...prevData.investigationValues,
        [investigation]: prevData.investigationValues[investigation].map((item, index) =>
          index === colIndex ? value : item
        ),
      },
    }));
  };

  const addRow = (section: 'microbiology' | 'imaging' | 'miscellaneous') => {
    setFormData((prevData) => {
      const newSectionData = [...prevData[section]];
      let newRow = {};
      if (section === 'microbiology') {
        newRow = { date: '', site: '', organism: '', sensitivity: '' };
      } else if (section === 'imaging' || section === 'miscellaneous') {
        newRow = { date: '', organism: '' };
      }
      newSectionData.push(newRow as any);
      return {
        ...prevData,
        [section]: newSectionData,
      };
    });
  };

  const removeRow = (section: 'microbiology' | 'imaging' | 'miscellaneous', index: number) => {
    if (formData[section].length > 1) {
      setFormData((prevData) => {
        const newSectionData = [...prevData[section]];
        newSectionData.splice(index, 1);
        return {
          ...prevData,
          [section]: newSectionData,
        };
      });
    }
  };

  useEffect(() => {
    if (ipdId) {
      fetchInvestigationData();
    }
  }, [ipdId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading investigation sheet...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-inter">
      {/* ... (rest of the component JSX, which is now safe to render) */}
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-5xl mx-auto">
        <div className="flex justify-between items-center border-b-2 border-gray-400 pb-4 mb-4">
          <div className="flex items-center">
            <div className="flex flex-col text-sm items-center">
              <span className="font-bold text-lg">MEDFORD</span>
              <span className="text-sm">MULTI SPECIALITY HOSPITAL</span>
              <span className="text-xs">from Core to Care, Your Bridge to Healthcare</span>
            </div>
          </div>
          <div className="text-center font-bold text-2xl">
            INVESTIGATION SHEET
          </div>
          <div>
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-xs">
              LOGO
            </div>
          </div>
        </div>

        <div className="border border-gray-400 rounded-md overflow-hidden mb-6">
          <div className="grid grid-cols-[150px_repeat(4,minmax(0,1fr))]">
            <div className="bg-gray-200 text-center font-bold text-xs p-2 border-r border-gray-400">
              Investigation
            </div>
            {Array(4).fill('').map((_, index) => (
              <div key={index} className="bg-gray-200 text-center font-bold text-xs p-2 border-r border-gray-400">
                <input
                  type="text"
                  value={formData.fixedColumns[index]}
                  onChange={(e) => {
                    const newColumns = [...formData.fixedColumns];
                    newColumns[index] = e.target.value;
                    setFormData({ ...formData, fixedColumns: newColumns });
                  }}
                  className="w-full text-center bg-transparent focus:outline-none"
                  placeholder="Enter Date"
                />
              </div>
            ))}
          </div>
          {investigationItems.map((item, index) => (
            <div key={index} className="grid grid-cols-[150px_repeat(4,minmax(0,1fr))] border-t border-gray-400">
              <div className="p-2 border-r border-gray-400 bg-gray-50 text-xs font-bold">{item}</div>
              {Array(4).fill('').map((_, colIndex) => (
                <input
                  key={colIndex}
                  type="text"
                  value={formData.investigationValues[item]?.[colIndex] || ''}
                  onChange={(e) => handleMainTableChange(e, item, colIndex)}
                  className="p-2 border-r border-gray-400 focus:outline-none text-xs"
                />
              ))}
            </div>
          ))}
        </div>

        <div className="border border-gray-400 rounded-md overflow-hidden mb-6">
          <div className="font-bold text-center text-sm bg-gray-200 p-2 border-b border-gray-400">
            MICROBIOLOGY
          </div>
          <div className="flex justify-end p-2">
            <button onClick={() => addRow('microbiology')} className="bg-blue-500 text-white text-xs px-2 py-1 rounded-md mr-2 hover:bg-blue-600 transition-colors duration-200">
              + Row
            </button>
            <button onClick={() => removeRow('microbiology', formData.microbiology.length - 1)} className="bg-red-500 text-white text-xs px-2 py-1 rounded-md hover:bg-red-600 transition-colors duration-200">
              - Row
            </button>
          </div>
          <div className="grid grid-cols-4 font-bold text-center text-xs bg-gray-200">
            <div className="p-2 border-r border-gray-400">Date</div>
            <div className="p-2 border-r border-gray-400">Site</div>
            <div className="p-2 border-r border-gray-400">Organism</div>
            <div className="p-2">Sensitivity</div>
          </div>
          {formData.microbiology.map((row, index) => (
            <div key={index} className="grid grid-cols-4 text-center text-xs border-t border-gray-400">
              <input type="text" name="date" value={row.date} onChange={(e) => handleDynamicInputChange(e, index, 'microbiology', 'date')} className="p-2 border-r border-gray-400 focus:outline-none" />
              <input type="text" name="site" value={row.site} onChange={(e) => handleDynamicInputChange(e, index, 'microbiology', 'site')} className="p-2 border-r border-gray-400 focus:outline-none" />
              <input type="text" name="organism" value={row.organism} onChange={(e) => handleDynamicInputChange(e, index, 'microbiology', 'organism')} className="p-2 border-r border-gray-400 focus:outline-none" />
              <input type="text" name="sensitivity" value={row.sensitivity} onChange={(e) => handleDynamicInputChange(e, index, 'microbiology', 'sensitivity')} className="p-2 focus:outline-none" />
            </div>
          ))}
        </div>

        <div className="border border-gray-400 rounded-md overflow-hidden mb-6">
          <div className="font-bold text-center text-sm bg-gray-200 p-2 border-b border-gray-400">
            IMAGING
          </div>
          <div className="flex justify-end p-2">
            <button onClick={() => addRow('imaging')} className="bg-blue-500 text-white text-xs px-2 py-1 rounded-md mr-2 hover:bg-blue-600 transition-colors duration-200">
              + Row
            </button>
            <button onClick={() => removeRow('imaging', formData.imaging.length - 1)} className="bg-red-500 text-white text-xs px-2 py-1 rounded-md hover:bg-red-600 transition-colors duration-200">
              - Row
            </button>
          </div>
          <div className="grid grid-cols-2 font-bold text-center text-xs bg-gray-200">
            <div className="p-2 border-r border-gray-400">Date</div>
            <div className="p-2">Organism</div>
          </div>
          {formData.imaging.map((row, index) => (
            <div key={index} className="grid grid-cols-2 text-center text-xs border-t border-gray-400">
              <input type="text" name="date" value={row.date} onChange={(e) => handleDynamicInputChange(e, index, 'imaging', 'date')} className="p-2 border-r border-gray-400 focus:outline-none" />
              <input type="text" name="organism" value={row.organism} onChange={(e) => handleDynamicInputChange(e, index, 'imaging', 'organism')} className="p-2 focus:outline-none" />
            </div>
          ))}
        </div>

        <div className="border border-gray-400 rounded-md overflow-hidden mb-6">
          <div className="font-bold text-center text-sm bg-gray-200 p-2 border-b border-gray-400">
            MISCELLANEOUS
          </div>
          <div className="flex justify-end p-2">
            <button onClick={() => addRow('miscellaneous')} className="bg-blue-500 text-white text-xs px-2 py-1 rounded-md mr-2 hover:bg-blue-600 transition-colors duration-200">
              + Row
            </button>
            <button onClick={() => removeRow('miscellaneous', formData.miscellaneous.length - 1)} className="bg-red-500 text-white text-xs px-2 py-1 rounded-md hover:bg-red-600 transition-colors duration-200">
              - Row
            </button>
          </div>
          <div className="grid grid-cols-2 font-bold text-center text-xs bg-gray-200">
            <div className="p-2 border-r border-gray-400">Date</div>
            <div className="p-2">Organism</div>
          </div>
          {formData.miscellaneous.map((row, index) => (
            <div key={index} className="grid grid-cols-2 text-center text-xs border-t border-gray-400">
              <input type="text" name="date" value={row.date} onChange={(e) => handleDynamicInputChange(e, index, 'miscellaneous', 'date')} className="p-2 border-r border-gray-400 focus:outline-none" />
              <input type="text" name="organism" value={row.organism} onChange={(e) => handleDynamicInputChange(e, index, 'miscellaneous', 'organism')} className="p-2 focus:outline-none" />
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-colors duration-200 ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Investigation Sheet"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvestigationSheetPage;