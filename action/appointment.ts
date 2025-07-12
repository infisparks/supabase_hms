import { supabase } from "@/lib/supabase"
import { generateNextUHID } from "@/components/uhid-generator" // Import the new UHID generator
import type { IFormInput, ModalitySelection, PatientDetail, Doctor, OnCallAppointment } from "@/app/opd/types" // Ensure ModalitySelection allows string for doctor


interface CreateAppointmentResult {
  success: boolean
  message: string
  uhid?: string
  billNo?: number // billNo is optional, only present for OPD registrations
}

export async function searchPatientByUhId(uhid: string) {
  try {
    const { data, error } = await supabase
      .from("patient_detail")
      .select("patient_id, name, number, age, age_unit, dob, gender, address, uhid")
      .eq("uhid", uhid)
      .single()
    if (error && error.code !== "PGRST116") {
      // PGRST116 means no rows found
      console.error("Error searching patient by UHID:", error)
      throw error
    }
    if (!data) {
      return { success: false, message: "Patient not found with this UHID." }
    }
    return { success: true, patient: data as PatientDetail } // Explicitly cast data to PatientDetail
  } catch (error: any) {
    console.error("Error in searchPatientByUhId:", error)
    return { success: false, message: "Failed to search patient by UHID: " + error.message }
  }
}

export async function searchPatientsByPhoneNumber(phoneNumber: string) {
  try {
    // Supabase needs exact match for numbers, convert input to number for query
    const phoneNumberAsNumber = Number(phoneNumber)
    if (isNaN(phoneNumberAsNumber)) {
      return { success: false, message: "Invalid phone number format." }
    }
    const { data, error } = await supabase
      .from("patient_detail")
      .select("patient_id, name, number, age, age_unit, dob, gender, address, uhid")
      .eq("number", phoneNumberAsNumber)
    if (error) {
      console.error("Error searching patients by phone number:", error)
      throw error
    }
    if (!data || data.length === 0) {
      return { success: false, message: "No patients found with this phone number." }
    }
    return { success: true, patients: data as PatientDetail[] } // Explicitly cast data to PatientDetail[]
  } catch (error: any) {
    console.error("Error in searchPatientsByPhoneNumber:", error)
    return { success: false, message: "Failed to search patients by phone number: " + error.message }
  }
}

