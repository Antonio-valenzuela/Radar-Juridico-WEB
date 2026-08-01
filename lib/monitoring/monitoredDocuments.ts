export type MonitoredDocumentDefinition = {
  shortCode: string;
  title: string;
  matter: string;
  jurisdiction: string;
  documentType: string;
  officialUrl: string;
};

export const DEFAULT_MONITORED_DOCUMENTS: MonitoredDocumentDefinition[] = [
  {
    shortCode: "CPEUM",
    title: "Constitucion Politica de los Estados Unidos Mexicanos",
    matter: "constitucional/amparo",
    jurisdiction: "Federal",
    documentType: "constitucion",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf",
  },
  {
    shortCode: "LAmp",
    title: "Ley de Amparo",
    matter: "amparo",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LAmp.pdf",
  },
  {
    shortCode: "CPF",
    title: "Codigo Penal Federal",
    matter: "penal",
    jurisdiction: "Federal",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CPF.pdf",
  },
  {
    shortCode: "CCF",
    title: "Codigo Civil Federal",
    matter: "civil",
    jurisdiction: "Federal",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf",
  },
  {
    shortCode: "CCom",
    title: "Codigo de Comercio",
    matter: "mercantil",
    jurisdiction: "Federal",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CCom.pdf",
  },
  {
    shortCode: "LFT",
    title: "Ley Federal del Trabajo",
    matter: "laboral",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf",
  },
  {
    shortCode: "CFF",
    title: "Codigo Fiscal de la Federacion",
    matter: "fiscal",
    jurisdiction: "Federal",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CFF.pdf",
  },
  {
    shortCode: "LAD",
    title: "Ley Aduanera",
    matter: "aduanero/comercio exterior",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LAdua.pdf",
  },
  {
    shortCode: "LCE",
    title: "Ley de Comercio Exterior",
    matter: "comercio exterior/mercantil",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LCE.pdf",
  },
  {
    shortCode: "LSS",
    title: "Ley del Seguro Social",
    matter: "seguridad social/laboral",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LSS.pdf",
  },
  {
    shortCode: "CNPCF",
    title: "Codigo Nacional de Procedimientos Civiles y Familiares",
    matter: "civil/familiar/procesal",
    jurisdiction: "Nacional",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CNPCF.pdf",
  },
  {
    shortCode: "CNPP",
    title: "Codigo Nacional de Procedimientos Penales",
    matter: "penal/procesal",
    jurisdiction: "Nacional",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CNPP.pdf",
  },
  {
    shortCode: "CCJAL",
    title: "Codigo Civil del Estado de Jalisco",
    matter: "civil/familiar",
    jurisdiction: "Jalisco",
    documentType: "codigo",
    officialUrl: "https://congresoweb.congresojal.gob.mx/BibliotecaVirtual/legislacion/C%C3%B3digos/Documentos_PDF-C%C3%B3digos/C%C3%B3digo%20Civil%20del%20Estado%20de%20Jalisco-240626.pdf",
  },
  {
    shortCode: "CPJAL",
    title: "Codigo Penal para el Estado Libre y Soberano de Jalisco",
    matter: "penal",
    jurisdiction: "Jalisco",
    documentType: "codigo",
    officialUrl: "https://congresoweb.congresojal.gob.mx/BibliotecaVirtual/legislacion/C%C3%B3digos/Documentos_PDF-C%C3%B3digos/C%C3%B3digo%20Penal%20para%20el%20Estado%20Libre%20y%20Soberano%20de%20Jalisco%20-240626.pdf",
  },
];

export function canonicalKeyForMonitoredDocument(document: Pick<MonitoredDocumentDefinition, "shortCode">) {
  return `mx:federal:diputados:${document.shortCode.toLowerCase()}`;
}
