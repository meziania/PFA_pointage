"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { submitDemandeAcces, apiErrorMessage } from "@/lib/user-management";
import { AuthLayout } from "@/components/layout/auth-layout";

const formSchema = z.object({
  nom: z.string().min(2, { message: "Le nom doit contenir au moins 2 caractères." }),
  email: z.string().email({ message: "Veuillez entrer une adresse email valide." }),
  telephone: z.string().optional(),
  message: z.string().max(500, { message: "500 caractères maximum." }).optional(),
});

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nom: "", email: "", telephone: "", message: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await submitDemandeAcces({
        nom: values.nom,
        email: values.email,
        telephone: values.telephone?.trim() || undefined,
        message: values.message?.trim() || undefined,
      });

      setSubmitted(true);
      toast.success("Demande envoyée à l'administrateur.");
      form.reset();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible d'envoyer la demande."));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Demander à rejoindre"
      description="L'administrateur RH créera votre compte et vous transmettra vos identifiants après validation."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Se connecter
          </Link>
        </p>
      }
    >
      {submitted ? (
        <div className="space-y-4 text-sm">
          <p className="font-semibold text-brand-dark">Demande enregistrée</p>
          <p className="text-muted-foreground">
            L&apos;administrateur examinera votre demande. Vous recevrez un email et un mot de passe temporaire une
            fois la demande acceptée.
          </p>
          <Button type="button" variant="outline" className="w-full" onClick={() => setSubmitted(false)}>
            Envoyer une autre demande
          </Button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="telephone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="+212 6…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Département, poste…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
}
