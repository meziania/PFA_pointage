export type UserRole = "admin" | "employe";
export type UserStatut = "actif" | "desactive";
export type DemandeAccesStatut = "en_attente" | "approuvee" | "refusee";

export type DemandeResetMdpStatut = "en_attente" | "traitee" | "refusee";

export type DemandeResetMdpDoc = {
  userId: string;
  nom: string;
  email: string;
  message?: string;
  statut: DemandeResetMdpStatut;
  date_demande?: unknown;
  date_traitement?: unknown;
  traite_par?: string;
};

export type UserDoc = {
  nom: string;
  email: string;
  role: UserRole;
  statut: UserStatut;
  doit_changer_mdp?: boolean;
  matricule?: string;
  telephone?: string;
  departement?: string;
  poste?: string;
  cin?: string;
  adresse?: string;
  dateNaissance?: string;
  dateEmbauche?: string;
  photoURL?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type DemandeAccesDoc = {
  nom: string;
  email: string;
  telephone?: string;
  message?: string;
  statut: DemandeAccesStatut;
  date_demande?: unknown;
  date_traitement?: unknown;
  traite_par?: string;
  userId?: string;
};

export type ParametresEntrepriseDoc = {
  latitude: number;
  longitude: number;
  rayon_metres: number;
  updatedAt?: unknown;
  updatedBy?: string;
};

export type PointageType = "entree" | "sortie";

export type PointageDoc = {
  userId: string;
  date: string;
  heure: string;
  type: PointageType;
  latitude?: number | null;
  longitude?: number | null;
  valide?: boolean;
  createdAt?: unknown;
};

/** Résumé journalier persisté à chaque pointage (consultation RH multi-jours). */
export type JournalPresenceDoc = {
  userId: string;
  date: string;
  entree?: string;
  sortie?: string;
  heures?: number;
  statut: "present" | "retard" | "sorti" | "absent" | "en_conge";
  pointagesCount: number;
  updatedAt?: unknown;
};

export type CongeType = "annuel" | "maladie" | "exceptionnel";
export type CongeStatut = "en_attente" | "valide" | "refuse";

export type CongeDoc = {
  userId: string;
  dateDebut: string;
  dateFin: string;
  type: CongeType;
  statut: CongeStatut;
  createdAt?: unknown;
};

export type NotificationDoc = {
  userId: string;
  title: string;
  body: string;
  type?: "profile_required" | "qr" | "general";
  actionHref?: string;
  qrLink?: string;
  read: boolean;
  createdAt?: unknown;
};

/** @deprecated Utiliser DemandeAccesDoc / collection demandes_acces */
export type DemandeAdhesionStatut = DemandeAccesStatut;
/** @deprecated Utiliser DemandeAccesDoc */
export type DemandeAdhesionDoc = DemandeAccesDoc;
