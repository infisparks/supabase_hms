// app/ipd/management/page.tsx
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
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger, // <-- FIXED: Added missing import
} from "@/components/ui/alert-dialog"
import Layout from "@/components/global/Layout"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import Image from "next/image"

// --- Type Definitions ---
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
  amount: number
  type?: string
  paymentType?: string
  amountType?: string
  transactionType?: string
}
interface ServiceDetailItemSupabase {}
interface DischargeSummaryRecord {
  id: string
  discharge_type: string | null
}
interface IPDRegistrationSupabase {
  ipd_id: number
  discharge_date: string | null
  uhid: string
  bed_id: number | null
  payment_detail: PaymentDetailItemSupabase[] | null
  patient_detail: PatientDetailSupabase | null
  bed_management: BedManagementSupabase | null
  discharge_summaries: DischargeSummaryRecord[] | null
  tpa: boolean | null
}
interface BillingRecord {
  ipdId: string
  uhid: string
  patientId: number | string
  name: string
  mobileNumber: string
  depositAmount: number
  roomType: string
  bedNumber: number | string
  status: "Active" | "Discharged" | "Discharged Partially" | "Death"
  dischargeDate: string | null
  dischargeType: string | null
  admissionDate: string | null
  admissionTime: string | null
  age: number | null
  gender: string | null
  address: string | null
  ageUnit: string | null
  dob: string | null
  relativeName: string | null
  relativePhone: number | null
  relativeAddress: string | null
  paymentDetails: PaymentDetailItemSupabase[] | null
  serviceDetails: ServiceDetailItemSupabase[] | null
  admissionSource: string | null
  admissionType: string | null
  underCareOfDoctor: string | null
  tpa: boolean | null
}
// --- End Type Definitions ---

// Helper function to process a single record into BillingRecord format
const processToBillingRecord = (
  record: IPDRegistrationSupabase,
  formatRoomType: (roomType: string) => string,
): BillingRecord => {
  const totalDeposits = (record.payment_detail || []).reduce((sum, payment) => {
    const amtType = payment.amountType?.toLowerCase()
    if (amtType === "advance" || amtType === "deposit" || amtType === "settlement") {
      return sum + (Number(payment.amount) || 0)
    }
    return sum
  }, 0)
  const totalRefunds = (record.payment_detail || []).reduce((sum, payment) => {
    if (payment.type?.toLowerCase() === "refund") {
      return sum + (Number(payment.amount) || 0)
    }
    return sum
  }, 0)
  const netDeposit = totalDeposits - totalRefunds
  const dischargeSummary = record.discharge_summaries?.[0]
  const dischargeType = dischargeSummary?.discharge_type || null
  let status: BillingRecord["status"]
  if (record.discharge_date) {
    status = dischargeType === "Death" ? "Death" : "Discharged"
  } else if (dischargeType === "Discharge Partially") {
    status = "Discharged Partially"
  } else {
    status = "Active"
  }
  return {
    ipdId: String(record.ipd_id),
    uhid: record.uhid,
    patientId: record.patient_detail?.patient_id || "N/A",
    name: record.patient_detail?.name || "Unknown",
    mobileNumber: record.patient_detail?.number ? String(record.patient_detail.number) : "N/A",
    depositAmount: netDeposit,
    roomType: record.bed_management?.room_type ? formatRoomType(record.bed_management.room_type) : "N/A",
    bedNumber: record.bed_management?.bed_number || "N/A",
    status: status,
    dischargeDate: record.discharge_date,
    dischargeType: dischargeType,
    admissionDate: null,
    admissionTime: null,
    // --- FIXED: Added '?? null' to prevent 'undefined' values ---
    age: record.patient_detail?.age ?? null,
    gender: record.patient_detail?.gender ?? null,
    address: record.patient_detail?.address ?? null,
    ageUnit: record.patient_detail?.age_unit ?? null,
    dob: record.patient_detail?.dob ?? null,
    // --- END FIX ---
    relativeName: null,
    relativePhone: null,
    relativeAddress: null,
    paymentDetails: record.payment_detail,
    serviceDetails: null,
    admissionSource: null,
    admissionType: null,
    underCareOfDoctor: null,
    tpa: record.tpa,
  }
}

