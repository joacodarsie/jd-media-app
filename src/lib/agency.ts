/**
 * Datos legales, de identificación y bancarios de la agencia.
 * Si cambian, modificar acá una sola vez.
 */
export const AGENCY = {
  brand: "JD Media",
  legal_name: "Franco Joaquín Darsie",
  cuit: "20-44607986-8",
  domicilio: "Azor Grimaut 2963, Córdoba, Argentina",
  representante: "Joaquín Darsie",
  rol_representante: "Dirección",
  /** Para pedir reseñas en el Perfil de Negocio de Google (12/10/2026). */
  resena_google: "https://g.page/r/CbfZnUkNWAtNECE/review",
  jurisdiccion: "tribunales de Córdoba, Argentina",
  bank: {
    nombre: "Mercado Pago",
    alias: "jdmedia",
    cvu: "0000003100060125198464",
    titular: "Franco Joaquin Darsie",
    cuil: "20-44607986-8",
  },
  colors: {
    primary: "#FFD400",
    primaryDark: "#1a1a1a",
  },
} as const;
