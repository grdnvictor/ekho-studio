// backend/src/routes/audio-static.ts
import { Router } from "express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function (router: Router) {
  const audioOutputDir = path.join(__dirname, "../../../audio_outputs");

  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(audioOutputDir)) {
    fs.mkdirSync(audioOutputDir, { recursive: true });
    console.log("📁 Dossier audio_outputs créé pour servir les fichiers");
  }

  // Middleware pour servir les fichiers audio statiques
  router.use('/audio', express.static(audioOutputDir, {
    setHeaders: (res, path) => {
      // Définir les headers appropriés pour les fichiers audio
      if (path.endsWith('.wav')) {
        res.setHeader('Content-Type', 'audio/wav');
      } else if (path.endsWith('.mp3')) {
        res.setHeader('Content-Type', 'audio/mpeg');
      } else if (path.endsWith('.ogg')) {
        res.setHeader('Content-Type', 'audio/ogg');
      }

      // Permettre la lecture depuis le navigateur
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache 1h
    }
  }));

  // Route pour lister les fichiers audio disponibles (debug)
  router.get('/audio-list', (req, res) => {
    try {
      const files = fs.readdirSync(audioOutputDir)
        .filter(file => file.match(/\.(wav|mp3|ogg)$/i))
        .map(file => ({
          name: file,
          url: `http://localhost:3333/audio/${file}`,
          size: fs.statSync(path.join(audioOutputDir, file)).size,
          created: fs.statSync(path.join(audioOutputDir, file)).birthtime
        }));

      res.json({
        success: true,
        audioDirectory: audioOutputDir,
        files: files
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Erreur lors de la lecture du dossier audio",
        details: error.message
      });
    }
  });

  // Route pour supprimer un fichier audio (nettoyage)
  router.delete('/audio/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(audioOutputDir, filename);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log("🗑️ Fichier audio supprimé:", filename);
        res.json({
          success: true,
          message: `Fichier ${filename} supprimé`
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Fichier non trouvé"
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Erreur lors de la suppression",
        details: error.message
      });
    }
  });

  // Route de test pour vérifier que les fichiers audio sont accessibles
  router.get('/audio-test', (req, res) => {
    const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Audio - Ekho Studio</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .audio-item { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        </style>
    </head>
    <body>
        <h1>🎵 Test des fichiers audio</h1>
        <p>Dossier audio: ${audioOutputDir}</p>
        
        <div id="audioList">Chargement...</div>
        
        <script>
            fetch('/audio-list')
                .then(res => res.json())
                .then(data => {
                    const container = document.getElementById('audioList');
                    if (data.success && data.files.length > 0) {
                        container.innerHTML = data.files.map(file => \`
                            <div class="audio-item">
                                <h3>\${file.name}</h3>
                                <p>Taille: \${(file.size / 1024).toFixed(2)} KB | Créé: \${new Date(file.created).toLocaleString()}</p>
                                <audio controls style="width: 100%;">
                                    <source src="\${file.url}" type="audio/wav">
                                    Votre navigateur ne supporte pas l'audio.
                                </audio>
                                <br><br>
                                <a href="\${file.url}" download>📥 Télécharger</a>
                            </div>
                        \`).join('');
                    } else {
                        container.innerHTML = '<p>Aucun fichier audio trouvé</p>';
                    }
                })
                .catch(err => {
                    document.getElementById('audioList').innerHTML = '<p>Erreur: ' + err.message + '</p>';
                });
        </script>
    </body>
    </html>
    `;

    res.send(testHtml);
  });

  console.log("✅ Routes audio statiques configurées:");
  console.log("   - GET /audio/:filename - Serve les fichiers audio");
  console.log("   - GET /audio-list - Liste les fichiers disponibles");
  console.log("   - GET /audio-test - Page de test");
  console.log("   - DELETE /audio/:filename - Supprime un fichier");

  return router;
}