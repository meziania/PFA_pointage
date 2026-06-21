"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { firebaseMissingConfigMessage } from "@/lib/firebase-missing-message";
import { getUserDoc, getUserRole } from "@/lib/firestore-helpers";
import { AuthLayout } from "@/components/layout/auth-layout";

const formSchema = z.object({
  email: z.string().email({ message: "Veuillez entrer une adresse email valide." }),
  password: z.string().min(1, { message: "Veuillez entrer votre mot de passe." }),
});

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        toast.error(firebaseMissingConfigMessage());
        return;
      }

      await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = auth.currentUser;
      if (!user) {
        toast.error("Session introuvable après connexion");
        return;
      }

      let role = await getUserRole(user.uid);
      let profile = await getUserDoc(user.uid);
      for (let i = 0; i < 8 && (!role || !profile); i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        role = await getUserRole(user.uid);
        profile = await getUserDoc(user.uid);
      }

      if (!role || !profile) {
        await signOut(auth);
        toast.error("Compte non activé. Demandez l'accès à l'administrateur ou attendez la validation de votre demande.");
        return;
      }

      if ((profile.statut ?? "actif") !== "actif") {
        await signOut(auth);
        toast.error("Compte désactivé. Contactez l'administrateur.");
        return;
      }

      toast.success("Connexion réussie");
      if (profile.doit_changer_mdp) {
        router.push("/changer-mot-de-passe");
      } else {
        router.push(role === "admin" ? "/admin/dashboard" : "/pointage");
      }
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur est survenue";
      if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
        toast.error("Email ou mot de passe incorrect");
      } else if (message.includes("auth/too-many-requests")) {
        toast.error("Trop de tentatives. Réessayez plus tard.");
      } else {
        toast.error("Une erreur est survenue lors de la connexion");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Connexion"
      description="Utilisez les identifiants transmis par votre administrateur RH."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/register" className="font-medium text-brand hover:underline">
            Demander à rejoindre
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email professionnel</FormLabel>
                <FormControl>
                  <Input placeholder="jean@entreprise.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mot de passe</FormLabel>
                <FormControl>
                  <Input placeholder="••••••••" type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
