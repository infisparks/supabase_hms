"use client"

import type React from "react"
import { useEffect, useState, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabase" // Using Supabase client
import {
  format,
  differenceInDays,
  addDays,
  startOfDay,
  endOfDay,
  parseISO, // For parsing ISO date strings from DB or date inputs
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns"
// NO date-fns-tz IMPORTS HERE - we'll do manual offset

import {
  Search,
  Activity,
  DollarSign,
  Layers,
  Stethoscope,
  Filter,
  RefreshCw,
  CalendarDays,
  Clock,
  User, // Keep User icon for general use
  FileText,
  CreditCard,
  UserCheck,
} from "lucide-react"

// Shadcn/ui components
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Layout from "@/components/global/Layout" // Your global layout component

// Register Chart.js components
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js"
import { Bar } from "react-chartjs-2" // Correctly import the Bar component
import { toast } from "sonner"
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

// ----- Type Definitions (Adapted for Supabase structure and fixes) -----

// Doctor info (fetched separately)
interface Doctor {
  id: string // Assuming doctor ID is a string/UUID, or number if you changed it
  dr_name: string // Changed from 'name' to 'dr_name' to match DB
  opd_charge?: number
  department?: string
  specialist?: string
}

// Modality/Service info (from OPD service_info JSONB)
interface IModality {
  charges: number
  doctor?: string // This will now store doctor name if available, not ID
  specialist?: string
  type: "consultation" | "casualty" | "xray" | "pathology" | "ipd" | "radiology" | "custom"
  visitType?: string
  service?: string
}

// Payment info (from OPD payment_info JSONB)
interface IPayment {
  cashAmount: number
  createdAt: string
  discount: number
  onlineAmount: number
  paymentMethod: string
  totalCharges: number
  totalPaid: number
}

// Patient detail structure as it would appear in the patient_detail table
interface PatientDetailFromSupabase {
  uhid: string
  name: string
  number: string | null // Assuming it can be null in DB
  age: number | null
  gender: string | null
  address: string | null
}

// OPD Registration (from Supabase `opd_registration` table)
interface OPDRegistrationSupabase {
  opd_id: string // bigint in DB, but often handled as string in JS for UUIDs or large numbers
  created_at: string // timestamp with time zone (UTC ISO string)
  patient_id: number | null // bigint null in DB. Ensure this matches.
  date: string // timestamp with time zone (UTC ISO string)
  refer_by: string | null
  "additional Notes": string | null // Exact column name from DB
  service_info: IModality[] | null // JSONB
  payment_info: IPayment | null // JSONB
  bill_no: number // smallint in DB, use number
  uhid: string // text, foreign key to patient_detail.uhid
  // FIX: Switched to a LEFT join, so the result can be null.
  patient_detail: PatientDetailFromSupabase[] | null
  "appointment_type"?: string | null
  "visit_type"?: string | null
}

// IPD Service (from IPD `service_detail` JSONB)
interface IPDService {
  amount: number
  serviceName: string
  type: string
  doctorName?: string
  createdAt: string // ISO string
}

// IPD Payment (from IPD `payment_detail` JSONB)
interface IPDPayment {
  id?: string // UUID from DB or generated, optional
  amount: number
  paymentType: "cash" | "online" | "bill_reduction"
  type: "advance" | "refund" | "deposit" | "discount"
  date: string // ISO string
  createdAt: string // ISO string
  through?: string // Added 'through' for online/cash payments
}

// IPD Registration (from Supabase `ipd_registration` table)
interface IPDRegistrationSupabase {
  ipd_id: number
  uhid: string
  admission_date: string // date (YYYY-MM-DD string as in your INSERT)
  admission_time: string | null // time (HH:mm string as in your INSERT)
  under_care_of_doctor: string | null // Now storing doctor's name (string)
  payment_detail: IPDPayment[] | null // JSONB
  service_detail: IPDService[] | null // JSONB
  created_at: string // timestamp with time zone (UTC ISO string)
  bed_id: number | null
  bed_management: { room_type: string }[] | null
  // FIX: Switched to a LEFT join, so the result can be null.
  patient_detail: PatientDetailFromSupabase[] | null
}

// OT Details (from Supabase `ot_details` table)
interface OTDetailsSupabase {
  id: string // UUID of the OT record
  ipd_id: number | null // bigint null in schema
  uhid: string
  ot_type: "Major" | "Minor"
  ot_notes: string | null
  ot_date: string // timestamp with time zone (UTC ISO string from DB, even if default is Asia/Kolkata)
  created_at: string // timestamp with time zone (UTC ISO string from DB, even if default is Asia/Kolkata)
  // FIX: Switched to a LEFT join, so the result can be null.
  patient_detail: PatientDetailFromSupabase[] | null
}

// Combined types for display in tables/modals
interface OPDAppointmentDisplay {
  type: "OPD"
  id: string // Common ID for display, derived from opd_id (string)
  patientId: string // UHID
  name: string
  phone: string
  date: string // YYYY-MM-DD (converted to local timezone date)
  time: string // HH:mm (converted to local timezone time)
  modalities: IModality[]
  payment: IPayment
  message: string // For display, maps from additional_notes
  opd_id: string
  created_at: string // original UTC
  refer_by: string | null
  additional_notes: string | null // The correct column name from DB
  service_info: IModality[] | null
  payment_info: IPayment | null
  bill_no: number // Corrected to number
  patient_uhid_from_opd_table: string // The UHID directly from opd_registration table
  appointment_type?: string | null // Made optional if not always present
  visit_type?: string | null // Made optional if not always present
}

interface IPDAppointmentDisplay {
  type: "IPD"
  id: string // Common ID for display, derived from ipd_id
  patientId: string // UHID
  name: string
  phone: string
  totalAmount: number // Calculated gross service amount
  totalDeposit: number // Calculated net deposit (advances - refunds)
  totalRefunds: number // Calculated total refunds
  discount: number // Calculated discount
  remainingAmount: number // Calculated remaining amount
  roomType: string // From bed_management join
  ipd_id: number
  uhid: string
  admission_date: string // YYYY-MM-DD (local date string)
  admission_time: string | null // HH:mm (local time string)
  under_care_of_doctor: string | null // Now storing doctor name
  payment_detail: IPDPayment[] | null
  service_detail: IPDService[] | null
  created_at: string // original UTC
  bed_id: number | null
}

interface OTAppointmentDisplay {
  type: "OT"
  id: string // Common ID for display, derived from id
  patientId: string // UHID
  name: string
  phone: string
  date: string // YYYY-MM-DD (converted from ot_date in local timezone)
  time: string // HH:mm (converted from created_at in local timezone)
  message: string // For display, maps from ot_notes
  ipd_id: number | null // bigint null
  uhid: string
  ot_type: "Major" | "Minor"
  ot_notes: string | null
  ot_date: string // original UTC (as string)
  created_at: string // original UTC (as string)
}

type CombinedAppointment = OPDAppointmentDisplay | IPDAppointmentDisplay | OTAppointmentDisplay

// Patient Info for search results
interface PatientInfo {
  uhid: string
  name: string
  phone: string
  age: number | null
  address: string | null
  gender: string | null
}

interface FilterState {
  searchQuery: string
  filterType: "week" | "today" | "month" | "dateRange"
  selectedMonth: string
  startDate: string
  endDate: string
}

// Define the target timezone offset for display
// Mumbai (Asia/Kolkata) is UTC+5:30.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000 // 5 hours 30 minutes in milliseconds

// ----- Manual Timezone Conversion Helpers (TOP-LEVEL SCOPE) -----

// Formats a number as Indian Rupee currency
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)

// Formats bytes into human-readable units
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// Converts a UTC Date object to a Date object representing the time in IST
const toIST = (utcDate: Date): Date => {
  return new Date(utcDate.getTime() + IST_OFFSET_MS)
}

// Converts an IST Date object to a Date object representing the time in UTC
const fromIST = (istDate: Date): Date => {
  return new Date(istDate.getTime() - IST_OFFSET_MS)
}

// Helper to get start and end of a day in UTC, based on a local IST date string (YYYY-MM-DD)
// This will be used for Supabase queries
const getDayRangeUtcFromLocal = (localDateString: string) => {
  const localDate = parseISO(localDateString) // Parse as local date without timezone info
  const startOfLocalDay = startOfDay(localDate)
  const endOfLocalDay = endOfDay(localDate)

  return {
    start: fromIST(startOfLocalDay).toISOString(), // Convert local start of day to UTC ISO string
    end: fromIST(endOfLocalDay).toISOString(), // Convert local end of day to UTC ISO string
  }
}

const getThisWeekRange = () => {
  const now = new Date() // Current system time (UTC)
  const nowInIST = toIST(now) // Convert current UTC time to IST Date object

  const startOfWeekInIST = startOfWeek(nowInIST, { weekStartsOn: 1 }) // Monday in IST
  const endOfWeekInIST = endOfWeek(nowInIST, { weekStartsOn: 1 }) // Sunday in IST

  return {
    start: fromIST(startOfWeekInIST).toISOString(), // Convert IST start of week to UTC ISO string
    end: fromIST(endOfWeekInIST).toISOString(), // Convert IST end of week to UTC ISO string
  }
}

// Replace getTodayDateRange with a robust IST calculation using Intl.DateTimeFormat
const getTodayDateRange = () => {
  // Get the current date in Asia/Kolkata reliably
  const now = new Date();
  // Use Intl.DateTimeFormat to get the date in IST
  const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = istFormatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const istDateString = `${year}-${month}-${day}`;
  // Use this IST date string to get the UTC range for the whole IST day
  return {
    ...getDayRangeUtcFromLocal(istDateString),
    istDateString,
  };
}

const getMonthRange = (monthYear: string) => {
  const [year, month] = monthYear.split("-").map(Number)
  // Create a Date object representing the first day of the month in IST
  // We construct it in local system time, then convert to IST, then to UTC for query
  const firstDayOfMonthLocal = new Date(year, month - 1, 1)
  const firstDayOfMonthIST = toIST(firstDayOfMonthLocal)
  const lastDayOfMonthIST = endOfMonth(firstDayOfMonthIST) // endOfMonth correctly handles month-end in IST

  return {
    start: fromIST(startOfDay(firstDayOfMonthIST)).toISOString(),
    end: fromIST(endOfDay(lastDayOfMonthIST)).toISOString(),
  }
}

// --- Helper functions for patient and room fetching ---
async function fetchPatientDetailByUhid(uhid: string) {
  if (!uhid) return null;
  const { data, error } = await supabase
    .from("patient_detail")
    .select("uhid, name, number, age, gender, address")
    .eq("uhid", uhid)
    .single();
  if (error) return null;
  return data;
}

async function fetchRoomTypeByBedId(bed_id: number | null) {
  if (!bed_id) return null;
  const { data, error } = await supabase
    .from("bed_management")
    .select("room_type")
    .eq("id", bed_id)
    .single();
  if (error) return null;
  return data?.room_type || null;
}

// ----- Dashboard Component -----
const DashboardPage: React.FC = () => {
  // State
  const [opdAppointments, setOpdAppointments] = useState<OPDAppointmentDisplay[]>([])
  const [ipdAppointments, setIpdAppointments] = useState<IPDAppointmentDisplay[]>([])
  const [otAppointments, setOtAppointments] = useState<OTAppointmentDisplay[]>([])
  const [doctors, setDoctors] = useState<{ [key: string]: Doctor }>({})
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    filterType: "today", // Set default to 'today'
    selectedMonth: format(toIST(new Date()), "yyyy-MM"), // Default month in Mumbai timezone
    startDate: "",
    endDate: "",
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [selectedAppointment, setSelectedAppointment] = useState<CombinedAppointment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [modalLoading, setModalLoading] = useState<boolean>(false)

  // New states for patient search and appointments modal
  const [searchedPatients, setSearchedPatients] = useState<PatientInfo[]>([])
  const [selectedPatientForAppointments, setSelectedPatientForAppointments] = useState<PatientInfo | null>(null)
  const [patientAppointmentsModalOpen, setPatientAppointmentsModalOpen] = useState<boolean>(false)
  const [patientAppointmentsLoading, setPatientAppointmentsLoading] = useState<boolean>(false)
  const [patientAllAppointments, setPatientAllAppointments] = useState<CombinedAppointment[]>([])

  // Data download size tracking (conceptual for Supabase, as actual bytes are harder to track)
  const [totalDownloadedBytes, setTotalDownloadedBytes] = useState(0)
  const [searchDownloadedBytes, setSearchDownloadedBytes] = useState(0)

  // Compute current date range for the dashboard display and the query
  const currentDateRange = useMemo(() => {
    let rangeUtc: { start: string; end: string; istDateString?: string }
    let displayStart: string
    let displayEnd: string

    switch (filters.filterType) {
      case "today": {
        const todayRange = getTodayDateRange();
        rangeUtc = todayRange;
        displayStart = todayRange.istDateString;
        displayEnd = todayRange.istDateString;
        break;
      }
      case "month": {
        rangeUtc = getMonthRange(filters.selectedMonth)
        const monthStartIST = toIST(parseISO(rangeUtc.start)) // Convert UTC start to IST for display
        const monthEndIST = toIST(parseISO(rangeUtc.end)) // Convert UTC end to IST for display
        displayStart = format(monthStartIST, "yyyy-MM-dd")
        displayEnd = format(monthEndIST, "yyyy-MM-dd")
        break;
      }
      case "dateRange": {
        // For custom date range, the inputs (filters.startDate/endDate) are already YYYY-MM-DD local strings.
        rangeUtc = getDayRangeUtcFromLocal(filters.startDate) // Start of start date in UTC
        const endRange = getDayRangeUtcFromLocal(filters.endDate) // End of end date in UTC
        rangeUtc.end = endRange.end // Update the end of the range to cover the whole end day

        displayStart = filters.startDate
        displayEnd = filters.endDate
        break;
      }
      case "week":
      default: {
        rangeUtc = getThisWeekRange()
        const weekStartIST = toIST(parseISO(rangeUtc.start)) // Convert UTC start to IST for display
        const weekEndIST = toIST(parseISO(rangeUtc.end)) // Convert UTC end to IST for display
        displayStart = format(weekStartIST, "yyyy-MM-dd")
        displayEnd = format(weekEndIST, "yyyy-MM-dd")
        break;
      }
    }

    return {
      startUtc: rangeUtc.start, // UTC ISO string for query
      endUtc: rangeUtc.end, // UTC ISO string for query
      displayStart, // For display in filters
      displayEnd, // For display in filters
    }
  }, [filters])

  // Fetch doctors once (assuming a 'doctor' table in Supabase)
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data, error } = await supabase.from("doctor").select("id, dr_name, department, specialist, opd_charge");
        if (error || !data) {
          console.error("Supabase doctor fetch error:", error, data);
          // toast.error("Failed to load doctor data."); // HIDE error message from user
          setDoctors({});
          return;
        }
        const doctorsMap: { [key: string]: Doctor } = {};
        data.forEach((doc: any) => {
          doctorsMap[String(doc.id)] = {
            id: String(doc.id),
            dr_name: doc.dr_name,
            department: doc.department,
            specialist: doc.specialist,
            opd_charge: doc.opd_charge || 0,
          };
        });
        setDoctors(doctorsMap);
      } catch (err) {
        console.error("Failed to fetch doctors (exception):", err);
        // toast.error("Failed to load doctor data."); // HIDE error message from user
        setDoctors({});
      }
    };
    fetchDoctors();
  }, []);

  // Main data fetching logic (combines initial load and filter changes)
  useEffect(() => {
    const fetchAppointments = async () => {
      const isRefresh = !isLoading
      if (isRefresh) setRefreshing(true)
      setIsLoading(true)

      setOpdAppointments([])
      setIpdAppointments([])
      setOtAppointments([])
      setSearchedPatients([]) // Clear previous search results
      setTotalDownloadedBytes(0)

      if (filters.searchQuery) {
        // --- Search mode ---
        const searchQ = filters.searchQuery.trim();
        if (searchQ.length < 3) {
          setIsLoading(false)
          setSearchedPatients([])
          setSearchDownloadedBytes(0)
          setRefreshing(false) // Ensure refreshing is reset
          return
        }

        const q = searchQ.toLowerCase();
        try {
          let mergedResults: Record<string, PatientDetailFromSupabase> = {};

          // Search by UHID and Name (case-insensitive, partial match)
          const { data: nameUhidData, error: nameUhidError } = await supabase
            .from("patient_detail")
            .select("uhid, name, number, age, gender, address")
            .or(`name.ilike.%${q}%,uhid.ilike.%${q}%`)
            .limit(20); // Limit results for performance

          if (nameUhidError) {
            console.error("Supabase name/UHID search error:", nameUhidError);
            throw nameUhidError; // Propagate error to catch block
          }
          (nameUhidData || []).forEach((p) => {
            if (p.uhid) mergedResults[p.uhid] = p;
          });

          // If query is all digits, also search by number
          if (/^\d+$/.test(searchQ)) {
            const { data: phoneData, error: phoneError } = await supabase
              .from("patient_detail")
              .select("uhid, name, number, age, gender, address")
              .eq("number", searchQ) // Number column is text in your schema based on patient_detail type def, if it's bigint use Number(searchQ)
              .limit(20);

            if (phoneError) {
              console.error("Supabase phone search error:", phoneError);
              throw phoneError; // Propagate error to catch block
            }
            (phoneData || []).forEach((p) => {
              if (p.uhid) mergedResults[p.uhid] = p;
            });
          }

          const mappedPatients: PatientInfo[] = Object.values(mergedResults).map((p) => ({
            uhid: p.uhid,
            name: p.name || "Unknown",
            phone: p.number || "N/A", // Changed from String(p.number) assuming it's already string or null
            age: p.age || null,
            address: p.address || null,
            gender: p.gender || null,
          }));
          setSearchedPatients(mappedPatients);
          setSearchDownloadedBytes(JSON.stringify(mappedPatients).length);
        } catch (err) {
          console.error("Error searching patients:", err);
          toast.error("Failed to search patients.");
          setSearchedPatients([]);
          setSearchDownloadedBytes(0);
        } finally {
          setIsLoading(false);
          setRefreshing(false);
        }
        return; // EXIT here if in search mode
      }

      // --- Date filter mode (when no search query) ---
      const { startUtc, endUtc } = currentDateRange
      if (!startUtc || !endUtc) {
        setIsLoading(false)
        if (isRefresh) setRefreshing(false)
        return
      }

      try {
        // Determine which date column to filter on based on filters.filterType
        // For 'today', 'week', 'month' filters, it's generally good to filter by created_at for a dashboard overview.
        // If the intention for 'today' was specifically `opd_registration.date` (appointment date),
        // the original code's `useDateField` logic was correctly trying to switch.
        // For simplicity and general dashboard overview, let's keep `created_at` for all filters,
        // or explicitly handle `date` for OPD only if needed.
        // Sticking to original logic where 'today' used `date` column and others `created_at`
        const dateColumnForOPD = filters.filterType === 'today' ? 'date' : 'created_at';
        const dateColumnForIPD = filters.filterType === 'today' ? 'admission_date' : 'created_at';
        const dateColumnForOT = filters.filterType === 'today' ? 'ot_date' : 'created_at';


        // Fetch OPD data
        const { data: opdData, error: opdError } = await supabase
          .from("opd_registration")
          .select(`
            opd_id,
            created_at,
            patient_id, 
            date,
            refer_by,
            "additional Notes",
            service_info,
            payment_info,
            bill_no,
            uhid
          `)
          .gte(dateColumnForOPD, startUtc)
          .lte(dateColumnForOPD, endUtc)

        if (opdError) throw opdError
        // Fetch patient details for each OPD record
        const mappedOpd: OPDAppointmentDisplay[] = await Promise.all(
          ((opdData as OPDRegistrationSupabase[]) || []).map(async (appt) => {
            let patientDetail = await fetchPatientDetailByUhid(appt.uhid);
            const createdAtIST = toIST(parseISO(appt.created_at))
            const opdDateIST = toIST(parseISO(appt.date))
            return {
              ...appt,
              type: "OPD",
              id: String(appt.opd_id),
              patientId: patientDetail?.uhid || appt.uhid || "N/A",
              name: patientDetail?.name || "Unknown",
              phone: patientDetail?.number ? String(patientDetail.number) : "N/A",
              date: format(opdDateIST, "yyyy-MM-dd"),
              time: format(createdAtIST, "HH:mm"),
              modalities: (appt.service_info as IModality[]) || [],
              payment: (appt.payment_info as IPayment) || {
                cashAmount: 0,
                createdAt: "",
                discount: 0,
                onlineAmount: 0,
                paymentMethod: "cash",
                totalCharges: 0,
                totalPaid: 0,
              },
              message: appt["additional Notes"] || "",
              patient_uhid_from_opd_table: appt.uhid,
              additional_notes: appt["additional Notes"],
              bill_no: appt.bill_no,
              appointment_type: (appt as any).appointment_type,
              visit_type: (appt as any).visit_type,
            }
          })
        );
        setOpdAppointments(mappedOpd)

        // Fetch IPD data
        const { data: ipdData, error: ipdError } = await supabase
          .from("ipd_registration")
          .select(`
            ipd_id,
            uhid,
            admission_date,
            admission_time,
            under_care_of_doctor,
            payment_detail,
            service_detail,
            created_at,
            bed_id
          `)
          .gte(dateColumnForIPD, startUtc)
          .lte(dateColumnForIPD, endUtc)

        if (ipdError) throw ipdError
        const mappedIpd: IPDAppointmentDisplay[] = await Promise.all(
          ((ipdData as IPDRegistrationSupabase[]) || []).map(async (ipdRecord) => {
            const payments = (ipdRecord.payment_detail || []) as IPDPayment[]
            const services = (ipdRecord.service_detail || []) as IPDService[]
            let totalDeposit = 0
            let totalRefunds = 0
            let totalDiscount = 0
            payments.forEach((p) => {
              if (p.type === "advance" || p.type === "deposit") {
                totalDeposit += p.amount
              } else if (p.type === "refund") {
                totalRefunds += p.amount
              } else if (p.type === "discount" || p.type === "bill_reduction") {
                totalDiscount += p.amount
              }
            })
            const totalServiceAmount = services.reduce((sum, s) => sum + s.amount, 0)
            const remaining = totalServiceAmount - totalDiscount - totalDeposit + totalRefunds
            let patientDetail = await fetchPatientDetailByUhid(ipdRecord.uhid);
            let roomType = await fetchRoomTypeByBedId(ipdRecord.bed_id);
            return {
              ...ipdRecord,
              type: "IPD",
              id: String(ipdRecord.ipd_id),
              patientId: patientDetail?.uhid || ipdRecord.uhid || "N/A",
              name: patientDetail?.name || "Unknown",
              phone: patientDetail?.number ? String(patientDetail.number) : "N/A",
              totalAmount: totalServiceAmount,
              totalDeposit: totalDeposit,
              totalRefunds: totalRefunds,
              discount: totalDiscount,
              remainingAmount: remaining,
              roomType: roomType || "N/A",
              admission_date: ipdRecord.admission_date,
              admission_time: ipdRecord.admission_time,
            }
          })
        );
        setIpdAppointments(mappedIpd)

        // Fetch OT data
        const { data: otData, error: otError } = await supabase
          .from("ot_details")
          .select(`
            id, ipd_id, uhid, ot_type, ot_notes, ot_date, created_at
          `)
          .gte(dateColumnForOT, startUtc)
          .lte(dateColumnForOT, endUtc)

        if (otError) throw otError
        const mappedOt: OTAppointmentDisplay[] = await Promise.all(
          ((otData as OTDetailsSupabase[]) || []).map(async (otRecord) => {
            const otDateIST = toIST(parseISO(otRecord.ot_date)) // ot_date is also timestamp with timezone
            const createdAtIST = toIST(parseISO(otRecord.created_at))
            let patientDetail = await fetchPatientDetailByUhid(otRecord.uhid);
            return {
              ...otRecord,
              type: "OT",
              id: otRecord.id,
              patientId: patientDetail?.uhid || otRecord.uhid || "N/A",
              name: patientDetail?.name || "Unknown",
              phone: patientDetail?.number ? String(patientDetail.number) : "N/A",
              date: format(otDateIST, "yyyy-MM-dd"), // Use converted ot_date
              time: format(createdAtIST, "HH:mm"), // Use converted created_at for time
              message: otRecord.ot_notes || "No notes",
            }
          })
        );
        setOtAppointments(mappedOt)

        setTotalDownloadedBytes(
          JSON.stringify(mappedOpd).length + JSON.stringify(mappedIpd).length + JSON.stringify(mappedOt).length,
        )
      } catch (err) {
        console.error("Error fetching data for date range:", err)
        toast.error("Failed to load data for the selected period.")
      } finally {
        setIsLoading(false)
        if (isRefresh) setRefreshing(false)
      }
    }
    fetchAppointments()
  }, [filters.searchQuery, currentDateRange]) // Re-run effect when searchQuery or currentDateRange changes

  // Statistics
  const statistics = useMemo(() => {
    const totalOpdAmt = opdAppointments.reduce((sum, a) => sum + (a.payment?.totalPaid || 0), 0)
    const totalIpdDep = ipdAppointments.reduce((sum, a) => sum + a.totalDeposit, 0)
    const totalIpdRef = ipdAppointments.reduce((sum, a) => sum + a.totalRefunds, 0)

    const opdCash = opdAppointments.reduce((sum, a) => sum + (a.payment?.cashAmount || 0), 0)
    const opdOnline = opdAppointments.reduce((sum, a) => sum + (a.payment?.onlineAmount || 0), 0)

    const ipdCash = ipdAppointments.reduce(
      (sum, a) =>
        sum +
        (a.payment_detail || [])
          .filter((p) => p.paymentType === "cash" && (p.type === "advance" || p.type === "deposit"))
          .reduce((s, p) => s + Number(p.amount), 0),
      0,
    )
    const ipdOnline = ipdAppointments.reduce(
      (sum, a) =>
        sum +
        (a.payment_detail || [])
          .filter((p) => p.paymentType === "online" && (p.type === "advance" || p.type === "deposit"))
          .reduce((s, p) => s + Number(p.amount), 0),
      0,
    )

    return {
      totalOpdCount: opdAppointments.length,
      totalOpdAmount: totalOpdAmt,
      totalIpdCount: ipdAppointments.length,
      totalIpdAmount: totalIpdDep,
      overallIpdRefunds: totalIpdRef,
      totalOtCount: otAppointments.length, // This already gives the count of OT procedures
      opdCash,
      opdOnline,
      ipdCash,
      ipdOnline,
      totalRevenue: totalOpdAmt + totalIpdDep,
    }
  }, [opdAppointments, ipdAppointments, otAppointments])

  // Combined & filter by date range (search is handled by fetching patientinfo directly)
  const filteredAppointments = useMemo(() => {
    if (filters.searchQuery) {
      return [] // In search mode, this memo is not used for display
    }
    const all: CombinedAppointment[] = [...opdAppointments, ...ipdAppointments, ...otAppointments]
    const list = all

    // Sorting by date (most recent first)
    list.sort((a, b) => {
      // Reconstruct full date-time objects in local context for sorting
      // Assuming date fields (admission_date, date, ot_date) are YYYY-MM-DD local dates
      // And time fields (admission_time, time) are HH:mm local times
      // We combine them and convert to IST for consistent comparison
      const getDateAndTimeInIST = (app: CombinedAppointment) => {
        let dateStr: string
        let timeStr: string | null

        if (app.type === "IPD") {
          dateStr = app.admission_date
          timeStr = app.admission_time
        } else if (app.type === "OT") {
          dateStr = app.date // Use the converted `date` (ot_date in IST)
          timeStr = app.time // Use the converted `time` (created_at time in IST)
        } else {
          // OPD
          dateStr = app.date
          timeStr = app.time // OPD time is derived from created_at
        }

        // Parse the combined local date and time, then convert to IST Date object for comparison
        return toIST(parseISO(`${dateStr}T${timeStr || "00:00"}`))
      }

      const dateTimeA = getDateAndTimeInIST(a)
      const dateTimeB = getDateAndTimeInIST(b)

      return dateTimeB.getTime() - dateTimeA.getTime()
    })
    return list
  }, [opdAppointments, ipdAppointments, otAppointments, filters.searchQuery])

  // Doctor consultations
  const doctorConsultations = useMemo(() => {
    const map = new Map<string, number>()
    opdAppointments.forEach((a) =>
      a.modalities
        .filter((m) => m.type === "consultation" && m.doctor)
        .forEach((m) => map.set(m.doctor!, (map.get(m.doctor!) || 0) + 1)),
    )
    return Array.from(map.entries())
      .map(([doctorName, count]) => ({ doctorName, count }))
      .sort((a, b) => b.count - a.count)
  }, [opdAppointments])

  const doctorConsultChartData = useMemo(() => {
    const top = doctorConsultations.slice(0, 10)
    return {
      labels: top.map((d) => d.doctorName),
      datasets: [
        {
          label: "Consultations",
          data: top.map((d) => d.count),
          backgroundColor: "rgba(75,192,192,0.6)",
          borderWidth: 1,
        },
      ],
    }
  }, [doctorConsultations])

  // Last 3 days chart
  const chartData = useMemo(() => {
    // Get dates in Mumbai timezone for chart labels and data aggregation
    const todayISTDate = toIST(new Date())
    const today = format(todayISTDate, "yyyy-MM-dd")
    const yesterday = format(addDays(todayISTDate, -1), "yyyy-MM-dd")
    const dayBeforeYesterday = format(addDays(todayISTDate, -2), "yyyy-MM-dd")

    const opdCounts: Record<string, number> = { [dayBeforeYesterday]: 0, [yesterday]: 0, [today]: 0 }
    opdAppointments.forEach((a) => {
      // Aggregate by the converted date (created_at from Supabase is UTC)
      const dateKey = format(toIST(parseISO(a.created_at)), "yyyy-MM-dd")
      if (opdCounts[dateKey] !== undefined) opdCounts[dateKey]++
    })

    const ipdCounts: Record<string, number> = { [dayBeforeYesterday]: 0, [yesterday]: 0, [today]: 0 }
    ipdAppointments.forEach((a) => {
      // Aggregate by the converted date (created_at from Supabase is UTC)
      const dateKey = format(toIST(parseISO(a.created_at)), "yyyy-MM-dd")
      if (ipdCounts[dateKey] !== undefined) ipdCounts[dateKey]++
    })

    return {
      labels: [dayBeforeYesterday, yesterday, today],
      datasets: [
        {
          label: "OPD Appointments",
          data: [opdCounts[dayBeforeYesterday], opdCounts[yesterday], opdCounts[today]],
          backgroundColor: "rgba(54,162,235,0.6)",
        },
        {
          label: "IPD Admissions",
          data: [ipdCounts[dayBeforeYesterday], ipdCounts[yesterday], ipdCounts[today]],
          backgroundColor: "rgba(255,99,132,0.6)",
        },
      ],
    }
  }, [opdAppointments, ipdAppointments])

  // Handlers
  const handleDateRangeChange = (startStr: string, endStr: string) => {
    if (startStr && endStr) {
      const startDateLocal = parseISO(startStr)
      const endDateLocal = parseISO(endStr)

      const diff = differenceInDays(endDateLocal, startDateLocal)
      if (diff > 30) {
        toast.error("Date range cannot exceed 30 days")
        const maxEndLocal = addDays(startDateLocal, 30)
        setFilters((p) => ({
          ...p,
          startDate: startStr,
          endDate: format(maxEndLocal, "yyyy-MM-dd"),
          filterType: "dateRange",
        }))
      } else {
        setFilters((p) => ({
          ...p,
          startDate: startStr,
          endDate: endStr,
          filterType: "dateRange",
        }))
      }
    } else {
      setFilters((p) => ({ ...p, startDate: startStr, endDate: endStr }))
    }
  }

  const handleFilterChange = (upd: Partial<FilterState>) => {
    if (upd.filterType === "today") {
      setFilters((p) => ({
        ...p,
        filterType: "today",
        startDate: "",
        endDate: "",
        selectedMonth: format(toIST(new Date()), "yyyy-MM"),
        searchQuery: "",
      }))
    } else if (upd.filterType === "week") {
      setFilters((p) => ({
        ...p,
        filterType: "week",
        startDate: "",
        endDate: "",
        selectedMonth: format(toIST(new Date()), "yyyy-MM"),
        searchQuery: "",
      }))
    } else if (upd.filterType === "month") {
      setFilters((p) => ({
        ...p,
        filterType: "month",
        startDate: "",
        endDate: "",
        selectedMonth: upd.selectedMonth || format(toIST(new Date()), "yyyy-MM"),
        searchQuery: "",
      }))
    } else {
      setFilters((p) => ({ ...p, ...upd }))
    }
  }

  const resetFilters = () =>
    setFilters({
      searchQuery: "",
      filterType: "today",
      selectedMonth: format(toIST(new Date()), "yyyy-MM"),
      startDate: "",
      endDate: "",
    })

  // Modal for individual appointment details
  const openModal = async (app: CombinedAppointment) => {
    setModalLoading(true)
    setIsModalOpen(true)
    setSelectedAppointment(app)
    setModalLoading(false)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedAppointment(null)
  }

  // New: Fetch all appointments for a specific patient (for patient search modal)
  const fetchAllAppointmentsForPatient = useCallback(
    async (uhid: string) => {
      setPatientAppointmentsLoading(true)
      const allPatientApps: CombinedAppointment[] = []

      try {
        const { data: opdData, error: opdError } = await supabase
          .from("opd_registration")
          .select(
            `
              opd_id, created_at, date, refer_by, "additional Notes", service_info, payment_info, bill_no, uhid, patient_id,
              patient_detail(uhid, name, number, age, gender, address)
            `,
          )
          .eq("uhid", uhid)
          .order("created_at", { ascending: false })

        if (opdError) throw opdError
        const mappedOpd: OPDAppointmentDisplay[] = ((opdData as OPDRegistrationSupabase[]) || []).map((appt) => {
          const createdAtIST = toIST(parseISO(appt.created_at))
          const opdDateIST = toIST(parseISO(appt.date))
          const patientDetail = appt.patient_detail?.[0]
          return {
            ...appt,
            type: "OPD",
            id: String(appt.opd_id),
            patientId: patientDetail?.uhid || appt.uhid || "N/A",
            name: patientDetail?.name || "Unknown",
            phone: patientDetail?.number ? String(patientDetail.number) : "N/A",
            date: format(opdDateIST, "yyyy-MM-dd"),
            time: format(createdAtIST, "HH:mm"),
            modalities: (appt.service_info as IModality[]) || [],
            payment: (appt.payment_info as IPayment) || {
              cashAmount: 0,
              createdAt: "",
              discount: 0,
              onlineAmount: 0,
              paymentMethod: "cash",
              totalCharges: 0,
              totalPaid: 0,
            },
            message: appt["additional Notes"] || "",
            patient_uhid_from_opd_table: appt.uhid,
            additional_notes: appt["additional Notes"],
            bill_no: appt.bill_no,
            appointment_type: (appt as any).appointment_type,
            visit_type: (appt as any).visit_type,
          }
        })
        allPatientApps.push(...mappedOpd)

        const { data: ipdData, error: ipdError } = await supabase
          .from("ipd_registration")
          .select(
            `
              ipd_id, uhid, admission_date, admission_time, under_care_of_doctor, payment_detail, service_detail, created_at, bed_id,
              bed_management(room_type),
              patient_detail(uhid, name, number, age, gender, address)
            `,
          )
          .eq("uhid", uhid)
          .order("created_at", { ascending: false })

        if (ipdError) throw ipdError
        const mappedIpd: IPDAppointmentDisplay[] = ((ipdData as IPDRegistrationSupabase[]) || []).map((ipdRecord) => {
          const payments = (ipdRecord.payment_detail || []) as IPDPayment[]
          const services = (ipdRecord.service_detail || []) as IPDService[]

          let totalDeposit = 0
          let totalRefunds = 0
          let totalDiscount = 0

          payments.forEach((p) => {
            if (p.type === "advance" || p.type === "deposit") {
              totalDeposit += p.amount
            } else if (p.type === "refund") {
              totalRefunds += p.amount
            } else if (p.type === "discount" || p.type === "bill_reduction") {
              totalDiscount += p.amount
            }
          })

          const totalServiceAmount = services.reduce((sum, s) => sum + s.amount, 0)
          const remaining = totalServiceAmount - totalDiscount - totalDeposit + totalRefunds
          const patientDetail = ipdRecord.patient_detail?.[0]
          const bedManagement = ipdRecord.bed_management?.[0]

          return {
            ...ipdRecord,
            type: "IPD",
            id: String(ipdRecord.ipd_id),
            patientId: patientDetail?.uhid || ipdRecord.uhid || "N/A",
            name: patientDetail?.name || "Unknown",
            phone: patientDetail?.number ? String(patientDetail.number) : "N/A",
            totalAmount: totalServiceAmount,
            totalDeposit: totalDeposit,
            totalRefunds: totalRefunds,
            discount: totalDiscount,
            remainingAmount: remaining,
            roomType: bedManagement?.room_type || "N/A",
            admission_date: ipdRecord.admission_date,
            admission_time: ipdRecord.admission_time,
          }
        })
        allPatientApps.push(...mappedIpd)

        const { data: otData, error: otError } = await supabase
          .from("ot_details")
          .select(
            `
              id, ipd_id, uhid, ot_type, ot_notes, ot_date, created_at,
              patient_detail(uhid, name, number, age, gender, address)
            `,
          )
          .eq("uhid", uhid)
          .order("created_at", { ascending: false })

        if (otError) throw otError
        const mappedOt: OTAppointmentDisplay[] = ((otData as OTDetailsSupabase[]) || []).map((otRecord) => {
          const otDateIST = toIST(parseISO(otRecord.ot_date)) // ot_date is also timestamp with timezone
          const createdAtIST = toIST(parseISO(otRecord.created_at))
          const patientDetail = otRecord.patient_detail?.[0]
          return {
            ...otRecord,
            type: "OT",
            id: otRecord.id,
            patientId: patientDetail?.uhid || otRecord.uhid || "N/A",
            name: patientDetail?.name || "Unknown",
            phone: patientDetail?.number ? String(patientDetail.number) : "N/A",
            date: format(otDateIST, "yyyy-MM-dd"), // Use converted ot_date
            time: format(createdAtIST, "HH:mm"), // Use converted created_at for time
            message: otRecord.ot_notes || "No notes",
          }
        })
        allPatientApps.push(...mappedOt)

        setPatientAllAppointments(
          allPatientApps.sort((a, b) => {
            const getDateAndTimeInIST = (app: CombinedAppointment) => {
              let dateStr: string
              let timeStr: string | null

              if (app.type === "IPD") {
                dateStr = app.admission_date
                timeStr = app.admission_time
              } else if (app.type === "OT") {
                dateStr = app.date // This will be the already converted `ot_date` (YYYY-MM-DD string)
                timeStr = app.time // This will be the already converted `created_at` time (HH:mm string)
              } else {
                // OPD
                dateStr = app.date // This will be the already converted `date` (YYYY-MM-DD string)
                timeStr = app.time // This will be the already converted `created_at` time (HH:mm string)
              }
              return toIST(parseISO(`${dateStr}T${timeStr || "00:00"}`))
            }
            const dateTimeA = getDateAndTimeInIST(a)
            const dateTimeB = getDateAndTimeInIST(b)

            return dateTimeB.getTime() - dateTimeA.getTime()
          }),
        )
      } catch (err) {
        console.error("Error fetching patient's appointments:", err)
        toast.error("Failed to load patient's appointments.")
        setPatientAllAppointments([])
      } finally {
        setPatientAppointmentsLoading(false)
      }
    },
    [],
  )

  // New: Open modal for patient's appointments
  const openPatientAppointmentsModal = async (patient: PatientInfo) => {
    setSelectedPatientForAppointments(patient)
    setPatientAppointmentsModalOpen(true)
    await fetchAllAppointmentsForPatient(patient.uhid)
  }

  // New: Close modal for patient's appointments
  const closePatientAppointmentsModal = () => {
    setPatientAppointmentsModalOpen(false)
    setSelectedPatientForAppointments(null)
    setPatientAllAppointments([])
  }

  const getBadgeColor = (t: string) => {
    switch (t) {
      case "OPD":
        return "bg-sky-100 text-sky-800"
      case "IPD":
        return "bg-orange-100 text-orange-800"
      case "OT":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getFilterTitle = () => {
    // Use filters directly for filterType, and currentDateRange for display dates
    const { filterType } = filters
    const { displayStart, displayEnd } = currentDateRange

    switch (filterType) {
      case "today":
        // Display today's date in IST (from displayStart)
        return `Today's Data (${format(parseISO(displayStart), "MMM dd, yyyy")})`
      case "month":
        // filters.selectedMonth is 'YYYY-MM', parse it as a local date for formatting
        return `${format(parseISO(filters.selectedMonth + "-01"), "MMMM yyyy")} Data`
      case "dateRange":
        if (!filters.startDate || !filters.endDate) return "Select date range"
        // filters.startDate/endDate are already YYYY-MM-DD local strings
        return `${format(parseISO(filters.startDate), "MMM dd")} - ${format(parseISO(filters.endDate), "MMM dd, yyyy")}`
      case "week":
      default:
        // displayStart/displayEnd are already YYYY-MM-DD local strings from calculation
        return `Week: ${format(parseISO(displayStart), "MMM dd")} - ${format(parseISO(displayEnd), "MMM dd, yyyy")}`
    }
  }

  const getModalitiesSummary = (mods: IModality[]) => {
    const counts = {
      consultation: mods.filter((m) => m.type === "consultation").length,
      casualty: mods.filter((m) => m.type === "casualty").length,
      xray: mods.filter((m) => m.type === "xray").length,
      custom: mods.filter((m) => m.type === "custom").length,
      pathology: mods.filter((m) => m.type === "pathology").length,
      radiology: mods.filter((m) => m.type === "radiology").length,
      ipd: mods.filter((m) => m.type === "ipd").length,
    }
    const parts: string[] = []
    if (counts.consultation) parts.push(`${counts.consultation} Consultation${counts.consultation > 1 ? "s" : ""}`)
    if (counts.casualty) parts.push(`${counts.casualty} Casualty`)
    if (counts.xray) parts.push(`${counts.xray} X-ray${counts.xray > 1 ? "s" : ""}`)
    if (counts.pathology) parts.push(`${counts.pathology} Pathology`)
    if (counts.radiology) parts.push(`${counts.radiology} Radiology`)
    if (counts.ipd) parts.push(`${counts.ipd} IPD Service${counts.ipd > 1 ? "s" : ""}`)
    if (counts.custom) parts.push(`${counts.custom} Custom Service${counts.custom > 1 ? "s" : ""}`)
    return parts.join(", ") || "No services"
  }

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-[1600px] mx-auto">
          {/* Header & Search */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-lg">
            <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="p-2 bg-gradient-to-r from-sky-500 to-blue-600 rounded-lg mr-3 shadow-md">
                  <Activity className="text-white h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
                  G-MEDFORD-NX HOSPITAL
                </h1>
              </div>
              <div className="relative w-full md:w-1/3">
                <Search className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Search by name, phone, or UHID (min 3 chars)"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters((p) => ({ ...p, searchQuery: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition shadow-sm"
                />
                {filters.searchQuery.length >= 3 && searchDownloadedBytes > 0 && (
                  <p className="absolute -bottom-5 right-0 text-xs text-gray-500">
                    Downloaded: {formatBytes(searchDownloadedBytes)}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="p-6">
            {/* Advanced Filters (Hidden when searching) */}
            {!filters.searchQuery && (
              <div className="bg-white rounded-xl shadow-lg mb-6 p-6 border border-gray-100">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center mb-4 lg:mb-0">
                    <Filter className="mr-2 h-5 w-5 text-sky-500" /> Advanced Filters
                  </h2>
                  <Button
                    onClick={resetFilters}
                    variant="outline"
                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 flex items-center shadow-sm"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset All
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Quick Filters */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Quick Filters</label>
                    <div className="flex flex-wrap gap-2">
                      {["today", "week", "month"].map((mode) => {
                        const label = mode === "week" ? "This Week" : mode === "today" ? "Today" : "This Month"
                        return (
                          <Button
                            key={mode}
                            onClick={() =>
                              handleFilterChange({
                                filterType: mode as any,
                                ...(mode === "month" ? { selectedMonth: format(toIST(new Date()), "yyyy-MM") } : {}),
                              })
                            }
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${
                              filters.filterType === mode
                                ? "bg-sky-600 text-white shadow-md"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Month Filter */}
                  <div>
                    <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by Month
                    </label>
                    <Input
                      type="month"
                      id="month"
                      value={filters.selectedMonth}
                      onChange={(e) => handleFilterChange({ selectedMonth: e.target.value, filterType: "month" })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                    />
                  </div>
                  {/* Date Range Filter */}
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      id="startDate"
                      value={filters.startDate}
                      onChange={(e) => handleDateRangeChange(e.target.value, filters.endDate)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                      End Date (Max 30 days)
                    </label>
                    <Input
                      type="date"
                      id="endDate"
                      value={filters.endDate}
                      onChange={(e) => handleDateRangeChange(filters.startDate, e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                    />
                  </div>
                </div>
                <div className="mt-4 p-3 bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg border border-sky-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CalendarDays className="mr-2 h-5 w-5 text-sky-600" />
                      <span className="text-sky-800 font-medium">{getFilterTitle()}</span>
                    </div>
                    {totalDownloadedBytes > 0 && (
                      <span className="text-xs text-gray-500">
                        Total Data Downloaded: <b>{formatBytes(totalDownloadedBytes)}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Dashboard Statistics (Hidden when searching) */}
            {!filters.searchQuery && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  {/* OPD */}
                  <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-gradient-to-r from-sky-100 to-blue-100 rounded-full shadow-md">
                        <Activity className="text-sky-600 h-6 w-6" />
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-sm">OPD</p>
                        <p className="text-2xl font-bold text-gray-900">{statistics.totalOpdCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Revenue</span>
                      <span className="text-lg font-semibold text-sky-600">
                        {formatCurrency(statistics.totalOpdAmount)}
                      </span>
                    </div>
                  </Card>
                  {/* IPD */}
                  <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-gradient-to-r from-orange-100 to-red-100 rounded-full shadow-md">
                        <Layers className="text-orange-600 h-6 w-6" />
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-sm">IPD</p>
                        <p className="text-2xl font-bold text-gray-900">{statistics.totalIpdCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Net Deposit</span>
                      <span className="text-lg font-semibold text-orange-600">
                        {formatCurrency(statistics.totalIpdAmount)}
                      </span>
                    </div>
                    {statistics.overallIpdRefunds > 0 && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-600">Total Refunds</span>
                        <span className="text-lg font-semibold text-blue-600">
                          {formatCurrency(statistics.overallIpdRefunds)}
                        </span>
                      </div>
                    )}
                  </Card>
                  {/* OT */}
                  <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full shadow-md">
                        <Stethoscope className="text-purple-600 h-6 w-6" />
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-sm">OT</p>
                        <p className="text-2xl font-bold text-gray-900">{statistics.totalOtCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Procedures</span>
                      <span className="text-lg font-semibold text-purple-600">{statistics.totalOtCount}</span>
                    </div>
                  </Card>
                  {/* Total Revenue */}
                  <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-gradient-to-r from-emerald-100 to-green-100 rounded-full shadow-md">
                        <DollarSign className="text-emerald-600 h-6 w-6" />
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-sm">Total</p>
                        <p className="text-2xl font-bold text-gray-900">Revenue</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Amount</span>
                      <span className="text-lg font-semibold text-emerald-600">
                        {formatCurrency(statistics.totalRevenue)}
                      </span>
                    </div>
                  </Card>
                </div>
                {/* Payment Breakdown & Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Payment Breakdown */}
                  <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <CreditCard className="mr-2 h-5 w-5" /> Payment Breakdown
                    </h2>
                    <div className="space-y-6">
                      <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg p-4 shadow-sm">
                        <h3 className="font-medium text-sky-800 mb-3">OPD Payments</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">💵 Cash</span>
                            <span className="font-semibold text-sky-600">{formatCurrency(statistics.opdCash)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">💳 Online</span>
                            <span className="font-semibold text-sky-600">{formatCurrency(statistics.opdOnline)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-sky-200">
                            <span className="text-sky-700 font-medium">Total OPD</span>
                            <span className="font-bold text-sky-700">{formatCurrency(statistics.totalOpdAmount)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 shadow-sm">
                        <h3 className="font-medium text-orange-800 mb-3">IPD Payments</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">💵 Cash</span>
                            <span className="font-semibold text-orange-600">{formatCurrency(statistics.ipdCash)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">💳 Online</span>
                            <span className="font-semibold text-orange-600">
                              {formatCurrency(statistics.ipdOnline)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-orange-200">
                            <span className="text-orange-700 font-medium">Total IPD (Net Deposit)</span>
                            <span className="font-bold text-orange-700">
                              {formatCurrency(statistics.totalIpdAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-4 shadow-md">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-800 font-semibold">💰 Grand Total</span>
                          <span className="font-bold text-xl text-emerald-600">
                            {formatCurrency(statistics.totalRevenue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                  {/* Appointments Overview Chart */}
                  <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <Activity className="mr-2 h-5 w-5 text-gray-600" /> Appointments Overview
                    </h2>
                    <Bar
                      data={chartData}
                      options={{
                        responsive: true,
                        plugins: { legend: { position: "top" } },
                        scales: {
                          y: { beginAtZero: true, ticks: { stepSize: 1 } },
                        },
                      }}
                    />
                  </Card>
                </div>
                {/* Doctor Consultations List & Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* List */}
                  <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <UserCheck className="mr-2 h-5 w-5 text-gray-600" /> Doctor Consultations
                    </h2>
                    {doctorConsultations.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Doctor Name
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Consultations
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {doctorConsultations.map((doc) => (
                              <tr key={doc.doctorName} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {doc.doctorName}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{doc.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <p>No consultation data for the selected period.</p>
                      </div>
                    )}
                  </Card>
                  {/* Chart */}
                  <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <UserCheck className="mr-2 h-5 w-5 text-gray-600" /> Top Doctors by Consultations
                    </h2>
                    {doctorConsultChartData.labels.length > 0 ? (
                      <Bar
                        data={doctorConsultChartData}
                        options={{
                          responsive: true,
                          plugins: { legend: { position: "top" } },
                          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                        }}
                      />
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <p>No data to display chart for the selected period.</p>
                      </div>
                    )}
                  </Card>
                </div>
              </>
            )}
            {/* Appointments/Patients Table */}
            <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-gray-600" />{" "}
                  {filters.searchQuery ? "Patient Search Results" : "Appointments List"}
                </h2>
              </div>
              {isLoading ? (
                <div className="flex justify-center items-center p-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
                  <span className="ml-3 text-gray-600">Loading data...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {filters.searchQuery ? (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              UHID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Patient Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Phone
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Age / Gender
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </>
                        ) : (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Patient
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Contact
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date & Time
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Services/Amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filters.searchQuery ? (
                        searchedPatients.length > 0 ? (
                          searchedPatients.map((patient) => (
                            <tr key={patient.uhid} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {patient.uhid}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="p-2 bg-gray-100 rounded-full mr-3">
                                    <User className="h-4 w-4 text-gray-600" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">{patient.phone}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{patient.age || "N/A"}</div>
                                <div className="text-xs text-gray-500">{patient.gender || "N/A"}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <Button
                                  onClick={() => openPatientAppointmentsModal(patient)}
                                  className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors shadow-sm"
                                >
                                  View Appointments
                                </Button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center">
                                <FileText className="h-12 w-12 text-gray-300 mb-4" />
                                <p className="text-gray-500 text-lg">No patients found matching your search.</p>
                                <p className="text-gray-400 text-sm">Try a different name or phone number.</p>
                              </div>
                            </td>
                          </tr>
                        )
                      ) : filteredAppointments.length > 0 ? (
                        filteredAppointments.map((app) => (
                          <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="p-2 bg-gray-100 rounded-full mr-3">
                                  <User className="h-4 w-4 text-gray-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{app.name}</div>
                                  <div className="text-xs text-gray-500">UHID: {app.patientId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{app.phone}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {format(
                                  parseISO(app.type === "OPD" || app.type === "OT" ? app.date : app.admission_date),
                                  "dd MMM, yyyy",
                                )}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {app.type === "OPD" || app.type === "OT" ? app.time : app.admission_time}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBadgeColor(app.type)}`}>
                                {app.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {app.type === "OPD" && (
                                <div>
                                  <div className="text-sm text-gray-600 mb-1">
                                    {getModalitiesSummary((app as OPDAppointmentDisplay).modalities)}
                                  </div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatCurrency((app as OPDAppointmentDisplay).payment.totalPaid)}
                                  </div>
                                </div>
                              )}
                              {app.type === "IPD" && (
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatCurrency((app as IPDAppointmentDisplay).totalDeposit)}
                                  </div>
                                  {((app as IPDAppointmentDisplay).remainingAmount ?? 0) > 0 && (
                                    <div className="text-xs text-red-500">
                                      Pending: {formatCurrency((app as IPDAppointmentDisplay).remainingAmount!)}
                                    </div>
                                  )}
                                </div>
                              )}
                              {app.type === "OT" && (
                                <div className="text-sm text-gray-500">
                                  Procedure: {(app as OTAppointmentDisplay).ot_type}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <Button
                                onClick={() => openModal(app)}
                                className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors shadow-sm"
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center">
                              <FileText className="h-12 w-12 text-gray-300 mb-4" />
                              <p className="text-gray-500 text-lg">No appointments found</p>
                              <p className="text-gray-400 text-sm">Try adjusting your filters</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Appointment Details Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold mb-6 flex items-center">
                <div
                  className={`p-3 rounded-full mr-4 shadow-md ${
                    selectedAppointment?.type === "OPD"
                      ? "bg-gradient-to-r from-sky-100 to-blue-100"
                      : selectedAppointment?.type === "IPD"
                      ? "bg-gradient-to-r from-orange-100 to-red-100"
                      : "bg-gradient-to-r from-purple-100 to-pink-100"
                  }`}
                >
                  {selectedAppointment?.type === "OPD" && <Activity className="text-sky-600 h-6 w-6" />}
                  {selectedAppointment?.type === "IPD" && <Layers className="text-orange-600 h-6 w-6" />}
                  {selectedAppointment?.type === "OT" && <Stethoscope className="text-purple-600 h-6 w-6" />}
                </div>
                {selectedAppointment?.type} Appointment Details
              </DialogTitle>
              <DialogDescription className="sr-only">Patient ID: {selectedAppointment?.patientId}</DialogDescription>
            </DialogHeader>
            {modalLoading ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500"></div>
                <span className="ml-3 text-gray-600">Loading details...</span>
              </div>
            ) : (
              selectedAppointment && (
                <>
                  {/* Patient Info */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 mb-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <User className="mr-2 h-5 w-5 text-gray-600" /> Patient Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500">Patient Name</p>
                          <p className="font-medium text-lg">{selectedAppointment.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <p className="font-medium">{selectedAppointment.phone}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Date</p>
                          <p className="font-medium">
                            {format(
                              parseISO(
                                selectedAppointment.type === "IPD"
                                  ? selectedAppointment.admission_date
                                  : selectedAppointment.date,
                              ),
                              "dd MMM, yyyy",
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500">UHID</p>
                          <p className="font-medium">{selectedAppointment.patientId}</p>
                        </div>
                        {selectedAppointment.type === "IPD" && (
                          <div>
                            <p className="text-sm text-gray-500">Room Type</p>
                            <p className="font-medium">{(selectedAppointment as IPDAppointmentDisplay).roomType}</p>
                          </div>
                        )}
                        {selectedAppointment.type === "OT" && (
                          <div>
                            <p className="text-sm text-gray-500">IPD ID (for OT)</p>
                            <p className="font-medium">{(selectedAppointment as OTAppointmentDisplay).ipd_id}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* OPD Details */}
                  {selectedAppointment.type === "OPD" && (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-sky-800 mb-4">OPD Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm text-gray-500">Time</p>
                              <p className="font-medium">{(selectedAppointment as OPDAppointmentDisplay).time}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Appointment Type</p>
                              <p className="font-medium capitalize">
                                {(selectedAppointment as OPDAppointmentDisplay).appointment_type || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Visit Type</p>
                              <p className="font-medium capitalize">
                                {(selectedAppointment as OPDAppointmentDisplay).visit_type || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm text-gray-500">Payment Method</p>
                              <p className="font-medium capitalize">
                                {(selectedAppointment as OPDAppointmentDisplay).payment.paymentMethod}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Total Amount</p>
                              <p className="font-bold text-xl text-sky-600">
                                {formatCurrency((selectedAppointment as OPDAppointmentDisplay).payment.totalPaid)}
                              </p>
                            </div>
                            {(selectedAppointment as OPDAppointmentDisplay).payment.discount > 0 && (
                              <div>
                                <p className="text-sm text-gray-500">Discount</p>
                                <p className="font-medium text-red-600">
                                  {formatCurrency((selectedAppointment as OPDAppointmentDisplay).payment.discount)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        {(selectedAppointment as OPDAppointmentDisplay).additional_notes && (
                          <div className="mt-4 p-3 bg-white rounded-lg border border-sky-200 shadow-sm">
                            <p className="text-sm text-gray-500">Notes</p>
                            <p className="font-medium">
                              {(selectedAppointment as OPDAppointmentDisplay).additional_notes}
                            </p>
                          </div>
                        )}
                      </div>
                      {(selectedAppointment as OPDAppointmentDisplay).modalities.length > 0 && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 shadow-sm">
                          <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
                            <FileText className="mr-2 h-5 w-5" /> Services & Modalities
                          </h3>
                          <div className="space-y-3">
                            {(selectedAppointment as OPDAppointmentDisplay).modalities.map(
                              (m: IModality, i: number) => (
                                <div key={i} className="border border-purple-200 rounded p-3 bg-white shadow-sm">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium capitalize">
                                      {m.type}
                                    </span>
                                    <span className="font-semibold text-purple-700">₹{m.charges}</span>
                                  </div>
                                  {m.doctor && (
                                    <div className="text-xs text-gray-600">
                                      <strong>Doctor:</strong> {m.doctor}
                                    </div>
                                  )}
                                  {m.specialist && (
                                    <div className="text-xs text-gray-600">
                                      <strong>Specialist:</strong> {m.specialist}
                                    </div>
                                  )}
                                  {m.service && (
                                    <div className="text-xs text-gray-600">
                                      <strong>Service:</strong> {m.service}
                                    </div>
                                  )}
                                  {m.visitType && (
                                    <div className="text-xs text-gray-600">
                                      <strong>Visit Type:</strong> {m.visitType}
                                    </div>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                          <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200 shadow-sm">
                            <div className="flex justify-between items-center text-lg font-semibold">
                              <span className="text-purple-700">Total Charges:</span>
                              <span className="text-purple-600">
                                ₹{(selectedAppointment as OPDAppointmentDisplay).payment.totalCharges}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                          <CreditCard className="mr-2 h-5 w-5" /> Payment Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Cash Amount:</span>
                              <span className="font-semibold text-green-700">
                                ₹{(selectedAppointment as OPDAppointmentDisplay).payment.cashAmount}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Online Amount:</span>
                              <span className="font-semibold text-blue-700">
                                ₹{(selectedAppointment as OPDAppointmentDisplay).payment.onlineAmount}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Charges:</span>
                              <span className="font-semibold">
                                ₹{(selectedAppointment as OPDAppointmentDisplay).payment.totalCharges}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Discount:</span>
                              <span className="font-semibold text-red-600">
                                ₹{(selectedAppointment as OPDAppointmentDisplay).payment.discount}
                              </span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                              <span className="text-green-700 font-bold">Total Paid:</span>
                              <span className="font-bold text-green-600">
                                ₹{(selectedAppointment as OPDAppointmentDisplay).payment.totalPaid}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* IPD Details */}
                  {selectedAppointment.type === "IPD" && (
                    <div className="space-y-6">
                      {(selectedAppointment as IPDAppointmentDisplay).service_detail &&
                        (selectedAppointment as IPDAppointmentDisplay).service_detail!.length > 0 && (
                          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center">
                              <FileText className="mr-2 h-5 w-5" /> Services & Charges
                            </h3>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-orange-200">
                                <thead className="bg-orange-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">
                                      Service
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">
                                      Type
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">
                                      Doctor
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">
                                      Amount
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-orange-100">
                                  {(selectedAppointment as IPDAppointmentDisplay).service_detail!.map((s, i) => (
                                    <tr key={i} className="hover:bg-orange-50">
                                      <td className="px-4 py-2 text-sm text-gray-900">{s.serviceName}</td>
                                      <td className="px-4 py-2 text-sm text-gray-600 capitalize">{s.type}</td>
                                      <td className="px-4 py-2 text-sm text-gray-600">{s.doctorName || "-"}</td>
                                      <td className="px-4 py-2 text-sm font-medium text-orange-600">
                                        {formatCurrency(s.amount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-4 p-4 bg-white rounded-lg border border-orange-200 shadow-sm">
                              <div className="flex justify-between items-center text-lg font-semibold">
                                <span className="text-orange-700">Total Service Amount:</span>
                                <span className="text-orange-600">
                                  {formatCurrency((selectedAppointment as IPDAppointmentDisplay).totalAmount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      {(selectedAppointment as IPDAppointmentDisplay).payment_detail &&
                        (selectedAppointment as IPDAppointmentDisplay).payment_detail!.length > 0 && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                              <CreditCard className="mr-2 h-5 w-5" /> Payment History
                            </h3>
                            <div className="space-y-3">
                              {(selectedAppointment as IPDAppointmentDisplay).payment_detail!.map((p, i) => (
                                <div
                                  key={p.id || i}
                                  className="flex justify-between items-center p-3 bg-white rounded-lg border border-green-200 shadow-sm"
                                >
                                  <div>
                                    <span className="font-medium text-green-700">
                                      {p.paymentType.toUpperCase()} - {p.type.toUpperCase()}
                                    </span>
                                    {p.date && (
                                      <p className="text-sm text-gray-500">
                                        {format(parseISO(p.date), "dd MMM, yyyy")}
                                      </p>
                                    )}
                                  </div>
                                  <span className="font-bold text-green-600">{formatCurrency(p.amount)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 p-4 bg-white rounded-lg border border-green-200 shadow-sm">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-green-700">Total Paid:</span>
                                  <span className="font-bold text-green-600">
                                    {formatCurrency((selectedAppointment as IPDAppointmentDisplay).totalDeposit)}
                                  </span>
                                </div>
                                {(selectedAppointment as IPDAppointmentDisplay).remainingAmount! > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-red-700">Remaining:</span>
                                    <span className="font-bold text-red-600">
                                      {formatCurrency((selectedAppointment as IPDAppointmentDisplay).remainingAmount!)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-lg p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                          <DollarSign className="mr-2 h-5 w-5" /> Financial Summary
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Total Services:</span>
                            <span className="font-semibold text-blue-700">
                              {formatCurrency((selectedAppointment as IPDAppointmentDisplay).totalAmount)}
                            </span>
                          </div>
                          {(selectedAppointment as IPDAppointmentDisplay).discount > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Discount Applied:</span>
                              <span className="font-semibold text-red-600">
                                {formatCurrency((selectedAppointment as IPDAppointmentDisplay).discount)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Total Net Payments:</span>
                            <span className="font-semibold text-green-700">
                              {formatCurrency((selectedAppointment as IPDAppointmentDisplay).totalDeposit)}
                            </span>
                          </div>
                          {(selectedAppointment as IPDAppointmentDisplay).totalRefunds > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Total Refunds Issued:</span>
                              <span className="font-semibold text-red-600">
                                {formatCurrency((selectedAppointment as IPDAppointmentDisplay).totalRefunds)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-3 border-t border-blue-200">
                            <span className="text-blue-800 font-bold text-lg">Net Balance:</span>
                            <span
                              className={`font-bold text-xl ${
                                (selectedAppointment as IPDAppointmentDisplay).remainingAmount! > 0
                                  ? "text-red-600"
                                  : (selectedAppointment as IPDAppointmentDisplay).remainingAmount! < 0
                                  ? "text-green-600"
                                  : "text-gray-800"
                              }`}
                            >
                              {formatCurrency((selectedAppointment as IPDAppointmentDisplay).remainingAmount!)}
                              {(selectedAppointment as IPDAppointmentDisplay).remainingAmount! > 0
                                ? " (Due)"
                                : (selectedAppointment as IPDAppointmentDisplay).remainingAmount! < 0
                                ? " (Refundable)"
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* OT Details */}
                  {selectedAppointment.type === "OT" && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
                        <Stethoscope className="mr-2 h-5 w-5" /> OT Details
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500">Time</p>
                          <p className="font-medium">{(selectedAppointment as OTAppointmentDisplay).time}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Procedure Notes</p>
                          <p className="font-medium">{(selectedAppointment as OTAppointmentDisplay).message}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </DialogContent>
        </Dialog>
        {/* New: Patient Appointments Details Modal */}
        <Dialog open={patientAppointmentsModalOpen} onOpenChange={closePatientAppointmentsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold mb-6 flex items-center">
                <User className="p-2 rounded-full mr-4 bg-gradient-to-r from-sky-100 to-blue-100 text-sky-600 h-10 w-10 shadow-md" />
                <span>
                  Appointments for {selectedPatientForAppointments?.name} (UHID:{" "}
                  {selectedPatientForAppointments?.uhid})
                </span>
              </DialogTitle>
              <DialogDescription>All recorded appointments for this patient.</DialogDescription>
            </DialogHeader>
            {patientAppointmentsLoading ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500"></div>
                <span className="ml-3 text-gray-600">Loading patient appointments...</span>
              </div>
            ) : (
              <>
                {patientAllAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {patientAllAppointments.map((app) => (
                      <div key={app.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBadgeColor(app.type)}`}>
                            {app.type}
                          </span>
                          <span className="text-sm text-gray-600">
                            {format(parseISO(app.type === "IPD" ? app.admission_date : app.date), "dd MMM, yyyy")}{" "}
                            {" at "}
                            {app.type === "OPD" || app.type === "OT" ? app.time : app.admission_time}
                          </span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          {app.type === "OPD" &&
                            `OPD Visit - ${getModalitiesSummary((app as OPDAppointmentDisplay).modalities)}`}
                          {app.type === "IPD" &&
                            `IPD Admission - ${formatCurrency((app as IPDAppointmentDisplay).totalAmount)}`}
                          {app.type === "OT" && `OT Procedure - ${(app as OTAppointmentDisplay).ot_type}`}
                        </p>
                        {app.type === "OPD" && (
                          <p className="text-sm text-gray-700">
                            Total Paid: {formatCurrency((app as OPDAppointmentDisplay).payment.totalPaid)}
                          </p>
                        )}
                        {app.type === "IPD" && (
                          <p className="text-sm text-gray-700">
                            Net Deposit: {formatCurrency((app as IPDAppointmentDisplay).totalDeposit)}
                          </p>
                        )}
                        <Button
                          onClick={() => openModal(app)}
                          className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors shadow-sm"
                        >
                          View Full Details
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p>No appointments found for this patient.</p>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </Layout>
  )
}

export default DashboardPage