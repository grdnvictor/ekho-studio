import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Remplace les variables dynamiques dans le prompt
 * Similaire à votre generate_prompt.mts existant
 */
export function replacePromptVariables(promptTemplate: string): string {
  const now = new Date();
  
  // Variables disponibles (vous pouvez en ajouter d'autres)
  const variables = {
    date: now.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    heure: now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    timestamp: now.toISOString(),
    jour: now.toLocaleDateString('fr-FR', { weekday: 'long' }),
    mois: now.toLocaleDateString('fr-FR', { month: 'long' }),
    annee: now.getFullYear().toString(),
    datetime: now.toLocaleString('fr-FR'),
    iso_date: now.toISOString().split('T')[0],
    iso_time: now.toISOString().split('T')[1].split('.')[0],
    
    // Variables spécifiques à l'audio
    studio_name: "Ekho Studio",
    version: "1.0.0",
    available_voices: "Sadachbia, Aoede, Astra, Thalia, Nova, Echo, Zara, Atlas",
    supported_languages: "Français, Anglais, Espagnol, Italien"
  };

  // Remplacer toutes les variables {variable} dans le prompt
  let processedPrompt = promptTemplate;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    processedPrompt = processedPrompt.replace(regex, value);
  });

  return processedPrompt;
}

/**
 * Charge et traite un prompt depuis un fichier
 */
export function loadAndProcessPrompt(promptPath: string): string {
  try {
    const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    return replacePromptVariables(promptTemplate);
  } catch (error) {
    console.error(`Erreur lors du chargement du prompt: ${promptPath}`, error);
    throw new Error(`Impossible de charger le prompt: ${promptPath}`);
  }
}

/**
 * Charge un prompt depuis un agent spécifique
 * C'est la fonction principale que vous utiliserez
 */
export function loadAgentPrompt(agentName: string): string {
  // Construit le chemin vers le prompt de l'agent
  const promptPath = path.join(
    __dirname, 
    '..', 
    'agents', 
    agentName, 
    'prompt.md'
  );
  
  return loadAndProcessPrompt(promptPath);
}

/**
 * Charge un prompt avec des variables personnalisées
 */
export function loadAgentPromptWithVariables(
  agentName: string, 
  customVariables: Record<string, string> = {}
): string {
  const promptPath = path.join(
    __dirname, 
    '..', 
    'agents', 
    agentName, 
    'prompt.md'
  );
  
  try {
    let promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    
    // D'abord remplacer les variables par défaut
    promptTemplate = replacePromptVariables(promptTemplate);
    
    // Puis remplacer les variables personnalisées
    Object.entries(customVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      promptTemplate = promptTemplate.replace(regex, value);
    });
    
    return promptTemplate;
  } catch (error) {
    console.error(`Erreur lors du chargement du prompt: ${promptPath}`, error);
    throw new Error(`Impossible de charger le prompt: ${promptPath}`);
  }
}

/**
 * Valide qu'un prompt existe pour un agent
 */
export function validateAgentPrompt(agentName: string): boolean {
  const promptPath = path.join(
    __dirname, 
    '..', 
    'agents', 
    agentName, 
    'prompt.md'
  );
  
  return fs.existsSync(promptPath);
}

/**
 * Liste tous les agents disponibles
 */
export function getAvailableAgents(): string[] {
  const agentsDir = path.join(__dirname, '..', 'agents');
  
  try {
    return fs.readdirSync(agentsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(agentName => validateAgentPrompt(agentName));
  } catch (error) {
    console.error('Erreur lors de la lecture du dossier agents:', error);
    return [];
  }
}

// Export de la fonction principale (pour compatibilité avec votre code existant)
export { loadAgentPrompt as default };