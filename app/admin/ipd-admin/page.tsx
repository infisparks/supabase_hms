"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase" // Assuming your Supabase client is configured here
import { toast } from "sonner" // For notifications
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  isWithinInterval,
  parseISO,
  startOfDay,
  endOfDay,
} from "date-fns"
import {
  Bed,
  Users,
  Search,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  FileText,
  CreditCard,
  Plus,
  CalendarDays,
  TrendingUp,
  X,
} from "lucide-react"
import { Dialog, Transition } from "@headlessui/react" // For modals
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts" // For charts

// Assuming these are from shadcn/ui or similar component library
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Layout from "@/components/global/Layout" // Assuming your global layout component

// Re-using types from your provided BillingPage for consistency
interface PatientDetailSupabase {
  patient_id: number
  name: string
  number: number | null
  age: number | null
  gender: string | null
  address: string | null
  age_unit: string | null
  dob: string | null
  uhid: string
}

interface BedManagementSupabase {
  id: number
  room_type: string
  bed_number: number
  bed_type: string
  status: string
}

interface PaymentDetailItemSupabase {
  id: string
  amount: number
  createdAt: string
  date: string
  paymentType: string
  type: "advance" | "refund" | "deposit" | "discount"
  through?: string
}

interface ServiceDetailItemSupabase {
  id: string
  amount: number
  createdAt: string
  doctorName: string
  serviceName: string
  type: "service" | "doctorvisit"
}

interface IPDRegistrationSupabaseJoined {
  ipd_id: number
  admission_source: string | null
  admission_type: string | null
  under_care_of_doctor: string | null
  payment_detail: PaymentDetailItemSupabase[] | null
  bed_id: bigint | null
  service_detail: ServiceDetailItemSupabase[] | null
  created_at: string
  discharge_date: string | null
  relative_name: string | null
  relative_ph_no: number | null
  relative_address: string | null
  admission_date: string | null
  admission_time: string | null
  uhid: string
  patient_detail: PatientDetailSupabase | null
  bed_management: BedManagementSupabase | null
}

export interface BillingRecord {
  patientId: string
  uhid: string
  ipdId: string
  name: string
  mobileNumber: string
  address?: string | null
  age?: number | null
  ageUnit?: string | null
  gender?: string | null
  dob?: string | null
  relativeName?: string | null
  relativePhone?: number | null
  relativeAddress?: string | null
  dischargeDate?: string | null
  totalDeposit: number
  roomType?: string | null
  bedNumber?: number | string | null
  bedType?: string | null
  services: ServiceDetailItemSupabase[]
  payments: PaymentDetailItemSupabase[]
  discount: number
  admitDate?: string | null
  admissionTime?: string | null
  createdAt?: string
  doctor?: string | null
}

