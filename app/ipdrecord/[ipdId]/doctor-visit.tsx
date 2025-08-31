"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { RefreshCw, PlusCircle, MinusCircle } from "lucide-react"
import PatientDetailsHeader from "./PatientDetailsHeader"
import PdfGenerator from "./PdfGenerator" // Import PdfGenerator

// --- Type Definitions ---
interface DoctorVisitRow {
  day: string
  date: string
  consultant: string // Will hold text or signature URL
  referral1: string // Will hold text or signature URL
  referral2: string // Will hold text or signature URL
  referral3: string // Will hold text or signature URL
  referral4: string // Will hold text or signature URL
}

interface DoctorNamesData {
  consultantDr: string
  referral1Dr: string
  referral2Dr: string
  referral3Dr: string
  referral4Dr: string
}

interface DoctorVisitData {
  doctorNames: DoctorNamesData
  rows: DoctorVisitRow[]
}

// UPDATED: Helper Function to Create Initial State (1 week, Mon-Sun)
const createInitialData = (): DoctorVisitRow[] => {
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  return daysOfWeek.map((day) => ({
    day,
    date: "",
    consultant: "",
    referral1: "",
    referral2: "",
    referral3: "",
    referral4: "",
  }))
}

const initialDoctorNames: DoctorNamesData = {
  consultantDr: "",
  referral1Dr: "",
  referral2Dr: "",
  referral3Dr: "",
  referral4Dr: "",
}

