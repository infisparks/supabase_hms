// @/lib/uhid-generator.ts


import { supabase } from "@/lib/supabase"
import { format } from "date-fns"

interface GenerateUHIDResult {
  success: boolean
  uhid?: string
  message?: string
}

/**
 * Generates the next unique Hospital ID (UHID) for the current date.
 * The format is MG-MMDDYY-XXXX (e.g., MG-070625-0001).
 * It uses a PostgreSQL RPC function for atomic counter increment to ensure uniqueness.
 *
 * This function also creates or updates the `uhid_counter` table to manage the sequence.
 *
 * @returns {Promise<GenerateUHIDResult>} An object indicating success and the generated UHID or an error message.
 */
export async function generateNextUHID(): Promise<GenerateUHIDResult> {
  try {
    const today = new Date()
    const datePart = format(today, "ddMMyy") // ddmmtt format (e.g., 060725)
    const uhidPrefix = `MG-${datePart}`
    const todayDateString = format(today, "yyyy-MM-dd") // YYYY-MM-DD for database key

    // Call the PostgreSQL RPC function to get the next counter value for today
    // This function must be created in your Supabase database.
    const { data: newCount, error: rpcError } = await supabase.rpc("increment_uhid_counter", {
      p_date: todayDateString,
    });

    if (rpcError) {
      console.error("Error incrementing UHID counter via RPC:", rpcError);
      throw new Error(`Database error: ${rpcError.message}`);
    }

    if (typeof newCount !== 'number') {
        throw new Error("Invalid response from UHID counter function. Expected a number.");
    }

    const uhidSuffix = String(newCount).padStart(4, "0"); // e.g., 0001, 0002
    const generatedUHID = `${uhidPrefix}-${uhidSuffix}`;

    console.log(`Generated UHID: ${generatedUHID}`);
    return { success: true, uhid: generatedUHID };

  } catch (error: any) {
    console.error("Failed to generate UHID:", error);
    return { success: false, message: `UHID generation failed: ${error.message}` };
  }
}