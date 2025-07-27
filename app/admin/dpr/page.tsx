'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Layout from '@/components/global/Layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress' // Assuming this is your custom component, not direct radix import
import {
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
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format, parseISO, isSameDay, startOfDay, endOfDay } from 'date-fns'

// Import Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement, // For Pie Chart
  LineElement, // For Line Chart
  PointElement, // For Line Chart
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
);

import { useUser } from '@/components/global/UserContext';
import { useRouter } from 'next/navigation';


// --- Timezone Management (Simplified for 'timestamp without time zone' columns) ---

const getDayRangeForSupabase = (dateString: string) => {
  const start = `${dateString}T00:00:00`;
  const end = `${dateString}T23:59:59`;
  return { start, end };
};


// --- Type Definitions ---
interface KPIData {
  totalOPDAppointments: number;
  totalIPDAdmissions: number;
  totalDischarges: number;
  totalOTProcedures: number;
  newPatientRegistrations: number;
  bedOccupancyRate: number;
  totalRevenue: number;
}

interface DoctorPerformance {
  doctorName: string;
  department: string;
  opdPatients: number;
  ipdPatients: number;
}

interface BedManagement {
  wardName: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
}

interface PatientStatistics {
  totalInPatients: number;
  totalOutPatients: number;
  readmissions: number;
  newRegistrations: number;
}

interface RevenueSnapshot {
  opdRevenue: number;
  ipdRevenue: number;
  pharmacyRevenue: number;
  labRevenue: number;
  totalRevenue: number;
}

interface Alert {
  type: 'warning' | 'info' | 'success';
  icon: React.ElementType;
  message: string;
}

