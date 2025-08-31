// "use client";

// import React, { useState, useEffect, useCallback } from 'react';
// // import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
// import { toast } from 'sonner';
// import { RefreshCw } from 'lucide-react';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
// // const supabase = createClient(supabaseUrl, supabaseAnonKey);

// // --- Type Definitions ---
// interface DischargeFormData {
//   ipdId: string;
//   patientName: string;
//   dama_statement: string; // The text stating they are leaving against advice
//   specificRisks: string;
//   signaturePatient: string;
//   nameSignatoryPatient: string;
//   relationshipPatient: string;
//   datePatient: string;
//   timePatient: string;
//   addressSignatoryPatient: string;
//   signatureWitness: string;
//   nameSignatoryWitness: string;
//   relationshipWitness: string;
//   dateWitness: string;
//   timeWitness: string;
//   addressSignatoryWitness: string;
// }

// // --- Main Discharge Form Component ---
// const DischargeForm = ({ ipdId }: { ipdId: string }) => {
//   const [formData, setFormData] = useState<Partial<DischargeFormData>>({
//     ipdId: ipdId,
//     patientName: '',
//     dama_statement: 'Being about to leave from Medford Multi Speciality Hospital, I, ',
//     specificRisks: '',
//     signaturePatient: '',
//     nameSignatoryPatient: '',
//     relationshipPatient: '',
//     datePatient: '',
//     timePatient: '',
//     addressSignatoryPatient: '',
//     signatureWitness: '',
//     nameSignatoryWitness: '',
//     relationshipWitness: '',
//     dateWitness: '',
//     timeWitness: '',
//     addressSignatoryWitness: '',
//   });
//   const [isLoading, setIsLoading] = useState(true);
//   const [isSaving, setIsSaving] = useState(false);
//   const [verifyingSignature, setVerifyingSignature] = useState<string | null>(null);

//   // --- Data Fetching Function (Patient Details & existing form data) ---
//   const fetchFormData = useCallback(async () => {
//     setIsLoading(true);
//     try {
//       // Fetch existing form data
//       const { data: existingData, error: formDataError } = await supabase
//         .from('discharge_forms')
//         .select('*')
//         .eq('ipdId', ipdId)
//         .single();
      
//       if (formDataError && formDataError.code !== 'PGRST116') throw formDataError;
      
//       setFormData(prev => ({
//         ...prev,
//         ...existingData
//       }));

//       toast.success("Form data loaded.");
//     } catch (error) {
//       console.error("Failed to fetch data:", error);
//       toast.error("Failed to load form data.");
//     } finally {
//       setIsLoading(false);
//     }
//   }, [ipdId]);

//   useEffect(() => {
//     if (ipdId) fetchFormData();
//   }, [ipdId, fetchFormData]);

//   // --- Signature Verification Function ---
//   const checkAndSetSignature = useCallback(async (password: string, field: 'signaturePatient' | 'signatureWitness') => {
//     if (password.length !== 10) return;
//     setVerifyingSignature(field);
//     try {
//       const { data, error } = await supabase
//         .from('signature')
//         .select('signature_url')
//         .eq('password', password)
//         .single();
      
//       if (error && error.code !== 'PGRST116') throw error;

//       if (data?.signature_url) {
//         setFormData(prev => ({ ...prev, [field]: data.signature_url }));
//         toast.success(`Signature verified.`);
//       } else {
//         toast.error(`Invalid signature PIN.`);
//       }
//     } catch (error) {
//       console.error("Error verifying signature:", error);
//       toast.error("Could not verify signature.");
//     } finally {
//         setVerifyingSignature(null);
//     }
//   }, []);
  
//   // --- Input Change Handler ---
//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({ ...prev, [name]: value }));
    
//     // Check for signature PIN
//     if (name === 'signaturePatient' || name === 'signatureWitness') {
//       if (value.length === 10) {
//         checkAndSetSignature(value, name);
//       }
//     }
//   };
  
//   // --- Reset Signature with Confirmation ---
//   const handleSignatureReset = (field: 'signaturePatient' | 'signatureWitness') => {
//     if (window.confirm("Are you sure you want to remove this signature?")) {
//       setFormData(prev => ({ ...prev, [field]: '' }));
//       toast.info("Signature has been cleared.");
//     }
//   };

