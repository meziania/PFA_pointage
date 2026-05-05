# Rapport de projet (PFA Frontend) — Application de gestion du pointage numérique

**Projet** : TimeTrack Pro — Gestion du pointage numérique des employés  
**Référentiel** : Cahier des charges PFA + projet Frontend (« Application de gestion du pointage numérique des employés »)  
**Technologies livrées** : Next.js (App Router), Firebase (Auth + Firestore), Firebase Cloud Functions, Tailwind CSS, Recharts  

> Ce rapport décrit le produit réalisé, son architecture, ses fonctionnalités, ainsi que la conformité au cahier des charges et les améliorations apportées.

---

## 1) Contexte et objectif

L’objectif du projet est de développer une application web permettant de :
- gérer le **pointage** des employés en temps réel,
- vérifier la présence via **géolocalisation (GPS)**,
- scanner un **QR code sécurisé**,
- gérer les **congés**,
- offrir un **tableau de bord analytique**,
- détecter les anomalies : **retards**, **absences**, **sorties anticipées** et **insuffisances d’heures**.

---

## 2) Périmètre et acteurs

### 2.1 Acteurs
- **Administrateur** : pilote l’ensemble (dashboard, employés, congés, rapports).
- **Employé** : pointe (GPS + QR), consulte son historique, demande des congés, gère son profil.

### 2.2 Hypothèses et périmètre
- L’application est pensée pour un usage **web** (desktop + mobile).
- La validation du pointage (QR + zone) se fait **côté backend**.
- Les données opérationnelles sont stockées dans **Firestore**.

---

## 3) Architecture technique (réalisée)

### 3.1 Frontend
- **Framework** : Next.js `16.x` (App Router).
- **UI & UX** : Tailwind CSS + composants UI (Radix).
- **Formulaires & validation** : React Hook Form + Zod.
- **Graphiques** : Recharts.
- **Notifications** : Sonner (toasts).

### 3.2 Backend
- **Firebase Cloud Functions (v2)** : logique serveur pour le pointage (Callable Function).
- **Auth Trigger (recommandation/évolution)** : création automatique du profil `users/{uid}` à la création d’un compte (voir §11).

### 3.3 Données
- **Stockage principal** : Firestore (`users`, `pointages`, `conges`).

> Remarque conformité CDC : le cahier des charges propose MongoDB/REST en exemple, mais n’impose pas strictement la technologie. Le résultat fonctionnel (collections, sécurité, API) est équivalent. La solution Firestore + Functions garantit la sécurité et simplifie la mise en œuvre.

---

## 4) Modèle de données (Firestore)

Le modèle suit l’esprit des collections attendues :

### 4.1 `users`
- `nom`, `email`, `role` (`admin` | `employe`), `createdAt`
- champs profil employé (optionnels) : `matricule`, `telephone`, `departement`, `poste`, `cin`, `adresse`, `dateNaissance`, `dateEmbauche`

### 4.2 `pointages`
- `userId`, `date` (YYYY-MM-DD), `heure` (HH:MM), `type` (`entree` | `sortie`)
- `latitude`, `longitude`, `valide`, `createdAt` (server timestamp)
- (optionnel) précision GPS `accuracyM`

### 4.3 `conges`
- `userId`, `dateDebut`, `dateFin`, `type` (`annuel` | `maladie` | `exceptionnel`)
- `statut` (`en_attente` | `valide` | `refuse`), `createdAt`

---

## 5) Fonctionnalités principales (réalisées)

### 5.1 Authentification & rôles
Conforme à la demande :
- **Connexion sécurisée** email + mot de passe.
- **Rôles** admin / employé.
- Gestion de session côté client via Firebase Auth + lecture du rôle dans Firestore.

### 5.2 Pointage intelligent (GPS + QR)
Flux employé (conforme CDC) :
1. L’employé ouvre la page **Pointer**.
2. L’application récupère la **géolocalisation** (stratégie en 2 étapes : rapide puis haute précision).
3. L’employé scanne un **QR code**.
4. Le backend valide :
   - token QR attendu,
   - présence dans la **zone autorisée**,
   - puis enregistre le pointage (entrée/sortie) avec timestamp serveur.

Améliorations UX / anti-fraude :
- feedback clair (état GPS, précision, distance, zone OK/KO),
- déduplication des notifications « QR détecté »,
- stabilisation de la caméra (éviter flux doublé + AbortError).

### 5.3 Gestion des congés
Employé :
- demande de congé avec type, dates, et calcul de durée (jours ouvrés).

