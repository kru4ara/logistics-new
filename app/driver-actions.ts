'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updateDriver(driverId: string, formData: FormData) {
  const firstName = formData.get('first_name') as string;
  const lastName = formData.get('last_name') as string;
  const phone = formData.get('phone') as string;
  const passportNumber = formData.get('passport_number') as string;
  const passportExpiry = formData.get('passport_expiry') as string;
  const visaExpiry = formData.get('visa_expiry') as string;
  const licenseNumber = formData.get('license_number') as string;
  const licenseExpiry = formData.get('license_expiry') as string;
  const tachographCardNumber = formData.get('tachograph_card_number') as string;
  const tachographCardExpiry = formData.get('tachograph_card_expiry') as string;
  const code95Expiry = formData.get('code_95_expiry') as string;
  const adrExpiry = formData.get('adr_expiry') as string;
  const dateOfBirth = formData.get('date_of_birth') as string;
  const address = formData.get('address') as string;

  const { error } = await supabase
    .from('drivers')
    .update({
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      passport_number: passportNumber || null,
      passport_expiry: passportExpiry || null,
      visa_expiry: visaExpiry || null,
      license_number: licenseNumber || null,
      license_expiry: licenseExpiry || null,
      tachograph_card_number: tachographCardNumber || null,
      tachograph_card_expiry: tachographCardExpiry || null,
      code_95_expiry: code95Expiry || null,
      adr_expiry: adrExpiry || null,
      date_of_birth: dateOfBirth || null,
      address: address || null
    })
    .eq('id', driverId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath(`/drivers/${driverId}`);
  redirect(`/drivers/${driverId}`);
}
