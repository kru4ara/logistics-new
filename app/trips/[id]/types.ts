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