Admin :
- visualisation des demandes,
- **validation / refus**,
- filtres (en attente / tous).

### 5.4 Tableau de bord analytique (admin)
Dashboard admin :
- compteurs (utilisateurs, pointages, congés),
- graphique pointages (7 jours),
- distribution des congés par statut (pie chart),
- design modernisé (cartes, gradients).

### 5.5 Filtres avancés et rapports
- Historique employé : filtres (type, mois), KPIs (retards/absences/présence), export **CSV**.
- Liste employés admin : recherche multi-champs + tri + export **CSV**.
- Rapport pointage admin : filtres + export **CSV**.

### 5.6 Détection d’anomalies (MVP + base)
Le projet inclut une première détection visuelle côté historique (retards/anomalies).  
Les règles exactes « heures < seuil 8h/jour » sont prévues en extension (voir §11).

---

## 6) Interfaces utilisateur (réalisées)

### 6.1 Espace Employé
- Connexion
- Pointage (GPS + QR)
- Historique personnel + KPIs + export
- Demande de congé
- Profil employé (édition)
- Navigation responsive (hamburger menu)
- **Light/Dark mode**

### 6.2 Espace Admin
- Dashboard analytique (charts)
- Liste employés (profil complet + tri)
- Gestion congés (valider/refuser)
- Rapport pointage (export)
- Navigation responsive (hamburger menu)
- **Light/Dark mode**

---

## 7) Sécurité (réalisée)

Conforme aux attentes :
- **Authentification requise** pour les zones applicatives.
- Validation backend obligatoire pour le **pointage** :
  - QR token,
  - zone GPS.
- Contrôle d’accès par **Firestore Rules** (lecture utilisateur, actions admin).

Points clés :
- Le rôle admin/employé est stocké en base et utilisé pour autoriser/filtrer les pages.
- Le QR code peut être « rotatif » via simple changement de token côté configuration (paramètres functions).

---

## 8) Contraintes techniques (réalisées)

- **Responsive design** (mobile obligatoire) : réalisé avec menus mobiles.
- Performance / UX :
  - géolocalisation optimisée,
  - scans et toasts stabilisés,
  - requêtes Firestore limitées (ex. 7 jours via `where(in)`).

Temps réel / WebSocket :
- présent comme piste (socket.io dépendance), mais non requis pour le MVP.

---

## 9) Tests et validation

### 9.1 Tests fonctionnels (manuel)
- Création compte + connexion.
- Pointage : GPS OK/KO + QR OK/KO.
- Congés : création employé, validation/refus admin.
- Dashboard : KPI + graphiques.
- Exports CSV : admin et employé.
- Responsive : mobile + hamburger menu.
- Thème : light/dark toggle.

### 9.2 Qualité
- ESLint intégré et vérifié.

---

## 10) Déploiement & exécution

### 10.1 Lancement local (frontend)
```bash
npm install
npm run dev
```

### 10.2 Fonctions (émulateur)
```bash
cd functions
npm install
npm run serve
```

> Note : le déploiement Functions v2 peut nécessiter un plan Firebase adapté (Blaze) selon le contexte. L’émulateur reste la solution locale recommandée.

---

## 11) Évolutions et recommandations (professionnelles)

### 11.1 Simplification “pro” de l’inscription (recommandée)
Pour supprimer les problèmes de synchronisation rôle/profil après inscription :
- ajouter une Cloud Function **Auth Trigger** `onCreate` qui crée systématiquement `users/{uid}`,
- ne plus écrire `users/{uid}` depuis le client,
- simplifier les Firestore Rules (moins permissives).

### 11.2 Détection d’anomalies avancée
- agrégation « heures/jour < 8h »,
- retards configurables,
- sorties anticipées basées sur planning.

### 11.3 Exports
- Export **PDF / Excel** côté admin.

### 11.4 Renforcement sécurité
- rotation programmée du QR token,
- logs d’audit (admin actions),
- rate limiting (anti-spam pointage).

---

## 12) Conclusion

Le projet TimeTrack Pro fournit une application web moderne répondant au cahier des charges :
- pointage intelligent (GPS + QR + validation backend),
- gestion des congés employé/admin,
- dashboard analytique avec graphiques,
- filtres, exports, détection d’anomalies (MVP),
- interface responsive et thème light/dark,
- architecture sécurisée et évolutive.

---

## Annexes (à compléter si demandé)
- Diagrammes UML (cas d’utilisation, séquence pointage, MCD/collections).
- Captures d’écran des interfaces.
- Démo vidéo / lien repo GitHub.

