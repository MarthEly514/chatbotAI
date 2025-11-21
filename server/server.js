import express, { json } from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // Pour faire des requêtes HTTP depuis Node
import 'dotenv/config'; // Chargement des variables d'environnement (.env) pour les modules ES

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(json()); // Pour analyser les corps de requête en JSON

// --- Configuration API ---
const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
const HF_MODEL_URL = process.env.HF_MODEL_URL; 

/**
 * Route sécurisée pour la vérification de l'information.
 */
app.post('/api/verify', async (req, res) => {
    const { input, isLink } = req.body;

    if (!input) {
        return res.status(400).json({ error: "Le champ 'input' est requis." });
    }

    if (!HF_API_KEY || HF_API_KEY.includes('votre_vrai_jeton_huggingface_ici')) {
        console.error("Clé API Hugging Face non configurée ou placeholder utilisé.");
        return res.status(500).json({ error: "Configuration API manquante sur le serveur. Veuillez remplacer le placeholder dans .env." });
    }

    // --- 1. AJOUT CRITIQUE : DÉFINITION DE LA PRÉMISSE (FAIT CONNU) ---
    // ATTENTION : En production, cette prémisse doit être dynamique, 
    // récupérée d'un moteur de recherche externe (Grounding/RAG) pour le VRAI fact-checking.
    // Ici, nous utilisons un fait simple pour la démonstration NLI.
    const CONTEXT_PREMISE = "La capitale de la France est Paris et la Tour Eiffel est l'un de ses monuments les plus célèbres.";
    
    let hypothesis = input;
    if (isLink) {
        // Logique de scraping simulée pour les liens
        hypothesis = `L'information du lien est : ${input}`;
    }
    
    // Format NLI : Prémisse + Hypothèse (concaténation simple pour ce modèle)
    const textToAnalyze = CONTEXT_PREMISE + " " + hypothesis;
    console.log(`[Backend] Texte envoyé au modèle NLI: ${textToAnalyze.substring(0, 100)}...`);


    try {
        // --- 2. Appel Sécurisé à l'API Hugging Face ---
        const hfResponse = await fetch(HF_MODEL_URL, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${HF_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inputs: textToAnalyze,
                parameters: {
                    candidate_labels: ["CONTRADICTION", "ENTAILMENT", "NEUTRAL"],
                    multi_label: false
                },
                options: { "wait_for_model": true }
            })
        });

        if (!hfResponse.ok) {
            let errorData;
            try {
                errorData = await hfResponse.json();
            } catch (e) {
                errorData = await hfResponse.text();
            }
            
            console.error('Erreur API Hugging Face (Statut %d):', hfResponse.status, errorData);
            
            const errorMessage = typeof errorData === 'object' && errorData.error 
                ? errorData.error
                : `Statut ${hfResponse.status}: ${errorData}`;

            return res.status(502).json({ 
                error: "Erreur lors de la communication avec l'API Hugging Face.",
                details: errorMessage
            });
        }

        const data = await hfResponse.json();

        // --- 3. Logique de Fact-Checking et Préparation de la Réponse ---
        
        let responseData = data;
        if (Array.isArray(data) && data.length > 0) {
            responseData = data[0];
        }

        let bestResult = null;
        if (responseData && responseData.labels && responseData.scores) {
            let maxScore = -1;
            let maxLabel = 'NEUTRAL';
            
            responseData.scores.forEach((score, index) => {
                if (score > maxScore) {
                    maxScore = score;
                    maxLabel = responseData.labels[index];
                }
            });
            
            bestResult = { label: maxLabel, score: maxScore };
        }

        let verificationResult = {
            status: 'PARTIAL',
            explanation: "Information incertaine ou nécessitant des vérifications supplémentaires."
        };

        if (bestResult) {
             const { label, score } = bestResult;

             // Logique simple pour déterminer la fiabilité basée sur le score de confiance
             if (label === 'CONTRADICTION' && score > 0.8) {
                verificationResult.status = 'FAKE_NEWS';
                verificationResult.explanation = `Le modèle détecte une **forte contradiction** (Score: ${score.toFixed(2)}) avec le fait connu suivant: "${CONTEXT_PREMISE}".`;
            } else if (label === 'ENTAILMENT' && score > 0.8) {
                verificationResult.status = 'VERIFIED';
                verificationResult.explanation = `Le modèle confirme la cohérence (Score: ${score.toFixed(2)}) de cette information avec le fait connu suivant: "${CONTEXT_PREMISE}".`;
            } else {
                verificationResult.explanation = `Le modèle est neutre ou l'indice de confiance (${score.toFixed(2)}) est trop bas.`;
            }
        }
        
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