export default function Page() {
  const { role, loading } = useUser();
  const router = useRouter();
  useEffect(() => {
    if (!loading) {
      if (!role) {
        router.replace('/unknown');
      } else if (role === 'opd-ipd') {
        router.replace('/opd/appointment');
      }
    }
  }, [role, loading, router]);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Data states
  const [kpiData, setKpiData] = useState<KPIData>({
    totalOPDAppointments: 0,
    totalIPDAdmissions: 0,
    totalDischarges: 0,
    totalOTProcedures: 0,
    newPatientRegistrations: 0,
    bedOccupancyRate: 0,
    totalRevenue: 0,
  });

  const [doctorPerformance, setDoctorPerformance] = useState<DoctorPerformance[]>([]);
  const [bedManagement, setBedManagement] = useState<BedManagement[]>([]);
  const [patientStats, setPatientStats] = useState<PatientStatistics>({
    totalInPatients: 0,
    totalOutPatients: 0,
    readmissions: 0,
    newRegistrations: 0
  });
  const [revenueData, setRevenueData] = useState<RevenueSnapshot>({
    opdRevenue: 0,
    ipdRevenue: 0,
    pharmacyRevenue: 0,
    labRevenue: 0,
    totalRevenue: 0
  });

  // Chart data
  const [opdIpdChartData, setOpdIpdChartData] = useState<any>({
    labels: ['OPD', 'IPD'],
    datasets: [{
      label: 'Patient Count',
      data: [0, 0],
      backgroundColor: ['#4A90E2', '#50E3C2'], // Custom colors
      borderRadius: 5,
    }],
  });
  const [revenueTrendChartData, setRevenueTrendChartData] = useState<any>({
    labels: [],
    datasets: [{
      label: 'Revenue',
      data: [],
      fill: false,
      borderColor: '#BD10E0',
      tension: 0.1,
    }],
  });
  const [revenuePieChartData, setRevenuePieChartData] = useState<any>({
    labels: ['OPD', 'IPD', 'Pharmacy', 'Lab'],
    datasets: [{
      data: [0, 0, 0, 0],
      backgroundColor: ['#4A90E2', '#50E3C2', '#F5A623', '#BD10E0'],
      borderColor: '#fff',
      borderWidth: 2,
    }],
  });


  const fetchDPRData = useCallback(async () => {
    setIsLoading(true);
    const currentAlerts: Alert[] = [];
    try {
      const { start, end } = getDayRangeForSupabase(selectedDate);

      // --- Fetching data from Supabase ---
      const { data: opdAppointments, error: opdError } = await supabase
        .from('opd_registration')
        .select(`
          created_at,
          service_info,
          payment_info,
          "additional Notes",
          opd_id
        `)
        .gte('created_at', start)
        .lte('created_at', end);
      if (opdError) {
        console.error("Supabase OPD fetch error:", opdError);
        throw opdError;
      }

      const { data: ipdAdmissions, error: ipdError } = await supabase
        .from('ipd_registration')
        .select(`
          created_at,
          discharge_date,
          under_care_of_doctor,
          payment_detail,
          admission_type
        `)
        .gte('created_at', start)
        .lte('created_at', end);
      if (ipdError) {
        console.error("Supabase IPD fetch error:", ipdError);
        throw ipdError;
      }

      const { data: otProcedures, error: otError } = await supabase
        .from('ot_details')
        .select(`
          created_at,
          ot_date,
          ipd_id,
          uhid,
          ot_type,
          ot_notes,
          id
        `)
        .gte('created_at', start)
        .lte('created_at', end);
      if (otError) {
        console.error("Supabase OT fetch error:", otError);
        throw otError;
      }

      const { data: newPatients, error: newPatientError } = await supabase
        .from('patient_detail')
        .select(`
          created_at,
          name,
          uhid
        `)
        .gte('created_at', start)
        .lte('created_at', end);
      if (newPatientError) {
        console.error("Supabase New Patients fetch error:", newPatientError);
        throw newPatientError;
      }

      const { data: doctors, error: doctorError } = await supabase
        .from('doctor')
        .select('dr_name, department');
      if (doctorError) {
        console.error("Supabase Doctors fetch error:", doctorError);
        throw doctorError;
      }

      const { data: beds, error: bedError } = await supabase
        .from('bed_management')
        .select('status, room_type');
      if (bedError) {
        console.error("Supabase Beds fetch error:", bedError);
        throw bedError;
      }

      // --- KPI Calculations ---
      const totalOPD = opdAppointments?.length || 0;
      const totalIPD = ipdAdmissions?.length || 0;
      const totalOT = otProcedures?.length || 0;
      const newRegistrations = newPatients?.length || 0;

      const totalDischarges = ipdAdmissions?.filter(ipd => {
        if (ipd.discharge_date) {
          const dischargeDateFormatted = format(parseISO(ipd.discharge_date), 'yyyy-MM-dd');
          return dischargeDateFormatted === selectedDate;
        }
        return false;
      }).length || 0;

      const totalHospitalBeds = beds?.length || 0;
      const currentlyOccupiedBedsCount = beds?.filter(bed => bed.status === 'occupied').length || 0;

      const bedOccupancyRate = totalHospitalBeds > 0 ? (currentlyOccupiedBedsCount / totalHospitalBeds) * 100 : 0;

      let opdRevenue = 0;
      opdAppointments?.forEach((opd: any) => {
        if (opd.payment_info && typeof opd.payment_info.totalPaid === 'number') {
          opdRevenue += opd.payment_info.totalPaid;
        }
      });

      let ipdRevenue = 0;
      ipdAdmissions?.forEach((ipd: any) => {
        if (ipd.payment_detail && Array.isArray(ipd.payment_detail)) {
          ipd.payment_detail.forEach((payment: any) => {
            const paymentType = payment.type?.toLowerCase();
            const amountType = payment.amountType?.toLowerCase();
            const transactionType = payment.transactionType?.toLowerCase();

            if (paymentType === 'deposit' || paymentType === 'advance' || transactionType === 'settlement' || amountType === 'deposit' || amountType === 'advance' || amountType === 'settlement') {
              ipdRevenue += payment.amount || 0;
            }
          });
        }
      });

      let pharmacyRevenue = 0;
      let labRevenue = 0;

      opdAppointments?.forEach((opd: any) => {
        if (opd.service_info && Array.isArray(opd.service_info)) {
          opd.service_info.forEach((service: any) => {
            if (service.type?.toLowerCase() === 'pharmacy' || service.service?.toLowerCase().includes('pharmacy')) {
              pharmacyRevenue += service.charges || 0;
            } else if (service.type?.toLowerCase() === 'lab' || service.service?.toLowerCase().includes('lab') || service.type?.toLowerCase() === 'pathology' || service.type?.toLowerCase() === 'radiology') {
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
        totalOTProcedures: totalOT,
        newPatientRegistrations: newRegistrations,
        bedOccupancyRate: parseFloat(bedOccupancyRate.toFixed(2)),
        totalRevenue: parseFloat(totalOverallRevenue.toFixed(2)),
      });

      // --- Doctor Performance ---
      const doctorPerformanceMap = new Map<string, { opdPatients: number, ipdPatients: number, department: string }>();

      doctors?.forEach(doc => {
        doctorPerformanceMap.set(doc.dr_name, { opdPatients: 0, ipdPatients: 0, department: doc.department });
      });

      opdAppointments?.forEach((opd: any) => {
        if (opd.service_info && Array.isArray(opd.service_info)) {
          opd.service_info.forEach((service: any) => {
            if (service.doctor && doctorPerformanceMap.has(service.doctor)) {
              const current = doctorPerformanceMap.get(service.doctor)!;
              doctorPerformanceMap.set(service.doctor, { ...current, opdPatients: current.opdPatients + 1 });
            }
          });
        }
      });

      ipdAdmissions?.forEach((ipd: any) => {
        if (ipd.under_care_of_doctor && doctorPerformanceMap.has(ipd.under_care_of_doctor)) {
          const current = doctorPerformanceMap.get(ipd.under_care_of_doctor)!;
          doctorPerformanceMap.set(ipd.under_care_of_doctor, { ...current, ipdPatients: current.ipdPatients + 1 });
        }
      });

      const doctorPerformanceData: DoctorPerformance[] = Array.from(doctorPerformanceMap.entries())
        .map(([doctorName, data]) => ({
          doctorName,
          department: data.department,
          opdPatients: data.opdPatients,
          ipdPatients: data.ipdPatients,
        }))
        .filter(doc => doc.opdPatients > 0 || doc.ipdPatients > 0)
        .sort((a, b) => (b.opdPatients + b.ipdPatients) - (a.opdPatients + a.ipdPatients));

      setDoctorPerformance(doctorPerformanceData);

      // --- Bed Management Tab Data ---
      const uniqueRoomTypes = Array.from(new Set(beds?.map(bed => bed.room_type).filter(Boolean))) as string[];

      const bedManagementData: BedManagement[] = uniqueRoomTypes.map(roomType => {
        const bedsInThisWard = beds?.filter(bed => bed.room_type === roomType) || [];

        const totalBedsInWard = bedsInThisWard.length;
        const occupiedBedsInWard = bedsInThisWard.filter(bed => bed.status === 'occupied').length;
        const availableBedsInWard = bedsInThisWard.filter(bed => bed.status === 'available').length;

        const occupancyRate = totalBedsInWard > 0 ? (occupiedBedsInWard / totalBedsInWard) * 100 : 0;

        return {
          wardName: roomType,
          totalBeds: totalBedsInWard,
          occupiedBeds: occupiedBedsInWard,
          availableBeds: availableBedsInWard,
          occupancyRate: parseFloat(occupancyRate.toFixed(1)),
        };
      }).sort((a,b) => b.occupancyRate - a.occupancyRate);

      setBedManagement(bedManagementData);

      // --- Patient Statistics ---
      setPatientStats({
        totalInPatients: totalIPD,
        totalOutPatients: totalOPD,
        readmissions: ipdAdmissions?.filter(ipd => {
          return ipd.admission_type?.toLowerCase() === 'readmission';
        }).length || 0,
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

      // --- Chart Data for Overview (UPDATED FOR CHART.JS) ---
      setOpdIpdChartData({
        labels: ['OPD', 'IPD'],
        datasets: [{
          label: 'Patient Count',
          data: [totalOPD, totalIPD],
          backgroundColor: ['#4A90E2', '#50E3C2'],
          borderRadius: 5,
        }],
      });

      // Generate hourly revenue trend for the selected date (Illustrative)
      const hourlyRevenueLabels = Array(24).fill(0).map((_, i) => `${i < 10 ? '0' : ''}${i}:00`);
      const hourlyRevenueValues = Array(24).fill(0).map(() => parseFloat(((totalOverallRevenue / 24) * (0.8 + Math.random() * 0.4)).toFixed(2)));

      setRevenueTrendChartData({
        labels: hourlyRevenueLabels,
        datasets: [{
          label: 'Revenue',
          data: hourlyRevenueValues,
          fill: false,
          borderColor: '#BD10E0',
          tension: 0.1,
          pointBackgroundColor: '#BD10E0',
          pointBorderColor: '#fff',
          pointHoverRadius: 7,
          pointRadius: 5,
        }],
      });

      // Revenue Pie Chart Data (UPDATED FOR CHART.JS)
      setRevenuePieChartData({
        labels: ['OPD Revenue', 'IPD Revenue', 'Pharmacy Revenue', 'Lab Revenue'],
        datasets: [{
          data: [opdRevenue, ipdRevenue, pharmacyRevenue, labRevenue], // Use the direct calculated revenue here
          backgroundColor: ['#4A90E2', '#50E3C2', '#F5A623', '#BD10E0'],
          borderColor: '#fff',
          borderWidth: 2,
        }],
      });


      // --- Automated Alerts Generation ---
      if (bedOccupancyRate > 85) {
        currentAlerts.push({
          type: 'warning',
          message: `High bed occupancy: ${bedOccupancyRate.toFixed(1)}% across all wards. Consider resource allocation.`,
          icon: AlertTriangle
        });
      }

      const todayFormattedForComparison = format(new Date(), 'yyyy-MM-dd');
      if (newRegistrations === 0 && selectedDate === todayFormattedForComparison) {
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

      setAlerts(currentAlerts);

    } catch (error) {
      console.error('Caught error during DPR data fetch:', error);
      setAlerts([{ type: 'warning', message: 'Failed to load data. Please try again later. Check console for details.', icon: AlertTriangle }]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]); // Removed departmentFilter as it's not currently used in fetch logic

  useEffect(() => {
    fetchDPRData();
  }, [selectedDate, fetchDPRData]); // Removed departmentFilter from here as well

  // Adjusted color palette for better UI/UX (for Chart.js, if you need them for other elements)
  const COLORS = ['#4A90E2', '#50E3C2', '#F5A623', '#BD10E0', '#7ED321', '#FF6B6B', '#2ECC71'];

  // Chart.js Options for Bar Chart (OPD vs IPD)
  const opdIpdBarOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#4A90E2',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#fff',
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#4A90E2',
          font: { weight: 'bold' as const },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          color: '#4A90E2',
          font: { weight: 'bold' as const },
        },
        grid: {
          color: '#e0e7ef',
        },
      },
    },
  };

  // Chart.js Options for Line Chart (Revenue Trend)
  const revenueLineOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#BD10E0',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#fff',
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#BD10E0',
          font: { weight: 'bold' as const },
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#BD10E0',
          font: { weight: 'bold' as const },
        },
        grid: {
          color: '#e0e7ef',
        },
      },
    },
  };

  // Chart.js Options for Pie Chart (Revenue Breakdown)
  const revenuePieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#4A90E2',
          font: {
            size: 14,
            weight: 'bold' as const
          }
        }
      },
      tooltip: {
        backgroundColor: '#333',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#fff',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context: any) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += `₹${context.parsed.toLocaleString()}`;
            }
            return label;
          }
        }
      },
      // datalabels: { // This would require `chartjs-plugin-datalabels`
      //   display: true,
      //   color: '#fff',
      //   formatter: (value: number, context: any) => {
      //     const total = context.chart.data.datasets[0].data.reduce((sum: number, val: number) => sum + val, 0);
      //     const percentage = total > 0 ? (value / total * 100).toFixed(0) : 0;
      //     return `${percentage}%`;
      //   },
      //   font: {
      //     weight: 'bold',
      //     size: 14,
      //   }
      // }
    },
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-700 font-medium">Loading Daily Performance Report...</p>
            <p className="text-sm text-gray-500 mt-2">Fetching the latest data for <span className="font-semibold">{format(parseISO(selectedDate), 'MMM dd, yyyy')}</span>...</p>
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
            {/* Department filter is still here but not fully integrated into fetchDPRData logic */}
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
              <CardTitle className="text-sm font-medium text-blue-800">Total OPD</CardTitle>
              <Calendar className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">{kpiData.totalOPDAppointments}</div>
              <p className="text-xs text-blue-600 mt-1">Appointments on {format(parseISO(selectedDate), 'MMM dd')}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-purple-100 bg-purple-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">Total IPD</CardTitle>
              <Building2 className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">{kpiData.totalIPDAdmissions}</div>
              <p className="text-xs text-purple-600 mt-1">Admissions on {format(parseISO(selectedDate), 'MMM dd')}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-green-100 bg-green-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Total OT</CardTitle>
              <Stethoscope className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">{kpiData.totalOTProcedures}</div>
              <p className="text-xs text-green-600 mt-1">Procedures on {format(parseISO(selectedDate), 'MMM dd')}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-teal-100 bg-teal-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-teal-800">Bed Occupancy</CardTitle>
              <Bed className="h-5 w-5 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-900">{kpiData.bedOccupancyRate.toFixed(1)}%</div>
              <p className="text-xs text-teal-600 mt-1">Current rate as of {format(new Date(), 'MMM dd, HH:mm')}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-rose-100 bg-rose-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-rose-800">New Patients</CardTitle>
              <Users className="h-5 w-5 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-rose-900">{kpiData.newPatientRegistrations}</div>
              <p className="text-xs text-rose-600 mt-1">Registrations on {format(parseISO(selectedDate), 'MMM dd')}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-emerald-100 bg-emerald-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-800">Discharges</CardTitle>
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-900">{kpiData.totalDischarges}</div>
              <p className="text-xs text-emerald-600 mt-1">Discharges on {format(parseISO(selectedDate), 'MMM dd')}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-indigo-100 bg-indigo-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-indigo-800">OPD Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-900">₹{revenueData.opdRevenue.toLocaleString()}</div>
              <p className="text-xs text-indigo-600 mt-1">Earnings on {format(parseISO(selectedDate), 'MMM dd')}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-orange-100 bg-orange-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">IPD Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-900">₹{revenueData.ipdRevenue.toLocaleString()}</div>
              <p className="text-xs text-orange-600 mt-1">Earnings on {format(parseISO(selectedDate), 'MMM dd')}</p>
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
              {/* OPD vs IPD Chart (Chart.js Bar) */}
              <Card className="shadow-lg border border-gray-100">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-800">OPD vs IPD Comparison ({format(parseISO(selectedDate), 'dd-MM-yyyy')})</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[300px]"> {/* Chart.js needs a defined height */}
                    <Bar data={opdIpdChartData} options={opdIpdBarOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Trend (Chart.js Line) */}
              <Card className="shadow-lg border border-gray-100">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-800">Daily Revenue Trend ({format(parseISO(selectedDate), 'dd-MM-yyyy')})</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[300px]"> {/* Chart.js needs a defined height */}
                    <Line data={revenueTrendChartData} options={revenueLineOptions} />
                  </div>
                </CardContent>
              </Card>
            </div>
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
                  <p className="text-xs text-blue-600 mt-1">Admitted on {format(parseISO(selectedDate), 'MMM dd')}</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-purple-100 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-800">Out-Patients</CardTitle>
                  <Users className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-900">{patientStats.totalOutPatients}</div>
                  <p className="text-xs text-purple-600 mt-1">Visited on {format(parseISO(selectedDate), 'MMM dd')}</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-orange-100 bg-orange-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-orange-800">Readmissions</CardTitle>
                  <UserCheck className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-900">{patientStats.readmissions}</div>
                  <p className="text-xs text-orange-600 mt-1">On {format(parseISO(selectedDate), 'MMM dd')}</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-green-100 bg-green-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-800">New Registrations</CardTitle>
                  <Users className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-900">{patientStats.newRegistrations}</div>
                  <p className="text-xs text-green-600 mt-1">On {format(parseISO(selectedDate), 'MMM dd')}</p>
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
                  <p className="text-xs text-blue-600 mt-1">On {format(parseISO(selectedDate), 'MMM dd')}</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-purple-100 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-800">IPD Revenue</CardTitle>
                  <Building2 className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-900">₹{revenueData.ipdRevenue.toLocaleString()}</div>
                  <p className="text-xs text-purple-600 mt-1">On {format(parseISO(selectedDate), 'MMM dd')}</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-teal-100 bg-teal-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-teal-800">Pharmacy</CardTitle>
                  <Stethoscope className="h-5 w-5 text-teal-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-teal-900">₹{revenueData.pharmacyRevenue.toLocaleString()}</div>
                  <p className="text-xs text-teal-600 mt-1">On {format(parseISO(selectedDate), 'MMM dd')}</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-indigo-100 bg-indigo-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-indigo-800">Lab Services</CardTitle>
                  <Activity className="h-5 w-5 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-900">₹{revenueData.labRevenue.toLocaleString()}</div>
                  <p className="text-xs text-indigo-600 mt-1">On {format(parseISO(selectedDate), 'MMM dd')}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg border border-gray-100">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl font-semibold text-gray-800">Revenue Breakdown ({format(parseISO(selectedDate), 'dd-MM-yyyy')})</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 flex justify-center items-center">
                <div className="h-[400px]"> {/* Chart.js needs a defined height */}
                  <Pie data={revenuePieChartData} options={revenuePieOptions} />
                </div>
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
                  <span className="text-base font-medium text-gray-700">No specific alerts for this date. All systems nominal.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}