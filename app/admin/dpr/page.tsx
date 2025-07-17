'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/global/Layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Users,
  Calendar,
  DollarSign,
  Bed,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Clock,
  UserCheck,
  Building2,
  Heart, // Added for potential future use or specific doctor info
  Brain // Added for potential future use or specific doctor info
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js' // Import createClient
import { format, startOfDay, endOfDay, parseISO, isSameDay } from 'date-fns'
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdflvpzeqjvjtgywayby.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkZmx2cHplcWp2anRneXdheWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NTU0OTUsImV4cCI6MjA2NDMzMTQ5NX0.u1sqXbT7d4ceSswQqD5tLDZ8DpkG0l8KYY4m4aJpgZ0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for DPR data
interface KPIData {
  totalOPDAppointments: number
  totalIPDAdmissions: number
  totalDischarges: number
  newPatientRegistrations: number
  bedOccupancyRate: number
  doctorsOnDuty: number
  totalRevenue: number
  emergencyCases: number
}

interface DoctorPerformance {
  doctorName: string
  department: string
  opdPatients: number // New column
  ipdPatients: number // New column
}

interface BedManagement {
  wardName: string
  totalBeds: number
  occupiedBeds: number
  availableBeds: number
  occupancyRate: number
}

interface PatientStatistics {
  totalInPatients: number
  totalOutPatients: number
  readmissions: number
  emergencyCases: number
  newRegistrations: number
}

interface RevenueSnapshot {
  opdRevenue: number
  ipdRevenue: number
  pharmacyRevenue: number
  labRevenue: number
  totalRevenue: number
}

interface Alert {
  type: 'warning' | 'info' | 'success';
  message: string;
  icon: React.ElementType;
}


