export type UserRole = "admin" | "employe";

export type UserDoc = {
  nom: string;
  email: string;
  role: UserRole;
  // Profil employé (optionnel)
  matricule?: string;
  telephone?: string;
  departement?: string;
  poste?: string;
  cin?: string;
  adresse?: string;
  dateNaissance?: string; // YYYY-MM-DD
  dateEmbauche?: string; // YYYY-MM-DD
  photoURL?: string;
  createdAt?: unknown;
};

export type PointageType = "entree" | "sortie";

export type PointageDoc = {
  userId: string;
  date: string; // YYYY-MM-DD
  heure: string; // HH:MM
  type: PointageType;
  latitude?: number | null;
  longitude?: number | null;
  valide?: boolean;
  createdAt?: unknown;
};

export type CongeType = "annuel" | "maladie" | "exceptionnel";
export type CongeStatut = "en_attente" | "valide" | "refuse";

export type CongeDoc = {
  userId: string;
  dateDebut: string; // YYYY-MM-DD
  dateFin: string; // YYYY-MM-DD
  type: CongeType;
  statut: CongeStatut;
  createdAt?: unknown;
};

export type NotificationDoc = {
  userId: string;
  title: string;
  body: string;
  qrLink?: string;
  read: boolean;
  createdAt?: unknown;
};

