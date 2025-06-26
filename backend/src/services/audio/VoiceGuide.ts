// backend/src/services/audio/VoiceGuide.ts

export interface VoiceInfo {
  name: string;
  gender: 'feminine' | 'masculine' | 'neutral';
  style: string;
  description: string;
  bestFor: string[];
  mythology?: string;
}

export const GEMINI_VOICE_GUIDE: Record<string, VoiceInfo> = {
  // === VOIX FÉMININES ===
  aoede: {
    name: 'aoede',
    gender: 'feminine',
    style: 'Chaleureuse et poétique',
    description: 'Voix féminine douce et expressive, parfaite pour les contenus narratifs',
    bestFor: ['narration', 'poésie', 'contenu éducatif', 'meditation'],
    mythology: 'Muse de la poésie et du chant dans la mythologie grecque'
  },

  callirrhoe: {
    name: 'callirrhoe',
    gender: 'feminine',
    style: 'Jeune et fraîche',
    description: 'Voix féminine jeune et dynamique, idéale pour un public jeune',
    bestFor: ['publicité jeune', 'contenu social media', 'tutoriels', 'jeux'],
    mythology: 'Nymphe de la mythologie grecque'
  },

  despina: {
    name: 'despina',
    gender: 'feminine',
    style: 'Moderne et claire',
    description: 'Voix féminine moderne et professionnelle',
    bestFor: ['présentation corporate', 'formation professionnelle', 'actualités'],
    mythology: 'Lune de Neptune'
  },

  pulcherrima: {
    name: 'pulcherrima',
    gender: 'feminine',
    style: 'Belle et élégante',
    description: 'Voix féminine raffinée, parfaite pour les contenus de luxe',
    bestFor: ['publicité luxe', 'mode', 'beauté', 'gastronomie'],
    mythology: 'Signifie "la plus belle" en latin'
  },

  vindemiatrix: {
    name: 'vindemiatrix',
    gender: 'feminine',
    style: 'Expressive et passionnée',
    description: 'Voix féminine expressive avec beaucoup de caractère',
    bestFor: ['théâtre', 'publicité émotionnelle', 'storytelling'],
    mythology: 'Constellation de la Vierge, signifie "vendangeuse"'
  },

  // === VOIX MASCULINES ===
  achernar: {
    name: 'achernar',
    gender: 'masculine',
    style: 'Forte et autoritaire',
    description: 'Voix masculine puissante et confiante',
    bestFor: ['publicité automobile', 'sport', 'action', 'leadership'],
    mythology: 'Étoile la plus brillante de la constellation Eridan'
  },

  charon: {
    name: 'charon',
    gender: 'masculine',
    style: 'Profonde et mystérieuse',
    description: 'Voix masculine grave et imposante',
    bestFor: ['documentaire', 'thriller', 'mystère', 'science-fiction'],
    mythology: 'Passeur des Enfers dans la mythologie grecque'
  },

  orus: {
    name: 'orus',
    gender: 'masculine',
    style: 'Directe et claire',
    description: 'Voix masculine claire et professionnelle',
    bestFor: ['actualités', 'formation', 'présentation', 'instruction'],
    mythology: 'Nom mythologique égyptien'
  },

  fenrir: {
    name: 'fenrir',
    gender: 'masculine',
    style: 'Puissante et dramatique',
    description: 'Voix masculine intense et captivante',
    bestFor: ['epic trailer', 'jeux vidéo', 'fantasy', 'action'],
    mythology: 'Loup géant de la mythologie nordique'
  },

  // === VOIX NEUTRES/SPÉCIALISÉES ===
  sadachbia: {
    name: 'sadachbia',
    gender: 'neutral',
    style: 'Traditionnelle et sage',
    description: 'Voix neutre avec une touche de sagesse traditionnelle',
    bestFor: ['contenu culturel', 'histoire', 'philosophie', 'spiritualité'],
    mythology: 'Étoile de la constellation du Verseau'
  },

  zephyr: {
    name: 'zephyr',
    gender: 'neutral',
    style: 'Légère et apaisante',
    description: 'Voix douce comme une brise, très apaisante',
    bestFor: ['relaxation', 'méditation', 'nature', 'bien-être'],
    mythology: 'Vent doux de l\'ouest dans la mythologie grecque'
  },

  umbriel: {
    name: 'umbriel',
    gender: 'neutral',
    style: 'Sombre et intriguante',
    description: 'Voix avec une touche mystérieuse et sombre',
    bestFor: ['thriller', 'mystère', 'horreur', 'suspense'],
    mythology: 'Lune d\'Uranus, du nom d\'un personnage sombre'
  }
};

// Fonction pour recommander une voix selon le contexte
export function recommendVoice(context: {
  projectType?: string;
  targetAudience?: string;
  emotion?: string;
  gender?: string;
}): string {
  const { projectType, targetAudience, emotion, gender } = context;

  // Recommandations par type de projet
  if (projectType === 'radio' || projectType === 'publicité') {
    if (gender === 'masculine') return 'achernar';
    if (gender === 'feminine') return 'aoede';
    return 'callirrhoe'; // Voix jeune pour pub
  }

  if (projectType === 'documentaire') {
    if (gender === 'masculine') return 'charon';
    if (gender === 'feminine') return 'vindemiatrix';
    return 'sadachbia'; // Voix sage pour documentaire
  }

  if (projectType === 'elearning' || projectType === 'formation') {
    if (gender === 'masculine') return 'orus';
    return 'despina'; // Voix claire pour formation
  }

  if (projectType === 'meditation' || projectType === 'relaxation') {
    return 'zephyr'; // Voix apaisante
  }

  // Recommandations par audience
  if (targetAudience?.includes('jeune')) {
    return 'callirrhoe';
  }

  if (targetAudience?.includes('professionnel')) {
    if (gender === 'masculine') return 'orus';
    return 'despina';
  }

  // Recommandations par émotion
  if (emotion === 'dramatic' || emotion === 'intense') {
    if (gender === 'masculine') return 'fenrir';
    return 'vindemiatrix';
  }

  if (emotion === 'calm' || emotion === 'peaceful') {
    return 'zephyr';
  }

  if (emotion === 'professional') {
    if (gender === 'masculine') return 'orus';
    return 'despina';
  }

  // Fallback par genre
  if (gender === 'masculine') return 'achernar';
  if (gender === 'feminine') return 'aoede';

  // Fallback général
  return 'aoede';
}

// Fonction pour obtenir les voix par catégorie
export function getVoicesByCategory() {
  return {
    feminine: Object.entries(GEMINI_VOICE_GUIDE)
      .filter(([_, info]) => info.gender === 'feminine')
      .map(([name, info]) => ({ name, ...info })),

    masculine: Object.entries(GEMINI_VOICE_GUIDE)
      .filter(([_, info]) => info.gender === 'masculine')
      .map(([name, info]) => ({ name, ...info })),

    neutral: Object.entries(GEMINI_VOICE_GUIDE)
      .filter(([_, info]) => info.gender === 'neutral')
      .map(([name, info]) => ({ name, ...info }))
  };
}