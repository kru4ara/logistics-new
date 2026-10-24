export type Location = {
  id: string;
  name: string;
  type: string;
  country: string | null;
  company_name: string | null;
  postal_code: string | null;
  city: string | null;
  address: string | null;
  default_loading_number: string | null;
};

export type Option = { id: string; label: string };

export type CargoOption = {
  id: string;
  position: number;
  label: string;
  from_country: string | null;
  from_city: string | null;
  from_company: string | null;
  from_address: string | null;
  from_postal_code: string | null;
  to_country: string | null;
  to_city: string | null;
  to_company: string | null;
  to_address: string | null;
  to_postal_code: string | null;
};

export type Addr = {
  country: string;
  city: string;
  company: string;
  address: string;
  postal_code: string;
};

export type Stop = {
  type: 'load' | 'reload' | 'unload' | 'customs';
  country: string;
  city: string;
  company: string;
  address: string;
  postal_code: string;
  date: string;
};

export type SegmentData = {
  id?: string;
  executor_type: string;
  contractor_id: string | null;
  truck_id: string | null;
  trailer_id?: string | null;
  driver_id: string | null;
  date_from: string | null;
  date_to: string | null;
  notes: string | null;
  from_country: string | null;
  from_city: string | null;
  from_company: string | null;
  from_address: string | null;
  from_postal_code: string | null;
  to_country: string | null;
  to_city: string | null;
  to_company: string | null;
  to_address: string | null;
  to_postal_code: string | null;
  stops?: Stop[] | null;
  price?: number | null;
  currency?: string | null;
  contractor_truck_number?: string | null;
  contractor_driver_name?: string | null;
  contractor_payment_days?: number | null;
  contractor_payment_document_type?: string | null;
  contractor_transport_type?: string | null;
  contractor_transport_temperature?: string | null;
  contractor_transport_height?: string | null;
};
