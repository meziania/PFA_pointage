"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "firebase/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { changePassword, apiErrorMessage } from "@/lib/user-management";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useAuth } from "@/components/providers/auth-provider";

const formSchema = z
  .object({
    newPassword: z.string().min(6, { message: "Au moins 6 caractères." }),
    confirmPassword: z.string().min(6),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export default function ChangePasswordPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const user = auth?.currentUser;
      if (!auth || !user) {
        toast.error("Session expirée");
        router.replace("/login");
        return;
      }

      await updatePassword(user, values.newPassword);
      await changePassword(values.newPassword);

      toast.success("Mot de passe mis à jour");
      router.push(role === "admin" ? "/admin/dashboard" : "/pointage");
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de changer le mot de passe."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/50 px-4">
      <div className="mb-6">
        <BrandLogo size="lg" />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Changer votre mot de passe</CardTitle>
          <CardDescription>
            Votre administrateur vous a fourni un mot de passe temporaire. Choisissez un nouveau mot de passe pour
            continuer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
