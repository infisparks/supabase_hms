"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Edit,
  Users,
  Home,
  XCircle,
  CheckCircle,
  FileText,
  Clipboard,
  Stethoscope,
  RefreshCw,
  IndianRupeeIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Layout from "@/components/global/Layout"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

// --- Type Definitions (Defined directly in this file) ---

// Optimized PatientDetailSupabase to only include necessary fields
interface PatientDetailSupabase {
  patient_id: number;
  name: string;
  number: number | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  age_unit: string | null;
  dob: string | null;
  uhid: string;
}

// BedManagementSupabase is already minimal for this display
interface BedManagementSupabase {
  id: number;
  room_type: string;
  bed_number: number;
  bed_type: string; // bed_type might not be directly used in the table, but it's part of bed_management, so keeping it
  status: string; // bed status, not used for patient status, but part of bed data
}

// PaymentDetailItemSupabase: We only need the 'amount' to calculate total deposit.
// Keeping other fields for now as they are part of the nested structure, but you could omit them if only amount is needed.
interface PaymentDetailItemSupabase {
  amount: number;
  // createdAt: string; // Not used for display
  // date: string;       // Not used for display
  // paymentType: string; // Not used for display
  // type: string;       // Not used for display
}

// ServiceDetailItemSupabase: Not directly displayed in the table, can be omitted if not needed for total calculation.
interface ServiceDetailItemSupabase {
  // amount: number;       // Only if you were calculating total services for the main table
  // createdAt: string;
  // doctorName: string;
  // serviceName: string;
  // type: string;
}

// Optimized IPDRegistrationSupabase to only include necessary fields
interface IPDRegistrationSupabase {
  ipd_id: number;
  discharge_date: string | null; // Needed for status calculation
  uhid: string; // Directly needed
  bed_id: number | null; // Needed for bed_management join
  payment_detail: PaymentDetailItemSupabase[] | null; // Needed for deposit amount

  // Joins - These are typically single objects, not arrays, when using direct foreign key joins in Supabase.
  patient_detail: PatientDetailSupabase | null;
  bed_management: BedManagementSupabase | null;

  // Fields that were previously fetched but are NOT displayed in the current table:
  // admission_source: string | null;
  // admission_type: string | null;
  // under_care_of_doctor: string | null;
  // service_detail: ServiceDetailItemSupabase[] | null;
  // created_at: string;
  // relative_name: string | null;
  // relative_ph_no: number | null;
  // relative_address: string | null;
  // admission_date: string | null;
  // admission_time: string | null;
}

// BillingRecord remains the same as it's the transformed data for UI
interface BillingRecord {
  ipdId: string;
  uhid: string;
  patientId: number | string;
  name: string;
  mobileNumber: string;
  depositAmount: number;
  roomType: string;
  bedNumber: number | string;
  status: "Discharged" | "Active";
  dischargeDate: string | null;
  admissionDate: string | null; // You might want to keep this if the full record is opened later
  admissionTime: string | null; // You might want to keep this if the full record is opened later
  age: number | null;
  gender: string | null;
  address: string | null;
  ageUnit: string | null;
  dob: string | null;
  relativeName: string | null; // Not currently displayed, but often useful
  relativePhone: number | null; // Not currently displayed, but often useful
  relativeAddress: string | null; // Not currently displayed, but often useful
  paymentDetails: PaymentDetailItemSupabase[] | null; // Needed for full record view / calculation
  serviceDetails: ServiceDetailItemSupabase[] | null; // Not currently fetched but part of the type
  admissionSource: string | null; // Not currently displayed
  admissionType: string | null; // Not currently displayed
  underCareOfDoctor: string | null; // Not currently displayed
  // referralDoctor: string | null; // This field was commented out previously for not existing
}

// --- End Type Definitions ---

