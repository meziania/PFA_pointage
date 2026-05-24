"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/components/providers/auth-provider";
import { ProfileAvatarUpload } from "@/components/app/profile-avatar-upload";
import { getUserDoc, updateUserDoc } from "@/lib/firestore-helpers";

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
  const { user } = useAuth();
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

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!uid) return;
      setLoading(true);
      try {
        const doc = await getUserDoc(uid);
        if (!doc) {
          // Shouldn't happen because ensureUserDoc is called on register.
          form.reset({
            nom: user?.displayName ?? "",
            email: user?.email ?? "",
          });
          return;
        }
        if (cancelled) return;
        setPhotoURL(doc.photoURL ?? user?.photoURL ?? null);
        form.reset({
          nom: doc.nom ?? user?.displayName ?? "",
          email: doc.email ?? user?.email ?? "",
          matricule: doc.matricule ?? "",
          telephone: doc.telephone ?? "",
          departement: doc.departement ?? "",
          poste: doc.poste ?? "",
          cin: doc.cin ?? "",
          adresse: doc.adresse ?? "",
          dateNaissance: doc.dateNaissance ?? "",
          dateEmbauche: doc.dateEmbauche ?? "",
        });
      } catch {
        toast.error("Impossible de charger votre profil");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [uid, form, user?.displayName, user?.email]);

  const readonlyEmail = useMemo(() => Boolean(user?.email), [user?.email]);

  async function onSubmit(values: FormValues) {
    if (!uid) return;
    setSaving(true);
    try {
      await updateUserDoc(uid, {
        nom: values.nom.trim(),
        email: values.email.trim(),
        matricule: values.matricule?.trim() || undefined,
        telephone: values.telephone?.trim() || undefined,
        departement: values.departement?.trim() || undefined,
        poste: values.poste?.trim() || undefined,
        cin: values.cin?.trim() || undefined,
        adresse: values.adresse?.trim() || undefined,
        dateNaissance: values.dateNaissance?.trim() || undefined,
        dateEmbauche: values.dateEmbauche?.trim() || undefined,
      });
      toast.success("Profil mis à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour du profil");
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

