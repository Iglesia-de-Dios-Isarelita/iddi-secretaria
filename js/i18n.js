// Spanish is the primary language; English is the option.
import { SHARED } from "./i18n-shared.js";

const own = {
  es: {
    appName: "Sistema de Gestión Secretarial y Ministerial",
    appShort: "Secretaría",
    noAccessApp: "Su cuenta no tiene acceso a Secretaría. Pida acceso a su Secretario de Zona o a la administración.",
    signInNotApproved: "Esta cuenta no ha sido invitada a las apps de la iglesia. Pida a su administración que le dé acceso.",
    // navigation
    navHome: "Inicio", navServices: "Predicaciones", navLibrary: "Biblioteca", navLetters: "Cartas", navAgreements: "Acuerdos de sociedad",
    navCirculars: "Circulares", navTrends: "Tendencias", navSearch: "IDDI AI", navAccess: "Accesos", navSettings: "Configuración",
    scopeTitle: "¿Qué quiere ver?", scopeCountry: "País", scopeZone: "Zona", scopeChurch: "Iglesia", scopeSub: "Sociedad o departamento",
    scopeAll: "Todos los países", scopeAllZones: "Todas las zonas", scopeAllChurches: "Todas las iglesias", scopeHq: "Sede internacional",
    scopeNationalBooks: "Administración nacional", scopeZoneBooks: "Administración de zona", scopeChurchOnly: "Solo la iglesia",
    scopeChurchAll: "Iglesia con sociedades y departamentos", scopeApply: "Ver", scopeOnlyOne: "Usted trabaja con una sola organización.",
    scopeSingle: "Una sola organización.", scopeCombined: "Vista de {n} organizaciones.",
    menuOpen: "Abrir menú", menuClose: "Cerrar menú", editName: "Mi nombre", noAccess: "No tiene permiso para esto.",
    noOrganization: "No hay organizaciones para mostrar.", errorGeneric: "Algo salió mal. Intente de nuevo.",
    save: "Guardar", cancel: "Cancelar", saved: "Guardado", close: "Cerrar", edit: "Editar", add: "Agregar", remove: "Quitar", open: "Abrir",
    back: "Volver", all: "Todos", none: "Ninguno", yes: "Sí", no: "No", more: "Más opciones", actions: "Acciones", loadMore: "Ver más",
    date: "Fecha", church: "Iglesia de Dios (Israelita)", churchCol: "Iglesia", title: "Título", notes: "Notas", status: "Estado", type: "Tipo",
    description: "Descripción", file: "Archivo", fileHint: "PDF, PowerPoint, Word o imagen, hasta 50 MB.", fileTooBig: "El archivo pasa de 50 MB.",
    openFile: "Abrir archivo", reason: "Motivo", reasonPrompt: "Escriba el motivo", reasonRequired: "Escriba el motivo.",
    period: "Período", pMonth: "Este mes", pQuarter: "Este trimestre", pYear: "Este año", pLastYear: "Año pasado", pAll: "Todo",
    textFilter: "Buscar por título", empty: "No hay nada para mostrar todavía.", language: "Idioma",
    // home
    homeGreet: "Bienvenido a Secretaría", tileServices: "Predicaciones", tileAttendance: "Asistencia promedio", tilePendingLetters: "Cartas por aprobar",
    tilePendingCirculars: "Circulares sin acuse", recentServices: "Predicaciones recientes", quickNew: "Registrar predicación", thisMonth: "este mes",
    toApprove: "Por aprobar", seeAll: "Ver todo",
    // services
    servicesTitle: "Predicaciones", newService: "Nueva predicación", editService: "Editar predicación", serviceType: "Tipo de servicio",
    preacher: "Predicador", attendance: "Asistencia", men: "Hombres", women: "Mujeres", youth: "Jóvenes", children: "Niños", visitors: "Visitas",
    total: "Total", topics: "Temas", citations: "Citas bíblicas", citation: "Cita", citationRef: "Referencia (ej. Juan 3:16-18)",
    citationComment: "Comentario (opcional)", addCitation: "Agregar cita", firstCitationRequired: "La primera cita bíblica es obligatoria.",
    presentation: "Presentación", replaceFile: "Cambiar archivo", keepFile: "Se mantiene el archivo actual.", voidService: "Anular",
    voided: "Anulada", posted: "Registrada", voidedBy: "Anulada: {reason}", recordOnlyOwnChurch: "Para registrar, elija su iglesia en «¿Qué quiere ver?».",
    titleRequired: "Escriba el título.", preacherRequired: "Escriba el nombre del predicador.", typeRequired: "Elija el tipo de servicio.",
    anyType: "Todos los tipos", anyTopic: "Todos los temas", confirmVoidService: "¿Anular esta predicación? Queda en el historial.",
    // library
    libraryTitle: "Biblioteca", tabDocuments: "Documentos doctrinales", tabConciliar: "Acuerdos conciliares",
    newDocument: "Publicar documento", editDocument: "Editar documento", docKind: "Clase", kind_temario: "Temario", kind_manual: "Manual",
    kind_guia: "Guía", kind_estudio: "Estudio", kind_otro: "Otro", docLanguage: "Idioma del documento", lang_es: "Español", lang_en: "Inglés",
    publisher: "Publica", contentText: "Texto para la búsqueda", contentTextHint: "Pegue aquí el texto del documento para que IDDI AI lo encuentre.",
    archive: "Archivar", unarchive: "Volver a publicar", archived: "Archivado", activeDoc: "Publicado", anyKind: "Todas las clases",
    // agreements
    newAgreement: "Nuevo acuerdo", editAgreement: "Editar acuerdo", agrNumber: "Número", session: "Sesión", sessionDate: "Fecha de la sesión",
    agrTopic: "Tema", agrBody: "Texto del acuerdo", agrStatus: "Estado", st_vigente: "Vigente", st_derogado: "Derogado", st_anulado: "Anulado",
    derogate: "Derogar", annul: "Anular", reinstate: "Volver a vigente", issuedBy: "Emitido por", societyAgreementsTitle: "Acuerdos de sociedad y departamento",
    societyAgreementsHelp: "Acuerdos de las sociedades y departamentos de su iglesia. Los ven el secretario que los registra, el Secretario Local, el Encargado Local y el Administrador Maestro.",
    numberAuto: "El número se asigna solo al guardar.",
    // letters
    lettersTitle: "Cartas oficiales", newLetter: "Nueva carta", editLetter: "Editar carta", letterKind: "Clase", lk_anuncio: "Anuncio",
    lk_nombramiento: "Nombramiento", lk_correspondencia: "Correspondencia", lk_otro: "Otro", audience: "¿Quién la ve?",
    aud_local: "Solo esta iglesia", aud_all_churches: "Todas las iglesias", audAllHint: "Las cartas para todas las iglesias las aprueba primero el Encargado Local.",
    ls_published: "Publicada", ls_pending_approval: "Por aprobar", ls_rejected: "Rechazada", ls_voided: "Anulada", letterBody: "Texto",
    approve: "Aprobar", reject: "Rechazar", rejectReason: "Motivo del rechazo", approvedToast: "Carta aprobada", rejectedToast: "Carta rechazada",
    reviewNote: "Nota de revisión", voidLetter: "Anular carta", tabAll: "Todas", tabPending: "Por aprobar",
    // circulars
    circularsTitle: "Circulares", newCircular: "Enviar circular", fromOrg: "Envía", recipients: "Destinatarios", allInArea: "Todas las iglesias del área",
    selectChurches: "Elegir iglesias", acknowledged: "Recibida", notAcknowledged: "Sin acuse", acknowledge: "Acusar recibo", ackToast: "Acuse registrado",
    ackCount: "{a} de {n} con acuse", circularBody: "Texto", sentAt: "Enviada", chooseChurches: "Elija al menos una iglesia.",
    // trends
    trendsTitle: "Tendencias", trendsOrg: "Ver tendencias de", servicesCount: "Servicios", avgAttendance: "Promedio por servicio",
    totalAttendance: "Asistencia total", byMonth: "Por mes", byType: "Por tipo de servicio", topTopics: "Temas predicados", noData: "Sin datos en este período.",
    // search
    searchTitle: "IDDI AI", searchHelp: "Busca solamente en los registros de la iglesia: predicaciones, citas, documentos doctrinales, acuerdos, cartas y circulares. Cada resultado lleva a su fuente.",
    searchPlaceholder: "Ej. sembrador, Daniel 9, bautismo", searchBtn: "Buscar", noResults: "No hay registros sobre esto en la app.",
    k_service: "Predicación", k_document: "Documento", k_agreement: "Acuerdo", k_letter: "Carta", k_circular: "Circular",
    // access
    accessTitle: "Accesos a Secretaría", invite: "Dar acceso", inviteTitle: "Dar acceso a Secretaría", email: "Correo", role: "Responsabilidad",
    organization: "Organización", chooseOrg: "Elija la organización", lastAccess: "Último acceso", neverSignedIn: "Aún no entra", active: "Activo",
    inactive: "Sin acceso", disable: "Quitar acceso", enable: "Devolver acceso", invited: "Acceso dado", roleChange: "Cambiar responsabilidad",
    inviteHelp: "La persona entra con su cuenta de Google de la iglesia. Solo puede dar responsabilidades por debajo de la suya y dentro de su área.",
    emailInvalid: "Escriba un correo válido.", noInvitableRoles: "Su responsabilidad no permite dar accesos.",
    // settings
    settingsTitle: "Configuración", serviceTypes: "Tipos de servicio", topicsList: "Temas", nameEs: "Nombre en español", nameEn: "Nombre en inglés",
    order: "Orden", visible: "En uso", addItem: "Agregar",
    // errors
    errCitation: "La primera cita bíblica es obligatoria.", errOutsideScope: "Esa organización está fuera de su área.", errReason: "Escriba el motivo.",
    errNotPending: "Esta carta ya no espera aprobación.", errChooseSociety: "Elija una sociedad o un departamento.", errChooseChurch: "Elija una iglesia.",
    errVoidedLocked: "Los registros anulados no se pueden cambiar.", errOnlyInForce: "Solo se pueden cambiar acuerdos vigentes.",
    errDomain: "El dominio de ese correo no está aprobado.", errCannotInvite: "Su responsabilidad no puede dar ese acceso.", errOwnAccess: "No puede cambiar su propio acceso.",
    errNoChurches: "No hay iglesias para enviar.",
    homeHelp: "Use el menú para entrar a las secciones que tiene a su cargo.", sentForApproval: "Carta enviada al Encargado Local para su aprobación",
    showArchived: "Ver archivados", showVoided: "Ver anuladas", errBothNames: "Escriba el nombre en español y en inglés.", errValidDate: "Escriba una fecha válida.", errChooseAdmin: "Elija la administración.",
  },
  en: {
    appName: "Secretarial and Ministerial Management System",
    appShort: "Secretary",
    noAccessApp: "Your account has no access to Secretaría. Ask your Zone Secretary or the administration for access.",
    signInNotApproved: "This account has not been invited to the church apps. Ask your administration for access.",
    navHome: "Home", navServices: "Sermons", navLibrary: "Library", navLetters: "Letters", navAgreements: "Society agreements",
    navCirculars: "Circulars", navTrends: "Trends", navSearch: "IDDI AI", navAccess: "Access", navSettings: "Settings",
    scopeTitle: "What do you want to see?", scopeCountry: "Country", scopeZone: "Zone", scopeChurch: "Church", scopeSub: "Society or department",
    scopeAll: "All countries", scopeAllZones: "All zones", scopeAllChurches: "All churches", scopeHq: "International headquarters",
    scopeNationalBooks: "National administration", scopeZoneBooks: "Zone administration", scopeChurchOnly: "Church only",
    scopeChurchAll: "Church with societies and departments", scopeApply: "View", scopeOnlyOne: "You work with one organization.",
    scopeSingle: "One organization.", scopeCombined: "View of {n} organizations.",
    menuOpen: "Open menu", menuClose: "Close menu", editName: "My name", noAccess: "You don't have permission for this.",
    noOrganization: "No organizations to show.", errorGeneric: "Something went wrong. Please try again.",
    save: "Save", cancel: "Cancel", saved: "Saved", close: "Close", edit: "Edit", add: "Add", remove: "Remove", open: "Open",
    back: "Back", all: "All", none: "None", yes: "Yes", no: "No", more: "More options", actions: "Actions", loadMore: "Show more",
    date: "Date", church: "Iglesia de Dios (Israelita)", churchCol: "Church", title: "Title", notes: "Notes", status: "Status", type: "Type",
    description: "Description", file: "File", fileHint: "PDF, PowerPoint, Word or image, up to 50 MB.", fileTooBig: "The file is larger than 50 MB.",
    openFile: "Open file", reason: "Reason", reasonPrompt: "Enter the reason", reasonRequired: "Enter the reason.",
    period: "Period", pMonth: "This month", pQuarter: "This quarter", pYear: "This year", pLastYear: "Last year", pAll: "All",
    textFilter: "Search by title", empty: "Nothing to show yet.", language: "Language",
    homeGreet: "Welcome to Secretaría", tileServices: "Sermons", tileAttendance: "Average attendance", tilePendingLetters: "Letters to approve",
    tilePendingCirculars: "Circulars not acknowledged", recentServices: "Recent sermons", quickNew: "Record a sermon", thisMonth: "this month",
    toApprove: "To approve", seeAll: "See all",
    servicesTitle: "Sermons", newService: "New sermon", editService: "Edit sermon", serviceType: "Service type",
    preacher: "Preacher", attendance: "Attendance", men: "Men", women: "Women", youth: "Youth", children: "Children", visitors: "Visitors",
    total: "Total", topics: "Topics", citations: "Bible citations", citation: "Citation", citationRef: "Reference (e.g. John 3:16-18)",
    citationComment: "Comment (optional)", addCitation: "Add citation", firstCitationRequired: "The first bible citation is required.",
    presentation: "Presentation", replaceFile: "Replace file", keepFile: "The current file is kept.", voidService: "Void",
    voided: "Voided", posted: "Recorded", voidedBy: "Voided: {reason}", recordOnlyOwnChurch: "To record, choose your church in “What do you want to see?”.",
    titleRequired: "Enter the title.", preacherRequired: "Enter the preacher's name.", typeRequired: "Choose the service type.",
    anyType: "All types", anyTopic: "All topics", confirmVoidService: "Void this sermon? It stays in the history.",
    libraryTitle: "Library", tabDocuments: "Doctrinal documents", tabConciliar: "Conciliar agreements",
    newDocument: "Publish document", editDocument: "Edit document", docKind: "Kind", kind_temario: "Syllabus", kind_manual: "Manual",
    kind_guia: "Guide", kind_estudio: "Study", kind_otro: "Other", docLanguage: "Document language", lang_es: "Spanish", lang_en: "English",
    publisher: "Published by", contentText: "Text for search", contentTextHint: "Paste the document's text here so IDDI AI can find it.",
    archive: "Archive", unarchive: "Publish again", archived: "Archived", activeDoc: "Published", anyKind: "All kinds",
    newAgreement: "New agreement", editAgreement: "Edit agreement", agrNumber: "Number", session: "Session", sessionDate: "Session date",
    agrTopic: "Topic", agrBody: "Agreement text", agrStatus: "Status", st_vigente: "In force", st_derogado: "Revoked", st_anulado: "Cancelled",
    derogate: "Revoke", annul: "Cancel", reinstate: "Back in force", issuedBy: "Issued by", societyAgreementsTitle: "Society and department agreements",
    societyAgreementsHelp: "Agreements of your church's societies and departments. Seen by the secretary who records them, the Local Secretary, the Local Leader and the Master Administrator.",
    numberAuto: "The number is assigned when you save.",
    lettersTitle: "Official letters", newLetter: "New letter", editLetter: "Edit letter", letterKind: "Kind", lk_anuncio: "Announcement",
    lk_nombramiento: "Appointment", lk_correspondencia: "Correspondence", lk_otro: "Other", audience: "Who sees it?",
    aud_local: "This church only", aud_all_churches: "All churches", audAllHint: "Letters for all churches are approved first by the Local Leader.",
    ls_published: "Published", ls_pending_approval: "To approve", ls_rejected: "Rejected", ls_voided: "Voided", letterBody: "Text",
    approve: "Approve", reject: "Reject", rejectReason: "Reason for rejecting", approvedToast: "Letter approved", rejectedToast: "Letter rejected",
    reviewNote: "Review note", voidLetter: "Void letter", tabAll: "All", tabPending: "To approve",
    circularsTitle: "Circulars", newCircular: "Send circular", fromOrg: "Sent by", recipients: "Recipients", allInArea: "All churches in the area",
    selectChurches: "Choose churches", acknowledged: "Received", notAcknowledged: "Not acknowledged", acknowledge: "Acknowledge", ackToast: "Acknowledged",
    ackCount: "{a} of {n} acknowledged", circularBody: "Text", sentAt: "Sent", chooseChurches: "Choose at least one church.",
    trendsTitle: "Trends", trendsOrg: "Show trends for", servicesCount: "Services", avgAttendance: "Average per service",
    totalAttendance: "Total attendance", byMonth: "By month", byType: "By service type", topTopics: "Topics preached", noData: "No data in this period.",
    searchTitle: "IDDI AI", searchHelp: "Searches only the church's own records: sermons, citations, doctrinal documents, agreements, letters and circulars. Every result links to its source.",
    searchPlaceholder: "e.g. sower, Daniel 9, baptism", searchBtn: "Search", noResults: "There are no records about this in the app.",
    k_service: "Sermon", k_document: "Document", k_agreement: "Agreement", k_letter: "Letter", k_circular: "Circular",
    accessTitle: "Secretaría access", invite: "Give access", inviteTitle: "Give access to Secretaría", email: "Email", role: "Responsibility",
    organization: "Organization", chooseOrg: "Choose the organization", lastAccess: "Last access", neverSignedIn: "Not signed in yet", active: "Active",
    inactive: "No access", disable: "Remove access", enable: "Give access back", invited: "Access given", roleChange: "Change responsibility",
    inviteHelp: "The person signs in with their church Google account. You can only give responsibilities below yours and inside your area.",
    emailInvalid: "Enter a valid email.", noInvitableRoles: "Your responsibility does not allow giving access.",
    settingsTitle: "Settings", serviceTypes: "Service types", topicsList: "Topics", nameEs: "Name in Spanish", nameEn: "Name in English",
    order: "Order", visible: "In use", addItem: "Add",
    errCitation: "The first bible citation is required.", errOutsideScope: "That organization is outside your area.", errReason: "Enter the reason.",
    errNotPending: "This letter is no longer waiting for approval.", errChooseSociety: "Choose a society or a department.", errChooseChurch: "Choose a church.",
    errVoidedLocked: "Voided records cannot be changed.", errOnlyInForce: "Only agreements in force can be changed.",
    errDomain: "That email's domain is not approved.", errCannotInvite: "Your responsibility cannot give that access.", errOwnAccess: "You cannot change your own access.",
    errNoChurches: "No churches to send to.",
    homeHelp: "Use the menu to open the sections you are responsible for.", sentForApproval: "Letter sent to the Local Leader for approval",
    showArchived: "Show archived", showVoided: "Show voided", errBothNames: "Enter the name in Spanish and English.", errValidDate: "Enter a valid date.", errChooseAdmin: "Choose the administration.",
  },
};

const dict = { es: { ...SHARED.es, ...own.es }, en: { ...SHARED.en, ...own.en } };

let current = "es";
try {
  const saved = localStorage.getItem("iddi.lang");
  if (saved === "es" || saved === "en") current = saved;
} catch (e) { /* storage may be unavailable */ }

export const getLang = () => current;
export function setLang(l) {
  if (!dict[l]) return;
  current = l;
  try { localStorage.setItem("iddi.lang", l); } catch (e) { /* ignore */ }
  document.documentElement.lang = l;
}
export const languages = Object.keys(dict);
export const hasKey = (key) => key in dict.es;

export function t(key, vars) {
  let s = (dict[current] && dict[current][key]) ?? dict.es[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replaceAll("{" + k + "}", vars[k]);
  return s;
}
