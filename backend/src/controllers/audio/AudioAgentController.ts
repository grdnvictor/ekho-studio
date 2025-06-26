import { Request, Response } from "express";
import { audioAgent } from "@/agents/audio/audio-agent";
import { AudioAgentChatContractType, AudioProjectContractType } from "@/contracts/api/AudioAgentContracts";
import { ValidatedRequest } from "@/types";

export class AudioAgentController {
  /**
   * Chat interactif avec l'agent audio
   */
  static async chat(
    request: Request,
    response: Response,
  ): Promise<void> {
    try {
      const validatedRequest = request as ValidatedRequest<AudioAgentChatContractType>;
      const { message, sessionId, context } = validatedRequest.validated.body;

      // Configuration de session pour maintenir le contexte
      const config = {
        configurable: {
          thread_id: sessionId || `session_${Date.now()}`,
        },
      };

      // Construire le message avec le contexte
      let fullMessage = message;
      if (context) {
        const contextParts = [];
        if (context.targetAudience) contextParts.push(`Public cible: ${context.targetAudience}`);
        if (context.style) contextParts.push(`Style: ${context.style}`);
        if (context.duration) contextParts.push(`Durée souhaitée: ${context.duration} secondes`);
        if (context.emotion) contextParts.push(`Émotion: ${context.emotion}`);

        if (contextParts.length > 0) {
          fullMessage = `Contexte: ${contextParts.join(', ')}\n\nDemande: ${message}`;
        }
      }

      // Exécuter l'agent
      const result = await audioAgent.invoke(
        { messages: [{ role: "user", content: fullMessage }] },
        config
      );

      // Extraire la dernière réponse de l'agent
      const lastMessage = result.messages[result.messages.length - 1];

      // Analyser la réponse pour déterminer si des informations manquent
      // @ts-ignore
      const analysisResult = AudioAgentController.analyzeAgentResponse(lastMessage.content);

      response.status(200).json({
        success: true,
        sessionId: config.configurable.thread_id,
        response: lastMessage.content,
        needsMoreInfo: analysisResult.needsMoreInfo,
        missingInfo: analysisResult.missingInfo,
        suggestions: analysisResult.suggestions,
        nextSteps: analysisResult.nextSteps,
        canProceed: analysisResult.canProceed
      });

    } catch (error: unknown) {
      console.error("Error in audio agent chat:", error);
      response.status(500).json({
        success: false,
        error: "Erreur lors de la communication avec l'agent audio",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Génération complète d'un projet audio
   */
  static async generateProject(
    request: Request,
    response: Response,
  ): Promise<void> {
    try {
      const validatedRequest = request as ValidatedRequest<AudioProjectContractType>;
      const { title, description, requirements, constraints } = validatedRequest.validated.body;

      // Configuration de session
      const config = {
        configurable: {
          thread_id: `project_${Date.now()}`,
        },
      };

      // Construire le prompt pour le projet complet
      const projectPrompt = AudioAgentController.buildProjectPrompt(
        title,
        description,
        requirements,
        constraints
      );

      // Exécuter l'agent pour générer le projet complet
      const result = await audioAgent.invoke(
        { messages: [{ role: "user", content: projectPrompt }] },
        config
      );

      const lastMessage = result.messages[result.messages.length - 1];
      // @ts-ignore
      const analysisResult = AudioAgentController.analyzeProjectResult(lastMessage.content);

      response.status(200).json({
        success: true,
        projectId: config.configurable.thread_id,
        result: analysisResult.result,
        steps: analysisResult.steps,
        audioFiles: analysisResult.audioFiles,
        recommendations: analysisResult.recommendations,
        needsRevision: analysisResult.needsRevision,
        nextActions: analysisResult.nextActions
      });

    } catch (error: unknown) {
      console.error("Error in audio project generation:", error);
      response.status(500).json({
        success: false,
        error: "Erreur lors de la génération du projet audio",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Analyse la réponse de l'agent pour déterminer les actions nécessaires
   */
  private static analyzeAgentResponse(content: string): {
    needsMoreInfo: boolean;
    missingInfo: string[];
    suggestions: string[];
    nextSteps: string[];
    canProceed: boolean;
  } {
    const analysis = {
      needsMoreInfo: false,
      missingInfo: [] as string[],
      suggestions: [] as string[],
      nextSteps: [] as string[],
      canProceed: true
    };

    const lowerContent = content.toLowerCase();

    // Détection des informations manquantes
    const missingInfoPatterns = [
      { pattern: /quel.*public|audience.*cible|pour qui/i, info: "Public cible" },
      { pattern: /combien.*temps|durée|long/i, info: "Durée souhaitée" },
      { pattern: /quel.*style|ton|ambiance/i, info: "Style ou ton" },
      { pattern: /quel.*émotion|sentiment|feeling/i, info: "Émotion souhaitée" },
      { pattern: /quel.*objectif|but|goal/i, info: "Objectifs du contenu" },
      { pattern: /quel.*voix|speaker|narrateur/i, info: "Préférence de voix" },
      { pattern: /quel.*format|qualité|technical/i, info: "Spécifications techniques" },
    ];

    missingInfoPatterns.forEach(({ pattern, info }) => {
      if (pattern.test(content)) {
        analysis.needsMoreInfo = true;
        analysis.missingInfo.push(info);
      }
    });

    // Détection des questions ou demandes de clarification
    if (content.includes('?') || lowerContent.includes('pouvez-vous') ||
      lowerContent.includes('pourriez-vous') || lowerContent.includes('préciser')) {
      analysis.needsMoreInfo = true;
    }

    // Génération de suggestions
    if (analysis.needsMoreInfo) {
      analysis.suggestions = [
        "Décrivez votre public cible (âge, intérêts, profession)",
        "Précisez la durée souhaitée pour l'audio",
        "Indiquez le style ou l'ambiance recherchée",
        "Mentionnez l'émotion que vous voulez transmettre"
      ];

      analysis.nextSteps = [
        "Répondez aux questions posées par l'agent",
        "Fournissez les informations manquantes",
        "Validez les recommandations proposées"
      ];

      analysis.canProceed = false;
    } else {
      // Si toutes les infos sont présentes, proposer les prochaines étapes
      analysis.nextSteps = [
        "Valider le script proposé",
        "Choisir la voix recommandée",
        "Lancer la génération audio"
      ];

      analysis.suggestions = [
        "Vous pouvez demander des modifications du script",
        "Vous pouvez tester différentes voix",
        "Vous pouvez ajuster les paramètres audio"
      ];
    }

    return analysis;
  }

  /**
   * Analyse le résultat d'un projet complet
   */
  private static analyzeProjectResult(content: string): {
    result: any;
    steps: string[];
    audioFiles: any[];
    recommendations: string[];
    needsRevision: boolean;
    nextActions: string[];
  } {
    return {
      result: {
        summary: "Projet audio généré avec succès",
        content: content
      },
      steps: [
        "Analyse du brief projet",
        "Sélection de la voix optimale",
        "Génération du script",
        "Production de l'audio final"
      ],
      audioFiles: [], // À remplir avec les fichiers générés
      recommendations: [
        "Testez l'audio avec votre public cible",
        "Considérez des variantes pour différentes plateformes",
        "Gardez le script pour de futures utilisations"
      ],
      needsRevision: false,
      nextActions: [
        "Télécharger les fichiers audio",
        "Demander des modifications si nécessaire",
        "Partager avec votre équipe"
      ]
    };
  }

  /**
   * Construit le prompt pour un projet complet
   */
  private static buildProjectPrompt(
    title: string,
    description: string,
    requirements: any,
    constraints?: any
  ): string {
    let prompt = `Nouveau projet audio: ${title}\n\n`;
    prompt += `Description: ${description}\n\n`;
    prompt += `Exigences:\n`;
    prompt += `- Durée: ${requirements.duration} secondes\n`;
    prompt += `- Style: ${requirements.style}\n`;
    prompt += `- Public cible: ${requirements.targetAudience}\n`;
    prompt += `- Objectifs: ${requirements.objectives.join(', ')}\n`;

    if (requirements.content) {
      prompt += `- Contenu fourni: ${requirements.content}\n`;
    }

    if (constraints) {
      prompt += `\nContraintes:\n`;
      if (constraints.deadline) prompt += `- Deadline: ${constraints.deadline}\n`;
      if (constraints.budget) prompt += `- Budget: ${constraints.budget}€\n`;
      if (constraints.technicalSpecs) {
        prompt += `- Specs techniques: ${JSON.stringify(constraints.technicalSpecs)}\n`;
      }
    }

    prompt += `\nVeuillez créer un projet audio complet en utilisant vos outils disponibles.`;

    return prompt;
  }
}