//   // --- Data Saving Function ---
//   const handleSave = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setIsSaving(true);
//     try {
//       const { data: { session } } = await supabase.auth.getSession();
//       if (!session) {
//         toast.error("User not authenticated.");
//         setIsSaving(false);
//         return;
//       }
      
//       // Clear any unsaved PINs before saving
//       const dataToSave = { ...formData };
//       if (dataToSave.signaturePatient && dataToSave.signaturePatient.length === 10) { dataToSave.signaturePatient = ''; }
//       if (dataToSave.signatureWitness && dataToSave.signatureWitness.length === 10) { dataToSave.signatureWitness = ''; }
      
//       const { error } = await supabase.from('discharge_forms').upsert({
//           ...dataToSave,
//           ipdId: ipdId,
//           user_id: session.user.id,
//       }, { onConflict: 'ipdId,user_id' });

//       if (error) throw error;
//       toast.success("Discharge form saved successfully!");
//     } catch (error) {
//       console.error("Failed to save form data:", error);
//       toast.error("Failed to save data.");
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
//         <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
//         <p className="ml-4 text-xl text-gray-600">Loading Discharge Form...</p>
//       </div>
//     );
//   }

//   return (
//     <form onSubmit={handleSave} className="bg-white p-8 rounded-lg shadow-xl max-w-4xl mx-auto font-sans text-sm">
//       <div className="flex justify-between items-start mb-6 border-b pb-4 border-gray-300">
//         <div>
//           <h1 className="font-bold text-lg">MEDFORD</h1>
//           <p className="font-bold text-lg">MULTI SPECIALITY HOSPITAL</p>
//           <p className="text-xs mt-1">1st Floor, Noori Blue Bells, Nr. Bypass Y-Junction, Kausa-Mumbra, Thane - 400 612.</p>
//         </div>
//         <div className="text-right text-xs">
//           <p>Appointment : 9769 0000 91</p>
//           <p>Emergency : 9769 0000 92</p>
//           <p>Pathology : 9769 0000 93</p>
//         </div>
//       </div>

//       <div className="text-center mb-6">
//         <h2 className="font-bold text-xl uppercase">Discharge Against Medical Advice</h2>
//       </div>

//       <div className="space-y-4">
//         <p className="leading-relaxed">
//           {formData.dama_statement}
//           <input
//             type="text"
//             name="patientName"
//             value={formData.patientName || ''}
//             onChange={handleInputChange}
//             className="font-bold border-b border-gray-400 mx-1 w-40 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
//             placeholder="[Patient Name]"
//           />
//           acknowledge that this action in against advice of the attending physician(s) and/or hospital authorities.
//         </p>

//         <div className="space-y-2">
//           <div className="flex items-center gap-2">
//             <span className="font-bold">1.</span>
//             <p className="flex-1">I have been informed about the possible dangers to my health that may result from his / her leaving the hospital at this time, including
//             </p>
//           </div>
//           <input
//             type="text"
//             name="specificRisks"
//             value={formData.specificRisks || ''}
//             onChange={handleInputChange}
//             placeholder="(Name specific risks) i.e."
//             className="w-full border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 pb-1"
//           />
//         </div>

//         <p className="leading-relaxed">
//           it has been explained to me in my own language which I understand best.
//         </p>
        
//         <div className="flex items-center gap-2">
//           <span className="font-bold">2.</span>
//           <p className="flex-1">I understand the risk and accept the consequences on my/the patient’s departure from <span className="font-bold">Medford Multi Speciality Hospital</span> and hereby release all healthcare providers, including the hospital and its staff from any liability that may arise due to discontinuation of treatment.</p>
//         </div>

