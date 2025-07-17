// app/ipd/billing/[ipdId]/InvoiceDownload.tsx
"use client"

import React, { useRef } from "react"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"
import { Download, FileText } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

import letterhead from "@/public/letterhead.png"

/** ========== Data model interfaces ========== **/

interface ServiceItem {
  serviceName: string
  doctorName?: string
  type: "service" | "doctorvisit"
  amount: number
  createdAt?: string
}

interface Payment {
  id?: string
  amount: number
  paymentType: string
  date: string
  type: "advance" | "refund" | "deposit" | "discount" // Added type for consistency
}

export interface BillingRecord {
  patientId: string
  ipdId: string
  uhid: string
  name: string
  mobileNumber: string
  address?: string | null
  age?: number | null
  ageUnit?: string | null
  gender?: string | null

  relativeName?: string | null
  relativePhone?: number | null
  relativeAddress?: string | null

  dischargeDate?: string | null

  totalDeposit: number
  roomType?: string | null
  bedNumber?: number | string | null
  bedType?: string | null

  admitDate?: string | null
  admissionTime?: string | null
  createdAt?: string

  services: ServiceItem[]
  payments: Payment[]
  discount?: number

  doctor?: string | null
}

interface IDoctor {
  id: number // Changed to number to match Supabase and page.tsx mapping
  name: string
  specialist: string
  department: "OPD" | "IPD" | "Both" | string // Added string for flexibility
  opdCharge?: number
  ipdCharges?: Record<string, number>
}

type InvoiceDownloadProps = {
  record: BillingRecord
  beds: any // This prop is now less critical as bed details are in record, but keeping for compatibility
  doctors: IDoctor[]
  children?: React.ReactNode
}

