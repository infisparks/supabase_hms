"use client"

import React, { useEffect, useMemo, useState } from "react"
import Layout from "@/components/global/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Bar } from "react-chartjs-2"
import {
  Users,
  User,
  Phone,
  CalendarDays,
  MapPin,
  Edit,
  Trash2,
  Filter,
  Search,
  BarChart2,
  Plus,
} from "lucide-react"
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js"
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

// PatientDetail type (from your codebase)
interface PatientDetail {
  patient_id: number
  name: string
  number: string
  age?: number
  age_unit?: string
  dob?: string
  gender?: string
  address?: string
  uhid: string
  created_at?: string
  updated_at?: string
}

const COLORS = [
  "from-sky-100 to-blue-200",
  "from-orange-100 to-red-200",
  "from-emerald-100 to-green-200",
]
const BOX_ICONS = [
  <Users className="h-7 w-7 text-sky-600" />, // Today
  <CalendarDays className="h-7 w-7 text-orange-600" />, // Week
  <BarChart2 className="h-7 w-7 text-emerald-600" />, // Month
]
const FILTERS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
]

function getDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}
function isToday(date: string) {
  return date === getDateString(new Date())
}
function isThisWeek(date: string) {
  const now = new Date()
  const d = new Date(date)
  const first = now.getDate() - now.getDay() + 1
  const last = first + 6
  const weekStart = new Date(now.setDate(first))
  const weekEnd = new Date(now.setDate(last))
  return d >= weekStart && d <= weekEnd
}
function isThisMonth(date: string) {
  const now = new Date()
  const d = new Date(date)
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

const PatientAdminPage = () => {
  const [patients, setPatients] = useState<PatientDetail[]>([])
  const [filtered, setFiltered] = useState<PatientDetail[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("today")
  const [editPatient, setEditPatient] = useState<PatientDetail | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<PatientDetail>>({})
  const [loading, setLoading] = useState(false)

  // Fetch all patients
  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true)
      const { data, error } = await supabase.from("patient_detail").select("*").order("created_at", { ascending: false })
      if (error) {
        toast.error("Failed to fetch patients")
        setPatients([])
      } else {
        setPatients(data || [])
      }
      setLoading(false)
    }
    fetchPatients()
  }, [])

  // Filter/search logic
  useEffect(() => {
    let data = [...patients]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      data = data.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.uhid.toLowerCase().includes(q) ||
          (p.number && String(p.number).includes(q)) // FIX: always string
      )
    }
    if (filter === "today") {
      data = data.filter((p) => p.created_at && isToday(p.created_at.slice(0, 10)))
    } else if (filter === "week") {
      data = data.filter((p) => p.created_at && isThisWeek(p.created_at.slice(0, 10)))
    } else if (filter === "month") {
      data = data.filter((p) => p.created_at && isThisMonth(p.created_at.slice(0, 10)))
    }
    setFiltered(data)
  }, [patients, search, filter])

  // Stats
  const stats = useMemo(() => {
    const today = patients.filter((p) => p.created_at && isToday(p.created_at.slice(0, 10))).length
    const week = patients.filter((p) => p.created_at && isThisWeek(p.created_at.slice(0, 10))).length
    const month = patients.filter((p) => p.created_at && isThisMonth(p.created_at.slice(0, 10))).length
    return [today, week, month]
  }, [patients])

  // Graph data
  const graphData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = getDateString(d)
      counts[key] = 0
    }
    patients.forEach((p) => {
      if (p.created_at) {
        const d = p.created_at.slice(0, 10)
        if (counts[d] !== undefined) counts[d]++
      }
    })
    // Format x-axis labels as '11 Jul', '10 Jul', ...
    const labels = Object.keys(counts).map((d) => {
      const dateObj = new Date(d)
      return `${dateObj.getDate()} ${dateObj.toLocaleString('en-US', { month: 'short' })}`
    })
    return {
      labels,
      datasets: [
        {
          label: "Patients",
          data: Object.values(counts),
          backgroundColor: "rgba(59,130,246,0.7)", // blue-600
          borderColor: "#2563eb", // blue-700
          borderWidth: 3,
          borderRadius: 8,
          pointBackgroundColor: "#fff",
          pointBorderColor: "#2563eb",
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4,
        },
      ],
    }
  }, [patients])

  // Edit logic
  const openEdit = (p: PatientDetail) => {
    setEditPatient(p)
    setEditForm({ ...p })
    setEditOpen(true)
  }
  const closeEdit = () => {
    setEditOpen(false)
    setEditPatient(null)
    setEditForm({})
  }
  const handleEditChange = (k: keyof PatientDetail, v: any) => {
    setEditForm((f) => ({ ...f, [k]: v }))
  }
  const handleEditSave = async () => {
    if (!editPatient) return
    setLoading(true)
    const { error } = await supabase
      .from("patient_detail")
      .update({
        name: editForm.name,
        number: editForm.number,
        age: editForm.age,
        age_unit: editForm.age_unit,
        address: editForm.address,
        gender: editForm.gender,
      })
      .eq("patient_id", editPatient.patient_id)
    if (error) {
      toast.error("Failed to update patient")
    } else {
      toast.success("Patient updated")
      setPatients((prev) =>
        prev.map((p) =>
          p.patient_id === editPatient.patient_id
            ? { ...p, ...editForm }
            : p
        )
      )
      closeEdit()
    }
    setLoading(false)
  }
  // Delete logic
  const handleDelete = async (p: PatientDetail) => {
    if (!window.confirm(`Delete patient ${p.name} (${p.uhid})?`)) return
    setLoading(true)
    const { error } = await supabase.from("patient_detail").delete().eq("patient_id", p.patient_id)
    if (error) {
      toast.error("Failed to delete patient")
    } else {
      toast.success("Patient deleted")
      setPatients((prev) => prev.filter((x) => x.patient_id !== p.patient_id))
    }
    setLoading(false)
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Patient Admin</h1>
          <p className="text-gray-600">Manage all patient records and details</p>
        </div>
        {/* Stats Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          {stats.map((v, i) => (
            <Card key={i} className={`shadow-lg border-0 bg-gradient-to-br ${COLORS[i]} text-gray-900`}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <div className="text-2xl font-bold">{v}</div>
                  <div className="text-sm font-medium mt-1">{FILTERS[i].label} Patients</div>
                </div>
                <div>{BOX_ICONS[i]}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Graph */}
        <Card className="mb-6 shadow-lg border-0 bg-gradient-to-br from-blue-50 to-sky-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <BarChart2 className="h-6 w-6" /> Patient Registrations (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bar
              data={graphData}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#2563eb',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#fff',
                    borderWidth: 1,
                    padding: 12,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#2563eb', font: { weight: 'bold' } },
                    grid: { color: '#e0e7ef' },
                  },
                  x: {
                    grid: { display: false },
                    ticks: {
                      color: '#2563eb',
                      font: { weight: 'bold' },
                      autoSkip: true,
                      maxTicksLimit: 10, // Only show a few x-axis labels
                    },
                  },
                },
                animation: {
                  duration: 1200,
                  easing: 'easeOutQuart',
                },
                hover: {
                  mode: 'nearest',
                  intersect: true,
                },
              }}
              height={80}
            />
          </CardContent>
        </Card>
        {/* Table Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
          <div className="flex gap-2 items-center">
            <Filter className="h-5 w-5 text-gray-500" />
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                className={`rounded-full px-4 py-1 text-sm font-semibold transition-colors ${
                  filter === f.key
                    ? "bg-blue-600 text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-blue-100"
                }`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search by name, phone, or UHID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition shadow-sm"
            />
          </div>
        </div>
        {/* Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-x-auto border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-blue-50 to-sky-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Patient Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Age</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Address</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Gender</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-blue-700 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">No patients found</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.patient_id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900 flex flex-col">
                        {p.name}
                        <span className="text-xs text-blue-600 font-mono">UHID: {p.uhid}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{p.number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {p.age ?? "-"} {p.age_unit ? <span className="text-xs text-gray-500">{p.age_unit}</span> : null}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{p.address ?? "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 capitalize">{p.gender ?? "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                      <Button size="sm" variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-100" onClick={() => openEdit(p)}>
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-500 text-red-700 hover:bg-red-100" onClick={() => handleDelete(p)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Edit Modal */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Edit className="h-6 w-6 text-blue-600" /> Edit Patient Detail
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <Input value={editForm.name || ""} onChange={e => handleEditChange("name", e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <Input value={editForm.number || ""} onChange={e => handleEditChange("number", e.target.value)} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">Age</label>
                  <Input type="number" value={editForm.age ?? ""} onChange={e => handleEditChange("age", e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">Unit</label>
                  <Input value={editForm.age_unit || ""} onChange={e => handleEditChange("age_unit", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <Input value={editForm.address || ""} onChange={e => handleEditChange("address", e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <Input value={editForm.gender || ""} onChange={e => handleEditChange("gender", e.target.value)} />
              </div>
              <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={handleEditSave} disabled={loading}>
                Update
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
}

export default PatientAdminPage