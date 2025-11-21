import fetch from 'node-fetch';

// Le module 'dotenv' n'est PAS requis ici car Netlify charge automatiquement les variables d'environnement.

// --- Configuration API ---
// Récupère les clés directement depuis l'environnement Netlify
const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
const HF_MODEL_URL = process.env.HF_MODEL_URL; 
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

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
        // En prod, le fallback doit être simple ou une erreur
        return "CONTEXTE FACTUEL: Clés Google Search non configurées sur Netlify. Utilisateurs, veuillez prendre cette information avec précaution.";
    }

    // --- LOGIQUE D'APPEL RÉEL À GOOGLE CUSTOM SEARCH API ---
    // Augmentation du nombre de résultats à 5.
    const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${GOOGLE_SEARCH_CX}&key=${GOOGLE_SEARCH_API_KEY}&num=5&lr=lang_fr`;
    
    try {
        const searchResponse = await fetch(searchUrl);
        
        if (!searchResponse.ok) {
            const errorData = await searchResponse.text();
            console.error("[Grounding] Erreur API Google Search:", searchResponse.status, errorData);
            return "CONTEXTE FACTUEL: Une erreur est survenue lors de la recherche de contexte (API Search).";
        }
        
        const searchData = await searchResponse.json();
        
        if (searchData.items && searchData.items.length > 0) {
            let snippets = searchData.items
                .map(item => `[Snippet] ${item.snippet}`)
                .join(' ');
            
            // TRONCATURE : Limiter la prémisse totale à 400 caractères
            snippets = "CONTEXTE FACTUEL: " + truncateString(snippets, 400);

            console.log(`[Grounding] Contexte réel récupéré (${searchData.items.length} snippets).`);
            return snippets; 
        } else {
            return "CONTEXTE FACTUEL: Le moteur de recherche n'a trouvé aucune information récente ou pertinente sur ce sujet. Utilisateurs, veuillez prendre cette information avec précaution.";
        }

    } catch (e) {
        console.error("[Grounding] Erreur réseau lors de l'appel à l'API de recherche:", e.message);
        return "CONTEXTE FACTUEL: Une erreur de réseau empêche la récupération de contexte factuel.";
    }
}


/**
 * Point d'entrée principal pour la fonction Netlify.
 * @param {object} event - L'événement HTTP déclenchant la fonction.
 */
export async function handler(event) {
    // Les fonctions Netlify n'autorisent que la méthode POST dans ce contexte d'API
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Méthode non autorisée. Utilisez POST.' };
    }

    // Le corps de la requête est une chaîne JSON qui doit être parsée
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Corps de requête JSON invalide." }) };
    }

    const { input, isLink } = body;

    if (!input) {
        return { statusCode: 400, body: JSON.stringify({ error: "Le champ 'input' est requis." }) };
    }

    if (!HF_API_KEY || !HF_MODEL_URL) {
        return { statusCode: 500, body: JSON.stringify({ error: "Configuration API Hugging Face manquante ou invalide dans Netlify." }) };
    }

    // --- 1. RÉCUPÉRATION DU CONTEXTE (Grounding) ---
    const CONTEXT_PREMISE = await fetchRealSearchContext(input);
    
    let hypothesis = input;
    if (isLink) {
        hypothesis = `L'information du lien est : ${input}`;
    }
    
    // --- NOUVEAU FORMAT D'ANALYSE ---
    const textToAnalyze = `${CONTEXT_PREMISE} DÉCLARATION À VÉRIFIER: ${hypothesis}`;

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
            
            const errorMessage = typeof errorData === 'object' && errorData.error 
                ? errorData.error
                : `Statut ${hfResponse.status}: ${errorData}`;

            return {
                statusCode: 502,
                body: JSON.stringify({ 
                    error: "Erreur lors de la communication avec l'API Hugging Face.",
                    details: errorMessage
                })
            };
        }

        const data = await hfResponse.json();

        // --- 3. Logique de Fact-Checking et Préparation de la Réponse ---
        
        let responseData = Array.isArray(data) ? data[0] : data;
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
            // Nettoyer la prémisse pour l'affichage utilisateur
            const cleanPremise = CONTEXT_PREMISE.replace(/CONTEXTE FACTUEL: /, '').replace(/\[Snippet\]/g, ' -');
            verificationResult.explanation += `<br><br>Contexte Factuel Utilisé (Snippets de recherche) : <i class="text-xs italic">"${cleanPremise.substring(0, 200)}..."</i>`;
        }
        
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(verificationResult)
        };

    } catch (error) {
        console.error('Erreur interne de la fonction:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Erreur interne de la fonction lors du traitement de l'information." })
        };
    }
}