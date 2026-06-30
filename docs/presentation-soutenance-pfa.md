# Soutenance PFA — TimeTrack Pro / Application de Pointage Numérique

**Durée cible :** 23–25 min + questions  
**Équipe :** El Hattab Elyasse · Abderrahmane Meziani · Youssef Oudris  
**Encadrants :** Pr. Abd Elmoghit Soussi · Pr. Monsif Dounia · Pr. Yousra Ait Larbi  
**Démo :** https://systemdepointage.vercel.app

---

## Répartition des rôles

| Membre | Partie | Durée |
|--------|--------|-------|
| **Elyasse** | Intro, problème, Design Thinking, conclusion | ~7 min |
| **Youssef** | Marché, gestion de projet, business | ~8 min |
| **Abderrahmane** | Technique, UML, démo live | ~10 min |

---

# SLIDES — Contenu slide par slide

---

## SLIDE 1 — Page de garde
**Intervenant : Elyasse**

- École Marocaine des Sciences de l'Ingénieur (EMSI)
- Rapport de Projet de Fin d'Année
- **Application de Gestion du Pointage Numérique des Employés**
- Filière : Développement Digital et Systèmes d'Information
- Réalisé par : El Hattab Elyasse · Abderrahmane Meziani · Youssef Oudris
- Encadré par : Pr. Soussi · Pr. Dounia · Pr. Ait Larbi
- Année universitaire 2025–2026

---

## SLIDE 2 — Plan de la présentation
**Intervenant : Elyasse**

1. Contexte et problématique
2. Exploration du problème (Design Thinking)
3. Analyse stratégique et marché
4. Gestion de projet (Agile Scrum)
5. Spécification des besoins
6. Conception technique (UML & architecture)
7. **Démonstration live**
8. Viabilité entrepreneuriale
9. Conclusion et perspectives

---

## SLIDE 3 — Contexte et problématique
**Intervenant : Elyasse**

**Contexte**
- Transformation digitale au Maroc (Maroc Digital 2030)
- PME/TPE sous-équipées en SIRH et GTA (Gestion des Temps et Activités)

**Constat**
- Registres papier → erreurs, lenteur, fraude (*buddy punching*)
- Pointeuses biométriques → CAPEX élevé, maintenance coûteuse

**Problématique**
> Comment moderniser le suivi de présence avec une solution **fiable, sécurisée et économique** ?

---

## SLIDE 4 — Notre solution
**Intervenant : Elyasse**

**TimeTrack Pro** — application web SaaS B2B

| Pilier | Description |
|--------|-------------|
| **GPS + Géofencing** | Preuve de présence sur site |
| **QR Code dynamique** | Token rotatif toutes les 30 s (anti-capture) |
| **Espace employé** | Pointage, historique, congés, profil |
| **Espace admin RH** | Dashboard, employés, validations, paramètres |

**Stack :** Next.js 16 · Firebase · Vercel

---

## SLIDE 5 — Design Thinking (Ch. 1)
**Intervenant : Elyasse**

**Empathie & compréhension**
- Profils : employé terrain, administrateur RH, direction
- Méthodes : QQOQCCP, 5 Pourquoi, cartographie des frustrations

**Idéation**
- Brainstorming / Brainwriting 6-3-5
- Matrice **Impact × Faisabilité**

**Solution retenue**
- Pointage mobile GPS + QR dynamique
- Centralisation RH (présences, retards, congés)

**Validation terrain**
- Hypothèses problème / solution / valeur confirmées auprès d'utilisateurs cibles

---

## SLIDE 6 — Analyse stratégique (Ch. 2)
**Intervenant : Youssef**

**PESTEL** — contexte macro (politique, économique, social, techno, légal)

**Concurrence**
- Pointeuses biométriques, SIRH lourds, solutions internationales coûteuses

**SWOT (synthèse)**
| Forces | Faiblesses |
|--------|------------|
| Coût faible, mobile-first, double validation | Dépendance réseau / GPS |
| Opportunités | Menaces |
| Digitalisation PME marocaines | Concurrence SaaS internationale |

**Positionnement :** SaaS B2B abordable pour PME — UVP : sécurité + simplicité + coût réduit

---

## SLIDE 7 — Gestion de projet (Ch. 3 & 5)
**Intervenant : Youssef**

**Méthodologie :** Agile **Scrum** — ~11 semaines

