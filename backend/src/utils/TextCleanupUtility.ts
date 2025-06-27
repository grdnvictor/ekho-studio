// backend/src/utils/TextCleanupUtility.ts

export class TextCleanupUtility {
  /**
   * Nettoie le texte pour la synthèse vocale en supprimant les instructions parasites
   */
  static cleanForTTS(text: string): string {
    let cleaned = text;

    // Supprimer les instructions entre crochets ou parenthèses
    cleaned = cleaned.replace(/\[.*?\]/g, '');
    cleaned = cleaned.replace(/\(.*?émotion.*?\)/gi, '');
    cleaned = cleaned.replace(/\(.*?style.*?\)/gi, '');
    cleaned = cleaned.replace(/\(.*?ton.*?\)/gi, '');
    cleaned = cleaned.replace(/\(.*?voix.*?\)/gi, '');
    cleaned = cleaned.replace(/\(.*?vitesse.*?\)/gi, '');
    cleaned = cleaned.replace(/\(.*?durée.*?\)/gi, '');

    // Supprimer les instructions de direction courantes
    const directivePatterns = [
      /^(parlez|dites|lisez|récitez)\s+.*?[.:]\s*/gi,
      /^(avec|de manière|sur un ton)\s+.*?[,:]\s*/gi,
      /^(rapidement|lentement|calmement|joyeusement|tristement)\s*[,:]\s*/gi,
      /^(d'une voix|en|dans un style)\s+.*?[,:]\s*/gi
    ];

    directivePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Supprimer les métadonnées et informations techniques
    const metadataPatterns = [
      /durée\s*:\s*\d+.*?(?=\s|$)/gi,
      /audience\s*:\s*.*?(?=\.|,|$)/gi,
      /public\s*:\s*.*?(?=\.|,|$)/gi,
      /style\s*:\s*.*?(?=\.|,|$)/gi,
      /voix\s*:\s*.*?(?=\.|,|$)/gi,
      /émotion\s*:\s*.*?(?=\.|,|$)/gi,
      /format\s*:\s*.*?(?=\.|,|$)/gi
    ];

    metadataPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Nettoyer les espaces multiples et trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Supprimer les séparateurs en début de texte
    cleaned = cleaned.replace(/^[:\-\—\–,.\s]+/, '');

    return cleaned;
  }

  /**
   * Extrait les métadonnées du texte (style, émotion, etc.) avant nettoyage
   */
  static extractMetadata(text: string): {
    style?: string;
    emotion?: string;
    voice?: string;
    duration?: number;
    audience?: string;
    cleanedText: string;
  } {
    const metadata: any = {};
    let cleanedText = text;

    // Extraire le style
    const styleMatch = text.match(/style\s*:\s*([^.,\n]+)/i);
    if (styleMatch) {
      metadata.style = styleMatch[1].trim();
    }

    // Extraire l'émotion
    const emotionMatch = text.match(/(?:émotion|ton)\s*:\s*([^.,\n]+)/i);
    if (emotionMatch) {
      metadata.emotion = emotionMatch[1].trim();
    }

    // Extraire la voix
    const voiceMatch = text.match(/voix\s*:\s*([^.,\n]+)/i);
    if (voiceMatch) {
      metadata.voice = voiceMatch[1].trim();
    }

    // Extraire la durée
    const durationMatch = text.match(/durée\s*:\s*(\d+)/i);
    if (durationMatch) {
      metadata.duration = parseInt(durationMatch[1]);
    }

    // Extraire l'audience
    const audienceMatch = text.match(/(?:audience|public)\s*:\s*([^.,\n]+)/i);
    if (audienceMatch) {
      metadata.audience = audienceMatch[1].trim();
    }

    // Nettoyer le texte
    metadata.cleanedText = this.cleanForTTS(text);

    return metadata;
  }

  /**
   * Valide que le texte est approprié pour la synthèse vocale
   */
  static validateForTTS(text: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Vérifications de base
    if (!text || text.trim().length === 0) {
      errors.push("Le texte ne peut pas être vide");
    }

    if (text.length > 5000) {
      errors.push("Le texte est trop long (maximum 5000 caractères)");
    }

    if (text.length < 3) {
      warnings.push("Le texte est très court");
    }

    // Vérifier la présence de caractères problématiques
    const problematicChars = /[<>{}[\]]/g;
    if (problematicChars.test(text)) {
      warnings.push("Le texte contient des caractères qui pourraient affecter la synthèse");
    }

    // Vérifier le ratio de ponctuation
    const punctuationRatio = (text.match(/[.!?]/g) || []).length / text.length;
    if (punctuationRatio > 0.1) {
      warnings.push("Beaucoup de ponctuation - la synthèse pourrait être hachée");
    }

    // Vérifier la présence d'instructions parasites
    const hasInstructions = /\[(.*?)\]|\((.*?style.*?)\)/gi.test(text);
    if (hasInstructions) {
      warnings.push("Le texte contient des instructions qui seront supprimées");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Suggère des améliorations pour le texte
   */
  static suggestImprovements(text: string): string[] {
    const suggestions: string[] = [];
    const cleanedText = this.cleanForTTS(text);

    // Analyser la structure
    const sentences = cleanedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

    if (avgSentenceLength > 100) {
      suggestions.push("Considérez raccourcir les phrases pour une meilleure fluidité");
    }

    if (sentences.length === 1 && cleanedText.length > 200) {
      suggestions.push("Ajoutez de la ponctuation pour créer des pauses naturelles");
    }

    // Vérifier la répétition de mots
    const words = cleanedText.toLowerCase().split(/\s+/);
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    const repeatedWords = Array.from(wordCount.entries())
      .filter(([word, count]) => count > 3 && word.length > 3)
      .map(([word]) => word);

    if (repeatedWords.length > 0) {
      suggestions.push(`Mots répétés détectés: ${repeatedWords.join(', ')} - considérez utiliser des synonymes`);
    }

    return suggestions;
  }
}