export async function createAppointment(
  formData: IFormInput,
  selectedModalities: ModalitySelection[], // This now directly contains doctor name
  totalCharges: number,
  amountPaid: number,
  existingPatientId: number | null = null,
  existingUhId: string | null = null,
): Promise<CreateAppointmentResult> {
  try {
    let patientIdToUse: number | null = existingPatientId
    let uhidToUse: string | null = existingUhId
    const currentDateString = new Date().toISOString().split("T")[0] //YYYY-MM-DD

    // 1. Calculate DOB if age is provided
    let dob: string | null = null
    if (formData.age !== undefined && formData.age !== null) {
      const ageNum = Number.parseInt(String(formData.age))
      if (!isNaN(ageNum)) {
        const tempDate = new Date()
        if (formData.ageUnit === "year") {
          tempDate.setFullYear(tempDate.getFullYear() - ageNum)
        } else if (formData.ageUnit === "month") {
          tempDate.setMonth(tempDate.getMonth() - ageNum)
        } else if (formData.ageUnit === "day") {
          tempDate.setDate(tempDate.getDate() - ageNum)
        }
        dob = tempDate.toISOString().split("T")[0]
      }
    }

    // 2. Create or Update Patient Details
    let newPatientData: PatientDetail | null = null
    if (patientIdToUse && uhidToUse) {
      // Patient exists: Update their details
      const { data, error: updateError } = await supabase
        .from("patient_detail")
        .update({
          name: formData.name.trim(),
          number: Number(formData.phone) || null,
          age: formData.age !== undefined ? Number(formData.age) : null,
          age_unit: formData.ageUnit || null,
          dob: dob,
          gender: formData.gender || null,
          address: formData.address?.trim() || null,
          // `updated_at` relies on Supabase column default if set to `now()`
        })
        .eq("patient_id", patientIdToUse)
        .eq("uhid", uhidToUse) // Ensure updating by both patient_id and uhid if composite key
        .select()
        .single()
      if (updateError) {
        console.error("Patient update error:", updateError)
        throw updateError
      }
      newPatientData = data as PatientDetail
      uhidToUse = data.uhid
      patientIdToUse = data.patient_id; // Ensure patientIdToUse is updated from DB response
    } else {
      // New patient: Generate UHID and insert new record
      const uhidGenResult = await generateNextUHID()
      if (!uhidGenResult.success || !uhidGenResult.uhid) {
        throw new Error(uhidGenResult.message || "Failed to generate unique UHID.")
      }
      uhidToUse = uhidGenResult.uhid
      const { data, error: insertError } = await supabase
        .from("patient_detail")
        .insert({
          name: formData.name.trim(),
          number: Number(formData.phone) || null,
          age: formData.age !== undefined ? Number(formData.age) : null,
          age_unit: formData.ageUnit || null,
          dob: dob,
          gender: formData.gender || null,
          address: formData.address?.trim() || null,
          uhid: uhidToUse,
          // `created_at` and `updated_at` rely on Supabase column defaults if set to `now()`
        })
        .select()
        .single()
      if (insertError) {
        console.error("Patient insert error:", insertError)
        throw insertError
      }
      newPatientData = data as PatientDetail
      patientIdToUse = data.patient_id
    }

    if (!patientIdToUse || !uhidToUse) {
      throw new Error("Patient ID or UHID could not be determined after patient processing.")
    }

    // 3. Handle Appointment Creation (On-Call or OPD)
    if (formData.appointmentType === "oncall") {
      // On-Call Appointment
      const { data: onCallData, error: onCallError } = await supabase
        .from("opd_oncall")
        .insert({
          patient_id: patientIdToUse,
          uhid: uhidToUse,
          date: currentDateString, // `date` is `timestamp with time zone` defaulted to Asia/Kolkata
          time: formData.time,
          referredBy: formData.referredBy?.trim() || null,
          additional_notes: formData.additionalNotes?.trim() || null,
          entered_by: "system_user",
          // `created_at` relies on Supabase column default if set to `now()`
        })
        .select()
        .single()
      if (onCallError) {
        console.error("On-call insert error:", onCallError)
        throw onCallError
      }
      return { success: true, message: "On-call appointment registered successfully!", uhid: uhidToUse }
    } else {
      // OPD Registration
      if (selectedModalities.length === 0) {
        return { success: false, message: "Please select at least one service." }
      }

      const serviceInfo = selectedModalities.map((modality) => ({
        type: modality.type,
        doctor: modality.doctor, // This is now already the doctor's name (string)
        specialist: modality.specialist || null,
        visitType: modality.visitType || null,
        service: modality.service || null,
        charges: modality.charges,
      }))

      const paymentInfo = {
        paymentMethod: formData.paymentMethod,
        totalCharges: totalCharges,
        discount: Number(formData.discount) || 0,
        totalPaid: amountPaid,
        cashAmount: Number(formData.cashAmount) || 0,
        onlineAmount: Number(formData.onlineAmount) || 0,
        cashThrough: formData.cashThrough || null,
        onlineThrough: formData.onlineThrough || null,
        // `createdAt` relies on Supabase column default if set to `now()`
      }

      const { data: opdRegistrationData, error: opdRegistrationError } = await supabase
        .from("opd_registration")
        .insert({
          patient_id: patientIdToUse,
          uhid: uhidToUse,
          date: currentDateString, // `date` is `timestamp with time zone` defaulted to Asia/Kolkata
          refer_by: formData.referredBy?.trim() || null,
          "additional Notes": formData.additionalNotes?.trim() || null,
          service_info: serviceInfo,
          payment_info: paymentInfo,
          // `created_at` relies on Supabase column default if it's set to `now()`
        })
        .select("opd_id, bill_no")
        .single()

      if (opdRegistrationError) {
        console.error("OPD registration insert error:", opdRegistrationError)
        throw opdRegistrationError
      }

      // Update OPD summary
      const { data: currentSummary, error: summaryFetchError } = await supabase
        .from("opd_summary")
        .select("*")
        .eq("date", currentDateString)
        .single()

      if (summaryFetchError && summaryFetchError.code !== "PGRST116") {
        console.error("Error fetching OPD summary:", summaryFetchError)
      }

      if (currentSummary) {
        // Update existing summary
        const { error: updateSummaryError } = await supabase
          .from("opd_summary")
          .update({
            total_count: (currentSummary.total_count || 0) + 1,
            total_revenue: (currentSummary.total_revenue || 0) + amountPaid,
            cash: (currentSummary.cash || 0) + (Number(formData.cashAmount) || 0),
            online: (currentSummary.online || 0) + (Number(formData.onlineAmount) || 0),
            discount: (currentSummary.discount || 0) + (Number(formData.discount) || 0),
            // `updated_at` relies on Supabase column default if it's set to `now()`
          })
          .eq("date", currentDateString)
        if (updateSummaryError) {
          console.error("Error updating OPD summary:", updateSummaryError)
        }
      } else {
        // Insert new summary for the day
        const { error: insertSummaryError } = await supabase.from("opd_summary").insert({
          date: currentDateString,
          total_count: 1,
          total_revenue: amountPaid,
          cash: Number(formData.cashAmount) || 0,
          online: Number(formData.onlineAmount) || 0,
          discount: Number(formData.discount) || 0,
          // `created_at` and `updated_at` rely on Supabase column defaults if set to `now()`
        })
        if (insertSummaryError) {
          console.error("Error inserting new OPD summary:", insertSummaryError)
        }
      }

      return {
        success: true,
        message: "Appointment booked successfully!",
        uhid: uhidToUse,
        billNo: opdRegistrationData.bill_no,
      }
    }
  } catch (error: any) {
    console.error("Failed to create appointment:", error)
    return { success: false, message: `Failed to book appointment: ${error.message}` }
  }
}

