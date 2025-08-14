"use client"

import type React from "react"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase" // Using Supabase client
import {
  format,
  parseISO, // For parsing ISO date strings from DB
} from "date-fns"

import {
  Activity,
  Layers,
  CreditCard,
  DollarSign,
} from "lucide-react"

// Shadcn/ui components
import { Card } from "@/components/ui/card"
import { toast } from "sonner" // For notifications

// --- Type Definitions (Minimal for this page) ---

// Modality/Service info (from OPD service_info JSONB)
interface IModality {
  charges: number
  type: "consultation" | "casualty" | "xray" | "pathology" | "ipd" | "radiology" | "custom"
}

// Payment info (from OPD payment_info JSONB)
interface IPayment {
  cashAmount: number
  onlineAmount: number
  totalPaid: number
}

// OPD Registration (from Supabase `opd_registration` table)
interface OPDRegistrationSupabase {
  opd_id: string
  date: string // date (YYYY-MM-DD string)
  service_info: IModality[] | null // JSONB
  payment_info: IPayment | null // JSONB
}

// IPD Payment (from IPD `payment_detail` JSONB)
interface IPDPaymentDetailItem {
  id?: string;
  amount: number
  createdAt: string
  paymentType: string
  type: "advance" | "refund" | "deposit" | "settlement" | string
  transactionType?: string;
  amountType?: "advance" | "refund" | "deposit" | "settlement" | "discount";
  through?: string;
  remark?: string;
}

// IPD Registration (from Supabase `ipd_registration` table - for clarity)
interface IPDRegistrationSupabase {
  ipd_id: number
  admission_date: string
  payment_detail: IPDPaymentDetailItem[] | null
}

// --- Helper Functions ---

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)

// Helper to get start and end of a day for Supabase query based on current IST date
const getTodayDateRangeIST = () => {
  // Get current date string in Asia/Kolkata timezone (YYYY-MM-DD)
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const istDateString = istFormatter.format(now); // This gives 'YYYY-MM-DD' in IST

  // Construct ISO strings with IST offset for precise timestamp comparisons
  // These are important for 'timestamp without time zone' columns
  const start = `${istDateString}T00:00:00+05:30`;
  const end = `${istDateString}T23:59:59+05:30`; // Using a fixed end, or could be start of next day (more robust)

  return { dateString: istDateString, startIST: start, endIST: end };
};

// --- DailyCollectionPage Component ---

