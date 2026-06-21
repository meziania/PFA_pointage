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
import { toast } from "sonner";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { changePassword, apiErrorMessage } from "@/lib/user-management";
import { useAuth } from "@/components/providers/auth-provider";
import { AuthLayout } from "@/components/layout/auth-layout";

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
  const { role, profileComplete } = useAuth();
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
      if (role === "admin") {
        router.push("/admin/dashboard");
      } else if (profileComplete === false) {
        router.push("/profil");
      } else {
        router.push("/pointage");
      }
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de changer le mot de passe."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Première connexion"
      description="Remplacez le mot de passe temporaire par un mot de passe personnel sécurisé."
    >
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
            {loading ? "Enregistrement…" : "Continuer"}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
