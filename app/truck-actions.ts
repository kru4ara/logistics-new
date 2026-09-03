'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updateTruck(truckId: string, formData: FormData) {
  const registrationNumber = formData.get('registration_number') as string;
  const type = formData.get('type') as string;
  const trailerNumber = formData.get('trailer_number') as string;
  const truckInsuranceExpiry = formData.get('truck_insurance_expiry') as string;
  const borderInsuranceExpiry = formData.get('border_insurance_expiry') as string;
  const techInspectionExpiry = formData.get('tech_inspection_expiry') as string;
  const fuelCardNumber = formData.get('fuel_card_number') as string;
  const tachographLegalizationExpiry = formData.get('tachograph_legalization_expiry') as string;

  const { error } = await supabase
    .from('trucks')
    .update({
      registration_number: registrationNumber,
      type: type,
      trailer_number: trailerNumber || null,
      truck_insurance_expiry: truckInsuranceExpiry || null,
      border_insurance_expiry: borderInsuranceExpiry || null,
      tech_inspection_expiry: techInspectionExpiry || null,
      fuel_card_number: fuelCardNumber || null,
      tachograph_legalization_expiry: tachographLegalizationExpiry || null
    })
    .eq('id', truckId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath(`/trucks/${truckId}`);
  redirect(`/trucks/${truckId}`);
}