const DailyCollectionPage: React.FC = () => {
  const [opdCash, setOpdCash] = useState<number>(0)
  const [opdOnline, setOpdOnline] = useState<number>(0)
  const [ipdCash, setIpdCash] = useState<number>(0)
  const [ipdOnline, setIpdOnline] = useState<number>(0)
  const [ipdOnlineUpi, setIpdOnlineUpi] = useState<number>(0);
  const [ipdOnlineCard, setIpdOnlineCard] = useState<number>(0);
  const [ipdOnlineNetBanking, setIpdOnlineNetBanking] = useState<number>(0);
  const [ipdOnlineCheque, setIpdOnlineCheque] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [currentDisplayDate, setCurrentDisplayDate] = useState<string>("")

  useEffect(() => {
    const fetchDailyCollections = async () => {
      setIsLoading(true)
      const { dateString: todayDateString, startIST, endIST } = getTodayDateRangeIST();
      setCurrentDisplayDate(format(parseISO(todayDateString), "dd MMMM yyyy"));

      let currentOpdCash = 0;
      let currentOpdOnline = 0;
      let currentIpdCash = 0;
      let currentIpdOnline = 0;
      let currentIpdOnlineUpi = 0;
      let currentIpdOnlineCard = 0;
      let currentIpdOnlineNetBanking = 0;
      let currentIpdOnlineCheque = 0;

      try {
        // --- FIX: Fetch OPD data for today using a precise date range ---
        // This ensures appointments from 00:00:00 to 23:59:59 are included for today
        const { data: opdData, error: opdError } = await supabase
          .from("opd_registration")
          .select("payment_info, date")
          .gte("date", startIST) // Greater than or equal to the start of today (in IST)
          .lt("date", endIST);   // Less than the end of today (in IST)

        if (opdError) {
          console.error("Supabase OPD fetch error:", opdError);
          toast.error("Failed to load OPD data.");
        } else {
          (opdData as OPDRegistrationSupabase[]).forEach((appt) => {
            if (appt.payment_info) {
              currentOpdCash += appt.payment_info.cashAmount || 0;
              currentOpdOnline += appt.payment_info.onlineAmount || 0;
            }
          });
        }

        // --- Fetch IPD data using the PostgreSQL RPC function ---
        const { data: ipdCollectionData, error: ipdError } = await supabase
          .rpc('get_daily_ipd_collections_from_jsonb', { // Call the new jsonb function
            target_date: todayDateString // Pass the 'YYYY-MM-DD' date string to the function
          });

        if (ipdError) {
          console.error("Supabase RPC IPD fetch error:", ipdError);
          toast.error("Failed to load IPD data.");
        } else {
          if (ipdCollectionData && ipdCollectionData.length > 0) {
            // Destructure all the returned data from the RPC
            const { 
              cash_total, 
              online_total, 
              online_upi_total, 
              online_card_total,
              online_netbanking_total,
              online_cheque_total
            } = ipdCollectionData[0];
            
            currentIpdCash = cash_total || 0;
            currentIpdOnline = online_total || 0;
            currentIpdOnlineUpi = online_upi_total || 0;
            currentIpdOnlineCard = online_card_total || 0;
            currentIpdOnlineNetBanking = online_netbanking_total || 0;
            currentIpdOnlineCheque = online_cheque_total || 0;

          } else {
            // No data returned, means no collections for today
            currentIpdCash = 0;
            currentIpdOnline = 0;
            currentIpdOnlineUpi = 0;
            currentIpdOnlineCard = 0;
            currentIpdOnlineNetBanking = 0;
            currentIpdOnlineCheque = 0;
          }
        }

        setOpdCash(currentOpdCash);
        setOpdOnline(currentOpdOnline);
        setIpdCash(currentIpdCash);
        setIpdOnline(currentIpdOnline);
        setIpdOnlineUpi(currentIpdOnlineUpi);
        setIpdOnlineCard(currentIpdOnlineCard);
        setIpdOnlineNetBanking(currentIpdOnlineNetBanking);
        setIpdOnlineCheque(currentIpdOnlineCheque);

      } catch (err) {
        console.error("Error fetching daily collections:", err);
        toast.error("An unexpected error occurred while fetching data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyCollections();
  }, []); // Empty dependency array means this runs once on mount

  const totalOpdAmount = useMemo(() => opdCash + opdOnline, [opdCash, opdOnline]);
  
  // Calculate totalIpdAmount by summing up all individual IPD cash and online types
  const totalIpdAmount = useMemo(
    () => ipdCash + ipdOnlineUpi + ipdOnlineCard + ipdOnlineNetBanking + ipdOnlineCheque,
    [ipdCash, ipdOnlineUpi, ipdOnlineCard, ipdOnlineNetBanking, ipdOnlineCheque]
  );
  
  // Calculate totalOnline (overall for both OPD and IPD) by summing all online types
  const totalOnline = useMemo(
    () => opdOnline + ipdOnlineUpi + ipdOnlineCard + ipdOnlineNetBanking + ipdOnlineCheque,
    [opdOnline, ipdOnlineUpi, ipdOnlineCard, ipdOnlineNetBanking, ipdOnlineCheque]
  );
  
  const grandTotal = useMemo(() => totalOpdAmount + totalIpdAmount, [totalOpdAmount, totalIpdAmount]);
  const totalCash = useMemo(() => opdCash + ipdCash, [opdCash, ipdCash]);
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-lg mb-6 rounded-xl">
          <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg mr-3 shadow-md">
                <DollarSign className="text-white h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Daily Collections Overview
              </h1>
            </div>
            <div className="text-lg font-medium text-gray-700 flex items-center">
              <CreditCard className="mr-2 h-5 w-5 text-gray-600" />
              Date: <span className="ml-2 text-green-700">{currentDisplayDate}</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            <span className="ml-3 text-lg text-gray-600">Fetching today's collection data...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OPD Collections Card */}
            <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-r from-sky-100 to-blue-100 rounded-full shadow-md">
                  <Activity className="text-sky-600 h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">OPD Collections</h2>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-sky-50 p-3 rounded-lg border border-sky-200">
                  <span className="text-gray-700 font-medium">💵 Cash Collection</span>
                  <span className="text-xl font-bold text-sky-700">
                    {formatCurrency(opdCash)}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-sky-50 p-3 rounded-lg border border-sky-200">
                  <span className="text-gray-700 font-medium">💳 Online Collection</span>
                  <span className="text-xl font-bold text-sky-700">
                    {formatCurrency(opdOnline)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-sky-300">
                  <span className="text-lg font-semibold text-sky-800">Total OPD Collected</span>
                  <span className="text-2xl font-bold text-sky-600">
                    {formatCurrency(totalOpdAmount)}
                  </span>
                </div>
              </div>
            </Card>

            {/* IPD Collections Card */}
            <Card className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-r from-orange-100 to-red-100 rounded-full shadow-md">
                  <Layers className="text-orange-600 h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">IPD Collections</h2>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <span className="text-gray-700 font-medium">💵 Cash Collection</span>
                  <span className="text-xl font-bold text-orange-700">
                    {formatCurrency(ipdCash)}
                  </span>
                </div>
                {/* Total Online Collection for IPD is now derived from the sum of its parts */}
                <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <span className="text-gray-700 font-medium">💳 Total Online Collection</span>
                  <span className="text-xl font-bold text-orange-700">
                    {formatCurrency(ipdOnline)}
                  </span>
                </div>
                {/* Display detailed online through types if they exist */}
                {ipdOnlineUpi > 0 && (
                  <div className="flex justify-between items-center bg-orange-50 p-2 pl-6 rounded-lg border border-orange-200 text-sm">
                    <span className="text-gray-600">UPI Payments</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(ipdOnlineUpi)}
                    </span>
                  </div>
                )}
                {ipdOnlineCard > 0 && (
                  <div className="flex justify-between items-center bg-orange-50 p-2 pl-6 rounded-lg border border-orange-200 text-sm">
                    <span className="text-gray-600">Card Payments</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(ipdOnlineCard)}
                    </span>
                  </div>
                )}
                {ipdOnlineNetBanking > 0 && (
                  <div className="flex justify-between items-center bg-orange-50 p-2 pl-6 rounded-lg border border-orange-200 text-sm">
                    <span className="text-gray-600">Net Banking Payments</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(ipdOnlineNetBanking)}
                    </span>
                  </div>
                )}
                {ipdOnlineCheque > 0 && (
                  <div className="flex justify-between items-center bg-orange-50 p-2 pl-6 rounded-lg border border-orange-200 text-sm">
                    <span className="text-gray-600">Cheque Payments (Online)</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(ipdOnlineCheque)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-orange-300">
                  <span className="text-lg font-semibold text-orange-800">Total IPD Collected</span>
                  <span className="text-2xl font-bold text-orange-600">
                    {formatCurrency(totalIpdAmount)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Overall Daily Totals Card (Optional, but useful for a summary) */}
            <Card className="lg:col-span-2 bg-gradient-to-r from-emerald-50 to-green-50 shadow-lg rounded-xl p-6 border border-emerald-200">
              <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center">
                <DollarSign className="mr-2 h-6 w-6 text-emerald-700" /> Today's Grand Totals
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-emerald-100">
                  <p className="text-gray-600 text-sm">Total Cash Collections</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(totalCash)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-emerald-100">
                  <p className="text-gray-600 text-sm">Total Online Collections</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(totalOnline)}
                  </p>
                </div>
                <div className="bg-emerald-100 p-4 rounded-lg shadow-md border border-emerald-300">
                  <p className="text-emerald-800 text-lg font-semibold">Overall Total Collection</p>
                  <p className="text-3xl font-extrabold text-emerald-900">
                    {formatCurrency(grandTotal)}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default DailyCollectionPage;