export async function updateTrip(tripId: string, formData: FormData) {
  const clientId = formData.get('client_id') as string;
  const truckId = formData.get('truck_id') as string;
  const trailerId = formData.get('trailer_id') as string;
  const driverId = formData.get('driver_id') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;
  const startFuelLevel = parseFloat(formData.get('start_fuel_level') as string) || 0;

  const clientRequestNumber = formData.get('client_request_number') as string;
  const clientRequestDate = formData.get('client_request_date') as string;
  const senderCountry = formData.get('sender_country') as string;
  const senderName = formData.get('sender_name') as string;
  const senderPostalCode = formData.get('sender_postal_code') as string;
  const senderCity = formData.get('sender_city') as string;
  const senderAddress = formData.get('sender_address') as string;
  const senderLoadingNumber = formData.get('sender_loading_number') as string;
  const receiverCountry = formData.get('receiver_country') as string;
  const receiverName = formData.get('receiver_name') as string;
  const receiverPostalCode = formData.get('receiver_postal_code') as string;
  const receiverCity = formData.get('receiver_city') as string;
  const receiverAddress = formData.get('receiver_address') as string;
  const receiverLoadingNumber = formData.get('receiver_loading_number') as string;

  const route = `${senderCity || ''}, ${senderCountry || ''} → ${receiverCity || ''}, ${receiverCountry || ''}`;

  const { error } = await supabase
    .from('trips')
    .update({
      client_id: clientId || null,
      truck_id: truckId || null,
      trailer_id: trailerId || null,
      driver_id: driverId || null,
      start_date: startDate,
      revenue_eur: revenueEur,
      start_fuel_level: startFuelLevel,
      client_request_number: clientRequestNumber || null,
      client_request_date: clientRequestDate || null,
      sender_country: senderCountry || null,
      sender_name: senderName || null,
      sender_postal_code: senderPostalCode || null,
      sender_city: senderCity || null,
      sender_address: senderAddress || null,
      sender_loading_number: senderLoadingNumber || null,
      receiver_country: receiverCountry || null,
      receiver_name: receiverName || null,
      receiver_postal_code: receiverPostalCode || null,
      receiver_city: receiverCity || null,
      receiver_address: receiverAddress || null,
      receiver_loading_number: receiverLoadingNumber || null,
      route: route || null
    })
    .eq('id', tripId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}