const DPRPage = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Data states
  const [kpiData, setKpiData] = useState<KPIData>({
    totalOPDAppointments: 0,
    totalIPDAdmissions: 0,
    totalDischarges: 0,
    newPatientRegistrations: 0,
    bedOccupancyRate: 0,
    doctorsOnDuty: 0,
    totalRevenue: 0,
    emergencyCases: 0
  })

  const [doctorPerformance, setDoctorPerformance] = useState<DoctorPerformance[]>([])
  const [bedManagement, setBedManagement] = useState<BedManagement[]>([])
  const [patientStats, setPatientStats] = useState<PatientStatistics>({
    totalInPatients: 0,
    totalOutPatients: 0,
    readmissions: 0,
    emergencyCases: 0,
    newRegistrations: 0
  })
  const [revenueData, setRevenueData] = useState<RevenueSnapshot>({
    opdRevenue: 0,
    ipdRevenue: 0,
    pharmacyRevenue: 0,
    labRevenue: 0,
    totalRevenue: 0
  })

  // Chart data
  const [opdIpdChartData, setOpdIpdChartData] = useState<Array<{ name: string, value: number }>>([])
  const [revenueChartData, setRevenueChartData] = useState<Array<{ time: string, revenue: number }>>([])
  // bedUsageData state and usage removed as per request for pie chart removal

  useEffect(() => {
    fetchDPRData()
  }, [selectedDate, departmentFilter])

  const fetchDPRData = async () => {
    setIsLoading(true)
    const currentAlerts: Alert[] = [];
    try {
      const startOfDayISO = startOfDay(parseISO(selectedDate)).toISOString()
      const endOfDayISO = endOfDay(parseISO(selectedDate)).toISOString()

      // --- Fetching data from Supabase ---

      const { data: opdAppointments, error: opdError } = await supabase
        .from('opd_registration')
        .select('*')
        .gte('created_at', startOfDayISO)
        .lte('created_at', endOfDayISO);
      if (opdError) throw opdError;

      const { data: ipdAdmissions, error: ipdError } = await supabase
        .from('ipd_registration')
        .select('*')
        .gte('created_at', startOfDayISO)
        .lte('created_at', endOfDayISO);
      if (ipdError) throw ipdError;

      const { data: newPatients, error: newPatientError } = await supabase
        .from('patient_detail')
        .select('*')
        .gte('created_at', startOfDayISO)
        .lte('created_at', endOfDayISO);
      if (newPatientError) throw newPatientError;

      const { data: doctors, error: doctorError } = await supabase
        .from('doctor')
        .select('*');
      if (doctorError) throw doctorError;

      // Fetch ALL bed management data for capacity and current status
      const { data: beds, error: bedError } = await supabase
        .from('bed_management')
        .select('*');
      if (bedError) throw bedError;

      // --- KPI Calculations ---
      const totalOPD = opdAppointments?.length || 0;
      const totalIPD = ipdAdmissions?.length || 0;
      const newRegistrations = newPatients?.length || 0;

      const totalDischarges = ipdAdmissions?.filter(ipd => {
        if (ipd.discharge_date) {
          return isSameDay(parseISO(ipd.discharge_date), parseISO(selectedDate));
        }
        return false;
      }).length || 0;

      const emergencyCases = opdAppointments?.filter((opd: any) => {
        return opd.department === 'Emergency' || 
               (opd.service_info && opd.service_info.some((service: any) => service.type === 'Emergency')) ||
               (opd.additional_notes && opd.additional_notes.toLowerCase().includes('emergency'));
      }).length || 0;

      // Calculate overall bed occupancy for KPI based on the new schema interpretation
      const totalHospitalBeds = beds?.length || 0; // Total number of bed records implies total beds
      const currentlyOccupiedBedsCount = beds?.filter(bed => bed.status === 'occupied').length || 0;

      const bedOccupancyRate = totalHospitalBeds > 0 ? (currentlyOccupiedBedsCount / totalHospitalBeds) * 100 : 0;

      const doctorsOnDuty = doctors?.length || 0;

      let opdRevenue = 0;
      opdAppointments?.forEach((opd: any) => {
        if (opd.payment_info && opd.payment_info.totalPaid) {
          opdRevenue += opd.payment_info.totalPaid;
        }
      });

      let ipdRevenue = 0;
      ipdAdmissions?.forEach((ipd: any) => {
        if (ipd.payment_detail && Array.isArray(ipd.payment_detail)) {
          ipdRevenue += ipd.payment_detail.reduce((sum: number, payment: any) => {
            return sum + (payment.amount || 0);
          }, 0);
        }
      });

      let pharmacyRevenue = 0;
      let labRevenue = 0;
      
      opdAppointments?.forEach((opd: any) => {
        if (opd.service_info && Array.isArray(opd.service_info)) {
          opd.service_info.forEach((service: any) => {
            if (service.type === 'Pharmacy' || service.service?.toLowerCase().includes('pharmacy')) {
              pharmacyRevenue += service.charges || 0;
            } else if (service.type === 'Lab' || service.service?.toLowerCase().includes('lab')) {
              labRevenue += service.charges || 0;
            }
          });
        }
      });

      const totalOverallRevenue = opdRevenue + ipdRevenue + pharmacyRevenue + labRevenue;

      setKpiData({
        totalOPDAppointments: totalOPD,
        totalIPDAdmissions: totalIPD,
        totalDischarges: totalDischarges,
        newPatientRegistrations: newRegistrations,
        bedOccupancyRate: parseFloat(bedOccupancyRate.toFixed(2)),
        doctorsOnDuty: doctorsOnDuty,
        totalRevenue: parseFloat(totalOverallRevenue.toFixed(2)),
        emergencyCases: emergencyCases
      });

      // --- Doctor Performance ---
      const doctorPerformanceData: DoctorPerformance[] = doctors?.map(doc => {
        const opdCount = opdAppointments?.filter((opd: any) => {
          if (opd.service_info && Array.isArray(opd.service_info)) {
            return opd.service_info.some((service: any) => service.doctor === doc.dr_name);
          }
          return false;
        }).length || 0;

        const ipdCount = ipdAdmissions?.filter((ipd: any) => {
          return ipd.under_care_of_doctor === doc.dr_name;
        }).length || 0;

        return {
          doctorName: doc.dr_name,
          department: doc.department,
          opdPatients: opdCount,
          ipdPatients: ipdCount,
        };
      }).filter(doc => doc.opdPatients > 0 || doc.ipdPatients > 0) || [];

      setDoctorPerformance(doctorPerformanceData);

      // --- Bed Management Tab Data (Revised based on new schema interpretation) ---
      const wardTypes = ['Casualty', 'ICU', 'Male', 'Female', 'NICU', 'Delux', 'Suit']; // Ensure these match your actual room_type values

      const bedManagementData: BedManagement[] = wardTypes.map(wardType => {
        // Filter beds belonging to the current ward type
        const bedsInThisWard = beds?.filter(bed => 
          bed.room_type?.toLowerCase() === wardType.toLowerCase()
        ) || [];
        
        const totalBedsInWard = bedsInThisWard.length; // Count of individual bed records for this ward
        const occupiedBedsInWard = bedsInThisWard.filter(bed => bed.status === 'occupied').length;
        const availableBedsInWard = bedsInThisWard.filter(bed => bed.status === 'available').length;
        
        // Recalculate occupancy rate for individual wards based on their occupied vs total
        const occupancyRate = totalBedsInWard > 0 ? (occupiedBedsInWard / totalBedsInWard) * 100 : 0;
        
        return {
          wardName: wardType,
          totalBeds: totalBedsInWard,
          occupiedBeds: occupiedBedsInWard,
          availableBeds: availableBedsInWard,
          occupancyRate: parseFloat(occupancyRate.toFixed(1)),
        };
      }).filter(ward => ward.totalBeds > 0); // Only show wards that have beds defined

      setBedManagement(bedManagementData);
      
      // --- Patient Statistics ---
      setPatientStats({
        totalInPatients: totalIPD,
        totalOutPatients: totalOPD,
        readmissions: ipdAdmissions?.filter(ipd => {
          return ipd.admission_type === 'Readmission' || 
                 (ipd.additional_notes && ipd.additional_notes.toLowerCase().includes('readmission'));
        }).length || 0,
        emergencyCases: emergencyCases,
        newRegistrations: newRegistrations
      });

      // --- Revenue Snapshot ---
      setRevenueData({
        opdRevenue: parseFloat(opdRevenue.toFixed(2)),
        ipdRevenue: parseFloat(ipdRevenue.toFixed(2)),
        pharmacyRevenue: parseFloat(pharmacyRevenue.toFixed(2)),
        labRevenue: parseFloat(labRevenue.toFixed(2)),
        totalRevenue: parseFloat(totalOverallRevenue.toFixed(2))
      });

      // --- Chart Data for Overview ---
      setOpdIpdChartData([
        { name: 'OPD', value: totalOPD },
        { name: 'IPD', value: totalIPD }
      ]);

      // Generate hourly revenue trend for the selected date (Illustrative)
      const hourlyRevenue = Array(24).fill(0).map((_, i) => ({
        time: `${i < 10 ? '0' : ''}${i}:00`,
        revenue: parseFloat(((totalOverallRevenue / 24) * (0.5 + Math.random() * 0.5)).toFixed(2)) 
      }));
      setRevenueChartData(hourlyRevenue);

      // --- Automated Alerts Generation ---
      if (bedOccupancyRate > 85) {
        currentAlerts.push({
          type: 'warning',
          message: `High bed occupancy: ${kpiData.bedOccupancyRate.toFixed(1)}% across all wards. Consider resource allocation.`,
          icon: AlertTriangle
        });
      }
      if (emergencyCases > 5) {
        currentAlerts.push({
          type: 'warning',
          message: `Increased emergency cases today (${emergencyCases}). Ensure adequate staff coverage.`,
          icon: AlertTriangle
        });
      }
      // Only show "No new patient registrations" if it's the current day and count is 0
      if (newRegistrations === 0 && isSameDay(parseISO(selectedDate), new Date())) {
        currentAlerts.push({
          type: 'info',
          message: 'No new patient registrations recorded today. Verify system operations.',
          icon: Clock
        });
      }
      if (totalOverallRevenue > 50000) {
        currentAlerts.push({
          type: 'success',
          message: `Excellent! Daily revenue reached ₹${totalOverallRevenue.toLocaleString()}.`,
          icon: TrendingUp
        });
      } else if (totalOverallRevenue < 10000 && totalOverallRevenue > 0) {
        currentAlerts.push({
          type: 'info',
          message: `Revenue for the day is ₹${totalOverallRevenue.toLocaleString()}. Monitor trends.`,
          icon: TrendingDown
        });
      }
      if (doctorsOnDuty < 3) {
        currentAlerts.push({
          type: 'warning',
          message: `Low doctor count (${doctorsOnDuty}) on duty. Potential for service impact.`,
          icon: Stethoscope
        });
      }

      setAlerts(currentAlerts);


    } catch (error) {
      console.error('Error fetching DPR data:', error)
      setAlerts([{ type: 'warning', message: 'Failed to load data. Please try again later.', icon: AlertTriangle }]);
    } finally {
      setIsLoading(false)
    }
  }

  // Adjusted color palette for better UI/UX
  const COLORS = ['#4A90E2', '#50E3C2', '#F5A623', '#BD10E0', '#7ED321', '#FF6B6B', '#2ECC71']; // More vibrant and modern colors

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-700 font-medium">Loading Daily Performance Report...</p>
            <p className="text-sm text-gray-500 mt-2">Fetching the latest data for {format(parseISO(selectedDate), 'MMM dd, yyyy')}...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-white p-6 rounded-lg shadow-md">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">Daily Performance Report</h1>
            <p className="text-lg text-gray-600 mt-2">A comprehensive overview of hospital operations for <span className="font-semibold text-blue-700">{format(parseISO(selectedDate), 'EEEE, MMMM dd, yyyy')}</span></p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 transition duration-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-500" />
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-auto border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 transition duration-200">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="opd">OPD</SelectItem>
                  <SelectItem value="ipd">IPD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6">
          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-blue-100 bg-blue-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">OPD Appointments</CardTitle>
              <Calendar className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">{kpiData.totalOPDAppointments}</div>
              <p className="text-xs text-blue-600 mt-1">Today's count</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-purple-100 bg-purple-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">IPD Admissions</CardTitle>
              <Building2 className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">{kpiData.totalIPDAdmissions}</div>
              <p className="text-xs text-purple-600 mt-1">Today's count</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-teal-100 bg-teal-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-teal-800">Bed Occupancy</CardTitle>
              <Bed className="h-5 w-5 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-900">{kpiData.bedOccupancyRate.toFixed(1)}%</div>
              <p className="text-xs text-teal-600 mt-1">Current rate</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-indigo-100 bg-indigo-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-indigo-800">Total Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-900">₹{kpiData.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-indigo-600 mt-1">Today's earnings</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-emerald-100 bg-emerald-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-800">Discharges</CardTitle>
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-900">{kpiData.totalDischarges}</div>
              <p className="text-xs text-emerald-600 mt-1">Today's discharges</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-rose-100 bg-rose-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-rose-800">New Patients</CardTitle>
              <Users className="h-5 w-5 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-rose-900">{kpiData.newPatientRegistrations}</div>
              <p className="text-xs text-rose-600 mt-1">Today's registrations</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-cyan-100 bg-cyan-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-cyan-800">Doctors on Duty</CardTitle>
              <Stethoscope className="h-5 w-5 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyan-900">{kpiData.doctorsOnDuty}</div>
              <p className="text-xs text-cyan-600 mt-1">Active staff</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-red-100 bg-red-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Emergency Cases</CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-900">{kpiData.emergencyCases}</div>
              <p className="text-xs text-red-600 mt-1">Today's emergencies</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-gray-200 rounded-lg p-1 shadow-inner">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-md text-gray-700 font-medium">Overview</TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-md text-gray-700 font-medium">Performance</TabsTrigger>
            <TabsTrigger value="beds" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-md text-gray-700 font-medium">Bed Management</TabsTrigger>
            <TabsTrigger value="patients" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-md text-gray-700 font-medium">Patient Stats</TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-md text-gray-700 font-medium">Revenue</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* OPD vs IPD Chart */}
              <Card className="shadow-lg border border-gray-100">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-800">OPD vs IPD Comparison ({format(parseISO(selectedDate), 'dd-MM-yyyy')})</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsBarChart data={opdIpdChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-sm text-gray-600" />
                      <YAxis axisLine={false} tickLine={false} className="text-sm text-gray-600" />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" fill="#4A90E2" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Revenue Trend */}
              <Card className="shadow-lg border border-gray-100">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-800">Daily Revenue Trend ({format(parseISO(selectedDate), 'dd-MM-yyyy')})</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} className="text-sm text-gray-600" />
                      <YAxis axisLine={false} tickLine={false} className="text-sm text-gray-600" />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Line type="monotone" dataKey="revenue" stroke="#BD10E0" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            {/* Bed Usage Pie Chart removed as per request */}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card className="shadow-lg border border-gray-100">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl font-semibold text-gray-800">Doctor Performance Summary ({format(parseISO(selectedDate), 'dd-MM-yyyy')})</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <Table className="min-w-full divide-y divide-gray-200">
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</TableHead>
                        <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</TableHead>
                        <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OPD Patients</TableHead>
                        <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IPD Patients</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-white divide-y divide-gray-200">
                      {doctorPerformance.map((doctor, index) => (
                        <TableRow key={index} className="hover:bg-gray-50 transition-colors duration-200">
                          <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doctor.doctorName}</TableCell>
                          <TableCell className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">{doctor.department}</Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{doctor.opdPatients}</TableCell>
                          <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{doctor.ipdPatients}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bed Management Tab */}
          <TabsContent value="beds" className="space-y-6">
            <Card className="shadow-lg border border-gray-100">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl font-semibold text-gray-800">Bed Management Overview ({format(parseISO(selectedDate), 'dd-MM-yyyy')})</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bedManagement.map((ward, index) => (
                    <Card key={index} className="p-6 shadow-md border border-gray-100 bg-white hover:shadow-lg transition-shadow duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800">{ward.wardName}</h3>
                        <Badge
                          className={`px-3 py-1 text-sm font-semibold rounded-full ${
                            ward.occupancyRate > 90 ? "bg-red-100 text-red-800" :
                            ward.occupancyRate > 75 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
                          }`}
                        >
                          {ward.occupancyRate.toFixed(1)}% Occupied
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-base font-medium text-gray-700">
                          <span>Total Beds:</span>
                          <span className="font-semibold text-gray-900">{ward.totalBeds}</span>
                        </div>
                        <div className="flex justify-between text-base font-medium text-gray-700">
                          <span>Occupied Today:</span>
                          <span className="font-semibold text-green-600">{ward.occupiedBeds}</span>
                        </div>
                        <div className="flex justify-between text-base font-medium text-gray-700">
                          <span>Available Today:</span>
                          <span className="font-semibold text-blue-600">{ward.availableBeds}</span>
                        </div>
                        <Progress value={ward.occupancyRate} className="mt-4 h-2.5 bg-gray-200" />
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Patient Statistics Tab */}
          <TabsContent value="patients" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-blue-100 bg-blue-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-800">In-Patients</CardTitle>
                  <Building2 className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-900">{patientStats.totalInPatients}</div>
                  <p className="text-xs text-blue-600 mt-1">Currently admitted today</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-purple-100 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-800">Out-Patients</CardTitle>
                  <Users className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-900">{patientStats.totalOutPatients}</div>
                  <p className="text-xs text-purple-600 mt-1">Visited today</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-orange-100 bg-orange-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-orange-800">Readmissions</CardTitle>
                  <UserCheck className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-900">{patientStats.readmissions}</div>
                  <p className="text-xs text-orange-600 mt-1">Today's count</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-red-100 bg-red-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-red-800">Emergency Cases</CardTitle>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-900">{patientStats.emergencyCases}</div>
                  <p className="text-xs text-red-600 mt-1">Today's emergencies</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-green-100 bg-green-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-800">New Registrations</CardTitle>
                  <Users className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-900">{patientStats.newRegistrations}</div>
                  <p className="text-xs text-green-600 mt-1">Today's new patients</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-blue-100 bg-blue-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-800">OPD Revenue</CardTitle>
                  <Calendar className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-900">₹{revenueData.opdRevenue.toLocaleString()}</div>
                  <p className="text-xs text-blue-600 mt-1">Today's total</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-purple-100 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-800">IPD Revenue</CardTitle>
                  <Building2 className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-900">₹{revenueData.ipdRevenue.toLocaleString()}</div>
                  <p className="text-xs text-purple-600 mt-1">Today's total</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-teal-100 bg-teal-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-teal-800">Pharmacy</CardTitle>
                  <Stethoscope className="h-5 w-5 text-teal-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-teal-900">₹{revenueData.pharmacyRevenue.toLocaleString()}</div>
                  <p className="text-xs text-teal-600 mt-1">Today's total</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-indigo-100 bg-indigo-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-indigo-800">Lab Services</CardTitle>
                  <Activity className="h-5 w-5 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-900">₹{revenueData.labRevenue.toLocaleString()}</div>
                  <p className="text-xs text-indigo-600 mt-1">Today's total</p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg border border-gray-100">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl font-semibold text-gray-800">Revenue Breakdown ({format(parseISO(selectedDate), 'dd-MM-yyyy')})</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 flex justify-center items-center">
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'OPD', value: revenueData.opdRevenue },
                        { name: 'IPD', value: revenueData.ipdRevenue },
                        { name: 'Pharmacy', value: revenueData.pharmacyRevenue },
                        { name: 'Lab', value: revenueData.labRevenue }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      stroke="white"
                      strokeWidth={2}
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend layout="vertical" verticalAlign="middle" align="right" />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Alerts Section */}
        <Card className="shadow-lg border border-gray-100">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-800">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              Important Alerts ({format(parseISO(selectedDate), 'dd-MM-yyyy')})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {alerts.length > 0 ? (
                alerts.map((alert, index) => (
                  <div key={index} className={`flex items-center gap-3 p-4 rounded-lg shadow-sm
                    ${alert.type === 'warning' ? 'bg-orange-50 border border-orange-200' : ''}
                    ${alert.type === 'info' ? 'bg-blue-50 border border-blue-200' : ''}
                    ${alert.type === 'success' ? 'bg-green-50 border border-green-200' : ''}
                  `}>
                    <alert.icon className={`h-5 w-5
                      ${alert.type === 'warning' ? 'text-orange-500' : ''}
                      ${alert.type === 'info' ? 'text-blue-500' : ''}
                      ${alert.type === 'success' ? 'text-green-500' : ''}
                    `} />
                    <span className={`text-base font-medium
                      ${alert.type === 'warning' ? 'text-orange-800' : ''}
                      ${alert.type === 'info' ? 'text-blue-800' : ''}
                      ${alert.type === 'success' ? 'text-green-800' : ''}
                    `}>{alert.message}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
                  <Clock className="h-5 w-5 text-gray-500" />
                  <span className="text-base font-medium text-gray-700">No specific alerts for today. All systems nominal.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default DPRPage