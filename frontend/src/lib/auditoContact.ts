// How customers reach the Audito team. The backend sends the configured values
// (AUDITO_CONTACT_EMAIL, AUDITO_WHATSAPP_NUMBER); these are used until they load.
export interface AuditoContact {
  email: string;
  whatsapp: string;
  whatsapp_url: string | null;
}

export const DEFAULT_AUDITO_CONTACT: AuditoContact = {
  email: "hi@audito.cloud",
  whatsapp: "+94 77 361 2339",
  whatsapp_url: "https://wa.me/94773612339",
};