export default function InvoiceDownload({ record, beds, doctors, children }: InvoiceDownloadProps) {
  const invoiceRef = useRef<HTMLDivElement>(null)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
    try {
      return new Date(dateString).toLocaleDateString(undefined, options)
    } catch {
      return "Invalid Date";
    }
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Invalid Time";
    }
  }

  const calculateDaysBetween = (startDate: string | null, endDate: string | null | Date) => {
    if (!startDate) return 0;
    const start = new Date(startDate)
    const end = endDate instanceof Date ? endDate : (endDate ? new Date(endDate) : new Date())

    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)

    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  function convertNumberToWords(num: number): string {
    const a = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ]

    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    if ((num = Math.floor(num)) === 0) return "Zero"

    if (num < 20) return a[num]

    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? " " + a[num % 10] : "")

    if (num < 1000)
      return a[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + convertNumberToWords(num % 100) : "")

    if (num < 1000000)
      return (
        convertNumberToWords(Math.floor(num / 1000)) +
        " Thousand" +
        (num % 1000 ? " " + convertNumberToWords(num % 1000) : "")
      )

    if (num < 1000000000)
      return (
        convertNumberToWords(Math.floor(num / 1000000)) +
        " Million" +
        (num % 1000000 ? " " + convertNumberToWords(num % 1000000) : "")
      )

    return (
      convertNumberToWords(Math.floor(num / 1000000000)) +
      " Billion" +
      (num % 1000000000 ? " " + convertNumberToWords(num % 1000000000) : "")
    )
  }

  const billDate = new Date().toISOString()

  const generatePDF = async (): Promise<jsPDF> => {
    if (!invoiceRef.current) throw new Error("Invoice element not found.")

    await new Promise((resolve) => setTimeout(resolve, 100))

    const canvas = await html2canvas(invoiceRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: null,
    })

    const pdf = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "a4",
    })

    const pdfWidth = 595
    const pdfHeight = 842
    const topMargin = 120
    const bottomMargin = 80
    const sideMargin = 20
    const contentHeight = pdfHeight - topMargin - bottomMargin
    const scaleRatio = pdfWidth / canvas.width
    const fullContentHeightPts = canvas.height * scaleRatio

    let currentPos = 0
    let pageCount = 0

    while (currentPos < fullContentHeightPts) {
      pageCount += 1
      if (pageCount > 1) pdf.addPage()

      // Add letterhead to each page
      pdf.addImage(letterhead.src, "PNG", 0, 0, pdfWidth, pdfHeight, "", "FAST")

      const sourceY = Math.floor(currentPos / scaleRatio)
      const sourceHeight = Math.floor(contentHeight / scaleRatio)

      const pageCanvas = document.createElement("canvas")
      pageCanvas.width = canvas.width
      pageCanvas.height = sourceHeight
      const pageCtx = pageCanvas.getContext("2d")

      if (pageCtx) {
        pageCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight)
      }

      const chunkImgData = pageCanvas.toDataURL("image/png")

      const chunkHeightPts = sourceHeight * scaleRatio

      pdf.addImage(chunkImgData, "PNG", sideMargin, topMargin, pdfWidth - 2 * sideMargin, chunkHeightPts, "", "FAST")

      currentPos += contentHeight
    }

    return pdf
  }

  const handleSendPdfOnWhatsapp = async () => {
    try {
      const pdf = await generatePDF()
      const pdfBlob = pdf.output("blob")

      if (!pdfBlob) {
        toast.error("Failed to generate PDF blob.")
        return
      }

      const fileName = `invoice-${record.ipdId}-${Date.now()}.pdf`
      const { data, error: uploadError } = await supabase.storage
        .from('invoices') // Your Supabase Storage bucket name
        .upload(fileName, pdfBlob, {
          cacheControl: '3600',
          upsert: false // Set to true if you want to overwrite existing files
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        toast.error(`Failed to upload invoice: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(fileName);

      if (!publicUrlData || !publicUrlData.publicUrl) {
        toast.error("Failed to get public URL for the invoice.");
        return;
      }

      const downloadUrl = publicUrlData.publicUrl;

      const formattedNumber = record.mobileNumber.startsWith("91") ? record.mobileNumber : `91${record.mobileNumber}`

      // WhatsApp API payload
      const payload = {
        token: "99583991573", // Replace with your actual WhatsApp API token
        number: formattedNumber,
        imageUrl: downloadUrl, // Use imageUrl for sending a document link (check your API's requirement for PDFs)
        caption:
          "Dear Patient, please find attached your invoice PDF for your recent visit. Thank you for choosing our services.",
      }

      const response = await fetch("https://wa.medblisss.com/send-image-url", { // Assuming this endpoint accepts imageUrl for PDFs
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text();
        console.error("WhatsApp API error:", response.status, errorText);
        throw new Error(`Failed to send the invoice on WhatsApp: ${errorText}`);
      }

      toast.success("Invoice PDF sent successfully on WhatsApp!")
    } catch (error: any) {
      console.error("Error sending invoice PDF on WhatsApp:", error)
      toast.error(`An error occurred while sending the invoice PDF on WhatsApp: ${error.message}`)
    }
  }

  const handlePreviewInvoice = async () => {
    try {
      const pdf = await generatePDF()
      const blob = pdf.output("blob")
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
    } catch (error: any) {
      console.error("Error previewing invoice:", error)
      toast.error(`Failed to preview the invoice PDF: ${error.message}`)
    }
  }

  // Group Hospital Services
  const groupedHospitalServices = Object.values(
    record.services
      .filter((s) => s.type === "service")
      .reduce(
        (acc, service) => {
          const key = service.serviceName
          if (!acc[key]) {
            acc[key] = {
              serviceName: service.serviceName,
              quantity: 1,
              unitAmount: service.amount,
              totalAmount: service.amount,
            }
          } else {
            acc[key].quantity += 1
            acc[key].totalAmount = acc[key].unitAmount * acc[key].quantity
          }
          return acc
        },
        {} as {
          [key: string]: {
            serviceName: string
            quantity: number
            unitAmount: number
            totalAmount: number
          }
        },
      ),
  )

  // Group Consultant Charges by Doctor Name
  const groupedConsultantServices = Object.values(
    record.services
      .filter((s) => s.type === "doctorvisit")
      .reduce(
        (acc, service) => {
          const key = service.doctorName || "NoName"
          if (!acc[key]) {
            acc[key] = {
              doctorName: service.doctorName || "",
              quantity: 1,
              unitAmount: service.amount,
              totalAmount: service.amount,
            }
          } else {
            acc[key].quantity += 1
            acc[key].totalAmount = acc[key].unitAmount * acc[key].quantity
          }
          return acc
        },
        {} as {
          [key: string]: {
            doctorName: string
            quantity: number
            unitAmount: number
            totalAmount: number
          }
        },
      ),
  )

  // Determine the primary doctor for "Under care of Dr."
  // FIX: Directly use record.doctor as it contains the doctor's name (string)
  const primaryDoctorName = record.doctor || "N/A"

  // Get room and bed details
  const roomName = record.roomType || "N/A"
  const bedNumber = record.bedNumber || "N/A"
  const bedType = record.bedType || "N/A" // Directly from record.bedType

  // Totals Calculation
  const hospitalServiceTotal = record.services.filter((s) => s.type === "service").reduce((sum, s) => sum + s.amount, 0)
  const consultantChargeTotal = record.services
    .filter((s) => s.type === "doctorvisit")
    .reduce((sum, s) => sum + s.amount, 0)
  const discount = record.discount || 0
  const subtotal = hospitalServiceTotal + consultantChargeTotal
  const netTotal = subtotal - discount
  const deposit = record.totalDeposit // Using totalDeposit from BillingRecord
  const dueAmount = netTotal - deposit

  // Calculate day count
  const startDate = record.admitDate || record.createdAt || null
  const endDate = record.dischargeDate || null
  const dayCount = calculateDaysBetween(startDate, endDate)

  const showConsultantTable = groupedConsultantServices.length > 0

  /** ========== Render ========== **/

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleSendPdfOnWhatsapp}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition duration-300 flex items-center mb-4 text-xs"
      >
        Send Invoice PDF on WhatsApp
      </button>

      <button
        onClick={handlePreviewInvoice}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-300 flex items-center mb-4 text-xs"
      >
        <FileText size={16} className="mr-1" />
        Preview Bill
      </button>

      <div
        ref={invoiceRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "520px",
          backgroundColor: "transparent",
        }}
      >
        <div className="text-[10px] text-gray-800 p-2 bg-transparent max-w-[520px]">
          {/* Header */}

          <div className="flex justify-between mb-2">
            <div className="flex flex-col">
              <p>
                <strong>Patient Name:</strong> {record.name} ({record.uhid})
              </p>

              <p>
                <strong>Mobile No.:</strong> {record.mobileNumber}
              </p>

              <p>
                <strong>Address:</strong> {record.address || "Not provided"}
              </p>

              <p>
                <strong>Age:</strong> {record.age || "N/A"} {record.ageUnit || "years"}
              </p>
              <p>
                <strong>Under care of Dr.:</strong> {primaryDoctorName}
              </p>

              <p>
                <strong>Room:</strong> {roomName} / <strong>Bed:</strong> {bedNumber} ({bedType})
              </p>
            </div>

            <div className="text-right flex flex-col">
              <p>
                <strong>Admit Date:</strong>{" "}
                {record.admitDate ? (
                  <>
                    {formatDate(record.admitDate)} / {record.admissionTime || formatTime(record.admitDate)}
                  </>
                ) : record.createdAt ? (
                  <>
                    {formatDate(record.createdAt)} / {formatTime(record.createdAt)}
                  </>
                ) : (
                  "N/A"
                )}
              </p>

              {record.dischargeDate && (
                <p>
                  <strong>Discharge Date:</strong> {formatDate(record.dischargeDate)} /{" "}
                  {formatTime(record.dischargeDate)}
                </p>
              )}

              <p>
                <strong>Bill Date:</strong> {formatDate(billDate)} / {formatTime(billDate)}
              </p>

              <p>
                <strong>Stay Duration:</strong> {dayCount} {dayCount === 1 ? "day" : "days"}
              </p>
            </div>
          </div>

          {/* Consultant Charges Table (Conditional) */}

          {showConsultantTable && (
            <div className="my-2">
              <h3 className="font-semibold mb-1 text-[10px]">Consultant Charges</h3>

              <table className="w-full text-[7px] max-w-[520px]">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="py-0.5 px-1 text-left min-w-[70px]">Doctor Name</th>

                    <th className="py-0.5 px-1 text-center w-[25px]">Visited</th>

                    <th className="py-0.5 px-1 text-right w-[40px]">Unit (Rs)</th>

                    <th className="py-0.5 px-1 text-right w-[50px]">Total (Rs)</th>
                  </tr>
                </thead>

                <tbody>
                  {groupedConsultantServices.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-0.5 px-1">{item.doctorName}</td>

                      <td className="py-0.5 px-1 text-center">{item.quantity}</td>

                      <td className="py-0.5 px-1 text-right">{item.unitAmount.toLocaleString()}</td>

                      <td className="py-0.5 px-1 text-right">{item.totalAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-1 text-right font-semibold text-[9px]">
                Consultant Charges Total: Rs. {consultantChargeTotal.toLocaleString()}
              </div>
            </div>
          )}

          {/* Hospital Service Charges Table */}

          <div className="my-2">
            <h3 className="font-semibold mb-1 text-[10px]">Hospital Service Charges</h3>

            <table className="w-full text-[7px] max-w-[520px]">
              <thead>
                <tr className="bg-blue-100">
                  <th className="py-1 px-1 text-left min-w-[100px]">Service</th>

                  <th className="py-1 px-1 text-center w-[25px]">Qnty</th>

                  <th className="py-1 px-1 text-right w-[40px]">Unit (Rs)</th>

                  <th className="py-1 px-1 text-right w-[50px]">Total (Rs)</th>
                </tr>
              </thead>

              <tbody>
                {groupedHospitalServices.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-0 px-1">{item.serviceName}</td>

                    <td className="py-0 px-1 text-center">{item.quantity}</td>

                    <td className="py-0 px-1 text-right">{item.unitAmount.toLocaleString()}</td>

                    <td className="py-0 px-1 text-right">{item.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-1 text-right font-semibold text-[9px]">
              Hospital Services Total: Rs. {hospitalServiceTotal.toLocaleString()}
            </div>
          </div>

          {/* Final Summary Section */}

          <div className="mt-2 p-1 rounded text-[8px] w-[200px] ml-auto">
            <p className="flex justify-between w-full">
              <span>Total Amount:</span>

              <span>Rs. {subtotal.toLocaleString()}</span>
            </p>

            {discount > 0 && (
              <p className="flex justify-between w-full text-green-600 font-bold">
                <span>Discount:</span>

                <span>- Rs. {discount.toLocaleString()}</span>
              </p>
            )}

            <hr className="my-1" />

            <p className="flex justify-between w-full font-bold">
              <span>Net Total:</span>

              <span>Rs. {netTotal.toLocaleString()}</span>
            </p>

            <p className="flex justify-between w-full">
              <span>Deposit Amount:</span>

              <span>Rs. {deposit.toLocaleString()}</span>
            </p>

            <p
              className={`flex justify-between w-full font-semibold text-[8px] ${
                dueAmount < 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              <span>{dueAmount < 0 ? "Refund Amount:" : "Due Amount:"}</span>

              <span>
                {dueAmount < 0 ? "Rs. " + Math.abs(dueAmount).toLocaleString() : "Rs. " + dueAmount.toLocaleString()}
              </span>
            </p>

            {dueAmount > 0 && (
              <p className="mt-1 text-[8px] ">
                <strong>Due Amount in Words:</strong> {convertNumberToWords(dueAmount)} Rupees Only
              </p>
            )}

            {dueAmount < 0 && (
              <p className="mt-1 text-[8px] text-black">
                <strong>Refund Amount in Words:</strong> {convertNumberToWords(Math.abs(dueAmount))} Rupees Only
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}