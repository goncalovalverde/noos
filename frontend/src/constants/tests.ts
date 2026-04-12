/** Master list of all available neuropsychological test types.
 *  Keep in sync with TestFormDispatcher and backend calculator. */
export const ALL_TEST_TYPES: string[] = [
  // Trail Making
  'TMT-A', 'TMT-B',
  // Memory
  'TAVEC', 'Rey-Copia', 'Rey-Memoria',
  // Attention / Processing speed
  'Stroop', 'Test-d2-R', 'BTA',
  // Verbal fluency
  'Fluidez-FAS', 'FAS-Verbal', 'Fluidez-Semantica',
  // WAIS subtests
  'Dígitos-Directos', 'Dígitos-Inversos', 'Letras-Números',
  'Aritmética', 'Semejanzas', 'Vocabulario',
  'Matrices', 'Cubos', 'Clave-Números', 'Búsqueda-Símbolos',
  // Executive function
  'Torre-Londres',
  // Screening
  'MoCA',
  // Mood / Anxiety
  'BDI-II', 'STAI',
]
