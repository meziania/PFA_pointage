"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { doc, onSnapshot } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/components/providers/auth-provider";
import { ProfileAvatarUpload } from "@/components/app/profile-avatar-upload";
import { ensureUserDoc, updateEmployeeProfile } from "@/lib/firestore-helpers";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { UserDoc } from "@/lib/data-model";

const profileSchema = z.object({
  nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  matricule: z.string().trim().optional(),
  telephone: z.string().trim().optional(),
  departement: z.string().trim().optional(),
  poste: z.string().trim().optional(),
  cin: z.string().trim().optional(),
  adresse: z.string().trim().optional(),
  dateNaissance: z.string().trim().optional(),
  dateEmbauche: z.string().trim().optional(),
});

type FormValues = z.infer<typeof profileSchema>;

export default function ProfilPage() {
  const { user, refreshProfilePhoto } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nom: "",
      email: "",
      matricule: "",
      telephone: "",
      departement: "",
      poste: "",
      cin: "",
      adresse: "",
      dateNaissance: "",
      dateEmbauche: "",
    },
  });

  const uid = user?.uid ?? null;

  const applyUserDoc = useCallback(
    (data: UserDoc | null) => {
      if (!data) {
        form.reset({
          nom: user?.displayName ?? "",
          email: user?.email ?? "",
          matricule: "",
          telephone: "",
          departement: "",
          poste: "",
          cin: "",
          adresse: "",
          dateNaissance: "",
          dateEmbauche: "",
        });
        setPhotoURL(user?.photoURL ?? null);
        return;
      }
      setPhotoURL(data.photoURL ?? user?.photoURL ?? null);
      form.reset({
        nom: data.nom ?? user?.displayName ?? "",
        email: data.email ?? user?.email ?? "",
        matricule: data.matricule ?? "",
        telephone: data.telephone ?? "",
        departement: data.departement ?? "",
        poste: data.poste ?? "",
        cin: data.cin ?? "",
        adresse: data.adresse ?? "",
        dateNaissance: data.dateNaissance ?? "",
        dateEmbauche: data.dateEmbauche ?? "",
      });
    },
    [form, user?.displayName, user?.email, user?.photoURL],
  );

  useEffect(() => {
    if (!uid || !user?.email) return;
    const db = getFirebaseFirestore();
    if (!db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let ensured = false;

    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          if (!ensured) {
            ensured = true;
            void ensureUserDoc({
              uid,
              nom: user.displayName?.trim() || user.email!.split("@")[0] || "Employé",
              email: user.email!,
              role: "employe",
            }).catch(() => {
              /* le prochain snapshot réessaiera */
            });
          }
          applyUserDoc(null);
        } else {
          applyUserDoc(snap.data() as UserDoc);
        }
        setLoading(false);
      },
      () => {
        toast.error("Impossible de charger votre profil");
        setLoading(false);
      },
    );

    return () => unsub();
  }, [uid, user?.email, user?.displayName, applyUserDoc]);

  const readonlyEmail = useMemo(() => Boolean(user?.email), [user?.email]);

  async function onSubmit(values: FormValues) {
    if (!uid || !user) return;
    setSaving(true);
    try {
      const email = user?.email ?? values.email.trim();
      if (!email) {
        toast.error("Email introuvable pour enregistrer le profil");
        return;
      }

      await updateEmployeeProfile(
        uid,
        {
          nom: values.nom,
          matricule: values.matricule,
          telephone: values.telephone,
          departement: values.departement,
          poste: values.poste,
          cin: values.cin,
          adresse: values.adresse,
          dateNaissance: values.dateNaissance,
          dateEmbauche: values.dateEmbauche,
        },
        { email },
      );

      try {
        await updateProfile(user, { displayName: values.nom.trim() });
      } catch {
        /* Firestore est la source de vérité */
      }
      await refreshProfilePhoto();

      toast.success("Profil mis à jour");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg =
        code === "permission-denied"
          ? "Mise à jour refusée par Firestore (règles de sécurité). Déployez firestore.rules si besoin."
          : err instanceof Error
            ? err.message
            : "Erreur lors de la mise à jour du profil";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon profil</h1>
        <p className="text-muted-foreground">Complétez vos informations pour faciliter le tri et la gestion côté admin.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations employé</CardTitle>
          <CardDescription>{loading ? "Chargement..." : "Vous pouvez modifier ces informations à tout moment."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ProfileAvatarUpload
            photoURL={photoURL}
            displayName={form.watch("nom") || user.displayName || ""}
            onPhotoUpdated={setPhotoURL}
            disabled={loading}
          />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <Input placeholder="Jean Dupont" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="jean@exemple.com" type="email" disabled={readonlyEmail} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="matricule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matricule</FormLabel>
                    <FormControl>
                      <Input placeholder="EMP-0001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="+212..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="departement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Département</FormLabel>
                    <FormControl>
                      <Input placeholder="RH / IT / Production..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="poste"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Poste</FormLabel>
                    <FormControl>
                      <Input placeholder="Technicien..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CIN</FormLabel>
                    <FormControl>
                      <Input placeholder="AB123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adresse"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Input placeholder="Rue, ville..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateNaissance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de naissance</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateEmbauche"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date d&apos;embauche</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2">
                <Button type="submit" disabled={loading || saving} className="w-full md:w-auto">
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

