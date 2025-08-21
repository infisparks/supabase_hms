"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Trash2,
  Mic,
  MicOff,
  RefreshCw,
  UserCheck,
  History,
  FileText,
  PlusCircle,
  Download,
  ArrowLeft,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { v4 as uuidv4 } from "uuid"; // Import for unique file names
import { User } from "@supabase/supabase-js"; // Import User type
import Layout from "@/components/global/Layout"; // Import Layout component

// --- Type Definitions ---
interface PatientDetail {
  patient_id: number;
  name: string;
  number: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  age_unit: string | null;
  uhid: string;
}

interface MedicineEntry {
  name: string;
  consumptionDays: string;
  times: { morning: boolean; evening: boolean; night: boolean };
  instruction: string;
}

interface PrescriptionData {
  symptoms: string;
  medicines: MedicineEntry[];
  overallInstruction: string;
  createdAt: string;
}

interface OPDPrescriptionRow {
  id: string; // UUID from Supabase
  opd_id: number; // Changed from bill_no to opd_id
  uhid: string;
  symptoms: string | null;
  medicines: MedicineEntry[] | null;
  overall_instruction: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface OPDRegistrationData {
  opd_id: number; // Changed from bill_no to opd_id
  uhid: string;
  patient_detail: PatientDetail;
}

interface PrescriptionFormInputs {
  symptoms: string;
  overallInstruction: string;
}

// Web Speech API interfaces (standard declarations)
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
// --- End Type Definitions ---

export default function OPDPrescriptionPage() {
  const { opd_id } = useParams<{ opd_id: string }>();
  const router = useRouter();

  // State for the current patient and their prescription
  const [patientData, setPatientData] = useState<PatientDetail | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<OPDPrescriptionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string>(""); // To display live transcript on top
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false); // New state for WhatsApp sending

  // States for prescription form details
  const [medicines, setMedicines] = useState<MedicineEntry[]>([
    { name: "", consumptionDays: "", times: { morning: false, evening: false, night: false }, instruction: "" },
  ]);
  const [showMedicineDetails, setShowMedicineDetails] = useState(false);

  // Previous history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalItems, setHistoryModalItems] = useState<OPDPrescriptionRow[]>([]);

  // Refs for PDF generation
  const prescriptionContentRef = useRef<HTMLDivElement>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const currentTranscriptRef = useRef<string>(""); // To store ongoing transcript for AI processing

  const { register, handleSubmit, reset, setValue, getValues } = useForm<PrescriptionFormInputs>({
    defaultValues: {
      symptoms: "",
      overallInstruction: "",
    },
  });

