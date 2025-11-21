import express, { json } from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(json());

// --- Configuration API ---
const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
const HF_MODEL_URL = process.env.HF_MODEL_URL; 

// --- Configuration Google Search API (Custom Search Engine) ---
// Vous devez obtenir ces clés et les ajouter dans server/.env
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX; // L'ID de votre moteur de recherche personnalisé

/**
 * Fonction utilitaire pour tronquer une chaîne à une longueur maximale donnée.
 * @param {string} str - La chaîne à tronquer.
 * @param {number} maxLen - La longueur maximale souhaitée.
 * @returns {string} La chaîne tronquée.
 */
function truncateString(str, maxLen) {
    if (str.length > maxLen) {
        return str.substring(0, maxLen - 3) + "...";
    }
    return str;
}


/**
 * Fonction de Grounding (RAG - Retrieval-Augmented Generation)
 * Appelle l'API Google Custom Search pour récupérer des faits pertinents.
 * @param {string} query - La requête de l'utilisateur.
 * @returns {Promise<string>} La prémisse (le fait connu) récupérée du web.
 */
async function fetchRealSearchContext(query) {
    console.log(`[Grounding] Tentative de récupération du contexte de recherche pour: ${query}`);
    
    // Si les clés de recherche ne sont pas configurées, on utilise le fallback
    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
        console.warn("[Grounding] CLÉS GOOGLE SEARCH MANQUANTES ou INVALIDE. Utilisation du fallback statique.");
        // --- FALLBACK STATIQUE (pour assurer la fonctionnalité) ---
        if (query.toLowerCase().includes('paris') || query.toLowerCase().includes('france') || query.toLowerCase().includes('capitale')) {
            return "CONTEXTE FACTUEL: La capitale de la France est Paris et la Tour Eiffel est l'un de ses monuments les plus célèbres.";
        } 
        if (query.toLowerCase().includes('chien') || query.toLowerCase().includes('chat') || query.toLowerCase().includes('animal')) {
            return "CONTEXTE FACTUEL: Les chiens sont des mammifères domestiques et la race Golden Retriever est très populaire.";
        }
        return "CONTEXTE FACTUEL: La Terre tourne autour du Soleil et est la troisième planète du système solaire.";
    }

    // --- LOGIQUE D'APPEL RÉEL À GOOGLE CUSTOM SEARCH API ---
    // AJOUT CLÉ : L'API Google Custom Search utilise 'lr=lang_xx' pour filtrer la langue.
    // Nous ajoutons 'lr=lang_fr' pour forcer les résultats en français,
    // ce qui améliorera la pertinence et la performance du modèle NLI.
    const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${GOOGLE_SEARCH_CX}&key=${GOOGLE_SEARCH_API_KEY}&num=3&lr=lang_fr`;
    
    try {
        const searchResponse = await fetch(searchUrl);
        
        if (!searchResponse.ok) {
            const errorData = await searchResponse.text();
            console.error("[Grounding] Erreur API Google Search:", searchResponse.status, errorData);
            return "CONTEXTE FACTUEL: Une erreur est survenue lors de la recherche de contexte. Utilisateurs, veuillez prendre cette information avec précaution.";
        }
        
        const searchData = await searchResponse.json();
        
        if (searchData.items && searchData.items.length > 0) {
            // Concaténation des snippets pour former la Prémisse
            // On préfixe chaque snippet pour le rendre plus clair pour le modèle NLI
            let snippets = searchData.items
                .map(item => `[Snippet] ${item.snippet}`)
                .join(' ');
            
            // TRONCATURE : Limiter la prémisse totale à une taille plus courte (300 caractères)
            // pour réduire le bruit dans la Prémisse NLI.
            snippets = "CONTEXTE FACTUEL: " + truncateString(snippets, 300);

            console.log(`[Grounding] Contexte réel récupéré (${searchData.items.length} snippets).`);
            return snippets; 
        } else {
            console.log("[Grounding] Aucun résultat trouvé. Utilisation du fait général.");
            return "CONTEXTE FACTUEL: Le moteur de recherche n'a trouvé aucune information récente ou pertinente sur ce sujet. Utilisateurs, veuillez prendre cette information avec précaution.";
        }

    } catch (e) {
        console.error("[Grounding] Erreur réseau lors de l'appel à l'API de recherche:", e.message);
        return "CONTEXTE FACTUEL: Une erreur de réseau empêche la récupération de contexte factuel. Utilisateurs, veuillez prendre cette information avec précaution.";
    }
}


/**
 * Route sécurisée pour la vérification de l'information.
 */
app.post('/api/verify', async (req, res) => {
    const { input, isLink } = req.body;

    if (!input) {
        return res.status(400).json({ error: "Le champ 'input' est requis." });
    }

    if (!HF_API_KEY || HF_API_KEY.includes('VOTRE_JETON_SEUL_ICI')) {
        console.error("Clé API Hugging Face non configurée ou placeholder utilisé.");
        return res.status(500).json({ error: "Configuration API Hugging Face manquante ou invalide dans .env." });
    }

    // --- 1. RÉCUPÉRATION DU CONTEXTE (Grounding) ---
    const CONTEXT_PREMISE = await fetchRealSearchContext(input);
    
    let hypothesis = input;
    if (isLink) {
        // En production, le scraping réel aurait lieu ici
        hypothesis = `L'information du lien est : ${input}`;
    }
    
    // --- NOUVEAU FORMAT D'ANALYSE (Meilleure démarcation) ---
    // Le modèle NLI reçoit : Prémisse + [Séparateur] + Hypothèse
    const textToAnalyze = `${CONTEXT_PREMISE} DÉCLARATION À VÉRIFIER: ${hypothesis}`;

    // Log pour le développeur
    console.log(`[Backend] Texte envoyé au modèle NLI (Tronqué pour console): ${truncateString(textToAnalyze, 100)}`);


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
                verificationResult.explanation = `Le modèle détecte une **forte contradiction** (Score: ${score.toFixed(2)}) avec les faits trouvés par la recherche.`;
            } else if (label === 'ENTAILMENT' && score > 0.8) {
                verificationResult.status = 'VERIFIED';
                verificationResult.explanation = `Le modèle confirme la cohérence (Score: ${score.toFixed(2)}) de cette information avec les faits trouvés par la recherche.`;
            } else {
                verificationResult.explanation = `Le modèle est neutre ou l'indice de confiance (${score.toFixed(2)}) est trop bas.`;
            }

            // Ajout du contexte à l'explication (si pas en mode fallback simple)
            if (!CONTEXT_PREMISE.includes("La Terre tourne autour du Soleil")) {
                // Nettoyer la prémisse pour l'affichage utilisateur
                const cleanPremise = CONTEXT_PREMISE.replace(/CONTEXTE FACTUEL: /, '').replace(/\[Snippet\]/g, ' -');
                verificationResult.explanation += `<br><br>Contexte Factuel Utilisé (Snippets de recherche) : <i class="text-xs italic">"${cleanPremise.substring(0, 200)}..."</i>`;
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