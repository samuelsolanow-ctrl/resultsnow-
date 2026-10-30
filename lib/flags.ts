// Códigos de país no padrão da vela (COI / World Sailing) → ISO-2 para emoji
const IOC_TO_ISO2: Record<string, string> = {
  BRA: "BR", ARG: "AR", URU: "UY", CHI: "CL", PAR: "PY", PER: "PE", BOL: "BO", COL: "CO", ECU: "EC",
  VEN: "VE", MEX: "MX", USA: "US", CAN: "CA", PUR: "PR", CUB: "CU", ISV: "VI", IVB: "VG", BER: "BM",
  ANT: "AG", BAR: "BB", BAH: "BS", CAY: "KY", GUA: "GT", ESA: "SV", CRC: "CR", PAN: "PA", DOM: "DO",
  POR: "PT", ESP: "ES", FRA: "FR", ITA: "IT", GBR: "GB", IRL: "IE", GER: "DE", NED: "NL", BEL: "BE",
  SUI: "CH", AUT: "AT", DEN: "DK", SWE: "SE", NOR: "NO", FIN: "FI", EST: "EE", LAT: "LV", LTU: "LT",
  POL: "PL", CZE: "CZ", HUN: "HU", SLO: "SI", CRO: "HR", GRE: "GR", TUR: "TR", CYP: "CY", MLT: "MT",
  MON: "MC", UKR: "UA", ISR: "IL", RSA: "ZA", EGY: "EG", AUS: "AU", NZL: "NZ", JPN: "JP", CHN: "CN",
  KOR: "KR", HKG: "HK", SGP: "SG", THA: "TH", MAS: "MY", IND: "IN", UAE: "AE", OMA: "OM", QAT: "QA",
};

export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE",
  "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function countryEmoji(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.trim().toUpperCase();
  const iso = c.length === 2 ? c : IOC_TO_ISO2[c];
  if (!iso) return "";
  return String.fromCodePoint(...[...iso].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