**Livrables clés**
- MVP fonctionnel déployé sur Vercel
- Rapport complet (65 pages)
- Modélisation UML + étude entrepreneuriale

**Diagramme de Gantt** *(reprendre figure du rapport p. 37)*
- Sprint 1 : Auth & utilisateurs
- Sprint 2 : Pointage GPS + QR
- Sprint 3 : Congés
- Sprint 4 : Dashboard & anomalies
- Sprint 5 : Tests, sécurisation, déploiement

**Matrice RACI** — répartition claire des responsabilités (rapport p. 38)

---

## SLIDE 8 — Spécification des besoins (Ch. 4)
**Intervenant : Youssef**

**Acteurs**
- Employé · Administrateur RH · Système (Firebase / API)

**Priorisation MoSCoW**

| Must | Should | Could |
|------|--------|-------|
| Pointage GPS+QR | Export CSV | Notifications push |
| Auth & rôles | Calendrier congés | Multi-sites |
| Dashboard admin | Reset MDP | |

**User stories MVP** — 14 employé + 12 admin (critères d'acceptation dans le rapport)

---

## SLIDE 9 — Architecture système (Ch. 6)
**Intervenant : Abderrahmane**

```
[Employé / Admin] → Navigateur (Next.js React)
        ↓
[Routes API Next.js + Firebase Admin SDK]
        ↓
[Firebase Auth] + [Cloud Firestore] + [Resend Email]
        ↓
[Hébergement Vercel — serverless]
```

**Choix techniques**
- Next.js 16 App Router — SSR + API intégrées
- Firestore NoSQL — temps réel, scalable
- Validation pointage **100 % côté serveur** (anti-fraude)

---

## SLIDE 10 — Cas d'utilisation (UML)
**Intervenant : Abderrahmane**

*(Reprendre figure rapport p. 43 ou `docs/uml/timetrack-pro-diagrammes.puml`)*

**Espace employé :** connexion, demande accès, pointage, historique, congés, profil

**Espace admin :** dashboard, employés, demandes accès, reset MDP, QR, paramètres GPS

**Système :** valider pointage · envoyer e-mails

---

## SLIDE 11 — Diagramme de séquence — Pointage
**Intervenant : Abderrahmane**

*(Figure rapport p. 45)*

1. Employé active GPS → vérifie géofence
2. Scan QR dynamique (caméra)
3. `POST /api/pointage` → validateQr() + validateGeofence()
4. Enregistrement Firestore → entrée/sortie

**Sécurité :** token HMAC 30 s · distance Haversine · Firestore Rules

---

## SLIDE 12 — Modèle de données (Ch. 6.3)
**Intervenant : Abderrahmane**

*(Figure rapport p. 47)*

**Collections Firestore :**
- `users` · `pointages` · `conges`
- `demandes_acces` · `demandes_reset_mdp`
- `parametres_entreprise` · `notifications`

**Relations :** 1 User → N Pointages, N Congés, N Notifications

---

## SLIDE 13 — DÉMO LIVE — Scénario employé
**Intervenant : Abderrahmane**

**URL :** https://systemdepointage.vercel.app

| Étape | Page | Action |
|-------|------|--------|
| 1 | `/login` | Connexion employé |
| 2 | `/pointage` | Activer GPS → zone OK |
| 3 | Scan QR admin | Entrée enregistrée |
| 4 | `/historique` | KPIs, retards, export CSV |
| 5 | `/conges` | Nouvelle demande |

*(Fenêtre mobile ou DevTools responsive)*

---

## SLIDE 14 — DÉMO LIVE — Scénario admin
**Intervenant : Abderrahmane**

| Étape | Page | Action |
|-------|------|--------|
| 1 | `/admin/dashboard` | KPIs, graphiques 7 j, anomalies |
| 2 | `/admin/qr-code` | QR plein écran (kiosk) |
| 3 | `/admin/employes` | Gestion + profil complet |
| 4 | `/admin/demandes` | Approbation accès |
| 5 | `/admin/conges` | Validation congé |

---

## SLIDE 15 — Sécurité & qualité (Ch. 7.3)
**Intervenant : Abderrahmane** *(slide backup ou transition rapide)*

- Rôles admin / employé + middleware Next.js
- Firestore Security Rules
- QR secret HMAC · géofence configurable
- Profil obligatoire avant pointage
- Tests manuels + endpoint `/api/health`

---

## SLIDE 16 — Business Model Canvas (Ch. 8)
**Intervenant : Youssef**

*(Reprendre BMC du rapport p. 58)*

- **Segments :** PME marocaines 20–200 employés
- **Proposition de valeur :** pointage sécurisé sans matériel
- **Canaux :** web SaaS, démo, prospection B2B
- **Revenus :** abonnement mensuel par employé
- **Coûts :** hébergement cloud, support, acquisition

---

## SLIDE 17 — Faisabilité financière (Ch. 8.4)
**Intervenant : Youssef**

*(Tableaux rapport p. 60–61)*

- Coût d'amorçage (développement + infra)
- Prévisions CA sur 3 ans
- **Seuil de rentabilité** et KPIs commerciaux
- Modèle scalable — roadmap produit (Ch. 8.7)

---

## SLIDE 18 — Conclusion & perspectives
**Intervenant : Elyasse**

**Bilan**
- Problème GTA adressé par solution mobile GPS + QR
- MVP déployé et fonctionnel
- Démarche complète : technique + gestion de projet + entrepreneuriat

**Limites**
- Dépendance GPS / connexion
- Périmètre mono-site (V1)

**Perspectives**
- Multi-établissements · app native · intégration paie · API RH

**Merci pour votre attention — nous sommes disponibles pour vos questions.**

---

## SLIDE 19 — BACKUP (questions jury)
**Tous**

- Matrice des risques + mitigation (Ch. 5.4)
- Comparaison concurrentielle détaillée
- Note technique : API Next.js (vs Cloud Functions mentionnées au départ)
- `/api/health` — statut production

---

# SCRIPTS ORAUX

---

## Script Elyasse (~7 min)

### Slide 1–2 (1 min)
« Bonjour Mesdames et Messieurs les membres du jury, chers encadrants. Nous sommes El Hattab Elyasse, Abderrahmane Meziani et Youssef Oudris. Nous allons vous présenter notre Projet de Fin d'Année intitulé *Application de Gestion du Pointage Numérique des Employés*, développé dans le cadre de la filière DDSI à l'EMSI. Notre présentation suivra le plan affiché à l'écran. »

### Slide 3–4 (3 min)
« La transformation digitale touche aujourd'hui tous les départements de l'entreprise, y compris les Ressources Humaines. Pourtant, de nombreuses PME marocaines s'appuient encore sur des registres papier ou des feuilles Excel pour le suivi de présence. Ces méthodes génèrent des erreurs de paie, des retards de consolidation et favorisent la fraude au pointage — le *buddy punching*. Les alternatives biométriques existent, mais leur coût d'acquisition et de maintenance les rend inaccessibles pour les structures de taille intermédiaire.

Notre réponse est **TimeTrack Pro** : une application web qui combine la géolocalisation GPS et un QR code dynamique renouvelé toutes les 30 secondes. L'employé pointe depuis son smartphone ; l'administrateur RH pilote l'ensemble via un tableau de bord centralisé. »

### Slide 5 (2 min)
« Pour structurer notre réflexion, nous avons appliqué le **Design Thinking**. Nous avons identifié les frustrations des employés et des responsables RH via la méthode QQOQCCP et les 5 Pourquoi. L'idéation par brainstorming nous a conduit à évaluer plusieurs pistes via une matrice Impact-Faisabilité. La solution GPS + QR dynamique s'est imposée comme le meilleur compromis entre sécurité, coût et expérience utilisateur. »

### Slide 18 — Conclusion (1 min)
« En conclusion, nous avons conçu et déployé un MVP capable de remplacer les méthodes traditionnelles de pointage. Les perspectives incluent le multi-sites, une application native et l'intégration avec la paie. Nous vous remercions pour votre attention et restons à votre disposition pour vos questions. »

---

## Script Youssef (~8 min)

### Slide 6 (2 min)
« J'en viens à l'**analyse stratégique**. Nous avons analysé le marché marocain de la GTA via le PESTEL et étudié les concurrents directs — pointeuses biométriques, SIRH lourds — et indirects. Notre analyse SWOT met en avant notre force principale : une solution légère, mobile-first et abordable. Nous nous positionnons en **SaaS B2B** ciblant les PME marocaines, avec une proposition de valeur claire : sécurité du pointage sans investissement matériel. »

### Slide 7 (2 min)
« La gestion du projet a suivi une méthodologie **Agile Scrum** sur environ 11 semaines. Le diagramme de Gantt que vous voyez structure cinq sprints : authentification, pointage, congés, dashboard et phase de tests-déploiement. La matrice RACI a permis de répartir clairement les responsabilités entre les trois membres de l'équipe et nos encadrants. »

### Slide 8 (2 min)
« Le chapitre 4 du rapport formalise les besoins. Deux profils principaux : l'employé et l'administrateur RH. Nous avons priorisé les fonctionnalités selon **MoSCoW** : le pointage GPS+QR et l'authentification sont des *Must* ; l'export CSV et le calendrier des congés sont des *Should*. Chaque user story du MVP est accompagnée de critères d'acceptation testables. »

### Slide 16–17 (2 min)
« Au-delà du prototype, nous avons évalué la **viabilité entrepreneuriale**. Le Business Model Canvas structure nos neuf blocs : segments clients PME, canaux web, revenus par abonnement. L'étude financière du chapitre 8 montre le coût d'amorçage, les prévisions de chiffre d'affaires et le seuil de rentabilité. Le projet est viable en mode SaaS avec une roadmap de montée en charge progressive. »

---

## Script Abderrahmane (~10 min dont 6 min démo)

### Slide 9 (1 min 30)
« Je présente maintenant la **conception technique**. L'architecture repose sur Next.js 16 côté frontend et routes API serverless, Firebase pour l'authentification et Firestore pour la persistance, le tout hébergé sur Vercel. Le choix serverless élimine la gestion d'infrastructure et permet un déploiement continu. Toute validation de pointage est effectuée côté serveur pour garantir l'intégrité des données. »

### Slide 10–12 (2 min 30)
« La modélisation UML comprend un diagramme de cas d'utilisation séparant l'espace employé et admin, un diagramme de séquence pour le flux de pointage — GPS, scan QR, validation serveur — et un diagramme de classes aligné sur nos collections Firestore : users, pointages, conges, demandes_acces, et parametres_entreprise pour la géofence. »

### Slide 13–14 — DÉMO (6 min)
« Nous passons à la **démonstration live** sur https://systemdepointage.vercel.app.

**Côté employé :** je me connecte… J'ouvre la page Pointage, j'active le GPS — le système vérifie que je suis dans la zone autorisée. Je scanne le QR code affiché par l'administrateur… Le pointage entrée est enregistré. Dans Historique, je consulte mes KPIs et d'éventuelles anomalies de retard.

**Côté admin :** je bascule sur le dashboard — présents, absents, graphique sur 7 jours. J'affiche le QR en plein écran pour le mode kiosk à l'entrée. Je peux approuver une demande d'accès ou valider un congé en quelques clics. »

*(Adapter le débit selon le temps restant.)*

### Slide 15 (30 s — si temps)
« Côté sécurité : rôles stricts, Firestore Rules, token HMAC pour le QR, et profil employé obligatoire avant tout pointage. »

---

# CHECKLIST AVANT SOUTENANCE

- [ ] Slides créées (Canva / PowerPoint) avec figures du rapport
- [ ] Logo EMSI + logo TimeTrack Pro (`public/logo-full.svg`)
- [ ] Comptes démo employé + admin testés
- [ ] QR admin ouvert sur 2ᵉ écran / tablette
- [ ] GPS activé sur le téléphone de démo
- [ ] `QR_SECRET` configuré sur Vercel Production
- [ ] Répétition chronométrée (max 23 min)
- [ ] PDF slides en backup sur clé USB

---

# RÉPONSES AUX QUESTIONS FRÉQUENTES DU JURY

**Pourquoi Firebase et pas une base SQL ?**  
→ NoSQL adapté au MVP, temps réel, intégration Auth native, coût faible au démarrage.

**Comment évitez-vous la fraude ?**  
→ Double validation GPS + QR dynamique 30 s, validation serveur uniquement, géofence configurable.

**Différence avec une pointeuse biométrique ?**  
→ Zéro CAPEX matériel, déploiement immédiat, maintenance cloud.

**Cloud Functions vs API Next.js ?**  
→ Même logique métier ; nous avons retenu les routes API Next.js + Admin SDK pour simplifier le déploiement Vercel.

**Modèle économique ?**  
→ SaaS B2B, abonnement par employé/mois, seuil de rentabilité détaillé chapitre 8.
