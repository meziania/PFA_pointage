import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nom, email, password } = registerSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Cet email est déjà utilisé" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        nom,
        email,
        password: hashedPassword,
        role: "employe",
      },
    });

    return NextResponse.json(
      { message: "Utilisateur créé avec succès", userId: newUser.id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues?.[0]?.message ?? "Données invalides" }, { status: 400 });
    }
    console.error("Erreur d'inscription:", error);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        message: "Une erreur est survenue lors de l'inscription",
        ...(isDev ? { error: String(error), stack: (error as Error | undefined)?.stack } : null),
      },
      { status: 500 },
    );
  }
}
