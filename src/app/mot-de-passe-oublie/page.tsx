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
import { submitDemandeResetMdp, apiErrorMessage } from "@/lib/user-management";
import { AuthLayout } from "@/components/layout/auth-layout";

const formSchema = z.object({
  email: z.string().email({ message: "Veuillez entrer une adresse email valide." }),
  message: z.string().max(500, { message: "500 caractères maximum." }).optional(),
});

export default function MotDePasseOubliePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", message: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await submitDemandeResetMdp({
        email: values.email,
        message: values.message?.trim() || undefined,
      });
      setSubmitted(true);
      toast.success("Demande envoyée à l'administrateur RH");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible d'envoyer la demande."));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      description="Envoyez une demande à l'administrateur RH pour obtenir un nouveau mot de passe temporaire."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-brand hover:underline">
            Retour à la connexion
          </Link>
        </p>
      }
    >
      {submitted ? (
        <div className="space-y-4 text-sm">
          <p className="text-brand-dark">
            Si un compte employé actif existe pour cet email, votre demande a été transmise à l&apos;administrateur.
          </p>
          <p className="text-muted-foreground">
            L&apos;administrateur générera un nouveau mot de passe temporaire. Vous pourrez ensuite vous connecter et le
            personnaliser.
          </p>
          <Button type="button" className="w-full" asChild>
            <Link href="/login">Retour à la connexion</Link>
          </Button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email professionnel</FormLabel>
                  <FormControl>
                    <Input placeholder="jean@entreprise.com" type="email" autoComplete="email" {...field} />
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
                    <textarea
                      className="min-h-24 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="Ex. : je n'arrive plus à me connecter depuis hier…"
                      {...field}
                    />
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
