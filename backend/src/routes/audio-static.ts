// backend/src/routes/audio-static.ts
import { Router } from "express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function (router: Router) {
  // Chemin corrigé vers le dossier audio_outputs
  const audioOutputDir = path.join(__dirname, "../../audio_outputs");

  console.log("📁 Configuration du dossier audio:", audioOutputDir);

  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(audioOutputDir)) {
    fs.mkdirSync(audioOutputDir, { recursive: true });
    console.log("✅ Dossier audio_outputs créé");
  }

  // Créer un fichier audio de test s'il n'existe pas
  const sampleFilePath = path.join(audioOutputDir, "sample_audio.wav");
  if (!fs.existsSync(sampleFilePath)) {
    console.log("🎵 Création du fichier audio de test...");
    
    // Créer un fichier WAV minimal (1 seconde de silence)
    const sampleRate = 44100;
    const duration = 1;
    const numSamples = sampleRate * duration;
    const buffer = Buffer.alloc(44 + numSamples * 2);
    
    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);
    
    fs.writeFileSync(sampleFilePath, buffer);
    console.log("✅ Fichier audio de test créé");
  }

  // Route principale pour servir les fichiers audio
  router.use('/audio', express.static(audioOutputDir, {
    setHeaders: (res, filePath) => {
      // Headers pour les fichiers audio
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.webm': 'audio/webm'
      };
      
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
      
      // Headers pour permettre le streaming
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }));

  // Route pour lister les fichiers audio disponibles
  router.get('/audio-list', (req, res) => {
    try {
      const files = fs.readdirSync(audioOutputDir)
        .filter(file => /\.(wav|mp3|ogg|m4a|webm)$/i.test(file))
        .map(file => {
          const stats = fs.statSync(path.join(audioOutputDir, file));
          return {
            name: file,
            url: `/audio/${file}`,
            fullUrl: `http://localhost:3333/audio/${file}`,
            size: stats.size,
            sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`,
            created: stats.birthtime,
            mimeType: getMimeType(file)
          };
        });

      res.json({
        success: true,
        directory: audioOutputDir,
        count: files.length,
        files: files
      });
    } catch (error: any) {
      console.error("❌ Erreur lecture dossier:", error);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la lecture du dossier audio",
        details: error.message
      });
    }
  });

  // Route de test avec lecteur audio intégré
  router.get('/audio-test', (req, res) => {
    const files = fs.readdirSync(audioOutputDir)
      .filter(file => /\.(wav|mp3|ogg|m4a|webm)$/i.test(file));
    
    const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Audio - Ekho Studio</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                padding: 20px; 
                background: #f5f5f5;
                max-width: 800px;
                margin: 0 auto;
            }
            h1 { color: #333; }
            .audio-item { 
                margin: 20px 0; 
                padding: 20px; 
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .audio-item h3 { margin-top: 0; color: #2563eb; }
            audio { 
                width: 100%; 
                margin: 10px 0;
                display: block;
            }
            .info { 
                color: #666; 
                font-size: 14px; 
                margin: 10px 0;
            }
            .download-btn {
                display: inline-block;
                padding: 8px 16px;
                background: #2563eb;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                font-size: 14px;
                margin-top: 10px;
            }
            .download-btn:hover {
                background: #1d4ed8;
            }
            .test-audio-btn {
                padding: 10px 20px;
                font-size: 16px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                margin: 20px 0;
            }
            .test-audio-btn:hover {
                background: #059669;
            }
        </style>
    </head>
    <body>
        <h1>🎵 Test des fichiers audio - Ekho Studio</h1>
        <p class="info">Dossier audio: <code>${audioOutputDir}</code></p>
        
        <button class="test-audio-btn" onclick="testAudioPlayback()">
            🔊 Tester la lecture audio
        </button>
        
        <div id="audioList">
            ${files.length > 0 ? files.map(file => `
                <div class="audio-item">
                    <h3>${file}</h3>
                    <audio controls preload="metadata">
                        <source src="/audio/${file}" type="${getMimeType(file)}">
                        Votre navigateur ne supporte pas l'audio HTML5.
                    </audio>
                    <p class="info">
                        URL: <code>http://localhost:3333/audio/${file}</code><br>
                        Taille: ${(fs.statSync(path.join(audioOutputDir, file)).size / 1024).toFixed(2)} KB
                    </p>
                    <a href="/audio/${file}" download class="download-btn">
                        📥 Télécharger
                    </a>
                </div>
            `).join('') : '<p>Aucun fichier audio trouvé</p>'}
        </div>
        
        <script>
            function testAudioPlayback() {
                const testAudio = new Audio('/audio/sample_audio.wav');
                testAudio.play().then(() => {
                    alert('✅ La lecture audio fonctionne !');
                }).catch(err => {
                    alert('❌ Erreur de lecture: ' + err.message);
                });
            }
            
            // Test automatique au chargement
            window.addEventListener('load', () => {
                console.log('Page chargée, test des fichiers audio...');
                document.querySelectorAll('audio').forEach((audio, index) => {
                    audio.addEventListener('loadedmetadata', () => {
                        console.log(\`Audio \${index + 1} chargé avec succès\`);
                    });
                    audio.addEventListener('error', (e) => {
                        console.error(\`Erreur audio \${index + 1}:\`, e);
                    });
                });
            });
        </script>
    </body>
    </html>
    `;

    res.send(testHtml);
  });

  // Route pour supprimer un fichier audio
  router.delete('/audio/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(audioOutputDir, filename);

      // Sécurité : empêcher la navigation dans les dossiers
      if (filename.includes('..') || filename.includes('/')) {
        res.status(400).json({
          success: false,
          error: "Nom de fichier invalide"
        });
        return;
      }

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
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: "Erreur lors de la suppression",
        details: error.message
      });
    }
  });

  console.log("✅ Routes audio configurées:");
  console.log("   - GET /audio/:filename - Sert les fichiers audio");
  console.log("   - GET /audio-list - Liste les fichiers disponibles");
  console.log("   - GET /audio-test - Page de test avec lecteur");
  console.log("   - DELETE /audio/:filename - Supprime un fichier");

  return router;
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.webm': 'audio/webm'
  };
  return mimeTypes[ext] || 'audio/mpeg';
}