// Function to update an existing appointment
export async function updateAppointment(
  opdId: string,
  formData: IFormInput,
  selectedModalities: ModalitySelection[],
  totalCharges: number,
  amountPaid: number,
  patientId: number,
  uhid: string,
): Promise<CreateAppointmentResult> {
  try {
    console.log("updateAppointment called with:")
    console.log("   opdId:", opdId)
    console.log("   patientId:", patientId)
    console.log("   uhid:", uhid)

    if (!patientId || !uhid) {
      console.error("Validation failed: Patient ID or UHID is missing for update.")
      return { success: false, message: "Patient ID or UHID is missing for update." }
    }

    // 1. Calculate DOB if age is provided
    let dob: string | null = null
    if (formData.age !== undefined && formData.age !== null) {
      const ageNum = Number.parseInt(String(formData.age))
      if (!isNaN(ageNum)) {
        const tempDate = new Date()
        if (formData.ageUnit === "year") {
          tempDate.setFullYear(tempDate.getFullYear() - ageNum)
        } else if (formData.ageUnit === "month") {
          tempDate.setMonth(tempDate.getMonth() - ageNum)
        } else if (formData.ageUnit === "day") {
          tempDate.setDate(tempDate.getDate() - ageNum)
        }
        dob = tempDate.toISOString().split("T")[0]
      }
    }

    // 2. Update Patient Details
    const { error: patientUpdateError } = await supabase
      .from("patient_detail")
      .update({
        name: formData.name.trim(),
        number: Number(formData.phone) || null,
        age: formData.age !== undefined ? Number(formData.age) : null,
        age_unit: formData.ageUnit || null,
        dob: dob,
        gender: formData.gender || null,
        address: formData.address?.trim() || null,
      })
      .eq("patient_id", patientId)
      .eq("uhid", uhid)
    if (patientUpdateError) {
      console.error("Error updating patient details:", patientUpdateError)
      throw patientUpdateError
    }

    // 3. Update OPD Registration
    const serviceInfo = selectedModalities.map((modality) => ({
      type: modality.type,
      doctor: modality.doctor, // This is now already the doctor's name (string)
      specialist: modality.specialist || null,
      visitType: modality.visitType || null,
      service: modality.service || null,
      charges: modality.charges,
    }))

    const paymentInfo = {
      paymentMethod: formData.paymentMethod,
      totalCharges: totalCharges,
      discount: Number(formData.discount) || 0,
      totalPaid: amountPaid,
      cashAmount: Number(formData.cashAmount) || 0,
      onlineAmount: Number(formData.onlineAmount) || 0,
      cashThrough: formData.cashThrough || null,
      onlineThrough: formData.onlineThrough || null,
    }

    const { error: opdUpdateError } = await supabase
      .from("opd_registration")
      .update({
        refer_by: formData.referredBy?.trim() || null,
        "additional Notes": formData.additionalNotes?.trim() || null,
        service_info: serviceInfo,
        payment_info: paymentInfo,
      })
      .eq("opd_id", opdId)
    if (opdUpdateError) {
      console.error("Error updating OPD registration:", opdUpdateError)
      throw opdUpdateError
    }

    // Note: OPD summary is NOT updated here.
    return { success: true, message: "Appointment updated successfully!" }
  } catch (error: any) {
    console.error("Failed to update appointment:", error)
    return { success: false, message: `Failed to update appointment: ${error.message}` }
  }
}

