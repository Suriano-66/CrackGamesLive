import { z } from "zod";

// Validation stricte des entrées utilisateur (défense en profondeur).
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit faire au moins 2 caractères.")
    .max(60, "Le nom est trop long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Adresse email invalide."),
  password: z
    .string()
    .min(10, "Le mot de passe doit faire au moins 10 caractères.")
    .max(200, "Le mot de passe est trop long.")
    .regex(/[a-z]/, "Ajoute au moins une minuscule.")
    .regex(/[A-Z]/, "Ajoute au moins une majuscule.")
    .regex(/[0-9]/, "Ajoute au moins un chiffre."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const checkoutSchema = z.object({
  plan: z.enum(["starter", "creator", "pro"]),
  interval: z.enum(["monthly", "quarterly", "yearly"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