  // --- Data Fetching Logic ---
  const fetchPatientAndPrescriptionData = useCallback(async () => {
    if (!opd_id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const opdNum = Number(opd_id);

    try {
      // Fetch OPD registration and patient details by opd_id
      const { data: opdData, error: opdError } = await supabase
        .from("opd_registration")
        .select(
          `
          uhid,
          patient_detail:patient_detail!opd_registration_uhid_fkey (*)
        `
        )
        .eq("opd_id", opdNum)
        .single();

      if (opdError || !opdData) {
        toast.error("Failed to load patient data for this OPD ID.");
        console.error("Error fetching OPD registration:", opdError?.message);
        router.push("/opd/list/opdlistprescripitono"); // Redirect if patient not found
        return;
      }
      setPatientData(opdData.patient_detail as unknown as PatientDetail);

      // Fetch existing prescription for this opd_id
      const { data: prescriptionData, error: prescriptionError } = await supabase
        .from("opd_prescriptions")
        .select("*")
        .eq("opd_id", opdNum)
        .single();

      if (prescriptionError && prescriptionError.code !== "PGRST116") {
        console.error("Error fetching prescription:", prescriptionError.message);
        toast.error("Failed to load existing prescription.");
      } else if (prescriptionData) {
        setCurrentPrescription(prescriptionData as OPDPrescriptionRow);
        setValue("symptoms", prescriptionData.symptoms || "");
        setValue("overallInstruction", prescriptionData.overall_instruction || "");
        setMedicines(
          prescriptionData.medicines || [
            { name: "", consumptionDays: "", times: { morning: false, evening: false, night: false }, instruction: "" },
          ]
        );
        setShowMedicineDetails(prescriptionData.medicines && prescriptionData.medicines.length > 0);
      } else {
        setCurrentPrescription(null);
        reset(); // Clear form if no existing prescription
        setMedicines([{ name: "", consumptionDays: "", times: { morning: false, evening: false, night: false }, instruction: "" }]);
        setShowMedicineDetails(false);
      }
    } catch (error: any) {
      console.error("An unexpected error occurred during data fetch:", error.message);
      toast.error("An unexpected error occurred while loading data.");
      router.push("/opd/list/opdlistprescripitono"); // Redirect on unexpected error
    } finally {
      setIsLoading(false);
    }
  }, [opd_id, router, setValue, reset]);

  useEffect(() => {
    fetchPatientAndPrescriptionData();
  }, [fetchPatientAndPrescriptionData]);

  // --- Real-time Subscription (for current prescription) ---
  useEffect(() => {
    let channel: any;
    const opdNum = Number(opd_id);

    async function setupRealtimeChannel() {
      // First, get the primary key of the prescription row if it exists
      const { data } = await supabase.from("opd_prescriptions").select("id").eq("opd_id", opdNum).single();

      if (!data?.id) {
        return;
      }

      const prescriptionPkId = data.id;

      channel = supabase
        .channel(`opd_prescription_row_${prescriptionPkId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "opd_prescriptions",
            filter: `id=eq.${prescriptionPkId}`,
          },
          async (payload) => {
            console.log("Realtime change detected for prescription PK row:", payload);
            toast.info(`Database change detected for prescription: ${payload.eventType}`);
            await fetchPatientAndPrescriptionData(); // Re-fetch to update UI
          }
        )
        .subscribe();
    }

    if (opd_id) {
      setupRealtimeChannel();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [opd_id, fetchPatientAndPrescriptionData]);

  // --- Voice Input Functionality ---
  const handleVoiceInput = useCallback(
    async (text: string) => {
      setIsSubmitting(true);
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY; // Use environment variable for security
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const existingSymptoms = getValues("symptoms");
      // Combine existing symptoms with new voice input. Add a newline for separation.
      const combinedTextForAI = existingSymptoms ? `${existingSymptoms}\n${text}` : text;

      const prompt = `You are a medical assistant. Your task is to extract medical details from the given input and structure them into a JSON object. If the input is in Hindi or any other language, translate it to professional English first, then extract the details. The output must be ONLY the JSON object.

The JSON object should have these keys:
- \`symptoms\`: (string) A concise summary of symptoms or the diagnosed disease.
- \`overallInstruction\`: (string) General instructions for the patient.
- \`medicines\`: (array of objects) Each object represents a medicine entry with the following keys:
    - \`name\`: (string) Name of the medicine.
    - \`consumptionDays\`: (string) Number of days for consumption (e.g., "7 days", "until finished").
    - \`times\`: (object) An object indicating consumption times.
        - \`morning\`: (boolean) true if morning, false otherwise.
        - \`evening\`: (boolean) true if evening, false otherwise.
        - \`night\`: (boolean) true if night, false otherwise.
    - \`instruction\`: (string) Specific instruction for this medicine (e.g., "after food", "before sleep").

If a field is not mentioned in the input, use an empty string for text fields or an empty array for the medicines array, and false for boolean flags within 'times'.

Example input: "मरीज को बुखार है और सर्दी है। पेरासिटामोल 3 दिनों के लिए सुबह-शाम खाने के बाद लें। एंटीबायोटिक 5 दिनों के लिए रात में।"

Expected JSON output for the example:
\`\`\`json
{
  "symptoms": "Patient has fever and cold.",
  "overallInstruction": "",
  "medicines": [
    {
      "name": "Paracetamol",
      "consumptionDays": "3 days",
      "times": { "morning": true, "evening": true, "night": false },
      "instruction": "after food"
    },
    {
      "name": "Antibiotic",
      "consumptionDays": "5 days",
      "times": { "morning": false, "evening": false, "night": true },
      "instruction": ""
    }
  ]
}
\`\`\`

Now, process this input: "${combinedTextForAI}".
`;

      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      };

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonText) {
          toast.error("AI response did not contain valid JSON.");
          throw new Error("No JSON returned from AI API");
        }

        const structuredData: Partial<PrescriptionFormInputs & { medicines: MedicineEntry[] }> = JSON.parse(jsonText);

        // Update form fields
        if (structuredData.symptoms != null) setValue("symptoms", structuredData.symptoms);
        if (structuredData.overallInstruction != null) setValue("overallInstruction", structuredData.overallInstruction);
        if (structuredData.medicines && structuredData.medicines.length > 0) {
          setMedicines(structuredData.medicines);
          setShowMedicineDetails(true);
        }

        toast.success("Voice input processed successfully!");
      } catch (error) {
        console.error("Vertex AI request failed:", error);
        toast.error("Failed to process voice input. Please try manually.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [setValue, setMedicines, getValues]
  );

  const startListening = () => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast.error("Speech Recognition not supported in your browser.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop(); // Stop any existing recognition instance
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionAPI() as SpeechRecognition;
    recognitionRef.current = recognition;
    recognition.lang = "en-US"; // Keep English for recognition, AI prompt handles Hindi translation
    recognition.interimResults = true; // Enable interim results for live transcript
    recognition.continuous = true; // Set to true for continuous listening

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setLiveTranscript(interimTranscript || finalTranscript); // Show interim or final

      if (finalTranscript) {
        currentTranscriptRef.current += (currentTranscriptRef.current ? " " : "") + finalTranscript;
      }
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error, event.message);
      toast.error(`Speech recognition error: ${event.error}`);
      setIsListening(false);
      setLiveTranscript(""); // Clear live transcript on error
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      // When recognition ends (due to stop() or error), process the accumulated transcript
      if (currentTranscriptRef.current) {
        handleVoiceInput(currentTranscriptRef.current);
        currentTranscriptRef.current = ""; // Clear for next session
      }
      // If still supposed to be listening, restart recognition
      if (isListening) {
        console.log("Recognition ended unexpectedly, restarting...");
        startListening();
      } else {
        setIsListening(false);
        setLiveTranscript(""); // Clear live transcript when listening stops
        recognitionRef.current = null;
      }
    };

    recognition.start();
    setIsListening(true);
    currentTranscriptRef.current = ""; // Reset current transcript on start
    setLiveTranscript("Listening..."); // Initial message
    toast.info("Listening for your input...");
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // onend will be triggered which will then process the transcript
      toast.info("Stopped listening. Processing your input...");
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  // --- Medicine Details Functions ---
  const toggleMedicineDetails = () => {
    setShowMedicineDetails((prev) => !prev);
  };

  const addMedicine = () => {
    setMedicines([
      ...medicines,
      { name: "", consumptionDays: "", times: { morning: false, evening: false, night: false }, instruction: "" },
    ]);
  };

  const handleRemoveMedicine = (index: number) => {
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMedicineChange = (index: number, field: keyof MedicineEntry, value: any) => {
    setMedicines((prev) => prev.map((med, i) => (i === index ? { ...med, [field]: value } : med)));
  };

  const handleTimeToggle = (index: number, time: keyof MedicineEntry["times"]) => {
    setMedicines((prev) =>
      prev.map((med, i) => (i === index ? { ...med, times: { ...med.times, [time]: !med.times[time] } } : med))
    );
  };

  // --- Form Submission (Add/Update Prescription) ---
  const onSubmit: SubmitHandler<PrescriptionFormInputs> = async (formData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentUserEmail = user?.email || "unknown";

      const opdNum = Number(opd_id);
      const patientUHID = patientData?.uhid;
      if (!patientUHID) {
        toast.error("Patient UHID not found. Cannot save prescription.");
        return;
      }

      const prescriptionPayload: Partial<OPDPrescriptionRow> = {
        opd_id: opdNum,
        uhid: patientUHID,
        symptoms: formData.symptoms,
        medicines: showMedicineDetails ? medicines : [],
        overall_instruction: formData.overallInstruction,
        updated_at: new Date().toISOString(),
        updated_by: currentUserEmail,
      };

      let error;
      if (currentPrescription) {
        // Update existing prescription
        const { error: updateError } = await supabase
          .from("opd_prescriptions")
          .update(prescriptionPayload)
          .eq("id", currentPrescription.id);
        error = updateError;
      } else {
        // Insert new prescription
        const { error: insertError } = await supabase.from("opd_prescriptions").insert({
          ...prescriptionPayload,
          created_by: currentUserEmail,
          created_at: new Date().toISOString(),
        });
        error = insertError;
      }

      if (error) {
        console.error("Error saving prescription:", error.message);
        toast.error("Failed to save prescription. Please try again.");
      } else {
        toast.success("Prescription saved successfully!");
        // Re-fetch data to update UI and currentPrescription state
        await fetchPatientAndPrescriptionData();
      }
    } catch (error: any) {
      console.error("An unexpected error occurred during submission:", error.message);
      toast.error("An unexpected error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearPrescription = () => {
    reset();
    setMedicines([{ name: "", consumptionDays: "", times: { morning: false, evening: false, night: false }, instruction: "" }]);
    setShowMedicineDetails(false);
    toast.info("Prescription cleared.");
  };

  // --- PDF Generation ---
  const generatePDFBlob = useCallback(async (prescriptionToGenerate: OPDPrescriptionRow | null) => {
    const dataToUse = prescriptionToGenerate || currentPrescription;

    if (!prescriptionContentRef.current || !patientData || !dataToUse) return null;

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Set background image
    const letterheadImage = "/letterhead.png";
    const img = new Image();
    img.src = letterheadImage;
    await new Promise((resolve) => {
      img.onload = () => resolve(null);
      img.onerror = () => {
        console.error("Error loading letterhead image.");
        resolve(null); // Resolve even on error to not block PDF generation
      };
    });

    // Temporarily set the styles on the ref for accurate rendering
    const originalRefStyle = prescriptionContentRef.current.style.cssText;
    prescriptionContentRef.current.style.position = "static"; // Make visible for html2canvas
    prescriptionContentRef.current.style.left = "0";
    prescriptionContentRef.current.style.top = "0";
    prescriptionContentRef.current.style.background = `url(${letterheadImage}) no-repeat center top / contain`;
    prescriptionContentRef.current.style.color = "#000"; // Ensure text is black for PDF

    // Populate the hidden div with the relevant prescription data
    // This is crucial for html2canvas to render the correct history item
    const symptomsContent = dataToUse.symptoms || "N/A";
    const overallInstructionContent = dataToUse.overall_instruction || "N/A";
    const medicinesContent =
      dataToUse.medicines && dataToUse.medicines.length > 0
        ? dataToUse.medicines
            .map(
              (med, idx) => `
          <div style="display: flex; padding: 4px 0; border-bottom: 1px dashed #eee;">
            <div style="flex: 3; font-size: 10pt;">${med.name}</div>
            <div style="flex: 1; text-align: center; font-size: 10pt;">${med.consumptionDays}</div>
            <div style="flex: 2; text-align: center; font-size: 10pt;">
              ${(med.times.morning ? "Morning " : "") + (med.times.evening ? "Evening " : "") + (med.times.night ? "Night" : "")}
            </div>
            <div style="flex: 4; font-size: 10pt; white-space: pre-wrap; word-break: break-word;">${med.instruction}</div>
          </div>
        `
            )
            .join("")
        : '<p style="font-size: 10pt;">No medicines prescribed.</p>';

    // Update the content of the ref
    if (prescriptionContentRef.current) {
      prescriptionContentRef.current.innerHTML = `
       
        <div style="display: flex; justify-content: space-between; margin-bottom: 8mm; border-bottom: 1px solid #ccc; padding-bottom: 2mm;">
          <div style="width: 48%;">
            <p style="font-size: 11pt; margin: 2px 0;"><strong>Name:</strong> ${patientData.name}</p>
            <p style="font-size: 11pt; margin: 2px 0;"><strong>UHID:</strong> ${patientData.uhid}</p>
            <p style="font-size: 11pt; margin: 2px 0;"><strong>OPD ID:</strong> ${dataToUse.opd_id}</p>
          </div>
          <div style="width: 48%; text-align: right;">
            <p style="font-size: 11pt; margin: 2px 0;"><strong>Date:</strong> ${format(parseISO(dataToUse.created_at), "MMM dd, yyyy")}</p>
            <p style="font-size: 11pt; margin: 2px 0;"><strong>Age:</strong> ${patientData.age} ${patientData.age_unit || ""}</p>
            <p style="font-size: 11pt; margin: 2px 0;"><strong>Gender:</strong> ${patientData.gender}</p>
          </div>
        </div>
        <div style="margin-top: 5mm; margin-bottom: 8mm;">
          <h3 style="font-size: 13pt; margin-bottom: 3mm; border-bottom: 1px dashed #ccc; padding-bottom: 1mm;">Medicines</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 5mm;">
            <thead>
              <tr style="background-color: #f9f9f9;">
                <th style="border: none; border-bottom: 1px solid #eee; padding: 6px; text-align: left; font-size: 10pt; width: 30%;">Medicine Name</th>
                <th style="border: none; border-bottom: 1px solid #eee; padding: 6px; text-align: center; font-size: 10pt; width: 10%;">Days</th>
                <th style="border: none; border-bottom: 1px solid #eee; padding: 6px; text-align: center; font-size: 10pt; width: 20%;">Time</th>
                <th style="border: none; border-bottom: 1px solid #eee; padding: 6px; text-align: left; font-size: 10pt; width: 40%;">Instruction</th>
              </tr>
            </thead>
            <tbody>
              ${dataToUse.medicines && dataToUse.medicines.length > 0
                ? dataToUse.medicines
                    .map(
                      (med) => `
                  <tr>
                    <td style="border: none; border-bottom: 1px dashed #eee; padding: 6px; font-size: 10pt;">${med.name}</td>
                    <td style="border: none; border-bottom: 1px dashed #eee; padding: 6px; text-align: center; font-size: 10pt;">${med.consumptionDays}</td>
                    <td style="border: none; border-bottom: 1px dashed #eee; padding: 6px; text-align: center; font-size: 10pt;">
                      ${(med.times.morning ? "Morning " : "") + (med.times.evening ? "Evening " : "") + (med.times.night ? "Night" : "")}
                    </td>
                    <td style="border: none; border-bottom: 1px dashed #eee; padding: 6px; font-size: 10pt; white-space: pre-wrap; word-break: break-word;">${med.instruction}</td>
                  </tr>
                `
                    )
                    .join("")
                : `<tr><td colspan="4" style="border: none; border-bottom: 1px dashed #eee; padding: 6px; text-align: center; font-size: 10pt;">No medicines prescribed.</td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div style="margin-bottom: 8mm;">
          <h3 style="font-size: 13pt; margin-bottom: 3mm; border-bottom: 1px dashed #ccc; padding-bottom: 1mm;">Symptoms/Disease</h3>
          <p style="font-size: 11pt; margin: 2px 0;">${symptomsContent}</p>
        </div>
        <div style="margin-bottom: 8mm; margin-top: 8mm;">
          <h3 style="font-size: 13pt; margin-bottom: 3mm; border-bottom: 1px dashed #ccc; padding-bottom: 1mm;">Overall Instructions</h3>
          <p style="font-size: 11pt;">${overallInstructionContent}</p>
        </div>
      `;
    }

    const canvas = await html2canvas(prescriptionContentRef.current, { scale: 2 }); // Increased scale for better quality
    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

    // Restore original style to hidden div
    if (prescriptionContentRef.current) {
      prescriptionContentRef.current.style.cssText = originalRefStyle;
    }

    return pdf.output("blob");
  }, [patientData, currentPrescription]);

  const downloadPrescription = async () => {
    const pdfBlob = await generatePDFBlob(currentPrescription);
    if (!pdfBlob) {
      toast.error("Failed to generate PDF. Please ensure all data is loaded.");
      return;
    }
    const blobURL = URL.createObjectURL(pdfBlob);
    window.open(blobURL, "_blank"); // Open in new tab
    URL.revokeObjectURL(blobURL);
    toast.success("Prescription opened successfully!");
  };

  const uploadPdfAndSendWhatsApp = async () => {
    if (!currentPrescription || !patientData) {
      toast.error("Prescription data or patient data not loaded yet.");
      return;
    }
    if (!patientData.number) {
      toast.error("Patient phone number is not available to send WhatsApp.");
      return;
    }

    setIsSendingWhatsApp(true);
    let whatsappLink = "";

    try {
      const pdfBlob = await generatePDFBlob(currentPrescription);
      if (!pdfBlob) {
        toast.error("Failed to generate PDF for WhatsApp.");
        return;
      }

      const fileName = `prescription-${patientData.uhid}-${opd_id}-${uuidv4()}.pdf`;
      const filePath = `opd_prescriptions/${fileName}`; // Folder and filename in Supabase Storage

      // 1. Upload PDF to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("dpr-documents") // Your Supabase bucket name (create if not exists)
        .upload(filePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: false, // Do not overwrite if file exists with same name (though UUID should prevent this)
        });

      if (uploadError) {
        console.error("Error uploading PDF:", uploadError.message);
        toast.error(`Failed to upload PDF: ${uploadError.message}`);
        return;
      }

      // 2. Get public URL of the uploaded PDF
      const { data: publicUrlData } = supabase.storage
        .from("dpr-documents")
        .getPublicUrl(filePath);

      whatsappLink = publicUrlData.publicUrl;
      console.log("Public URL:", whatsappLink);

      if (!whatsappLink) {
        toast.error("Failed to get public URL for the PDF.");
        return;
      }

      // 3. Send WhatsApp message
      const rawNumber = String(patientData.number); // Ensure it's a string
      const formattedNumber = rawNumber.startsWith("91") ? rawNumber : `91${rawNumber}`;

      const payload = {
        token: "99583991573", // Replace with your actual WhatsApp API token
        number: formattedNumber,
        imageUrl: whatsappLink, // Use imageUrl for sending a document link
        caption: `Dear ${patientData.name}, please find attached your prescription PDF for OPD ID ${opd_id}. Thank you for choosing our services.`,
      };

      console.log("WhatsApp Payload:", payload);

      const response = await fetch("https://a.infispark.in/send-image-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WhatsApp API responded with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("WhatsApp API response:", result);

      if (result.status === "success") { // Adjust based on your API's success response
        toast.success("Prescription sent to WhatsApp successfully!");
      } else {
        toast.error(`Failed to send WhatsApp: ${result.message || "Unknown error"}`);
      }

    } catch (error: any) {
      console.error("Error sending WhatsApp:", error.message);
      toast.error(`Error sending WhatsApp: ${error.message}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const viewHistoryPrescription = async (historyItem: OPDPrescriptionRow) => {
    const pdfBlob = await generatePDFBlob(historyItem);
    if (!pdfBlob) {
      toast.error("Failed to generate PDF for historical prescription.");
      return;
    }
    const blobURL = URL.createObjectURL(pdfBlob);
    window.open(blobURL, "_blank");
    URL.revokeObjectURL(blobURL);
  };

  // --- Previous History Fetching ---
  const fetchPreviousPrescriptions = useCallback(async () => {
    if (!patientData?.uhid) {
      setHistoryModalItems([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("opd_prescriptions")
        .select("*")
        .eq("uhid", patientData.uhid)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching previous prescriptions:", error.message);
        toast.error("Failed to load previous prescriptions.");
        setHistoryModalItems([]);
      } else {
        // Filter out the current prescription if it exists and is loaded
        const filteredHistory = data.filter(
          (item) => !(currentPrescription && item.id === currentPrescription.id)
        ) as OPDPrescriptionRow[];
        setHistoryModalItems(filteredHistory);
      }
    } catch (error: any) {
      console.error("An unexpected error occurred while fetching history:", error.message);
      toast.error("An unexpected error occurred while loading prescription history.");
    }
  }, [patientData, currentPrescription]);

  // Effect to fetch history when modal opens
  useEffect(() => {
    if (showHistoryModal) {
      fetchPreviousPrescriptions();
    }
  }, [showHistoryModal, fetchPreviousPrescriptions]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <RefreshCw className="h-10 w-10 animate-spin text-blue-600" />
        <p className="ml-4 text-lg text-gray-600">Loading patient and prescription data...</p>
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-600">
        <p>Error: Patient data not found for OPD ID {opd_id}.</p>
      </div>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-2 sm:p-4">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2 mb-3 sm:mb-0">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            OPD Prescription
          </h1>
          <Button onClick={() => router.push("/opd/list/opdlistprescripitono")} variant="outline" className="w-full sm:w-auto mt-2 sm:mt-0">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to OPD List
          </Button>
        </div>

        <Card className="shadow-lg border border-gray-200 mb-4 text-xs sm:text-sm">
          <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-base sm:text-2xl font-semibold text-gray-800">
              Patient: {patientData.name} (UHID: {patientData.uhid})
            </CardTitle>
            <p className="text-xs sm:text-base text-gray-600">OPD ID: {opd_id}</p>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-1">
            <Button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={isSubmitting}
              className="w-full mb-2 bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 sm:text-sm sm:py-2"
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4 mr-2 animate-pulse" /> Stop Listening
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" /> Fill Form via Voice
                </>
              )}
            </Button>

            {isListening && liveTranscript && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm">
                <p className="font-semibold">Live Transcript:</p>
                <p className="italic">{liveTranscript}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label htmlFor="symptoms" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Symptoms/Disease
                </label>
                <Textarea
                  id="symptoms"
                  {...register("symptoms", { required: true })}
                  placeholder="Enter symptoms or disease..."
                  rows={2}
                  className="w-full p-2 text-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mt-3">
                <Button
                  type="button"
                  onClick={toggleMedicineDetails}
                  variant="outline"
                  className="w-full sm:w-auto text-blue-600 border-blue-300 hover:bg-blue-50 text-sm py-2"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {showMedicineDetails ? "Hide Medicine Details" : "Add Medicine Details"}
                </Button>

                {patientData?.uhid && (
                  <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto text-gray-600 border-gray-300 hover:bg-gray-50 text-xs py-1.5 sm:text-sm sm:py-2">
                        <History className="h-4 w-4 mr-1.5" /> View Previous Prescriptions
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto p-3 sm:p-4">
                      <DialogHeader className="pb-1.5 sm:pb-2">
                        <DialogTitle className="flex items-center gap-1.5 text-base sm:text-xl">
                          <History className="h-4.5 w-4.5 text-gray-600" /> Prescription History for {patientData.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Review past prescriptions for this patient.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-1.5 space-y-2">
                        {historyModalItems.length === 0 ? (
                          <p className="text-center text-gray-500 text-xs">No previous prescriptions found for this patient.</p>
                        ) : (
                          historyModalItems.map((historyItem) => (
                            <Card key={historyItem.id} className="border border-slate-200 shadow-sm p-2">
                              <CardHeader className="p-0 pb-1.5 flex flex-row justify-between items-center">
                                <div>
                                  <CardTitle className="text-sm sm:text-lg">
                                    Prescription from{" "}
                                    {historyItem.created_at ? format(parseISO(historyItem.created_at), "MMM dd, yyyy hh:mm a") : "N/A"}
                                  </CardTitle>
                                  <p className="text-xs text-gray-500">By: {historyItem.created_by || "N/A"}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => viewHistoryPrescription(historyItem)}
                                  className="text-blue-500 hover:bg-blue-50 px-1.5 py-0.5 text-xs h-auto"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" /> View PDF
                                </Button>
                              </CardHeader>
                              <CardContent className="p-0 space-y-1.5 text-xs">
                                <div>
                                  <h4 className="font-semibold text-gray-700">Symptoms/Disease:</h4>
                                  <p className="text-gray-600">{historyItem.symptoms || "N/A"}</p>
                                </div>
                                {historyItem.medicines && historyItem.medicines.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-gray-700">Medicines:</h4>
                                    <div className="overflow-x-auto">
                                      <Table className="min-w-full">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-[10px] p-0.5">Name</TableHead>
                                            <TableHead className="text-[10px] p-0.5">Days</TableHead>
                                            <TableHead className="text-[10px] p-0.5">Time</TableHead>
                                            <TableHead className="text-[10px] p-0.5">Instruction</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {historyItem.medicines.map((med, idx) => (
                                            <TableRow key={idx}>
                                              <TableCell className="text-[10px] p-0.5">{med.name}</TableCell>
                                              <TableCell className="text-[10px] p-0.5">{med.consumptionDays}</TableCell>
                                              <TableCell className="text-[10px] p-0.5">
                                                {(med.times.morning ? "Morning " : "") +
                                                  (med.times.evening ? "Evening " : "") +
                                                  (med.times.night ? "Night" : "")}
                                              </TableCell>
                                              <TableCell className="text-[10px] p-0.5">{med.instruction || "N/A"}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <h4 className="font-semibold text-gray-700">Overall Instructions:</h4>
                                  <p className="text-gray-600">{historyItem.overall_instruction || "N/A"}</p>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {showMedicineDetails && (
                <div className="space-y-2 border p-2 rounded-md bg-gray-50 mt-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Medicines
                  </h3>
                  {medicines.map((medicine, index) => (
                    <Card key={index} className="p-2 border border-slate-200">
                      <div className="flex justify-between items-center mb-1.5">
                        <h4 className="font-semibold text-xs">Medicine {index + 1}</h4>
                        {medicines.length > 1 && (
                          <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveMedicine(index)} className="px-1.5 py-0.5 text-xs h-auto">
                            <Trash2 className="h-3 w-3 mr-1" /> Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1.5">
                        <div>
                          <label htmlFor={`medicine-name-${index}`} className="block text-xs font-medium text-gray-700 mb-0.5">
                            Medicine Name
                          </label>
                          <Input
                            id={`medicine-name-${index}`}
                            type="text"
                            value={medicine.name}
                            onChange={(e) => handleMedicineChange(index, "name", e.target.value)}
                            placeholder="e.g., Paracetamol"
                            className="p-1.5 text-xs h-8"
                          />
                        </div>
                        <div>
                          <label htmlFor={`consumption-days-${index}`} className="block text-xs font-medium text-gray-700 mb-0.5">
                            Consumption Days
                          </label>
                          <Input
                            id={`consumption-days-${index}`}
                            type="text"
                            value={medicine.consumptionDays}
                            onChange={(e) => handleMedicineChange(index, "consumptionDays", e.target.value)}
                            placeholder="e.g., 7 days"
                            className="p-1.5 text-xs h-8"
                          />
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-0.5">Times per day</label>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              variant={medicine.times.morning ? "default" : "outline"}
                              onClick={() => handleTimeToggle(index, "morning")}
                              className="px-2.5 py-1 text-xs h-auto"
                            >
                              Morning
                            </Button>
                            <Button
                              type="button"
                              variant={medicine.times.evening ? "default" : "outline"}
                              onClick={() => handleTimeToggle(index, "evening")}
                              className="px-2.5 py-1 text-xs h-auto"
                            >
                              Evening
                            </Button>
                            <Button
                              type="button"
                              variant={medicine.times.night ? "default" : "outline"}
                              onClick={() => handleTimeToggle(index, "night")}
                              className="px-2.5 py-1 text-xs h-auto"
                            >
                              Night
                            </Button>
                          </div>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <label htmlFor={`medicine-instruction-${index}`} className="block text-xs font-medium text-gray-700 mb-0.5">
                            Instruction (Optional)
                          </label>
                          <Textarea
                            id={`medicine-instruction-${index}`}
                            value={medicine.instruction}
                            onChange={(e) => handleMedicineChange(index, "instruction", e.target.value)}
                            rows={1}
                            placeholder="e.g., After food, Before sleep"
                            className="p-1.5 text-xs min-h-[unset]"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                  <Button type="button" onClick={addMedicine} variant="outline" className="w-full text-xs py-1.5">
                    <PlusCircle className="h-4 w-4 mr-1.5" /> Add More Medicine
                  </Button>
                </div>
              )}

              <div>
                <label htmlFor="overallInstruction" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5">
                  Overall Instructions
                </label>
                <Textarea
                  id="overallInstruction"
                  {...register("overallInstruction")}
                  placeholder="Any additional instructions or notes..."
                  rows={2}
                  className="w-full p-1.5 text-xs"
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-1.5 mt-2">
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Save Prescription
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={clearPrescription}
                variant="outline"
                className="w-full sm:w-auto text-red-600 border-red-300 hover:bg-red-50 text-xs py-1.5"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear Prescription
              </Button>

              {currentPrescription && (
                <div className="mt-2 flex flex-col sm:flex-row space-y-1.5 sm:space-y-0 sm:space-x-1.5">
                  <Button type="button" onClick={downloadPrescription} variant="secondary" className="w-full sm:w-auto text-xs py-1.5">
                    <Download className="h-3.5 w-3.5 mr-1.5" /> View Prescription PDF
                  </Button>
                  <Button
                    type="button"
                    onClick={uploadPdfAndSendWhatsApp}
                    disabled={isSendingWhatsApp || !currentPrescription || !patientData?.number}
                    className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white text-xs py-1.5"
                  >
                    {isSendingWhatsApp ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Send on WhatsApp
                      </>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Hidden PDF Content - This div is used by html2canvas to generate the PDF */}
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <div
            ref={prescriptionContentRef}
            style={{
              width: "210mm",
              minHeight: "297mm",
              padding: "60mm 15mm 15mm 15mm", // Adjusted padding for more top space
              color: "#000",
              fontFamily: "Arial, sans-serif",
              boxSizing: "border-box",
              position: "relative",
            }}
          >
            {/* Content will be dynamically populated by generatePDFBlob */}
          </div>
        </div>
      </div>
    </Layout>
  );
}