// Function to fetch doctors from Supabase
export async function fetchDoctorsSupabase(): Promise<Doctor[]> {
  const { data, error } = await supabase.from("doctor").select("*")
  if (error) {
    console.error("Error fetching doctors:", error)
    return []
  }
  return data as Doctor[]
}

// Function to fetch on-call appointments from Supabase
export async function fetchOnCallAppointmentsSupabase(): Promise<OnCallAppointment[]> {
  const { data, error } = await supabase
    .from("opd_oncall")
    .select(
      `
      oncall_id,
      patient_id,
      uhid,
      date,
      time,
      referredBy,
      additional_notes,
      entered_by,
      created_at,
      patient_detail (uhid, name, number, age, gender, age_unit, dob, address) // Include uhid, name, number, age, gender, age_unit, dob, address
      `,
    )
    .order("created_at", { ascending: false })
  if (error) {
    console.error("Error fetching on-call appointments:", error)
    return []
  }
  return data.map((item: any) => ({
    oncall_id: item.oncall_id,
    patient_id: item.patient_id, // patient_id is bigint, matches DB
    uhid: item.uhid,
    date: item.date,
    time: item.time,
    referredBy: item.referredBy,
    additional_notes: item.additional_notes,
    entered_by: item.entered_by,
    created_at: item.created_at,
    patient_detail: item.patient_detail // Supabase should return object if joined, null if no match
      ? {
          uhid: item.patient_detail.uhid, // Ensure all fields from PatientDetailFromSupabase are mapped
          name: item.patient_detail.name,
          number: item.patient_detail.number,
          age: item.patient_detail.age,
          gender: item.patient_detail.gender,
          age_unit: item.patient_detail.age_unit,
          dob: item.patient_detail.dob,
          address: item.patient_detail.address,
        } as PatientDetail // Explicitly cast to PatientDetail
      : { uhid: null, name: null, number: null, age: null, gender: null, age_unit: null, dob: null, address: null }, // Provide default nulls for fields if patient_detail is null
  })) as OnCallAppointment[] // Explicitly cast the whole array
}

// Function to delete an on-call appointment
export async function deleteOnCallAppointment(onCallId: string): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.from("opd_oncall").delete().eq("oncall_id", onCallId)
    if (error) {
      console.error("Error deleting on-call appointment:", error)
      throw error
    }
    return { success: true, message: "On-call appointment deleted successfully!" }
  } catch (error: any) {
    console.error("Failed to delete on-call appointment:", error)
    return { success: false, message: `Failed to delete on-call appointment: ${error.message}` }
  }
}