export default function IPDManagementPage() {
  const [allIpdRecords, setAllIpdRecords] = useState<IPDRegistrationSupabase[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTab, setSelectedTab] = useState<"non-discharge" | "discharge" | "discharge-partially">(
    "non-discharge",
  )
  const [selectedWard, setSelectedWard] = useState("All")
  const [selectedTPA, setSelectedTPA] = useState<"All" | "Yes" | "No">("All")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const router = useRouter()

  // State for server-side search on Discharged tab
  const [dischargedSearchResults, setDischargedSearchResults] = useState<BillingRecord[]>([])
  const [dischargedPhoneSearch, setDischargedPhoneSearch] = useState("")
  const [dischargedUhidSearch, setDischargedUhidSearch] = useState("")
  const [isSearchingDischarged, setIsSearchingDischarged] = useState(false)
  const [hasSearchedDischarged, setHasSearchedDischarged] = useState(false)

  const formatRoomType = useCallback((roomType: string) => {
    if (!roomType) return "N/A"
    return roomType.charAt(0).toUpperCase() + roomType.slice(1).toLowerCase()
  }, [])

  // Fetch only non-discharged records on initial load for performance
  const fetchIPDRecords = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const { data, error } = await supabase
        .from("ipd_registration")
        .select(
          `
          ipd_id, discharge_date, uhid, bed_id, payment_detail, tpa,
          patient_detail (patient_id, name, number, age, gender, address, age_unit, dob, uhid),
          bed_management (id, room_type, bed_number, bed_type, status),
          discharge_summaries (id, discharge_type)
          `,
        )
        .is("discharge_date", null) // <<< KEY OPTIMIZATION
        .order("created_at", { ascending: false })
      if (error) throw error
       // FIXED: Cast to 'unknown' first to resolve complex type mismatch
      setAllIpdRecords((data as unknown as IPDRegistrationSupabase[]) || [])
    } catch (error) {
      console.error("Error fetching IPD records:", error)
      toast.error("Failed to load active IPD records.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchIPDRecords()
  }, [fetchIPDRecords])
  
  // Clean up server-side search state when switching tabs
  useEffect(() => {
    if (selectedTab !== 'discharge') {
        setDischargedSearchResults([]);
        setHasSearchedDischarged(false);
        setDischargedPhoneSearch('');
        setDischargedUhidSearch('');
    }
  }, [selectedTab]);


  const handleDischargedSearch = async () => {
    if (!dischargedPhoneSearch && !dischargedUhidSearch) {
      toast.info("Please enter a Phone Number or UHID to search.")
      return
    }
    if (dischargedUhidSearch && (dischargedUhidSearch.length !== 5 || !/^\d+$/.test(dischargedUhidSearch))) {
      toast.error("UHID search requires the last 5 digits.")
      return
    }

    setIsSearchingDischarged(true)
    setHasSearchedDischarged(true)
    setDischargedSearchResults([])

    try {
      const selectStatement = `
        ipd_id, discharge_date, uhid, bed_id, payment_detail, tpa,
        patient_detail!inner(patient_id, name, number, age, gender, address, age_unit, dob, uhid),
        bed_management(id, room_type, bed_number, bed_type, status),
        discharge_summaries(id, discharge_type)
      `

      let query = supabase.from("ipd_registration").select(selectStatement).not("discharge_date", "is", null)

      if (dischargedPhoneSearch) {
        query = query.eq("patient_detail.number", dischargedPhoneSearch)
      } else if (dischargedUhidSearch) {
        query = query.like("uhid", `%${dischargedUhidSearch}`)
      }

      const { data, error } = await query.order("created_at", { ascending: false })

      if (error) throw error
      
      // FIXED: Cast to 'unknown' first to resolve complex type mismatch
      const processed = (data as unknown as IPDRegistrationSupabase[]).map(record =>
        processToBillingRecord(record, formatRoomType),
      )
      setDischargedSearchResults(processed)
      if (processed.length === 0) {
        toast.info("No discharged records found for the given criteria.")
      }
    } catch (error) {
      console.error("Error searching discharged records:", error)
      toast.error("Failed to search discharged records.")
    } finally {
      setIsSearchingDischarged(false)
    }
  }

  const processedRecords = useMemo(
    () => allIpdRecords.map(record => processToBillingRecord(record, formatRoomType)),
    [allIpdRecords, formatRoomType],
  )

  const nonDischargedRecords = useMemo(
    () => processedRecords.filter(record => record.status === "Active"),
    [processedRecords],
  )

  const partiallyDischargedRecords = useMemo(
    () => processedRecords.filter(record => record.status === "Discharged Partially"),
    [processedRecords],
  )

  // Client-side filtering for active and partial tabs
  const filteredActiveRecords = useMemo(() => {
    let currentRecords: BillingRecord[] =
      selectedTab === "non-discharge" ? nonDischargedRecords : partiallyDischargedRecords

    if (selectedWard !== "All") {
      currentRecords = currentRecords.filter(rec => rec.roomType.toLowerCase() === selectedWard.toLowerCase())
    }
    if (selectedTPA !== "All") {
      currentRecords = currentRecords.filter(rec => (selectedTPA === "Yes" ? rec.tpa === true : rec.tpa === false))
    }
    const term = searchTerm.trim().toLowerCase()
    if (term) {
      currentRecords = currentRecords.filter(
        rec =>
          rec.ipdId.toLowerCase().includes(term) ||
          rec.name.toLowerCase().includes(term) ||
          rec.mobileNumber?.toLowerCase().includes(term) ||
          rec.uhid.toLowerCase().includes(term),
      )
    }
    return currentRecords
  }, [nonDischargedRecords, partiallyDischargedRecords, searchTerm, selectedTab, selectedWard, selectedTPA])
  
  // Client-side filtering for server-side search results
  const filteredDischargedRecords = useMemo(() => {
    if (!hasSearchedDischarged) return [];
    let records = dischargedSearchResults;
    if (selectedWard !== "All") {
      records = records.filter(rec => rec.roomType.toLowerCase() === selectedWard.toLowerCase())
    }
    if (selectedTPA !== "All") {
      records = records.filter(rec => (selectedTPA === "Yes" ? rec.tpa === true : rec.tpa === false))
    }
    // No text search here as it's done on the server
    return records;
  }, [dischargedSearchResults, selectedWard, selectedTPA, hasSearchedDischarged])


  const uniqueWards = useMemo(() => {
    const wards = new Set<string>()
    allIpdRecords.forEach(record => {
      if (record.bed_management?.room_type) {
        wards.add(formatRoomType(record.bed_management.room_type))
      }
    })
    return Array.from(wards)
  }, [allIpdRecords, formatRoomType])

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [])

  const handleRowClick = useCallback((record: BillingRecord) => {
    router.push(`/ipd/billing/${record.ipdId}`)
  }, [router])
  
  const handleEditRecord = useCallback((e: React.MouseEvent, record: BillingRecord) => {
    e.stopPropagation()
    router.push(`/ipd/appointment/${record.ipdId}`)
  }, [router])

  const handleManagePatient = useCallback((e: React.MouseEvent, record: BillingRecord) => {
    e.stopPropagation()
    router.push(`/ipd/manage/${record.ipdId}`)
  }, [router])

  const handleIPDRecord = useCallback((e: React.MouseEvent, record: BillingRecord) => {
    e.stopPropagation()
    router.push(`/ipdrecord/${record.ipdId}`)
  }, [router])

  const handleOTForm = useCallback((e: React.MouseEvent, record: BillingRecord) => {
    e.stopPropagation()
    router.push(`/ipd/ot/${record.ipdId}`)
  }, [router])

  const handleDeleteRecord = useCallback(async (record: BillingRecord) => {
    try {
      const { data: ipdData, error: ipdError } = await supabase
        .from("ipd_registration").select("bed_id").eq("ipd_id", record.ipdId).single()
      if (ipdError) throw ipdError
      const { error: deleteError } = await supabase.from("ipd_registration").delete().eq("ipd_id", record.ipdId)
      if (deleteError) throw deleteError
      if (ipdData?.bed_id) {
        await supabase.from("bed_management").update({ status: "available" }).eq("id", ipdData.bed_id)
      }
      toast.success(`Successfully deleted IPD record for ${record.name}`)
      fetchIPDRecords()
    } catch (error) {
      toast.error("Failed to delete IPD record")
    }
  }, [fetchIPDRecords])

  if (isLoading) {
    return (
      <Layout><div className="flex h-screen items-center justify-center"><RefreshCw className="h-10 w-10 animate-spin text-blue-600" /></div></Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex justify-center">
            <Image src="/banner.png" alt="Hospital Banner" width={1200} height={200} className="rounded-xl shadow-2xl"/>
          </div>
          <Card className="mb-8 shadow-lg border border-slate-200">
            <CardContent className="p-6">
              <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <TabsList className="bg-slate-100 flex gap-2 whitespace-nowrap p-1 rounded-lg">
                    <TabsTrigger value="non-discharge">
                      <XCircle className="h-4 w-4 mr-2" />
                      Non-Discharged ({nonDischargedRecords.length})
                    </TabsTrigger>
                    <TabsTrigger value="discharge-partially">
                      <Clipboard className="h-4 w-4 mr-2" />
                      Partially Discharged ({partiallyDischargedRecords.length})
                    </TabsTrigger>
                    <TabsTrigger value="discharge">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Discharged ({hasSearchedDischarged ? filteredDischargedRecords.length : 'Search'})
                    </TabsTrigger>
                  </TabsList>
                  
                  {selectedTab === 'discharge' ? (
                    <div className="flex gap-3 items-center w-full md:w-auto md:flex-grow">
                      <Input
                        type="text"
                        value={dischargedPhoneSearch}
                        onChange={(e) => {
                          setDischargedPhoneSearch(e.target.value);
                          if (e.target.value) setDischargedUhidSearch('');
                        }}
                        placeholder="Search by Phone Number"
                        className="flex-grow"
                      />
                      <Input
                        type="text"
                        value={dischargedUhidSearch}
                        onChange={(e) => {
                          setDischargedUhidSearch(e.target.value);
                          if (e.target.value) setDischargedPhoneSearch('');
                        }}
                        placeholder="Search by UHID (last 5 digits)"
                        className="flex-grow"
                      />
                      <Button onClick={handleDischargedSearch} disabled={isSearchingDischarged} className="shrink-0">
                        <Search className={`h-4 w-4 mr-2 ${isSearchingDischarged ? "animate-spin" : ""}`} />
                        Search
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-3 items-center w-full md:w-auto">
                      <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="text"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          placeholder="Search by name, ID, mobile, or UHID"
                          className="pl-10 w-full"
                        />
                      </div>
                      <Button onClick={fetchIPDRecords} disabled={isRefreshing} variant="outline" className="shrink-0">
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3"><Home className="h-5 w-5 text-slate-600" /><h3 className="font-semibold text-slate-800">Filter by Room Type</h3></div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={selectedWard === "All" ? "default" : "outline"} onClick={() => setSelectedWard("All")} className="cursor-pointer">All Rooms</Badge>
                    {uniqueWards.map(ward => (<Badge key={ward} variant={selectedWard === ward ? "default" : "outline"} onClick={() => setSelectedWard(ward)} className="cursor-pointer">{ward}</Badge>))}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3"><IndianRupeeIcon className="h-5 w-5 text-slate-600" /><h3 className="font-semibold text-slate-800">Filter by TPA Status</h3></div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={selectedTPA === "All" ? "default" : "outline"} onClick={() => setSelectedTPA("All")} className="cursor-pointer">All</Badge>
                    <Badge variant={selectedTPA === "Yes" ? "default" : "outline"} onClick={() => setSelectedTPA("Yes")} className="cursor-pointer bg-purple-600 text-white hover:bg-purple-700">TPA</Badge>
                    <Badge variant={selectedTPA === "No" ? "default" : "outline"} onClick={() => setSelectedTPA("No")} className="cursor-pointer bg-gray-600 text-white hover:bg-gray-700">Non-TPA</Badge>
                  </div>
                </div>

                <TabsContent value="non-discharge" className="mt-0">
                  {renderPatientsTable(filteredActiveRecords, handleRowClick, handleEditRecord, handleManagePatient, handleIPDRecord, handleOTForm, handleDeleteRecord, isRefreshing, formatCurrency)}
                </TabsContent>
                <TabsContent value="discharge-partially" className="mt-0">
                  {renderPatientsTable(filteredActiveRecords, handleRowClick, handleEditRecord, handleManagePatient, handleIPDRecord, handleOTForm, handleDeleteRecord, isRefreshing, formatCurrency)}
                </TabsContent>
                <TabsContent value="discharge" className="mt-0">
                  { !hasSearchedDischarged ? (
                      <div className="text-center py-12 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <Search className="h-16 w-16 text-slate-300 mx-auto mb-6" />
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">Search Discharged Patients</h3>
                        <p className="text-slate-500">Enter a phone number or the last 5 digits of a UHID to begin.</p>
                      </div>
                    ) :
                    renderPatientsTable(filteredDischargedRecords, handleRowClick, handleEditRecord, handleManagePatient, handleIPDRecord, handleOTForm, handleDeleteRecord, isSearchingDischarged, formatCurrency)
                  }
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
  handleIPDRecord: (e: React.MouseEvent, record: BillingRecord) => void,
  handleOTForm: (e: React.MouseEvent, record: BillingRecord) => void,
  handleDeleteRecord: (record: BillingRecord) => void,
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
        <p className="text-slate-500">No records match your current search and filter criteria.</p>
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
            <th className="px-4 py-3 text-left font-semibold text-slate-600">Net Deposit (₹)</th>
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
                <div className="font-medium text-slate-800 flex items-center gap-2">
                  {record.name}
                  {record.tpa && (
                    <Badge variant="default" className="bg-purple-600 hover:bg-purple-700 text-white">TPA</Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500">ID: {record.ipdId}</div>
                <div className="text-xs text-slate-500">UHID: {record.uhid}</div>
              </td>
              <td className="px-4 py-3 text-slate-700">{record.mobileNumber}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{formatCurrency(record.depositAmount)}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{record.roomType || "N/A"}</Badge>
              </td>
              <td className="px-4 py-3">
                {record.status === "Discharged" ? (<Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Discharged</Badge>
                ) : record.status === "Discharged Partially" ? (<Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Partially Discharged</Badge>
                ) : record.status === "Death" ? (<Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Death</Badge>
                ) : (<Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Active</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2 flex-nowrap">
                  <Button variant="outline" size="sm" onClick={e => handleEditRecord(e, record)}><Edit className="h-4 w-4 mr-1" />Edit</Button>
                  <Button variant="outline" size="sm" onClick={e => handleManagePatient(e, record)}><FileText className="h-4 w-4 mr-1" />Manage</Button>
                  <Button variant="outline" size="sm" onClick={e => handleIPDRecord(e, record)}><Clipboard className="h-4 w-4 mr-1" />IPD Record</Button>
                  <Button variant="outline" size="sm" onClick={e => handleOTForm(e, record)}><Stethoscope className="h-4 w-4 mr-1" />OT</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={e => e.stopPropagation()} className="text-red-600 hover:bg-red-50 border-red-200"><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete IPD Record</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete the IPD record for {record.name}? This will also make the bed available again. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRecord(record)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