export default function IPDManagementPage() {
  const [allIpdRecords, setAllIpdRecords] = useState<IPDRegistrationSupabase[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTab, setSelectedTab] = useState<"non-discharge" | "discharge">("non-discharge")
  const [selectedWard, setSelectedWard] = useState("All")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const router = useRouter()

  const fetchIPDRecords = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const { data, error } = await supabase
        .from("ipd_registration")
        .select(
          `
          ipd_id,
          discharge_date,
          uhid,
          bed_id,
          payment_detail,
          patient_detail (patient_id, name, number, age, gender, address, age_unit, dob, uhid),
          bed_management (id, room_type, bed_number, bed_type, status)
          `,
        )
        // Keep order by created_at even if not selected, as it's for data fetching efficiency/logic
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching IPD records:", error)
        throw error
      }

      // **FIX:** Explicitly cast the fetched data to the expected array type.
      // This tells TypeScript that patient_detail and bed_management are single objects (or null) per record.
      setAllIpdRecords(data as unknown as IPDRegistrationSupabase[] || [])
    } catch (error) {
      toast.error("Failed to load IPD records.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchIPDRecords()
  }, [fetchIPDRecords])

  // Format room type with special cases for ICU and NICU
  const formatRoomType = useCallback((roomType: string) => {
    if (!roomType) return "N/A"
    const upperCaseTypes = ["icu", "nicu"]
    const lowerType = roomType.toLowerCase()

    if (upperCaseTypes.includes(lowerType)) {
      return roomType.toUpperCase()
    }
    return roomType.charAt(0).toUpperCase() + roomType.slice(1).toLowerCase()
  }, [])

  // Process raw Supabase data into BillingRecord format
  const processedRecords = useMemo(() => {
    return allIpdRecords.map((record) => {
      const totalDeposit = (record.payment_detail || []).reduce(
        (sum, payment) => sum + (Number(payment.amount) || 0),
        0,
      )
      return {
        ipdId: String(record.ipd_id),
        uhid: record.uhid,
        patientId: record.patient_detail?.patient_id || "N/A",
        name: record.patient_detail?.name || "Unknown",
        mobileNumber: record.patient_detail?.number ? String(record.patient_detail.number) : "N/A",
        depositAmount: totalDeposit,
        roomType: record.bed_management?.room_type ? formatRoomType(record.bed_management.room_type) : "N/A",
        bedNumber: record.bed_management?.bed_number || "N/A",
        status: record.discharge_date ? "Discharged" : "Active",
        dischargeDate: record.discharge_date,
        // These fields are not fetched but are part of BillingRecord.
        // They will be undefined/null as they are not selected from Supabase.
        admissionDate: null,
        admissionTime: null,
        age: record.patient_detail?.age,
        gender: record.patient_detail?.gender,
        address: record.patient_detail?.address,
        ageUnit: record.patient_detail?.age_unit,
        dob: record.patient_detail?.dob,
        relativeName: null,
        relativePhone: null,
        relativeAddress: null,
        paymentDetails: record.payment_detail, // Still needed for total deposit calculation
        serviceDetails: null, // Not fetched
        admissionSource: null, // Not fetched
        admissionType: null, // Not fetched
        underCareOfDoctor: null, // Not fetched
      } as BillingRecord
    })
  }, [allIpdRecords, formatRoomType]) // Added formatRoomType to dependency array

  const nonDischargedRecords = useMemo(() => {
    return processedRecords.filter((record) => record.status === "Active")
  }, [processedRecords])

  const dischargedRecords = useMemo(() => {
    return processedRecords.filter((record) => record.status === "Discharged")
  }, [processedRecords])

  const filteredRecords = useMemo(() => {
    const currentRecords = selectedTab === "non-discharge" ? nonDischargedRecords : dischargedRecords
    const term = searchTerm.trim().toLowerCase()
    let records = [...currentRecords]

    // Ward filtering
    if (selectedWard !== "All") {
      records = records.filter((rec) => rec.roomType.toLowerCase() === selectedWard.toLowerCase())
    }

    // Search filtering
    if (term) {
      records = records.filter(
        (rec) =>
          rec.ipdId.toLowerCase().includes(term) ||
          rec.name.toLowerCase().includes(term) ||
          (rec.mobileNumber && rec.mobileNumber.toLowerCase().includes(term)) ||
          rec.uhid.toLowerCase().includes(term),
      )
    }

    return records
  }, [nonDischargedRecords, dischargedRecords, searchTerm, selectedTab, selectedWard])

  // Get unique ward names from all records for filter options
  const uniqueWards = useMemo(() => {
    const wards = new Set<string>()
    allIpdRecords.forEach((record) => {
      if (record.bed_management?.room_type) {
        wards.add(formatRoomType(record.bed_management.room_type))
      }
    })
    return Array.from(wards)
  }, [allIpdRecords, formatRoomType]) // Added formatRoomType to dependency array

  // Summary stats
  const totalPatients = processedRecords.length
  const totalDeposits = processedRecords.reduce((sum, record) => sum + record.depositAmount, 0)

  // Format currency without leading zero issue
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [])

  // Event handlers
  const handleRowClick = useCallback((record: BillingRecord) => {
    router.push(`/ipd/billing/${record.ipdId}`)
    toast.info(`Navigating to billing for: ${record.name} (UHID: ${record.uhid})`)
  }, [router])

  const handleEditRecord = useCallback((e: React.MouseEvent, record: BillingRecord) => {
    e.stopPropagation()
    // Note: If /ipd/appointment/[ipdId] requires more data than what's fetched here,
    // you'll need to fetch it within that component or modify this selection.
    router.push(`/ipd/appointment/${record.ipdId}`)
  }, [router])

  const handleManagePatient = useCallback((e: React.MouseEvent, record: BillingRecord) => {
    e.stopPropagation()
    toast.info(`Manage patient: ${record.name} (UHID: ${record.uhid}) - Not yet implemented`)
  }, [])

  const handleDrugChart = useCallback((e: React.MouseEvent, record: BillingRecord) => {
    e.stopPropagation()
    toast.info(`Drug Chart for: ${record.name} (UHID: ${record.uhid}) - Not yet implemented`)
  }, [])

  const handleOTForm = useCallback((e: React.MouseEvent, record: BillingRecord) => {
    e.stopPropagation()
    toast.info(`OT Form for: ${record.name} (UHID: ${record.uhid}) - Not yet implemented`)
  }, [])

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-xl text-gray-600">Loading IPD records...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">IPD Billing Management</h1>
            <p className="text-slate-500">Manage and track in-patient billing records and admissions</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="bg-white shadow-lg border border-blue-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Total Patients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="h-6 w-6 text-blue-500 mr-3" />
                  <span className="text-3xl font-bold text-slate-800">{totalPatients}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">All IPD patients registered</p>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border border-green-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Total Deposits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <IndianRupeeIcon className="h-6 w-6 text-green-500 mr-3" />
                  <span className="text-3xl font-bold text-slate-800">{formatCurrency(totalDeposits)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Total amount collected as deposits</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs & Filters */}
          <Card className="mb-8 shadow-lg border border-slate-200">
            <CardContent className="p-6">
              <Tabs
                defaultValue="non-discharge"
                onValueChange={(value) => setSelectedTab(value as "non-discharge" | "discharge")}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div className="overflow-x-auto">
                    <TabsList className="bg-slate-100 flex gap-2 whitespace-nowrap p-1 rounded-lg">
                      <TabsTrigger
                        value="non-discharge"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 px-4 py-2 rounded-md"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Non-Discharged ({nonDischargedRecords.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="discharge"
                        className="data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 px-4 py-2 rounded-md"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Discharged ({dischargedRecords.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex gap-3 items-center w-full md:w-auto">
                    <div className="relative flex-grow">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name, ID, mobile, or UHID"
                        className="pl-10 w-full"
                      />
                    </div>
                    <Button
                      onClick={fetchIPDRecords}
                      disabled={isRefreshing}
                      variant="outline"
                      className="shrink-0 bg-transparent"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      <span className="sr-only">Refresh</span>
                    </Button>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Home className="h-5 w-5 text-slate-600" />
                    <h3 className="font-semibold text-slate-800">Filter by Room Type</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={selectedWard === "All" ? "default" : "outline"}
                      className={`cursor-pointer px-3 py-1 text-sm rounded-full transition-colors ${
                        selectedWard === "All"
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
                      }`}
                      onClick={() => setSelectedWard("All")}
                    >
                      All Rooms
                    </Badge>
                    {uniqueWards.map((ward) => (
                      <Badge
                        key={ward}
                        variant={selectedWard === ward ? "default" : "outline"}
                        className={`cursor-pointer px-3 py-1 text-sm rounded-full transition-colors ${
                          selectedWard === ward
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
                        }`}
                        onClick={() => setSelectedWard(ward)}
                      >
                        {ward}
                      </Badge>
                    ))}
                  </div>
                </div>

                <TabsContent value="non-discharge" className="mt-0">
                  {renderPatientsTable(
                    filteredRecords,
                    handleRowClick,
                    handleEditRecord,
                    handleManagePatient,
                    handleDrugChart,
                    handleOTForm,
                    isLoading,
                    formatCurrency,
                  )}
                </TabsContent>

                <TabsContent value="discharge" className="mt-0">
                  {renderPatientsTable(
                    filteredRecords,
                    handleRowClick,
                    handleEditRecord,
                    handleManagePatient,
                    handleDrugChart,
                    handleOTForm,
                    isLoading,
                    formatCurrency,
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}

function renderPatientsTable(
  records: BillingRecord[],
  handleRowClick: (record: BillingRecord) => void,
  handleEditRecord: (e: React.MouseEvent, record: BillingRecord) => void,
  handleManagePatient: (e: React.MouseEvent, record: BillingRecord) => void,
  handleDrugChart: (e: React.MouseEvent, record: BillingRecord) => void,
  handleOTForm: (e: React.MouseEvent, record: BillingRecord) => void,
  isLoading: boolean,
  formatCurrency: (amount: number) => string,
) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-lg text-gray-600">Loading patients...</p>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-slate-200 shadow-sm">
        <Users className="h-16 w-16 text-slate-300 mx-auto mb-6" />
        <h3 className="text-xl font-semibold text-slate-700 mb-2">No patients found</h3>
        <p className="text-slate-500">Try adjusting your filters or search criteria.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-md bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-3 text-left font-semibold text-slate-600">#</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">Patient Name</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">Mobile Number</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">Deposit (₹)</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">Room Type</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
            <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record, index) => (
            <tr
              key={record.ipdId}
              onClick={() => handleRowClick(record)}
              className="hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3 text-slate-700">{index + 1}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-800">{record.name}</div>
                <div className="text-xs text-slate-500">ID: {record.ipdId.substring(0, 8)}...</div>
                <div className="text-xs text-slate-500">UHID: {record.uhid}</div>
              </td>
              <td className="px-4 py-3 text-slate-700">{record.mobileNumber}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{formatCurrency(record.depositAmount)}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {record.roomType || "N/A"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                {record.status === "Discharged" ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Discharged
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    Active
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2 flex-nowrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleEditRecord(e, record)}
                    className="text-blue-600 hover:bg-blue-50 border-blue-200 whitespace-nowrap"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleManagePatient(e, record)}
                    className="text-slate-700 hover:bg-slate-100 border-slate-200 whitespace-nowrap"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Manage
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleDrugChart(e, record)}
                    className="text-slate-700 hover:bg-slate-100 border-slate-200 whitespace-nowrap"
                  >
                    <Clipboard className="h-4 w-4 mr-1" />
                    Drug Chart
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleOTForm(e, record)}
                    className="text-purple-600 hover:bg-purple-50 border-purple-200 whitespace-nowrap"
                  >
                    <Stethoscope className="h-4 w-4 mr-1" />
                    OT
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}