// UPDATED: Set day order for addRow logic
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// --- Main Doctor Visit Page Component ---
const DoctorVisitPage = ({ ipdId }: { ipdId: string }) => {
  const [rows, setRows] = useState<DoctorVisitRow[]>(createInitialData())
  const [doctorNames, setDoctorNames] = useState<DoctorNamesData>(initialDoctorNames)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [verifyingSignature, setVerifyingSignature] = useState<{
    index: number
    field: keyof Omit<DoctorVisitRow, "day" | "date">
  } | null>(null)
  const formRef = useRef<HTMLDivElement>(null) // Create the ref

  // --- Data Fetching Function ---
  const fetchDoctorVisitData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.from("ipd_record").select("doctorvisit").eq("ipd_id", ipdId).single()

      if (error && error.code !== "PGRST116") throw error

      if (data?.doctorvisit) {
        const parsedData = data.doctorvisit as DoctorVisitData
        if (parsedData.doctorNames && Array.isArray(parsedData.rows) && parsedData.rows.length > 0) {
          setDoctorNames(parsedData.doctorNames)
          setRows(parsedData.rows)
          toast.success("Previous doctor visit data loaded.")
        }
      }
    } catch (error) {
      console.error("Failed to fetch doctor visit data:", error)
      toast.error("Failed to load doctor visit data.")
    } finally {
      setIsLoading(false)
    }
  }, [ipdId])

  useEffect(() => {
    if (ipdId) fetchDoctorVisitData()
  }, [ipdId, fetchDoctorVisitData])

  // --- Data Saving Function ---
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        toast.error("User not authenticated.")
        setIsSaving(false)
        return
      }

      const rowsToSave = rows.map((row) => {
        const newRow = { ...row }
        const fields: (keyof Omit<DoctorVisitRow, "day" | "date">)[] = [
          "consultant",
          "referral1",
          "referral2",
          "referral3",
          "referral4",
        ]
        fields.forEach((field) => {
          if (newRow[field].length === 10 && !newRow[field].startsWith("http")) {
            newRow[field] = "" // Clear unsaved PINs
          }
        })
        return newRow
      })

      const dataToSave: DoctorVisitData = { doctorNames, rows: rowsToSave }

      const { error } = await supabase.from("ipd_record").upsert(
        {
          ipd_id: ipdId,
          user_id: session.user.id,
          doctorvisit: dataToSave,
        },
        { onConflict: "ipd_id,user_id" },
      )

      if (error) throw error
      toast.success("Doctor visit sheet saved successfully!")
    } catch (error) {
      console.error("Failed to save doctor visit data:", error)
      toast.error("Failed to save data.")
    } finally {
      setIsSaving(false)
    }
  }

  // --- Signature Verification Function ---
  const checkAndSetSignature = useCallback(
    async (password: string, index: number, field: keyof Omit<DoctorVisitRow, "day" | "date">) => {
      if (password.length !== 10) return
      setVerifyingSignature({ index, field })
      try {
        const { data, error } = await supabase
          .from("signature")
          .select("signature_url")
          .eq("password", password)
          .single()

        if (error && error.code !== "PGRST116") throw error

        if (data?.signature_url) {
          setRows((prevRows) => prevRows.map((row, i) => (i === index ? { ...row, [field]: data.signature_url } : row)))
          toast.success(`Signature verified for row ${index + 1}.`)
        } else {
          toast.error(`Invalid PIN for row ${index + 1}.`)
        }
      } catch (error) {
        console.error("Error verifying signature:", error)
        toast.error("Could not verify signature.")
      } finally {
        setVerifyingSignature(null)
      }
    },
    [],
  )

  // --- Input Change Handlers ---
  const handleRowInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: keyof Omit<DoctorVisitRow, "day" | "date">,
  ) => {
    const { value } = e.target
    const newRows = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    setRows(newRows)

    if (value.length === 10 && !value.startsWith("http")) {
      checkAndSetSignature(value, index, field)
    }
  }

  const handleDoctorNameChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof DoctorNamesData) => {
    const { value } = e.target
    setDoctorNames((prev) => ({ ...prev, [field]: value }))
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { value } = e.target
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, date: value } : row)))
  }

  // --- Reset Signature with Confirmation ---
  const handleSignatureReset = (index: number, field: keyof Omit<DoctorVisitRow, "day" | "date">) => {
    if (window.confirm("Are you sure you want to remove this signature?")) {
      setRows((prevRows) => prevRows.map((row, i) => (i === index ? { ...row, [field]: "" } : row)))
      toast.info(`Signature for row ${index + 1} has been cleared.`)
    }
  }

  // --- Row Management Functions ---
  const addRow = () => {
    const lastDay = rows.length > 0 ? rows[rows.length - 1].day : "Sun"
    const lastDayIndex = daysOfWeek.indexOf(lastDay)
    const nextDay = daysOfWeek[(lastDayIndex + 1) % 7]
    const newRow: DoctorVisitRow = {
      day: nextDay,
      date: "",
      consultant: "",
      referral1: "",
      referral2: "",
      referral3: "",
      referral4: "",
    }
    setRows((prevRows) => [...prevRows, newRow])
  }

  const removeRow = () => {
    if (rows.length > 1) {
      setRows((prevRows) => prevRows.slice(0, -1))
    } else {
      toast.info("At least one row is required.")
    }
  }

  // --- Reusable Cell Renderer ---
  const renderCell = (row: DoctorVisitRow, index: number, field: keyof Omit<DoctorVisitRow, "day" | "date">) => {
    const value = row[field]
    if (verifyingSignature?.index === index && verifyingSignature?.field === field) {
      return <RefreshCw className="h-5 w-5 animate-spin text-blue-500 mx-auto" />
    }
    if (typeof value === "string" && value.startsWith("http")) {
      return (
        <img
          src={value || "/placeholder.svg"}
          alt="Signature"
          title="Click to remove signature"
          className="h-8 object-contain cursor-pointer p-1 hover:opacity-75 transition-opacity mx-auto"
          onClick={() => handleSignatureReset(index, field)}
        />
      )
    }
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleRowInputChange(e, index, field)}
        className="p-2 w-full h-full text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoComplete="off"
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-md min-h-[50vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-xl text-gray-600">Loading doctor visit sheet...</p>
      </div>
    )
  }

  return (
    <div ref={formRef} className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto font-sans">
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl uppercase">Dr. Visit Form</h1>
      </div>

      <PatientDetailsHeader ipdId={ipdId} />

      <div className="border border-gray-400 rounded-md overflow-hidden">
        {/* Table Header with Doctor Name Inputs */}
        <div className="grid grid-cols-[50px_90px_repeat(5,1fr)] bg-gray-200 font-bold text-xs text-center">
          <div className="p-2 border-r border-b border-gray-400 flex items-center justify-center">Day</div>
          <div className="p-2 border-r border-b border-gray-400 flex items-center justify-center">Date</div>
          <div className="p-1 border-r border-b border-gray-400 flex flex-col justify-center">
            <span>Consultant</span>
            <div className="flex items-center justify-center mt-1">
              <span className="font-normal mr-1">Dr.</span>
              <input
                type="text"
                value={doctorNames.consultantDr}
                onChange={(e) => handleDoctorNameChange(e, "consultantDr")}
                className="w-full  text-center bg-white rounded-sm p-0.5 pb-1 pt-1 focus:outline-none"
              />
            </div>
          </div>
          <div className="p-1 border-r border-b border-gray-400 flex flex-col justify-center">
            <span>Referral - I</span>
            <div className="flex items-center justify-center mt-1">
              <span className="font-normal mr-1">Dr.</span>
              <input
                type="text"
                value={doctorNames.referral1Dr}
                onChange={(e) => handleDoctorNameChange(e, "referral1Dr")}
                className="w-full text-center bg-white rounded-sm p-0.5 pb-1 pt-1 focus:outline-none"
              />
            </div>
          </div>
          <div className="p-1 border-r border-b border-gray-400 flex flex-col justify-center">
            <span>Referral - II</span>
            <div className="flex items-center justify-center mt-1">
              <span className="font-normal mr-1">Dr.</span>
              <input
                type="text"
                value={doctorNames.referral2Dr}
                onChange={(e) => handleDoctorNameChange(e, "referral2Dr")}
                className="w-full text-center bg-white rounded-sm p-0.5 pb-1 pt-1  focus:outline-none"
              />
            </div>
          </div>
          <div className="p-1 border-r border-b border-gray-400 flex flex-col justify-center">
            <span>Referral - III</span>
            <div className="flex items-center justify-center mt-1">
              <span className="font-normal mr-1">Dr.</span>
              <input
                type="text"
                value={doctorNames.referral3Dr}
                onChange={(e) => handleDoctorNameChange(e, "referral3Dr")}
                className="w-full text-center bg-white rounded-sm p-0.5 pb-1 pt-1 focus:outline-none"
              />
            </div>
          </div>
          <div className="p-1 border-b border-gray-400 flex flex-col justify-center">
            <span>Referral - IV</span>
            <div className="flex items-center justify-center mt-1">
              <span className="font-normal mr-1">Dr.</span>
              <input
                type="text"
                value={doctorNames.referral4Dr}
                onChange={(e) => handleDoctorNameChange(e, "referral4Dr")}
                className="w-full text-center bg-white rounded-sm p-0.5 pb-1 pt-1  focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div>
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-[50px_90px_repeat(5,1fr)] text-xs text-center border-t border-gray-400 min-h-[40px]"
            >
              <div className="p-2 border-r border-gray-400 bg-gray-50 flex items-center justify-center font-semibold">
                {row.day}
              </div>
              <div className="border-r border-gray-400 flex items-center">
                <input
                  type="text"
                  value={row.date}
                  onChange={(e) => handleDateChange(e, index)}
                  className="p-2 w-full h-full text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="DD/MM/YYYY"
                  autoComplete="off"
                />
              </div>
              <div className="border-r border-gray-400 flex items-center">{renderCell(row, index, "consultant")}</div>
              <div className="border-r border-gray-400 flex items-center">{renderCell(row, index, "referral1")}</div>
              <div className="border-r border-gray-400 flex items-center">{renderCell(row, index, "referral2")}</div>
              <div className="border-r border-gray-400 flex items-center">{renderCell(row, index, "referral3")}</div>
              <div className="flex items-center">{renderCell(row, index, "referral4")}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mt-6 no-pdf">
        <div className="flex gap-2">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-blue-500 hover:bg-blue-600 transition-colors duration-200 text-sm font-semibold"
          >
            <PlusCircle className="h-4 w-4" /> Add Row
          </button>
          <button
            onClick={removeRow}
            disabled={rows.length <= 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors duration-200 text-sm font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <MinusCircle className="h-4 w-4" /> Remove Row
          </button>
        </div>
        <div className="flex space-x-4">
          <PdfGenerator contentRef={formRef as React.RefObject<HTMLDivElement>} fileName="DoctorVisitSheet" />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 ${isSaving ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"}`}
          >
            {isSaving ? (
              <>
                {" "}
                <RefreshCw className="h-4 w-4 animate-spin" /> Saving...{" "}
              </>
            ) : (
              "Save Doctor Visit Sheet"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DoctorVisitPage
