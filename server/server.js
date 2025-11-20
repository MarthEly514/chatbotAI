// server/server.js

import express, { json } from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // Pour faire des requêtes HTTP depuis Node
require('dotenv').config(); // Pour gérer les variables d'environnement

const app = express();
const port = 3000;

// Middleware
// Attention: En production, configurez CORS pour autoriser UNIQUEMENT votre domaine frontend.
app.use(cors());
app.use(json()); // Pour analyser les corps de requête en JSON

// --- Configuration API ---
// La clé est chargée depuis le fichier .env (NE JAMAIS LA CODER EN DUR)
const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
// URL d'un modèle NLI (Inference API) pour la démo
const HF_MODEL_URL = "https://api-inference.huggingface.co/models/ynie/albert-xxlarge-v2-snli_mnli_fever_anli_R1_R2_R3-nli"; 

// Si vous utilisez d'autres outils (ex: Google Search pour plus de contexte),
// ce code serait l'endroit idéal pour les intégrer.
// const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_API_KEY;


/**
 * Route sécurisée pour la vérification de l'information.
 */
app.post('/api/verify', async (req, res) => {
    const { input, isLink } = req.body;

    if (!input) {
        return res.status(400).json({ error: "Le champ 'input' est requis." });
    }

    if (!HF_API_KEY) {
        console.error("Clé API Hugging Face non configurée.");
        return res.status(500).json({ error: "Configuration API manquante sur le serveur." });
    }

    // --- 1. Logique de Traitement (Scraping ou formatage) ---
    let textToAnalyze = input;
    if (isLink) {
        // ⚠️ En production : Ici, vous implémenteriez la logique de scraping
        // pour récupérer le contenu réel de l'URL avant de l'envoyer au modèle.
        textToAnalyze = `Veuillez analyser la fiabilité de cette information provenant du lien : ${input}`;
        console.log(`[Backend] Tenter de scraper le lien: ${input}`);
    }


    try {
        // --- 2. Appel Sécurisé à l'API Hugging Face ---
        const hfResponse = await fetch(HF_MODEL_URL, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${HF_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "inputs": textToAnalyze,
                "options": { "wait_for_model": true }
            })
        });

        if (!hfResponse.ok) {
            const errorData = await hfResponse.json();
            console.error('Erreur API Hugging Face:', hfResponse.status, errorData);
            return res.status(502).json({ 
                error: "Erreur lors de la communication avec l'API Hugging Face.",
                details: errorData 
            });
        }

        const data = await hfResponse.json();

        // --- 3. Logique de Fact-Checking et Préparation de la Réponse ---
        // Cette partie est cruciale : elle traduit la sortie brute du modèle
        // en une réponse utilisateur claire.

        const bestResult = data[0] && data[0].length > 0 ? 
            data[0].reduce((prev, current) => (prev.score > current.score) ? prev : current) : null;
        
        let verificationResult = {
            status: 'PARTIAL',
            explanation: "Information incertaine ou nécessitant des vérifications supplémentaires."
        };

        if (bestResult) {
             const { label, score } = bestResult;

             if (label === 'CONTRADICTION' && score > 0.8) {
                verificationResult.status = 'FAKE_NEWS';
                verificationResult.explanation = `Le modèle détecte une **forte contradiction** (Score: ${score.toFixed(2)}) avec les faits connus.`;
            } else if (label === 'ENTAILMENT' && score > 0.8) {
                verificationResult.status = 'VERIFIED';
                verificationResult.explanation = `Le modèle confirme la cohérence (Score: ${score.toFixed(2)}) de cette information avec les faits.`;
            } else {
                verificationResult.explanation = `Le modèle est neutre ou l'indice de confiance (${score.toFixed(2)}) est trop bas.`;
            }
        }
        
        // Renvoie le résultat de l'analyse au frontend
        res.json(verificationResult);

    } catch (error) {
        console.error('Erreur interne du serveur:', error);
        res.status(500).json({ error: "Erreur interne du serveur lors du traitement de l'information." });
    }
});

app.listen(port, () => {
    console.log(`Serveur backend écoutant sur http://localhost:${port}`);
    console.log('N’OUBLIEZ PAS DE LANCER LE FRONTEND (votre index.html)');
});