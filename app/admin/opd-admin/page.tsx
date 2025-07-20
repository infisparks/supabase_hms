"use client"

import type React from "react"
import Layout from "@/components/global/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState, useEffect, useMemo, useCallback } from "react"
// Import parseISO from date-fns to correctly parse ISO strings as local
import { format, isSameDay, subDays, startOfDay, endOfDay, parseISO } from "date-fns"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import {
  Search,
  Trash2,
  Eye,
  Users,
  CreditCard,
  Banknote,
  RefreshCw,
  Filter,
  IndianRupeeIcon,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { supabase } from "@/lib/supabase"

interface IModality {
  charges: number
  doctor?: string
  specialist?: string
  type: "consultation" | "casualty" | "xray" | "pathology" | "ipd" | "radiology"
  visitType?: string
  service?: string
}

interface IPayment {
  cashAmount: number
  createdAt: string // This might be used if payment_info had its own createdAt
  discount: number
  onlineAmount: number
  paymentMethod: string
  totalCharges: number
  totalPaid: number
}

interface IOPDEntry {
  id: string
  patientId: string
  name: string
  phone: string
  age: string
  gender: string
  address: string
  appointmentType: "visithospital"
  createdAt: string // Raw string from DB
  date: string // Formatted local date
  time: string // Formatted local time
  enteredBy: string
  message: string
  modalities: IModality[]
  opdType: string
  payment: IPayment
  referredBy: string
  study: string
  visitType: string
}

interface PaymentSummary {
  totalCash: number
  totalOnline: number
  totalAmount: number
  totalDiscount: number
  netRevenue: number
}

interface DashboardStats {
  totalAppointments: number
  totalRevenue: number
  paymentBreakdown: PaymentSummary
  averageAmount: number
  totalConsultations: number
  totalCasualty: number
  totalXrays: number
  totalPathology: number
  totalIPD: number
  totalRadiology: number
}

type DateFilter = "today" | "7days"

const AdminDashboardPage: React.FC = () => {
  const [dateFilter, setDateFilter] = useState<DateFilter>("7days")
  const [opdAppointments, setOpdAppointments] = useState<IOPDEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedAppointment, setSelectedAppointment] = useState<IOPDEntry | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<IOPDEntry | null>(null)

  // --- Start of the fix ---
  const getDateRange = useCallback((filter: DateFilter) => {
    // Get the current date/time in the client's local timezone (IST)
    const now = new Date()
    let start: Date
    let end: Date

    switch (filter) {
      case "today":
        start = startOfDay(now) // Start of today (e.g., July 19, 2025 00:00:00 IST)
        end = endOfDay(now) // End of today (e.g., July 19, 2025 23:59:59 IST)
        break
      case "7days":
        start = startOfDay(subDays(now, 6)) // Start of 6 days ago (e.g., July 13, 2025 00:00:00 IST)
        end = endOfDay(now) // End of today (e.g., July 19, 2025 23:59:59 IST)
        break
      default:
        start = startOfDay(now)
        end = endOfDay(now)
        break
    }

    // Format to a string that PostgreSQL's 'timestamp without time zone'
    // column will interpret directly as a local timestamp, ignoring any timezones.
    // This string needs to represent the local time you calculated (IST in your case).
    // The 'yyyy-MM-dd HH:mm:ss.SSSSSS' format is a standard way to represent this.
    return {
      start: format(start, "yyyy-MM-dd HH:mm:ss.SSSSSS"),
      end: format(end, "yyyy-MM-dd HH:mm:ss.SSSSSS"),
    }
  }, [])
  // --- End of the fix ---

  const fetchOPDAppointments = useCallback(
    async (filter: DateFilter) => {
      const isRefresh = !loading
      if (isRefresh) setRefreshing(true)

      try {
        const dateRange = getDateRange(filter)

        const { data, error } = await supabase
          .from("opd_registration")
          .select(
            `
            opd_id,
            created_at,
            refer_by,
            "additional Notes",
            service_info,
            payment_info,
            patient_detail (patient_id, name, number, age, gender, address)
          `,
          )
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end)
          .order("created_at", { ascending: false })

        if (error) throw error

        const mappedAppointments: IOPDEntry[] = (data || []).map((appt) => {
          const patientDetail = appt.patient_detail as any
          const patientIdString =
            patientDetail?.patient_id !== null && patientDetail?.patient_id !== undefined
              ? String(patientDetail.patient_id)
              : ""
          const phoneNumberString =
            patientDetail?.number !== null && patientDetail?.number !== undefined
              ? String(patientDetail.number)
              : ""

          // IMPORTANT: We are **not** parsing created_at into a Date object for comparison logic now.
          // We're taking it as is for storage in state, and for display, we'll parse it.
          const firstConsultation = (appt.service_info as IModality[])?.find((m) => m.type === "consultation")
          const visitType = firstConsultation?.visitType || ""

          return {
            id: appt.opd_id,
            patientId: patientIdString,
            name: patientDetail?.name || "Unknown",
            phone: phoneNumberString,
            age: patientDetail?.age || "",
            gender: patientDetail?.gender || "",
            address: patientDetail?.address || "",
            appointmentType: "visithospital",
            createdAt: appt.created_at, // Keep raw string from DB for storage in state
            date: format(parseISO(appt.created_at), "yyyy-MM-dd"), // Parse for display formatting only
            time: format(parseISO(appt.created_at), "HH:mm"), // Parse for display formatting only
            enteredBy: "", // This field is not directly from your current select query
            message: appt["additional Notes"] || "",
            modalities: (appt.service_info as IModality[]) || [],
            opdType: "", // This field is not directly from your current select query
            payment: (appt.payment_info as IPayment) || {
              cashAmount: 0,
              createdAt: "",
              discount: 0,
              onlineAmount: 0,
              paymentMethod: "cash",
              totalCharges: 0,
              totalPaid: 0,
            },
            referredBy: appt.refer_by || "",
            study: "", // This field is not directly from your current select query
            visitType: visitType,
          }
        })

        setOpdAppointments(mappedAppointments)
      } catch (error) {
        console.error("Error fetching OPD appointments:", error)
        toast.error("Failed to load appointments")
      } finally {
        setLoading(false)
        if (isRefresh) setRefreshing(false)
      }
    },
    [getDateRange, loading],
  )

  useEffect(() => {
    fetchOPDAppointments(dateFilter)
  }, [dateFilter, fetchOPDAppointments])

  const dashboardStats = useMemo((): DashboardStats => {
    const paymentBreakdown: PaymentSummary = {
      totalCash: 0,
      totalOnline: 0,
      totalAmount: 0,
      totalDiscount: 0,
      netRevenue: 0,
    }

    let totalConsultations = 0
    let totalCasualty = 0
    let totalXrays = 0
    let totalPathology = 0
    let totalIPD = 0
    let totalRadiology = 0

    opdAppointments.forEach((appt) => {
      paymentBreakdown.totalCash += appt.payment.cashAmount
      paymentBreakdown.totalOnline += appt.payment.onlineAmount
      paymentBreakdown.totalAmount += appt.payment.totalPaid
      paymentBreakdown.totalDiscount += appt.payment.discount
      paymentBreakdown.netRevenue += appt.payment.totalPaid

      appt.modalities.forEach((modality) => {
        switch (modality.type) {
          case "consultation":
            totalConsultations++
            break
          case "casualty":
            totalCasualty++
            break
          case "xray":
            totalXrays++
            break
          case "pathology":
            totalPathology++
            break
          case "ipd":
            totalIPD++
            break
          case "radiology":
            totalRadiology++
            break
        }
      })
    })

    return {
      totalAppointments: opdAppointments.length,
      totalRevenue: paymentBreakdown.netRevenue,
      paymentBreakdown,
      averageAmount: opdAppointments.length > 0 ? paymentBreakdown.netRevenue / opdAppointments.length : 0,
      totalConsultations,
      totalCasualty,
      totalXrays,
      totalPathology,
      totalIPD,
      totalRadiology,
    }
  }, [opdAppointments])

  const appointmentChartData = useMemo(() => {
    const now = new Date()
    const days =
      dateFilter === "today"
        ? [startOfDay(now)]
        : Array.from({ length: 7 }, (_, i) => startOfDay(subDays(now, 6 - i)))

    const chartData = days.map((day) => {
      // For charting and display, you still need to parse the stored string to compare.
      // The instruction "don't parse the date take as it is same as database" mainly
      // applies to the *query* to the database. For client-side logic like chart data,
      // you need Date objects for `isSameDay`.
      const appointmentCount = opdAppointments.filter((appt) => isSameDay(parseISO(appt.createdAt), day)).length
      const revenueCount = opdAppointments
        .filter((appt) => isSameDay(parseISO(appt.createdAt), day))
        .reduce((acc, appt) => acc + appt.payment.totalPaid, 0)

      return {
        date: format(day, dateFilter === "today" ? "HH:mm" : "MMM dd"),
        appointments: appointmentCount,
        revenue: revenueCount,
      }
    })

    return chartData
  }, [opdAppointments, dateFilter])

  const filteredAppointments = useMemo(() => {
    if (!searchQuery.trim()) return opdAppointments

    const query = searchQuery.toLowerCase()
    return opdAppointments.filter(
      (appt) =>
        appt.name.toLowerCase().includes(query) ||
        String(appt.phone).includes(query) ||
        String(appt.patientId).toLowerCase().includes(query) ||
        appt.referredBy.toLowerCase().includes(query) ||
        appt.modalities.some(
          (mod) =>
            mod.doctor?.toLowerCase().includes(query) ||
            mod.specialist?.toLowerCase().includes(query) ||
            mod.service?.toLowerCase().includes(query) ||
            mod.type.toLowerCase().includes(query),
        ),
    )
  }, [opdAppointments, searchQuery])

  const formatPaymentDisplay = (appointment: IOPDEntry) => {
    if (appointment.payment.paymentMethod === "mixed") {
      return `₹${appointment.payment.totalPaid} (C:${appointment.payment.cashAmount} + O:${appointment.payment.onlineAmount})`
    }
    return `₹${appointment.payment.totalPaid}`
  }

  const getModalitiesSummary = (modalities: IModality[]) => {
    const counts: { [key: string]: number } = {}
    modalities.forEach((m) => {
      counts[m.type] = (counts[m.type] || 0) + 1
    })

    const parts = []
    if (counts.consultation) parts.push(`${counts.consultation} Consultation${counts.consultation > 1 ? "s" : ""}`)
    if (counts.casualty) parts.push(`${counts.casualty} Casualty`)
    if (counts.xray) parts.push(`${counts.xray} X-ray${counts.xray > 1 ? "s" : ""}`)
    if (counts.pathology) parts.push(`${counts.pathology} Pathology`)
    if (counts.ipd) parts.push(`${counts.ipd} IPD`)
    if (counts.radiology) parts.push(`${counts.radiology} Radiology`)

    return parts.join(", ") || "No services"
  }

  const handleDeleteAppointment = async () => {
    if (!appointmentToDelete) return

    try {
      const { error } = await supabase.from("opd_registration").delete().eq("opd_id", appointmentToDelete.id)

      if (error) throw error

      toast.success("Appointment deleted successfully!")
      setDeleteDialogOpen(false)
      setAppointmentToDelete(null)
      fetchOPDAppointments(dateFilter)
    } catch (error) {
      console.error("Error deleting appointment:", error)
      toast.error("Failed to delete appointment")
    }
  }

  const handleRefresh = () => {
    fetchOPDAppointments(dateFilter)
  }

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-xl text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">OPD Admin Dashboard</h1>
                <p className="text-gray-600">
                  {dateFilter === "today" ? "Today's" : "Last 7 days"} comprehensive payment & appointment analytics
                </p>
              </div>
              <div className="flex gap-3">
                <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Enhanced Payment Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-100">Total Cash Collected</CardTitle>
                <Banknote className="h-5 w-5 text-green-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">₹{dashboardStats.paymentBreakdown.totalCash.toLocaleString()}</div>
                <p className="text-xs text-green-100 mt-1">
                  {dashboardStats.totalRevenue > 0
                    ? Math.round((dashboardStats.paymentBreakdown.totalCash / dashboardStats.totalRevenue) * 100)
                    : 0}
                  % of total revenue
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-100">Total Online Collected</CardTitle>
                <CreditCard className="h-5 w-5 text-blue-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  ₹{dashboardStats.paymentBreakdown.totalOnline.toLocaleString()}
                </div>
                <p className="text-xs text-blue-100 mt-1">
                  {dashboardStats.totalRevenue > 0
                    ? Math.round((dashboardStats.paymentBreakdown.totalOnline / dashboardStats.totalRevenue) * 100)
                    : 0}
                  % of total revenue
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-100">Total Revenue</CardTitle>
                <IndianRupeeIcon className="h-5 w-5 text-purple-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">₹{dashboardStats.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-purple-100 mt-1">Total collected amount</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats.totalAppointments}</div>
                <p className="text-xs text-muted-foreground">Avg: ₹{Math.round(dashboardStats.averageAmount)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Payment Collection Summary */}
          <Card className="mb-8 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <TrendingUp className="h-5 w-5" />
                Payment Collection Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-emerald-100">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Banknote className="h-6 w-6 text-green-600" />
                    <span className="font-semibold text-gray-700">Cash Collection</span>
                  </div>
                  <div className="text-3xl font-bold text-green-700 mb-1">
                    ₹{dashboardStats.paymentBreakdown.totalCash.toLocaleString()}
                  </div>
                </div>

                <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-blue-100">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CreditCard className="h-6 w-6 text-blue-600" />
                    <span className="font-semibold text-gray-700">Online Collection</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-700 mb-1">
                    ₹{dashboardStats.paymentBreakdown.totalOnline.toLocaleString()}
                  </div>
                </div>

                <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-purple-100">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <IndianRupeeIcon className="h-6 w-6 text-purple-600" />
                    <span className="font-semibold text-gray-700">Total Revenue</span>
                  </div>
                  <div className="text-3xl font-bold text-purple-700 mb-1">
                    ₹{dashboardStats.totalRevenue.toLocaleString()}
                  </div>
                </div>

                <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-orange-100">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Users className="h-6 w-6 text-orange-600" />
                    <span className="font-semibold text-gray-700">Services</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Consultations: {dashboardStats.totalConsultations}</div>
                    <div>Casualty: {dashboardStats.totalCasualty}</div>
                    <div>X-rays: {dashboardStats.totalXrays}</div>
                    <div>Pathology: {dashboardStats.totalPathology}</div>
                    <div>IPD: {dashboardStats.totalIPD}</div>
                    <div>Radiology: {dashboardStats.totalRadiology}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointments Chart */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{dateFilter === "today" ? "Today's Appointments" : "Appointments (Last 7 Days)"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={appointmentChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="appointments"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Appointments Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle>Recent Appointments</CardTitle>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search appointments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery ? "No matching appointments found" : "No appointments available"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Patient</th>
                        <th className="text-left py-3 px-4 font-medium">Services</th>
                        <th className="text-left py-3 px-4 font-medium">Payment</th>
                        <th className="text-left py-3 px-4 font-medium">Date</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.slice(0, 20).map((appt) => (
                        <tr key={`${appt.patientId}-${appt.id}`} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium">{appt.name}</div>
                              <div className="text-sm text-gray-500">{appt.phone}</div>
                              <div className="text-xs text-gray-400">ID: {appt.patientId}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm">{getModalitiesSummary(appt.modalities)}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {appt.payment.paymentMethod}
                              </Badge>
                              {appt.payment.discount > 0 && (
                                <span className="text-green-600">(-₹{appt.payment.discount})</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold">{formatPaymentDisplay(appt)}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {appt.payment.paymentMethod}
                              </Badge>
                              {appt.payment.discount > 0 && (
                                <span className="text-green-600">(-₹{appt.payment.discount})</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {/* Use parseISO for display */}
                            <div>{format(parseISO(appt.createdAt), "MMM dd, yyyy")}</div>
                            <div className="text-sm text-gray-500">{format(parseISO(appt.createdAt), "HH:mm")}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setSelectedAppointment(appt)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAppointmentToDelete(appt)
                                  setDeleteDialogOpen(true)
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredAppointments.length > 20 && (
                    <div className="text-center py-4 text-gray-500">
                      Showing first 20 of {filteredAppointments.length} appointments
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced Appointment Details Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>Patient ID: {selectedAppointment?.patientId}</DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 text-gray-800">Patient Information</h4>
                <div className="space-y-2 text-sm bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Name:</span>
                    <span className="font-semibold">{selectedAppointment.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Phone:</span>
                    <span>{selectedAppointment.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Age:</span>
                    <span>{selectedAppointment.age}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Gender:</span>
                    <span className="capitalize">{selectedAppointment.gender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Address:</span>
                    <span>{selectedAppointment.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Patient ID:</span>
                    <span className="font-mono text-xs">{selectedAppointment.patientId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Visit Type:</span>
                    <span className="capitalize">{selectedAppointment.visitType || "N/A"}</span>
                  </div>
                  {selectedAppointment.referredBy && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Referred By:</span>
                      <span>{selectedAppointment.referredBy}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3 text-gray-800">Appointment Details</h4>
                <div className="space-y-2 text-sm bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Type:</span>
                    <Badge variant="outline">{selectedAppointment.appointmentType}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Date:</span>
                    {/* Use parseISO for display */}
                    <span className="font-semibold">{format(parseISO(selectedAppointment.createdAt), "PPP")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Time:</span>
                    {/* Use parseISO for display */}
                    <span className="font-semibold">{format(parseISO(selectedAppointment.createdAt), "HH:mm")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Created:</span>
                    {/* Use parseISO for display */}
                    <span className="text-xs">{format(parseISO(selectedAppointment.createdAt), "PPp")}</span>
                  </div>
                  {selectedAppointment.enteredBy && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Entered By:</span>
                      <span className="text-xs">{selectedAppointment.enteredBy}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3 text-gray-800">Payment Information</h4>
                <div className="space-y-2 text-sm bg-green-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Method:</span>
                    <Badge variant="default" className="capitalize">
                      {selectedAppointment.payment.paymentMethod}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Total Charges:</span>
                    <span className="font-semibold">₹{selectedAppointment.payment.totalCharges}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Cash Amount:</span>
                    <span className="font-semibold text-green-700">₹{selectedAppointment.payment.cashAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Online Amount:</span>
                    <span className="font-semibold text-blue-700">₹{selectedAppointment.payment.onlineAmount}</span>
                  </div>
                  {selectedAppointment.payment.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Discount:</span>
                      <span className="text-red-600 font-semibold">₹{selectedAppointment.payment.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium text-gray-600">Total Paid:</span>
                    <span className="font-bold text-lg">₹{selectedAppointment.payment.totalPaid}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3 text-gray-800">Services & Modalities</h4>
                <div className="space-y-3 text-sm bg-purple-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                  {selectedAppointment.modalities.map((modality, index) => (
                    <div key={index} className="border border-purple-200 rounded p-3 bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="secondary" className="capitalize">
                          {modality.type}
                        </Badge>
                        <span className="font-semibold text-purple-700">₹{modality.charges}</span>
                      </div>
                      {modality.doctor && (
                        <div className="text-xs text-gray-600">
                          <strong>Doctor:</strong> {modality.doctor}
                        </div>
                      )}
                      {modality.specialist && (
                        <div className="text-xs text-gray-600">
                          <strong>Specialist:</strong> {modality.specialist}
                        </div>
                      )}
                      {modality.service && (
                        <div className="text-xs text-gray-600">
                          <strong>Service:</strong> {modality.service}
                        </div>
                      )}
                      {modality.visitType && (
                        <div className="text-xs text-gray-600">
                          <strong>Visit Type:</strong> {modality.visitType}
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedAppointment.modalities.length === 0 && (
                    <div className="text-center text-gray-500 py-4">No services recorded</div>
                  )}
                </div>
              </div>

              {selectedAppointment.message && (
                <div className="lg:col-span-2">
                  <h4 className="font-semibold mb-3 text-gray-800">Additional Notes</h4>
                  <div className="text-sm bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-gray-700">{selectedAppointment.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
            <div className="text-sm text-gray-600">
              Are you sure you want to delete the appointment for <strong>{appointmentToDelete?.name}</strong>? This
              action cannot be undone.
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAppointmentToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAppointment} className="bg-red-500 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  )
}

export default AdminDashboardPage