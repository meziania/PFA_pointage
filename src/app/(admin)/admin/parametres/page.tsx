"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DEFAULT_GEOFENCE } from "@/lib/geofence-defaults";
import { apiErrorMessage, getParametresEntreprise, updateParametresEntreprise } from "@/lib/user-management";

const schema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  rayon_metres: z.number().positive(),
});

type FormValues = z.infer<typeof schema>;

export default function AdminParametresPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      latitude: DEFAULT_GEOFENCE.latitude,
      longitude: DEFAULT_GEOFENCE.longitude,
      rayon_metres: DEFAULT_GEOFENCE.rayon_metres,
    },
  });

  useEffect(() => {
    void (async () => {
      try {
        const res = await getParametresEntreprise();
        const p = res.parametres as { latitude?: number; longitude?: number; rayon_metres?: number } | null;
        if (p) {
          form.reset({
            latitude: p.latitude ?? 0,
            longitude: p.longitude ?? 0,
            rayon_metres: p.rayon_metres ?? 100,
          });
        }
      } catch (error) {
        toast.error(apiErrorMessage(error, "Impossible de charger les paramètres."));
      } finally {
        setLoading(false);
      }
    })();
  }, [form]);

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      await updateParametresEntreprise(values);
      toast.success("Paramètres entreprise enregistrés");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible d'enregistrer les paramètres."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres entreprise</h1>
        <p className="text-muted-foreground">
          Zone de pointage utilisée par <code className="text-xs">POST /api/pointage</code> pour valider la
          géolocalisation. Site par défaut :{" "}
          <a href={DEFAULT_GEOFENCE.mapsUrl} target="_blank" rel="noreferrer" className="text-brand underline">
            {DEFAULT_GEOFENCE.label}
          </a>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Géolocalisation</CardTitle>
          <CardDescription>{loading ? "Chargement..." : "Coordonnées du site et rayon autorisé."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-xl gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rayon_metres"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rayon (mètres)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={saving || loading}>
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
