"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { submitDemandeAcces, apiErrorMessage } from "@/lib/user-management";
import { BrandLogo } from "@/components/brand/brand-logo";

const formSchema = z.object({
  nom: z.string().min(2, {
    message: "Le nom doit contenir au moins 2 caractères.",
  }),
  email: z.string().email({
    message: "Veuillez entrer une adresse email valide.",
  }),
  telephone: z.string().optional(),
  message: z.string().max(500, { message: "500 caractères maximum." }).optional(),
});

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nom: "",
      email: "",
      telephone: "",
      message: "",
    },
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/50 px-4 py-8">
      <div className="mb-6">
        <BrandLogo size="lg" />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Demander à rejoindre</CardTitle>
          <CardDescription>
            Les comptes employés sont créés par l&apos;administrateur. Envoyez une demande d&apos;adhésion ; vous
            recevrez vos identifiants une fois la demande acceptée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Demande enregistrée</p>
              <p className="text-muted-foreground">
                L&apos;administrateur examinera votre demande et vous communiquera vos identifiants de connexion par
                email.
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
                        <Input placeholder="jean@exemple.com" type="email" {...field} />
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
                        <Input placeholder="+212 6..." {...field} />
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
                        <Input placeholder="Motif ou précisions pour l'admin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Envoi en cours..." : "Envoyer la demande"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Vous avez déjà un compte ?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Se connecter
            </Link>
          </div>
          <Button variant="outline" asChild className="w-full">
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
