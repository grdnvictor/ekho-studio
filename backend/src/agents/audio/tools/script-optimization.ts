import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { AudioService } from "../../../services/audio";

const audioService = new AudioService();

export const scriptOptimizationTool = tool(
  async ({ originalText, targetDuration, style, constraints }) => {
    try {
      const result = await audioService.optimizeContent({
        originalText,
        targetDuration,
        style,
        constraints
      });

      return {
        optimizedText: result.text,
        changes: result.changes,
        estimatedDuration: result.duration,
        readabilityScore: result.readability.score,
        suggestions: result.suggestions
      };
    } catch (error) {
      console.error("Script optimization failed:", error);
      return {
        optimizedText: originalText, // Fallback
        changes: [],
        estimatedDuration: targetDuration,
        readabilityScore: 70,
        suggestions: ["Échec de l'optimisation automatique"]
      };
    }
  },
  {
    name: "script_optimization",
    description: "Optimise un script pour une durée cible tout en conservant le message principal",
    schema: z.object({
      originalText: z.string().describe("Texte original à optimiser"),
      targetDuration: z.number().min(5).max(3600).describe("Durée cible en secondes"),
      style: z.string().describe("Style souhaité (commercial, éducatif, narratif...)"),
      constraints: z.array(z.string()).optional().describe("Contraintes spécifiques")
    }),
  }
);