export default function IPDAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ipdSummary, setIpdSummary] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  })
  const [ipdTrendData, setIpdTrendData] = useState<{ date: string; admissions: number }[]>([])
  const [patients, setPatients] = useState<IPDRegistrationSupabaseJoined[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPatientForHistory, setSelectedPatientForHistory] = useState<BillingRecord | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // State for date filtering the patient list
  const [filterStartDate, setFilterStartDate] = useState<string | null>(null)
  const [filterEndDate, setFilterEndDate] = useState<string | null>(null)

  // Fetches summary data for IPD admissions (today, this week, this month) and trend data for the last 30 days
  const fetchIPDSummary = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from("ipd_registration").select("created_at") // Only need admission date for summary

      if (error) {
        console.error("Error fetching IPD summary:", error)
        toast.error("Failed to load IPD summary.")
        return
      }

      const now = new Date()
      const today = format(now, "yyyy-MM-dd")
      const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 }) // Monday as start of week
      const endOfCurrentWeek = endOfWeek(now, { weekStartsOn: 1 })
      const startOfCurrentMonth = startOfMonth(now)
      const endOfCurrentMonth = endOfMonth(now)

      let todayCount = 0
      let thisWeekCount = 0
      let thisMonthCount = 0

      const admissionsByDate: Record<string, number> = {}

      data.forEach((record) => {
        const createdAt = parseISO(record.created_at)
        const recordDate = format(createdAt, "yyyy-MM-dd")

        // For summary counts
        if (recordDate === today) {
          todayCount++
        }
        if (isWithinInterval(createdAt, { start: startOfCurrentWeek, end: endOfCurrentWeek })) {
          thisWeekCount++
        }
        if (isWithinInterval(createdAt, { start: startOfCurrentMonth, end: endOfCurrentMonth })) {
          thisMonthCount++
        }

        // For trend data (last 30 days)
        const dateKey = format(createdAt, "MMM dd")
        admissionsByDate[dateKey] = (admissionsByDate[dateKey] || 0) + 1
      })

      setIpdSummary({
        today: todayCount,
        thisWeek: thisWeekCount,
        thisMonth: thisMonthCount,
      })

      // Generate trend data for the last 30 days, ensuring all days are present
      const trendData = []
      for (let i = 29; i >= 0; i--) {
        const date = subDays(now, i)
        const formattedDate = format(date, "MMM dd")
        trendData.push({
          date: formattedDate,
          admissions: admissionsByDate[formattedDate] || 0,
        })
      }
      setIpdTrendData(trendData)
    } catch (error) {
      console.error("Error in fetchIPDSummary:", error)
      toast.error("Error loading IPD summary.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetches the list of all IPD patients for the table, with date filtering
  const fetchPatients = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from("ipd_registration").select(
        `
          ipd_id,
          uhid,
          admission_date,
          admission_time,
          discharge_date,
          under_care_of_doctor,
          patient_detail (patient_id, name, number, age, gender, address, age_unit, dob, uhid),
          bed_management (id, room_type, bed_number, bed_type, status)
        `,
      )

      if (filterStartDate) {
        query = query.gte("admission_date", format(startOfDay(parseISO(filterStartDate)), "yyyy-MM-dd"))
      }
      if (filterEndDate) {
        query = query.lte("admission_date", format(endOfDay(parseISO(filterEndDate)), "yyyy-MM-dd"))
      }

      query = query.order("admission_date", { ascending: false }) // Order by most recent admissions

      const { data, error } = await query

      if (error) {
        console.error("Error fetching patients:", error)
        toast.error("Failed to load patient list.")
        setPatients([])
        return
      }
      setPatients(data as unknown as IPDRegistrationSupabaseJoined[])
    } catch (error) {
      console.error("Error in fetchPatients:", error)
      toast.error("Error loading patient list.")
    } finally {
      setLoading(false)
    }
  }, [filterStartDate, filterEndDate]) // Re-fetch when date filters change

  // Initial data fetch on component mount
  useEffect(() => {
    fetchIPDSummary()
    fetchPatients()
  }, [fetchIPDSummary, fetchPatients])

  // Filters patients based on the search term (applied after date filtering)
  const filteredPatients = useMemo(() => {
    if (!searchTerm) {
      return patients
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase()
    return patients.filter(
      (patient) =>
        patient.patient_detail?.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        patient.uhid?.toLowerCase().includes(lowerCaseSearchTerm) ||
        patient.patient_detail?.number?.toString().includes(lowerCaseSearchTerm) ||
        patient.ipd_id.toString().includes(lowerCaseSearchTerm),
    )
  }, [patients, searchTerm])

  // Handlers for date filter buttons
  const handleFilterToday = () => {
    const today = format(new Date(), "yyyy-MM-dd")
    setFilterStartDate(today)
    setFilterEndDate(today)
  }

  const handleFilterThisWeek = () => {
    setFilterStartDate(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"))
    setFilterEndDate(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"))
  }

  const handleFilterThisMonth = () => {
    setFilterStartDate(format(startOfMonth(new Date()), "yyyy-MM-dd"))
    setFilterEndDate(format(endOfMonth(new Date()), "yyyy-MM-dd"))
  }

  const handleClearDateFilters = () => {
    setFilterStartDate(null)
    setFilterEndDate(null)
  }

  // Handles opening the patient history modal and fetching detailed data
  const handleViewPatientHistory = useCallback(async (ipdId: number) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("ipd_registration")
        .select(
          `*,
            patient_detail (patient_id, name, number, age, gender, address, age_unit, dob, uhid),
            bed_management (id, room_type, bed_number, bed_type, status)
          `,
        )
        .eq("ipd_id", ipdId)
        .single<IPDRegistrationSupabaseJoined>()

      if (error) {
        console.error("Error fetching IPD record for history:", error)
        toast.error("Failed to load patient history.")
        setSelectedPatientForHistory(null)
        return
      }

      if (!data) {
        toast.error("Patient history not found.")
        setSelectedPatientForHistory(null)
        return
      }

      // Process payment and service details to match BillingRecord structure
      const payments = (data.payment_detail || []) as PaymentDetailItemSupabase[]
      const services = (data.service_detail || []) as ServiceDetailItemSupabase[]

      let totalDeposit = 0
      let totalDiscount = 0
      payments.forEach((p) => {
        if (p.type === "advance" || p.type === "deposit") {
          totalDeposit += p.amount
        } else if (p.type === "refund") {
          totalDeposit -= p.amount
        } else if (p.type === "discount") {
          totalDiscount += p.amount
        }
      })

      const processedRecord: BillingRecord = {
        ipdId: String(data.ipd_id),
        uhid: data.uhid,
        patientId: String(data.patient_detail?.patient_id || "N/A"),
        name: data.patient_detail?.name || "Unknown",
        mobileNumber: data.patient_detail?.number ? String(data.patient_detail.number) : "N/A",
        address: data.patient_detail?.address || null,
        age: data.patient_detail?.age || null,
        ageUnit: data.patient_detail?.age_unit || null,
        gender: data.patient_detail?.gender || null,
        dob: data.patient_detail?.dob || null,
        relativeName: data.relative_name || null,
        relativePhone: data.relative_ph_no || null,
        relativeAddress: data.relative_address || null,
        dischargeDate: data.discharge_date,
        totalDeposit: totalDeposit,
        roomType: data.bed_management?.room_type || null,
        bedNumber: data.bed_management?.bed_number || null,
        bedType: data.bed_management?.bed_type || null,
        services: services,
        payments: payments,
        discount: totalDiscount,
        admitDate: data.admission_date || null,
        admissionTime: data.admission_time || null,
        createdAt: data.created_at,
        doctor: data.under_care_of_doctor || null,
      }
      setSelectedPatientForHistory(processedRecord)
      setIsHistoryModalOpen(true)
    } catch (error) {
      console.error("Error fetching patient history (catch block):", error)
      toast.error("Error loading patient history details.")
      setSelectedPatientForHistory(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Helper to aggregate consultant charges for display in the modal
  const aggregatedConsultantCharges = useMemo(() => {
    if (!selectedPatientForHistory) return {} as Record<string, any>
    const consultantChargeItems = selectedPatientForHistory.services.filter((s) => s.type === "doctorvisit")
    return consultantChargeItems.reduce(
      (acc, item) => {
        const key = item.doctorName || "Unknown"
        if (!acc[key]) {
          acc[key] = {
            doctorName: key,
            visited: 0,
            totalCharge: 0,
            lastVisit: null,
            items: [],
          }
        }
        acc[key].visited += 1
        acc[key].totalCharge += item.amount
        const itemDate = item.createdAt ? new Date(item.createdAt) : new Date(0)
        const currentLastVisit = acc[key].lastVisit
        if (currentLastVisit === null || itemDate > currentLastVisit) {
          acc[key].lastVisit = itemDate
        }
        acc[key].items.push(item)
        return acc
      },
      {} as Record<
        string,
        {
          doctorName: string
          visited: number
          totalCharge: number
          lastVisit: Date | null
          items: ServiceDetailItemSupabase[]
        }
      >,
    )
  }, [selectedPatientForHistory])

  // Calculate totals for the financial summary in the modal
  const hospitalServiceTotal = useMemo(() => {
    return (
      selectedPatientForHistory?.services.filter((s) => s.type === "service").reduce((sum, s) => sum + s.amount, 0) || 0
    )
  }, [selectedPatientForHistory])

  const consultantChargeTotal = useMemo(() => {
    return (
      selectedPatientForHistory?.services
        .filter((s) => s.type === "doctorvisit")
        .reduce((sum, s) => sum + s.amount, 0) || 0
    )
  }, [selectedPatientForHistory])

  const totalBill = useMemo(() => {
    return hospitalServiceTotal + consultantChargeTotal - (selectedPatientForHistory?.discount || 0)
  }, [hospitalServiceTotal, consultantChargeTotal, selectedPatientForHistory])

  const balanceAmount = useMemo(() => {
    return totalBill - (selectedPatientForHistory?.totalDeposit || 0)
  }, [totalBill, selectedPatientForHistory])

  // Loading state for the main page
  if (loading && !selectedPatientForHistory) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-150px)] bg-gradient-to-br from-cyan-50 to-teal-50 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-teal-600" />
            <p className="text-xl text-gray-600">Loading IPD admin data...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header and Summary Cards */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">IPD Admin Dashboard</h1>
            <p className="text-gray-600">Overview of In-Patient Department activities</p>
          </div>
          <button
            onClick={() => {
              fetchIPDSummary()
              fetchPatients()
            }}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className="mr-2" /> Refresh Data
          </button>
        </div>

        {/* Summary Cards: Today, This Week, This Month */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Today's Admissions</CardTitle>
              <CalendarDays className="h-4 w-4 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{ipdSummary.today}</div>
              <p className="text-xs text-white/70">New IPD patients today</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">This Week's Admissions</CardTitle>
              <TrendingUp className="h-4 w-4 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{ipdSummary.thisWeek}</div>
              <p className="text-xs text-white/70">Total IPD patients this week</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">This Month's Admissions</CardTitle>
              <Bed className="h-4 w-4 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{ipdSummary.thisMonth}</div>
              <p className="text-xs text-white/70">Total IPD patients this month</p>
            </CardContent>
          </Card>
        </div>

        {/* IPD Trend Graph */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              <span>IPD Admissions Trend (Last 30 Days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ipdTrendData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ipdTrendData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255,255,255,0.9)",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#333", fontWeight: "bold" }}
                      itemStyle={{ color: "#333" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="admissions"
                      stroke="#0D9488"
                      strokeWidth={2}
                      dot={{ stroke: "#0D9488", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 3, fill: "#0D9488" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No admission data available for the last 30 days.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patient List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-teal-600" />
              <span>IPD Patient List</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="lg:col-span-2">
                <label htmlFor="search" className="sr-only">
                  Search Patients
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="search"
                    type="text"
                    placeholder="Search by name, UHID, mobile, or IPD ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition duration-200"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={filterStartDate || ""}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={filterEndDate || ""}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="lg:col-span-4 flex flex-wrap gap-3">
                <button
                  onClick={handleFilterToday}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Today
                </button>
                <button
                  onClick={handleFilterThisWeek}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  This Week
                </button>
                <button
                  onClick={handleFilterThisMonth}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  This Month
                </button>
                {(filterStartDate || filterEndDate) && (
                  <button
                    onClick={handleClearDateFilters}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm flex items-center"
                  >
                    <X size={14} className="mr-1" /> Clear Filters
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-teal-600" />
                <p>Loading patient list...</p>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-yellow-500" />
                <p>No patients found matching your criteria or selected date range.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IPD ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        UHID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Admission Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Room/Bed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Doctor
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPatients.map((patient) => (
                      <tr key={patient.ipd_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {patient.ipd_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {patient.patient_detail?.name || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.uhid || "N/A"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {patient.admission_date ? format(parseISO(patient.admission_date), "dd MMM, yyyy") : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {patient.bed_management?.room_type || "N/A"} (Bed:{" "}
                          {patient.bed_management?.bed_number || "N/A"})
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {patient.under_care_of_doctor || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() => handleViewPatientHistory(patient.ipd_id)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                          >
                            View History <ArrowRight size={14} className="ml-1" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Patient History Modal */}
      <Transition appear show={isHistoryModalOpen} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsHistoryModalOpen(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-40" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full transform transition-all">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-2xl font-bold text-gray-800 flex items-center">
                    <FileText size={24} className="mr-3 text-teal-600" />
                    {selectedPatientForHistory?.name || "Patient"} IPD History
                  </Dialog.Title>
                  <button
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {selectedPatientForHistory ? (
                  <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                    {/* Patient Summary in Modal */}
                    <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-4 rounded-lg text-white shadow-md">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                          <h2 className="text-xl font-bold">{selectedPatientForHistory.name}</h2>
                          <p className="text-teal-50">UHID: {selectedPatientForHistory.uhid || "N/A"}</p>
                          <p className="text-teal-50 mt-1">
                            Under care of Dr.:{" "}
                            <span className="font-semibold">{selectedPatientForHistory.doctor || "N/A"}</span>
                          </p>
                        </div>
                        <div className="mt-2 md:mt-0 flex flex-col md:items-end">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-sm">
                            <Bed size={14} className="mr-2" />
                            {selectedPatientForHistory.roomType || "No Room"} •{" "}
                            {selectedPatientForHistory.bedNumber || "Unknown Bed"}
                          </div>
                          <div className="mt-2 text-teal-50 text-sm">
                            {selectedPatientForHistory.dischargeDate ? (
                              <span className="inline-flex items-center">
                                <AlertTriangle size={14} className="mr-1" /> Discharged:{" "}
                                {format(parseISO(selectedPatientForHistory.dischargeDate), "dd MMM, yyyy")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center">
                                <CalendarDays size={14} className="mr-1" /> Admitted:{" "}
                                {selectedPatientForHistory.admitDate
                                  ? format(parseISO(selectedPatientForHistory.admitDate), "dd MMM, yyyy")
                                  : "Unknown"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary in Modal */}
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <DollarSign size={18} className="mr-2 text-teal-600" /> Financial Overview
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-teal-50 rounded-lg p-4">
                          <p className="text-sm text-teal-600">Total Bill</p>
                          <p className="text-2xl font-bold text-teal-800">₹{totalBill.toLocaleString()}</p>
                        </div>
                        <div className="bg-cyan-50 rounded-lg p-4">
                          <p className="text-sm text-cyan-600">Total Payments Received</p>
                          <p className="text-2xl font-bold text-cyan-800">
                            ₹{selectedPatientForHistory.totalDeposit.toLocaleString()}
                          </p>
                        </div>
                        {balanceAmount > 0 ? (
                          <div className="bg-red-50 rounded-lg p-4">
                            <p className="text-sm text-red-600">Due Amount</p>
                            <p className="text-2xl font-bold text-red-800">₹{balanceAmount.toLocaleString()}</p>
                          </div>
                        ) : balanceAmount < 0 ? (
                          <div className="bg-blue-50 rounded-lg p-4">
                            <p className="text-sm text-blue-600">Amount to Refund</p>
                            <p className="text-2xl font-bold text-blue-800">
                              ₹{Math.abs(balanceAmount).toLocaleString()}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-green-50 rounded-lg p-4">
                            <p className="text-sm text-green-600">Balance</p>
                            <p className="text-2xl font-bold text-green-800">✓ Fully Paid</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Services History in Modal */}
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <Plus size={18} className="mr-2 text-teal-600" /> Hospital Services History
                      </h3>
                      {selectedPatientForHistory.services.filter((s) => s.type === "service").length === 0 ? (
                        <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                          No hospital services recorded.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[500px] divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Service Name
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Amount (₹)
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Date/Time
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {selectedPatientForHistory.services
                                .filter((s) => s.type === "service")
                                .map((service, idx) => (
                                  <tr key={idx}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                      {service.serviceName}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                      {service.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                      {service.createdAt ? new Date(service.createdAt).toLocaleString() : "N/A"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Consultant Charges History in Modal (Conditional Rendering) */}
                    {Object.keys(aggregatedConsultantCharges).length > 0 && (
                      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                          <Users size={18} className="mr-2 text-teal-600" /> Consultant Charges History
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[500px] divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Doctor
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Visits
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Total Charge (₹)
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Last Visit
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {Object.values(aggregatedConsultantCharges).map((agg: any, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {agg.doctorName}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                                    {agg.visited}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                    {agg.totalCharge.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {agg.lastVisit ? agg.lastVisit.toLocaleString() : "N/A"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {Object.keys(aggregatedConsultantCharges).length === 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                        No consultant charges recorded.
                      </div>
                    )}

                    {/* Payment History in Modal */}
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <CreditCard size={18} className="mr-2 text-teal-600" /> Payment History
                      </h3>
                      {selectedPatientForHistory.payments.length === 0 ? (
                        <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">No payments recorded.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[600px] divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Amount (₹)
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Payment Type
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Type
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Through
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Date
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {selectedPatientForHistory.payments.map((payment, idx) => (
                                <tr key={payment.id || idx}>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {payment.amount.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 capitalize">
                                    {payment.paymentType}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 capitalize">
                                    {payment.type}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 capitalize">
                                    {payment.through || "N/A"}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(payment.date).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="h-10 w-10 mx-auto mb-4 text-red-500" />
                    <p>Could not load patient history.</p>
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-3">
                  {selectedPatientForHistory && (
                    <button
                      onClick={() => router.push(`/ipd/billing/${selectedPatientForHistory.ipdId}`)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <FileText size={16} className="mr-2" /> Go to Billing Page
                    </button>
                  )}
                  <button
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </Layout>
  )
}