//         {/* Patient Signature Section */}
//         <div className="mt-8 grid grid-cols-2 gap-x-12 gap-y-4">
//           <div className="col-span-2">
//             <label className="block font-bold mb-1">Signature of Patient OR Authorised Person :</label>
//             <div className="border-b border-gray-400 w-full flex items-center justify-center min-h-[40px]">
//               {verifyingSignature === 'signaturePatient' ? (
//                 <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
//               ) : formData.signaturePatient?.startsWith('http') ? (
//                 <img 
//                   src={formData.signaturePatient} 
//                   alt="Patient Signature" 
//                   title="Click to remove signature"
//                   className="h-12 object-contain cursor-pointer p-1 hover:opacity-75"
//                   onClick={() => handleSignatureReset('signaturePatient')}
//                 />
//               ) : (
//                 <input
//                   type="password"
//                   name="signaturePatient"
//                   value={formData.signaturePatient || ''}
//                   onChange={handleInputChange}
//                   className="w-full text-center focus:outline-none p-2"
//                   maxLength={10}
//                   placeholder="Enter PIN to sign"
//                   autoComplete="new-password"
//                 />
//               )}
//             </div>
//           </div>
//           <div>
//             <label className="block font-bold mb-1">Name of Signatory :</label>
//             <input type="text" name="nameSignatoryPatient" value={formData.nameSignatoryPatient || ''} onChange={handleInputChange} className="w-full border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
//           </div>
//           <div>
//             <label className="block font-bold mb-1">Relationship (If signed by other than patient):</label>
//             <input type="text" name="relationshipPatient" value={formData.relationshipPatient || ''} onChange={handleInputChange} className="w-full border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
//           </div>
//           <div className="flex items-center gap-4">
//             <label className="block font-bold">Date :</label>
//             <input type="date" name="datePatient" value={formData.datePatient || ''} onChange={handleInputChange} className="border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1" />
//           </div>
//           <div className="flex items-center gap-4">
//             <label className="block font-bold">Time :</label>
//             <input type="time" name="timePatient" value={formData.timePatient || ''} onChange={handleInputChange} className="border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1" />
//           </div>
//           <div className="col-span-2">
//             <label className="block font-bold mb-1">Address of Signatory :</label>
//             <input type="text" name="addressSignatoryPatient" value={formData.addressSignatoryPatient || ''} onChange={handleInputChange} className="w-full border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
//           </div>
//         </div>

//         {/* Witness Signature Section */}
//         <div className="mt-12 space-y-4">
//           <h3 className="font-bold text-lg uppercase border-t pt-4">Witness</h3>
//           <div className="col-span-2">
//             <label className="block font-bold mb-1">Signature of witnessed Person :</label>
//             <div className="border-b border-gray-400 w-full flex items-center justify-center min-h-[40px]">
//               {verifyingSignature === 'signatureWitness' ? (
//                 <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
//               ) : formData.signatureWitness?.startsWith('http') ? (
//                 <img 
//                   src={formData.signatureWitness} 
//                   alt="Witness Signature" 
//                   title="Click to remove signature"
//                   className="h-12 object-contain cursor-pointer p-1 hover:opacity-75"
//                   onClick={() => handleSignatureReset('signatureWitness')}
//                 />
//               ) : (
//                 <input
//                   type="password"
//                   name="signatureWitness"
//                   value={formData.signatureWitness || ''}
//                   onChange={handleInputChange}
//                   className="w-full text-center focus:outline-none p-2"
//                   maxLength={10}
//                   placeholder="Enter PIN to sign"
//                   autoComplete="new-password"
//                 />
//               )}
//             </div>
//           </div>
//           <div className="grid grid-cols-2 gap-x-12 gap-y-4">
//             <div>
//               <label className="block font-bold mb-1">Name of Signatory :</label>
//               <input type="text" name="nameSignatoryWitness" value={formData.nameSignatoryWitness || ''} onChange={handleInputChange} className="w-full border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
//             </div>
//             <div>
//               <label className="block font-bold mb-1">Relationship with the patient :</label>
//               <input type="text" name="relationshipWitness" value={formData.relationshipWitness || ''} onChange={handleInputChange} className="w-full border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
//             </div>
//             <div className="flex items-center gap-4">
//               <label className="block font-bold">Date :</label>
//               <input type="date" name="dateWitness" value={formData.dateWitness || ''} onChange={handleInputChange} className="border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1" />
//             </div>
//             <div className="flex items-center gap-4">
//               <label className="block font-bold">Time :</label>
//               <input type="time" name="timeWitness" value={formData.timeWitness || ''} onChange={handleInputChange} className="border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1" />
//             </div>
//             <div className="col-span-2">
//               <label className="block font-bold mb-1">Address of Signatory :</label>
//               <input type="text" name="addressSignatoryWitness" value={formData.addressSignatoryWitness || ''} onChange={handleInputChange} className="w-full border-b border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="flex justify-end mt-8">
//         <button
//           type="submit"
//           disabled={isSaving}
//           className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
//         >
//           {isSaving ? ( <> <RefreshCw className="h-4 w-4 animate-spin" /> Saving... </> ) : ( "Save Discharge Form" )}
//         </button>
//       </div>
//     </form>
//   );
// };

// export default DischargeForm;
